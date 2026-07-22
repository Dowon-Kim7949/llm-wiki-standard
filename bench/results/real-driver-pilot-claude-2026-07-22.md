# Real-driver PILOT — Claude subagent, real tokens + behavioral (2026-07-22)

> **NOT the publishable product measurement, but it DOES carry real token + wall-clock data.**
> Protocol-validation pilot of the option-B driver path
> ([`../real/DRIVER_RUNBOOK.md`](../real/DRIVER_RUNBOOK.md)), run via **isolated Claude Code
> Explore subagents** (one fresh context per task-arm). The Agent framework reports each
> subagent's **total token usage and wall-clock**, so this pilot captures real tokens + duration
> **automatically** (no `/cost` needed) alongside tool-call count, files opened, and correctness.
> Caveats: N=1; the arms are **Explore subagents** driving retrieval via the **CLI**
> (`search-docs`/`get-doc`), and `get-doc` returns **full doc bodies** — so this measures that
> specific setup, not the interactive Claude Code product (MCP tools) or the SDK path. Tokens
> are a **single total** (not input/output split). **The result is UNFAVORABLE and does not
> support any README token/speed claim.**

## Per-task (real tokens + duration + behavioral)

| Task | B tokens | B2 tokens | B2/B tok | B ms | B2 ms | B calls | B2 calls | correct |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| type-detection-mobile | 22,599 | 29,244 | 1.29× | 28,798 | 49,663 | 5 | 8 | ✓/✓ |
| audit-pipeline | 46,302 | 41,235 | **0.89×** | 42,905 | 37,440 | 6 | 5 | ✓/✓ |
| config-merge | 23,767 | 37,256 | 1.57× | 47,302 | 35,257 | 8 | 5 | ✓/✓ |
| rule-toggle | 21,086 | 28,072 | 1.33× | 37,958 | 57,672 | 7 | 6 | ✓/✓ |
| skill-generation | 25,607 | 26,942 | 1.05× | 38,421 | 72,644 | 5 | 8 | ✓/✓ |
| mcp-tools | 25,390 | 40,886 | 1.61× | 25,365 | 63,714 | 5 | 9 | ✓/✓ |
| **sum** | **164,751** | **203,635** | **1.24×** | **220,749** | **316,390** | **36** | **41** | **6/6** |

## Deltas (B2 retrieval relative to B source-only)

- **Total tokens: 1.24× (B2 +24%, WORSE).** B2 was cheaper on only **1 of 6** tasks (audit).
- **Wall-clock: 1.43× (B2 +43%, SLOWER).**
- **Tool calls: 1.14× (B2 +14%, WORSE).**
- **Source-avoidance: B2 answered correctly without opening source in 5/6** (read 1–2 wiki docs).
- **Correctness: 6/6 tie.**

## Honest read

1. **On this repo, retrieval did NOT save tokens — it cost ~24% MORE and ran ~43% slower.**
   This is a real (not proxy) measurement and it is unfavorable to the retrieval arm.
2. **Why:** `get-doc` returns the **full body** of a wiki doc, and this repo's reference docs
   (`DOMAIN_FEATURES.md`, `ARCHITECTURE_CONVENTIONS.md`) are **very large**. Pulling one or two
   whole large docs into context costs more tokens than B's targeted grep + partial source
   reads. Source-avoidance (5/6) is genuine but does not translate to token savings when the
   docs are big. This is consistent with the earlier corpus-drift finding (the `chars/4` proxy
   `B vs A2` flipped to +5% as the corpus grew).
3. **This does not settle the product question.** The interactive Claude Code path uses the MCP
   `get_doc`/`search_docs` tools and an agent that may read more selectively; a smaller-doc
   project would also differ. But for THIS repo with full-doc reads, retrieval was not cheaper.

## Findings acted on / worth acting on

- **`search-docs` scorer noise — FIXED (commit `0cccb2e`).** `docs/llm-wiki/log.md` ranked #1
  for most queries and forced B2 to re-search; `searchDocsCommand` now deprioritizes the
  change log. A re-run should cut some B2 search calls, but the dominant B2 cost is reading
  **large doc bodies**, which the scorer fix does not change — so it likely won't flip the
  token result on this repo.
- Protocol runs cleanly: isolated fresh context per arm, read-only, no repo mutation, all 12
  arms produced gradeable answers, and token/duration are captured automatically.

## Automated measurement paths (no manual `/cost`)

1. **This subagent path (already ran):** real TOTAL tokens + wall-clock, fully automated via
   the Agent framework's usage report. Limitation: total (not input/output split); Explore
   subagent + CLI `get-doc` full-body reads.
2. **SDK path (`bench/real/agent.js` + Anthropic SDK):** per-call `response.usage`
   (input/output split), fully automated, no `/cost`. Needs API access + budget.
3. **Interactive `/cost` (manual):** only needed to measure the real Claude Code *product*
   experience (MCP tools). Least automated.

## Re-measurement: get-doc --section + scorer fix (B2-section, 2026-07-22)

After shipping the `search-docs` scorer fix and the `get-doc --section` focused-read feature,
the 6 B2 arms were re-run (isolated Explore subagents, N=1) using `get-doc --section "<terms>"`
instead of full-body reads.

| Task | B (src) | B2 full | B2 --section |
| --- | --- | --- | --- |
| type-detection-mobile | 22,599 | 29,244 | 26,862 |
| audit-pipeline | 46,302 | 41,235 | 58,825 |
| config-merge | 23,767 | 37,256 | 47,959 |
| rule-toggle | 21,086 | 28,072 | 31,910 |
| skill-generation | 25,607 | 26,942 | 23,203 |
| mcp-tools | 25,390 | 40,886 | 35,296 |
| **sum tokens** | **164,751** | **203,635** | **224,055** |
| **sum wall-ms** | **220,749** | **316,390** | **316,533** |

**Honest result: no token win — inconclusive at N=1.** B2 (both full and --section) still costs
MORE total tokens than B (source-only). The --section run did not drop below B2-full, but that
is **N=1 variance, not a regression**: per-task swings are large (audit-pipeline was
46k→41k→59k across the three runs purely from how much the agent chose to explore). Two reasons
the --section effect is undetectable here:

1. **The repo's retrieval targets are mega-sectioned.** The docs the agents actually open
   (`DOMAIN_FEATURES.md`, `ARCHITECTURE_CONVENTIONS.md`) are structured as one/few huge `##`
   sections, so `##`-level focused-read shrinks them only 1–8% (vs **−53%** on well-sectioned
   `PUBLIC_API.md` in isolation). The feature works; these target docs don't chunk.
2. **N=1 variance (~±40%) swamps a small effect.** Detecting a modest --section saving needs
   N≥3 and/or better-sectioned docs.

**Takeaways:**
- `get-doc --section` is validated in isolation (−53% on `PUBLIC_API.md`) and is a real,
  backward-compatible improvement — but it does **not** make retrieval token-competitive on THIS
  repo, because the big reference docs are mega-sectioned.
- To actually cut retrieval tokens here: restructure the mega-docs into smaller `##` sections,
  add finer (sub-section / bullet) chunking, or accept that retrieval's value on this repo is
  **orientation + correctness (6/6 tie)**, not token savings.
- **README token-savings claim: still not supported (measured unfavorable). Stays forbidden.**
