---
title: LLM-WIKI Standard Package
tags:
  - llm-wiki
  - package
  - cli
  - stable
status: needs_review
doc_type: package_readme
project: llm-wiki-standard
last_updated: 2026-07-08
author: ai-generated
last_edited_by: Codex
wiki_block_version: v1
source_files:
  - package.json
  - src/cli.js
  - src/commands.js
  - templates/github-actions/llm-wiki-validate.yml
  - tests/verification.test.js
related:
  - GATE_REVIEW.md
  - VERIFICATION.md
  - RELEASE_CHECKLIST.md
visibility: internal
contains_sensitive_info: false
---

> Language: [English](./README.md) | [한국어](./README.ko.md)

# LLM-WIKI Standard Package

`@dowonk-7949/llm-wiki-standard` is a CLI package for creating and validating a common LLM-WIKI documentation structure across local terminals, CI, Codex, Claude Code, and candidate adapter files.

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

- Detects a project type from local signals, or accepts `--type`.
- Creates the common `docs/llm-wiki` document structure.
- Creates selected adapter files when absent, such as `AGENTS.md` or `CLAUDE.md`.
- Validates frontmatter, encoding, local markdown links, `[[wiki links]]`, adapter entrypoints, and sensitive-info rules.
- Publishes the LLM-WIKI frontmatter contract as `rules/frontmatter.schema.json` and validates frontmatter against the same runtime contract.
- Checks that local `source_files` entries in wiki frontmatter exist.
- Prints a handoff prompt for Codex or Claude Code with frontend, backend, fullstack, or library evidence focus.
- Keeps CLI-generated documents in `needs_review`.

## What The CLI Does Not Do

- It does not automatically run Codex or Claude Code.
- It does not read every source file and complete domain knowledge by itself.
- It does not promote documents to `verified`.
- It does not overwrite existing adapter files.
- It does not overwrite `docs/llm-wiki/log.md`.
- It does not enable `migrate --apply`; that remains blocked.

## Commands

| Command | When to use |
| --- | --- |
| `llm-wiki doctor` | Check local runtime, package readiness, and project detection. |
| `llm-wiki status` | Show initialization state, document status counts, missing docs, selected adapter state, markdown link findings, and source file reference findings. |
| `llm-wiki quickstart --dry-run` | Preview the setup and handoff prompt without writing files. |
| `llm-wiki quickstart --write` | Create missing wiki files, validate frontmatter, and print the Codex/Claude Code handoff prompt. |
| `llm-wiki handoff` | Print the next prompt for Codex or Claude Code after setup, including project-type-specific evidence focus. |
| `llm-wiki prompt --task <name>` | Print repeatable post-wiki task prompts for feature, fix, refactor, docs-sync, and OKF extraction workflows. |
| `llm-wiki init --dry-run` | Preview files that would be created. |
| `llm-wiki init --write` | Create missing wiki files and selected adapter files. |
| `llm-wiki validate-frontmatter` | Check frontmatter only. |
| `llm-wiki validate` | Run structure and safety validation for local checks or CI. |
| `llm-wiki audit` | Run broader audit reporting. |
| `llm-wiki migrate --dry-run` | Prepare a reviewable migration plan without writing files. |

Command options are intentionally scoped. For example, `validate --write` and `handoff --existing overwrite` are rejected because those options do not belong to those commands.

Validation-style commands include `findingSummary` in JSON output and a `Finding Summary` section in text output, grouped by severity and category for CI reporting.

Use command-specific help when you are unsure:

```bash
npx llm-wiki help quickstart
npx llm-wiki help status
```

To save the handoff prompt as a reviewable report:

```bash
npx llm-wiki handoff --agent codex --out docs/llm-wiki/tasks/initial-enrichment.prompt.md
```

To save an ongoing task prompt as a reviewable report:

```bash
npx llm-wiki prompt --task feature --agent codex --out docs/llm-wiki/tasks/feature.prompt.md
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

## Common Options

- `--cwd <path>`: project root to inspect or write.
- `--task <feature|fix|refactor|docs-sync|okf-extract>`: task prompt preset for `llm-wiki prompt`.
- `--type <frontend|backend|fullstack|library|mixed|unknown>`: explicit project type.
- `--profile <profile>`: additional profile, repeatable.
- `--agent <codex|claude|antigravity|all>`: selected adapter target, repeatable.
- `--format <text|json|markdown>`: output format.
- `--out <path>`: write a report file.
- `--strict`: treat warnings as failures.
- `--minimal`: create only core documents.
- `--write`: allow write operations for commands that require explicit write approval.
- `--existing <skip|overwrite>`: existing wiki document handling, default `skip`.

`--agent antigravity` remains an adapter candidate only. The CLI can report or suggest the candidate adapter, but it does not print an Antigravity handoff prompt until that tool contract is confirmed. Use `--agent codex` or `--agent claude` for handoff prompts.

## Safety Policy

- Markdown is read and written as UTF-8.
- Sensitive-looking raw values are not printed or written to reports.
- Existing wiki documents are kept by default and rewritten only with explicit `--existing overwrite`.
- Local `source_files` entries should point to files that exist from the project root.
- Local markdown links inside `docs/llm-wiki` should point to existing relative files; URLs, `mailto:` links, and anchor-only links are ignored.
- `[[wiki links]]` inside `docs/llm-wiki` should resolve to an existing wiki file path, basename, frontmatter `title`, or frontmatter `aliases` entry.
- In `--strict` mode, `verified` documents must include `reviewed_by` and `reviewed_at`; standard mode keeps this as a warning.
- `rules/frontmatter.schema.json` defines required frontmatter fields, valid `status` and `visibility` values, optional `aliases`, and review metadata for `verified` documents.
- `docs/llm-wiki/log.md` is append-only and is not overwritten.
- Existing `AGENTS.md`, `CLAUDE.md`, and `ANTIGRAVITY.md` files are not overwritten.
- `migrate --apply` remains blocked until automatic migration scope is intentionally accepted.
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

To publish version `0.1.2` after verification:

```bash
git tag v0.1.2
git push origin v0.1.2
```

## Related Documents

- `GATE_REVIEW.md`: stable release gate decisions and caveats.
- `VERIFICATION.md`: verification record.
- `RELEASE_CHECKLIST.md`: stable release checklist.
