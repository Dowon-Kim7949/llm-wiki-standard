> Language: [English](./CHANGELOG.md) | [한국어](./CHANGELOG.ko.md)

# Changelog

All notable changes to `@dowonk-7949/llm-wiki-standard` are documented here. This
project follows [Semantic Versioning](https://semver.org/). Entries are newest-first.

## 1.7.1 — 2026-07-15

Patch. Repository hygiene only — no CLI, JSON, programmatic-API, or frontmatter
contract change, and no runtime behavior change.

### Fixed

- `src/commands.js` embedded a raw `U+0000` (NUL) control byte as the delimiter in
  the `wikiGraph` edge-dedup key (`collectWikiGraph` → `addEdge`). Git's
  `text=auto` classified the file as binary, so it was the one source file exempt
  from the repo's `.gitattributes` `eol=lf` normalization and was stored with CRLF.
  Replaced the raw byte with the `\u0000` escape and renormalized the file to LF, so
  it now conforms to the line-ending policy like every other source file.

### Notes

- No functional change: `\u0000` in the template literal produces the same NUL code
  point at runtime, so edge deduplication is byte-identical. The bulk of the commit
  diff is the one-time CRLF→LF renormalization of `src/commands.js`.

## 1.7.0 — 2026-07-15

CI/CD adoption. Make the wiki easy to wire into GitHub Actions and release
automation. This is the lead slice of the split "Team & org scale" line.
Backward-compatible — an additive command mode, a composite action, and a
release job only; the CLI, JSON, programmatic-API, and frontmatter contracts are
unchanged, and no runtime dependency is added.

### Added

- `release-notes --body-only` — emits only the change-section body (no
  frontmatter, no H1 title, no "review before publishing" scaffold line) for use
  as a GitHub Release body. Commit subjects flow into the body, so it is scanned
  for sensitive-looking values and BLOCKED (exit 2, body withheld) on a match.
  Source: `src/release-notes.js`, `src/commands.js`, `src/cli.js`.
- A composite GitHub Action at `.github/actions/validate/action.yml` that wraps
  the read-only `validate` via `npx`. It pulls in NO other actions (only bash +
  npx), preserving the zero-runtime-dependency ethos, and can only read. Pin it
  by an exact `vX.Y.Z` tag or commit SHA.
- GitHub Release automation on a `v*` tag push: an isolated `contents: write` job
  in `.github/workflows/publish.yml` (`needs: publish`), body sourced from
  `release-notes --body-only`, created with the runner's built-in `gh` CLI (no
  third-party release action).
- Per-command `--format json` examples in `help` for the ten read-only report
  commands (`doctor`, `validate`, `validate-frontmatter`, `audit`, `status`,
  `next`, `stats`, `graph`, `explain`, `release-notes`).

### Notes

- Additive and backward-compatible; the zero-runtime-dependency policy is
  preserved. Scope: `GATE_REVIEW.md` (Gate 12). The CI/CD line was split, so
  `1.7.0` ships only the lead slice — Marketplace listing, a floating `@v1` tag,
  the config-loading/init-scaffolding/doctor-echo enabling prep, and `1.8`–`1.11`
  are deferred.

## 1.6.0 — 2026-07-14

Agent-native (MCP). Let agents query and check the wiki as tools instead of
shelling out. Backward-compatible — a new command and module only; the CLI,
JSON, programmatic-API, and frontmatter contracts are unchanged.

### Added

- `llm-wiki mcp` — a Model Context Protocol server over stdio (newline-delimited
  JSON-RPC 2.0), implemented with Node built-ins only (no third-party MCP SDK),
  preserving the zero-runtime-dependency policy. Register it in an MCP client
  with `{ "command": "npx", "args": ["-y", "@dowonk-7949/llm-wiki-standard", "mcp"] }`.
- Read-only MCP tools: `validate`, `audit`, `next`, `status`, `doctor`, `stats`,
  `graph`, `explain`, `handoff`, `prompt`. No write/mutating command is exposed —
  no MCP tool writes files (`annotations.readOnlyHint`). Each `tools/call` returns
  the command's structured result (with `schemaVersion`) as `structuredContent`
  plus a human-readable text summary; a thrown command surfaces as `isError`.
- Programmatic MCP surface from the package entry point: `startMcpServer`,
  `MCP_TOOLS`, `handleMcpMessage`, `MCP_PROTOCOL_VERSION`. Scope: `GATE_REVIEW.md`
  (Gate 11).

### Notes

- Backward-compatible and additive. Batching is not supported (removed in the
  pinned MCP protocol `2025-06-18`); an array message is answered with a single
  `-32600`. `llm-wiki.config.json` defaults are not merged into MCP tool calls in
  this version (explicit arguments only).

## 1.5.2 — 2026-07-14

Community standards. Repository-facing docs so the project meets GitHub's
recommended community standards. No CLI/API changes.

### Added

- Community health files at the repository root, bilingual (EN/KO):
  `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md` (each with a `.ko.md`
  pair), listed in `package.json` `files` so they ship with the package.
- GitHub templates: `.github/ISSUE_TEMPLATE/` (bug report, feature request,
  config) and `.github/pull_request_template.md`.

### Notes

- Repository/GitHub-facing only; the CLI command surface, JSON output, and
  programmatic API are unchanged. `.github/` templates are not shipped to npm.

## 1.5.1 — 2026-07-14

Programmatic API and output fixes found while smoke-testing the new 1.5 API from
a consuming project. All additive/refinements — the stable CLI, JSON, and
frontmatter contracts are unchanged.

### Fixed

- Command result objects now carry a top-level `schemaVersion` (equal to the
  exported `SCHEMA_VERSION`), so a programmatic result self-describes its output
  contract without importing the constant separately. `.text` remains the
  rendered text report in every case — `--format` affects only CLI/`run()`
  stdout and `--out` files, not the returned object; this is now documented.
- `normalizeOptions` accepts a `parseArgs(argv)` result directly (it reads the
  nested `.options`), so `normalizeOptions(parseArgs(argv))` no longer silently
  falls back to defaults. Passing a plain partial still works unchanged.
- `run(argv)` now returns the numeric exit code (`0`/`1`/`2`/`3`) in addition to
  setting `process.exitCode`, so in-process callers can branch on success.
- The `--format html` dashboard's Document Index links are now computed relative
  to the `--out` file's directory, so a dashboard written to a subfolder no
  longer produces broken (404) document links.

## 1.5.0 — 2026-07-14

Programmatic API. Let CI wrappers, editors, and tests use LLM-WIKI in-process
instead of spawning the binary. Backward-compatible — a new import surface and
one additive JSON field only.

### Added

- Importable programmatic API via `package.json` `exports` (`.` → `src/index.js`).
  It exposes a frozen `commands` map keyed by CLI command name, the individual
  command functions, `parseArgs`, `run`, `normalizeOptions` (builds a complete
  options object from a partial override), and `SCHEMA_VERSION`. Return shapes
  are documented with JSDoc typedefs and in `docs/llm-wiki/PUBLIC_API.md`.
- `--format json` output now carries an additive top-level `schemaVersion`
  integer (equal to the exported `SCHEMA_VERSION`), so wrappers can pin the
  output contract. Single source: `src/config.js` `JSON_SCHEMA_VERSION`.

### Notes

- Additive and backward-compatible: existing JSON fields are unchanged, so
  current `--format json` consumers keep working; non-JSON output (text,
  markdown, html, and graph mermaid/dot) is unaffected. Deep external imports of
  internal modules are now encapsulated by the `exports` map; the `llm-wiki`
  binary is unaffected.

## 1.4.0 — 2026-07-14

Knowledge you can see. Make the wiki's knowledge navigable and measurable, and
broaden domain detection. Backward-compatible — new read-only commands and
additive detection only.

### Added

- `llm-wiki graph` — emit the knowledge graph (documents + doc→doc links resolved
  from wiki `[[links]]`, `related`, and markdown links) as text, JSON, Mermaid
  (fenced `graph TD`), or Graphviz DOT. `--format` for `graph` accepts
  `text|json|mermaid|dot`.
- `llm-wiki stats` — a read-only health snapshot: a health score (mean of
  verified %, enrichment %, and evidence coverage %) plus document status mix,
  stale-verified, and orphan counts.
- The `--format html` dashboard gains a navigable **Document Index** (every
  document with inbound-link count and orphan flags), and a "Publishing for
  Human Readers" guide (GitHub/GitLab, Obsidian, MkDocs) in the README.
- File-based domain detection for `init`: backend/fullstack domains defined as
  route/resource module files (FastAPI/Flask/Express/Rails/Go —
  `endpoints/routers/routes/resources/controllers/handlers/*.ext`) are now
  detected alongside directory-per-domain layouts, via a bounded, exclusion-
  guarded scan tuned for near-zero false positives (`GATE_REVIEW.md`, Gate 10).

## 1.3.0 — 2026-07-14

Detect & adapt breadth. Fit more projects and more tools out of the box.
Backward-compatible — new detection, adapters, and opt-in acceptance only.

### Added

- Backend/fullstack `init` now detects business-domain directories (immediate
  subdirectories of `src|app/{domains,domain,modules,features}` and
  `internal/{domain,domains,modules}`, excluding common technical dirs) and
  creates a per-domain document (`domains/NN_<name>.md`, `doc_type: domain`,
  `source_files` = detected dirs) linked from `domains/00_overview.md`.
  Deterministic ordering; duplicate domains across locations merge into one doc.
- Ecosystem detection for PHP (`composer.json`), Ruby (`Gemfile`/`gems.rb`), and
  .NET (`*.csproj`/`*.fsproj`), classified backend vs library by web-framework
  signals.
- Adapters for Windsurf (`.windsurf/rules/llm-wiki.md`) and Gemini CLI
  (`GEMINI.md`) as writable adapters; JetBrains AI (`.junie/guidelines.md`) as an
  info-level candidate. `--agent all` stays codex/claude/antigravity for
  backward compatibility.

### Changed

- `type` (OKF) is now accepted as an alias for the required `doc_type` field, so
  OKF-style documents validate without duplicating the field. Additive — nothing
  is removed or renamed.

## 1.2.0 — 2026-07-14

Safe upgrades & migration. Keep an existing wiki in step with the CLI's contract
instead of deleting and regenerating it. Backward-compatible — new opt-in
behavior only.

### Added

- `wiki_block_version`-aware upgrade report: `migrate` (and `doctor`) show the
  contract gap between each document's recorded block version and the installed
  CLI. `CURRENT_WIKI_BLOCK_VERSION` is now the single source for the stamped value.
- `migrate --apply` is unblocked under an accepted, preview-first scope
  (`GATE_REVIEW.md`, Gate 8). It reuses the `fix` engine plus a
  `wiki_block_version` upgrade: it brings a document to the current contract and
  stamps its block version once it conforms. It never edits `verified` documents'
  content or changes `status`, and never downgrades documents stamped by a newer
  CLI.
- `llm-wiki drift`: reports `evidence.stale` drift on `verified` documents, and
  with `--downgrade` moves drifted documents to `needs_review` (`status` +
  `last_updated` only, never a promotion to `verified`; `GATE_REVIEW.md`, Gate 9).

### Changed

- `evidence.stale` gains line-level granularity: when a source is cited only by
  exact `#Lx-Ly` evidence, drift is checked against those lines instead of the
  whole file, so unrelated edits no longer flag it. Any broad reference keeps the
  file-level check.
- `VERSIONING.md` and `project-profile.md` are now version-agnostic — they point
  at `package.json` as the single version source instead of hardcoding a number.

## 1.1.0 — 2026-07-14

The "inner-loop cleanup" line: faster, quieter day-to-day validation.
Backward-compatible — no breaking changes.

### Added

- `validate --changed` scopes reported findings to the wiki documents changed vs
  the working tree (or a `--since <ref>` base), for fast pre-commit and PR CI.
  Cross-document checks still run over the whole wiki.
- A `pre-commit` hook template (`templates/git-hooks/pre-commit`) that runs
  `validate --changed`, with install notes in `templates/git-hooks/README.md`.
- The CI consumer-install job now runs Quick Start commands (`doctor`,
  `init --dry-run`, `validate-frontmatter`) against the packed tarball.

### Fixed

- `evidence.stale` no longer flags a verified document reviewed on the same day
  its source files were committed. The drift baseline is anchored to end-of-day,
  so only later-day commits count.

### Changed

- Replanned `ROADMAP.md` as a forward-looking, dateless `1.x` line (implementation
  history now lives in this changelog and `docs/llm-wiki/log.md`).
- Added EN–KO pairs for the externally-visible root docs — `CHANGELOG.ko.md` and
  `ROADMAP.ko.md` — cross-linked with their English canonicals and shipped in the
  package; established the EN–KO pair convention (`docs/llm-wiki/README.md`).

## 1.0.0 — 2026-07-14

First stable release. `1.0.0` promotes the `0.1.8` contract to a stable 1.0
milestone with **no functional command changes**; it declares the public contract
stable and hardens release quality.

### Stability

- Declared the CLI command/option surface, `--format json` output shape, and the
  required frontmatter contract stable. Breaking changes to these now require a
  major version bump. See `GATE_REVIEW.md` ("1.0.0 Stability Milestone") and
  `docs/llm-wiki/VERSIONING.md`.

### Added

- Release-quality CI: a Node 18.18.0 / 20 / 22 / 24 × Windows / macOS / Linux
  verify matrix and a packed-tarball consumer install smoke test
  (`.github/workflows/ci.yml`).
- This accumulating root `CHANGELOG.md`, shipped in the npm package.

### Notes

- The conservative write policy is unchanged: `init` / `quickstart` / `fix` write
  only under `--write`, `migrate --apply` remains blocked, `log.md` and existing
  adapter files are never overwritten, and CLI- or agent-authored docs remain
  `needs_review`.

## Earlier (0.1.x)

Pre-1.0 history is recorded in `docs/llm-wiki/log.md` and the per-release notes
under `docs/llm-wiki/releases/`. Highlights:

- `0.1.8` — scoped `fix` autofix command and evidence drift detection (`evidence.stale`).
- `0.1.7` — multi-ecosystem detection (Python/Go/Rust/JVM), Cursor and Copilot
  adapters, `llm-wiki.config.json`, and the `release-notes` command.
- `0.1.6` — real generation dates, `related.missing` and `content.not_enriched`
  validation, wiki-graph orphan detection, and the `--format html` dashboard.
