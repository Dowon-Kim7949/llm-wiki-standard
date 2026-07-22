# Real-driver PILOT — external project `csap-roadkeeper-frontend` @ `aws-global` (2026-07-22)

> **Real tokens + wall-clock, N=1. NOT yet a publishable claim (needs N≥3), but the first
> FAVORABLE token signal for retrieval — and it surfaces a decisive correctness caveat.**
> Driver: isolated **Claude Code Explore subagents** (Opus 4.8), one fresh context per
> (task, arm), per `../real/DRIVER_RUNBOOK.md`. The Agent framework reports each subagent's
> total tokens + wall-clock automatically. Target is an EXTERNAL, representative consumer
> project (Vue 3 / Quasar / TS), not this dogfood repo — chosen because the earlier self-repo
> pilot was unfavorable and diagnosed our own docs as atypically mega-sectioned.
>
> **Read-only run: no commit/push/edit was made to the `csap-roadkeeper-frontend` repo.**
>
> Caveats: N=1; arms are Explore subagents driving retrieval via the **CLI**
> (`search-docs`/`get-doc`, full-doc bodies), not the interactive product's MCP tools; tokens
> are a **single total** (not input/output split). The target wiki was built with
> `llm-wiki-governance@1.19.0`, is **0% verified** (all `needs_review`), and `validate` reports
> **2 stale `source_files`** — i.e. a realistic, mildly-drifted wiki.

## Per-task (real tokens + wall-clock + tool calls + graded correctness)

| Task | B tok | B2 tok | B2/B tok | B ms | B2 ms | B calls | B2 calls | B ok | B2 ok | B2 wiki-only |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| auth-signin | 40,477 | 27,578 | **0.68×** | 59,886 | 43,339 | 8 | 7 | ✓ | **✗** | yes |
| routing-map | 25,343 | 24,876 | 0.98× | 41,166 | 44,378 | 5 | 6 | ✓ | ✓ | yes |
| api-layer | 38,160 | 30,794 | 0.81× | 65,228 | 55,453 | 12 | 8 | ✓ | ✓* | yes |
| hazard-domain | 34,432 | 38,522 | 1.12× | 49,772 | 137,895 | 6 | 18 | ✓ | ✓ | no (fell back) |
| session-timeout | 34,452 | 27,417 | 0.80× | 68,747 | 53,607 | 9 | 8 | ✓ | ✓ | yes |
| state-mgmt | 31,459 | 20,136 | 0.64× | 61,962 | 31,954 | 11 | 3 | ✓ | ✓ | yes |
| **sum** | **204,323** | **169,323** | **0.83×** | **346,761** | **366,626** | **51** | **50** | **6/6** | **5/6** | **5/6** |

`*` api-layer B2's core answer (base URL config + cookie-session auth) is correct, but it
carried the same stale "plaintext password" side-remark from the auth doc (see below).

## Deltas (B2 retrieval relative to B source-only)

- **Total tokens: 0.83× (B2 −17%).** B2 was cheaper on **5 of 6** tasks (auth, api, session,
  state clearly; routing ≈ tie). The one loss (hazard, 1.12×) is a stale-doc source-fallback.
- **Wall-clock: 1.06× (B2 +6%) overall — but entirely the hazard outlier (2.77×).** On the
  other 5 tasks B2 was faster (median ≈ 0.78×). Drop hazard and B2 is faster overall too.
- **Tool calls: 50 vs 51 — a tie** (hazard B2's 18-call fallback offsets big savings elsewhere,
  e.g. state 3 vs 11).
- **Source-avoidance: B2 answered from the wiki alone on 5/6** (opened zero source files).
- **Correctness: B 6/6; B2 5/6.**

## Honest read

1. **On a representative external project with a well-scoped wiki, retrieval IS token-cheaper
   (−17%) and mostly faster.** This is the OPPOSITE of the self-repo pilot (+24% tokens),
   and it confirms the diagnosis: retrieval wins when the wiki's docs are small, per-domain,
   and answer the question directly — csap's `domains/07_auth_and_account.md`,
   `domains/01_hazards.md`, etc. are exactly that. Our own repo's mega-sectioned reference docs
   were the anomaly, not retrieval.
2. **BUT correctness is gated on wiki FRESHNESS, and this wiki is stale — so retrieval produced
   a security-critical WRONG answer.** On `auth-signin`, B (source) correctly found that the
   password is **RSA-OAEP encrypted client-side** (`LoginPage.vue:188-201` → `getPublicKey`
   `/api/v2/auth/enc/session` → `encryptRSA`, `crypto.ts` RSA-OAEP/SHA-256). B2 (wiki) confidently
   answered **"plaintext, no client-side encryption"** — because the 1.19-built wiki
   (`07_auth_and_account.md`) still describes an earlier code state. The stale claim even
   propagated into `api-layer` B2 as a side-remark. A stale, unverified wiki did not just fail
   to help — it actively **misled**, which is worse than reading source.
3. **A second drift forced a source fallback.** On `hazard-domain`, the wiki still names
   `OverallHazardsPage.vue` at `/hazards`, but the code was refactored to List/Map pages at
   `/hazards_list`. B2 had to fall back to source to stay correct, costing MORE tokens/time than
   B. This is the same drift `validate` already flags as `source_files.missing`.
4. **Both failures trace to the wiki being 1.19-built, 0% verified, and drifted** — exactly the
   condition this product's governance (human-`verified`, `evidence.stale`/`drift`/`impact`,
   `validate --changed` in CI) exists to prevent. The pilot is therefore evidence FOR the
   governance thesis: retrieval's efficiency is real, but its trustworthiness is only as good as
   the wiki's verification + freshness discipline.

## What this does and does not support

- **Does NOT yet support a README token/speed claim.** N=1; per-task variance is large
  (`DRIVER_RUNBOOK.md` §6 requires N≥3 + mean/spread). The −17% is one favorable draw.
- **Does support running the full N≥3 protocol on this target** — the mechanism, capture, and
  the B/B2 arms all work, and the N=1 signal is favorable, so a full run is worth its cost.
- **Strongly suggests the headline should pair efficiency WITH freshness.** The honest,
  defensible framing this pilot supports is: *"on a verified, current wiki, an agent answers
  code questions from ~1 doc instead of re-scanning source (−17% tokens here, N=1); on a stale
  wiki it can be confidently wrong — which is why verification + drift-detection are the point."*

## Recommended next steps (pre-claim)

1. **Re-sync + human-verify the two drifted csap docs** (auth encryption, hazard page/route),
   then re-run — to measure retrieval against a *current* wiki (the intended condition), and to
   check whether B2 then matches B on correctness.
2. **N≥3 full run** on this target for mean ± spread; label model (Opus 4.8) and N.
3. Optionally add the **B2-over-empty-wiki** third arm (`DRIVER_RUNBOOK.md` threat #3) to
   separate the retrieval TOOL from the wiki CONTENT.

## Raw usage (per subagent)

- auth: B 40,477 tok / 8 calls / 59.9s (source: RSA-OAEP, correct) · B2 27,578 / 7 / 43.3s
  (wiki `07_auth`+`E2E`; WRONG: plaintext)
- routing: B 25,343 / 5 / 41.2s (routes.ts, index.ts) · B2 24,876 / 6 / 44.4s (wiki
  `ARCHITECTURE`+`profiles/frontend`)
- api: B 38,160 / 12 / 65.2s (axiosInstance, index.ts, .env*, quasar.config, default.conf) · B2
  30,794 / 8 / 55.5s (wiki `ARCHITECTURE`+`project-profile`+`07_auth`; carried stale plaintext
  side-remark)
- hazard: B 34,432 / 6 / 49.8s (List page + HazardStore + api + SearchStore) · B2 38,522 / 18 /
  137.9s (wiki `01_hazards` then source fallback — wiki page/route names stale)
- session: B 34,452 / 9 / 68.7s (useSessionTimeout, axiosInstance, MainLayout) · B2 27,417 / 8 /
  53.6s (wiki `07_auth`+`ARCHITECTURE`)
- state: B 31,459 / 11 / 62.0s (UserStore, LoginPage, sessionstorage) · B2 20,136 / 3 / 32.0s
  (wiki `07_auth`)

## Fresh-wiki re-run (de-drifted copy, N=1) — 2026-07-22

The two drift incidents above were traced to a **1.19-built, 0%-verified wiki**. To measure
retrieval against the INTENDED condition (a current wiki), the wiki was copied to a scratch dir
and the two drifted docs were corrected to match current `aws-global` source — auth
(`07_auth_and_account.md`) now states the **RSA-OAEP client encryption** flow (`getPublicKey`
`/api/v2/auth/enc/session` → `encryptRSA` → `/api/v2/auth/login`), and hazard (`01_hazards.md`,
plus `E2E_WORKFLOWS.md`/`DOMAIN_FEATURES.md`/`00_overview.md` refs) now names the real
List/Map pages (`OverallHazardsListPage.vue`/`…MapPage.vue` at `/hazards_list`/`/hazards_map`).
**The `csap-roadkeeper-frontend` repo itself was NOT modified — all edits were in a scratch copy;
csap's working tree is byte-identical and no git op ran against it.** B2 queried the corrected
wiki via `--cwd <scratch>`; source fallback (if any) still read the real csap source.

| Task | B (pilot, source) | B2 stale | **B2 fresh** | fresh B2/B | fresh correct | fresh wiki-only |
| --- | --- | --- | --- | --- | --- | --- |
| auth-signin | 40,477 | 27,578 ✗ | 27,911 | 0.69× | ✓ (RSA-OAEP) | yes |
| routing-map | 25,343 | 24,876 | 26,933 | 1.06× | ✓ | yes |
| api-layer | 38,160 | 30,794 | 31,455 | 0.82× | ✓ (no stale remark) | yes |
| hazard-domain | 34,432 | 38,522 (fallback) | 23,045 | 0.67× | ✓ | yes |
| session-timeout | 34,452 | 27,417 | 27,481 | 0.80× | ✓ | yes |
| state-mgmt | 31,459 | 20,136 | 28,933 | 0.92× | ✓ | yes |
| **sum** | **204,323** | 169,323 | **165,758** | **0.81×** | **6/6** | **6/6** |

Wall-clock (fresh B2 sum) 277,642 ms vs B 346,761 ms = **0.80×**; the pilot's hazard outlier
(137.9s, stale-doc fallback) collapsed to **32.2s** once the doc was current.

**Result: on a current (de-drifted) wiki, retrieval is BOTH cheaper (−19% tokens, −20%
wall-clock) AND fully correct (6/6, zero source fallbacks).** The two stale-wiki failures — the
security-critical auth answer and the hazard fallback — were entirely freshness-driven and both
vanished when the docs were re-synced. This is the cleanest evidence yet for the product's core
thesis: retrieval's efficiency is real, and its trustworthiness is delivered by verification +
drift-freshness (exactly what `verified`/`evidence.stale`/`impact`/`validate --changed` enforce).

**Still N=1 (per arm, per condition).** A README token/speed claim needs the `DRIVER_RUNBOOK.md`
§6 bar (N≥3 + mean/spread, model-labeled). What N=1-stale + N=1-fresh already support, honestly,
is the qualitative finding above (efficiency + freshness-gated correctness), not a headline
percentage. N≥3 remains the next step for a quotable number.

## Full N=3 (both arms, current wiki) — 2026-07-22 (Opus 4.8)

Completed the `DRIVER_RUNBOOK.md` §6 bar: **N=3 per (task, arm)**, both arms, on the de-drifted
(current) wiki. B = source-only (wiki-independent; r1 reuses the pilot B run). B2 = retrieval over
the corrected scratch-copy wiki. Model: Claude Code Explore subagents, **Opus 4.8**. Single total
tokens (no input/output split). csap repo never modified.

| Task | B mean tok | B2 mean tok | B2/B | B mean ms | B2 mean ms | correct (B/B2) |
| --- | --- | --- | --- | --- | --- | --- |
| auth-signin | 36,304 | 27,664 | **0.76×** | 56,900 | 51,562 | ✓/✓ |
| routing-map | 22,459 | 26,248 | **1.17×** | 37,987 | 45,939 | ✓/✓ |
| api-layer | 32,915 | 32,473 | 0.99× | 49,334 | 60,781 | ✓/✓ |
| hazard-domain | 34,090 | 22,816 | **0.67×** | 45,506 | 32,210 | ✓/✓ |
| session-timeout | 29,017 | 28,086 | 0.97× | 61,731 | 51,585 | ✓/✓ |
| state-mgmt | 30,111 | 28,705 | 0.95× | 54,040 | 49,049 | ✓/✓ |
| **overall** | **184,896** | **165,992** | **0.90×** | **305,498** | **291,126** | **18/18 · 18/18** |

- **Tokens: B2 = 0.90× of B (−10%), mean over N=3.** (The N=1-fresh snapshot read −19%; N=3
  revealed B's variance — r1's B run was high — so the honest mean is −10%. This is exactly why
  §6 requires N≥3.)
- **Wall-clock: 0.95× (−5%).**
- **Correctness: 18/18 tie**, and **B2 answered all 18 from the wiki alone (0 source fallbacks).**
- **Task-dependent:** retrieval wins where the answer is spread across many source files
  (auth 0.76×, hazard 0.67×) and LOSES where the source is 1–2 small files (routing 1.17×:
  `routes.ts`+`index.ts` are cheap to read, cheaper than pulling a wiki doc). api/session/state ≈ tie.
- **Variance:** B2 is markedly more consistent than B (e.g. hazard B2 22.7–23.0k across 3 reps vs
  B's wider spreads), because source exploration varies more than wiki retrieval — retrieval cost
  is more predictable.

### What this supports (honest)

1. **Primary, robust finding:** on a **current** wiki, retrieval answers code-comprehension
   questions at **equal correctness (18/18) without reading source**, at **−10% tokens / −5%
   wall-clock** (N=3, Opus 4.8, this repo). The efficiency is real but **modest and
   task-dependent**, not a dramatic headline.
2. **The decisive value is correctness-under-freshness, not raw tokens.** The stale-wiki pilot
   produced a security-critical WRONG answer (plaintext vs RSA-OAEP); de-drifting the two stale
   docs restored 18/18. Retrieval is only as trustworthy as the wiki is current/verified — which
   is precisely what `verified` review, `evidence.stale`/`impact`, and `validate --changed` in CI
   exist to guarantee.
3. **README claim guidance:** a bold token/speed headline is still NOT warranted — the mean is
   −10% with one task at +17%, single-agent, single-repo, total-token proxy. A defensible,
   honestly-scoped statement is: *"in an N=3 benchmark on an external Vue project (Claude Opus
   4.8), querying a current wiki answered code questions at equal correctness while reading no
   source, using ~10% fewer tokens (task-dependent) — and a stale wiki instead produced a wrong
   answer, which is why verification + drift-freshness are the point."* Keep the number scoped;
   lead with correctness-at-equal + freshness, not the percentage.

### Out of scope / caveats (unchanged)
Total tokens (not input/output split); Explore-subagent + CLI `get-doc` path (not the product's
MCP tools); 6 tasks, one repo, one model; the honest ceiling is "these tasks, this repo, this
agent." A cross-agent run (e.g. a GPT-family agent) and the SDK path (input/output split) remain
the further-rigor options.
