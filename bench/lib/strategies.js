// The three measured strategies for the impact-measurement harness (Gate 22).
//
// A representative "task" is a question a developer/agent must answer before
// making a change. Answering it means LOCATING and reading the relevant source.
// Each strategy assembles the input context a different way; we measure the
// token cost of that context and whether it actually surfaced the ground-truth
// source files needed to answer.
//
//   A0  whole-repo      — read every src file (naive "load everything" upper bound).
//   A1  grep-guided     — code-only, no wiki: grep src for the question's keywords,
//                         read every matching file IN FULL (path or content match).
//   A2  grep-snippet    — code-only, CONSERVATIVE: same grep hits, but read only a
//                         bounded window of lines around each match (a disciplined
//                         agent reads match context, not whole files). This is the
//                         LEAST wiki-favorable code-only baseline; if the wiki still
//                         wins against A2, the result is robust to the "grep doesn't
//                         read whole files" critique.
//   B   wiki-grounded   — read the wiki orientation docs first, then follow the
//                         evidence pointers those docs surface for the keywords.
//                         B's targeted file set is DERIVED FROM WIKI CONTENT, not
//                         from the answer key — so if the wiki's evidence pointers
//                         are incomplete, B genuinely fails to find a ground-truth
//                         file (success=false). This keeps the comparison honest.
//   B2  wiki-retrieval   — the RETRIEVAL model (Gate 24). Instead of re-reading
//                         source, the agent queries the wiki: it runs the shipped
//                         search-docs (zero-dep keyword/substring, AND-semantics,
//                         same scoring as src/commands/retrieval.js) and then
//                         get-doc's the top matched wiki *doc bodies*. Its cost is
//                         the search snippets + those doc bodies — NOT full source.
//                         This is the arm that isolates the retrieval mechanism:
//                         B2-vs-B (same corpus, same tasks) is the honest
//                         before/after-retrieval delta with corpus drift cancelled.
//
// "success" = did the strategy's opened set contain ALL ground-truth files. For
// B2 (which reads wiki docs, not source) "opened set" is the set of ground-truth
// source files REFERENCED by the doc bodies it read — a grounding/locating proxy
// (the wiki pointed the agent at the right code and explained it), not proof the
// answer is complete. Answer-quality needs the heavier LLM run (deferred; see
// METHODOLOGY.md).

import { estimateTokens } from "./tokens.js";

const SRC_PATH_RE = /src\/[A-Za-z0-9_./-]+\.js/g;
const DEFAULT_SNIPPET_WINDOW = 40;
// How many matched wiki doc bodies B2 actually get-doc's (reads in full). The
// search returns snippets for all matches cheaply; a real agent then opens only
// the few best hits. Disclosed, conservative parameter (like snippetWindow);
// overridable via `retrievalGetDocs` in tasks.json.
const DEFAULT_RETRIEVAL_GET_DOCS = 2;
const SEARCH_LIMIT = 20; // mirrors DEFAULT_SEARCH_LIMIT in src/commands/retrieval.js
const APPEND_ONLY_LOG = "docs/llm-wiki/log.md";

function lc(s) {
  return s.toLowerCase();
}

// Count non-overlapping occurrences of `term` in `haystack` (mirrors the
// occurrences() scorer in src/commands/retrieval.js).
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

// Minimal, zero-dep frontmatter split for the retrieval model: pull title / tags
// / visibility / contains_sensitive_info and return the body (what get-doc
// returns). Not a full YAML parser — enough to mirror what search-docs matches
// and get-doc reads on this repo's well-formed wiki docs.
function parseWikiDoc(content) {
  let title = "";
  const tags = [];
  let visibility = null;
  let sensitive = false;
  let body = content;
  if (content.startsWith("---")) {
    const close = content.indexOf("\n---", 3);
    if (close !== -1) {
      const fm = content.slice(3, close);
      const afterClose = content.indexOf("\n", close + 1);
      body = afterClose !== -1 ? content.slice(afterClose + 1) : "";
      const tm = fm.match(/^title:\s*(.+)$/m);
      if (tm) title = tm[1].trim().replace(/^["']|["']$/g, "");
      const vm = fm.match(/^visibility:\s*(.+)$/m);
      if (vm) visibility = vm[1].trim();
      if (/^contains_sensitive_info:\s*true\b/m.test(fm)) sensitive = true;
      const lines = fm.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        if (/^tags:\s*$/.test(lines[i])) {
          for (let j = i + 1; j < lines.length && /^\s*-\s+/.test(lines[j]); j++) {
            tags.push(lines[j].replace(/^\s*-\s+/, "").trim());
          }
        }
      }
    }
  }
  return { title, tags, visibility, sensitive, body };
}

// A ~160-char snippet around the first matching term (mirrors buildSnippet in
// src/commands/retrieval.js) — this is what search-docs returns per match.
function retrievalSnippet(body, terms) {
  const flat = body.replace(/\s+/g, " ").trim();
  if (!flat) return "";
  const lower = flat.toLowerCase();
  let at = -1;
  for (const term of terms) {
    const found = lower.indexOf(term);
    if (found !== -1 && (at === -1 || found < at)) at = found;
  }
  if (at === -1) return flat.length > 160 ? flat.slice(0, 160) : flat;
  const start = Math.max(0, at - 60);
  const end = Math.min(flat.length, at + 100);
  return flat.slice(start, end);
}

// Extract local src/*.js references from wiki text (the wiki's evidence pointers),
// keeping only paths that exist in the source tree.
function srcRefsIn(text, srcByPath) {
  const refs = new Set();
  const found = text.match(SRC_PATH_RE);
  if (!found) return refs;
  for (const raw of found) if (srcByPath.has(raw)) refs.add(raw);
  return refs;
}

// Count tokens of only the lines within +/- window of any keyword-matching line,
// with overlapping windows merged (deduped line set). Models an agent that reads
// match context rather than whole files.
function snippetTokens(content, keys, window) {
  const lines = content.split(/\r?\n/);
  const keep = new Set();
  for (let i = 0; i < lines.length; i++) {
    const ll = lc(lines[i]);
    if (keys.some((k) => ll.includes(k))) {
      const lo = Math.max(0, i - window);
      const hi = Math.min(lines.length - 1, i + window);
      for (let j = lo; j <= hi; j++) keep.add(j);
    }
  }
  if (keep.size === 0) return 0;
  const selected = [...keep].sort((a, b) => a - b).map((j) => lines[j]);
  return estimateTokens(selected.join("\n"));
}

function sumTokens(files) {
  return files.reduce((n, f) => n + f.tokens, 0);
}

function isSubset(needles, haystackSet) {
  return needles.every((n) => haystackSet.has(n));
}

// A0 — whole-repo: open everything.
export function strategyWholeRepo(task, ctx) {
  const opened = ctx.srcFiles.map((f) => f.relPath);
  const openedSet = new Set(opened);
  return {
    strategy: "A0_whole_repo",
    inputTokens: sumTokens(ctx.srcFiles),
    filesOpened: opened.length,
    openedFiles: opened,
    success: isSubset(task.groundTruth, openedSet),
    orientationTokens: 0,
    targetedTokens: sumTokens(ctx.srcFiles),
  };
}

// A1 — grep-guided code-only: read every src file that matches a keyword.
export function strategyGrepGuided(task, ctx) {
  const keys = task.keywords.map(lc);
  const matched = ctx.srcFiles.filter((f) => {
    const hay = lc(f.relPath + "\n" + f.content);
    return keys.some((k) => hay.includes(k));
  });
  const opened = matched.map((f) => f.relPath);
  const openedSet = new Set(opened);
  return {
    strategy: "A1_grep_guided",
    inputTokens: sumTokens(matched),
    filesOpened: opened.length,
    openedFiles: opened,
    success: isSubset(task.groundTruth, openedSet),
    orientationTokens: 0,
    targetedTokens: sumTokens(matched),
  };
}

// A2 — grep-snippet: same grep hits as A1, but only match-context lines counted.
export function strategyGrepSnippet(task, ctx) {
  const keys = task.keywords.map(lc);
  const window = ctx.snippetWindow ?? DEFAULT_SNIPPET_WINDOW;
  const matched = ctx.srcFiles.filter((f) => {
    const hay = lc(f.relPath + "\n" + f.content);
    return keys.some((k) => hay.includes(k));
  });
  let tokens = 0;
  for (const f of matched) tokens += snippetTokens(f.content, keys, window);
  const opened = matched.map((f) => f.relPath);
  const openedSet = new Set(opened);
  return {
    strategy: "A2_grep_snippet",
    inputTokens: tokens,
    filesOpened: opened.length,
    openedFiles: opened,
    success: isSubset(task.groundTruth, openedSet),
    orientationTokens: 0,
    targetedTokens: tokens,
  };
}

// B — wiki-grounded: orientation read, then follow the evidence pointers the
// wiki surfaces for the keywords. Targeted files are extracted from wiki text.
export function strategyWikiGrounded(task, ctx) {
  const keys = task.keywords.map(lc);
  const targeted = new Set();

  for (const doc of ctx.orientationDocs) {
    const lines = doc.content.split(/\r?\n/);
    for (const line of lines) {
      const ll = lc(line);
      if (!keys.some((k) => ll.includes(k))) continue;
      const found = line.match(SRC_PATH_RE);
      if (!found) continue;
      for (const raw of found) {
        // strip any #symbol:/#L anchors already excluded by the regex ($ at .js)
        if (ctx.srcByPath.has(raw)) targeted.add(raw);
      }
    }
  }

  const targetedFiles = [...targeted].map((p) => ctx.srcByPath.get(p));
  const orientationTokens = sumTokens(ctx.orientationDocs);
  const targetedTokens = sumTokens(targetedFiles);
  const openedSet = new Set(targeted);

  return {
    strategy: "B_wiki_grounded",
    // Per-task cost charges the FULL orientation read to this one task (pessimistic
    // for the wiki). run.js also reports the amortized/session view where the
    // orientation read is paid once and shared across all tasks.
    inputTokens: orientationTokens + targetedTokens,
    filesOpened: targetedFiles.length,
    openedFiles: [...targeted],
    success: isSubset(task.groundTruth, openedSet),
    orientationTokens,
    targetedTokens,
  };
}

// B2 — wiki-retrieval: the Gate 24 mechanism. Query the wiki (search-docs) and
// read the matched doc BODIES (get-doc) instead of re-reading source. Cost =
// search snippets (all matches, cheap) + the top-K matched doc bodies. Because
// B2 and B run on the SAME corpus, B2-vs-B isolates the retrieval mechanism from
// corpus drift — the honest before/after-retrieval delta.
export function strategyWikiRetrieval(task, ctx) {
  const terms = task.keywords.map(lc);
  const getDocs = ctx.retrievalGetDocs ?? DEFAULT_RETRIEVAL_GET_DOCS;

  // Content docs = wiki corpus minus templates (mirrors listWikiContentDocs).
  // The append-only log IS searched (it is a content doc) but is never get-doc'd
  // for a code-comprehension task — an agent sees from the snippet it is a
  // changelog, not a subsystem explanation. Disclosed in METHODOLOGY.
  const docs = ctx.wikiCorpus
    .filter((f) => !f.relPath.includes("/templates/"))
    .map((f) => ({ relPath: f.relPath, ...parseWikiDoc(f.content) }));

  const matches = [];
  for (const d of docs) {
    // search-docs excludes restricted/sensitive by default (no includeSensitive).
    if (d.visibility === "restricted" || d.sensitive) continue;
    const titleHay = lc(d.title);
    const metaHay = lc(d.tags.join(" "));
    const bodyHay = lc(d.body);
    const allPresent =
      terms.length > 0 &&
      terms.every((t) => titleHay.includes(t) || metaHay.includes(t) || bodyHay.includes(t));
    if (!allPresent) continue;
    let score = 0;
    for (const t of terms) {
      if (titleHay.includes(t)) score += 10;
      if (metaHay.includes(t)) score += 3;
      score += occurrences(bodyHay, t);
    }
    matches.push({ relPath: d.relPath, body: d.body, score, isLog: d.relPath === APPEND_ONLY_LOG });
  }
  matches.sort((a, b) => b.score - a.score || a.relPath.localeCompare(b.relPath));
  const capped = matches.slice(0, SEARCH_LIMIT);

  // What search returns: a snippet per match (what the agent reads to triage).
  const searchTokens = capped.reduce((n, m) => n + estimateTokens(retrievalSnippet(m.body, terms)), 0);

  // What the agent then get-doc's: the top-K matched content docs (excluding the
  // append-only log). Reading the doc body IS the retrieval answer — no source.
  const read = capped.filter((m) => !m.isLog).slice(0, getDocs);
  const bodyTokens = read.reduce((n, m) => n + estimateTokens(m.body), 0);

  // Grounding proxy: do the read doc bodies collectively reference every
  // ground-truth source file (so the agent knows exactly which code to touch)?
  const refs = new Set();
  for (const m of read) for (const r of srcRefsIn(m.body, ctx.srcByPath)) refs.add(r);

  const targetedTokens = searchTokens + bodyTokens;
  return {
    strategy: "B2_retrieval",
    // No orientation charge: search-docs replaces the "pre-read all orientation
    // docs" step — the agent queries on demand. This is the retrieval premise.
    inputTokens: targetedTokens,
    filesOpened: read.length,
    openedFiles: read.map((m) => m.relPath),
    success: isSubset(task.groundTruth, refs),
    orientationTokens: 0,
    targetedTokens,
    searchTokens,
    matchCount: matches.length,
    docsRead: read.length,
  };
}

// Mirror of src/commands/retrieval.js#selectSections (heading-weighted, top-N,
// preamble + matched sections in document order) — the text an agent reads under
// get-doc --section/--strict-section or prepare --compact. Returns "" when no
// section matches (models --strict-section: NO full-body fallback). Kept in sync
// with the shipped selector, like strategyWikiRetrieval mirrors search-docs.
const SECTION_LIMIT_B3 = 2;
function selectSectionsText(body, terms, limit = SECTION_LIMIT_B3) {
  if (terms.length === 0) return body;
  const lines = body.split("\n");
  const preamble = [];
  const sections = [];
  let current = null;
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      if (current) sections.push(current);
      current = [line];
    } else if (current) {
      current.push(line);
    } else {
      preamble.push(line);
    }
  }
  if (current) sections.push(current);
  if (sections.length === 0) return body;
  const scored = sections.map((sec, idx) => {
    const headingHay = lc(sec[0]);
    const hay = lc(sec.join("\n"));
    let score = 0;
    for (const t of terms) {
      if (headingHay.includes(t)) score += 5; // heading match ranks above body-only match
      score += occurrences(hay, t);
    }
    return { idx, text: sec.join("\n"), score };
  });
  const matching = scored.filter((s) => s.score > 0);
  if (matching.length === 0) return ""; // strict: no full-body fallback (the token guard)
  const top = matching
    .slice()
    .sort((a, b) => b.score - a.score || a.idx - b.idx)
    .slice(0, limit)
    .sort((a, b) => a.idx - b.idx);
  return [preamble.join("\n").trim(), ...top.map((s) => s.text)].filter(Boolean).join("\n\n");
}

// B3 — wiki-retrieval-compact: models the SHIPPED compact/section-scoped read
// (get-doc --section/--strict-section, prepare --compact). Same search + same
// top-K matched docs as B2, but reads only each doc's top matching SECTIONS
// (heading-weighted), never the whole body and never a full-body fallback.
// B3-vs-B2 on the SAME corpus isolates the section-scoping mechanism. Grounding
// is measured on the SELECTED section text — honestly, so a token win that drops
// grounding (evidence refs living in an unselected section) shows up, not hidden.
export function strategyWikiRetrievalCompact(task, ctx) {
  const terms = task.keywords.map(lc);
  const getDocs = ctx.retrievalGetDocs ?? DEFAULT_RETRIEVAL_GET_DOCS;

  const docs = ctx.wikiCorpus
    .filter((f) => !f.relPath.includes("/templates/"))
    .map((f) => ({ relPath: f.relPath, ...parseWikiDoc(f.content) }));

  const matches = [];
  for (const d of docs) {
    if (d.visibility === "restricted" || d.sensitive) continue;
    const titleHay = lc(d.title);
    const metaHay = lc(d.tags.join(" "));
    const bodyHay = lc(d.body);
    const allPresent =
      terms.length > 0 &&
      terms.every((t) => titleHay.includes(t) || metaHay.includes(t) || bodyHay.includes(t));
    if (!allPresent) continue;
    let score = 0;
    for (const t of terms) {
      if (titleHay.includes(t)) score += 10;
      if (metaHay.includes(t)) score += 3;
      score += occurrences(bodyHay, t);
    }
    matches.push({ relPath: d.relPath, body: d.body, score, isLog: d.relPath === APPEND_ONLY_LOG });
  }
  matches.sort((a, b) => b.score - a.score || a.relPath.localeCompare(b.relPath));
  const capped = matches.slice(0, SEARCH_LIMIT);

  const searchTokens = capped.reduce((n, m) => n + estimateTokens(retrievalSnippet(m.body, terms)), 0);

  // Section-scoped read: only the top matching sections of each top-K doc.
  const read = capped
    .filter((m) => !m.isLog)
    .slice(0, getDocs)
    .map((m) => ({ relPath: m.relPath, text: selectSectionsText(m.body, terms) }));
  const bodyTokens = read.reduce((n, m) => n + estimateTokens(m.text), 0);

  const refs = new Set();
  for (const m of read) for (const r of srcRefsIn(m.text, ctx.srcByPath)) refs.add(r);

  const targetedTokens = searchTokens + bodyTokens;
  return {
    strategy: "B3_retrieval_compact",
    inputTokens: targetedTokens,
    filesOpened: read.length,
    openedFiles: read.map((m) => m.relPath),
    success: isSubset(task.groundTruth, refs),
    orientationTokens: 0,
    targetedTokens,
    searchTokens,
    matchCount: matches.length,
    docsRead: read.length,
  };
}

export const STRATEGIES = [
  strategyWholeRepo,
  strategyGrepGuided,
  strategyGrepSnippet,
  strategyWikiGrounded,
  strategyWikiRetrieval,
  strategyWikiRetrievalCompact,
];
