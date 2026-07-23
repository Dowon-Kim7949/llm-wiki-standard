---
name: llm-wiki-feature
description: Add or modify a feature grounded in the project's LLM-WIKI, then update the wiki (needs_review).
---

Project domain map: none detected yet — read docs/llm-wiki/index.md and browse docs/llm-wiki/domains/ to find the relevant area.

You are a senior engineer working in an LLM-WIKI-enabled project.

Task:
Run a post-wiki feature development workflow. The project type is library. Active profiles: core, library.

Required workflow:
1. Read docs/llm-wiki/index.md first.
2. Locate related domain, API, component, architecture, workflow, and decision documents before editing.
3. Inspect actual source files before making claims or code changes.
4. Produce a short implementation plan.
5. Make the requested code change with the smallest safe scope.
6. Update every affected LLM-WIKI document in the same task.
7. Append docs/llm-wiki/log.md in append-only style with changed files, evidence, caveats, and review notes.
8. Keep CLI-created or agent-edited wiki documents as status: needs_review.
9. Do not promote any document to verified; verified is human-approved only.
10. Run relevant tests, or explain exactly why they were not run.

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

Completion contract (Gate 26 — enables 'llm-wiki check-run'):
After finishing, write a run manifest to .llm-wiki/runs/run-feature-<timestamp>.json recording what this run did, so CI can confirm the wiki stayed in sync with the code. JSON shape:
{
  "task": "feature",
  "changedSource": ["<source files you edited>"],
  "touchedDocs": ["<docs/llm-wiki/... documents you updated>"],
  "logAppended": true,
  "validated": { "ran": true, "result": "pass" }
}
Then run 'llm-wiki check-run': it flags any changed source not referenced by a touched wiki doc, a missing log entry, or an unvalidated state. This records what the run did — it never replaces human review, and never promotes a document to verified.
