---
title: LLM-WIKI README
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: wiki_readme
project: llm-wiki-standard
last_updated: 2026-07-10
author: cli-generated
last_edited_by: Claude Code
wiki_block_version: v1
source_files:
  - package.json
  - README.md
evidence:
related:
  - docs/llm-wiki/index.md
  - docs/llm-wiki/project-profile.md
  - docs/llm-wiki/log.md
visibility: internal
contains_sensitive_info: false
---

# LLM-WIKI README

이 디렉터리는 `llm-wiki-standard` 저장소의 지식·의사결정·작업 규칙을 LLM과 개발자가 함께 참조하기 위한 공간입니다. 이 wiki는 패키지가 제공하는 CLI를 저장소 자신에게 적용한 dogfooding 결과입니다.

## Entry Point

- 시작점은 [index.md](index.md)이며 권장 읽기 순서를 안내합니다.
- 사용자 대상 설치/사용 안내는 저장소 루트 `README.md`를, 릴리스 게이트는 `GATE_REVIEW.md`를, 방향성은 `ROADMAP.md`를 참조하세요.

## Operating Rules

- 모든 wiki 문서는 YAML frontmatter를 가집니다.
- CLI 또는 에이전트가 생성/수정한 문서는 `needs_review` 상태를 유지합니다.
- 민감정보 raw value는 기록하지 않습니다.
- 변경 기록은 [log.md](log.md)에 append-only로 남깁니다.
- 문서가 아직 보강되지 않으면 `llm-wiki validate`가 `content.not_enriched`로 표시합니다.
