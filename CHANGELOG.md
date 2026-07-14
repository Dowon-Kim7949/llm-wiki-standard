> Language: [English](./CHANGELOG.md) | [한국어](./CHANGELOG.ko.md)

# Changelog

All notable changes to `@dowonk-7949/llm-wiki-standard` are documented here. This
project follows [Semantic Versioning](https://semver.org/). Entries are newest-first.

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
