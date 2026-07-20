---
title: Release Flow
tags:
  - llm-wiki
  - verified
status: verified
doc_type: release_flow
project: llm-wiki-standard
last_updated: 2026-07-20
author: cli-generated
last_edited_by: Claude Code
reviewed_by: Dowon-Kim
reviewed_at: 2026-07-20
wiki_block_version: v1
source_files:
  - package.json
  - RELEASE_CHECKLIST.md
  - templates/github-actions/llm-wiki-validate.yml
  - .github/workflows/publish.yml
evidence:
  - package.json#section:scripts
  - RELEASE_CHECKLIST.md#section:Publish
related:
  - docs/llm-wiki/index.md
  - docs/llm-wiki/VERSIONING.md
visibility: internal
contains_sensitive_info: false
---

# Release Flow

## Pipeline

1. 로컬 검증: `npm run verify`(= `node --test tests/*.test.js` + `validate-frontmatter`), 그리고 `doctor`/`init --dry-run`/`diff --check`.
2. `main` push는 CI(검증)만 실행한다. 배포는 하지 않는다.
3. 배포는 `v<version>` 태그 push로만 트리거된다: `.github/workflows/publish.yml`.
4. publish 워크플로는 태그 버전과 `package.json` 버전 일치를 확인한 뒤 npm Trusted Publishing으로 공개 배포한다.
5. 이어서 격리된 `contents: write` 잡(`needs: publish`)이 러너 내장 `gh` CLI로 GitHub Release를 만든다. 본문은 `llm-wiki release-notes --body-only`에서 생성하며(민감정보 스캔을 거쳐 매치 시 차단), 서드파티 릴리스 액션을 쓰지 않아 무의존성을 유지한다(1.7, GATE_REVIEW Gate 12).
6. 배포 후 clean consumer(npm/npx/yarn) 설치·smoke 테스트로 확인한다.

## Prerequisites

- npm Trusted Publisher(GitHub Actions, 워크플로 파일명 `publish.yml`) 등록.
- GitHub Environment `npm-release`의 필수 리뷰어/승인 규칙 설정(사람 승인이 필요할 때).

## Checklist

- 상세 절차는 저장소 루트 `RELEASE_CHECKLIST.md`의 Local Verification / Safety Gates / Release Metadata / Publish 섹션을 따른다.

## Evidence

- `package.json#section:scripts` — `verify`/`validate`/`doctor`/`audit` 스크립트 정의.
- `RELEASE_CHECKLIST.md#section:Publish` — 태그 생성/푸시와 배포 확인 절차.

## Review Notes

- 2026-07-14에 1.3.0 릴리스 설정과 체크리스트를 기준으로 재검토했다.
- 2026-07-15에 1.7.0 CI/CD 도입을 반영했다: `v*` 태그 push 시 `publish.yml`이 npm Trusted Publishing에 더해 격리된 `contents: write` GitHub Release 잡(`gh` CLI·`release-notes --body-only` 본문)을 실행한다(Gate 12). 사람 검토(reviewed_by: Dowon-Kim)를 거쳐 `verified`로 재승인했다.
