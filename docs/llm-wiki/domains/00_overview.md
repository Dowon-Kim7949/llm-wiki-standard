---
title: Domain Overview
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: domain_overview
project: llm-wiki-standard
last_updated: 2026-07-10
author: cli-generated
last_edited_by: Claude Code
wiki_block_version: v1
source_files:
  - src/commands.js
  - src/cli.js
evidence:
  - src/commands.js#symbol:validateCommand
  - src/commands.js#symbol:initCommand
  - src/commands.js#symbol:nextCommand
related:
  - docs/llm-wiki/index.md
  - docs/llm-wiki/DOMAIN_FEATURES.md
  - docs/llm-wiki/PUBLIC_API.md
visibility: internal
contains_sensitive_info: false
---

# Domain Overview

이 문서는 `llm-wiki-standard`의 "도메인" 지도입니다. 여기서 도메인은 UI가 아니라 **명령어군/서브시스템**을 의미합니다.

## Domains

- **Diagnose (진단)** — `doctor`, `status`: 런타임/패키지 준비 상태, 초기화 여부, 문서 상태 카운트. 근거: `src/commands.js` `doctor`, `statusCommand`.
- **Validate (검증)** — `validate`, `validate-frontmatter`, `audit`: 구조/frontmatter/source_files/related/evidence/link/adapter/enrichment 스캔. `validate`는 `audit` 커버리지를 재사용한다.
- **Generate (생성)** — `init --dry-run|--write`, `quickstart`: 누락 문서와 선택 adapter 파일 생성. `--write` 명시 시에만 실제 쓰기.
- **Guide (안내)** — `handoff`, `prompt`, `next`, `explain`: 에이전트 인수인계 프롬프트, 반복 작업 프롬프트, 다음 조치 추천, finding 규칙 설명.
- **Migrate (이관)** — `migrate --dry-run`: 이관 계획 미리보기. `--apply`는 안정판에서 차단.

## Cross-Cutting Concerns

- **Detection** (`src/detector.js`) — package.json 신호로 project type/profile 추론.
- **Safety** — 기존 wiki/adapter 보존, `log.md` append-only, 민감정보 redaction, UTF-8 강제.
- **Reporting** (`src/report.js`) — 모든 명령이 공통 finding/summary 구조와 text/json/markdown 출력을 공유.

## Evidence

- `src/commands.js#symbol:validateCommand` — Validate 도메인의 진입점(audit 재사용).
- `src/commands.js#symbol:initCommand` — Generate 도메인의 dry-run/write 분기.
- `src/commands.js#symbol:nextCommand` — Guide 도메인의 조치 추천.

## Review Notes

- 사람 검토 전까지 `needs_review`를 유지한다.
