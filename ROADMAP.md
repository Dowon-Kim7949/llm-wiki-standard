---
title: LLM-WIKI Standard Roadmap
tags:
  - llm-wiki
  - roadmap
  - package
  - cli
status: needs_review
doc_type: roadmap
project: llm-wiki-standard
last_updated: 2026-07-15
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

# LLM-WIKI Standard Roadmap

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

**Shipped in 1.8.0:** per-project rule toggles (the `rules` map) and the
`content.thin_body` opt-in lint; the severity-consolidation pre-work landed
(audited behavior-preserving, 0 mismatches). Remaining for `1.8.x`: custom document
sets and template overrides (with the never-`verified` guardrail).

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

Opt-in enforcement of the already-required `internal|restricted|public` field via a
config rule toggle — **off by default, warning-level, read-only** — reusing the
sensitive-info scan for a public-vs-content consistency check. Small, and it proves
the 1.8 config design end-to-end on a real feature before the larger monorepo
consumer depends on it. Blocked on the policy doc and its gate; must never become a
default error/blocked rule (that would break the additive invariant).

### 1.10 — Monorepo profile

Per-package wikis with aggregated validation and graph, built as an **opt-in map
over the already cwd-parameterized pipeline** (`audit` / `collectWikiGraph` /
`findMissingDocs`), with a strictly additive `packages[]` JSON shape so single-repo
output stays byte-identical. Now built with config toggles, real CI feedback, and
enrichment signals in hand. Land additive workspace *detection* in `detector.js`
early; defer zero-dep pnpm/YAML workspace parsing honestly (npm/yarn `workspaces`
first).

### 1.11 — Cross-repository knowledge links

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

## Unscheduled 1.x Backlog

Additive candidates worth doing but not yet slotted into a release:

- More `prompt --task` presets as real workflows emerge.
- Stdlib-server detection — classify Go `net/http` / Python stdlib HTTP servers as
  `backend` instead of `library` (deferred from `1.3`: reliable detection needs
  source scanning and risks false positives, so it needs a bounded heuristic).

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

## Non-Goals (unchanged safety ethos)

- No writes without an explicit `--write` / `--apply`; preview-first everywhere.
- Never overwrite `log.md` or existing adapter files; never write raw sensitive
  values.
- No runtime third-party dependencies in the core CLI.
- AI- or CLI-authored docs stay `needs_review` until a human verifies.
