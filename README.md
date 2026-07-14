> Language: [English](./README.md) | [한국어](./README.ko.md)

# LLM-WIKI Standard Package

`@dowonk-7949/llm-wiki-standard` is a CLI package that creates and validates a standardized project knowledge base for AI agents. It organizes architecture, domains, APIs, coding conventions, technical decisions, workflows, and operational knowledge into reusable LLM-WIKI documents.

Without a reusable project knowledge base, agents such as Codex and Claude Code may need to inspect large parts of the codebase again for every maintenance task. With LLM-WIKI, an agent starts from `docs/llm-wiki/index.md`, reads the documents related to the current task, and inspects only the source files needed to verify or complete the work. This can reduce repeated code exploration, token usage, and the risk of missing project-specific rules.

Typical use cases include legacy project maintenance, feature development, incident response, onboarding new maintainers, complex project handovers, and sharing project knowledge across multiple AI agents.

## Why LLM-WIKI

```text
Without LLM-WIKI:
task request -> inspect the codebase -> rediscover structure and rules -> perform the task

With LLM-WIKI:
task request -> read index.md -> read relevant wiki docs -> inspect required source files -> perform the task
```

LLM-WIKI acts as a reusable project knowledge index, not as a replacement for source inspection. Wiki documents guide the agent to the relevant context, while `source_files` and precise `evidence` references keep important claims traceable to actual code. The amount of token and exploration-time reduction depends on project size, documentation coverage, and how current the wiki remains.

The CLI does not finish the wiki by itself. It creates the safe starting structure, keeps generated documents as `needs_review`, and prints the next prompt to run in Codex or Claude Code.

## Recommended Flow

```text
CLI setup
-> Codex or Claude Code enrichment
-> human review
-> optional verified approval
-> CI validation
```

| Stage | Owner | Purpose |
| --- | --- | --- |
| CLI setup | `llm-wiki` | Detect the project, create missing wiki files, create selected adapter files, validate frontmatter, and print the next agent prompt. |
| Agent enrichment | Codex or Claude Code | Read the actual code and fill the wiki with source-backed architecture, domain, API, workflow, and operations details. |
| Human review | Maintainer | Check accuracy, remove uncertain claims, decide whether a document may move from `needs_review` to `verified`. |
| CI validation | `llm-wiki validate` | Check structure, selected adapter entrypoints, frontmatter, local markdown links, wiki links, source file references, encoding, and sensitive-info rules. |

## What Gets Created

The exact files depend on `--type`, `--profile`, and `--minimal`. A standard setup starts with a structure like this:

```text
AGENTS.md or CLAUDE.md
docs/llm-wiki/
|-- index.md
|-- README.md
|-- project-profile.md
|-- ARCHITECTURE_CONVENTIONS.md
|-- DOMAIN_FEATURES.md
|-- GLOSSARY.md
|-- log.md
|-- domains/
|   `-- 00_overview.md
|-- profiles/
|   `-- <project-type>.md
`-- templates/
    |-- DECISION_LOG.template.md
    `-- TASK_PROMPT.template.md
```

Frontend, backend, fullstack, library, and OKF profiles add focused documents such as component inventories, API contracts, data models, security and operations guides, end-to-end workflows, public API references, and OKF knowledge templates. For backend and fullstack projects, `init` also detects business-domain directories (for example `src/modules/*`, `app/domains/*`, `internal/domain/*`) and creates a per-domain document (`docs/llm-wiki/domains/NN_<name>.md`, `doc_type: domain`) linked from `domains/00_overview.md`. The generated files are safe starting drafts; Codex or Claude Code enriches them from real project evidence.

## Requirements

- Node.js 18.18.0 or newer.
- A project directory that the CLI may inspect and, with explicit `--write`, update.
- Codex or Claude Code when you want agent-assisted wiki enrichment. The CLI itself remains useful for initialization, audit, validation, and CI without an agent running.

## Quick Start

From a project root:

```bash
npm install -D @dowonk-7949/llm-wiki-standard
npx llm-wiki quickstart --write --type frontend --agent codex
```

For Claude Code:

```bash
npm install -D @dowonk-7949/llm-wiki-standard
npx llm-wiki quickstart --write --type frontend --agent claude
```

`quickstart --write` runs the CLI setup steps and then prints this kind of message:

```text
CLI 작업이 완료되었습니다. Codex 또는 Claude Code에게 넘어가서 아래 프롬프트를 실행하세요.
```

Copy the printed handoff prompt into Codex or Claude Code. The prompt tells the agent to read the adapter file and `docs/llm-wiki/index.md`, follow project-type-specific evidence focus, enrich the wiki from real source files, keep documents as `needs_review`, and leave `verified` approval to a human reviewer.

Use `quickstart --dry-run` when you only want a preview. `--dry-run` and `--write` are mutually exclusive:

```bash
npx llm-wiki quickstart --dry-run --type frontend --agent codex
```

## If You Prefer Step-by-Step

```bash
npx llm-wiki doctor
npx llm-wiki init --dry-run --type frontend --agent codex
npx llm-wiki init --write --type frontend --agent codex
npx llm-wiki validate-frontmatter
npx llm-wiki handoff --agent codex
```

After the initial wiki is created and enriched, generate repeatable task prompts for ongoing work:

```bash
npx llm-wiki prompt --task feature --agent codex
npx llm-wiki prompt --task docs-sync --agent codex
npx llm-wiki prompt --task okf-extract --agent codex
```

After the agent finishes enriching the wiki, run:

```bash
npx llm-wiki validate --type frontend --agent codex
```

Use `validate` in CI. Add `--strict` when warnings should fail the build.

To inspect the current wiki state at any point:

```bash
npx llm-wiki status --agent codex
```

## Starting In Codex

Run:

```bash
npx llm-wiki quickstart --write --type frontend --agent codex
```

Then paste the printed handoff prompt into Codex. The Codex adapter file is `AGENTS.md`; it should point Codex to `docs/llm-wiki/index.md`.

Expected Codex work:

- Read `AGENTS.md` and `docs/llm-wiki/index.md`.
- Inspect real source files before writing claims.
- Fill missing `docs/llm-wiki` content with source-backed details.
- Keep generated or edited documents as `needs_review`.
- Append review notes to `docs/llm-wiki/log.md`.
- Do not promote documents to `verified`.

## Starting In Claude Code

Run:

```bash
npx llm-wiki quickstart --write --type frontend --agent claude
```

Then paste the printed handoff prompt into Claude Code. The Claude Code adapter file is `CLAUDE.md`; it should point Claude Code to `docs/llm-wiki/index.md`.

Expected Claude Code work is the same as Codex work: read the adapter and wiki entrypoint, inspect source files, enrich the wiki, keep `needs_review`, and leave `verified` approval to a human reviewer.

## What The CLI Does

- Detects a project type from local signals across Node, Python, Go, Rust, and JVM manifests, or accepts `--type`.
- Creates the common `docs/llm-wiki` document structure.
- Creates selected adapter files when absent, such as `AGENTS.md` (Codex), `CLAUDE.md` (Claude Code), `.cursor/rules/llm-wiki.mdc` (Cursor), `.github/copilot-instructions.md` (GitHub Copilot), `.windsurf/rules/llm-wiki.md` (Windsurf), or `GEMINI.md` (Gemini CLI). Tools whose file contract is unconfirmed (JetBrains AI, Antigravity) stay info-level candidates and are not written.
- Validates frontmatter, encoding, local markdown links, `[[wiki links]]`, adapter entrypoints, and sensitive-info rules.
- Publishes the LLM-WIKI frontmatter contract as `rules/frontmatter.schema.json` and validates frontmatter against the same runtime contract.
- Checks that local `source_files` entries in wiki frontmatter exist.
- Checks optional `evidence` entries for small precise references such as `src/file.ts#L10-L20`, `src/file.ts#symbol:Name`, `README.md#section:Usage`, or `src/routes.ts#route:/users`.
- Prints a handoff prompt for Codex or Claude Code with frontend, backend, fullstack, or library evidence focus.
- Keeps CLI-generated documents in `needs_review`.

## What The CLI Does Not Do

- It does not automatically run Codex or Claude Code.
- It does not read every source file and complete domain knowledge by itself.
- It does not promote documents to `verified`.
- It does not overwrite existing adapter files.
- It does not overwrite `docs/llm-wiki/log.md`.
- It does not edit `verified` documents' content during `fix --write` or `migrate --apply`, and only the opt-in `drift --downgrade` ever changes a document's `status` (moving drifted `verified` docs to `needs_review`).

## Commands

| Command | When to use |
| --- | --- |
| `llm-wiki doctor` | Check local runtime, package readiness, and project detection. |
| `llm-wiki status` | Show initialization state, document status counts, missing docs, selected adapter state, link findings, source file reference findings, and wiki graph summary. |
| `llm-wiki next` | Recommend the next review, repair, or setup actions from audit findings and wiki graph data. |
| `llm-wiki explain <finding>` | Explain a finding rule and show safe remediation steps. |
| `llm-wiki quickstart --dry-run` | Preview the setup and handoff prompt without writing files. |
| `llm-wiki quickstart --write` | Create missing wiki files, validate frontmatter, and print the Codex/Claude Code handoff prompt. |
| `llm-wiki handoff` | Print the next prompt for Codex or Claude Code after setup, including project-type-specific evidence focus. |
| `llm-wiki prompt --task <name>` | Print repeatable post-wiki task prompts for feature, fix, refactor, docs-sync, and OKF extraction workflows. |
| `llm-wiki init --dry-run` | Preview files that would be created. |
| `llm-wiki init --write` | Create missing wiki files and selected adapter files. |
| `llm-wiki validate-frontmatter` | Check frontmatter only. |
| `llm-wiki validate` | Run structure and safety validation for local checks or CI. Add `--changed` to scope findings to changed documents (fast pre-commit/CI). |
| `llm-wiki audit` | Run broader audit reporting. |
| `llm-wiki migrate` | Report the `wiki_block_version` upgrade gap and preview the changes; add `--apply` to upgrade documents to the current contract (reuses the `fix` scope, preserves `verified`). |
| `llm-wiki fix` | Preview safe autofixes inside `docs/llm-wiki`; add `--write` to apply them. |
| `llm-wiki drift` | Report `evidence.stale` drift on `verified` documents; add `--downgrade` to move drifted docs to `needs_review`. |
| `llm-wiki release-notes` | Generate a `needs_review` release-notes document from conventional commits since the last `v*` tag. |

Command options are intentionally scoped. For example, `validate --write` and `handoff --existing overwrite` are rejected because those options do not belong to those commands.

Validation-style commands include `findingSummary` in JSON output and a `Finding Summary` section in text output, grouped by severity and category for CI reporting.

CLI exit codes are stable for local automation and CI:

| Exit code | Meaning |
| --- | --- |
| `0` | The command completed without errors or blocked findings. Non-strict warnings do not fail the command. |
| `1` | Validation found an error, or `--strict` promoted a warning to failure. |
| `2` | The requested operation or selected workflow is blocked by safety policy. |
| `3` | The command, argument, option, or format is invalid. |

Use command-specific help when you are unsure:

```bash
npx llm-wiki help quickstart
npx llm-wiki help status
npx llm-wiki help next
npx llm-wiki help explain
```

To save the handoff prompt as a reviewable report:

```bash
npx llm-wiki handoff --agent codex --out docs/llm-wiki/tasks/initial-enrichment.prompt.md
```

To save an ongoing task prompt as a reviewable report:

```bash
npx llm-wiki prompt --task feature --agent codex --out docs/llm-wiki/tasks/feature.prompt.md
```

To ask the CLI for the next useful maintenance action:

```bash
npx llm-wiki next --agent codex
```

To explain a validation finding and safe remediation steps:

```bash
npx llm-wiki explain wiki_link.missing
```

Pass `--type frontend`, `--type backend`, `--type fullstack`, or `--type library` when you want the handoff prompt to use a specific evidence focus instead of auto-detection.

`llm-wiki prompt --task feature`, `fix`, and `refactor` instruct the agent to read `docs/llm-wiki/index.md`, inspect related wiki documents and real source files, plan the work, update code, update affected LLM-WIKI documents, append `docs/llm-wiki/log.md`, keep edited docs as `needs_review`, and run relevant tests.

`llm-wiki prompt --task docs-sync` focuses on detecting changed code, finding stale wiki documents, updating only affected documentation, and appending the log. It must avoid unrelated code edits.

`llm-wiki prompt --task okf-extract` prints a prompt-assisted OKF v0.1 extraction workflow. It does not automatically extract knowledge. The prompt uses Markdown plus YAML frontmatter with required `type`, optional `aliases` and `tags`, body wiki links such as `[[Concept Name]]`, and keeps extracted LLM-WIKI documents as `needs_review`.

Use `--profile okf-v0.1` with `status`, `audit`, or `validate` when selected wiki documents should also satisfy the OKF v0.1 frontmatter shape:

```bash
npx llm-wiki validate --profile okf-v0.1
```

The OKF profile requires explicit frontmatter `type`, accepts optional `aliases` and `tags` arrays, and reuses `[[wiki links]]` missing-target validation. It does not infer OKF `type` from LLM-WIKI `doc_type`; keep both fields when a document needs both contracts.

`init --profile okf-v0.1` also creates OKF-oriented templates for `concept`, `project`, `api_reference`, `meeting_note`, and `event` documents under `docs/llm-wiki/templates/`.

It also creates `docs/llm-wiki/OKF_CONVERSION_GUIDE.md`, which explains how to review and explicitly map LLM-WIKI metadata into OKF v0.1 fields without automatic conversion.

## Autofix

`llm-wiki fix` applies a narrow, accepted set of safe remediations inside `docs/llm-wiki`. It previews by default and writes only with `--write`:

```bash
npx llm-wiki fix            # preview the planned fixes, write nothing
npx llm-wiki fix --write    # apply them
```

It only:

- inserts missing mechanical required frontmatter fields (`status`, `visibility`, `contains_sensitive_info`, `wiki_block_version`, `last_updated`, `last_edited_by`, and empty `tags`/`source_files`/`related`);
- adds or completes the body `## Evidence` section from existing frontmatter `evidence` entries;
- creates `needs_review` stubs for broken `related`/markdown-link targets under `docs/llm-wiki/*.md`;
- refreshes `last_updated` only on documents it actually changes.

It never edits `verified` documents' content, never invents `title`/`doc_type`/`project`/`author` or `source_files`/`evidence` values, never enriches placeholder content, and never writes outside `docs/llm-wiki`. Mojibake and sensitive-looking results are skipped, and repeated runs are idempotent. The exact scope is recorded in `GATE_REVIEW.md`.

## Upgrades & Drift

`llm-wiki migrate` keeps an existing wiki in step with the CLI's contract instead of deleting and regenerating it. It reports the `wiki_block_version` gap between each document and the installed CLI, previews by default, and applies with `--apply`:

```bash
npx llm-wiki migrate            # upgrade report + planned changes, write nothing
npx llm-wiki migrate --apply    # bring documents to the current contract
```

It reuses the `fix` scope and additionally upgrades a document's `wiki_block_version` to current once that document conforms. It never edits `verified` documents' content, never changes `status`, and reports documents stamped by a newer CLI without downgrading them (`GATE_REVIEW.md`, Gate 8).

`llm-wiki drift` reports `evidence.stale` drift on `verified` documents — with line-range precision when a source is cited only by exact `#Lx-Ly` evidence — and, only with `--downgrade`, moves drifted documents to `needs_review` (`status` + `last_updated` only, never a promotion to `verified`; Gate 9):

```bash
npx llm-wiki drift              # report drifted verified documents
npx llm-wiki drift --downgrade  # flip drifted verified docs to needs_review
```

## Common Options

- `--cwd <path>`: project root to inspect or write.
- `--task <feature|fix|refactor|docs-sync|okf-extract>`: task prompt preset for `llm-wiki prompt`.
- `--type <frontend|backend|fullstack|library|mixed|unknown>`: explicit project type.
- `--profile <profile>`: additional profile, repeatable.
- `--agent <codex|claude|cursor|copilot|antigravity|all>`: selected adapter target, repeatable. `all` expands to codex/claude/antigravity; select cursor/copilot explicitly.
- `--format <text|json|markdown|html>`: output format. `html` renders a self-contained dashboard for `audit`/`validate`/`status`.
- `--version <x.y.z>`: target version for `release-notes` (defaults to `package.json`).
- `--since <git-ref>`: force the `release-notes` commit range base to `<ref>..HEAD` (useful for regenerating a version after its tag exists).
- `--out <path>`: write a report file.
- `--strict`: treat warnings as failures.
- `--minimal`: create only core documents.
- `--write`: allow write operations for commands that require explicit write approval.
- `--existing <skip|overwrite>`: existing wiki document handling, default `skip`.

`--agent antigravity` remains an adapter candidate only. The CLI can report or suggest the candidate adapter, but it does not print an Antigravity handoff prompt until that tool contract is confirmed. Use `--agent codex`, `--agent claude`, `--agent cursor`, or `--agent copilot` for handoff prompts.

## Configuration

An optional `llm-wiki.config.json` at the project root sets persistent defaults for `type`, `profiles`, `agents`, and `strict`, so you do not have to repeat those flags:

```json
{
  "type": "library",
  "agents": ["codex", "claude"]
}
```

Precedence is CLI flags > config > auto-detection. Malformed config is rejected with exit code `3`, and `doctor` reports whether a config file is present. The schema is intentionally minimal today.

## Evidence Contract

Use three evidence layers together:

- `source_files` lists broad project-root file evidence for the document.
- Optional `evidence` lists precise references to files, lines, symbols, sections, or routes.
- Body `## Evidence` gives reviewers a readable bullet list and must mention each frontmatter `evidence` reference when precise references are present.

```markdown
---
source_files:
  - package.json
  - src/routes/users.ts
evidence:
  - package.json#L1-L5
  - src/routes/users.ts#symbol:loadUsers
  - src/routes/users.ts#route:/users
---

## Evidence

- `package.json#L1-L5` identifies the package metadata used for project context.
- `src/routes/users.ts#symbol:loadUsers` supports the user-loading behavior described above.
- `src/routes/users.ts#route:/users` supports the documented route path.
```

## Safety Policy

- Markdown is read and written as UTF-8.
- Sensitive-looking raw values are not printed or written to reports.
- Existing wiki documents are kept by default and rewritten only with explicit `--existing overwrite`.
- Local `source_files` entries should point to files that exist from the project root.
- Optional `evidence` frontmatter entries should use `file`, `file#L10`, `file#L10-L20`, `file#symbol:Name`, `file#section:Heading`, or `file#route:/path`; local file targets and line ranges are validated.
- When frontmatter `evidence` is present, the document body should include a `## Evidence` section with bullet entries that mention each precise reference.
- Local markdown links inside `docs/llm-wiki` should point to existing relative files; URLs, `mailto:` links, and anchor-only links are ignored.
- `[[wiki links]]` inside `docs/llm-wiki` should resolve to an existing wiki file path, basename, frontmatter `title`, or frontmatter `aliases` entry.
- In `--strict` mode, `verified` documents must include `reviewed_by` and `reviewed_at`, and evidence contract warnings become errors; standard mode keeps these as warnings.
- `verified` documents whose `source_files`/`evidence` files changed in git after they were reviewed are flagged with `evidence.stale` so they can be re-checked. When a source is cited only by exact `#Lx-Ly` evidence, the check narrows to those lines; otherwise it is a file-level heuristic. It is best-effort and skipped silently when git history is unavailable. `llm-wiki drift --downgrade` can move flagged docs to `needs_review`.
- `rules/frontmatter.schema.json` defines required frontmatter fields, valid `status` and `visibility` values, optional `aliases` and `evidence`, and review metadata for `verified` documents.
- `docs/llm-wiki/log.md` is append-only and is not overwritten.
- Existing `AGENTS.md`, `CLAUDE.md`, and `ANTIGRAVITY.md` files are not overwritten.
- `migrate --apply` is enabled under an accepted, preview-first scope (`GATE_REVIEW.md`, Gate 8): it reuses the `fix` scope plus `wiki_block_version` upgrades and never edits `verified` documents' content or changes `status`.
- CLI-created or agent-edited wiki/report documents remain `needs_review` until human review.

## Regenerating Existing Wiki Docs

Use this only when existing LLM-WIKI docs should be regenerated to match the current standard:

```bash
npx llm-wiki quickstart --write --type frontend --agent codex --existing overwrite
```

`--existing overwrite` applies to ordinary wiki documents only. It does not overwrite `docs/llm-wiki/log.md` or existing adapter files.

## Verification

```bash
npm test
npx llm-wiki validate-frontmatter
npx llm-wiki doctor --format markdown
npx llm-wiki prompt --task feature --agent codex
```

## GitHub Actions Example

Copy `templates/github-actions/llm-wiki-validate.yml` to `.github/workflows/llm-wiki-validate.yml` in a project that uses this package. The example runs:

```bash
npm test
npx llm-wiki validate-frontmatter
npx llm-wiki validate --strict --agent codex
```

Change `--agent codex` to the adapter your project uses. Because the example uses `--strict`, verified documents must include `reviewed_by` and `reviewed_at`, and warnings fail the workflow.

## Release Automation

CI runs verification on pull requests and `main` pushes. Publishing is restricted to `v*` tag pushes through `.github/workflows/publish.yml`.

Before automated publish, register an npm Trusted Publisher for GitHub Actions with workflow filename `publish.yml`. The publish job uses the GitHub Environment `npm-release`; configure required reviewers or deployment approval rules for that environment in GitHub UI.

`release-notes` groups conventional commits into Korean-first bilingual sections and can be regenerated for a specific base with `--since`:

```bash
npx llm-wiki release-notes --version 1.0.0 --since v0.1.8 --out docs/llm-wiki/releases/v1.0.0.md
```

To publish version `1.0.0` after verification:

```bash
git tag v1.0.0
git push origin v1.0.0
```

## Related Documents

- `ROADMAP.md`: product direction, implemented phases, near-term priorities, and future work candidates.
- `GATE_REVIEW.md`: stable release gate decisions and caveats.
- `VERIFICATION.md`: verification record.
- `RELEASE_CHECKLIST.md`: stable release checklist.
