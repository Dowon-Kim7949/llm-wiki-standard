---
title: LLM-WIKI Standard Package Release Checklist
tags:
  - llm-wiki
  - package
  - release
  - stable
status: needs_review
doc_type: release_checklist
project: llm-wiki-standard
last_updated: 2026-07-14
author: ai-generated
last_edited_by: Claude Code
wiki_block_version: v1
source_files:
  - package.json
  - README.md
  - README.ko.md
  - VERIFICATION.md
related:
  - GATE_REVIEW.md
visibility: internal
contains_sensitive_info: false
---

# LLM-WIKI Standard Package Release Checklist

Use this checklist before publishing `@dowonk-7949/llm-wiki-standard@1.0.0`.

## Local Verification

- [ ] Run `node --test tests/*.test.js`.
- [ ] Run `node bin/llm-wiki.js validate-frontmatter`.
- [ ] Run `node bin/llm-wiki.js validate --profile okf-v0.1` against an OKF-compatible fixture or consumer project.
- [ ] Run `node bin/llm-wiki.js doctor --format markdown`.
- [ ] Confirm `rules/frontmatter.schema.json` is included in `npm pack --dry-run`.
- [ ] Run `node bin/llm-wiki.js prompt --task feature --agent codex`.
- [ ] Run `node bin/llm-wiki.js prompt --task docs-sync --agent codex`.
- [ ] Run `node bin/llm-wiki.js prompt --task okf-extract --agent codex`.
- [ ] Run `node bin/llm-wiki.js init --dry-run --type frontend --agent codex`.
- [ ] Run `node bin/llm-wiki.js init --write --cwd <zero-base-temp> --type frontend --agent codex`.
- [ ] Run `node bin/llm-wiki.js validate --cwd <zero-base-temp> --type frontend --agent codex`.
- [ ] Run `npm pack --dry-run`.

## Safety Gates

- [ ] Confirm plain `init` without `--dry-run` or `--write` is blocked.
- [ ] Confirm missing `docs/llm-wiki/index.md` produces one confirmation-oriented warning instead of document-level noise.
- [ ] Confirm `init --write` creates missing wiki docs with `status: needs_review`.
- [ ] Confirm `init --write --existing skip` keeps existing wiki docs.
- [ ] Confirm `init --write --existing overwrite` rewrites ordinary wiki docs only.
- [ ] Confirm `docs/llm-wiki/log.md` is not overwritten.
- [ ] Confirm existing adapter files are not overwritten.
- [ ] Confirm adapter checks and suggestions require explicit `--agent` selection.
- [ ] Confirm `prompt --task feature|fix|refactor` includes source inspection, code changes, wiki updates, append-only log updates, `needs_review`, and test guidance.
- [ ] Confirm `prompt --task docs-sync` avoids unrelated code edits.
- [ ] Confirm `prompt --task okf-extract` is prompt-assisted and keeps extracted LLM-WIKI documents as `needs_review`.
- [ ] Confirm `validate` reports missing `[[wiki links]]` and accepts file path, basename, frontmatter `title`, and frontmatter `aliases` targets.
- [ ] Confirm `validate` reports malformed or missing optional `evidence` references and accepts `file`, `file#L10-L20`, `file#symbol:Name`, `file#section:Heading`, and `file#route:/path`.
- [ ] Confirm `validate` reports body `## Evidence` sections that are missing, empty, or not aligned with frontmatter `evidence` entries.
- [ ] Confirm `validate --strict` promotes evidence contract warnings to errors while standard mode keeps them as warnings.
- [ ] Confirm status, audit, and validate results include a `wikiGraph` summary for wiki links, unresolved concepts, aliases, and orphan documents.
- [ ] Confirm `next` recommends prioritized actions from audit findings and wikiGraph without writing files.
- [ ] Confirm `explain <finding>` describes known finding rules and blocks unknown rules.
- [ ] Confirm `--profile okf-v0.1` requires explicit `type`, accepts optional `aliases` and `tags` arrays, and does not infer OKF `type` from LLM-WIKI `doc_type`.
- [ ] Confirm the OKF fixture corpus covers concept, project, person, meeting_note, event, and api_reference documents without unresolved wiki links.
- [ ] Confirm generated wiki drafts include summary, inspection, evidence, open question, and review note sections where applicable.
- [ ] Confirm `init --profile okf-v0.1` creates OKF templates for concept, project, api_reference, meeting_note, and event documents.
- [ ] Confirm `init --profile okf-v0.1` creates `docs/llm-wiki/OKF_CONVERSION_GUIDE.md` and keeps conversion review-assisted, not automatic.
- [ ] Confirm `migrate --apply` is blocked.
- [ ] Confirm sensitive-looking values are redacted and never written raw.

## Release Metadata

- [ ] Confirm package name is `@dowonk-7949/llm-wiki-standard`.
- [ ] Confirm version is `1.0.0`.
- [ ] Confirm `CHANGELOG.md` records the release version at the top.
- [ ] Confirm package has no `publishConfig` override.
- [ ] Confirm package-level `.npmrc` is absent.
- [ ] Confirm `repository.url` points to `https://github.com/Dowon-Kim7949/llm-wiki-standard.git`.
- [ ] Confirm `README.md`, `README.ko.md`, `GATE_REVIEW.md`, `VERIFICATION.md`, and `RELEASE_CHECKLIST.md` mention stable release behavior.
- [ ] Confirm `README.md` starts with language links to English and Korean.
- [ ] Confirm `README.ko.md` is included in `package.json` files.
- [ ] Confirm each bilingual root doc (`README`, `CHANGELOG`, `ROADMAP`) has an in-sync `.ko.md` pair listed in `package.json` files.
- [ ] Confirm `rules/frontmatter.schema.json` matches the runtime frontmatter contract in `src/frontmatter-schema.js`.

## External Verification

- [ ] Run package tests on macOS.
- [ ] Run package tests on Linux.
- [ ] Run basic CLI commands on macOS and Linux shells.
- [ ] Verify install from a clean npm consumer project.
- [ ] Verify install from a clean yarn consumer project.

## Publish

- [ ] Configure npm Trusted Publisher for GitHub Actions with workflow filename `publish.yml`.
- [ ] Configure GitHub Environment `npm-release`; set required reviewers in GitHub UI if human approval is required before publish.
- [ ] Create the release tag after local verification: `git tag v1.0.0`.
- [ ] Push only the release tag to start publish: `git push origin v1.0.0`.
- [ ] Confirm the publish workflow validates the tag version against `package.json`.
- [ ] Verify `npm install -D @dowonk-7949/llm-wiki-standard@1.0.0`.
- [ ] Verify `npx @dowonk-7949/llm-wiki-standard@1.0.0 doctor`.
- [ ] Verify `yarn add -D @dowonk-7949/llm-wiki-standard@1.0.0`.
