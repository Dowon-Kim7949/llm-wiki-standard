#!/usr/bin/env node
// Impact-measurement harness runner (Gate 22). Zero-dependency, repo-internal,
// NOT part of the npm `files` allowlist (never shipped).
//
//   node bench/run.js                 run + write bench/results/baseline.json + .md
//   node bench/run.js --no-write      run + print only (no files written)
//   node bench/run.js --against <f>   run + print token deltas vs a prior results json
//
// See bench/METHODOLOGY.md for what is measured and the honesty caveats.

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

import { collectFiles, readNamedFiles } from "./lib/fs-walk.js";
import { STRATEGIES } from "./lib/strategies.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(HERE);

const args = process.argv.slice(2);
const noWrite = args.includes("--no-write");
const againstIdx = args.indexOf("--against");
const againstPath = againstIdx >= 0 ? args[againstIdx + 1] : null;

function fmt(n) {
  return Math.round(n).toLocaleString("en-US");
}
function pct(n) {
  return `${(n * 100).toFixed(1)}%`;
}
function ratioNote(bTokens, baselineTokens) {
  if (baselineTokens === 0) return "n/a";
  const r = bTokens / baselineTokens;
  return `${r.toFixed(2)}x (${r < 1 ? "-" : "+"}${pct(Math.abs(1 - r))})`;
}

function loadConfig() {
  const cfg = JSON.parse(readFileSync(join(HERE, "tasks.json"), "utf8"));
  const matchRe = new RegExp(cfg.srcMatch);
  return { cfg, matchRe };
}

function buildContext(cfg, matchRe) {
  const srcFiles = collectFiles(REPO_ROOT, cfg.srcRoot, (rel) => matchRe.test(rel));
  const srcByPath = new Map(srcFiles.map((f) => [f.relPath, f]));
  const orientationDocs = readNamedFiles(REPO_ROOT, cfg.orientationDocs);
  const wikiCorpus = collectFiles(REPO_ROOT, "docs/llm-wiki", (rel) => rel.endsWith(".md"));
  const snippetWindow = cfg.snippetWindow ?? 40;
  const retrievalGetDocs = cfg.retrievalGetDocs ?? 2;
  return { srcFiles, srcByPath, orientationDocs, wikiCorpus, snippetWindow, retrievalGetDocs };
}

function run() {
  const { cfg, matchRe } = loadConfig();
  const ctx = buildContext(cfg, matchRe);
  const startedAt = Date.now();

  const totalSrcTokens = ctx.srcFiles.reduce((n, f) => n + f.tokens, 0);
  const orientationTokens = ctx.orientationDocs.reduce((n, f) => n + f.tokens, 0);
  const wikiCorpusTokens = ctx.wikiCorpus.reduce((n, f) => n + f.tokens, 0);

  const perTask = [];
  for (const task of cfg.tasks) {
    const results = STRATEGIES.map((fn) => fn(task, ctx));
    const byName = Object.fromEntries(results.map((r) => [r.strategy, r]));
    perTask.push({ task, byName });
  }

  const T = cfg.tasks.length;
  // Session totals: A0/A1/A2 re-read per task; B pays orientation ONCE, then targeted per task.
  // B2 (retrieval) queries per task (no shared orientation) — pessimistic (re-reads
  // matched docs each task; de-duping across the session would only lower it).
  const sessionA0 = perTask.reduce((n, p) => n + p.byName.A0_whole_repo.inputTokens, 0);
  const sessionA1 = perTask.reduce((n, p) => n + p.byName.A1_grep_guided.inputTokens, 0);
  const sessionA2 = perTask.reduce((n, p) => n + p.byName.A2_grep_snippet.inputTokens, 0);
  const sessionBTargeted = perTask.reduce((n, p) => n + p.byName.B_wiki_grounded.targetedTokens, 0);
  const sessionB = orientationTokens + sessionBTargeted;
  const sessionB2 = perTask.reduce((n, p) => n + p.byName.B2_retrieval.inputTokens, 0);
  // B3 (retrieval-compact): section-scoped reads of the same top-K matched docs.
  const sessionB3 = perTask.reduce((n, p) => n + p.byName.B3_retrieval_compact.inputTokens, 0);

  const a1Success = perTask.filter((p) => p.byName.A1_grep_guided.success).length;
  const bSuccess = perTask.filter((p) => p.byName.B_wiki_grounded.success).length;
  const b2Success = perTask.filter((p) => p.byName.B2_retrieval.success).length;
  const b3Success = perTask.filter((p) => p.byName.B3_retrieval_compact.success).length;

  const elapsedMs = Date.now() - startedAt;

  const summary = {
    schema: "llm-wiki-bench/1",
    generatedAt: new Date().toISOString(),
    repo: "llm-wiki-governance",
    tokenEstimator: "chars/4 (see bench/lib/tokens.js)",
    snippetWindowLines: ctx.snippetWindow,
    retrievalGetDocs: ctx.retrievalGetDocs,
    corpus: {
      srcFiles: ctx.srcFiles.length,
      srcTokens: totalSrcTokens,
      orientationDocs: ctx.orientationDocs.length,
      orientationTokens,
      wikiCorpusDocs: ctx.wikiCorpus.length,
      wikiCorpusTokens,
    },
    tasks: perTask.map((p) => ({
      id: p.task.id,
      question: p.task.question,
      keywords: p.task.keywords,
      groundTruth: p.task.groundTruth,
      A0_whole_repo: sliceResult(p.byName.A0_whole_repo),
      A1_grep_guided: sliceResult(p.byName.A1_grep_guided),
      A2_grep_snippet: sliceResult(p.byName.A2_grep_snippet),
      B_wiki_grounded: sliceResult(p.byName.B_wiki_grounded),
      B2_retrieval: sliceResult(p.byName.B2_retrieval),
      B3_retrieval_compact: sliceResult(p.byName.B3_retrieval_compact),
    })),
    session: {
      taskCount: T,
      A0_whole_repo_tokens: sessionA0,
      A1_grep_guided_tokens: sessionA1,
      A2_grep_snippet_tokens: sessionA2,
      B_wiki_grounded_tokens: sessionB,
      B_orientation_once_tokens: orientationTokens,
      B_targeted_tokens: sessionBTargeted,
      B_amortized_per_task_tokens: Math.round(orientationTokens / T + sessionBTargeted / T),
      B2_retrieval_tokens: sessionB2,
      B2_amortized_per_task_tokens: Math.round(sessionB2 / T),
      B3_retrieval_compact_tokens: sessionB3,
      B3_amortized_per_task_tokens: Math.round(sessionB3 / T),
      A1_success_rate: a1Success / T,
      B_success_rate: bSuccess / T,
      B2_success_rate: b2Success / T,
      B3_success_rate: b3Success / T,
      B_vs_A1_session: sessionB / sessionA1,
      B_vs_A2_session: sessionB / sessionA2,
      B_vs_A0_session: sessionB / sessionA0,
      B2_vs_A1_session: sessionB2 / sessionA1,
      B2_vs_A2_session: sessionB2 / sessionA2,
      B2_vs_A0_session: sessionB2 / sessionA0,
      B2_vs_B_session: sessionB2 / sessionB,
      B3_vs_B2_session: sessionB2 ? sessionB3 / sessionB2 : 0,
      B3_vs_A2_session: sessionB3 / sessionA2,
    },
    harnessComputeMs: elapsedMs,
  };

  printReport(summary, perTask);
  return summary;
}

function sliceResult(r) {
  const out = {
    inputTokens: r.inputTokens,
    filesOpened: r.filesOpened,
    success: r.success,
    orientationTokens: r.orientationTokens,
    targetedTokens: r.targetedTokens,
    openedFiles: r.openedFiles,
  };
  if (r.searchTokens !== undefined) out.searchTokens = r.searchTokens;
  if (r.matchCount !== undefined) out.matchCount = r.matchCount;
  if (r.docsRead !== undefined) out.docsRead = r.docsRead;
  return out;
}

function printReport(s, perTask) {
  const L = [];
  L.push("");
  L.push("LLM-WIKI Impact Measurement — current run (A0/A1/A2/B + B2 retrieval)");
  L.push("=".repeat(70));
  L.push(`generated: ${s.generatedAt}`);
  L.push(`estimator: ${s.tokenEstimator}`);
  L.push("");
  L.push("Corpus:");
  L.push(`  source scanned : ${s.corpus.srcFiles} files, ${fmt(s.corpus.srcTokens)} tokens`);
  L.push(`  wiki orientation read (paid once/session): ${s.corpus.orientationDocs} docs, ${fmt(s.corpus.orientationTokens)} tokens`);
  L.push(`  full wiki corpus (author + maintain cost): ${s.corpus.wikiCorpusDocs} docs, ${fmt(s.corpus.wikiCorpusTokens)} tokens`);
  L.push("");
  L.push(`Per-task input tokens (B charges FULL orientation each task = pessimistic; A2 window +/-${s.snippetWindowLines} lines; B2 = search + top-${s.retrievalGetDocs} matched doc bodies):`);
  L.push(
    "  " +
      pad("task", 20) +
      pad("A1 grepFull", 13) +
      pad("A2 grepSnip", 13) +
      pad("B wiki", 12) +
      pad("B2 retr", 12) +
      pad("Bok", 5) +
      pad("B2ok", 5) +
      pad("B2 vs B", 13) +
      "B2 vs A2"
  );
  for (const p of perTask) {
    const a1 = p.byName.A1_grep_guided;
    const a2 = p.byName.A2_grep_snippet;
    const b = p.byName.B_wiki_grounded;
    const b2 = p.byName.B2_retrieval;
    L.push(
      "  " +
        pad(p.task.id, 20) +
        pad(`${fmt(a1.inputTokens)}(${a1.filesOpened})`, 13) +
        pad(`${fmt(a2.inputTokens)}(${a2.filesOpened})`, 13) +
        pad(`${fmt(b.inputTokens)}(${b.filesOpened})`, 12) +
        pad(`${fmt(b2.inputTokens)}(${b2.filesOpened})`, 12) +
        pad(b.success ? "yes" : "NO", 5) +
        pad(b2.success ? "yes" : "NO", 5) +
        pad(ratioNote(b2.inputTokens, b.inputTokens), 13) +
        ratioNote(b2.inputTokens, a2.inputTokens)
    );
  }
  L.push("");
  L.push("Session view (6 tasks; A0/A1/A2 re-read per task, B pays orientation ONCE, B2 queries per task):");
  L.push(`  A0 whole-repo total : ${fmt(s.session.A0_whole_repo_tokens)} tokens`);
  L.push(`  A1 grep-full total  : ${fmt(s.session.A1_grep_guided_tokens)} tokens   success ${pct(s.session.A1_success_rate)}`);
  L.push(`  A2 grep-snippet     : ${fmt(s.session.A2_grep_snippet_tokens)} tokens   (conservative code-only floor)`);
  L.push(`  B  wiki-grounded    : ${fmt(s.session.B_wiki_grounded_tokens)} tokens   success ${pct(s.session.B_success_rate)}   (full-source reads = pre-retrieval)`);
  L.push(`     = ${fmt(s.session.B_orientation_once_tokens)} orientation (once) + ${fmt(s.session.B_targeted_tokens)} targeted reads`);
  L.push(`  B2 wiki-retrieval   : ${fmt(s.session.B2_retrieval_tokens)} tokens   success ${pct(s.session.B2_success_rate)}   (Gate 24: search + doc bodies, no source)`);
  L.push(`  B2 amortized / task : ${fmt(s.session.B2_amortized_per_task_tokens)} tokens`);
  L.push(`  B3 retrieval-compact: ${fmt(s.session.B3_retrieval_compact_tokens)} tokens   success ${pct(s.session.B3_success_rate)}   (proposed: search + section-scoped reads, no full body)`);
  L.push("");
  L.push(`  B  vs A2 (session)  : ${ratioNote(s.session.B_wiki_grounded_tokens, s.session.A2_grep_snippet_tokens)}  (pre-retrieval wiki vs conservative floor)`);
  L.push(`  B2 vs B  (session)  : ${ratioNote(s.session.B2_retrieval_tokens, s.session.B_wiki_grounded_tokens)}  <- RETRIEVAL delta (same corpus, drift cancelled)`);
  L.push(`  B2 vs A2 (session)  : ${ratioNote(s.session.B2_retrieval_tokens, s.session.A2_grep_snippet_tokens)}  <- retrieval vs conservative code-only floor`);
  L.push(`  B2 vs A1 (session)  : ${ratioNote(s.session.B2_retrieval_tokens, s.session.A1_grep_guided_tokens)}`);
  L.push(`  B2 vs A0 (session)  : ${ratioNote(s.session.B2_retrieval_tokens, s.session.A0_whole_repo_tokens)}`);
  L.push(`  B3 vs B2 (session)  : ${ratioNote(s.session.B3_retrieval_compact_tokens, s.session.B2_retrieval_tokens)}  <- COMPACT delta (section-scoped vs full doc bodies, same corpus)`);
  L.push(`  B3 vs A2 (session)  : ${ratioNote(s.session.B3_retrieval_compact_tokens, s.session.A2_grep_snippet_tokens)}`);
  L.push("");
  L.push("Honest verdict (auto-computed):");
  for (const line of verdict(s)) L.push("  " + line);
  L.push("");
  L.push(`harness compute time: ${s.harnessComputeMs} ms (NOT agent latency — that needs the LLM follow-up)`);
  L.push("");
  console.log(L.join("\n"));
}

// Auto-computed, honest read of the numbers — favorable OR unfavorable.
function verdict(s) {
  const out = [];
  const sess = s.session;
  const winA1 = sess.B_wiki_grounded_tokens < sess.A1_grep_guided_tokens;
  out.push(
    winA1
      ? `Vs A1 (grep, read whole matching files): across a ${sess.taskCount}-task session the governed wiki costs FEWER input tokens (${ratioNote(sess.B_wiki_grounded_tokens, sess.A1_grep_guided_tokens)} of A1).`
      : `Vs A1 (grep, whole files): the wiki costs MORE input tokens (${ratioNote(sess.B_wiki_grounded_tokens, sess.A1_grep_guided_tokens)} of A1) — UNFAVORABLE, reported as required.`
  );
  const winA2 = sess.B_wiki_grounded_tokens < sess.A2_grep_snippet_tokens;
  out.push(
    winA2
      ? `Vs A2 (grep, snippet-only — the CONSERVATIVE code-only floor): the wiki STILL costs fewer tokens (${ratioNote(sess.B_wiki_grounded_tokens, sess.A2_grep_snippet_tokens)} of A2), so the win survives the "grep doesn't read whole files" critique.`
      : `Vs A2 (grep snippet-only, the conservative floor): the wiki costs MORE than a disciplined snippet-reading grep (${ratioNote(sess.B_wiki_grounded_tokens, sess.A2_grep_snippet_tokens)} of A2) — an HONEST limit: the token win holds only against whole-file reading, not against careful snippet reading.`
  );
  if (sess.B_success_rate >= sess.A1_success_rate) {
    out.push(
      `Locating success: wiki ${pct(sess.B_success_rate)} vs grep ${pct(sess.A1_success_rate)} — on this repo grep also found the target code, so the wiki's demonstrated advantage here is CONTEXT SIZE, not locating. (A cold grep with no symbol names could miss; not shown by these tasks.)`
    );
  } else {
    out.push(
      `Locating success: wiki ${pct(sess.B_success_rate)} vs grep ${pct(sess.A1_success_rate)} — the wiki MISSED a ground-truth file (incomplete evidence pointer); a real, honest gap to fix.`
    );
  }

  // B2 — the retrieval mechanism. B2-vs-B isolates it from corpus drift (same
  // corpus, same tasks): the only honest before/after-retrieval delta.
  const b2WinB = sess.B2_retrieval_tokens < sess.B_wiki_grounded_tokens;
  out.push(
    b2WinB
      ? `RETRIEVAL delta (B2 vs B, same corpus — drift cancelled): querying the wiki (search + reading matched doc bodies) costs ${ratioNote(sess.B2_retrieval_tokens, sess.B_wiki_grounded_tokens)} of re-reading the full source the wiki points to. This is the retrieval mechanism's own effect, isolated from corpus growth.`
      : `RETRIEVAL delta (B2 vs B, same corpus): reading matched wiki doc bodies costs MORE than re-reading the pointed-to source (${ratioNote(sess.B2_retrieval_tokens, sess.B_wiki_grounded_tokens)} of B) — UNFAVORABLE, reported as required.`
  );
  const b2WinA2 = sess.B2_retrieval_tokens < sess.A2_grep_snippet_tokens;
  out.push(
    b2WinA2
      ? `Vs the conservative floor (B2 vs A2): retrieval costs ${ratioNote(sess.B2_retrieval_tokens, sess.A2_grep_snippet_tokens)} of a disciplined snippet-grep — the wiki win now survives against snippet-only code reading, which the pre-retrieval arm (B) did not.`
      : `Vs the conservative floor (B2 vs A2): retrieval still costs MORE than a disciplined snippet-grep (${ratioNote(sess.B2_retrieval_tokens, sess.A2_grep_snippet_tokens)} of A2) — an HONEST limit reported as required.`
  );
  out.push(
    sess.B2_success_rate >= 1
      ? `B2 grounding success: ${pct(sess.B2_success_rate)} — for every task the top matched wiki doc bodies referenced all ground-truth source files, so retrieval pointed the agent at the right code without opening it.`
      : `B2 grounding success: ${pct(sess.B2_success_rate)} — on some tasks the top matched doc bodies did NOT reference every ground-truth file (keyword ranking or evidence-pointer gap); a real, honest limit of zero-dep keyword retrieval.`
  );

  // B3 — the COMPACT retrieval mechanism (section-scoped reads). B3-vs-B2 on the
  // same corpus isolates section-scoping from full-body reading. Grounding is the
  // honesty check: a token win that drops grounding (evidence in an unselected
  // section) must be reported, not hidden.
  const b3WinB2 = sess.B3_retrieval_compact_tokens < sess.B2_retrieval_tokens;
  out.push(
    b3WinB2
      ? `COMPACT delta (B3 vs B2, same corpus): reading only the top matching SECTIONS of each matched doc costs ${ratioNote(sess.B3_retrieval_compact_tokens, sess.B2_retrieval_tokens)} of reading the full doc bodies. This models get-doc --section/--strict-section and prepare --compact.`
      : `COMPACT delta (B3 vs B2, same corpus): section-scoped reads cost MORE than full doc bodies (${ratioNote(sess.B3_retrieval_compact_tokens, sess.B2_retrieval_tokens)} of B2) — UNFAVORABLE on this corpus (docs shorter than the section-selection overhead), reported as required.`
  );
  out.push(
    sess.B3_success_rate >= sess.B2_success_rate
      ? `B3 grounding success: ${pct(sess.B3_success_rate)} (vs B2 ${pct(sess.B2_success_rate)}) — section-scoped reading kept grounding while cutting tokens; the ground-truth source refs survived in the selected sections.`
      : `B3 grounding success: ${pct(sess.B3_success_rate)} DROPPED vs B2 ${pct(sess.B2_success_rate)} — section-scoping saved tokens but lost some ground-truth refs (evidence lived in an unselected section). HONEST trade-off: prefer B2 (or --section without --strict) when grounding matters more than tokens.`
  );
  out.push(
    "Caveat: token counts are a chars/4 proxy; wall-clock + answer-quality need the deferred LLM run. Wiki authoring/maintenance is a real cost not charged per-task (disclosed as the corpus figure). B2 models the shipped search-docs + get-doc (excludes the append-only log from get-doc reads; top-K disclosed); it measures the retrieval/orientation context cost, not the final-edit read. No token/speed claim ships in the README until a measured result supports it (METHODOLOGY §10)."
  );
  return out;
}

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s + " " : s + " ".repeat(n - s.length);
}

function writeResults(summary) {
  const dir = join(HERE, "results");
  mkdirSync(dir, { recursive: true });
  // baseline.{json,md} is the FROZEN Gate 22 before-retrieval reference and is
  // never overwritten here — the current run (with the B2 retrieval arm) writes
  // to current.{json,md}. Compare across them with `--against results/baseline.json`.
  writeFileSync(join(dir, "current.json"), JSON.stringify(summary, null, 2) + "\n", "utf8");
  writeFileSync(join(dir, "current.md"), renderMarkdown(summary), "utf8");
  console.log(`wrote bench/results/current.json and bench/results/current.md (baseline.* left frozen as the before-retrieval reference)`);
}

function renderMarkdown(s) {
  const M = [];
  M.push("# LLM-WIKI Impact Measurement — current run (with B2 retrieval)");
  M.push("");
  M.push("> Auto-generated by `node bench/run.js`. Do not hand-edit; re-run to refresh.");
  M.push("> The frozen Gate 22 **before-retrieval** reference is [`baseline.md`](baseline.md); this file is the current run and adds the **B2 retrieval** arm (Gate 24).");
  M.push("> See [`../METHODOLOGY.md`](../METHODOLOGY.md) for what is measured and the honesty caveats.");
  M.push("");
  M.push(`- generated: \`${s.generatedAt}\``);
  M.push(`- token estimator: ${s.tokenEstimator}`);
  M.push(`- source scanned: ${s.corpus.srcFiles} files, ${fmt(s.corpus.srcTokens)} tokens`);
  M.push(`- wiki orientation read (once/session): ${s.corpus.orientationDocs} docs, ${fmt(s.corpus.orientationTokens)} tokens`);
  M.push(`- full wiki corpus (author + maintain): ${s.corpus.wikiCorpusDocs} docs, ${fmt(s.corpus.wikiCorpusTokens)} tokens`);
  M.push("");
  M.push("## Strategies");
  M.push("");
  M.push("- **A0 whole-repo** — read every source file (naive upper bound).");
  M.push("- **A1 grep-full** — code-only: grep src for the cold query terms, read each matching file in full.");
  M.push(`- **A2 grep-snippet** — code-only, conservative: same grep hits, but count only +/-${s.snippetWindowLines} lines around each match (a disciplined agent reading match context). This is the LEAST wiki-favorable code-only baseline.`);
  M.push("- **B wiki-grounded** — read the wiki orientation docs, then follow the evidence pointers they surface for the query, reading the pointed-to **source** in full. This is the **pre-retrieval** wiki model.");
  M.push("- **B2 wiki-retrieval** *(Gate 24)* — query the wiki: run the shipped `search-docs` (zero-dep keyword/AND-semantics, same scoring as `src/commands/retrieval.js`), then `get-doc` the top-" + s.retrievalGetDocs + " matched **doc bodies** — no source re-read. The append-only `log.md` is searched but never get-doc'd (a changelog, not a subsystem explanation). **B2-vs-B runs on the same corpus, so it isolates the retrieval mechanism from corpus drift.**");
  M.push("- **B3 wiki-retrieval-compact** *(proposed)* — same search + same top-K matched docs as B2, but reads only each doc's top matching **sections** (heading-weighted, no full-body fallback) — models the shipped `get-doc --section`/`--strict-section` and `prepare --compact`. **B3-vs-B2 (same corpus) isolates the section-scoping mechanism**; grounding is measured on the selected sections so a token win that drops grounding is visible.");
  M.push("");
  M.push("## Per-task input tokens");
  M.push("");
  M.push("B reads full pointed-to source; B2 reads matched wiki doc bodies. `B2 vs B` is the retrieval delta (same corpus); `B2 vs A2` is retrieval vs the conservative code-only floor.");
  M.push("");
  M.push("| task | A1 grep-full (files) | A2 grep-snip (files) | B wiki (files) | B2 retr (docs) | B found | B2 found | B2 vs B | B2 vs A2 |");
  M.push("| --- | ---: | ---: | ---: | ---: | :---: | :---: | ---: | ---: |");
  for (const t of s.tasks) {
    M.push(
      `| \`${t.id}\` | ${fmt(t.A1_grep_guided.inputTokens)} (${t.A1_grep_guided.filesOpened}) | ${fmt(t.A2_grep_snippet.inputTokens)} (${t.A2_grep_snippet.filesOpened}) | ${fmt(t.B_wiki_grounded.inputTokens)} (${t.B_wiki_grounded.filesOpened}) | ${fmt(t.B2_retrieval.inputTokens)} (${t.B2_retrieval.filesOpened}) | ${t.B_wiki_grounded.success ? "yes" : "**NO**"} | ${t.B2_retrieval.success ? "yes" : "**NO**"} | ${ratioNote(t.B2_retrieval.inputTokens, t.B_wiki_grounded.inputTokens)} | ${ratioNote(t.B2_retrieval.inputTokens, t.A2_grep_snippet.inputTokens)} |`
    );
  }
  M.push("");
  M.push("## Session view (6 tasks)");
  M.push("");
  M.push("A0/A1/A2 re-read source per task; B pays the orientation read once, then targeted reads; B2 queries per task (no shared orientation — de-duping matched docs across the session would only lower B2).");
  M.push("");
  M.push("| metric | value |");
  M.push("| --- | ---: |");
  M.push(`| A0 whole-repo total | ${fmt(s.session.A0_whole_repo_tokens)} |`);
  M.push(`| A1 grep-full total | ${fmt(s.session.A1_grep_guided_tokens)} |`);
  M.push(`| A2 grep-snippet total (conservative floor) | ${fmt(s.session.A2_grep_snippet_tokens)} |`);
  M.push(`| B wiki-grounded total (pre-retrieval) | ${fmt(s.session.B_wiki_grounded_tokens)} |`);
  M.push(`| — orientation (once) | ${fmt(s.session.B_orientation_once_tokens)} |`);
  M.push(`| — targeted reads | ${fmt(s.session.B_targeted_tokens)} |`);
  M.push(`| **B2 wiki-retrieval total (Gate 24)** | **${fmt(s.session.B2_retrieval_tokens)}** |`);
  M.push(`| B2 amortized / task | ${fmt(s.session.B2_amortized_per_task_tokens)} |`);
  M.push(`| B3 wiki-retrieval-compact total (proposed) | ${fmt(s.session.B3_retrieval_compact_tokens)} |`);
  M.push(`| B locating success | ${pct(s.session.B_success_rate)} |`);
  M.push(`| B2 grounding success | ${pct(s.session.B2_success_rate)} |`);
  M.push(`| B3 grounding success | ${pct(s.session.B3_success_rate)} |`);
  M.push(`| B vs A2 (session, pre-retrieval) | ${ratioNote(s.session.B_wiki_grounded_tokens, s.session.A2_grep_snippet_tokens)} |`);
  M.push(`| **B2 vs B (session — RETRIEVAL delta, drift cancelled)** | **${ratioNote(s.session.B2_retrieval_tokens, s.session.B_wiki_grounded_tokens)}** |`);
  M.push(`| **B2 vs A2 (session — vs conservative floor)** | **${ratioNote(s.session.B2_retrieval_tokens, s.session.A2_grep_snippet_tokens)}** |`);
  M.push(`| B2 vs A1 (session) | ${ratioNote(s.session.B2_retrieval_tokens, s.session.A1_grep_guided_tokens)} |`);
  M.push(`| B2 vs A0 (session) | ${ratioNote(s.session.B2_retrieval_tokens, s.session.A0_whole_repo_tokens)} |`);
  M.push(`| **B3 vs B2 (session — COMPACT delta, section-scoped)** | **${ratioNote(s.session.B3_retrieval_compact_tokens, s.session.B2_retrieval_tokens)}** |`);
  M.push(`| B3 vs A2 (session) | ${ratioNote(s.session.B3_retrieval_compact_tokens, s.session.A2_grep_snippet_tokens)} |`);
  M.push("");
  M.push(`> Wiki authoring/maintenance cost (disclosed, not charged per-task): the full wiki corpus is ${fmt(s.corpus.wikiCorpusDocs)} docs / ${fmt(s.corpus.wikiCorpusTokens)} tokens.`);
  M.push("");
  M.push("## Honest verdict (auto-computed)");
  M.push("");
  for (const line of verdict(s)) M.push(`- ${line}`);
  M.push("");
  return M.join("\n");
}

function compare(current, priorPath) {
  const prior = JSON.parse(readFileSync(priorPath, "utf8"));
  const c = current.session;
  const p = prior.session;
  console.log("");
  console.log(`Delta vs ${priorPath}:`);
  const show = (v) => (v === undefined ? "n/a" : v);
  const rows = [
    ["A1 grep-full", p.A1_grep_guided_tokens, c.A1_grep_guided_tokens],
    ["A2 grep-snippet", p.A2_grep_snippet_tokens, c.A2_grep_snippet_tokens],
    ["B wiki-grounded", p.B_wiki_grounded_tokens, c.B_wiki_grounded_tokens],
    ["B2 retrieval", p.B2_retrieval_tokens, c.B2_retrieval_tokens],
    ["B vs A2 ratio", p.B_vs_A2_session, c.B_vs_A2_session],
    ["B2 vs B ratio", p.B2_vs_B_session, c.B2_vs_B_session],
    ["B2 vs A2 ratio", p.B2_vs_A2_session, c.B2_vs_A2_session],
    ["B success rate", p.B_success_rate, c.B_success_rate],
    ["B2 success rate", p.B2_success_rate, c.B2_success_rate],
  ];
  for (const [name, was, now] of rows) {
    console.log(`  ${pad(name, 20)} ${show(was)} -> ${show(now)}`);
  }
  console.log("");
}

const summary = run();
if (againstPath) compare(summary, againstPath);
if (!noWrite && !againstPath) writeResults(summary);
