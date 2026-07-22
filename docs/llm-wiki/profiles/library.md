---
title: Library
tags:
  - llm-wiki
  - verified
status: needs_review
doc_type: profile
project: llm-wiki-governance
last_updated: 2026-07-22
author: cli-generated
last_edited_by: Claude Code
reviewed_by: Dowon-Kim
reviewed_at: 2026-07-21
wiki_block_version: v1
source_files:
  - package.json
  - src/cli.js
evidence:
  - package.json
related:
  - docs/llm-wiki/index.md
  - docs/llm-wiki/PUBLIC_API.md
  - docs/llm-wiki/VERSIONING.md
visibility: internal
contains_sensitive_info: false
---

# Library

## Summary

- 이 프로젝트는 `library` 프로필로 관리한다: 공개 계약(CLI 명령 표면), 버전 정책, 예시, 릴리스 흐름이 핵심 문서다.
- 라이브러리형 문서 세트: [Public Api](../PUBLIC_API.md), [Versioning](../VERSIONING.md), [Examples](../EXAMPLES.md), [Release Flow](../RELEASE_FLOW.md).

## Why library

- 산출물이 `bin`으로 노출되는 CLI이고 런타임 서드파티 의존성이 없다(package.json). 소비자는 npm/npx/yarn로 설치해 명령을 호출하므로, 공개 표면·버전 계약·예시가 프론트/백엔드형 문서보다 중요하다.

## Evidence

- `package.json` — `bin.llm-wiki`, `type: module`, 의존성 부재로 라이브러리/CLI 성격 확인.

## Open Questions

- 추후 프로그래매틱 import API(예: `src/commands.js` 핸들러 직접 호출)를 공개 계약으로 문서화할지 결정 필요.

## Review Notes

- 2026-07-13에 패키지 진입점과 배포 형태를 기준으로 검토했다.
