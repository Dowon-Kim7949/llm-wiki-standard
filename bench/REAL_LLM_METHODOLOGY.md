# Real-LLM measurement — design (the deferred heavier follow-up)

> **Status: DESIGN + PROTOTYPE (not executed).** This document and `bench/real/` define
> *how* to run a real-agent measurement of the retrieval value. No real numbers exist yet —
> running it requires wiring an agent driver (see §5) and spending real API budget, which is
> a deliberate, authorized step. Until a real run lands, **no token / speed / productivity
> claim ships in the README or launch copy** (same rule as [`METHODOLOGY.md`](METHODOLOGY.md) §10).

## 1. Why this exists

The deterministic `chars/4` harness ([`METHODOLOGY.md`](METHODOLOGY.md)) measures a *proxy*
for context cost. Its headline — the `B2_retrieval` arm costs ~0.19× of the pre-retrieval
`B` arm (−81.5%) on this repo — is honest but is **a proxy, not a real run**: it counts
characters, not real BPE tokens; it models a clean "gather then read" pass, not an agent
interleaving search, partial reads, and reasoning; and it cannot measure **answer quality**.

The only thing that can turn that proxy into a number safe to publish is a **real agent run**:
the same tasks, answered by a real model, with real input/output tokens, real wall-clock, and
a graded answer. This file specifies that run so it is reproducible and honest before a single
dollar of API budget is spent.

## 2. What is measured

For each task (reuse [`tasks.json`](tasks.json) — the same six cold-keyword questions), run a
real agent **twice**:

| Arm | The agent's tools & instruction | Represents |
| --- | --- | --- |
| **B — no-retrieval** | The repo. Answer by reading **source code** (grep + read files). The wiki is NOT offered. | today's default agent |
| **B2 — retrieval** | The same repo **plus** the read-only wiki retrieval tools (`search_docs`/`get_doc`/`get_related`, Gate 24), and the instruction to query the wiki first. | the wiki-as-memory agent |

Captured per (task, arm):

- **`inputTokens` / `outputTokens`** — from the model's own usage accounting (real BPE, not a
  proxy). This is the headline: does B2 pull in fewer input tokens to reach an answer?
- **`wallMs`** — end-to-end latency.
- **`toolCalls`** — how many reads/searches, and which files/docs were opened (findability).
- **`answer`** — the final text, graded in §4.

The **delta** (B2 vs B, per task and aggregated) is the real before/after-retrieval result.
Because both arms answer the *same* task on the *same* repo, the difference isolates the
retrieval mechanism — the same logic that makes `B2_retrieval` vs `B` the honest comparison in
the proxy harness.

## 3. Controls (so the number is trustworthy)

- **Same model, same decoding params** for both arms (temperature 0 where possible for
  reproducibility; record the model id + params in the result).
- **Cold keywords only** (inherited from `tasks.json`): the question terms a developer who has
  not read the code would use — never internal symbol names (that would hand the answer to the
  no-wiki arm and rig it). See `METHODOLOGY.md` §3.
- **Wiki authoring/maintenance cost disclosed, not hidden**: the wiki B2 reads was written and
  is kept fresh at real cost. Report the corpus size (as the proxy harness does) alongside any
  per-query win, so a reader can weigh amortization.
- **N repeats per (task, arm)** to expose variance (agents are stochastic even at temp 0 with
  tools). Report mean + spread, never a single lucky run.
- **Blind grading**: the grader (§4) does not know which arm produced an answer.

## 4. Answer quality (the part the proxy cannot measure)

Locating success (did the agent open the ground-truth files) is necessary but not sufficient —
a real run must grade whether the *answer is correct*. Each task carries a rubric:

- **Ground-truth files** (already in `tasks.json`) — did the answer rest on them?
- **Key claims** — a short checklist per task of facts a correct answer must state (e.g. for
  `type-detection-mobile`: "names `detectMobile`", "explains the Android `build.gradle` →
  library correction"). Authored once, reviewed by a human.
- **Score** — fraction of key claims correct, plus a correctness/hallucination flag.

Grading is a **pluggable seam** (`AnswerGrader` in the prototype): a human, or an LLM-judge
run separately (blind, different model instance). The harness never self-grades silently.

## 5. How to run it (and why the core stays zero-dep)

The zero-dependency invariant applies to the shipped package, not to this repo-internal bench.
Still, `bench/real/` keeps the **structure** dependency-free (Node built-ins only) and puts the
*actual model call* behind a pluggable seam, `AgentRunner`, so:

- The default `AgentRunner` is a **stub that throws** — running the harness without wiring a
  real driver fails loudly. It never fabricates tokens or answers.
- A real run supplies an `AgentRunner` that drives a model with tools. Two supported shapes:
  1. **Claude Agent SDK / Anthropic SDK** script (adds a dev-only dependency *in the runner
     script*, never in the package) that exposes the retrieval tools to the model for arm B2.
  2. **Claude Code itself** as the driver, with the `llm-wiki mcp` server providing the
     retrieval tools for B2 and no wiki for B.
- `--dry` exercises everything except the model call (prompt building, task loading, schema,
  result writing) so the harness is testable and reviewable before spending budget.

Run (once a driver is wired):

```bash
node bench/real/runner.js --dry                 # validate the harness, no model call
node bench/real/runner.js --arm B  --repeats 3  # real run, no-retrieval arm
node bench/real/runner.js --arm B2 --repeats 3  # real run, retrieval arm
# results → bench/results/real-<arm>-<stamp>.json (executed:true only on a real run)
```

## 6. Threats to validity (read before quoting any future number)

1. **Cost & sample size.** Real runs are expensive; a small N has wide variance. State N.
2. **Prompt sensitivity.** How each arm is instructed materially changes tokens. Keep the two
   instructions as symmetric as possible (same task text; only the tools/first-step differ) and
   publish both prompts.
3. **Tool-availability confound.** B2's win could come from *better tools*, not the *wiki
   content*. Mitigation: a third arm (B2-empty-wiki) with the retrieval tools over an empty/
   stub wiki would separate "tooling" from "knowledge" — add it if the headline hinges on B2.
4. **Grader bias.** An LLM-judge can favor verbose answers; use a claim-checklist rubric and a
   human spot-check.
5. **Single, self-referential repo.** Same caveat as the proxy: this repo's mature wiki is not
   a typical project. Cross-repo runs are needed before a general claim.
6. **This is still not production usage.** A benchmark task ≠ a real feature change. The honest
   ceiling of even a good result is "on these tasks, on this repo."

## 7. Honesty stance

Same as `METHODOLOGY.md` §10, restated because this arm is the one that could produce a
publishable number: unfavorable results are reported, not hidden; no token/speed/productivity
claim ships until a **real** measured result supports it, and any such claim must state the
model, N, and whether it rests on the B-vs-B2 or a tooling-controlled comparison.
