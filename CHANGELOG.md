> Language: [English](./CHANGELOG.md) | [한국어](./CHANGELOG.ko.md)

# Changelog

All notable changes to `llm-wiki-governance` (formerly `@dowonk-7949/llm-wiki-standard`)
are documented here. This project follows [Semantic Versioning](https://semver.org/).
Entries are newest-first.

## 1.22.0 — 2026-07-22

Optional Korean localization of human-facing findings prose (the last external-feedback
item, P4). Additive and zero-dependency: rule IDs, the `--format json` shape, the
programmatic API, and the frontmatter contract are unchanged, and default English output
stays byte-identical in every format.

### Added

- **`--lang ko|en` (global, default `en`) + config `lang` — Korean localization of findings
  prose (Gate 27, P4).** Localizes only human-facing prose: a finding's `message` (via the
  shared `applyRuleConfig` seam, so both the text sections and the `--format json` `message`
  pick it up) and `explain`'s meaning / why / remediation. A new zero-dependency catalog
  (`src/i18n.js`) with `{param}` interpolation and a strict English fallback (a missing KO
  key keeps the English string, never blank). Resolved through the shared
  `applyProjectConfig`/`resolveOptions` seam, so CLI, programmatic API, and MCP all honor the
  same language.
- Localized all 47 `explain` entries plus the finding messages surfaced by
  `validate`/`audit`/`status`/`next` (the `scans` / `frontmatter` / `structure` families);
  operational/edge messages fall back to English until a follow-up.

### Unchanged (frozen contract)

- Rule IDs, all `--format json` keys and its shape, category names, config keys,
  command/option names, evidence-locator syntax, the CLI commands shown by `explain`, and
  file paths stay English — only prose localizes. `--format json` `message` localizes only
  under an explicit `--lang ko` (`rule` and shape unchanged; consumers must key on `rule`).
  Default `en` output is byte-identical in every format. Report chrome (section headers,
  severity words), languages beyond KO/EN, and OS-locale auto-detection stay out of scope.

## 1.21.0 — 2026-07-22

More external-usage developer-experience improvements, additive and zero-dependency: the
`llm-wiki` command surface, `--format json`, the programmatic API, and the frontmatter
contract are unchanged, and backend/fullstack domain detection stays byte-identical.

### Added

- **Domain docs are pre-wired into the two top-level entry points (external feedback P6).**
  When `init`/`quickstart` plans per-domain docs (auto-detected or via `--domains`), the
  generated `index.md` now links the domain overview (in the read order and `related`) and
  `DOMAIN_FEATURES.md` lists each per-domain doc under a `## Domains` section — complementing
  the existing overview↔per-domain wiring so the domain map is reachable from the entry point,
  and automating the linking a tester previously did by hand. Gated on domains being planned:
  a domain-less scaffold is byte-identical. Scope is scaffold-time (`init`/`quickstart`);
  `fix`-time re-wiring is a follow-up. Additive and zero-dependency.
- **Per-document enrichment checklist in `next` (external feedback P5).** `next` now surfaces
  an "Enrich placeholder documents" action and an **Enrichment Checklist** that lists, for each
  not-yet-enriched document, which `##` sections still hold generated placeholder text (with a
  hint). Backed by a pure `enrichmentChecklist` helper and an additive `checklist` field on the
  `content.not_enriched` audit finding; an additive `enrichmentChecklist` field is added to the
  `next` result, and `explain content.not_enriched` now points at it.
- **Detection & `not_enriched` heuristic transparency + regression tests (external feedback P7).**
  Documented the domain-detection and enrichment criteria (parent conventions, exclusion sets,
  placeholder sentinels) in the wiki, and added a deterministic `planDomainDocs` snapshot test
  plus broader `FILE_DOMAIN_EXCLUDE` coverage to lock the heuristics against regressions.

## 1.20.0 — 2026-07-22

Retrieval and frontend developer-experience improvements, most driven by external usage
feedback (building an LLM-WIKI on a Vue/Quasar SPA). Additive and zero-dependency: the
`llm-wiki` command surface, `--format json`, the programmatic API, and the frontmatter
contract are unchanged, and backend/fullstack domain detection is byte-identical.

### Added

- **Frontend/SPA domain detection.** `init` now detects per-domain docs for `frontend` and
  `mobile` projects, not only backend/fullstack: the 1-depth folders under
  `pages`/`views`/`features`/`modules`/`screens`, plus the top-level route groups parsed
  (regex, no parser dependency) from vue-router/react-router files. SPA UI-plumbing folders
  (`components`/`layouts`/`composables`/…) are excluded, and backend/fullstack detection is
  unchanged.
- **`--domains <a,b,c>` + an explicit no-domains notice.** `init`/`quickstart` can now name
  domains explicitly (for when auto-detection can't find them), and — instead of silently
  producing zero per-domain docs for a domain-capable project — print an explicit notice
  pointing to `--domains` or manual creation under `docs/llm-wiki/domains/`.
- **`llm-wiki get-doc --section <terms>` — focused read.** Returns only the most relevant
  `##` sections (plus the preamble) instead of the full document body, falling back to the
  full body when there is no `##` section or nothing matches. An additive `document.section`
  `{query, returned, total}` appears only when it filtered; default `get-doc` output is
  unchanged. Wired across the CLI, MCP (`get_doc.section`), and the programmatic API.

### Changed

- **`search-docs` deprioritizes the append-only change log.** `docs/llm-wiki/log.md`
  (a `change_log`) accumulated every keyword and previously dominated results; it now ranks
  after all other matches (still returned, not excluded) so reference docs surface first.
  Output shape unchanged.
- **`evidence.section_unlisted` matches by source path, not verbatim.** A body `## Evidence`
  entry satisfying a frontmatter `evidence` reference no longer needs a verbatim substring: a
  `path:60-70` body reference satisfies a `path#L60-L70` frontmatter entry (and locator-format
  differences generally), removing spurious warnings. External `http(s)`/`repo:` references
  still require a verbatim mention.

## 1.19.0 — 2026-07-21

Evidence semantic tiers (Gate 25) + agent update runner (Gate 26). Deepens the
"code-grounded, verified" promise from format-only checks to meaning, and makes the
wiki-grounded skill workflow auditable end-to-end. Additive and opt-in: the existing
`llm-wiki` command surface, `--format json`, the programmatic API, and the frontmatter
contract are unchanged, and no runtime dependency is added.

### Added

- **Evidence target-existence checks (Gate 25).** `evidence`/`source_files` references
  with a `#symbol:` or `#section:` locator are now checked for the *target's* existence,
  not just the file's: `evidence.symbol_unverified` fires when the referenced file mentions
  none of the symbol name(s) (a `·`/`,`/`/`-joined value is a list), and
  `evidence.section_unverified` when a Markdown source has no heading matching the section.
  Conservative textual-presence check (not an AST resolver — avoids false positives).
  Default warning; `--strict` escalates. `route` locators stay format-only in v1.
- **`evidence.ungrounded` (Gate 25).** Flags a `verified` document with no `source_files`
  and no `evidence` — "verified" with no code grounding. Default warning; not escalated by
  `--strict` (toggle/escalate via `llm-wiki.config.json` `rules`).
- **Computed evidence tiers (Gate 25).** `llm-wiki stats` now reports `evidenceTiers`
  (`reference_checked` = has grounding and every reference resolves; `human_verified` =
  verified with reviewer metadata) — computed and report-only, **not** a new frontmatter
  field or `status` value.
- **`llm-wiki check-run` — agent update runner (Gate 26, read-only).** Verifies a
  wiki-grounded skill run's manifest under `.llm-wiki/runs/` (the newest, or `--run <path>`):
  every `changedSource` file is referenced by some `touchedDocs` document, the change log was
  appended, and validation ran and passed. The intent-anchored complement to `impact`
  (diff-anchored). New toggleable `run.*` findings (`run.doc_gap`/`run.log_missing`/
  `run.unvalidated` warning, `run.manifest_missing` warning, `run.manifest_invalid` error).
  Default warning; `--strict` fails CI.
- **Skill completion contract (Gate 26).** The generated `/llm-wiki-<task>` skill bodies now
  embed a final step to write the run manifest, so the completion contract travels with the
  skill. Regenerate committed skill artifacts with `init --write --skills --existing overwrite`
  to pick it up.

### Safety

- **Read-only.** The evidence checks, tiers, and `check-run` never write. `check-run`'s only
  associated write is the manifest the agent authors during its own run (not by the tool).
- **Conservative by design.** The target-existence checks flag only unambiguous absences, so
  enabling them does not retroactively break correctly-grounded `verified` documents.
- **Zero-dependency.** Bounded text scans and the existing parsers only — no AST/language
  server, no network.

## 1.18.0 — 2026-07-21

Read-only retrieval (Gate 24). Adds four commands that return document **content**,
not governance reports — the "the agent queries the wiki instead of re-deriving from the
code" surface. Additive and opt-in: the existing `llm-wiki` command surface stays
backward-compatible, `--format json`, the programmatic API, and the frontmatter contract
are unchanged, and no runtime dependency is added.

### Added

- **`llm-wiki list-docs` — enumerate documents with metadata (read-only).** Lists content
  docs with their path, title, status, doc_type, visibility, last_updated, and tags (no
  bodies). Filter with `--status`, `--visibility`, `--doc-type`.
- **`llm-wiki search-docs <query>` — keyword search (read-only).** Deterministic
  keyword/substring match over titles, bodies, and frontmatter — **NOT semantic/vector
  search**. Every whitespace-separated term must appear (AND); results are ranked (title
  hits weighted highest) with a short snippet per match. `--limit` caps results (default 20).
- **`llm-wiki get-doc <path>` — read one document (read-only).** Returns a document's
  frontmatter and body. `<path>` may be repo-relative (`docs/llm-wiki/GLOSSARY.md`),
  wiki-relative (`GLOSSARY.md`), or a bare name (`GLOSSARY`).
- **`llm-wiki get-related <path>` — resolved graph neighbors (read-only).** Returns a
  document's outbound and inbound neighbors over wiki links, related frontmatter, and local
  markdown links.
- **MCP retrieval tools.** The four commands are exposed over MCP as `list_docs`,
  `search_docs`, `get_doc`, and `get_related` (read-only, like every other MCP tool), and
  over the programmatic API under their kebab-case command names.

### Safety

- **Read-only.** No command in this set writes, edits, or downgrades anything.
- **Visibility + sensitive-info honored.** Restricted/sensitive documents (visibility
  `restricted`, `contains_sensitive_info: true`, or a sensitive-info scan match) are
  **excluded** from `list-docs`/`search-docs` unless `--include-sensitive` is passed; every
  returned body/snippet **redacts** sensitive-looking lines, so a raw secret is never
  returned (`get-doc` still returns the document, with those lines redacted).
- **Zero-dependency.** Keyword/substring matching and the existing wiki graph only — no
  embeddings, index, or network.

## 1.17.0 — 2026-07-21

Reverse-impact gate (Gate 23). Adds a read-only `impact` command that catches the case
date-based drift misses — code and its `verified` doc changing in **separate** PRs. It is
additive and opt-in: the `llm-wiki` command surface stays backward-compatible, `--format
json`, the programmatic API, and the frontmatter contract are unchanged, and no runtime
dependency is added.

### Added

- **`llm-wiki impact` — diff-anchored reverse-impact check (read-only).** Builds a reverse
  index from every `verified` doc's local `source_files`/`evidence`, then flags a `verified`
  doc whose referenced source is in the current change set **but the doc itself is not
  changed in the same diff**. This is the pre-merge, diff-anchored complement to the
  date-anchored `evidence.stale` (drift): it answers "this PR touches governed code without
  updating its doc," which a date baseline cannot.
  - Baseline is the **working tree** by default, or `--since <ref>` for a PR/CI base
    (`git diff --name-only <ref>`), reusing the same `changedFiles` primitive as
    `validate --changed`.
  - New finding `impact.source_changed` (new **toggleable** `impact` category, default
    **warning**); `impact.unavailable` (error) when git is not available.
  - `--strict` escalates impact findings to a failing error so CI fails a PR that changes
    governed code without updating its `verified` doc; the severity is also adjustable via
    the config `rules` map. An **empty change set is a no-op** (result `pass`).
  - Read-only: remediation stays human (re-review, or `drift --downgrade`). v1 is
    file-level (line-level / per-doc `reviewed_sha` / write-back / MCP exposure are out of
    scope). External `http(s)://` and `repo:<name>/<path>` references are ignored.

### Internal

- `scans.js` factors a pure, shared anchor extractor `verifiedSourceAnchors` used by both
  the date-anchored drift (`driftTargets` now delegates to it — behavior-preserving) and
  the new diff-anchored `scanReverseImpact`. Reuses existing git primitives; mostly wiring,
  zero-dep.

## 1.16.1 — 2026-07-21

Follow-up polish for the 1.16.0 rename. No code behavior change: the `llm-wiki`
command, `--format json`, the programmatic API, and the frontmatter contract are
unchanged, and no runtime dependency is added.

### Changed

- **README title corrected** to "LLM-WIKI Governance" (was "LLM-WIKI Standard"),
  matching the governance positioning and the package name.
- **CONTRIBUTING** wording updated to the governance framing; the internal frontmatter
  schema `$id` (a local placeholder identifier, not used for validation) aligned to the
  new name.
- **Added `keywords`** to `package.json` for npm discoverability.

## 1.16.0 — 2026-07-21

Rename + reposition. The package is renamed `@dowonk-7949/llm-wiki-standard` →
**`llm-wiki-governance`** (unscoped) and repositioned as **governance for AI-written
project docs (OKF-compatible)**. CLI output is now English-first. Additive and
presentational: the `llm-wiki` command, `--format json`, the frozen programmatic API,
and the frontmatter contract are unchanged, and no runtime dependency is added. The old
scoped package is deprecated and points here.

### Changed

- **Package renamed to `llm-wiki-governance`** (was `@dowonk-7949/llm-wiki-standard`).
  The `llm-wiki` command name is unchanged; install / `npx` targets and the programmatic
  import specifier use the new name. The old package is deprecated with a pointer here.
- **Repositioned as a governance layer** — verify, catch drift, keep AI-written docs
  code-grounded, enforce in CI — positioned OKF-compatible. README (EN/KO) reframed.
- **English-first CLI output.** The handoff prompt you paste into a coding agent is now
  fully English; `help`, the quickstart `About` section, and the handoff `Next Step`
  guidance lead with English (a short Korean note is retained). No finding IDs, command
  names, or JSON fields changed.

## 1.15.1 — 2026-07-21

Skill-generation onboarding fix — dogfooded: this change was made by running the tool's
own `/llm-wiki-feature` skill on itself. No command, option, `--format json`, or
frontmatter contract change; no runtime dependency added.

### Changed

- **`init`/`quickstart --write` now prints a restart-required note when it generates
  skills.** Claude Code discovers skills at session start (not hot-reload), so a freshly
  generated skill's `/llm-wiki-*` command reads as "unknown" until the agent is
  restarted. The note (bilingual, one line) is shown only when a skill was actually
  created, so users are not left guessing why the new command is missing.

## 1.15.0 — 2026-07-20

Skill generation (Gate 21) — wiki-grounded automation prompts for feature/fix/docs-sync
work, so a generated wiki actually gets USED. Additive and opt-in; existing commands,
`--format json`, and the frontmatter contract are unchanged, and no runtime dependency
is added.

### Added

- **`init`/`quickstart` can generate invocable, wiki-grounded automation prompts** for
  the `feature`, `fix`, and `docs-sync` workflows, in each agent's native shape:
  - Claude Code skill — `.claude/skills/llm-wiki-<task>/SKILL.md` (invoke as `/llm-wiki-feature`),
  - Cursor rule — `.cursor/rules/llm-wiki-<task>.mdc`,
  - agent-neutral prompt — `.llm-wiki/prompts/llm-wiki-<task>.md` (for Codex and any other agent).
  Each body reuses the existing wiki-grounded workflow (read the wiki → ground the change
  → update docs `needs_review` → append `log.md` → never auto-`verified`) and embeds a
  generation-time snapshot of the project's **domain map** (from `docs/llm-wiki/domains/`),
  so the agent immediately knows which docs to read for a change.
- **A `--skills` flag** on `init`/`quickstart` requests the artifacts; they are also
  emitted when the `claude` or `cursor` agent is selected. Opt-in and preview-first
  (`--dry-run` lists what would be created); existing skill/rule/prompt files are never
  overwritten. The tool only WRITES the artifacts — the agent runs them
  (recognize-don't-run). A repository that does not request skills is byte-identical.

## 1.14.4 — 2026-07-20

Domain-detection fix, from a maintainer review of a tester's output. No command,
option, `--format json`, or frontmatter contract change; zero runtime dependency added.

### Fixed

- **Domain detection no longer scans into virtualenvs / installed dependencies.** On a
  Python project with a version-suffixed virtualenv (e.g. `venv3.10/`), the scan
  descended into `venv3.10/Lib/site-packages/` and generated dozens of empty domain
  docs for third-party libraries (passlib's `handlers/`, boto3's `resources/`, …),
  because the venv name was not in the skip list and `site-packages` was not excluded.
  Now: a directory containing `pyvenv.cfg` is treated as a virtualenv and skipped
  wholesale (name-agnostic, so `venv3.10`/`.venv-py39`/etc. are all caught),
  `site-packages`/`dist-packages` are excluded from traversal, and version-suffixed
  `venv*`/`env<N>` directory names are skipped. A repository without a virtualenv is
  unaffected (byte-identical); the project's own `handlers`/`routers`/… domains are
  still detected.

## 1.14.3 — 2026-07-20

Onboarding orientation, from a second exposure report. A first-time user could not tell
what the tool does from the bare command, and a Korean tester asked for Korean output.
No command, option, `--format json`, or frontmatter contract change; zero runtime
dependency added.

### Added

- **A bilingual (KO+EN) orientation header on `llm-wiki` / `--help`.** The bare command
  now leads with what LLM-WIKI is, why it helps (the agent grounds on a verified wiki
  instead of re-deriving from code), and the 3-step flow (scaffold → paste the handoff
  prompt into your coding agent → human review & verify) — instead of opening straight
  into the Usage list.
- **The package version and an `@latest` tip in `--help`.** Help now shows `llm-wiki
  vX.Y.Z` and recommends `npx …@latest`, so a stale npx cache (which silently reuses an
  old version) is noticeable.
- **A bilingual `About · 소개` line on `quickstart` output**, so a user who runs
  `quickstart` directly (without reading `--help`) still gets oriented.

## 1.14.2 — 2026-07-20

Usability polish following the first successful external end-to-end run (a backend
developer ran the handoff prompt and extracted a full wiki). Reduces the confusing
noise a reviewer sees and surfaces one silent failure. No command, option,
`--format json`, or frontmatter contract change; no runtime dependency added.

### Fixed

- **Colon-line evidence notation (`file:10`) is now accepted** alongside `file#L10`
  (and `file:10-20` alongside `file#L10-L20`). An enriching agent that writes evidence
  the way editors and grep emit it no longer trips a false `evidence.missing`; the
  reference resolves to the source with a validated line range.
- **Generated `templates/*.template.md` are no longer reported as orphans.** They are
  intentional, expected-unlinked scaffolds, so a freshly created wiki stops showing
  false-positive orphans in `graph`/`stats`. Genuinely unlinked docs are still flagged.

### Added

- **A warning when the wiki output path is gitignored.** If `docs/llm-wiki` is ignored
  by git, `init --write`/`quickstart` now emit a `structure.output_gitignored` warning
  (never a block) and `doctor` reports it — catching the silent case where generated
  docs are created but never tracked by git.
- **A reassurance summary on `init --write`.** A one-line `N created, N overwritten,
  N kept (existing files preserved)` summary makes it clear what was and was not touched.

## 1.14.1 — 2026-07-20

Bug-fix batch from the post-1.14 exposure test. On-ramp and brownfield-fit fixes; no
new commands, options, `--format json` fields, or frontmatter changes, and no runtime
dependency added.

### Fixed

- **Non-UTF-8 manifests no longer mis-type the project.** A manifest saved as UTF-16
  or UTF-8-with-BOM (common on Windows, e.g. a PowerShell-redirected `requirements.txt`)
  was read as UTF-8, turned into mojibake, and made detection miss the framework
  keyword — so a FastAPI backend was mis-typed as `library`. A BOM-aware reader now
  backs every detector manifest/source read (UTF-16LE, UTF-16BE, and UTF-8 BOM). Files
  without a BOM decode exactly as before; the wiki-doc encoding scan is unchanged.
- **Handoff prompt no longer points at adapter files that were never created.** Without
  an explicit `--agent`, `quickstart`/`init` create no adapter files, yet the handoff
  prompt still opened by telling the receiving agent to first read a non-existent
  `AGENTS.md`/`CLAUDE.md`. The prompt now names adapter files only for explicitly
  selected agents and otherwise points at `docs/llm-wiki/index.md`.

### Changed

- **`init`/`quickstart` with no mode flag now reads as guidance, not an error.** Running
  either with neither `--dry-run` nor `--write` previously printed a `Blocked` report
  (exit 2), which read as a failure. It now renders `Ready (needs --write)` with a
  `Next Step` and exits 0 (matching the `next` command's `ready` result). Requesting
  both `--dry-run` and `--write` at once is still rejected.
- **The handoff `Next Step` now explains the workflow.** It spells out that the
  `Handoff Prompt` is not run by the CLI but pasted into a coding agent (Claude Code /
  Codex) opened in the repo — which then reads the code and fills in the docs
  (including per-domain `domains/*.md`) for a human to review and mark `verified`.
- **`quickstart` output is brownfield-aware.** The skipped count is annotated with its
  reason (e.g. `skipped: 18 (18 already exist, kept)`), and when a wiki already exists
  so nothing new is created, a note points to enriching the existing docs via the
  handoff prompt (or re-scaffolding with `--existing overwrite`) instead of reading as
  "the tool did nothing".

## 1.14.0 — 2026-07-16

Stdlib-server detection (Gate 19) — the final minor of the "detect & adapt breadth"
line. Additive and opt-in; CLI, `--format json`, the programmatic API, and the
frontmatter contract are unchanged, and no runtime dependency is added.

### Changed

- Role inference now classifies a Go `net/http` server and a Python stdlib HTTP server
  (`http.server`/`socketserver`) as `backend` instead of `library`, via a bounded,
  exclusion-guarded source scan: a Go file that imports `net/http` **and** calls
  `ListenAndServe`/`http.Serve`, or a Python file that imports `http.server`/`socketserver`
  **and** starts a server (`serve_forever` / `HTTPServer(...)`).

### Notes

- One-directional and conservative: the signal only promotes `library`→`backend`, only on
  a strong import + server-start pair, and never demotes an existing `backend`. An
  `http.client`-only library stays `library`. Recognition only — a read-only source scan
  (maxDepth 4, file cap, skips vendored/test/example dirs); no framework dependency
  required; zero-dependency preserved. Scope: `GATE_REVIEW.md` (Gate 19). This completes
  the `1.12`–`1.14` detect & adapt breadth line.

## 1.13.0 — 2026-07-16

Infra/DevOps project profile (Gate 18) — the second minor of the "detect & adapt
breadth" line. Additive and opt-in; CLI, `--format json`, the programmatic API, and
the frontmatter contract are unchanged, and no runtime dependency is added.

### Added

- A new `infra` project type. `detectInfra` recognizes Docker (`Dockerfile`), Docker
  Compose (`docker-compose.y*ml`/`compose.y*ml`), Kubernetes (a top-level or
  conventional-directory `*.yaml`/`*.yml` carrying both `apiVersion:` and `kind:`),
  Helm (`Chart.yaml`), and Terraform (`*.tf`).
- An infra document set created by `init` (`profiles/infra.md`, `DEPLOYMENT.md`,
  `RUNBOOK.md`, `SERVICE_TOPOLOGY.md`).

### Notes

- `infra` is a **fallback** type: it is chosen only when no app signal
  (frontend/backend/library/mobile) is present, so a containerized app repo (a backend
  with a `Dockerfile`) keeps its app type and existing outputs are byte-identical — only
  genuine IaC-first repos (previously `unknown`) become `infra`.
- Recognition only: no cluster/registry access, no deploy, no dependency graph parsed
  (zero-dependency preserved); a bounded, exclusion-guarded scan. Scope: `GATE_REVIEW.md`
  (Gate 18).

## 1.12.0 — 2026-07-16

Mobile project profile (Gate 17) — the lead minor of the post-`1.11` "detect &
adapt breadth" line. Additive and opt-in; CLI, `--format json`, the programmatic
API, and the frontmatter contract are unchanged, and no runtime dependency is added.

### Added

- A new `mobile` project type. `detectMobile` recognizes Android
  (`build.gradle`(.kts)/`settings.gradle` with the Android Gradle plugin or AndroidX,
  or a nested `AndroidManifest.xml`), Flutter (`pubspec.yaml` with a `flutter:` section
  / `sdk: flutter`), Apple/iOS (a `Podfile`, an Apple-platform `Package.swift`, or an
  `*.xcodeproj`/`*.xcworkspace`), and React Native (a `react-native` dependency).
- A mobile document set created by `init` (`profiles/mobile.md`, `PLATFORM_MATRIX.md`,
  `SCREENS.md`, `BUILD_RELEASE.md`).

### Fixed

- An Android `build.gradle` project was misclassified as JVM `library`; mobile signals
  now take precedence in `decideType`, so it is detected as `mobile`.

### Notes

- Recognition only: no build tool (Gradle/Xcode/CocoaPods) is invoked and no dependency
  graph is parsed (zero-dependency preserved). Detection uses manifest signals plus a
  bounded, exclusion-guarded scan. Repos with no mobile signal are byte-identical
  (a plain JVM/Dart project is not reclassified). Scope: `GATE_REVIEW.md` (Gate 17).

## 1.11.1 — 2026-07-16

Behavior-preserving internal refactor: the monolithic `src/commands.js` was split
into focused sibling modules under `src/commands/`. No user-facing change — the
CLI, `--format json` output, the programmatic API (the frozen `commands` map and
individual exports), and the frontmatter contract are byte-identical, and no
runtime dependency is added.

### Changed

- Extracted reusable logic out of `src/commands.js` (~4,119 → ~1,612 lines) into
  `src/commands/{references,findings,scans,wiki-graph,adapters,wiki-files,fix-migrate,domains,doc-templates}.js`,
  wired back through a barrel re-export so every `from "./commands.js"` import and
  the public API surface stay identical. Dependencies are one-directional (leaf
  parsers → wiki-graph/adapters → scans → fix-migrate → `commands.js`);
  `migrateCommand` stays in `commands.js` because it calls the `audit` pipeline,
  which keeps the module graph acyclic (same pattern as `graphCommand`/`statsCommand`).

## 1.11.0 — 2026-07-15

Cross-repository knowledge links (Gate 15→16). Recognize a reserved, non-fetching
cross-repo reference scheme so cross-repo references stop tripping the missing-target
rules — the last planned `1.x` minor. Additive; CLI, JSON, programmatic-API, and
frontmatter contracts unchanged, and no runtime dependency is added.

### Added

- A reserved cross-repo reference scheme `repo:<name>/<path>` (alongside existing
  `http(s)://` URLs) recognized as external in `[[wiki links]]` and in
  `source_files` / `evidence` / `related`. Recognized references are treated as
  external — not flagged `wiki_link.missing` / `related.missing` /
  `source_files.missing` / `evidence.missing` / `markdown_link.missing` — but are
  NEVER fetched or verified (verification would need network/git). This also hardens
  the classifier so URL-form `[[..]]` wiki links stop emitting false
  `wiki_link.missing`. Source: `src/commands.js` (`isCrossRepoReference`,
  `isExternalSourceReference`).

### Notes

- Recognition only — no network, no git, no new dependency (zero-runtime-dependency
  preserved). Additive: local (in-repo) resolution is unchanged; a genuinely missing
  local link is still flagged. Scope: `GATE_REVIEW.md` (Gate 16, accepted). Actually
  following/resolving cross-repo references stays out of scope (a future major, if
  ever). This completes the split `1.7`–`1.11` roadmap line.

## 1.10.0 — 2026-07-15

Monorepo profile (Gate 15). An opt-in `monorepo` command validates each workspace
package's wiki and aggregates the results. Additive; the single-repo CLI, JSON,
programmatic-API, and frontmatter contracts are unchanged, and no runtime
dependency is added.

### Added

- `llm-wiki monorepo` — detects npm/yarn `workspaces` (an array or `{ packages }`),
  runs the existing cwd-parameterized validate over each package that has a
  `docs/llm-wiki/`, and aggregates. The result carries a strictly additive
  `packages[]` roll-up (path, per-package result, finding count) plus
  package-path-prefixed `findings` that drive the exit code. Each package honors its
  own `llm-wiki.config.json`. pnpm / `pnpm-workspace.yaml` are reported as
  unsupported (YAML is not parsed — zero dependency). Source: `src/detector.js`
  (`detectWorkspaces`), `src/commands.js` (`monorepoCommand`). Exposed on the CLI
  and the programmatic-API `commands` map.

### Notes

- Opt-in and additive: the new `packages[]` field and per-package findings appear
  only in the `monorepo` command, so single-repo command output is byte-identical.
  Read-only aggregation; the `1.0.0` contracts and zero-runtime-dependency policy are
  preserved. Scope: `GATE_REVIEW.md` (Gate 15, accepted). Deeper globs and
  pnpm/YAML workspaces are deferred; cross-repo links are the next minor (`1.11`).

## 1.9.0 — 2026-07-15

Visibility governance (Gate 14). Opt-in consistency lints for the already-required
`visibility` field, built on the 1.8 config `rules` toggle. Additive and opt-in;
CLI/JSON/programmatic-API/frontmatter contracts unchanged; no runtime dependency
added.

### Added

- Two opt-in, off-by-default, warning-level, read-only lints that reuse the
  sensitive-info scan:
  - `visibility.public_sensitive` — a `visibility: public` document whose content
    matches the sensitive-info scan (a public doc must not carry sensitive-looking
    values).
  - `visibility.declared_mismatch` — a `contains_sensitive_info: false` document
    whose content matches the scan (the declaration contradicts the content).
  Enable either per project via the `rules` map (e.g.
  `"visibility.public_sensitive": "warning"`). The raw sensitive value is never
  included in the finding — only a redacted count. Source: `src/commands.js`.
- Policy: `docs/llm-wiki/VISIBILITY.md` documents the `internal`/`restricted`/`public`
  levels and the value-vs-content consistency policy.

### Notes

- Additive/opt-in and read-only; the rules never default to `error`/`blocked`
  (preserving the additive `1.0.0` invariant), the `sensitive.*` category stays
  non-toggleable, and this checks value-vs-content consistency only — not access
  control. Scope: `GATE_REVIEW.md` (Gate 14, accepted). Next planned minor: `1.10`
  monorepo profile.

## 1.8.1 — 2026-07-15

Config schema growth, part 2 — custom document sets and template overrides. These
complete Gate 13's three config features (rule toggles shipped in 1.8.0). Additive
and opt-in; CLI/JSON/programmatic-API/frontmatter contracts unchanged; no runtime
dependency added.

### Added

- Custom document sets: a `requiredDocs` array in `llm-wiki.config.json` adds
  project-specific required documents to the core/profile set, checked by the same
  `structure.required_doc` machinery (validation only — `init` does not scaffold
  arbitrary custom docs). Source: `src/config-file.js`, `src/commands.js`.
- Template overrides: a `templates` map points a generated wiki doc at a
  project-local template. Only the override's body is used — the standard CLI
  frontmatter always wraps it, so an override can NEVER set `status: verified` (a
  hard, structural guardrail); a missing override file falls back to the built-in
  template. Source: `src/commands.js`.
- `doctor` echoes `requiredDocs` and `templates` counts in its config line.

### Notes

- Additive/opt-in; the `1.0.0` contracts and the zero-runtime-dependency policy are
  preserved. Scope: `GATE_REVIEW.md` (Gate 13, accepted). This completes the config
  schema growth line; visibility governance is the next planned minor (`1.9`).

## 1.8.0 — 2026-07-15

Config schema growth — per-project rule toggles (Gate 13). The first feature slice
of the config-schema-growth line, built on the 1.7.2 enabling prep. Additive and
opt-in; the CLI, JSON, programmatic-API, and frontmatter contracts are unchanged,
and no runtime dependency is added.

### Added

- Per-project **rule toggles**: a `rules` map in `llm-wiki.config.json` turns a
  finding rule off or overrides its severity —
  `{ "rule.id": "off" | "blocked" | "error" | "warning" | "info" }`. Applied
  centrally over `audit`/`status`/`validate-frontmatter` findings (so `validate`
  and `next` inherit it), across the CLI, programmatic API, and MCP via the 1.7.2
  unified `resolveOptions`. Only registry rules are toggleable, and the
  sensitive-info category is never toggleable — config can never disable secret
  detection. Source: `src/config-file.js`, `src/commands.js`.
- `content.thin_body` — an opt-in enrichment lint (off by default) that flags wiki
  content documents with very little body prose. Enable it per project by setting
  `"content.thin_body"` in the `rules` map. It dogfoods the toggle machinery.
  Source: `src/commands.js`.
- `doctor` echoes the active rule-toggle count in its `llm_wiki_config` line.

### Notes

- Additive/opt-in; explicit/CLI values still win and the zero-runtime-dependency
  policy is preserved. Scope: `GATE_REVIEW.md` (Gate 13, accepted). The
  severity-registry consolidation pre-work was audited as behavior-preserving (0
  push-site/registry mismatches). Custom document sets and template overrides —
  the rest of Gate 13 — follow in `1.8.x`.

## 1.7.2 — 2026-07-15

Enabling prep for config schema growth (Gate 13). Additive and backward-compatible
— no CLI, JSON, programmatic-API, or frontmatter contract change, and no runtime
dependency added. Config now resolves consistently across all three surfaces, and
init/quickstart/doctor make it observable.

### Added

- `resolveOptions(overrides)` — a config-aware async companion to `normalizeOptions`
  in the programmatic API: it merges the project's `llm-wiki.config.json` (from
  `cwd`) like the CLI does and returns `{ options, errors }`. The sync
  `normalizeOptions` and the frozen `commands` map are unchanged. Source:
  `src/index.js`, `src/cli.js`.
- `init` / `quickstart --write` scaffold a minimal `llm-wiki.config.json` at the
  project root (seeded with the detected type and selected agents), additive and
  preview-first, and never overwriting an existing config. Source: `src/commands.js`.
- `doctor` echoes the effective config (`llm_wiki_config: present (type=...,
  agents=...)`, or a `present (invalid: N errors)` note) instead of a bare
  present/absent.

### Changed

- Config loading moved below the command layer: the MCP server now merges the
  inspected project's `llm-wiki.config.json` on every `tools/call` (a malformed
  config surfaces as `isError`), so the CLI, programmatic API, and MCP resolve the
  same effective options. Source: `src/cli.js` (`applyProjectConfig`),
  `src/mcp/dispatch.js`. Previously only the CLI merged config (the Gate 11 honest
  limit).

### Notes

- Additive/opt-in: explicit/CLI values still win, config only fills unset fields and
  can additively turn `strict` on; the `1.0.0` contracts and the zero-runtime-
  dependency policy are preserved. Scope: `GATE_REVIEW.md` (Gate 13, proposed). This
  is the enabling prep that lets real config usage accrue before `1.8` grows the
  schema (custom document sets, rule toggles, template overrides).

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
