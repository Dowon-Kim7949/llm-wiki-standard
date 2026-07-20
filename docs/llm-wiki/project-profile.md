---
title: Project Profile
tags:
  - llm-wiki
  - verified
status: verified
doc_type: project_profile
project: llm-wiki-standard
last_updated: 2026-07-20
author: cli-generated
last_edited_by: Claude Code
reviewed_by: Dowon-Kim
reviewed_at: 2026-07-20
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
- 버전: `package.json`의 `version`이 단일 소스다(이 문서는 특정 버전 숫자를 고정하지 않는다).

## Summary

- `llm-wiki-standard`는 Codex·Claude Code·CI·로컬 터미널에서 공통 LLM-WIKI 운영 규칙을 점검하고 초기 문서를 생성하는 안정판 CLI다.
- 특정 도구 전용이 아니라 여러 adapter(`AGENTS.md`, `CLAUDE.md`, 후보 `ANTIGRAVITY.md`)에서 함께 쓰는 공통 표준을 지향한다.
- 보수적 쓰기 정책이 핵심이다: 기본은 미리보기, 실제 쓰기는 명시적 `--write`/`--apply` 시에만(예: `init --write`, `migrate --apply`). 모든 쓰기는 `verified` 문서 내용을 보존하고 결과를 `needs_review`로 남긴다.

## Runtime & Packaging

- 런타임: Node.js `>=18.18.0` (package.json `engines`), `type: module` (ESM).
- 진입점: `bin/llm-wiki.js` → `src/cli.js`의 `main()`.
- 의존성: 런타임 서드파티 의존성 없음(Node 내장 모듈만 사용).
- 배포: `v*` 태그 push → `.github/workflows/publish.yml`의 npm Trusted Publishing. 1.7부터 같은 태그 트리거에 격리된 `contents: write` 잡이 추가돼 러너 `gh` CLI로 GitHub Release도 만든다(본문은 `release-notes --body-only`; GATE_REVIEW Gate 12). 자세한 내용은 [Release Flow](RELEASE_FLOW.md).

## Ownership

- 저장소: `github.com/Dowon-Kim7949/llm-wiki-standard`.
- 릴리스 게이트/의사결정 기록은 `GATE_REVIEW.md`, 방향성은 `ROADMAP.md` 참조.

## Evidence

- `package.json` — 패키지명, `version`(배포 버전의 단일 소스), `engines.node >=18.18.0`, `bin.llm-wiki`, ESM 설정.
- `bin/llm-wiki.js` — CLI 실행 진입점.
- `src/cli.js#symbol:main` — 인자 파싱과 명령 디스패치.

## Open Questions

- Antigravity adapter 파일명 계약이 아직 미확정이라 `ANTIGRAVITY.md`는 info-level 후보로만 다룬다.
- 팀/조직 도입 시 visibility 경계(internal/restricted/public) 정책 문서가 필요하다.

## Review Notes

- 2026-07-14에 버전 표기를 version-agnostic으로 전환하고(고정 버전 숫자 제거 → `package.json` 참조) 1.2에서 해금된 `migrate --apply`를 반영한 뒤, 사람 검토(reviewed_by: Dowon-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-15에 1.7 CI/CD 도입을 반영했다: 배포 절차에 `v*` 태그 push 시 GitHub Release 잡(gh CLI·`release-notes --body-only` 본문)이 추가됐다(Gate 12). 사람 검토(reviewed_by: Dowon-Kim)를 거쳐 `verified`로 재승인했다.
