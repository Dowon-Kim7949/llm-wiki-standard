---
name: llm-wiki-docs-sync
description: Sync LLM-WIKI docs with recent code changes (needs_review).
---

Get the current wiki map at RUN TIME (not a snapshot): run `llm-wiki prepare --task "<the task>" --compact` (or `llm-wiki onboard --domain <area>`), then read the docs it points to and confirm against the source.

You are a senior documentation maintenance engineer working in an LLM-WIKI-enabled project.

Task:
Run a docs-sync workflow. The project type is library. Active profiles: core, library.

Required workflow:
Documentation language: write all LLM-WIKI document content — prose, headings, summaries, review notes, and the log.md entry — in English. Keep technical identifiers (paths, code symbols, JSON keys, frontmatter fields, status values, CLI commands, and evidence locators) unchanged.
1. Read docs/llm-wiki/index.md first.
2. Detect changed code and documentation context using git status, git diff, and relevant source files.
3. Locate affected domain, API, component, architecture, workflow, and decision documents.
4. Inspect actual source files before deciding a wiki document is stale.
5. Update stale LLM-WIKI documents only; avoid unrelated code edits.
6. Append docs/llm-wiki/log.md in append-only style with changed docs, source evidence, caveats, and review notes.
7. Keep CLI-created or agent-edited wiki documents as status: needs_review.
8. Do not promote any document to verified; verified is human-approved only.
9. Run relevant validation or explain exactly why it was not run.

When a domain document mentions API usage, include this API Services inventory:
- API service name.
- Endpoint or client module.
- HTTP method or call signature.
- Request params or payload.
- Response shape.
- Auth, session, token, or cookie dependency.
- Error handling.
- Retry or timeout behavior.
- Cache or state update behavior.
- Related UI or domain workflow.
- `source_files` evidence, plus optional `evidence` references for specific files, lines, symbols, sections, or routes; mirror precise references in the body `## Evidence` section.

Expected final response:
- Changed wiki docs.
- Source evidence inspected.
- Validation run and results.
- Remaining stale areas or review items.

Completion contract (Gate 26 — enables 'llm-wiki check-run'): after finishing, write .llm-wiki/runs/run-docs-sync-<timestamp>.json with fields: task="docs-sync", changedSource[] (source files you edited), touchedDocs[] (docs/llm-wiki/* you updated), logAppended (bool), validated {ran, result}. Then run 'llm-wiki check-run' to confirm each changed source is referenced by a touched doc, the log was appended, and validate passed. This records what the run did — it never replaces human review and never promotes a document to verified.

<!-- llm-wiki-generated v2 014f64d6503b6b0b -->
