# llm-wiki-bootstrap

> Paste this prompt into your coding agent (Codex or any other) to run the workflow below. It is an instruction for the agent, not run by the CLI.

Project domain map: none detected yet — read docs/llm-wiki/index.md and browse docs/llm-wiki/domains/ to find the relevant area.

You are a senior engineer bootstrapping an LLM-WIKI from real source evidence.

Task:
Enrich the freshly initialized LLM-WIKI (created by 'llm-wiki init --write') so every document is backed by real code. The project type is library. Active profiles: core, library.
Preconditions: this runs after init has generated docs/llm-wiki/index.md, the core/profile documents, and (when detected) docs/llm-wiki/domains/*.md.

Required workflow:
Documentation language: write all LLM-WIKI document content — prose, headings, summaries, review notes, and the log.md entry — in English. Keep technical identifiers (paths, code symbols, JSON keys, frontmatter fields, status values, CLI commands, and evidence locators) unchanged.
1. Read the nearest AGENTS.md (or your agent's instruction file) and docs/llm-wiki/index.md first.
2. Review the init-generated documents and their source_files to see what still needs grounding.
3. Investigate the actual code, config, routing, public APIs, data models, and key workflows before making any claim.
Library evidence focus:
- Inspect public exports, package entrypoints, type declarations, examples, versioning policy, compatibility guarantees, and release flow.
4. Replace placeholder content with descriptions backed by real source evidence. Do not guess — leave anything uncertain as an explicit review item instead of inventing detail.
5. For backend/fullstack projects, also enrich the related docs/llm-wiki/domains/*.md documents.
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
6. Tidy the related frontmatter entries and local Markdown links between related documents.
7. Record broad evidence in source_files and precise evidence in the frontmatter evidence entries, mirrored in the body ## Evidence section.
8. Never write sensitive raw values into documents or reports; describe them only in redacted form when necessary.
9. Keep every created or edited wiki document at status: needs_review.
10. Do not promote anything to verified — verified is human-approved only.
11. Append docs/llm-wiki/log.md in append-only style with the changed files, evidence, caveats, and remaining review items.
12. When finished, run the appropriate validate / audit / stats checks and summarize the results, and call out the areas with thin or missing evidence and the items a human must review before verified.

Expected final response:
- Changed wiki docs (and any domain docs enriched).
- Source evidence inspected.
- validate / audit / stats run and results.
- Areas with thin or missing evidence, and items a human must review before verified.

Completion contract (Gate 26 — enables 'llm-wiki check-run'): after finishing, write .llm-wiki/runs/run-bootstrap-<timestamp>.json with fields: task="bootstrap", changedSource[] (source files you edited), touchedDocs[] (docs/llm-wiki/* you updated), logAppended (bool), validated {ran, result}. Then run 'llm-wiki check-run' to confirm each changed source is referenced by a touched doc, the log was appended, and validate passed. This records what the run did — it never replaces human review and never promotes a document to verified.

<!-- llm-wiki-generated v2 3314245def74fd93 -->
