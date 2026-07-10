---
title: Domain Features
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
  - src/detector.js
evidence:
  - src/commands.js#symbol:scanEnrichment
  - src/commands.js#symbol:scanRelatedReferences
  - src/detector.js#symbol:detectProject
related:
  - docs/llm-wiki/index.md
  - docs/llm-wiki/domains/00_overview.md
  - docs/llm-wiki/PUBLIC_API.md
visibility: internal
contains_sensitive_info: false
---

# Domain Features

명령어군을 넘는, 사용자가 체감하는 기능 단위를 소스 근거와 연결합니다.

## Features

- **프로젝트 자동 감지** — `src/detector.js`가 package.json 신호로 `frontend/backend/fullstack/library` 유형과 신뢰도를 추론한다. `--type`로 명시 override 가능.
- **초기 문서 생성** — `init --write`가 core + profile 문서와 선택 adapter를 생성한다. 기존 파일은 기본 보존, `log.md`는 append-only.
- **frontmatter 계약 검증** — 필수 필드/status enum/날짜 형식/배열 형태를 검증하고, `verified`는 `--strict`에서 리뷰 메타를 요구한다.
- **근거 추적** — `source_files`(넓은 근거)와 `evidence`(파일/라인/심볼/섹션/라우트 정밀 근거)를 검증하고 본문 `## Evidence` 정렬을 확인한다.
- **연결성 검증** — 로컬 markdown 링크, 위키 링크(이중 대괄호 표기), `related` 항목의 존재성을 검증한다(`related.missing`).
- **enrichment 신호** — placeholder만 남은 미보강 문서를 `content.not_enriched`로 표시해 "빈 스캐폴드가 통과"하는 것을 막는다.
- **지식 그래프** — `wikiGraph`가 미해결 개념·별칭·고아 문서를 집계한다.
- **에이전트 인수인계** — `handoff`/`prompt`가 코드 근거로 문서를 보강하도록 유도하는 반복 프롬프트를 출력한다.
- **OKF v0.1 호환** — `--profile okf-v0.1`로 `type`/`aliases`/`tags`와 wiki 링크를 검증한다.

## Evidence

- `src/commands.js#symbol:scanEnrichment` — enrichment 미완성 감지.
- `src/commands.js#symbol:scanRelatedReferences` — related 존재성 검증.
- `src/detector.js#symbol:detectProject` — 프로젝트 유형 추론.

## Open Questions

- 각 기능의 실제 채택 사례를 수집해 다음 로드맵 우선순위(config 스키마, `--fix` 범위)에 반영해야 한다.

## Review Notes

- 사람 검토 전까지 `needs_review`를 유지한다.
