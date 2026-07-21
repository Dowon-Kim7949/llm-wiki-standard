// Read-only retrieval over the governed wiki (1.18, Gate 24). Four operations
// that return document CONTENT (not governance reports): listDocsCommand
// (enumerate with filters), searchDocsCommand (zero-dep keyword/substring — NOT
// semantic/vector), getDocCommand (frontmatter + body by path), and
// getRelatedCommand (resolved graph neighbors). This is the "the agent queries
// the wiki instead of re-deriving from code" surface (GATE_REVIEW Gate 24).
//
// Invariants: read-only (nothing is written); honors visibility + reuses the
// sensitive-info scan — restricted/sensitive docs are excluded from list/search
// by default (opt-in options.includeSensitive), and every returned body/snippet
// has sensitive-looking lines redacted so a raw secret is never returned;
// zero-dependency (keyword/substring + the existing wiki graph, no embeddings/
// index/network). Depends only on leaf helpers (wiki-files, wiki-graph,
// frontmatter, sensitive-info, encoding, files, findings) — no back-dependency
// on commands.js.
import path from "node:path";
import { readUtf8 } from "../encoding.js";
import { toPosix } from "../files.js";
import { parseFrontmatter } from "../frontmatter.js";
import { scanSensitiveInfo } from "../sensitive-info.js";
import { listWikiContentDocs } from "./wiki-files.js";
import { collectWikiGraph } from "./wiki-graph.js";
import { formatFinding, summarizeFindings, withText } from "./findings.js";

const REDACTION = "[redacted: sensitive-looking value omitted]";
const DEFAULT_SEARCH_LIMIT = 20;

// Load every wiki content doc with parsed frontmatter, body, and a sensitivity
// flag (declared contains_sensitive_info, restricted visibility, or a
// sensitive-info scan hit). Sorted by path for deterministic output.
async function loadContentDocs(cwd) {
  const files = await listWikiContentDocs(cwd);
  const docs = [];
  for (const file of files) {
    const raw = await readUtf8(file);
    const parsed = parseFrontmatter(raw);
    const frontmatter = parsed.frontmatter ?? {};
    docs.push({
      path: toPosix(path.relative(cwd, file)),
      frontmatter,
      body: parsed.body ?? "",
      sensitiveHits: scanSensitiveInfo(raw).length,
      visibility: typeof frontmatter.visibility === "string" ? frontmatter.visibility : null
    });
  }
  return docs.sort((left, right) => left.path.localeCompare(right.path));
}

function isRestrictedOrSensitive(doc) {
  return doc.visibility === "restricted"
    || doc.frontmatter.contains_sensitive_info === true
    || doc.sensitiveHits > 0;
}

// Redact sensitive-looking lines using the same scan the report writer safety-net
// uses, so no returned body/snippet ever carries a raw secret.
function redactSensitive(text) {
  if (!text) return text;
  const hits = scanSensitiveInfo(text);
  if (hits.length === 0) return text;
  const flagged = new Set(hits.map((hit) => hit.line));
  return text.split(/\r?\n/).map((line, index) => (flagged.has(index + 1) ? REDACTION : line)).join("\n");
}

function docType(frontmatter) {
  if (typeof frontmatter.doc_type === "string" && frontmatter.doc_type.trim()) return frontmatter.doc_type;
  if (typeof frontmatter.type === "string" && frontmatter.type.trim()) return frontmatter.type;
  return null;
}

function docSummary(doc) {
  return {
    path: doc.path,
    title: typeof doc.frontmatter.title === "string" ? doc.frontmatter.title : null,
    status: typeof doc.frontmatter.status === "string" ? doc.frontmatter.status : null,
    docType: docType(doc.frontmatter),
    visibility: doc.visibility,
    lastUpdated: typeof doc.frontmatter.last_updated === "string" ? doc.frontmatter.last_updated : null,
    tags: Array.isArray(doc.frontmatter.tags) ? doc.frontmatter.tags.filter((tag) => typeof tag === "string") : []
  };
}

function filterPayload(options) {
  return {
    status: typeof options.status === "string" ? options.status : null,
    visibility: typeof options.visibility === "string" ? options.visibility : null,
    docType: typeof options.docType === "string" ? options.docType : null,
    includeSensitive: Boolean(options.includeSensitive)
  };
}

// Shared status/visibility/docType/sensitivity filter for list and search.
// excludedSensitive counts docs dropped only for the sensitivity gate (0 when
// includeSensitive is set). Returns { kept, excludedSensitive }.
function applyFilters(docs, options) {
  let excludedSensitive = 0;
  const kept = docs.filter((doc) => {
    if (!options.includeSensitive && isRestrictedOrSensitive(doc)) {
      excludedSensitive += 1;
      return false;
    }
    if (typeof options.status === "string" && doc.frontmatter.status !== options.status) return false;
    if (typeof options.visibility === "string" && doc.visibility !== options.visibility) return false;
    if (typeof options.docType === "string" && docType(doc.frontmatter) !== options.docType) return false;
    return true;
  });
  return { kept, excludedSensitive };
}

export async function listDocsCommand(options) {
  const docs = await loadContentDocs(options.cwd);
  const { kept, excludedSensitive } = applyFilters(docs, options);
  const items = kept.map(docSummary);

  const summary = [
    `documents: ${items.length}`,
    `total_scanned: ${docs.length}`,
    `excluded_sensitive: ${excludedSensitive}${options.includeSensitive ? " (included)" : ""}`
  ];
  if (docs.length === 0) summary.push("wiki: not initialized (run init --write first)");

  return withText({
    command: "list-docs",
    result: "pass",
    filters: filterPayload(options),
    excludedSensitive,
    documents: items,
    findings: []
  }, "LLM-WIKI Documents", [
    { title: "Summary", body: summary },
    { title: "Documents", body: items.map((item) => `${item.path} — ${item.title ?? "(no title)"} [${item.status ?? "?"}/${item.visibility ?? "?"}]`) },
    { title: "Caveats", body: ["Read-only; metadata only (no bodies — use get-doc <path>). Restricted/sensitive docs are excluded unless --include-sensitive."] }
  ]);
}

export async function searchDocsCommand(options) {
  const query = typeof options.query === "string" ? options.query.trim() : "";
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : DEFAULT_SEARCH_LIMIT;
  const docs = await loadContentDocs(options.cwd);
  const { kept, excludedSensitive } = applyFilters(docs, options);
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

  const matches = [];
  for (const doc of kept) {
    const title = typeof doc.frontmatter.title === "string" ? doc.frontmatter.title : "";
    const metaText = [title]
      .concat(Array.isArray(doc.frontmatter.tags) ? doc.frontmatter.tags : [])
      .concat(Array.isArray(doc.frontmatter.aliases) ? doc.frontmatter.aliases : [])
      .filter((value) => typeof value === "string")
      .join(" ");
    const bodyRedacted = redactSensitive(doc.body);
    const titleHay = title.toLowerCase();
    const metaHay = metaText.toLowerCase();
    const bodyHay = bodyRedacted.toLowerCase();

    // AND semantics: every query term must appear somewhere in the doc.
    const allPresent = terms.length > 0
      && terms.every((term) => titleHay.includes(term) || metaHay.includes(term) || bodyHay.includes(term));
    if (!allPresent) continue;

    let score = 0;
    for (const term of terms) {
      if (titleHay.includes(term)) score += 10;
      if (metaHay.includes(term)) score += 3;
      score += occurrences(bodyHay, term);
    }
    matches.push({
      path: doc.path,
      title: title || null,
      status: typeof doc.frontmatter.status === "string" ? doc.frontmatter.status : null,
      score,
      snippet: buildSnippet(bodyRedacted, terms)
    });
  }
  matches.sort((left, right) => right.score - left.score || left.path.localeCompare(right.path));
  const limited = matches.slice(0, limit);

  const summary = [
    `query: ${query || "(empty)"}`,
    `matches: ${matches.length}${matches.length > limited.length ? ` (showing ${limited.length})` : ""}`,
    `searched: ${kept.length} docs`,
    `excluded_sensitive: ${excludedSensitive}${options.includeSensitive ? " (included)" : ""}`
  ];

  return withText({
    command: "search-docs",
    result: "pass",
    query,
    limit,
    filters: filterPayload(options),
    excludedSensitive,
    matchCount: matches.length,
    matches: limited,
    findings: []
  }, "LLM-WIKI Search", [
    { title: "Summary", body: summary },
    { title: "Matches", body: limited.map((match) => `${match.path} (score ${match.score}) — ${match.snippet}`) },
    { title: "Caveats", body: ["Keyword/substring search only (deterministic, NOT semantic). Read-only; returns snippets — use get-doc <path> for full content. Restricted/sensitive docs excluded unless --include-sensitive; snippets are redacted."] }
  ]);
}

export async function getDocCommand(options) {
  const docs = await loadContentDocs(options.cwd);
  const doc = resolveDoc(docs, options.docPath);
  if (!doc) return notFound("get-doc", "LLM-WIKI Document", options.docPath);

  const bodyRedacted = redactSensitive(doc.body);
  const redacted = bodyRedacted !== doc.body;
  const meta = docSummary(doc);
  return withText({
    command: "get-doc",
    result: "pass",
    document: { ...meta, frontmatter: doc.frontmatter, body: bodyRedacted, redacted },
    findings: []
  }, "LLM-WIKI Document", [
    { title: "Summary", body: [
      `path: ${doc.path}`,
      `title: ${meta.title ?? "(no title)"}`,
      `status: ${meta.status ?? "?"}`,
      `visibility: ${meta.visibility ?? "?"}`,
      `redacted: ${redacted ? "yes (sensitive-looking lines omitted)" : "no"}`
    ] },
    { title: "Body", body: bodyRedacted || "(empty)" },
    { title: "Caveats", body: ["Read-only. Sensitive-looking lines are redacted; frontmatter visibility/contains_sensitive_info are preserved so a caller can see the doc's own declaration."] }
  ]);
}

export async function getRelatedCommand(options) {
  const graph = await collectWikiGraph(options.cwd);
  const target = resolveGraphPath(graph, options.docPath);
  if (!target) return notFound("get-related", "LLM-WIKI Related", options.docPath);

  const outbound = graph.edges.filter((edge) => edge.source === target).map((edge) => ({ path: edge.target, kind: edge.kind }));
  const inbound = graph.edges.filter((edge) => edge.target === target).map((edge) => ({ path: edge.source, kind: edge.kind }));
  return withText({
    command: "get-related",
    result: "pass",
    document: target,
    related: { outbound, inbound },
    findings: []
  }, "LLM-WIKI Related", [
    { title: "Summary", body: [`document: ${target}`, `outbound: ${outbound.length}`, `inbound: ${inbound.length}`] },
    { title: "Outbound (links to)", body: outbound.map((node) => `${node.path} (${node.kind})`) },
    { title: "Inbound (linked from)", body: inbound.map((node) => `${node.path} (${node.kind})`) },
    { title: "Caveats", body: ["Read-only. Neighbors are resolved wiki [[links]], related frontmatter, and local markdown links. Use get-doc <path> to read a neighbor."] }
  ]);
}

// ---- shared helpers ----------------------------------------------------

function notFound(command, title, requested) {
  const findings = [{
    severity: "error",
    rule: "retrieval.not_found",
    path: normalizeGiven(requested),
    message: `No wiki document matches: ${requested ?? "(none)"}.`
  }];
  return withText({
    command,
    result: "fail",
    requested: typeof requested === "string" ? requested : null,
    document: null,
    related: null,
    findingSummary: summarizeFindings(findings),
    findings
  }, title, [
    { title: "Summary", body: ["result: fail", `requested: ${requested ?? "(none)"}`] },
    { title: "Findings", body: findings.map(formatFinding) },
    { title: "Caveats", body: ["Pass a path under docs/llm-wiki (for example docs/llm-wiki/GLOSSARY.md, GLOSSARY.md, or GLOSSARY). Read-only."] }
  ]);
}

function occurrences(haystack, term) {
  if (!term) return 0;
  let count = 0;
  let index = haystack.indexOf(term);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(term, index + term.length);
  }
  return count;
}

function buildSnippet(body, terms) {
  const flat = body.replace(/\s+/g, " ").trim();
  if (!flat) return "";
  const lower = flat.toLowerCase();
  let at = -1;
  for (const term of terms) {
    const found = lower.indexOf(term);
    if (found !== -1 && (at === -1 || found < at)) at = found;
  }
  if (at === -1) return flat.length > 160 ? `${flat.slice(0, 160)} …` : flat;
  const start = Math.max(0, at - 60);
  const end = Math.min(flat.length, at + 100);
  return `${start > 0 ? "… " : ""}${flat.slice(start, end)}${end < flat.length ? " …" : ""}`;
}

function normalizeGiven(given) {
  return typeof given === "string" && given.trim() ? toPosix(given.trim()) : ".";
}

// Accept flexible doc references: a repo-relative path, a docs/llm-wiki-relative
// path, with or without the .md extension.
function candidatePaths(given) {
  const clean = toPosix(String(given ?? "").trim().replace(/^\.\//, "").replace(/^\/+/, ""));
  const withMd = clean.endsWith(".md") ? clean : `${clean}.md`;
  return new Set([clean, withMd, `docs/llm-wiki/${clean}`, `docs/llm-wiki/${withMd}`]);
}

function resolveDoc(docs, given) {
  if (!given) return null;
  const candidates = candidatePaths(given);
  const exact = docs.find((doc) => candidates.has(doc.path));
  if (exact) return exact;
  const clean = toPosix(String(given).trim());
  return docs.find((doc) => doc.path.endsWith(`/${clean}`) || doc.path.endsWith(`/${clean}.md`)) ?? null;
}

function resolveGraphPath(graph, given) {
  if (!given) return null;
  const candidates = candidatePaths(given);
  const doc = graph.documents.find((entry) => candidates.has(entry.path));
  if (doc) return doc.path;
  const clean = toPosix(String(given).trim());
  return graph.documents.find((entry) => entry.path.endsWith(`/${clean}`) || entry.path.endsWith(`/${clean}.md`))?.path ?? null;
}
