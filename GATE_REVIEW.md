---
title: LLM-WIKI Standard Package Gate Review
tags:
  - llm-wiki
  - package
  - gate-review
  - stable
status: needs_review
doc_type: gate_review
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
  - tests/verification.test.js
related:
  - README.md
  - VERIFICATION.md
  - RELEASE_CHECKLIST.md
visibility: internal
contains_sensitive_info: false
---

# LLM-WIKI Standard Package Gate Review

This document records the default decisions for the `0.1.0` stable release line and the `1.0.0` stability milestone.

## Review Status

| Gate | Status | Decision |
| --- | --- | --- |
| Gate 2 Standard Model Approval | `accepted_for_0.1.0` | Keep the current frontmatter/status model; CLI-created or CLI-edited docs remain `needs_review` until human review. |
| Gate 3 CLI and Adapter Approval | `accepted_for_0.1.0` | Keep `doctor`, `validate`, `validate-frontmatter`, `audit`, `init --dry-run`, `init --write`, and `migrate --dry-run`. Adapter checks remain opt-in with `--agent`. |
| Gate 4 Migration Policy Approval | `accepted_for_0.1.0` | Keep `migrate --apply` blocked for the stable release. Regeneration is available through explicit `init --write --existing overwrite`. |
| Gate 5 Implementation Approval | `accepted_for_0.1.0` | Ship `@dowonk-7949/llm-wiki-standard@0.1.0` as the first stable npmjs release candidate. |
| Gate 6 Autofix (`--fix`) Scope Approval | `accepted_for_0.1.8` | Ship a scoped `llm-wiki fix` command (default preview, `--write` applies) limited to the safe remediations in "Autofix (`--fix`) Scope Decision" below. Content-bearing fixes never touch `verified` documents, and nothing outside `docs/llm-wiki/` is written. |
| Gate 7 1.0.0 Stability Approval | `accepted_for_1.0.0` | Promote the `0.1.8` contract to a stable `1.0.0` with no functional command changes. Declare the CLI command/option surface, `--format json` output shape, and required frontmatter contract stable; breaking changes to these now require a major version bump. See "1.0.0 Stability Milestone" below. |
| Gate 8 Migration Apply Scope Approval | `accepted_for_1.2.0` | Unblock `migrate --apply` for the `1.2.0` line under a pre-decided, preview-first, `verified`-preserving scope that reuses the accepted `fix` engine (Gate 6) plus `wiki_block_version` stamping. Revisits Gate 4's block for the `1.x` line. Accepted by WoongHwan-Kim on 2026-07-14; the rename map ships empty (`v1` is the only block version). See "Migration Apply Scope Decision" below. |
| Gate 9 Drift Downgrade Scope Approval | `accepted_for_1.2.0` | Add an opt-in `llm-wiki drift` command: report-only by default, `--downgrade` flips drifted `verified` documents to `needs_review` and refreshes `last_updated`, nothing else. It never promotes to `verified` and never edits other content. Accepted by WoongHwan-Kim on 2026-07-14. See "Drift Downgrade Scope Decision" below. |
| Gate 10 Domain Detection Scope Approval | `accepted` | Expand backend/fullstack `init` domain detection to cover BOTH directory-per-domain (`domains/domain/modules/features`) and file-per-domain route/resource modules (`endpoints/routers/routes/resources/controllers/handlers`), via a bounded, exclusion-guarded project scan tuned for near-zero false positives. Accepted by WoongHwan-Kim on 2026-07-14. See "Domain Detection Scope Decision" below. |
| Gate 11 MCP Tool Surface Scope Approval | `accepted_for_1.6.0` | Add a `llm-wiki mcp` command that runs a Model Context Protocol server over stdio, exposing only the READ-ONLY commands as MCP tools. Hand-rolled JSON-RPC 2.0 on Node built-ins (no third-party SDK), preserving the zero-runtime-dependency invariant. No write/mutating command is exposed; results reuse the 1.5 result shape (`schemaVersion`) as `structuredContent`. See "MCP Tool Surface Scope Decision" below. |

## 1.0.0 Stability Milestone

`1.0.0` is a stability declaration, not a feature release. It ships the exact command surface accepted through Gates 2–6 with no functional command changes, and commits to the following stable contract:

- **Command/option surface** — the public commands and their accepted options (`src/cli.js`) are stable. Removing or renaming a command or option, or changing its accepted values, is a breaking change requiring a major bump.
- **JSON output shape** — `--format json` field names and structure (`result`, `findings`, `findingSummary`, `wikiGraph`, `documentStatus`) are stable enough for CI and wrappers to depend on.
- **Required frontmatter contract** — the Tier A / Tier B required fields, `status` enum, and validation rules (`src/frontmatter-schema.js`, `rules/frontmatter.schema.json`) are stable.

Conservative-write guarantees are unchanged: `init` / `quickstart` / `fix` write only under `--write`, `migrate --apply` stays blocked, `log.md` and existing adapter files are never overwritten, and CLI- or agent-authored docs remain `needs_review`. Post-1.0 semantics follow SemVer: breaking contract changes bump major, additive commands/options bump minor, and fixes plus new warning-level rules bump patch (see `docs/llm-wiki/VERSIONING.md`).

## Stable Decisions

| Area | Decision | Reason |
| --- | --- | --- |
| Release level | Publish as stable `0.1.0`. | The package has a small, explicit command surface and conservative write policy. |
| Distribution path | Publish through the public npm registry. | npm, npx, and yarn consumers can install without GitHub Packages authentication. |
| Existing docs | Keep by default; rewrite only with `--existing overwrite`. | Existing project knowledge should not be erased accidentally. |
| Uninitialized wiki | Report one confirmation-oriented warning when `docs/llm-wiki/index.md` is missing. | Agents should ask whether to proceed or initialize LLM-WIKI instead of flooding the user with document-level warnings. |
| Append-only log | Never overwrite `docs/llm-wiki/log.md`. | The log is historical evidence. |
| Adapter files | Never overwrite existing adapter files. | Teams often keep local tool policy there. |
| Antigravity | Keep `ANTIGRAVITY.md` as an info-level candidate. | The loading contract is still tool-dependent. |
| Migration apply | Keep blocked. | Automatic migration writes need a separate accepted scope. |
| Autofix (`fix`) | Ship as a scoped `fix` command (default preview, `--write` applies) limited to the accepted scope below. | Autofix writes are safe only when the exact set of touched fields, files, and refusals is pre-decided, mirroring the caution used for the still-blocked `migrate --apply`. |
| CI default | Use `llm-wiki validate`; add `--strict` when teams want warnings to fail. | This lets existing repositories adopt the standard incrementally. |

## Current Implementation Scope

Implemented commands:

- `llm-wiki doctor`
- `llm-wiki validate`
- `llm-wiki validate-frontmatter`
- `llm-wiki audit`
- `llm-wiki init --dry-run`
- `llm-wiki init --write`
- `llm-wiki migrate --dry-run`

Implemented safety behavior:

- `init` writes only when `--write` is explicit.
- Existing wiki docs are skipped unless `--existing overwrite` is explicit.
- A missing `docs/llm-wiki/index.md` is reported as one `structure.wiki_missing` finding before document-level checks run.
- `docs/llm-wiki/log.md` and existing adapter files are never overwritten.
- `--agent` opts into Codex, Claude Code, or Antigravity adapter checks.
- `--agent all` expands to Codex, Claude Code, and Antigravity.
- Markdown and reports are written as UTF-8.
- Sensitive-looking raw values are redacted from findings and blocked before report writes.

## Autofix (`--fix`) Scope Decision

Accepted for the `0.1.8` line. `llm-wiki fix` applies only the safest, mechanically decidable remediations. It follows the same conservative model as the blocked `migrate --apply`: the exact set of touched fields, created files, and refusals is fixed in advance, and anything requiring real project knowledge is reported, never invented.

### Command surface

- `llm-wiki fix` — preview only (dry run). Lists planned fixes and skips; writes nothing.
- `llm-wiki fix --write` — applies the planned fixes.
- `--dry-run` is accepted as an explicit alias of the default preview. `--dry-run` and `--write` cannot be combined.

### May change (only under `docs/llm-wiki/`, only on non-`verified` documents)

| Finding | Autofix action |
| --- | --- |
| `frontmatter.required` (Tier A fields only) | Insert the missing required field with a safe mechanical default. |
| `evidence.section_missing` | Append a body `## Evidence` section whose bullets echo the existing frontmatter `evidence` entries. |
| `evidence.section_empty` | Add bullets to the empty `## Evidence` section (frontmatter `evidence` entries, or one placeholder bullet if none exist). |
| `evidence.section_unlisted` | Append the missing frontmatter `evidence` entries as bullets to the existing `## Evidence` section. |
| `related.missing` / `markdown_link.missing` | Create a `needs_review` stub at the broken target (see stub conditions). |
| `last_updated` freshness | Refresh `last_updated` to the current date, **only on documents this run actually modifies** (never a blanket touch). |

**Tier A required fields (auto-filled with mechanical defaults):** `status`=`needs_review`, `visibility`=`internal`, `contains_sensitive_info`=`false`, `wiki_block_version`=`v1`, `last_updated`=today, `last_edited_by`=`llm-wiki-cli`, and empty lists for `tags`, `source_files`, `related`.

**Broken-link stub conditions:** a stub is created only when the target is inside `docs/llm-wiki/`, ends in `.md`, does not already exist, and is neither `log.md` nor an adapter file. The stub carries valid `needs_review` frontmatter with an empty evidence set and a title derived from the filename. Creating a stub is a new-file write; it never edits the referencing document.

### Must not change (reported only, never auto-fixed)

- **Tier B meaning-bearing required fields** — `title`, `doc_type`, `project`, `author`. These cannot be filled truthfully by a tool, so a missing one is reported for a human.
- **`source_files` / `evidence` reference values** — `source_files.missing`, `evidence.missing`, `evidence.line_range`, `evidence.shape`. A wrong or missing path is a real problem a human must resolve; the tool never invents or rewrites paths.
- **`content.not_enriched`** — enrichment requires real source-backed knowledge.
- **`evidence.stale` and document `status`** — `fix` never promotes to `verified` and never auto-downgrades `verified` → `needs_review`; automatic downgrade is deferred to the separate line/symbol drift work (ROADMAP Post-0.1.7 item 2). `verified` documents are skipped entirely for content edits.
- **Anything outside `docs/llm-wiki/`**, plus `docs/llm-wiki/log.md` (append-only) and adapter files.
- **Encoding/sensitive risks** — files with mojibake indicators are never rewritten, and any fix whose resulting content matches sensitive-info rules is blocked, mirroring `init --write`.

### Guarantees

- Idempotent: a second `fix --write` with no intervening changes writes nothing.
- All created or edited documents remain `needs_review`.
- UTF-8 read/write throughout; edits are minimal targeted insertions rather than full-document rewrites, since the frontmatter layer parses but does not re-serialize.

## Migration Apply Scope Decision (accepted for 1.2.0)

Accepted for the `1.2.0` line (WoongHwan-Kim, 2026-07-14). Gate 8 revisits
Gate 4: `migrate --apply` has been blocked since `0.1.0` because automatic
migration writes needed a separately accepted scope. This decision grants that
scope by **reusing the accepted `fix` engine** (Gate 6) under a
`wiki_block_version` upgrade framing. `migrate --apply` is unblocked for `1.2.0`
with the scope below, and Gate 4's block no longer applies to the `1.x` line.

`migrate` is the version-aware sibling of `fix`: it reports the contract gap
between each document's `wiki_block_version` and the CLI's current block version,
applies the same mechanical remediations `fix` is trusted with, and stamps a
document's `wiki_block_version` to current only once that document has been
brought to the current contract. It never touches meaning-bearing values,
`verified` content, or document `status`.

### Command surface

- `llm-wiki migrate` / `migrate --dry-run` — preview only (unchanged). Shows the
  version-gap upgrade report and the planned mechanical changes; writes nothing.
- `llm-wiki migrate --apply` — applies the planned upgrade. Preview-first:
  `--dry-run` and `--apply` cannot be combined, mirroring `fix`.

### May change (only under `docs/llm-wiki/`, only on non-`verified` documents)

The write actions are exactly the accepted `fix` scope, plus one migrate-only
action (block-version stamping):

| Finding / gap | Migrate action |
| --- | --- |
| `frontmatter.required` (Tier A fields only) | Insert the missing required field with a safe mechanical default (same defaults as `fix`). |
| Renamed required field | Rename to the current contract name **only when a rename mapping is defined for the document's `wiki_block_version`**. The rename map is empty today (`v1` is the only block version), so no rename occurs yet; the mechanism is forward-looking. |
| `evidence.section_missing` / `section_empty` / `section_unlisted` | Reconcile the body `## Evidence` section from frontmatter `evidence` (same as `fix`). |
| `related.missing` / `markdown_link.missing` | Create a `needs_review` stub at the broken target (same stub conditions as `fix`). |
| `last_updated` freshness | Refresh `last_updated`, only on documents this run actually modifies. |
| `wiki_block_version` gap | Backfill when missing, and stamp to the current block version **as the final step, only once the document otherwise conforms to the current contract**. Stamping is what records "this document has been migrated." |

### Must not change (reported only, never auto-applied)

Identical to the `fix` refusals:

- Tier B meaning-bearing required fields (`title`, `doc_type`, `project`, `author`).
- `source_files` / `evidence` reference values — paths are never invented or rewritten.
- `content.not_enriched` — enrichment needs real source-backed knowledge.
- Document `status` — migrate never promotes to `verified` and never auto-downgrades
  `verified` → `needs_review`. `verified` documents are skipped entirely for content
  edits and are never stamped to a new block version. The opt-in drift downgrade is a
  separate, drift-triggered decision (ROADMAP 1.2 item 3), not part of migrate.
- Anything outside `docs/llm-wiki/`, plus `log.md` (append-only) and adapter files.
- Files with mojibake indicators, and any result matching sensitive-info rules (blocked),
  mirroring `fix` and `init --write`.

### Guarantees

- Idempotent: a second `migrate --apply` with no intervening changes writes nothing.
- All created or edited documents remain `needs_review`.
- A `verified` document is never stamped to a new `wiki_block_version`; its contract
  gap is reported for a human, because stamping would falsely assert the document
  matches the current contract without review.
- UTF-8 throughout; edits are minimal targeted insertions that reuse the `fix` engine's
  split/insert helpers (no frontmatter re-serialization).

## Drift Downgrade Scope Decision (accepted for 1.2.0)

Accepted for the `1.2.0` line (WoongHwan-Kim, 2026-07-14). `fix` (Gate 6) and
`migrate` (Gate 8) both refuse to change document `status`, so the opt-in
`verified → needs_review` auto-downgrade on drift gets its own isolated command.
Downgrading is safe in a way promotion is not: it moves a document toward
`needs_review` (more review, never less), so it never asserts verification a
human did not give. Promotion to `verified` stays human-only in every command.

### Command surface

- `llm-wiki drift` / `drift --dry-run` — report only. Lists the `evidence.stale`
  drift for `verified` documents (line/symbol aware) and what `--downgrade` would
  change. Writes nothing.
- `llm-wiki drift --downgrade` — opt-in write. For each `verified` document that
  has drifted, sets `status: verified` → `needs_review` and refreshes
  `last_updated`. Preview-first: `--dry-run` and `--downgrade` cannot be combined.

### May change (only under `docs/llm-wiki/`, only on drifted `verified` documents)

| Finding | Drift action |
| --- | --- |
| `evidence.stale` on a `verified` document | Set `status` to `needs_review` and refresh `last_updated` to today. |

### Must not change (reported only, never auto-applied)

- Documents without an `evidence.stale` finding — untouched.
- Non-`verified` documents — nothing to downgrade.
- Any content beyond the `status` line and `last_updated`: body, `reviewed_at`,
  `reviewed_by`, `source_files`, `evidence`, and every other field are left as-is.
- Promotion to `verified` — never, in any command.
- Anything outside `docs/llm-wiki/`, plus `log.md` and adapter files.
- Files with mojibake indicators, and any result matching sensitive-info rules
  (blocked), mirroring `fix`.

### Guarantees

- Idempotent: a second `drift --downgrade` finds nothing to downgrade, because the
  first run already moved the drifted documents to `needs_review`.
- Downgraded documents become `needs_review`, consistent with the rule that CLI- or
  agent-authored edits stay `needs_review` until a human re-verifies.
- UTF-8 throughout; edits are minimal targeted scalar replacements that reuse the
  `fix` engine's split/replace helpers (no frontmatter re-serialization).

## Domain Detection Scope Decision (accepted)

Accepted (WoongHwan-Kim, 2026-07-14). The `1.3` domain split created a per-domain
document only from directory-per-domain layouts. Real usage surfaced backends
(e.g. FastAPI `app/api/api_v2/endpoints/hazard.py`) whose domains are **module
files**, not folders — those produced only `00_overview`. This decision expands
detection to cover both, boundary-based only (no route parsing, no class/name
inference, no LLM, no invented business meaning), tuned so false positives stay
near zero even if the scan takes longer.

### What counts as a domain

- **Directory domain** — an immediate subdirectory of a directory whose basename
  is `domains`, `domain`, `modules`, or `features`.
- **File domain** — an immediate source file of a directory whose basename is
  `endpoints`, `routers`, `routes`, `resources`, `controllers`, or `handlers`.
  Source extensions: `.py .js .ts .jsx .tsx .rb .go .java .kt .php .cs`.

The two are merged by normalized slug (a `customer/` folder and a `customer.py`
file collapse to one doc listing both paths in `source_files`), sorted
deterministically, and ordinal-numbered (`NN_<slug>.md`).

### Near-zero false-positive safeguards

- Bounded DFS from the project root (max depth 8); a matched domain parent is
  collected and then PRUNED (its subtree is not re-scanned).
- Never descends into `node_modules`, `dist`, `build`, `out`, `target`, `bin`,
  `obj`, `venv`, `env`, `vendor`, `coverage`, `migrations`, `spec`, `docs`,
  `doc`, `examples`, `scripts`, the technical-name set (`common/shared/core/
  config/util/middleware/infrastructure/test/fixture`), or any hidden (`.`) /
  dunder (`__`) directory.
- File domains exclude aggregator/infra basenames (`index`, `main`, `app`,
  `server`, `base`, `router`, `route`, `routes`, `urls`, `deps`, `dependencies`,
  `schemas`, `models`, `types`, `helpers`, `constants`, `settings`, …), the
  technical-name set, `__init__`/dunder/hidden files, and `*.d.ts` / `*.test.*` /
  `*.spec.*`.

### Honest limits (reported only — fall back to `00_overview`, human/agent authors)

- Django per-app layouts, Java/Kotlin package trees, and domains defined only
  inside a single router file are not auto-detected.
- Only immediate children of a domain parent are taken (route modules nested
  deeper, e.g. `endpoints/hazard/routes.py`, are not split).
- For `fullstack`, a frontend `routes/` folder could be picked up as file
  domains; this is left to human review rather than adding route-framework
  heuristics.

### Unchanged guarantees

- Only for `backend`/`fullstack`, non-`--minimal` init. Preview under `--dry-run`,
  writes only under `--write`, `--existing skip` preserves existing docs, all
  generated docs stay `needs_review`, and `verified` is never auto-assigned.

## MCP Tool Surface Scope Decision (accepted for 1.6.0)

Accepted for the `1.6.0` line. `1.6` makes the wiki agent-native: `llm-wiki mcp`
runs a Model Context Protocol server over stdio so agents (Claude Code, Cursor,
other MCP clients) query and check the wiki as tools instead of shelling out.

### Decisions

- **Hand-rolled, zero-dependency.** MCP over stdio is newline-delimited JSON-RPC
  2.0; the implemented message set (`initialize`, `notifications/initialized`,
  `ping`, `tools/list`, `tools/call`) is small and stable. It is implemented with
  Node built-ins only — **no `@modelcontextprotocol/sdk`** — preserving the
  "no runtime third-party dependencies" invariant. Source: `src/mcp/`.
- **Read-only tool surface.** Exactly these commands are exposed as MCP tools:
  `validate`, `audit`, `next`, `status`, `doctor`, `stats`, `graph`, `explain`,
  `handoff`, `prompt`. **No write/mutating command** (`init`, `fix`, `migrate`,
  `drift`, `quickstart`) is exposed, and tools carry `annotations.readOnlyHint`.
  Agents can inspect the wiki over MCP but cannot change it.
- **Result shape reuse.** `tools/call` returns the command's result object as
  `structuredContent` (carrying the 1.5 `schemaVersion`, with `text` stripped)
  plus a human-readable text content block. A thrown command surfaces as
  `isError: true` (MCP convention), not a JSON-RPC protocol error.
- **Entry point.** A single new `llm-wiki mcp` command (no separate binary),
  special-cased as a long-running stdio server. `--cwd` sets the default project
  root for tool calls.

### Stable contract (new)

The MCP tool name set and the tool result shape (1.5 result + `schemaVersion`)
are stable for the `1.x` line; removing/renaming a tool or breaking the result
shape is a breaking change. Additive tools/fields follow the same SemVer policy
as the CLI.

### Honest limits (v1)

- `llm-wiki.config.json` defaults are NOT merged into MCP tool calls in v1
  (explicit arguments only); planned as a later enhancement.
- The pinned protocol version is `2025-06-18`; the server replies with the
  client's requested version only when supported, otherwise its pinned version.
- Batching is not supported (removed in the pinned protocol); an array message
  is answered with a single `-32600 Invalid Request`.

### Unchanged guarantees

- stdout is the protocol channel (JSON-RPC only); logs go to stderr. The server
  runs until stdin closes. No MCP tool writes files, and sensitive-info redaction
  in the result path is unchanged.

## Release Caveats

- `migrate --apply` was blocked in shipped releases through `1.1.0`. Gate 8 (above)
  unblocks it for `1.2.0` under the accepted `fix`-engine scope; broader migration
  (Tier B fields, path repair, `verified` edits, status changes) stays out of scope.
- `fix` writes only the accepted scope above; broader autofix (Tier B fields, path repair, enrichment, status downgrade) stays out of scope until separately accepted.
- `validate` reuses audit coverage rather than separate layered validators.
- YAML parsing covers the standard frontmatter subset only.
- Antigravity adapter handling remains suggested/info-only until the tool contract is confirmed.
