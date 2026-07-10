---
title: Glossary
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: glossary
project: llm-wiki-standard
last_updated: 2026-07-10
author: cli-generated
last_edited_by: Claude Code
wiki_block_version: v1
source_files:
  - src/frontmatter-schema.js
  - src/commands.js
  - src/config.js
evidence:
  - src/frontmatter-schema.js
  - src/config.js#symbol:VALID_STATUSES
related:
  - docs/llm-wiki/index.md
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md
visibility: internal
contains_sensitive_info: false
---

# Glossary

`llm-wiki-standard`에서 쓰는 핵심 용어입니다.

## Terms

- **Frontmatter** — 각 wiki 문서 상단의 YAML 블록. 필수 필드/enum은 `src/frontmatter-schema.js`가 정의한다.
- **status** — 문서 검토 상태. 허용값: `draft`, `needs_review`, `verified`, `deprecated`(`src/config.js` `VALID_STATUSES`). CLI/에이전트 산출물은 항상 `needs_review`.
- **verified** — 사람 검토가 끝난 문서에만 부여. `--strict`에서는 `reviewed_by`/`reviewed_at`가 없으면 실패.
- **source_files** — 문서 주장이 근거로 삼는 파일 목록(넓은 범위 근거).
- **evidence** — 파일/라인/심볼/섹션/라우트 단위의 정밀 근거 참조. 예: `src/cli.js#symbol:main`, `file#L10-L20`, `file#route:/users`. 본문 `## Evidence` 섹션과 정렬되어야 한다.
- **related** — 연결된 다른 wiki 문서 경로. 존재하지 않으면 `related.missing` 경고(P0-2에서 추가).
- **wikiGraph** — 위키 링크(이중 대괄호 표기) 기반 문서 그래프. 미해결 개념(unresolved concepts)·별칭(aliases)·고아 문서(orphans)를 집계한다.
- **adapter** — 에이전트에게 wiki 진입점을 알리는 파일. `AGENTS.md`(Codex), `CLAUDE.md`(Claude Code), `.cursor/rules/llm-wiki.mdc`(Cursor), `.github/copilot-instructions.md`(GitHub Copilot), 후보 `ANTIGRAVITY.md`.
- **profile** — 프로젝트 유형별 추가 문서 집합(`frontend`/`backend`/`fullstack`/`library`/`okf-v0.1`). `src/config.js` `PROFILE_DOCS`.
- **OKF v0.1** — 외부 지식 포맷 호환 프로필. `type`/`aliases`/`tags`와 위키 링크를 검증한다.
- **not_enriched** — 생성 후 아직 실제 내용으로 보강되지 않은 문서 신호(`content.not_enriched`, P0-3에서 추가).

## Evidence

- `src/frontmatter-schema.js` — 필수 필드, status/visibility enum, evidence 참조 패턴 정의.
- `src/config.js#symbol:VALID_STATUSES` — 허용 status 값 집합.

## Review Notes

- 사람 검토 전까지 `needs_review`를 유지한다.
