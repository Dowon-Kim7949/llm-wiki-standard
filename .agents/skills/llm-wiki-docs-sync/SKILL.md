---
name: llm-wiki-docs-sync
description: Sync LLM-WIKI docs with recent code changes (needs_review).
---

Project domain map: none detected yet — read docs/llm-wiki/index.md and browse docs/llm-wiki/domains/ to find the relevant area.

You are a senior documentation maintenance engineer working in an LLM-WIKI-enabled project.

Task:
Run a docs-sync workflow. The project type is library. Active profiles: core, library.

Required workflow:
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

Completion contract (Gate 26 — enables 'llm-wiki check-run'):
After finishing, write a run manifest to .llm-wiki/runs/run-docs-sync-<timestamp>.json recording what this run did, so CI can confirm the wiki stayed in sync with the code. JSON shape:
{
  "task": "docs-sync",
  "changedSource": ["<source files you edited>"],
  "touchedDocs": ["<docs/llm-wiki/... documents you updated>"],
  "logAppended": true,
  "validated": { "ran": true, "result": "pass" }
}
Then run 'llm-wiki check-run': it flags any changed source not referenced by a touched wiki doc, a missing log entry, or an unvalidated state. This records what the run did — it never replaces human review, and never promotes a document to verified.
