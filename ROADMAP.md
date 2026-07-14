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

## Shipped Through 1.6.0

`1.6.0` (this release) is the agent-native line: `llm-wiki mcp` runs a Model
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

## Release Plan (1.7)

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
- Stdlib-server detection — classify Go `net/http` / Python stdlib HTTP servers as
  `backend` instead of `library` (deferred from `1.3`: reliable detection needs
  source scanning and risks false positives, so it needs a bounded heuristic).

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
