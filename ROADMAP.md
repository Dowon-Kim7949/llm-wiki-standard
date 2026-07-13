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
  - README.md
  - src/cli.js
  - src/commands.js
  - src/template-renderer.js
  - src/task-prompts.js
  - templates/github-actions/llm-wiki-validate.yml
  - tests/verification.test.js
  - .github/workflows/ci.yml
  - CHANGELOG.md
related:
  - GATE_REVIEW.md
  - VERIFICATION.md
  - RELEASE_CHECKLIST.md
visibility: internal
contains_sensitive_info: false
---

# LLM-WIKI Standard Roadmap

This roadmap keeps product direction separate from the README. The README should stay focused on first-use guidance, while this document tracks package strengthening work for maintainers.

## Product Principle

```text
CLI creates structure and safety rails.
Codex or Claude Code enriches docs from source evidence.
Humans review and approve verified status.
CI continuously checks quality.
```

## Current Release Snapshot

As of 2026-07-14, the source is versioned for `@dowonk-7949/llm-wiki-standard@1.0.0` and uses the automated `v1.0.0` tag release flow.

Release state:

- `1.0.0` promotes the `0.1.8` contract to a stable 1.0 milestone with no functional command changes. It declares the CLI command/option surface, JSON output shape, and required frontmatter contract stable, so breaking changes now require a major version bump (see `docs/llm-wiki/VERSIONING.md` and the 1.0.0 stability gate in `GATE_REVIEW.md`). It also lands the Phase 7 release-quality CI (Node 18.18/20/22/24 × Windows/macOS/Linux matrix plus a packed-tarball consumer install smoke test) and starts an accumulating root `CHANGELOG.md`.
- `0.1.8` adds the scoped `fix` command and finishes the release-notes/drift line: `llm-wiki fix` (default preview, `--write` applies) applies only the accepted autofix scope (see `GATE_REVIEW.md` "Autofix (`--fix`) Scope Decision") — insert missing Tier A frontmatter fields, reconcile the body `## Evidence` section from frontmatter evidence, create `needs_review` stubs for broken `related`/markdown-link targets under `docs/llm-wiki/`, and refresh `last_updated` on modified documents, while never touching `verified` content, `source_files`/`evidence` values, Tier B fields, enrichment, or anything outside `docs/llm-wiki/`. This release also carries the accumulated work since `0.1.7`: Korean-first bilingual release notes, `release-notes --since <ref>`, and evidence drift detection (`evidence.stale`).
- `0.1.7` broadens generality/usability: project detection now recognizes Python/Go/Rust/JVM manifests (not only Node) with `ecosystems`/`primaryManifest`, Cursor (`.cursor/rules/llm-wiki.mdc`) and GitHub Copilot (`.github/copilot-instructions.md`) adapters are supported, an optional `llm-wiki.config.json` declares persistent `type`/`profiles`/`agents`/`strict` defaults, and a new `release-notes` command generates a `needs_review` release-notes document from conventional commits since the last `v*` tag.
- `0.1.6` acted on the v0.1.5 goal-gap evaluation: real generation date, `related.missing` and `content.not_enriched` validation, generated `project` field derived from `package.json`, wiki-graph orphan detection over `related`/Markdown links, the `--format html` dashboard, and library/CLI detection. The repository dogfoods LLM-WIKI in `docs/llm-wiki/`.
- Local verification passed before commit: `node --test tests/*.test.js`, `validate-frontmatter`, and `doctor`.
- `main` push runs CI only. npm publish is reserved for `v*` tag pushes through `.github/workflows/publish.yml`.
- The release tag must match `package.json`; `v1.0.0` publishes version `1.0.0` through npm Trusted Publishing after workflow verification.

Next release policy:

- Continue using the automated publish flow for later versions with a matching package version and `v*` tag.
- Keep version, roadmap, release checklist, package contents, and npm registry verification aligned before pushing a release tag.
- Treat evidence validation as part of the stable document contract, but keep new evidence reference shapes conservative until real project usage proves the need.

## OKF v0.1 Comparison

Working baseline: OKF v0.1 represents knowledge as Markdown documents with YAML frontmatter. The required field is `type`; optional fields include `aliases` and `tags`. The body should use clear Markdown headings and bullet lists, and related concepts or entities should be connected with wiki links such as `[[Concept Name]]`.

Current fit:

- Strong: LLM-WIKI already uses Markdown plus YAML frontmatter, preserves source-backed context through `source_files`, keeps AI-written content in `needs_review`, and validates frontmatter, local markdown links, source references, encoding, and sensitive-info findings.
- Partial: LLM-WIKI uses `doc_type` instead of OKF's required `type`; `tags` already exists, but `aliases` is not part of the required/recommended contract; generated templates are project documentation oriented rather than concept/entity/event oriented.
- Gap: LLM-WIKI does not yet generate `[[wiki links]]`, does not extract entities/events from raw text, and does not provide an OKF v0.1 output mode or schema. Status: wiki-link missing-target validation is implemented.

Design implication:

LLM-WIKI should remain a source-evidence documentation standard by default, and add OKF v0.1 compatibility as an explicit profile or output mode. A low-loss mapping can be `doc_type` -> `type`, existing `tags` -> `tags`, optional new `aliases` -> `aliases`, and `related` plus local markdown links -> candidate `[[wiki links]]` in generated OKF bodies.

## Phase 1: Usability Stabilization

Goal: make first use predictable and hard to misuse.

- Keep command-specific option validation strict.
- Keep `quickstart`, `handoff`, `status`, and `validate` guidance aligned between CLI help and README.
- Keep `README.md` as the default English entrypoint and maintain `README.ko.md` as the Korean entrypoint, with language links at the top of both files.
- Add and maintain `llm-wiki help <command>` for every public command.
- Keep error messages actionable and include the safest next command.
- Keep JSON output stable enough for CI and wrappers.

## Phase 2: Agent Handoff Quality

Goal: make Codex and Claude Code start useful work immediately after CLI setup.

- Keep handoff prompts explicit about adapter entrypoints.
- Support project-type-specific handoff prompts. Status: implemented for frontend, backend, fullstack, and library evidence focus.
- Include expected agent output format: changed files, source evidence, review items, and caveats.
- Keep Antigravity handoff blocked until the adapter contract is confirmed.
- Support saving handoff prompts to reviewable files via `--out`.

## Phase 3: Generated Document Quality

Goal: make CLI-created drafts easier for agents and humans to complete.

- Improve templates with `What to inspect`, `Evidence`, `Open questions`, and `Review notes` sections. Status: implemented for generated default drafts, project profile, domain guides, and OKF profile guide.
- Add a required `API Services` section to domain-oriented document templates. The section should capture service name, endpoint or client module, method, request/response shape, auth/session dependency, error handling, retry/timeout behavior, cache/state update behavior, and related UI or domain workflow. Status: implemented for generated domain overview and domain features drafts.
- Add OKF v0.1-oriented templates for `concept`, `project`, `api_reference`, `meeting_note`, and `event` documents. Status: implemented.
- Ensure generated OKF-style documents use concise wiki tone, clear headings, bullet lists, and `[[wiki links]]` where related concepts are known. Status: implemented for OKF profile guide and OKF document templates.
- Make `docs/llm-wiki/domains/00_overview.md` a stronger domain mapping guide.
- Fix generated-document graph connectivity. Generated templates link relationships only through `related` frontmatter and Markdown links, but `wikiGraph` counted inbound links from `[[wiki links]]` only, so a freshly generated project reported almost every document as an orphan. Status: implemented — `collectWikiGraph` now counts resolved `related` entries and local Markdown links toward inbound connectivity for orphan detection (this repo's own wiki dropped from 14 orphans to 3). `wikiLinks`/`resolvedWikiLinks` counts are unchanged.
- Decide whether handoff-critical metadata (document owner, decision rationale, last human review) should be part of the required core contract rather than optional templates. Decision (2026-07-10): keep them optional. `last human review` is already covered by `reviewed_by`/`reviewed_at` (checked for `verified` docs under `--strict`), and decision rationale stays in the optional `DECISION_LOG` template. `owner` remains an optional, schema-recognized field (frontmatter allows additional properties) rather than a required core field, because hard-requiring owner on every document would flood existing repositories with errors and conflicts with the warning-friendly incremental-adoption policy in GATE_REVIEW. Revisit only if real team usage shows handoff gaps that owner-on-every-doc would close.
- Keep all generated documents in `needs_review`.
- Consider project-local template overrides after the stable CLI contract is proven.

## Phase 4: Validation Depth

Goal: catch stale, broken, or unverifiable wiki content before it spreads.

- Publish and validate a JSON Schema for required frontmatter fields, valid statuses, visibility values, and review metadata. Status: implemented with `rules/frontmatter.schema.json`.
- Add an OKF v0.1 validation profile that requires `type`, accepts optional `aliases` and `tags`, and checks that these fields have the expected scalar/array shapes. Status: implemented as explicit `--profile okf-v0.1` validation.
- Add link validation for `docs/llm-wiki`. Status: implemented for local markdown links.
- Add wiki-link validation for `[[Concept Name]]` references, including missing target detection and optional alias resolution. Status: implemented for file path, basename, frontmatter `title`, and frontmatter `aliases`.
- Validate that `source_files` entries exist. Status: implemented for local path references.
- Add stricter `verified` policy checks in `--strict` mode. Status: implemented for missing `reviewed_by` and `reviewed_at`.
- Add evidence-span references so important claims can point to a file, symbol, route, section, or line range instead of only a broad source file. Status: implemented as optional `evidence` frontmatter string references with local file, line-range, and body `## Evidence` section alignment validation.
- Split validation findings by category for easier CI reporting. Status: implemented with `findingSummary.byCategory` and text report summaries.
- Validate that `related` frontmatter entries point to existing local documents. Only `source_files` and `evidence` are existence-checked today, so a generated document can reference a missing sibling (for example a `related` entry to `docs/llm-wiki/API_CONTRACTS.md` that was never created) and still validate as pass.
- Add an enrichment-completeness signal so a project of untouched generated scaffolds does not report a clean pass. A freshly generated wiki currently returns `result: pass` with zero findings even though every document is still placeholder-only (`What to inspect`, `Open questions`, `Review notes`) with no source-backed content. Detect placeholder-only documents and surface a warning that the wiki has not been enriched yet, since a silent pass on empty scaffolds undercuts the token-saving and handoff-replacement goals.
- Keep sensitive-info detection conservative and non-leaking.

## Phase 5: Developer Support Commands

Goal: help maintainers decide the next useful action without reading every document.

- Keep improving `llm-wiki status`.
- Add `llm-wiki next` for recommended next actions. Status: implemented as an advisory command backed by audit findings and wikiGraph.
- Add `llm-wiki explain <finding>` for remediation guidance. Status: implemented with rule-specific explanations and safe remediation commands.
- Add `llm-wiki prompt --task <name>` for repeatable agent workflows after the project LLM-WIKI is already initialized and enriched. Status: implemented.
- Add task prompt presets for `feature`, `fix`, `refactor`, `docs-sync`, and `okf-extract`. Status: implemented.
- Ensure feature/fix/refactor prompts require the agent to read `docs/llm-wiki/index.md`, locate related domain/API/component documents, inspect source files, produce an implementation plan, update code, update affected wiki documents, append `docs/llm-wiki/log.md`, and keep AI-edited docs as `needs_review`. Status: implemented.
- Consider `llm-wiki prompt --task okf-extract` to print an AI Knowledge Editor prompt for converting raw text into OKF v0.1 Markdown. Status: implemented as a prompt workflow, not automatic extraction.

## Phase 6: Team And Organization Adoption

Goal: make the package useful beyond a single personal project.

- Add profile presets such as `monorepo`, `mobile`, and `infra` when use cases are proven.
- Add an `okf-v0.1` profile for teams that want LLM-WIKI documents to double as a knowledge base corpus. Status: implemented for validation and profile guide creation.
- Support `llm-wiki.config.json` for persistent project defaults. Status: implemented — an optional project-root file declares `type`, `profiles`, `agents`, and `strict`; the CLI merges it with precedence CLI flags > config > auto-detection, reports its presence in `doctor`, and rejects malformed config with exit code 3. The schema is intentionally minimal (these four option-mirroring fields) until real usage justifies growing it.
- Consider external rules files such as `llm-wiki.rules.json`, and consider config-driven custom document sets, rules, and template overrides after the minimal `llm-wiki.config.json` shape is proven in real projects.
- Provide GitHub Actions examples. Status: implemented with `templates/github-actions/llm-wiki-validate.yml`.
- Document team review policy examples for `needs_review` and `verified`.
- Document organization-level policy for internal, restricted, and public knowledge boundaries.
- Provide a reader-friendly knowledge view for non-developers and cross-team readers. Generated output is raw Markdown plus frontmatter, which serves agents well but is weak for the "easy knowledge transfer" goal. Status: implemented — `--format html` (and `--out *.html`) renders a self-contained, theme-aware dashboard from `audit`/`validate`/`status` results (summary tiles, document-status distribution, findings by category, findings, and wiki-graph orphans/unresolved concepts).

## Phase 7: Release Quality

Goal: keep the npm package trustworthy across environments.

- Run Node LTS matrix tests. Status: implemented — `.github/workflows/ci.yml` runs a Node 18.18.0/20/22/24 verify matrix.
- Run Windows, macOS, and Linux smoke tests. Status: implemented — the same CI matrix crosses Node versions with `ubuntu-latest`, `windows-latest`, and `macos-latest`, running tests, `validate-frontmatter`, `doctor`, and `npm pack --dry-run` on every combination.
- Add temp consumer install tests from packed npm tarballs. Status: implemented — the CI `consumer-install` job packs the tarball, installs it into a scratch consumer project on Linux and Windows, and runs `llm-wiki doctor`.
- Verify Quick Start commands against packed artifacts before release.
- Keep release notes and migration notes aligned with CLI behavior.

## Phase 8: OKF v0.1 Interoperability

Goal: support OKF v0.1 without weakening the existing LLM-WIKI safety model.

- Add `--profile okf-v0.1` validation for `type`, `aliases`, `tags`, and `[[wiki links]]`. Status: implemented.
- Add an OKF conversion guide that maps LLM-WIKI metadata to OKF v0.1 metadata: `doc_type` -> `type`, `tags` -> `tags`, optional `aliases` -> `aliases`, `related` -> body wiki links where appropriate. Status: implemented as a review-assisted conversion guide.
- Add fixtures for concept, project, person, meeting note, event, and API reference examples. Status: implemented.
- Decide whether raw-text conversion belongs in the CLI, in an agent prompt template, or in a separate package. Default should be prompt-assisted extraction first, not fully automatic extraction. Status: implemented as the `okf-extract` task prompt workflow.
- Keep `needs_review` as the default for all AI-extracted OKF documents. Status: implemented in OKF templates and `okf-extract` prompt guidance.
- Add optional graph/report output that lists detected wiki links, unresolved concepts, aliases, and orphan documents. Status: implemented as `wikiGraph` in status, audit, and validate results.

## Near-Term Priority

1. Fix the hardcoded generated `last_updated` date. The core template writes a fixed `2026-07-02` value (`src/template-renderer.js`) and the generated `log.md` body reuses the same fixed date (`src/commands.js`), so every generated document claims a stale last-updated date on the day it is created. Inject the real generation date at `init` time so freshness metadata is trustworthy.
2. Dogfood this repository. The package's own repository has no `docs/llm-wiki/` and relies on ordinary Markdown (`README.md`, `GATE_REVIEW.md`, and this roadmap). Migrate the project's own maintainer knowledge into a `docs/llm-wiki/` set generated and enriched by the CLI. Running the standard on itself is the first credible evidence that it saves tokens and replaces handoff docs.
3. Verify the `0.1.5` package from a clean consumer project after publish and record any install or CLI smoke-test issues.
4. Exercise evidence references on one real project document set and note whether file, line, symbol, section, and route references are enough.
5. Decide how strict evidence validation should be introduced in CI: advisory first, strict only for release gates, or strict on every validation run.
6. Add Node LTS matrix and cross-platform smoke tests before the next release tag.
7. Keep later releases on the automated tag-based publish flow instead of manual npm publishing.

## Additional Work Candidates

These items are not yet committed to a release phase, but they are strong candidates for future roadmap refinement after real project usage.

1. Code-change drift detection and automatic review downgrade: detect when source evidence linked from a document changes in Git, then downgrade affected documents from `verified` to `needs_review`. Status: implemented as a first pass — `evidence.stale` flags `verified` documents whose local `source_files`/`evidence` files changed in git after `reviewed_at` (falling back to `last_updated`); best-effort and file-granularity (skipped silently when git is unavailable). Future refinement: line/symbol-granularity precision and an optional automatic status downgrade.
2. Static HTML dashboard reports: export `wikiGraph` and audit results as a readable dashboard for maintainers and tech leads. Useful views include documentation progress, unresolved links, orphan documents, review status distribution, and broken evidence references. Prerequisite: the Phase 3 graph-connectivity fix. Status: implemented as `--format html` after the graph-connectivity fix landed, so the dashboard renders a meaningful knowledge graph rather than an all-orphan view.
3. Cross-repository knowledge links for multi-repo systems: define a conservative reference format for API specs, domain documents, and service contracts that live in separate repositories. This should build on the future `monorepo` profile without assuming all knowledge lives in one physical repo.
4. AI-agent conflict resolution guidance: document safe merge and recovery policies for teams using multiple agents such as Codex and Claude Code against the same wiki corpus. Consider whether CLI helpers are needed for conflict detection, document status reset, and post-merge validation.

## Post-0.1.8 Candidates

Prioritized next work after the 0.1.8 line (scoped `fix`, Korean-first bilingual release notes, `release-notes --since`, and evidence drift `evidence.stale`). The previous top item — scoped `fix` (autofix) — shipped in `0.1.8`; its accepted scope is recorded in `GATE_REVIEW.md` ("Autofix (`--fix`) Scope Decision"). Ordered by leverage and risk.

1. Existing-wiki upgrade/migration path: give a project whose `docs/llm-wiki` was generated at an older version a safe way to adopt the current contract without deleting the folder. Motivation from real usage (2026-07-13): upgrading an early (~`0.1.0`) wiki felt complex enough that the maintainer deleted `docs/llm-wiki` and re-bootstrapped from scratch instead — "delete and regenerate" should not be the easiest upgrade path, because it discards enriched, human-reviewed content. Consider a `wiki_block_version`-aware check that reports the contract gap between the docs' generation version and the installed CLI, then reuses the scoped `fix` engine to backfill the mechanical differences (missing required fields, `## Evidence` sections, stale metadata) while leaving content and `verified` status for human review. Keep it preview-first, mirroring `fix` and the blocked `migrate --apply`.
2. Line/symbol-granularity drift and optional auto-downgrade: extend `evidence.stale` (Additional Work Candidate 1) beyond file granularity, and offer an opt-in that writes `verified` -> `needs_review` for drifted documents. Fold in the deferred `fix` refinements here: opt-in Tier B field derivation (`title`/`doc_type`/`project`/`author`), broken-reference path repair, and the `verified` -> `needs_review` downgrade.
3. More adapters: Windsurf (`.windsurf/rules`), JetBrains AI, and confirming the Gemini/Antigravity contract, reusing the `ADAPTER_TARGETS` pattern.
4. Detector depth: resolve the stdlib-server limitation (inspect a few source files for `net/http`, Flask, etc.) and add more ecosystems such as PHP (`composer.json`), Ruby (`Gemfile`), and .NET (`*.csproj`).
5. `llm-wiki.config.json` schema growth (gated on real usage): custom document sets, per-project rule toggles, and template overrides once the minimal shape is proven.
6. First-class GitHub Action and GitHub Release: publish a reusable/composite action so consumers add a single `uses:` step, and create a GitHub Release from the generated release notes on tag push.
7. Accumulating `CHANGELOG.md`: prepend generated release notes into a shipped root changelog so npm consumers see version history. Status: implemented — a root `CHANGELOG.md` starts at `1.0.0` and is listed in `package.json` `files`; future releases prepend newest-first.
8. Programmatic API: expose the command functions as a documented importable library API for wrappers and CI, complementing the CLI.
9. Release-quality hygiene: Node LTS matrix, Windows/macOS/Linux smoke tests, and a packed-tarball consumer install test in CI. Status: implemented in `.github/workflows/ci.yml` for the 1.0.0 line.
