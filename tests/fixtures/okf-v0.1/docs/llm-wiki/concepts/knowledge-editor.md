---
title: Knowledge Editor
tags:
  - okf
  - concept
status: needs_review
doc_type: okf_fixture
type: concept
project: okf-fixture
last_updated: 2026-07-08
author: test-fixture
last_edited_by: test-fixture
wiki_block_version: v1
source_files:
  - package.json
related:
  - docs/llm-wiki/projects/llm-wiki-standard.md
visibility: internal
contains_sensitive_info: false
aliases:
  - Knowledge Curation Role
---

# Knowledge Editor

## Summary

- A knowledge editor reviews extracted facts before they become durable OKF documents.
- The role keeps [[LLM-WIKI Standard]] content source-backed and in `needs_review` until human approval.

## Relationships

- Works with [[Maintainer]] during [[Review Sync]].
- Uses [[Prompt Command API]] to create repeatable extraction prompts.

## Evidence

- package.json

## Review Notes

- Fixture document for OKF v0.1 validation.
