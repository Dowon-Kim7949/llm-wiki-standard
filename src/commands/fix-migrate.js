// The fix/drift commands plus the shared fix/migrate helpers, extracted from
// commands.js on 2026-07-16 (behavior-preserving refactor, GATE_REVIEW
// stabilization). fixCommand applies the scoped safe auto-fixes (Tier-A
// frontmatter, ## Evidence reconciliation, broken-link stubs) and driftCommand
// reports evidence drift; the helpers (block-version analysis/report,
// runMechanicalRemediation, frontmatter/evidence editing, stub rendering,
// blockedApply) back both these commands and migrateCommand. migrateCommand
// itself stays in commands.js because it calls the audit() pipeline (keeping it
// here would create a commands.js<->fix-migrate.js cycle); it imports these
// helpers. Depends only on the Node stdlib, config.js, encoding.js, files.js,
// frontmatter.js, frontmatter-schema.js, sensitive-info.js, template-renderer.js,
// and the sibling command modules (findings, scans, wiki-files, references); no
// back-dependency on commands.js.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { CURRENT_WIKI_BLOCK_VERSION } from "../config.js";
import { findMojibakeIndicators, readUtf8, writeUtf8 } from "../encoding.js";
import { pathExists, toPosix } from "../files.js";
import { scanSensitiveInfo } from "../sensitive-info.js";
import { hasRequiredField, parseFrontmatter } from "../frontmatter.js";
import { schemaRequiredFields } from "../frontmatter-schema.js";
import { renderWikiDocumentTemplate, todayIsoDate } from "../template-renderer.js";
import { formatFinding, withText } from "./findings.js";
import { scanEvidenceDrift } from "./scans.js";
import { isAppendOnlyLog, listWikiContentDocs } from "./wiki-files.js";
import {
  escapeRegex,
  extractMarkdownLinkTargets,
  extractMarkdownSection,
  isExternalSourceReference,
  isSkippedMarkdownLink,
  normalizeMarkdownLinkTarget,
  resolveMarkdownLinkTarget
} from "./references.js";

export function blockedApply(command, message) {
  return withText({
    command,
    result: "blocked",
    findings: [{ severity: "blocked", rule: `${command}.apply_blocked`, path: ".", message }]
  }, `LLM-WIKI ${command} Blocked`, [{ title: "Blocked", body: [message] }]);
}

// Presented when init/quickstart runs with neither --dry-run nor --write. This is
// not a failure — the tool is simply waiting for a mode — so it reads as guidance
// ("Ready (needs --write)") with no blocked finding, rather than a "Blocked"
// banner that first-time users mistake for an error. result:"ready" → exit 0
// (see cli.js exitCodeFor), matching the established `next` command convention.
export function needsWriteFlag(command, message) {
  return withText({
    command,
    result: "ready",
    findings: []
  }, `LLM-WIKI ${command} — Ready (needs --write)`, [{ title: "Next Step", body: [message] }]);
}

// ---- wiki_block_version upgrade analysis --------------------------------
// The migration engine compares each document's recorded wiki_block_version
// against CURRENT_WIKI_BLOCK_VERSION to report the contract gap (read-only) and,
// under migrate --apply (GATE_REVIEW Gate 8), to stamp conforming documents.

export function parseBlockVersion(value) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^v(\d+)$/i);
  return match ? Number(match[1]) : null;
}

// Documents the migration / fix engines operate on: wiki markdown excluding the
// intentional templates/ scaffolds.
// Classify every wiki content document by its recorded block version relative
// to the current CLI contract. Read-only.
export async function analyzeBlockVersions(cwd) {
  const currentNumber = parseBlockVersion(CURRENT_WIKI_BLOCK_VERSION);
  const docs = [];
  for (const file of await listWikiContentDocs(cwd)) {
    const rel = toPosix(path.relative(cwd, file));
    const parsed = parseFrontmatter(await readUtf8(file));
    const hasField = Boolean(parsed.frontmatter) && "wiki_block_version" in parsed.frontmatter;
    const raw = hasField ? parsed.frontmatter.wiki_block_version : undefined;
    const version = parseBlockVersion(raw);
    let state;
    if (!hasField || raw === null || String(raw).trim() === "") state = "unrecorded";
    else if (version === null) state = "unknown";
    else if (version < currentNumber) state = "behind";
    else if (version > currentNumber) state = "ahead";
    else state = "current";
    docs.push({
      rel,
      recorded: hasField ? raw : null,
      version,
      state,
      status: parsed.frontmatter?.status ?? null
    });
  }
  return { current: CURRENT_WIKI_BLOCK_VERSION, currentNumber, docs };
}

export function summarizeBlockVersions(analysis) {
  const counts = { current: 0, behind: 0, ahead: 0, unrecorded: 0, unknown: 0 };
  for (const doc of analysis.docs) counts[doc.state] += 1;
  return counts;
}

// Documents whose recorded block version trails or is missing relative to the
// current contract — the upgrade candidates migrate would bring forward.
export function blockVersionGapDocs(analysis) {
  return analysis.docs.filter(
    (doc) => doc.state === "behind" || doc.state === "unrecorded" || doc.state === "unknown"
  );
}

// Human-readable upgrade report for the migrate dry run.
export function buildUpgradeReport(analysis) {
  const counts = summarizeBlockVersions(analysis);
  const gapDocs = blockVersionGapDocs(analysis);
  const lines = [
    `cli_block_version: ${analysis.current}`,
    `documents: ${analysis.docs.length}`,
    `at_current: ${counts.current}`,
    `behind: ${counts.behind}`,
    `unrecorded: ${counts.unrecorded}`,
    `unknown: ${counts.unknown}`,
    `ahead: ${counts.ahead}`
  ];
  const detail = gapDocs.length
    ? gapDocs.map((doc) => `${doc.rel}: ${doc.state}${doc.recorded ? ` (${doc.recorded})` : ""} → ${analysis.current}`)
    : ["All documents are at the current block version."];
  const aheadDocs = analysis.docs.filter((doc) => doc.state === "ahead");
  return { counts, gapDocs, aheadDocs, lines, detail };
}

// ---- fix command (scoped autofix) --------------------------------------
// The accepted scope is recorded in GATE_REVIEW.md ("Autofix (--fix) Scope
// Decision"). fix applies only safe, mechanically decidable remediations under
// docs/llm-wiki/, never edits verified documents' content, never writes outside
// docs/llm-wiki/, and never invents meaning-bearing values.

// Tier A required fields: safe to auto-insert with a mechanical default.
export const FIX_TIER_A_SCALAR_DEFAULTS = {
  status: "needs_review",
  visibility: "internal",
  contains_sensitive_info: "false",
  wiki_block_version: CURRENT_WIKI_BLOCK_VERSION,
  last_edited_by: "llm-wiki-cli"
};
export const FIX_TIER_A_ARRAY_FIELDS = ["tags", "source_files", "related"];
// Tier B required fields carry meaning a tool cannot honestly invent.
export const FIX_TIER_B_FIELDS = new Set(["title", "doc_type", "project", "author"]);
export const EVIDENCE_PLACEHOLDER_BULLET =
  "- _No evidence recorded yet; add source references such as file, file#L10, or file#symbol:Name._";

// Shared mechanical remediation engine used by `fix` (GATE_REVIEW Gate 6) and
// `migrate --apply` (GATE_REVIEW Gate 8). It applies only the accepted safe
// remediations under docs/llm-wiki/, never edits verified documents' content,
// never writes outside docs/llm-wiki/, and never invents meaning-bearing values.
// With upgradeBlockVersion, it additionally upgrades an existing behind
// wiki_block_version to current — but only once the document otherwise conforms
// (no Tier B required field left for a human). A missing wiki_block_version is
// backfilled to current by the Tier A insertion, matching fix.
export async function runMechanicalRemediation(cwd, { write, upgradeBlockVersion = false }) {
  const applied = [];
  const planned = [];
  const skipped = [];
  const blockedFindings = [];
  const changeList = write ? applied : planned;
  const stubTargets = new Map(); // relPosix target -> Set of referencing docs
  const label = upgradeBlockVersion ? "migrate" : "fix";
  const currentNumber = parseBlockVersion(CURRENT_WIKI_BLOCK_VERSION);

  const files = await listWikiContentDocs(cwd);

  for (const file of files) {
    const rel = toPosix(path.relative(cwd, file));
    const original = await readUtf8(file);

    if (findMojibakeIndicators(original).length > 0) {
      skipped.push(`${rel}: possible mojibake; automatic rewrite skipped.`);
      continue;
    }

    const parsed = parseFrontmatter(original);

    // Broken related / markdown-link targets become needs_review stubs. Creating
    // a stub is a new-file write that never edits this document, so it is
    // collected even for verified documents.
    await collectBrokenLinkTargets(cwd, file, rel, parsed, original, stubTargets, skipped);

    if (!parsed.frontmatter) {
      skipped.push(`${rel}: no YAML frontmatter; ${label} does not synthesize a full frontmatter block.`);
      continue;
    }

    if (parsed.frontmatter.status === "verified") {
      const reasons = [];
      const missing = schemaRequiredFields().filter((field) => !hasRequiredField(parsed.frontmatter, field));
      if (missing.length > 0) reasons.push(`missing ${missing.join(", ")}`);
      const verifiedEvidence = Array.isArray(parsed.frontmatter.evidence)
        ? parsed.frontmatter.evidence.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
        : [];
      if (reconcileEvidenceSection(parsed.body, verifiedEvidence, "\n")) reasons.push("## Evidence section could be reconciled");
      if (upgradeBlockVersion) {
        const recorded = parseBlockVersion(parsed.frontmatter.wiki_block_version);
        if (recorded !== null && recorded < currentNumber) {
          reasons.push(`behind wiki_block_version ${parsed.frontmatter.wiki_block_version}`);
        }
      }
      if (reasons.length > 0) {
        skipped.push(`${rel}: verified document (${reasons.join("; ")}); left untouched (review manually).`);
      }
      continue;
    }

    const split = splitFrontmatter(original);
    if (!split) {
      skipped.push(`${rel}: could not locate frontmatter block; skipped.`);
      continue;
    }

    const eol = split.eol;
    const docChanges = [];
    let inner = split.inner;
    let body = split.body;

    // 1) Missing Tier A required frontmatter fields.
    const missingRequired = schemaRequiredFields().filter((field) => !hasRequiredField(parsed.frontmatter, field));
    const tierBMissing = missingRequired.filter((field) => FIX_TIER_B_FIELDS.has(field));
    const tierAMissing = missingRequired.filter((field) => !FIX_TIER_B_FIELDS.has(field));

    for (const field of tierBMissing) {
      skipped.push(`${rel}: required field '${field}' needs a human value (Tier B; not auto-filled).`);
    }

    const insertLines = [];
    for (const field of tierAMissing) {
      if (field === "last_updated") {
        insertLines.push(`last_updated: ${todayIsoDate()}`);
        docChanges.push("insert last_updated");
      } else if (FIX_TIER_A_ARRAY_FIELDS.includes(field)) {
        insertLines.push(`${field}:`);
        docChanges.push(`insert ${field} (empty list)`);
      } else if (field in FIX_TIER_A_SCALAR_DEFAULTS) {
        insertLines.push(`${field}: ${FIX_TIER_A_SCALAR_DEFAULTS[field]}`);
        docChanges.push(`insert ${field}`);
      }
    }
    if (insertLines.length > 0) {
      inner = `${inner}${eol}${insertLines.join(eol)}`;
    }

    // 2) Reconcile the body ## Evidence section with frontmatter evidence.
    const frontmatterEvidence = Array.isArray(parsed.frontmatter.evidence)
      ? parsed.frontmatter.evidence.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
      : [];
    const evidenceResult = reconcileEvidenceSection(body, frontmatterEvidence, eol);
    if (evidenceResult) {
      body = evidenceResult.body;
      docChanges.push(evidenceResult.change);
    }

    // 3) (migrate only) Upgrade an existing behind wiki_block_version to current,
    // only once the document conforms (no Tier B field left for a human).
    if (upgradeBlockVersion && "wiki_block_version" in parsed.frontmatter) {
      const recorded = parseBlockVersion(parsed.frontmatter.wiki_block_version);
      if (recorded !== null && recorded < currentNumber) {
        if (tierBMissing.length === 0) {
          const stamped = replaceFrontmatterScalar(inner, "wiki_block_version", CURRENT_WIKI_BLOCK_VERSION);
          if (stamped && stamped !== inner) {
            inner = stamped;
            docChanges.push(`upgrade wiki_block_version ${parsed.frontmatter.wiki_block_version} → ${CURRENT_WIKI_BLOCK_VERSION}`);
          }
        } else {
          skipped.push(`${rel}: wiki_block_version ${parsed.frontmatter.wiki_block_version} kept behind ${CURRENT_WIKI_BLOCK_VERSION}; resolve Tier B field(s) ${tierBMissing.join(", ")} first.`);
        }
      }
    }

    if (docChanges.length === 0) continue;

    // 4) Refresh last_updated on documents this run actually modifies (unless we
    // just inserted it as today).
    if (!tierAMissing.includes("last_updated") && "last_updated" in parsed.frontmatter) {
      const refreshed = replaceFrontmatterScalar(inner, "last_updated", todayIsoDate());
      if (refreshed && refreshed !== inner) {
        inner = refreshed;
        docChanges.push("refresh last_updated");
      }
    }

    const newContent = `${split.bom}${split.open}${inner}${split.close}${body}`;
    if (newContent === original) continue;

    if (scanSensitiveInfo(newContent).length > 0) {
      blockedFindings.push({
        severity: "blocked",
        rule: "sensitive.redacted",
        path: rel,
        message: `${upgradeBlockVersion ? "Migration" : "Fix"} skipped: resulting content matched sensitive-info rules.`
      });
      continue;
    }

    if (write) {
      await writeUtf8(file, newContent);
    }
    changeList.push(`${rel}: ${docChanges.join("; ")}.`);
  }

  // Create needs_review stubs for eligible broken link/related targets.
  for (const [relTarget, refs] of stubTargets) {
    const abs = path.join(cwd, relTarget);
    if (await pathExists(abs)) continue;
    const content = renderStubDocument(relTarget, cwd);
    if (scanSensitiveInfo(content).length > 0) {
      blockedFindings.push({
        severity: "blocked",
        rule: "sensitive.redacted",
        path: relTarget,
        message: "Stub not created: generated content matched sensitive-info rules."
      });
      continue;
    }
    if (write) {
      await mkdir(path.dirname(abs), { recursive: true });
      await writeUtf8(abs, content);
    }
    changeList.push(`${relTarget}: create needs_review stub (referenced by ${[...refs].join(", ")}).`);
  }

  return { applied, planned, skipped, blockedFindings, changeList };
}

export async function fixCommand(options) {
  const write = options.write === true;
  const cwd = options.cwd;
  const wikiRoot = path.join(cwd, "docs", "llm-wiki");

  if (!(await pathExists(wikiRoot))) {
    return withText({
      command: "fix",
      write,
      dryRun: !write,
      result: "pass",
      applied: [],
      planned: [],
      skipped: [],
      findings: []
    }, "LLM-WIKI Fix", [
      { title: "Summary", body: [`mode: ${write ? "write" : "dry-run"}`, "wiki: not initialized"] },
      { title: "Caveats", body: ["docs/llm-wiki is not initialized; run init --write first. Nothing to fix."] }
    ]);
  }

  const { applied, planned, skipped, blockedFindings, changeList } =
    await runMechanicalRemediation(cwd, { write, upgradeBlockVersion: false });

  const findings = blockedFindings;
  const result = findings.some((finding) => finding.severity === "blocked") ? "blocked" : "pass";
  const summary = [
    `mode: ${write ? "write" : "dry-run"}`,
    `${write ? "applied" : "planned"}: ${changeList.length}`,
    `skipped: ${skipped.length}`,
    `blocked: ${blockedFindings.length}`
  ];

  return withText({
    command: "fix",
    write,
    dryRun: !write,
    result,
    applied,
    planned,
    skipped,
    findings
  }, "LLM-WIKI Fix", [
    { title: "Summary", body: summary },
    { title: write ? "Applied Fixes" : "Planned Fixes", body: changeList },
    { title: "Skipped", body: skipped },
    { title: "Blocked", body: blockedFindings.map(formatFinding) },
    { title: "Caveats", body: [
      write
        ? "Only docs/llm-wiki content was changed. Verified documents, source_files/evidence values, and enrichment were left for human review. All writes stay needs_review."
        : "Preview only; no files were written. Run fix --write to apply."
    ] }
  ]);
}

// ---- drift command (opt-in verified -> needs_review downgrade) ---------
// The accepted scope is recorded in GATE_REVIEW.md ("Drift Downgrade Scope
// Decision", Gate 9). drift reports evidence.stale drift on verified documents
// and, with --downgrade, flips only those documents to needs_review (status +
// last_updated). It never promotes to verified and never edits other content.
export async function driftCommand(options) {
  const downgrade = options.downgrade === true;
  const cwd = options.cwd;
  const wikiRoot = path.join(cwd, "docs", "llm-wiki");

  if (!(await pathExists(wikiRoot))) {
    return withText({
      command: "drift",
      downgrade,
      dryRun: !downgrade,
      result: "pass",
      driftFindings: [],
      applied: [],
      planned: [],
      skipped: [],
      findings: []
    }, "LLM-WIKI Drift", [
      { title: "Summary", body: [`mode: ${downgrade ? "downgrade" : "report"}`, "wiki: not initialized"] },
      { title: "Caveats", body: ["docs/llm-wiki is not initialized; run init --write first. Nothing to check."] }
    ]);
  }

  const driftFindings = await scanEvidenceDrift(cwd);
  const driftedDocs = [];
  const seen = new Set();
  for (const finding of driftFindings) {
    if (finding.rule !== "evidence.stale" || seen.has(finding.path)) continue;
    seen.add(finding.path);
    driftedDocs.push(finding.path);
  }

  const applied = [];
  const planned = [];
  const skipped = [];
  const blockedFindings = [];
  const changeList = downgrade ? applied : planned;

  for (const rel of driftedDocs) {
    const abs = path.join(cwd, rel);
    const original = await readUtf8(abs);

    if (findMojibakeIndicators(original).length > 0) {
      skipped.push(`${rel}: possible mojibake; downgrade skipped.`);
      continue;
    }

    const split = splitFrontmatter(original);
    if (!split) {
      skipped.push(`${rel}: could not locate frontmatter block; skipped.`);
      continue;
    }

    let inner = replaceFrontmatterScalar(split.inner, "status", "needs_review");
    if (!inner || inner === split.inner) {
      skipped.push(`${rel}: could not rewrite status to needs_review; skipped.`);
      continue;
    }
    const refreshed = replaceFrontmatterScalar(inner, "last_updated", todayIsoDate());
    if (refreshed) inner = refreshed;

    const newContent = `${split.bom}${split.open}${inner}${split.close}${split.body}`;
    if (newContent === original) continue;

    if (scanSensitiveInfo(newContent).length > 0) {
      blockedFindings.push({
        severity: "blocked",
        rule: "sensitive.redacted",
        path: rel,
        message: "Downgrade skipped: resulting content matched sensitive-info rules."
      });
      continue;
    }

    if (downgrade) {
      await writeUtf8(abs, newContent);
    }
    changeList.push(`${rel}: downgrade verified → needs_review; refresh last_updated.`);
  }

  const result = blockedFindings.some((finding) => finding.severity === "blocked") ? "blocked" : "pass";
  const summary = [
    `mode: ${downgrade ? "downgrade" : "report"}`,
    `drifted_verified_docs: ${driftedDocs.length}`,
    `${downgrade ? "downgraded" : "would_downgrade"}: ${changeList.length}`,
    `skipped: ${skipped.length}`,
    `blocked: ${blockedFindings.length}`
  ];

  return withText({
    command: "drift",
    downgrade,
    dryRun: !downgrade,
    result,
    driftFindings,
    applied,
    planned,
    skipped,
    findings: blockedFindings
  }, "LLM-WIKI Drift", [
    { title: "Summary", body: summary },
    { title: "Drift (evidence.stale)", body: driftFindings.map(formatFinding) },
    { title: downgrade ? "Downgraded" : "Would Downgrade", body: changeList },
    { title: "Skipped", body: skipped },
    { title: "Blocked", body: blockedFindings.map(formatFinding) },
    { title: "Caveats", body: [
      downgrade
        ? "Downgraded drifted verified documents to needs_review (status + last_updated only). Re-review and re-verify after updating; nothing else was changed."
        : "Report only; no files were written. Run drift --downgrade to flip drifted verified documents to needs_review."
    ] }
  ]);
}

export function splitFrontmatter(content) {
  const bom = content.charCodeAt(0) === 0xfeff ? content[0] : "";
  const rest = content.slice(bom.length);
  const match = rest.match(/^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n?)/);
  if (!match) return null;
  const eol = match[1].endsWith("\r\n") ? "\r\n" : "\n";
  return {
    bom,
    open: match[1],
    inner: match[2],
    close: match[3],
    body: rest.slice(match[0].length),
    eol
  };
}

export function replaceFrontmatterScalar(inner, key, value) {
  const pattern = new RegExp(`^(\\s*${escapeRegex(key)}:)[^\\r\\n]*$`, "m");
  if (!pattern.test(inner)) return null;
  return inner.replace(pattern, `$1 ${value}`);
}

export function reconcileEvidenceSection(body, frontmatterEvidence, eol) {
  const section = extractMarkdownSection(body, "Evidence");

  if (!section) {
    if (frontmatterEvidence.length === 0) return null;
    const bullets = frontmatterEvidence.map((item) => `- ${item}`);
    return {
      body: appendEvidenceSection(body, bullets, eol),
      change: `add ## Evidence section (${bullets.length} bullet${bullets.length === 1 ? "" : "s"})`
    };
  }

  if (section.bullets.length === 0) {
    const bullets = frontmatterEvidence.length ? frontmatterEvidence.map((item) => `- ${item}`) : [EVIDENCE_PLACEHOLDER_BULLET];
    const newBody = addBulletsUnderEvidence(body, bullets, eol);
    if (!newBody) return null;
    return { body: newBody, change: `fill empty ## Evidence section (${bullets.length} bullet${bullets.length === 1 ? "" : "s"})` };
  }

  const missing = frontmatterEvidence.filter((item) => !section.text.includes(item));
  if (missing.length === 0) return null;
  const bullets = missing.map((item) => `- ${item}`);
  const newBody = addBulletsUnderEvidence(body, bullets, eol);
  if (!newBody) return null;
  return { body: newBody, change: `add ${bullets.length} missing ## Evidence bullet${bullets.length === 1 ? "" : "s"}` };
}

export function appendEvidenceSection(body, bullets, eol) {
  const lines = String(body).split(/\r?\n/);
  const tailPattern = /^##\s+(Open Questions|Review Notes)\s*$/i;
  const idx = lines.findIndex((line) => tailPattern.test(line.trim()));
  const sectionBlock = ["## Evidence", "", ...bullets, ""];
  if (idx === -1) {
    const trimmed = [...lines];
    while (trimmed.length > 0 && trimmed[trimmed.length - 1].trim() === "") trimmed.pop();
    return [...trimmed, "", ...sectionBlock].join(eol);
  }
  return [...lines.slice(0, idx), ...sectionBlock, ...lines.slice(idx)].join(eol);
}

export function addBulletsUnderEvidence(body, bullets, eol) {
  const lines = String(body).split(/\r?\n/);
  const headingPattern = /^##\s+Evidence\s*$/i;
  const start = lines.findIndex((line) => headingPattern.test(line.trim()));
  if (start === -1) return null;

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^#{1,2}\s+\S/.test(lines[index].trim())) {
      end = index;
      break;
    }
  }

  let insertAt = start + 1;
  for (let index = start + 1; index < end; index += 1) {
    if (lines[index].trim() !== "") insertAt = index + 1;
  }

  return [...lines.slice(0, insertAt), ...bullets, ...lines.slice(insertAt)].join(eol);
}

export async function collectBrokenLinkTargets(cwd, file, rel, parsed, original, stubTargets, skipped) {
  const seen = new Set();

  const addTarget = (abs) => {
    const relTarget = toPosix(path.relative(cwd, abs));
    if (
      relTarget.startsWith("..") ||
      !relTarget.startsWith("docs/llm-wiki/") ||
      !relTarget.endsWith(".md") ||
      isAppendOnlyLog(relTarget)
    ) {
      skipped.push(`${rel}: broken reference ${relTarget} is outside stub scope (docs/llm-wiki/*.md); left for human review.`);
      return;
    }
    if (!stubTargets.has(relTarget)) stubTargets.set(relTarget, new Set());
    stubTargets.get(relTarget).add(rel);
  };

  const related = parsed.frontmatter?.related;
  if (Array.isArray(related)) {
    for (const entry of related) {
      if (typeof entry !== "string") continue;
      const target = entry.trim();
      if (!target || isExternalSourceReference(target)) continue;
      const abs = path.join(cwd, target);
      const key = `related:${abs}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!(await pathExists(abs))) addTarget(abs);
    }
  }

  for (const target of extractMarkdownLinkTargets(original)) {
    const link = normalizeMarkdownLinkTarget(target);
    if (!link || isSkippedMarkdownLink(link)) continue;
    const abs = resolveMarkdownLinkTarget(cwd, file, link);
    const key = `link:${abs}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!(await pathExists(abs))) addTarget(abs);
  }
}

export function renderStubDocument(relTarget, cwd) {
  const base = relTarget.split("/").pop().replace(/\.md$/i, "");
  const title = base.replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()).trim() || base;
  const project = path.basename(cwd);
  const body = [
    `# ${title}`,
    "",
    "> Auto-created `needs_review` stub to resolve a broken reference. Replace this with source-backed content and keep it `needs_review` until human review.",
    "",
    "## Open Questions",
    "",
    "- What content belongs in this document?",
    "",
    "## Review Notes",
    "",
    "- Human review required before this document is trusted.",
    ""
  ].join("\n");
  return renderWikiDocumentTemplate({ title, docType: "reference", project, body, sourceFiles: [], evidence: [], related: [] });
}
