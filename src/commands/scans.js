// The scan* family: the validation checks that audit/validate/status compose
// into findings, extracted from commands.js on 2026-07-16 (behavior-preserving
// refactor, GATE_REVIEW stabilization). Each scan reads wiki docs and returns a
// findings array (category.subrule shape); driftTargets is pure and exported for
// unit tests. Depends only on the Node stdlib, files.js, encoding.js,
// frontmatter.js, sensitive-info.js, git.js, and the sibling command modules
// (wiki-files, adapters, wiki-graph, references); no back-dependency on
// commands.js.
import path from "node:path";
import { listMarkdownFiles, pathExists, toPosix } from "../files.js";
import { findMojibakeIndicators, hasUtf8Bom, readTextAuto, readUtf8 } from "../encoding.js";
import { parseFrontmatter } from "../frontmatter.js";
import { scanSensitiveInfo } from "../sensitive-info.js";
import { fileChangedSince, lineRangeChangedSince } from "../git.js";
import { isAppendOnlyLog, listTargetMarkdown, listWikiContentDocs } from "./wiki-files.js";
import { ADAPTER_TARGETS } from "./adapters.js";
import { collectWikiGraph } from "./wiki-graph.js";
import {
  escapeRegex,
  extractMarkdownLinkTargets,
  extractMarkdownSection,
  getLineCount,
  isExternalSourceReference,
  isSkippedMarkdownLink,
  normalizeMarkdownLinkTarget,
  parseEvidenceReference,
  resolveMarkdownLinkTarget
} from "./references.js";

export async function scanEncoding(cwd) {
  const findings = [];
  for (const file of await listTargetMarkdown(cwd)) {
    const rel = toPosix(path.relative(cwd, file));
    const content = await readUtf8(file);
    const mojibake = findMojibakeIndicators(content);
    if (hasUtf8Bom(content)) {
      findings.push({ severity: "info", rule: "encoding.bom", path: rel, message: "UTF-8 BOM detected." });
    }
    if (mojibake.length) {
      findings.push({ severity: "blocked", rule: "encoding.mojibake", path: rel, message: "Mojibake indicators detected; automatic rewrite skipped." });
    }
  }
  return findings;
}

export async function scanSensitive(cwd) {
  const findings = [];
  const markdownFiles = await listTargetMarkdown(cwd);
  const adapterFiles = [];
  for (const target of Object.values(ADAPTER_TARGETS)) {
    const file = path.join(cwd, target.path);
    if (await pathExists(file)) adapterFiles.push(file);
  }

  for (const file of [...markdownFiles, ...adapterFiles]) {
    if (!(await pathExists(file))) continue;
    const rel = toPosix(path.relative(cwd, file));
    const content = await readUtf8(file);
    for (const finding of scanSensitiveInfo(content)) {
      findings.push({
        severity: "blocked",
        rule: "sensitive.redacted",
        path: `${rel}:${finding.line}`,
        message: `${finding.type}: ${finding.message}`
      });
    }
  }
  return findings;
}

export async function scanSourceFiles(cwd) {
  const findings = [];
  for (const file of await listTargetMarkdown(cwd)) {
    const rel = toPosix(path.relative(cwd, file));
    const content = await readUtf8(file);
    const parsed = parseFrontmatter(content);
    const sourceFiles = parsed.frontmatter?.source_files;

    if (!Array.isArray(sourceFiles)) continue;

    for (const sourceFile of sourceFiles) {
      if (typeof sourceFile !== "string") continue;

      const source = sourceFile.trim();
      if (!source || isExternalSourceReference(source)) continue;

      if (!(await pathExists(path.join(cwd, source)))) {
        findings.push({
          severity: "warning",
          rule: "source_files.missing",
          path: rel,
          message: `source_files entry does not exist: ${source}.`,
          params: { source }
        });
      }
    }
  }
  return findings;
}

export async function scanRelatedReferences(cwd) {
  const findings = [];
  for (const file of await listTargetMarkdown(cwd)) {
    const rel = toPosix(path.relative(cwd, file));
    const content = await readUtf8(file);
    const parsed = parseFrontmatter(content);
    const related = parsed.frontmatter?.related;

    if (!Array.isArray(related)) continue;

    for (const relatedEntry of related) {
      if (typeof relatedEntry !== "string") continue;

      const target = relatedEntry.trim();
      if (!target || isExternalSourceReference(target)) continue;

      if (!(await pathExists(path.join(cwd, target)))) {
        findings.push({
          severity: "warning",
          rule: "related.missing",
          path: rel,
          message: `related entry does not exist: ${target}.`,
          params: { target }
        });
      }
    }
  }
  return findings;
}

export const ENRICHMENT_PLACEHOLDER_SENTINELS = [
  "Concise summary: describe",
  "Add file paths, symbols, routes, commands, or test names inspected",
  "Add source files and commands inspected while completing",
  "Add source files, tests, routes, and client modules inspected",
  "Track unclear ownership",
  "Keep uncertain claims here until source evidence",
  "List each domain, owner area",
  "이 프로젝트에서 해당 주제의 기준 정보를 정리합니다.",
  "이 문서는 `llm-wiki init --write`가 생성한 초안입니다."
];

export async function scanEnrichment(cwd) {
  const findings = [];
  for (const file of await listTargetMarkdown(cwd)) {
    const rel = toPosix(path.relative(cwd, file));
    if (rel.includes("/templates/")) continue;

    const content = await readUtf8(file);
    const parsed = parseFrontmatter(content);
    const body = parsed.frontmatter ? parsed.body : content;

    if (ENRICHMENT_PLACEHOLDER_SENTINELS.some((sentinel) => body.includes(sentinel))) {
      findings.push({
        severity: "warning",
        rule: "content.not_enriched",
        path: rel,
        message: "Document still contains generated placeholder guidance and has not been enriched with source-backed content yet.",
        // Additive per-doc checklist (P5): which sections still hold placeholder
        // text, so `next` can tell an agent WHAT to fill and WHERE.
        checklist: enrichmentChecklist(body)
      });
    }
  }
  return findings;
}

// P5: for a document body, list the `##` sections that still contain generated
// placeholder guidance, so `next`/`handoff` can point an agent at WHAT to fill
// and WHERE. Splits on level-2 headings; a section is "to fill" when it still
// contains one of the ENRICHMENT_PLACEHOLDER_SENTINELS. Returns deduped (one per
// section, in document order) { section, hint } items where hint is the trimmed
// placeholder line. Pure; frontmatter is expected to be stripped by the caller.
export function enrichmentChecklist(body) {
  const items = [];
  const seen = new Set();
  let currentSection = "(intro)";
  for (const line of String(body).split(/\r?\n/)) {
    const heading = /^##\s+(.+?)\s*$/.exec(line);
    if (heading) {
      currentSection = heading[1].trim();
      continue;
    }
    if (seen.has(currentSection)) continue;
    if (!ENRICHMENT_PLACEHOLDER_SENTINELS.some((sentinel) => line.includes(sentinel))) continue;
    seen.add(currentSection);
    const hint = line.trim().replace(/^[-*]\s+/, "").slice(0, 100);
    items.push({ section: currentSection, hint });
  }
  return items;
}

export const THIN_BODY_MIN_WORDS = 25;

// Opt-in enrichment lint (content.thin_body): flags wiki content documents whose
// body has very little prose — stubs that were started but never developed. It is
// registered in FINDING_EXPLANATIONS but INERT by default; it only produces
// findings when a project enables it via config `rules` (e.g.
// "content.thin_body": "warning"). This is the canonical rule that dogfoods the
// rule-toggle machinery. Placeholder docs are left to content.not_enriched.
export async function scanThinBody(cwd, options) {
  const setting = options && options.rules && options.rules["content.thin_body"];
  if (!setting || setting === "off") return [];
  const findings = [];
  for (const file of await listWikiContentDocs(cwd)) {
    const rel = toPosix(path.relative(cwd, file));
    if (isAppendOnlyLog(rel)) continue;
    const content = await readUtf8(file);
    const parsed = parseFrontmatter(content);
    const body = parsed.frontmatter ? parsed.body : content;
    if (ENRICHMENT_PLACEHOLDER_SENTINELS.some((sentinel) => body.includes(sentinel))) continue;
    const words = bodyProseWordCount(body);
    if (words < THIN_BODY_MIN_WORDS) {
      findings.push({
        severity: "warning",
        rule: "content.thin_body",
        path: rel,
        message: `Document body has only ${words} word${words === 1 ? "" : "s"} of prose (min ${THIN_BODY_MIN_WORDS}); enrich it with source-backed content.`,
        params: { words, min: THIN_BODY_MIN_WORDS }
      });
    }
  }
  return findings;
}

// Rough "is this a real document yet" word count: body prose only, ignoring
// markdown headings, blank lines, and horizontal rules (frontmatter is already
// stripped by the caller).
export function bodyProseWordCount(body) {
  return String(body)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line !== "---")
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
}

// Opt-in visibility-consistency lints (1.9, GATE_REVIEW Gate 14) that reuse the
// sensitive-info scan. Both are registered in FINDING_EXPLANATIONS but INERT by
// default; each runs only when enabled via config `rules`:
//   visibility.public_sensitive  — a `visibility: public` doc with sensitive content.
//   visibility.declared_mismatch — a `contains_sensitive_info: false` doc with it.
// Read-only and warning-level; the sensitive value is NEVER included in the finding
// (only a redacted count). Access control is out of scope — value-vs-content only.
export async function scanVisibilityConsistency(cwd, options) {
  const rules = (options && options.rules) || {};
  const wantPublic = Boolean(rules["visibility.public_sensitive"]) && rules["visibility.public_sensitive"] !== "off";
  const wantDeclared = Boolean(rules["visibility.declared_mismatch"]) && rules["visibility.declared_mismatch"] !== "off";
  if (!wantPublic && !wantDeclared) return [];
  const findings = [];
  for (const file of await listWikiContentDocs(cwd)) {
    const rel = toPosix(path.relative(cwd, file));
    if (isAppendOnlyLog(rel)) continue;
    const content = await readUtf8(file);
    const sensitive = scanSensitiveInfo(content);
    if (sensitive.length === 0) continue;
    const frontmatter = parseFrontmatter(content).frontmatter || {};
    const at = `${rel}:${sensitive[0].line}`;
    if (wantPublic && frontmatter.visibility === "public") {
      findings.push({
        severity: "warning",
        rule: "visibility.public_sensitive",
        path: at,
        message: `Public document has ${sensitive.length} sensitive-looking value(s); values omitted. Redact them or lower visibility.`,
        params: { count: sensitive.length }
      });
    }
    if (wantDeclared && frontmatter.contains_sensitive_info === false) {
      findings.push({
        severity: "warning",
        rule: "visibility.declared_mismatch",
        path: at,
        message: `Document declares contains_sensitive_info: false but ${sensitive.length} sensitive-looking value(s) were found; values omitted.`,
        params: { count: sensitive.length }
      });
    }
  }
  return findings;
}

export async function scanEvidenceReferences(cwd, options = {}) {
  const findings = [];
  const lineCountByPath = new Map();
  const contentByPath = new Map();
  const strictSeverity = evidenceStrictSeverity(options);

  for (const file of await listTargetMarkdown(cwd)) {
    const rel = toPosix(path.relative(cwd, file));
    const content = await readUtf8(file);
    const parsed = parseFrontmatter(content);
    const evidence = parsed.frontmatter?.evidence;

    if (!Array.isArray(evidence)) continue;

    for (const item of evidence) {
      if (typeof item !== "string") continue;

      const reference = item.trim();
      const evidenceReference = parseEvidenceReference(reference);
      if (!evidenceReference) {
        findings.push({
          severity: "error",
          rule: "evidence.shape",
          path: rel,
          message: `Invalid evidence reference: ${reference || "(empty)"}.`,
          params: { reference: reference || "(empty)" }
        });
        continue;
      }

      if (evidenceReference.external) continue;

      const absoluteSourcePath = path.join(cwd, evidenceReference.source);
      if (!(await pathExists(absoluteSourcePath))) {
        findings.push({
          severity: strictSeverity,
          rule: "evidence.missing",
          path: rel,
          message: `Evidence source does not exist: ${evidenceReference.source}.`,
          params: { source: evidenceReference.source }
        });
        continue;
      }

      if (evidenceReference.locator?.kind === "line") {
        const lineCount = await getLineCount(absoluteSourcePath, lineCountByPath);
        if (evidenceReference.locator.end > lineCount) {
          findings.push({
            severity: strictSeverity,
            rule: "evidence.line_range",
            path: rel,
            message: `Evidence line range is outside ${evidenceReference.source}: ${evidenceReference.locator.start}-${evidenceReference.locator.end} (file has ${lineCount} line${lineCount === 1 ? "" : "s"}).`,
            params: { source: evidenceReference.source, start: evidenceReference.locator.start, end: evidenceReference.locator.end, lineCount }
          });
        }
      } else if (evidenceReference.locator?.kind === "symbol") {
        // Gate 25: conservative target-existence check. Flag ONLY when the file
        // mentions NONE of the referenced symbol name(s) (a `·`/`,`/`/`-joined
        // value is a list) as a word-boundary token. If the file mentions any of
        // them we do not flag — a floor ("the file does not even mention this
        // symbol"), not an AST resolver, chosen to avoid false positives.
        const content = await readSourceCached(absoluteSourcePath, contentByPath);
        if (content !== null && !symbolPresent(content, evidenceReference.locator.value)) {
          findings.push({
            severity: strictSeverity,
            rule: "evidence.symbol_unverified",
            path: rel,
            message: `Evidence symbol is not mentioned in ${evidenceReference.source}: ${evidenceReference.locator.value}.`,
            params: { source: evidenceReference.source, value: evidenceReference.locator.value }
          });
        }
      } else if (evidenceReference.locator?.kind === "section" && evidenceReference.source.toLowerCase().endsWith(".md")) {
        // Gate 25: section existence for Markdown sources only (v1). Flag when no
        // heading contains the section name (headings may carry extra suffixes).
        const content = await readSourceCached(absoluteSourcePath, contentByPath);
        if (content !== null && !sectionPresent(content, evidenceReference.locator.value)) {
          findings.push({
            severity: strictSeverity,
            rule: "evidence.section_unverified",
            path: rel,
            message: `Evidence section heading is not found in ${evidenceReference.source}: ${evidenceReference.locator.value}.`,
            params: { source: evidenceReference.source, value: evidenceReference.locator.value }
          });
        }
      }
    }
  }

  return findings;
}

// Read a source file once (BOM-aware), caching by path; null on any read error
// so the evidence existence checks stay best-effort (never throw on a bad file).
async function readSourceCached(absolutePath, cache) {
  if (cache.has(absolutePath)) return cache.get(absolutePath);
  let content = null;
  try {
    content = await readTextAuto(absolutePath);
  } catch {
    content = null;
  }
  cache.set(absolutePath, content);
  return content;
}

// Split a `#symbol:` value into candidate names. Evidence commonly joins related
// symbols with a middle dot (`A·B`) or comma/slash/plus; each part is a name.
function splitSymbolNames(value) {
  return value
    .split(/[·,/+&()\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

// True if the file mentions ANY of the referenced symbol names as a word-boundary
// token (conservative: presence, not definition). Empty name list → true (nothing
// to check, so never flagged).
function symbolPresent(content, value) {
  const names = splitSymbolNames(value);
  if (names.length === 0) return true;
  return names.some((name) => {
    try {
      return new RegExp(`\\b${escapeRegex(name)}\\b`).test(content);
    } catch {
      return content.includes(name);
    }
  });
}

// True if any Markdown heading's text contains the section name (case-insensitive),
// so a heading with a trailing suffix like "(accepted 2026-07-21)" still matches.
function sectionPresent(content, value) {
  const target = value.toLowerCase().trim();
  if (!target) return true;
  for (const line of content.split(/\r?\n/)) {
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading && heading[1].toLowerCase().includes(target)) return true;
  }
  return false;
}

// A frontmatter evidence entry counts as "mentioned" in the body ## Evidence
// section if the section contains it verbatim OR — for a local reference — names
// the same source PATH. This makes locator format irrelevant: an editor/grep
// style `path:60-70` in the body satisfies a `path#L60-L70` frontmatter entry
// (and vice versa), and a `#symbol:`/`#section:` locator matches a plain path
// mention. External refs (http/repo:) still require a verbatim mention.
function evidenceMentionedInSection(sectionText, reference) {
  if (sectionText.includes(reference)) return true;
  const parsed = parseEvidenceReference(reference);
  if (!parsed || parsed.external || !parsed.source) return false;
  return sectionMentionsPath(sectionText, parsed.source);
}

function sectionMentionsPath(sectionText, sourcePath) {
  for (let idx = sectionText.indexOf(sourcePath); idx !== -1; idx = sectionText.indexOf(sourcePath, idx + 1)) {
    const after = sectionText[idx + sourcePath.length] ?? "";
    // Require a boundary after the path so `src/cli.js` doesn't match `src/cli.js.map`
    // (an extension char like `.` is intentionally NOT a boundary).
    if (after === "" || "#: \t\r\n,)]`'\"".includes(after)) return true;
  }
  return false;
}

export async function scanEvidenceSections(cwd, options = {}) {
  const findings = [];
  const strictSeverity = evidenceStrictSeverity(options);

  for (const file of await listTargetMarkdown(cwd)) {
    const rel = toPosix(path.relative(cwd, file));
    const content = await readUtf8(file);
    const parsed = parseFrontmatter(content);
    const section = extractMarkdownSection(parsed.body, "Evidence");
    const frontmatterEvidence = Array.isArray(parsed.frontmatter?.evidence)
      ? parsed.frontmatter.evidence.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
      : [];

    if (!section && frontmatterEvidence.length === 0) continue;

    if (!section) {
      findings.push({
        severity: strictSeverity,
        rule: "evidence.section_missing",
        path: rel,
        message: "Document has frontmatter evidence entries but no body ## Evidence section."
      });
      continue;
    }

    if (section.bullets.length === 0) {
      findings.push({
        severity: strictSeverity,
        rule: "evidence.section_empty",
        path: rel,
        message: "Body ## Evidence section should contain at least one bullet entry."
      });
    }

    for (const reference of frontmatterEvidence) {
      if (!evidenceMentionedInSection(section.text, reference)) {
        findings.push({
          severity: strictSeverity,
          rule: "evidence.section_unlisted",
          path: rel,
          message: `Frontmatter evidence entry is not mentioned in body ## Evidence: ${reference}.`,
          params: { reference }
        });
      }
    }
  }

  return findings;
}

export function evidenceStrictSeverity(options) {
  return options.strict ? "error" : "warning";
}

// Gate 25: a `verified` document that carries neither source_files nor evidence
// is "verified" with no code grounding — the hole where the schema requires the
// source_files KEY but allows an empty list and evidence is optional. Default
// warning and NOT escalated by --strict (config `rules` can escalate); it must
// never break existing validate on intentionally-ungrounded verified docs.
export async function scanUngroundedVerified(cwd) {
  const findings = [];
  for (const file of await listTargetMarkdown(cwd)) {
    const rel = toPosix(path.relative(cwd, file));
    const parsed = parseFrontmatter(await readUtf8(file));
    const frontmatter = parsed.frontmatter ?? {};
    if (frontmatter.status !== "verified") continue;
    const sourceFiles = Array.isArray(frontmatter.source_files)
      ? frontmatter.source_files.filter((item) => typeof item === "string" && item.trim())
      : [];
    const evidence = Array.isArray(frontmatter.evidence)
      ? frontmatter.evidence.filter((item) => typeof item === "string" && item.trim())
      : [];
    if (sourceFiles.length === 0 && evidence.length === 0) {
      findings.push({
        severity: "warning",
        rule: "evidence.ungrounded",
        path: rel,
        message: "Verified document has no source_files and no evidence (grounding-free verified)."
      });
    }
  }
  return findings;
}

// Gate 25: finding rules that mean an evidence/source reference did NOT resolve.
// Used to compute the reference_checked tier.
export const EVIDENCE_REFERENCE_RULES = new Set([
  "evidence.shape",
  "evidence.missing",
  "evidence.line_range",
  "evidence.symbol_unverified",
  "evidence.section_unverified",
  "source_files.missing"
]);

// Gate 25: the computed evidence tier of a document (additive, report-only — NOT
// a stored frontmatter field or status value). The two axes are orthogonal:
// - referenceChecked: the doc has grounding refs AND all of them resolve
//   (no EVIDENCE_REFERENCE_RULES finding on its path).
// - humanVerified: status verified with reviewer metadata present.
export function evidenceTier({ status, reviewedBy, reviewedAt, hasGrounding, hasUnresolvedRefs }) {
  return {
    referenceChecked: Boolean(hasGrounding) && !hasUnresolvedRefs,
    humanVerified: status === "verified" && Boolean(reviewedBy) && Boolean(reviewedAt)
  };
}

// Which local files a verified document's freshness depends on, and the
// review baseline to compare against. Pure so it can be tested without git.
// Pure: the local source-file anchors a verified document depends on, or null
// when the document is not verified. Shared by date-anchored drift
// (driftTargets, which adds a review-date baseline) and diff-anchored
// reverse-impact (scanReverseImpact, Gate 23), so both consume ONE anchor
// extractor. External (http(s)/repo:) references are excluded.
export function verifiedSourceAnchors(frontmatter) {
  if (frontmatter?.status !== "verified") return null;

  // source_files are broad anchors (the whole file backs the document).
  const sources = [];
  for (const entry of Array.isArray(frontmatter.source_files) ? frontmatter.source_files : []) {
    if (typeof entry !== "string") continue;
    const base = entry.split("#")[0].trim();
    if (!base || isExternalSourceReference(base)) continue;
    if (!sources.includes(base)) sources.push(base);
  }

  // evidence entries carry a locator (line/symbol/section/route) that can refine
  // the drift check to a specific line range when it is a line locator.
  const evidenceRefs = [];
  for (const entry of Array.isArray(frontmatter.evidence) ? frontmatter.evidence : []) {
    if (typeof entry !== "string") continue;
    const parsedRef = parseEvidenceReference(entry.trim());
    if (!parsedRef || parsedRef.external) continue;
    const base = parsedRef.source;
    if (!base || isExternalSourceReference(base)) continue;
    evidenceRefs.push({ base, locator: parsedRef.locator });
  }

  const files = [];
  for (const base of [...sources, ...evidenceRefs.map((ref) => ref.base)]) {
    if (!files.includes(base)) files.push(base);
  }

  return { files, sources, evidenceRefs };
}

export function driftTargets(frontmatter) {
  const anchors = verifiedSourceAnchors(frontmatter);
  if (!anchors) return null;

  const reviewedAt = typeof frontmatter.reviewed_at === "string" && /^\d{4}-\d{2}-\d{2}$/.test(frontmatter.reviewed_at)
    ? frontmatter.reviewed_at
    : null;
  const lastUpdated = typeof frontmatter.last_updated === "string" && /^\d{4}-\d{2}-\d{2}$/.test(frontmatter.last_updated)
    ? frontmatter.last_updated
    : null;
  const baseline = reviewedAt ?? lastUpdated;
  if (!baseline) return null;

  return { baseline, ...anchors };
}

// Flags verified documents whose referenced files changed in git after the
// review baseline. When a file is cited ONLY by exact line ranges in evidence
// (no broad source_files/symbol/section/route anchor), the check narrows to
// those line ranges so unrelated edits elsewhere in the file are not drift.
// Best-effort: silently skips when git is unavailable, and falls back to the
// file-level check if a line-range query fails (e.g. an out-of-range line).
export async function scanEvidenceDrift(cwd) {
  const findings = [];
  for (const file of await listTargetMarkdown(cwd)) {
    const rel = toPosix(path.relative(cwd, file));
    const parsed = parseFrontmatter(await readUtf8(file));
    const targets = driftTargets(parsed.frontmatter);
    if (!targets) continue;

    // Split references into broad (whole-file) and line-range-only per file.
    const broadFiles = new Set(targets.sources);
    const lineRangesByFile = new Map();
    for (const ref of targets.evidenceRefs) {
      if (ref.locator && ref.locator.kind === "line") {
        if (!lineRangesByFile.has(ref.base)) lineRangesByFile.set(ref.base, []);
        lineRangesByFile.get(ref.base).push({ start: ref.locator.start, end: ref.locator.end });
      } else {
        broadFiles.add(ref.base); // bare file, symbol, section, or route → whole-file
      }
    }

    for (const base of targets.files) {
      if (!(await pathExists(path.join(cwd, base)))) continue;
      const ranges = lineRangesByFile.get(base);
      const lineOnly = !broadFiles.has(base) && Array.isArray(ranges) && ranges.length > 0;

      if (lineOnly) {
        let staleRange = null;
        let fallbackFileLevel = false;
        for (const range of ranges) {
          try {
            if (lineRangeChangedSince(cwd, base, range.start, range.end, targets.baseline)) {
              staleRange = range;
              break;
            }
          } catch {
            fallbackFileLevel = true;
            break;
          }
        }
        if (fallbackFileLevel) {
          if (fileChangedSinceSafe(cwd, base, targets.baseline)) {
            findings.push(driftFinding(rel, `${base}`, targets.baseline));
          }
        } else if (staleRange) {
          findings.push(driftFinding(rel, `${base}#L${staleRange.start}-L${staleRange.end}`, targets.baseline));
        }
      } else if (fileChangedSinceSafe(cwd, base, targets.baseline)) {
        findings.push(driftFinding(rel, `${base}`, targets.baseline));
      }
    }
  }
  return findings;
}

export function fileChangedSinceSafe(cwd, base, baseline) {
  try {
    return fileChangedSince(cwd, base, baseline);
  } catch {
    return false;
  }
}

export function driftFinding(rel, reference, baseline) {
  return {
    severity: "warning",
    rule: "evidence.stale",
    path: rel,
    message: `Verified document references ${reference}, which changed after ${baseline}; re-review and update it or downgrade to needs_review.`,
    params: { reference, baseline }
  };
}

// Gate 23 reverse-impact (diff-anchored). Given a set of repo-relative changed
// paths (from git.js#changedFiles: the working tree, or a `--since <ref>` PR/CI
// diff), flag each verified document whose referenced source files are IN the
// change set while the document itself is NOT — the pre-merge complement to the
// date-anchored scanEvidenceDrift. Paths align when the CLI runs from the repo
// root (same assumption as validate --changed). File-level in v1 (a changed
// referenced file counts; line-range narrowing is out of scope). A document
// edited in the same change set is intentionally not flagged. Read-only.
export async function scanReverseImpact(cwd, changedSet) {
  const findings = [];
  if (!changedSet || changedSet.size === 0) return findings;
  for (const file of await listTargetMarkdown(cwd)) {
    const rel = toPosix(path.relative(cwd, file));
    if (changedSet.has(rel)) continue; // doc changed in the same diff → not drift
    const anchors = verifiedSourceAnchors(parseFrontmatter(await readUtf8(file)).frontmatter);
    if (!anchors) continue;
    const changedSources = anchors.files.filter((base) => changedSet.has(base));
    if (changedSources.length === 0) continue;
    findings.push({
      severity: "warning",
      rule: "impact.source_changed",
      path: rel,
      message: `Verified document depends on ${changedSources.join(", ")}, which changed in this diff, but the document is unchanged; re-review and update it or downgrade to needs_review.`,
      params: { sources: changedSources.join(", ") }
    });
  }
  return findings;
}

export async function scanOkfProfile(cwd, activeProfiles = []) {
  if (!activeProfiles.includes("okf-v0.1")) return [];

  const wikiRoot = path.join(cwd, "docs", "llm-wiki");
  const markdownFiles = await listTargetMarkdown(cwd);
  const targetFiles = (await pathExists(wikiRoot))
    ? markdownFiles.filter((file) => toPosix(path.relative(cwd, file)).startsWith("docs/llm-wiki/"))
    : markdownFiles;
  const findings = [];

  for (const file of targetFiles) {
    const rel = toPosix(path.relative(cwd, file));
    const content = await readUtf8(file);
    const parsed = parseFrontmatter(content);
    if (!parsed.frontmatter) continue;

    if (!parsed.frontmatter.type) {
      findings.push({
        severity: "error",
        rule: "okf.type_required",
        path: rel,
        message: "OKF v0.1 profile requires frontmatter field: type."
      });
    } else if (typeof parsed.frontmatter.type !== "string") {
      findings.push({
        severity: "error",
        rule: "okf.type_shape",
        path: rel,
        message: "OKF v0.1 frontmatter field type must be a string."
      });
    }

    for (const arrayField of ["aliases", "tags"]) {
      if (arrayField in parsed.frontmatter && !Array.isArray(parsed.frontmatter[arrayField])) {
        findings.push({
          severity: "error",
          rule: "okf.array_shape",
          path: rel,
          message: `OKF v0.1 frontmatter field ${arrayField} must be an array when present.`,
          params: { field: arrayField }
        });
      }
    }
  }

  return findings;
}

export async function scanMarkdownLinks(cwd) {
  const wikiRoot = path.join(cwd, "docs", "llm-wiki");
  if (!(await pathExists(wikiRoot))) return [];

  const findings = [];
  for (const file of await listMarkdownFiles(wikiRoot)) {
    const rel = toPosix(path.relative(cwd, file));
    const content = await readUtf8(file);

    for (const target of extractMarkdownLinkTargets(content)) {
      const link = normalizeMarkdownLinkTarget(target);
      if (!link || isSkippedMarkdownLink(link)) continue;

      const absoluteTarget = resolveMarkdownLinkTarget(cwd, file, link);
      if (!(await pathExists(absoluteTarget))) {
        findings.push({
          severity: "warning",
          rule: "markdown_link.missing",
          path: rel,
          message: `Markdown link target does not exist: ${link}.`,
          params: { link }
        });
      }
    }
  }
  return findings;
}

export async function scanWikiLinks(cwd) {
  return (await collectWikiGraph(cwd)).findings;
}
