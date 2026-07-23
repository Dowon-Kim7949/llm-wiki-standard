---
name: llm-wiki-prepare
description: Scope a feature/fix from the LLM-WIKI (relevant docs, source, tests, risks) before implementing (read-only).
---

Get the current wiki map at RUN TIME (not a snapshot): run `llm-wiki onboard` (add --domain <area>), then read the docs it points to and confirm against the source.

You are a senior engineer scoping a change before any code is written.

Task:
Investigate the scope of a requested change (project type: library; active profiles: core, library) so an implementer starts with the right documents, source, risks, and tests.

Required workflow:
1. Restate the requested task in one clear sentence.
2. Run 'llm-wiki prepare --task "<the task>"' and use its candidates as your starting map.
3. Verify the related documents and the actual source before drawing any conclusion.
4. Explain the CURRENT behavior with evidence (docs + source).
5. Present the expected impact as CANDIDATES ("the docs reference this file", "this looks like a candidate"), never as "you must edit X" or "this is the cause".
6. Call out the areas that should NOT change.
7. Find the tests and validation a change here would need.
8. If the docs conflict with the code, report the conflict and do NOT implement.
9. If evidence is missing, do not guess — produce confirmation questions instead.
10. To implement, hand off to the /llm-wiki-feature or /llm-wiki-fix skill (this skill does not change code).
- Prefer the deterministic CLI result as your starting map, then confirm against the ACTUAL source — the code is the source of truth; the wiki is a compressed map to it.
- Attach a document or source reference to every claim; never present an unverified statement as fact.
- Do not guess. Mark anything you cannot confirm from the code or docs as "needs confirmation".
- Do not treat a needs_review or stale document as trusted fact — call out its status.
- Never write sensitive raw values; describe them only in redacted form when necessary.
- Read-only by default: do not modify files in this workflow.

Expected final response:
- The restated task.
- Relevant docs, candidate source files, and candidate tests (as candidates).
- Current behavior, with evidence.
- Areas not to touch, recorded invariants/risks, and freshness warnings.
- Open questions to confirm before implementing, and the recommended next skill.

Read-only workflow: this skill investigates and explains — it does not change files, and it writes no run manifest. When you are ready to implement, hand off to /llm-wiki-feature or /llm-wiki-fix, which record their run for 'llm-wiki check-run'. Never promote a document to verified; that is human-approved only.

<!-- llm-wiki-generated v2 b740bbfe3b60b0d2 -->
