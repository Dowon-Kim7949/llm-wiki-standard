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
last_updated: 2026-07-14
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

## Shipped Through 1.0.0

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

## Release Plan (1.1 → 1.7)

### 1.1 — Inner-loop cleanup

Goal: make day-to-day use and CI faster and quieter, and clear one known wart.

- **Fix the `evidence.stale` same-day boundary.** `fileChangedSince` uses
  `git log --since=<date>` (`src/git.js`), which counts commits made on the review
  date, so a doc reviewed the same day its sources were committed shows immediate
  `evidence.stale` warnings (21 observed during 1.0.0 prep). Compare by commit
  timestamp instead of date-inclusive `--since`.
- **`validate --changed`** — a diff-scoped run that validates only documents (and
  their evidence) touched since a git ref, for fast pre-commit and CI.
- **Pre-commit hook template** and a Quick Start command check against the packed
  artifact (the one remaining Phase 7 checklist item).

Why first: small, low-risk, high-frequency payoff; removes a confusing warning
before anyone builds on top of the drift logic.

### 1.2 — Safe upgrades & migration — headline

Goal: make version upgrades safe so adopters never delete-and-regenerate.

- **`wiki_block_version`-aware upgrade report** — show the contract gap between a
  wiki's generation version and the installed CLI.
- **Unblock `migrate --apply` under an accepted scope** — it has been blocked since
  0.1.0 (GATE_REVIEW Gate 4). Give it a pre-decided, preview-first,
  `verified`-preserving scope that reuses the `fix` engine to backfill mechanical
  gaps (missing/renamed required fields, `## Evidence` sections, stale metadata).
- **Opt-in `verified → needs_review` auto-downgrade on drift**, plus line/symbol
  drift granularity (extends `evidence.stale`).

Prerequisite: a new GATE_REVIEW gate decision for the `migrate --apply` scope
before implementation. Why here: this is the top real-usage pain — a maintainer
deleted `docs/llm-wiki` rather than upgrade an early wiki.

### 1.3 — Detect & adapt breadth

Goal: fit more projects and more tools out of the box.

- **Detector depth** — resolve the stdlib-server limitation (Go `net/http`, Flask,
  etc. classify as `library` today) and add PHP (`composer.json`), Ruby
  (`Gemfile`), and .NET (`*.csproj`).
- **More adapters** — Windsurf (`.windsurf/rules`), JetBrains AI, and confirming
  the Gemini/Antigravity contract, reusing the `ADAPTER_TARGETS` pattern.
- **Additive OKF alignment** — accept OKF `type` as an optional alias alongside
  `doc_type` (no removal; the breaking unification stays out of `1.x`).

Why here: low risk, broadens the addressable base, no dependencies.

### 1.4 — Knowledge you can see

Goal: close the "easy knowledge transfer" gap without becoming a site generator.

- **`llm-wiki graph`** — a first-class command that emits the knowledge graph as
  Mermaid, DOT, and JSON.
- **`llm-wiki stats`** — a health score: enrichment %, verified %, evidence
  coverage, and staleness.
- **Bounded reader-friendly publishing** — a short "publish for human readers"
  guide (GitHub rendering; Obsidian, which reads the corpus's `[[links]]` +
  `aliases` natively; MkDocs), and at most a navigable document index added to the
  existing zero-dependency dashboard. Not a static-site generator (see Declined).

Why here: builds on the stable graph/report data; serves non-developer readers and
tech leads.

### 1.5 — Programmatic API

Goal: let CI wrappers, editors, and tests use LLM-WIKI without spawning a process.

- **Documented importable API** — an `exports` map over the command functions with
  stable, typed return shapes.
- **`schemaVersion` in `--format json`** (additive) so wrappers can pin the output
  contract.

Why here: foundation the ecosystem work (1.6) depends on; forces us to freeze the
return-shape contract deliberately.

### 1.6 — Agent-native (MCP)

Goal: let Codex / Claude Code / other agents maintain the wiki natively.

- **MCP server** exposing `validate`, `audit`, `next`, `graph`, and
  `handoff`/`prompt` as tools, so agents query and check the wiki instead of
  shelling out.

Why here: highest agent-first leverage, but depends on the 1.5 API being stable.

### 1.7 — Team & org scale

Goal: support adoption beyond a single repo and a single maintainer.

- **Monorepo profile** — per-package wikis with aggregated validation and graph.
- **Cross-repository knowledge links** — a conservative reference format for API
  specs, domain docs, and service contracts in separate repos.
- **Config schema growth** — custom document sets, per-project rule toggles, and
  template overrides (gated on real usage of the minimal `llm-wiki.config.json`).
- **Visibility governance** — optional enforcement of `internal|restricted|public`.
- **First-class GitHub Action + GitHub Release** — a composite action (one `uses:`
  step) and a GitHub Release generated from the release notes on tag push.

Why last: the largest surface, the most dependencies, and the most in need of real
multi-team feedback before design.

## Unscheduled 1.x Backlog

Additive candidates worth doing but not yet slotted into a release:

- Richer enrichment linting (flag docs with evidence but thin bodies).
- Per-command JSON examples in `help` output for wrapper authors.
- More `prompt --task` presets as real workflows emerge.

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
