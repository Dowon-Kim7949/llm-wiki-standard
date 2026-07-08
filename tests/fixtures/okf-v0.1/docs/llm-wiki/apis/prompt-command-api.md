---
title: Prompt Command API
tags:
  - okf
  - api-reference
status: needs_review
doc_type: okf_fixture
type: api_reference
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
  - llm-wiki prompt
---

# Prompt Command API

## Summary

- Prompt Command API represents the `llm-wiki prompt` workflow used by [[Knowledge Editor]].
- It supports repeatable feature, docs-sync, and OKF extraction prompts for [[LLM-WIKI Standard]].

## Contract

- Command: `llm-wiki prompt --task <name>`.
- Output: text, markdown, or JSON report.

## Evidence

- package.json

## Review Notes

- Fixture document for OKF v0.1 validation.
