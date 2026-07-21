---
title: LLM-WIKI Governance Package Verification Report
tags:
  - llm-wiki
  - package
  - verification
  - stable
status: needs_review
doc_type: verification_report
project: llm-wiki-governance
last_updated: 2026-07-15
author: ai-generated
last_edited_by: Claude Code
wiki_block_version: v1
source_files:
  - package.json
  - src/commands.js
  - src/release-notes.js
  - tests/verification.test.js
related:
  - README.md
  - GATE_REVIEW.md
  - RELEASE_CHECKLIST.md
visibility: internal
contains_sensitive_info: false
---

# LLM-WIKI Governance Package Verification Report

This report records verification coverage for the stable `1.x` release line (the version in `package.json`, matched against the release tag). It is version-agnostic.

## Automated Coverage

The Node test suite covers:

- zero-base project `init --dry-run`
- Front-end, Back-end, and Full Stack detection paths
- zero-base project `init --write`
- uninitialized wiki validation collapsing to one confirmation-oriented finding
- `init --write --existing skip` preserving existing wiki docs
- `init --write --existing overwrite` rewriting existing wiki docs while preserving append-only `docs/llm-wiki/log.md`
- selected Codex adapter creation without overwriting existing adapter files
- existing LLM-WIKI frontmatter validation
- audit-backed `validate`
- `migrate --dry-run`
- `migrate --apply` block-version upgrade under the accepted `fix`-engine scope, preserving `verified` docs (GATE_REVIEW Gate 8)
- `release-notes --body-only` change-body emission and its sensitive-info block (exit 2, body withheld, on a match)
- Korean UTF-8 content audit without mojibake findings
- sensitive-looking value redaction
- repeated `--profile`, repeated `--agent`, and `--agent all`
- package release readiness output in `doctor`
- package metadata for npmjs public stable publish
- evidence span/reference validation, body `## Evidence` alignment, and strict-mode evidence severity escalation
- UTF-8 Markdown report output with `needs_review` frontmatter

## Local Commands

Run before publishing:

```bash
node --test tests/*.test.js
node bin/llm-wiki.js validate-frontmatter
node bin/llm-wiki.js doctor --format markdown
node bin/llm-wiki.js init --dry-run --type frontend --agent codex
npm pack --dry-run
```

## Expected Repository Result

- package: `llm-wiki-governance`
- version: the value in `package.json` (single source; matched against the release tag)
- publish registry: `https://registry.npmjs.org`
- package-level `.npmrc`: not required
- public source repository: `https://github.com/Dowon-Kim7949/llm-wiki-governance`
- migration apply: applies the accepted `fix`-engine scope, preserving `verified` docs (GATE_REVIEW Gate 8)
- report output: UTF-8 Markdown with `needs_review` frontmatter

## Residual Risk

- macOS/Linux shell execution should run in release CI before publish.
- `migrate --apply` writes only the accepted mechanical scope; broader migration (Tier B fields, path repair, `verified` edits, status changes) stays out of scope until separately gated.
- Fixture tests cover representative project detection, not every framework ecosystem.
- CI artifact conventions remain a team decision.
- CLI parsing remains intentionally small and does not support combined short flags.
