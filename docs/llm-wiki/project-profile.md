---
title: Project Profile
tags:
  - llm-wiki
status: needs_review
doc_type: project_profile
project: llm-wiki-standard
last_updated: 2026-07-14
author: cli-generated
last_edited_by: Claude Code
wiki_block_version: v1
source_files:
  - package.json
  - bin/llm-wiki.js
  - src/cli.js
evidence:
  - package.json
  - bin/llm-wiki.js
  - src/cli.js#symbol:main
related:
  - docs/llm-wiki/index.md
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md
  - docs/llm-wiki/log.md
visibility: internal
contains_sensitive_info: false
---

# Project Profile

## Detected Project

- type: `library` (Node ESM CLI 패키지; 공개 계약은 `llm-wiki` 명령어 표면)
- npm 패키지명: `@dowonk-7949/llm-wiki-standard`
- 현재 버전: `1.0.0`

## Summary

- `llm-wiki-standard`는 Codex·Claude Code·CI·로컬 터미널에서 공통 LLM-WIKI 운영 규칙을 점검하고 초기 문서를 생성하는 안정판 CLI다.
- 특정 도구 전용이 아니라 여러 adapter(`AGENTS.md`, `CLAUDE.md`, 후보 `ANTIGRAVITY.md`)에서 함께 쓰는 공통 표준을 지향한다.
- 보수적 쓰기 정책이 핵심이다: 기본은 미리보기, 실제 쓰기는 `--write` 명시 시에만, `migrate --apply`는 차단.

## Runtime & Packaging

- 런타임: Node.js `>=18.18.0` (package.json `engines`), `type: module` (ESM).
- 진입점: `bin/llm-wiki.js` → `src/cli.js`의 `main()`.
- 의존성: 런타임 서드파티 의존성 없음(Node 내장 모듈만 사용).
- 배포: `v*` 태그 push → `.github/workflows/publish.yml`의 npm Trusted Publishing. 자세한 내용은 [Release Flow](RELEASE_FLOW.md).

## Ownership

- 저장소: `github.com/Dowon-Kim7949/llm-wiki-standard`.
- 릴리스 게이트/의사결정 기록은 `GATE_REVIEW.md`, 방향성은 `ROADMAP.md` 참조.

## Evidence

- `package.json` — 패키지명, 버전 `1.0.0`, `engines.node >=18.18.0`, `bin.llm-wiki`, ESM 설정.
- `bin/llm-wiki.js` — CLI 실행 진입점.
- `src/cli.js#symbol:main` — 인자 파싱과 명령 디스패치.

## Open Questions

- Antigravity adapter 파일명 계약이 아직 미확정이라 `ANTIGRAVITY.md`는 info-level 후보로만 다룬다.
- 팀/조직 도입 시 visibility 경계(internal/restricted/public) 정책 문서가 필요하다.

## Review Notes

- 2026-07-14에 `1.0.0` 릴리스 준비에 맞춰 버전 메타데이터를 갱신했다. 사람 검토 전 `needs_review` 상태다.
