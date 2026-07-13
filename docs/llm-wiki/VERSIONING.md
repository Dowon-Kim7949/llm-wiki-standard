---
title: Versioning
tags:
  - llm-wiki
status: needs_review
doc_type: versioning
project: llm-wiki-standard
last_updated: 2026-07-14
author: cli-generated
last_edited_by: Claude Code
wiki_block_version: v1
source_files:
  - package.json
  - RELEASE_CHECKLIST.md
evidence:
  - package.json
related:
  - docs/llm-wiki/index.md
  - docs/llm-wiki/RELEASE_FLOW.md
  - docs/llm-wiki/PUBLIC_API.md
visibility: internal
contains_sensitive_info: false
---

# Versioning

## Policy

- 시맨틱 버전을 따르며 현재 라인은 `1.0.x`(안정 계약)다. 현재 버전은 `1.0.0`이며, `package.json`의 `version` 필드가 단일 진실 소스다.
- 릴리스는 `v<version>` 태그 push로 트리거되고, 태그 버전은 반드시 `package.json` 버전과 일치해야 한다.
- 하위 호환이 깨질 수 있는 변경(명령 이름/JSON 출력 형태 변경, 필수 frontmatter 계약 변경)은 major로 올린다. `PUBLIC_API`의 안정성 원칙 참조.

## What Bumps the Version

- **patch(1.0.x)**: 버그 수정, 메시지/출력 다듬기, 새 검증 규칙 추가(warning 레벨, 기본 통과 유지).
- **minor(1.x.0)**: 하위 호환되는 새 명령·옵션 추가, 기존 동작을 깨지 않는 기능 확장.
- **major(x.0.0)**: 안정 계약의 파괴적 변경(명령·옵션 제거·이름 변경, JSON 출력 형태 변경, 필수 frontmatter 계약 변경). `1.0.0`에서 안정 계약을 확정했다.

## Evidence

- `package.json` — `version` 필드가 배포 버전의 단일 소스이며 릴리스 태그와 대조된다.

## Open Questions

- 새 검증 규칙(`related.missing`, `content.not_enriched`)이 warning→error(strict)로 승격되는 시점을 어느 릴리스에서 문서화할지.

## Review Notes

- 2026-07-14에 `1.0.0` 안정성 마일스톤에 맞춰 버전 정책과 메타데이터를 갱신했다. 사람 검토 전 `needs_review` 상태다.
