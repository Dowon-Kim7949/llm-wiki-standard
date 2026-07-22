---
title: LLM-WIKI Governance Roadmap
tags:
  - llm-wiki
  - roadmap
  - package
  - cli
status: needs_review
doc_type: roadmap
project: llm-wiki-governance
last_updated: 2026-07-21
author: ai-generated
last_edited_by: Claude Code
wiki_block_version: v1
source_files:
  - package.json
  - src/cli.js
  - src/commands.js
  - src/frontmatter-schema.js
  - src/detector.js
  - src/git.js
  - src/config-file.js
  - CHANGELOG.md
related:
  - GATE_REVIEW.md
  - VERIFICATION.md
  - RELEASE_CHECKLIST.md
  - docs/llm-wiki/VERSIONING.md
visibility: internal
contains_sensitive_info: false
---

> Language: [English](./ROADMAP.md) | [한국어](./ROADMAP.ko.md)

# LLM-WIKI Governance Roadmap

This roadmap is forward-looking. Shipped history lives in `CHANGELOG.md`,
`docs/llm-wiki/log.md`, and the per-release notes under
`docs/llm-wiki/releases/`. This document plans the `1.x` minor releases after
the stable `1.0.0` line — one release at a time, in order.

## Product Principle

```text
CLI creates structure and safety rails.
Codex or Claude Code enriches docs from source evidence.
Humans review and approve verified status.
CI continuously checks quality.
```

## Shipped Through 1.7.0

`1.7.0` (this release) is the CI/CD-adoption line — the lead slice of the split
"Team & org scale" plan: a composite GitHub Action
(`.github/actions/validate/action.yml`) wrapping the read-only `validate` via
`npx` (pulls in no other actions, zero-dep, referenced by an exact `vX.Y.Z`
tag/SHA); a GitHub Release on a `v*` tag push from an isolated `contents: write`
job in `publish.yml` built with the runner's `gh` CLI, its body from the new
additive `release-notes --body-only` mode run through the sensitive-info scan
(blocks on a match); and per-command `--format json` examples in `help` for the
ten read-only report commands. Backward-compatible — an additive command mode
plus CI artifacts only. Marketplace publishing and a floating `@v1` tag are
deferred behind a later gate (they need the `v*` tag-namespace deconflict first).
Scope: `GATE_REVIEW.md` (Gate 12).

`1.6.0` is the agent-native line: `llm-wiki mcp` runs a Model
Context Protocol server over stdio so agents (Claude Code, Cursor, other MCP
clients) query and check the wiki as tools instead of shelling out. It exposes
the read-only commands (`validate`/`audit`/`next`/`status`/`doctor`/`stats`/
`graph`/`explain`/`handoff`/`prompt`) as MCP tools — no write command is exposed,
no tool writes files. Hand-rolled JSON-RPC 2.0 on Node built-ins (no third-party
SDK), preserving the zero-runtime-dependency invariant; results reuse the 1.5
result shape (`schemaVersion`). Backward-compatible — a new command and module
only. Scope: `GATE_REVIEW.md` (Gate 11).

`1.5.0` is the programmatic-API line: the package is now
importable in-process via `package.json` `exports` (`src/index.js`), exposing a
frozen `commands` map over the command functions, `normalizeOptions`,
`parseArgs`/`run`, and `SCHEMA_VERSION`, with return shapes documented via JSDoc
typedefs and `PUBLIC_API.md`. `--format json` output gains an additive top-level
`schemaVersion` field so CI wrappers and editors can pin the output contract.
Backward-compatible — a new import surface and one additive JSON field only.

`1.4.0` is the knowledge-you-can-see line: `llm-wiki graph`
(knowledge graph as text/JSON/Mermaid/DOT), `llm-wiki stats` (a health score),
a navigable Document Index in the `--format html` dashboard plus a
publish-for-human-readers guide, and file-based domain detection so route/
resource module files (FastAPI/Flask/Express/Rails/Go endpoints/routers/…) are
detected by `init` alongside directory-per-domain layouts (GATE_REVIEW Gate 10).

`1.3.0` is the detect & adapt breadth line: backend/fullstack
`init` now detects business-domain directories and creates a per-domain document
(`domains/NN_<name>.md`, `doc_type: domain`) linked from the overview; ecosystem
detection for PHP/Ruby/.NET; Windsurf and Gemini CLI writable adapters (JetBrains
AI as an info-level candidate); and OKF `type` accepted as an additive alias for
`doc_type`.

`1.2.0` is the safe upgrades & migration line: a
`wiki_block_version`-aware upgrade report in `migrate`/`doctor`; `migrate --apply`
unblocked under an accepted, preview-first, `verified`-preserving scope
(GATE_REVIEW Gate 8) that reuses the `fix` engine plus block-version stamping; a
new `llm-wiki drift` command whose `--downgrade` moves drifted `verified` docs to
`needs_review` (GATE_REVIEW Gate 9); line-level `evidence.stale` granularity; and
version-agnostic `VERSIONING`/`project-profile` docs.

`1.1.0` added the inner-loop cleanup line: it fixed the `evidence.stale` same-day
drift boundary, added `validate --changed` to scope findings to changed documents,
and shipped a `pre-commit` hook template plus a CI Quick Start check against the
packed tarball. It also folded in the docs work staged earlier as `1.0.1` — the
dateless roadmap replan and the EN–KO doc pairs for `README`, `CHANGELOG`, and
`ROADMAP`.

`1.0.0` declared the CLI command/option surface, `--format json`
output shape, and required frontmatter contract stable. Already in place: the
full command surface (`doctor`, `status`, `next`, `explain`, `validate`,
`validate-frontmatter`, `audit`, `init`, `quickstart`, `migrate` [dry-run only],
`fix`, `handoff`, `prompt`, `release-notes`); conservative-write safety;
multi-ecosystem detection (Node/Python/Go/Rust/JVM); four adapters
(codex/claude/cursor/copilot) plus the Antigravity candidate; the `okf-v0.1`
profile; frontmatter/link/source/evidence/drift validation; the `--format html`
dashboard; and cross-platform release CI. See `CHANGELOG.md` — this roadmap does
not re-list shipped work.

## How This Roadmap Works

- **Every `1.x` release is additive and backward-compatible.** New commands,
  options, adapters, detectors, and *opt-in* behaviors only. Nothing here breaks
  the `1.0.0` contract.
- **One minor at a time, in order.** The order is by leverage, risk, and
  dependency; each release is pulled by need, not by the calendar.
- **No dates.** These releases carry no target dates. Ship quality over schedule —
  slip a release rather than ship it half-verified.
- **Breaking changes are out of scope for `1.x`** and are parked under "Beyond
  the 1.x Horizon" below.

## Release Plan (1.8–1.11) — Team & org scale, split

Goal: support adoption beyond a single repo and a single maintainer.

This line originally read as a single `1.7 — Team & org scale` bundling five
gate-sized, interdependent features (monorepo profile, cross-repository links,
config schema growth, visibility governance, GitHub Action + Release). That is the
largest surface, the most dependencies, and — by its own note — the most in need of
real multi-team feedback before design. Shipping all five as one release
contradicts two of this roadmap's own rules: *one minor at a time, in order* and
*slip a release rather than ship it half-verified* (any one feature slipping would
block the other four). So the line is **split into ordered minors, lowest-risk and
highest-leverage first**, each pulled by need and each recording its scope as a new
`GATE_REVIEW.md` gate (Gate 12 covered the shipped 1.7; the next is Gate 13, for
1.8) *before* code — the same discipline that framed every prior scope decision.

### Enabling prep (additive; no new headline release)

Small backward-compatible patches that unblock the later minors and start
generating the real-usage feedback the big features need. None of these change the
`1.0.0` contract:

**Status:** the first two — config-loading unification and the starter-config
scaffold + `doctor` echo — shipped as **`1.7.2`** (Gate 13 enabling prep). The
design-input docs below remain.

- **Unify config loading below the command layer.** Today `loadProjectConfig` /
  `mergeConfigIntoOptions` (`src/config-file.js`) run only on the CLI path
  (`src/cli.js#main`); the 1.5 programmatic API and the 1.6 MCP surface never merge
  `llm-wiki.config.json` (Gate 11 honest limit). Move the merge into the shared
  entry so all three surfaces resolve the same effective options — otherwise config
  growth bakes an inconsistency into a new stable contract.
- **Scaffold a starter `llm-wiki.config.json`.** `init` / `quickstart` write a
  minimal config (additive, preview-first, `--write` only, never overwriting an
  existing one), and `doctor` echoes the effective merged config. The roadmap gates
  config growth "on real usage of the minimal config," but usage cannot accrue while
  no command ever produces one — this makes the gate's precondition observable.
- **Write the design inputs the later minors depend on, ahead of their code:** the
  missing visibility governance policy doc (a `project-profile` Open Question), a
  monorepo test fixture under `tests/fixtures/`, and the cross-repo reference-format
  spec — each captured as its own accepted `GATE_REVIEW` gate.

### 1.8 — Config schema growth

**Shipped — Gate 13 complete:** all three config features. Per-project rule toggles
(the `rules` map) + the `content.thin_body` opt-in lint in `1.8.0`; custom document
sets (`requiredDocs`) and template overrides (`templates`, with the never-`verified`
guardrail) in `1.8.1`. The severity-consolidation pre-work landed (audited
behavior-preserving, 0 mismatches). Next planned minor: visibility governance (`1.9`).

Extend the pre-reserved `llm-wiki.config.json` seam (unknown keys are already
ignored by design) with **custom document sets, per-project rule toggles, and
template overrides**. This is the hard dependency gate: both monorepo (per-package
config) and visibility governance (a rule toggle) consume it. Pre-work: consolidate
the per-scan inlined severities into one registry so rule toggles are coherent, and
fix a hard guardrail that template overrides can never set `status: verified`. Folds
in richer enrichment linting (`content.thin_body`, warning-level) as a toggleable
rule to dogfood the toggle machinery. Pulled once the scaffolded config has produced
real-world usage to design against.

### 1.9 — Visibility governance

**Shipped in 1.9.0:** two opt-in consistency lints (`visibility.public_sensitive`,
`visibility.declared_mismatch`) reusing the sensitive-info scan, plus the
`docs/llm-wiki/VISIBILITY.md` policy doc (GATE_REVIEW Gate 14). Off by default,
warning-level, read-only; the raw value is never surfaced. Next planned minor: `1.10`.

Opt-in enforcement of the already-required `internal|restricted|public` field via a
config rule toggle — **off by default, warning-level, read-only** — reusing the
sensitive-info scan for a public-vs-content consistency check. Small, and it proves
the 1.8 config design end-to-end on a real feature before the larger monorepo
consumer depends on it. Blocked on the policy doc and its gate; must never become a
default error/blocked rule (that would break the additive invariant).

### 1.10 — Monorepo profile

**Shipped in 1.10.0:** the `monorepo` command detects npm/yarn `workspaces` and
validates each package, aggregating an additive `packages[]` roll-up (GATE_REVIEW
Gate 15). Read-only; single-repo output byte-identical; pnpm/YAML deferred. An
aggregated cross-package graph and deeper globs can follow. Next planned minor: `1.11`.

Per-package wikis with aggregated validation and graph, built as an **opt-in map
over the already cwd-parameterized pipeline** (`audit` / `collectWikiGraph` /
`findMissingDocs`), with a strictly additive `packages[]` JSON shape so single-repo
output stays byte-identical. Now built with config toggles, real CI feedback, and
enrichment signals in hand. Land additive workspace *detection* in `detector.js`
early; defer zero-dep pnpm/YAML workspace parsing honestly (npm/yarn `workspaces`
first).

### 1.11 — Cross-repository knowledge links

**Shipped in 1.11.0 — the 1.7–1.11 line is complete.** A reserved `repo:<name>/<path>`
reference scheme (plus http(s) URLs) is recognized as external in wiki links and
frontmatter references, so cross-repo references stop tripping the missing-target
rules (GATE_REVIEW Gate 16). Recognition only — never fetched or verified.

A conservative, **non-fetching** reference format (a reserved scheme) so cross-repo
references to API specs, domain docs, and service contracts resolve without tripping
the missing-target rules — recognize but never verify (verification would need
network/git and break the zero-dep invariant). Last: the most design-heavy and
feedback-hungry, and it needs monorepo, config growth, and visibility in place
first. A ready-now slice can land earlier — harden the external-reference classifier
so cross-repo `[[..]]` links stop emitting false `wiki_link.missing`.

Why split this way: order is by leverage, risk, and dependency. Each minor stays
independently shippable and verifiable, and the biggest, most feedback-hungry
features (monorepo, cross-repo) come after the cheaper adoption and config work has
put the CLI in front of real multi-team usage.

## Release Plan (1.12–1.14) — Detect & adapt breadth

**Status: complete — `1.12` (mobile, Gate 17), `1.13` (infra/DevOps, Gate 18), and `1.14`
(stdlib-server, Gate 19) all shipped.** The `1.7–1.11` "Team & org scale" line is complete
and shipped (`1.11.1` on npm). This
line extends project
*breadth* — the successor to `1.3`'s PHP/Ruby/.NET work — and follows the same discipline:
one minor at a time, in order, each recording its scope as a new `GATE_REVIEW.md` gate
*before* code (Gate 17 → 18 → 19). These three are largely independent, so they are
sequenced by leverage and risk rather than by hard dependency.

### 1.12 — Mobile profile (Gate 17)

**Shipped in 1.12.0.** A new additive `mobile` project type. Detect Android (`build.gradle`/`build.gradle.kts`/
`settings.gradle` with an Android Gradle Plugin or AndroidX signal, `AndroidManifest.xml`),
Flutter (`pubspec.yaml` with a `flutter:` section), Apple/iOS (`*.xcodeproj`/
`*.xcworkspace`, `Podfile`, `Package.swift` targeting an Apple platform), and React Native
(`package.json` `react-native` dependency), plus a mobile document set. **Leads because it
also fixes a real misclassification** — an Android `build.gradle` is detected today as
`jvm`+`library` (`src/detector.js`). Additive/opt-in (a new detected type and profile docs;
`--type` gains a value); detection uses manifest/file signals and a bounded scan, never a
build tool; zero-dep. Scope: `GATE_REVIEW.md` (Gate 17).

### 1.13 — Infra/DevOps profile (Gate 18)

**Shipped in 1.13.0.** A new additive `infra` project type. Detect `Dockerfile`, Docker Compose, Kubernetes
manifests, Helm charts (`Chart.yaml`), and Terraform (`*.tf`), plus an infra/DevOps
document set. Reuses the exact bounded-detector pattern from Gate 17, so it lands second.
Additive/opt-in; zero-dep (signal-file presence + bounded content sniff, no cluster/
registry/`terraform`/`kubectl`/`helm` access). Scope: `GATE_REVIEW.md` (Gate 18).

### 1.14 — Stdlib-server detection (Gate 19)

**Shipped in 1.14.0 — the 1.12–1.14 detect & adapt breadth line is complete.** Promote the long-standing backlog item (deferred from `1.3`): classify Go `net/http` and
Python stdlib HTTP servers as `backend` instead of `library`, via a bounded,
false-positive-guarded source scan (an HTTP import **plus** a server-start call). The
smallest of the three and last; the only risk is over-classification, so the heuristic
stays conservative and one-directional (promotes `library`→`backend` only, never demotes).
Zero-dep. Scope: `GATE_REVIEW.md` (Gate 19).

## Release Plan (1.15–1.16) — shipped

- **1.15 — Skill generation (Gate 21).** `init`/`quickstart` generate invocable, wiki-grounded
  automation prompts (`feature`/`fix`/`docs-sync`) as a Claude skill, a Cursor rule, and an
  agent-neutral prompt, each injecting the project's domain map. Opt-in, preview-first, never
  overwrites, recognize-don't-run. `1.15.0` shipped it; `1.15.1` added the restart-required note
  (skills load at session start, not hot-reload).
- **1.16 — Rename + governance reposition + English-first output.** Renamed
  `@dowonk-7949/llm-wiki-standard` → `llm-wiki-governance` (unscoped; the `llm-wiki` command is
  unchanged), repositioned as governance for AI-written project docs (OKF-compatible), and flipped
  CLI output English-first (the pasted handoff prompt is fully English; help / quickstart About /
  handoff Next Step lead with English). Additive/presentational — the `1.0.0` command /
  `--format json` / programmatic-API / frontmatter contracts and zero-dep are intact. `1.16.1`
  corrected the npm storefront (README title, `keywords`). No new gate (packaging + presentation).

## Release Plan (post-1.16) — Prove the value, then close the memory loop

An independent product-identity audit (`outputs/audits/product-identity-audit.md`, **Conditional
Go**) found the governance core real and honestly named, but the ultimate value chain — durable
project memory → less rediscovery → fewer tokens / faster, safer work — **unproven**, and two
launch claims had to be walked back (semantic "verification" of prose; MCP "querying" document
bodies). So this line **measures first, then builds the two features that make the memory story
real** — same discipline as before (one gate before code), and each later gate is re-measured with
the Gate 22 harness. Order is: measurement → the highest-leverage governance completion → the
mechanism that makes "project memory" true.

### Gate 22 — Impact measurement (pulled to the front)

Prove (or disprove) the core value before building more. A reproducible, opt-in, zero-dep
benchmark harness runs a representative task **with vs. without** the governed wiki and records
input tokens, source files opened, task success, and wall-clock — with an honest methodology that
counts wiki read + maintenance cost (not just repo-scan tokens), and a recorded baseline. Primarily
a validation track (no shipped contract change; any `bench` helper is a later minor). Results are
reported honestly, **including unfavorable ones**. No token/speed claim ships until a number
supports it. Caveat: the rediscovery-reduction mechanism is completed by retrieval (Gate 24), so
the headline figure is the before/after-retrieval **delta**, not the raw baseline. Scope:
`GATE_REVIEW.md` (Gate 22, accepted).

**Status: harness + baseline shipped.** The `bench/` harness (zero-dep, repo-internal, outside the
npm `files` allowlist) is built and a baseline recorded — see `bench/README.md`,
`bench/METHODOLOGY.md`, and `bench/results/baseline.md` (governance record:
`docs/llm-wiki/BENCHMARK.md`). First read on this repo (6 tasks): across a session the governed wiki
costs **0.59×** the input tokens of whole-file grep (A1) and **0.89×** a conservative snippet-grep
(A2), but **loses on 3 of 6 single tasks** against the conservative floor, and locating success is a
**100%/100% tie** — so the demonstrated benefit here is context size, not findability, and it depends
on amortizing the orientation read across a multi-task session. A modest, honest baseline exactly as
predicted; the headline remains the before/after-retrieval delta (re-run each later gate with
`node bench/run.js --against`).

**Re-measured after Gate 24 (2026-07-21, honest/unfavorable):** a plain `--against` re-run moved
`B vs A2` from 0.89× to **1.05×** (the token win over the conservative snippet-grep floor flipped
negative) — but this tracks **corpus drift, not the retrieval mechanism**: strategy B reads full
targeted *source*, and the harness does not invoke Gate 24's `get_doc`/`search_docs`.

**Retrieval delta measured (2026-07-21):** added a fifth arm, **`B2_retrieval`**, that models Gate 24
directly — it runs the shipped `search-docs` (same scoring) and reads the top matched wiki *doc
bodies* via `get-doc` instead of re-reading source. Because B2 and B run on the **same corpus**,
`B2 vs B` cancels corpus drift and isolates the mechanism: **B2 costs 0.19× of B (−81.5%)** and
**0.19× of the conservative snippet-grep floor A2 (−80.5%)** — the win the pre-retrieval arm B did
*not* have against A2 — with **100% grounding success** (robust at K=1). This is still a deterministic
`chars/4` proxy, not a real LLM run, so **no token/speed claim ships in the README until a real
measurement supports it**. See `bench/results/current.md` and `docs/llm-wiki/BENCHMARK.md`.

### Gate 23 — Changed-source → wiki reverse-impact gate

The biggest vision-vs-reality gap the audit found: today drift is date-based and misses the case
that matters most — code and its doc changing in **separate** places/PRs. Build a git-diff reverse
index from `source_files`/`evidence` so a change that touches referenced code flags the affected
`verified` docs (working-tree / PR-base aware), with a strict-governance preset that can fail
CI on drift. Makes "the wiki keeps up with the code" real and CI-enforceable. Additive/opt-in,
zero-dep. Scope: `GATE_REVIEW.md` (Gate 23, **accepted for 1.17.0**; reuses the existing
`changedFiles`/`verifiedSourceAnchors` primitives, so it is mostly wiring).

**Status: shipped in 1.17.0.** The read-only `impact` command flags a `verified` doc whose
referenced `source_files`/`evidence` is in the current change set (working tree, or `--since
<ref>`) while the doc itself is unchanged in the same diff — the diff-anchored, pre-merge
complement to the date-anchored `evidence.stale`. New toggleable `impact.source_changed`
(default warning); `--strict` escalates it to a failing error for CI; an empty change set is a
no-op. `driftTargets` and `scanReverseImpact` now share a pure `verifiedSourceAnchors`
extractor (behavior-preserving). Release notes: `docs/llm-wiki/releases/v1.17.0.md`.

### Gate 24 — Read-only retrieval (search/get) over MCP + API

Makes the "project memory / the agent queries the wiki" story true (the part walked back at
launch). Add read-only `list_docs` / `search_docs` / `get_doc` / `get_related` with
status/visibility filters, over MCP and the programmatic API — returning document content, not just
governance reports. **Re-measure here** — this is where the rediscovery/token delta should show.
Additive/opt-in, zero-dep.

**Status: shipped in 1.18.0.** Four read-only ops — `list-docs`, `search-docs` (**zero-dep
keyword/substring, NOT semantic**), `get-doc`, `get-related` (MCP tools `list_docs`/`search_docs`/
`get_doc`/`get_related`) — return document content on the programmatic API + MCP + CLI, reusing
`listWikiContentDocs`, the frontmatter parser, `collectWikiGraph`, and the sensitive-info scan. Read-only;
restricted/sensitive docs are excluded from list/search by default (opt-in `--include-sensitive`) and
returned bodies/snippets redact sensitive lines (raw values never returned). `src/commands/retrieval.js`.
Release notes: `docs/llm-wiki/releases/v1.18.0.md`. **Re-measure the Gate 22 bench here** for the
headline before/after-retrieval delta (`node bench/run.js --against`).

### Gate 25 — Evidence semantic tiers — **accepted + built (2026-07-21)**

Close the credibility gap the audit demonstrated (a doc citing a non-existent symbol passes today).
Distinguish `reference_checked` from `human_verified`, actually check symbol/section existence, and
flag an empty-evidence `verified` doc. Additive/opt-in, zero-dep.

**Built (ships in the next minor):** `scanEvidenceReferences` now checks `#symbol:`/`#section:`
target existence conservatively (`evidence.symbol_unverified`/`evidence.section_unverified` — flagged
only when the file mentions none of the name(s); `.md`-only sections; `--strict` escalates);
`scanUngroundedVerified` flags a `verified` doc with no `source_files` and no `evidence`
(`evidence.ungrounded`, warning, config-togglable); and a computed `evidenceTier`
(`reference_checked` vs `human_verified`) is exposed additively in `stats` JSON — no new frontmatter
field or `status` value. True AST/language-server symbol resolution and `route` existence stay out of
scope v1 (would break zero-dep). 251 tests, `validate --strict` 0 findings (dogfood: 50/50
reference_checked, 14/50 human_verified). Scope: `GATE_REVIEW.md` (Gate 25, accepted).

### Gate 26 — Agent update runner + completion contract

The self-evolving-workflow piece: a skill run leaves a structured manifest (changed code, affected
docs, log update, validation) that CI can check for missing wiki updates — the agent still writes
the prose, but the pipeline is enforced. Larger and fuzzier; last. (New gate before code.)

### P3 adoption barriers (folded in)

Brownfield fit (existing large doc sets) and the Node-runtime hurdle for non-JS teams are
cross-cutting concerns addressed within the gates above (especially 23/24) rather than as separate
features, and revisited once measurement (Gate 22) shows where adoption actually stalls.

## Unscheduled 1.x Backlog

Additive candidates worth doing but not yet slotted into a release:

- More `prompt --task` presets as real workflows emerge.

Promoted into the release plan above: stdlib-server detection (→ 1.14, Gate 19).

Shipped in 1.7.0: per-command JSON `help` examples. Promoted into the release plan
above: richer enrichment linting (→ 1.8, as a toggleable `content.thin_body` rule).

## Beyond the 1.x Horizon (not planned now)

Changes that would break the `1.0.0` contract and therefore need a future major
version. Recorded so they are not lost — **not scheduled, pulled only by real
need**:

- Frontmatter contract cleanup: retire the redundant `verified` tag (status
  already carries it) and unify `doc_type` into OKF `type` (removing the alias).
- Flipping defaults: making `content.not_enriched` / `related.missing` errors, or
  making drift auto-downgrade the default rather than opt-in.

## Explicitly Declined or Deferred (current judgment)

- **A full Markdown → HTML static-site generator / renderer in core: declined.** It
  collides with the zero-runtime-dependency invariant, invites scope creep into
  MkDocs/Docusaurus territory, and the ecosystem already renders a Markdown-in-git
  corpus better. The bounded publish guide + dashboard index (1.4) covers the goal
  cheaply.
- **Fully automatic raw-text → OKF extraction: deferred.** Keep it prompt-assisted
  (`okf-extract`); automatic entity/event extraction contradicts the human-review
  model.
- **Hard-requiring `owner` on every document: declined.** It would flood existing
  repos with errors and fights incremental adoption.
- **Auto-promotion to `verified`: never.** `verified` stays human-only in every
  command, including the migration engine.
- **A Notion-native mode: not planned.** Notion needs a lossy import; if demand
  appears, treat it as a one-way downstream Markdown → Notion mirror, not a core
  feature.

## Release Plan (post-1.19) — Reactive DX from external usage

Driven by QA/DX feedback from building an LLM-WIKI on a real Vue/Quasar SPA. Additive,
zero-dependency, backend/fullstack byte-identical.

- **1.20 — Frontend DX + evidence DX + retrieval.** Shipped to main (pending npm publish):
  frontend/mobile (SPA) domain detection (`pages`/`views`/`features`/`modules`/`screens`
  folders + vue/react-router route groups, regex-only), `get-doc --section` focused read,
  `search-docs` change-log deprioritization, and `evidence.section_unlisted` path-based
  matching (locator-format tolerant).
- **Candidates (not yet built):** an explicit message when a forced `--type` finds no domains
  (plus an optional `--domains`); KO localization of findings messages; a per-document
  enrichment checklist in `next`/`handoff`; auto-linking new domain docs to avoid orphans;
  snapshot tests + documentation of the detection / `not_enriched` heuristics.

## Non-Goals (unchanged safety ethos)

- No writes without an explicit `--write` / `--apply`; preview-first everywhere.
- Never overwrite `log.md` or existing adapter files; never write raw sensitive
  values.
- No runtime third-party dependencies in the core CLI.
- AI- or CLI-authored docs stay `needs_review` until a human verifies.
