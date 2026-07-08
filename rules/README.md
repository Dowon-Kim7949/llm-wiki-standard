---
title: LLM-WIKI Rule Assets
tags:
  - llm-wiki
  - rules
  - needs-review
status: needs_review
doc_type: rule_asset_index
project: llm-wiki-standard
last_updated: 2026-07-02
author: ai-generated
last_edited_by: Codex
wiki_block_version: v1
source_files:
  - rules/frontmatter.schema.json
  - rules/frontmatter-required.json
  - src/frontmatter.js
  - src/frontmatter-schema.js
  - src/config.js
related:
  - README.md
visibility: internal
contains_sensitive_info: false
---

# LLM-WIKI Rule Assets

This directory stores machine-readable rules for the CLI. Rules remain `needs_review` until a human reviewer verifies changes for the consuming project.

## Frontmatter Schema

- `rules/frontmatter.schema.json` is the published JSON Schema contract for LLM-WIKI frontmatter.
- The schema defines required fields, valid `status` values, valid `visibility` values, optional `aliases`, and the review metadata expected when a document is `verified`.
- Runtime validation uses the same contract through `src/frontmatter-schema.js`.
- `rules/frontmatter-required.json` remains a compact legacy summary for wrappers that only need field and enum lists.
