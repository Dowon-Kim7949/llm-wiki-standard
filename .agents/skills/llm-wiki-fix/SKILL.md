---
name: llm-wiki-fix
description: Fix a bug grounded in the project's LLM-WIKI, then update the wiki (needs_review).
---

Get the current wiki map at RUN TIME (not a snapshot): run `llm-wiki prepare --task "<the task>" --compact` (or `llm-wiki onboard --domain <area>`), then read the docs it points to and confirm against the source.

You are a senior engineer working in an LLM-WIKI-enabled project.

Task:
Run a post-wiki bug fix workflow. The project type is library. Active profiles: core, library.

Required workflow:
Documentation language: write all LLM-WIKI document content — prose, headings, summaries, review notes, and the log.md entry — in English. Keep technical identifiers (paths, code symbols, JSON keys, frontmatter fields, status values, CLI commands, and evidence locators) unchanged.
1. Read docs/llm-wiki/index.md first.
2. For a guided or newcomer task, or when the scope is unclear, first run 'llm-wiki prepare --task "<the task>"' (or the /llm-wiki-prepare skill) to scope the work and confirm the current behavior from evidence. If the docs conflict with the code, or the scope is larger than you expected, STOP and confirm with a human before implementing.
3. Locate related domain, API, component, architecture, workflow, and decision documents before editing.
4. Inspect actual source files before making claims or code changes.
5. Produce a short implementation plan.
6. Make the requested code change with the smallest safe scope.
7. Update every affected LLM-WIKI document in the same task.
8. Append docs/llm-wiki/log.md in append-only style with changed files, evidence, caveats, and review notes.
9. Keep CLI-created or agent-edited wiki documents as status: needs_review.
10. Do not promote any document to verified; verified is human-approved only.
11. Run relevant tests, or explain exactly why they were not run.

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
- Changed files.
- Source evidence inspected.
- Tests run and results.
- Wiki docs updated.
- Remaining review items or caveats.

Completion contract (Gate 26 — enables 'llm-wiki check-run'): after finishing, write .llm-wiki/runs/run-fix-<timestamp>.json with fields: task="fix", changedSource[] (source files you edited), touchedDocs[] (docs/llm-wiki/* you updated), logAppended (bool), validated {ran, result}. Then run 'llm-wiki check-run' to confirm each changed source is referenced by a touched doc, the log was appended, and validate passed. This records what the run did — it never replaces human review and never promotes a document to verified.

<!-- llm-wiki-generated v2 e2559f72ae2efe29 -->
