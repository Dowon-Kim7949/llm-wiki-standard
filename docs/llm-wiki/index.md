---
title: LLM-WIKI Index
tags:
  - llm-wiki
  - verified
status: verified
doc_type: wiki_index
project: llm-wiki-standard
last_updated: 2026-07-20
author: cli-generated
last_edited_by: Codex
reviewed_by: Dowon-Kim
reviewed_at: 2026-07-20
wiki_block_version: v1
source_files:
  - package.json
  - src/cli.js
  - README.md
evidence:
related:
  - docs/llm-wiki/README.md
  - docs/llm-wiki/project-profile.md
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md
  - docs/llm-wiki/PUBLIC_API.md
  - docs/llm-wiki/log.md
visibility: internal
contains_sensitive_info: false
---

# LLM-WIKI Index

이 문서는 `@dowonk-7949/llm-wiki-standard` 저장소 자체의 LLM-WIKI 진입점입니다. 이 패키지는 여러 개발 도구(Codex, Claude Code 등)와 CI에서 공통 LLM-WIKI 운영 규칙을 점검·생성하는 안정판 CLI이며, 이 wiki는 그 도구를 **자기 자신에게 적용(dogfooding)** 한 결과입니다.

## Status

- 이 문서 집합은 `llm-wiki init --write --type library`로 생성한 뒤 실제 소스 근거로 보강되었습니다.
- 현재 문서 집합은 2026-07-13 사람 검토를 거쳐 `verified`로 승인되었습니다.
- 이후 CLI 또는 에이전트가 문서를 수정하면 다시 `needs_review`로 전환하고 재검토합니다.

## Recommended Read Order

1. [Project Profile](project-profile.md) — 이 패키지가 무엇이고 어떤 런타임/소유 경계를 갖는지
2. [Architecture Conventions](ARCHITECTURE_CONVENTIONS.md) — 모듈 구조와 command → scan → report 파이프라인
3. [Public API](PUBLIC_API.md) — CLI 명령어 표면(이 패키지의 공개 계약)
4. [Domain Overview](domains/00_overview.md) — 명령어군/서브시스템 지도
5. [Glossary](GLOSSARY.md) — 핵심 용어
6. 작업 대상에 맞는 [Versioning](VERSIONING.md) · [Release Flow](RELEASE_FLOW.md) · [Examples](EXAMPLES.md)

## Operating Rules

- CLI 또는 에이전트가 생성/수정한 문서는 `needs_review`로 유지합니다.
- 변경 기록은 [log.md](log.md)에 append-only로 남깁니다.
- 민감정보 raw value는 wiki에 기록하지 않습니다.
- Markdown은 UTF-8로 읽고 씁니다.
