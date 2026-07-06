---
title: LLM-WIKI Standard Package Prerelease Checklist
tags:
  - llm-wiki
  - package
  - prerelease
  - checklist
  - needs-review
status: needs_review
doc_type: prerelease_checklist
project: sinkholemonitor-frontend
last_updated: 2026-07-02
author: ai-generated
last_edited_by: Codex
wiki_block_version: v1
source_files:
  - packages/llm-wiki-standard/package.json
  - packages/llm-wiki-standard/GATE_REVIEW.md
  - packages/llm-wiki-standard/VERIFICATION.md
related:
  - packages/llm-wiki-standard/README.md
  - docs/llm-wiki/log.md
visibility: internal
contains_sensitive_info: false
---

# LLM-WIKI Standard Package Prerelease Checklist

Use this checklist before sharing `packages/llm-wiki-standard/` as an internal prerelease candidate.

## Local Verification

- [ ] Run `node --test tests/*.test.js` from `packages/llm-wiki-standard/`.
- [ ] Run `node bin/llm-wiki.js validate-frontmatter` from `packages/llm-wiki-standard/`.
- [ ] Run `node bin/llm-wiki.js init --dry-run --cwd ..\.. --agent claude` from `packages/llm-wiki-standard/`.
- [ ] Run `node bin/llm-wiki.js init --write --cwd <zero-base-temp> --type frontend --agent codex` from `packages/llm-wiki-standard/`.
- [ ] Run `node bin/llm-wiki.js audit --cwd ..\.. --agent claude` from `packages/llm-wiki-standard/`.
- [ ] Run `node packages/llm-wiki-standard/bin/llm-wiki.js validate` from the repository root.
- [ ] Confirm repository warnings are the expected review-only findings listed in `GATE_REVIEW.md`.
- [ ] Run `node bin/llm-wiki.js doctor --format markdown` from `packages/llm-wiki-standard/` and confirm package prerelease readiness is shown.

## Safety Gates

- [ ] Confirm plain `init` without `--dry-run` or `--write` is still blocked.
- [ ] Confirm `init --write` creates missing wiki docs with `status: needs_review`.
- [ ] Confirm `init --write --existing skip` keeps existing wiki docs.
- [ ] Confirm `init --write --existing overwrite` rewrites only wiki docs when explicit and keeps `docs/llm-wiki/log.md`.
- [ ] Confirm `migrate --apply` is still blocked.
- [ ] Confirm adapter checks and suggestions require explicit `--agent` selection.
- [ ] Confirm missing Codex/Claude adapter files can be created only by explicit `init --write --agent ...`.
- [ ] Confirm existing adapter files are not overwritten.
- [ ] Confirm no-agent `audit` and `validate` do not require `CLAUDE.md` or `ANTIGRAVITY.md`.
- [ ] Confirm generated reports keep `status: needs_review`.
- [ ] Confirm sensitive-looking values are redacted and never written raw.

## Release Metadata

- [ ] Confirm package name is `@dowonk-7949/llm-wiki-standard`.
- [ ] Confirm version is `0.0.1-internal.4`.
- [ ] Confirm package has no `publishConfig` override so npmjs default registry is used.
- [ ] Confirm package-level `.npmrc` is absent.
- [ ] Confirm `repository.url` points to `https://github.com/Dowon-Kim7949/llm-wiki-standard.git`.
- [ ] Do not label this package stable while Gate 2 through Gate 4 remain `needs_review`.

## GitHub Packages Historical Release Prep

- [x] Re-authenticate `gh` for `Dowon-Kim7949`.
- [x] Create the private `Dowon-Kim7949/llm-wiki-standard` repository.
- [x] Push the package source to the private repository.
- [x] Push tag `v0.0.1-internal.0`.
- [x] Authenticate npm using an environment token; do not commit the token.
- [x] Run `npm pack --dry-run` from the package staging directory.
- [x] Publish `@dowon-kim7949/llm-wiki-standard@0.0.1-internal.0`.
- [x] Verify consumer install with `npm install @dowon-kim7949/llm-wiki-standard@0.0.1-internal.0`.

## npmjs Public Release Prep

- [x] Switch `Dowon-Kim7949/llm-wiki-standard` repository visibility to public.
- [x] Rename npm package scope to `@dowonk-7949`.
- [x] Remove package-level GitHub Packages `.npmrc`.
- [x] Publish `@dowonk-7949/llm-wiki-standard@0.0.1-internal.1` with `npm publish --access public`.
- [x] Verify `npm install @dowonk-7949/llm-wiki-standard@0.0.1-internal.1`.
- [x] Verify `npx @dowonk-7949/llm-wiki-standard@0.0.1-internal.1 doctor`.
- [x] Verify `yarn add @dowonk-7949/llm-wiki-standard@0.0.1-internal.1`.
- [x] Publish `@dowonk-7949/llm-wiki-standard@0.0.1-internal.2` with `npm publish --access public`.
- [x] Verify `npm install @dowonk-7949/llm-wiki-standard@0.0.1-internal.2`.
- [x] Verify `npx @dowonk-7949/llm-wiki-standard@0.0.1-internal.2 doctor`.
- [x] Verify `yarn add @dowonk-7949/llm-wiki-standard@0.0.1-internal.2`.
- [x] Publish `@dowonk-7949/llm-wiki-standard@0.0.1-internal.3` with `npm publish --access public`.
- [x] Treat `0.0.1-internal.3` as superseded by `0.0.1-internal.4` because `docs/llm-wiki/log.md` overwrite protection was added after publish.
- [x] Publish `@dowonk-7949/llm-wiki-standard@0.0.1-internal.4` with `npm publish --access public`.
- [x] Verify `npm install @dowonk-7949/llm-wiki-standard@0.0.1-internal.4`.
- [x] Verify `npx @dowonk-7949/llm-wiki-standard@0.0.1-internal.4 doctor`.
- [x] Verify `yarn add @dowonk-7949/llm-wiki-standard@0.0.1-internal.4`.

## External Verification

- [ ] Run package tests on macOS.
- [ ] Run package tests on Linux.
- [ ] Run basic CLI commands on macOS and Linux shells.
- [ ] Confirm Google Antigravity instruction filename and loading behavior before treating `ANTIGRAVITY.md` as more than a candidate.

## Go/No-go Recommendation

Go for internal prerelease when:

- local Windows verification passes,
- package readiness is visible in `doctor`,
- `migrate --apply` remains blocked,
- known no-agent and selected-agent warnings are documented,
- npmjs public package publish and npm/npx/yarn install checks are confirmed,
- no sensitive values appear in reports.

No-go for stable publication until:

- macOS/Linux shell verification passes,
- Gate 2 through Gate 4 are reviewed,
- migration apply policy is explicitly accepted or intentionally omitted.

