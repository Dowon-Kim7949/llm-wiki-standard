---
title: Versioning
tags:
  - llm-wiki
  - verified
status: verified
doc_type: versioning
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

- 시맨틱 버전을 따른다. 배포 버전의 단일 진실 소스는 `package.json`의 `version` 필드이며, 이 문서는 특정 버전 숫자를 고정하지 않는다(버전을 알려면 `package.json`을 본다).
- `1.0.0`에서 안정 계약(명령·옵션 표면, `--format json` 출력 형태, 필수 frontmatter 계약)을 확정했고, 이후 `1.x`는 하위 호환(부가)만 더한다. 계약 파괴 변경은 major를 요한다.
- 릴리스는 `v<version>` 태그 push로 트리거되고, 태그 버전은 반드시 `package.json` 버전과 일치해야 한다.
- 하위 호환이 깨질 수 있는 변경(명령 이름/JSON 출력 형태 변경, 필수 frontmatter 계약 변경)은 major로 올린다. `PUBLIC_API`의 안정성 원칙 참조.

## What Bumps the Version

- **patch(x.y.Z)**: 버그 수정, 메시지/출력 다듬기, 새 검증 규칙 추가(warning 레벨, 기본 통과 유지).
- **minor(x.Y.0)**: 하위 호환되는 새 명령·옵션 추가, 기존 동작을 깨지 않는 기능 확장.
- **major(X.0.0)**: 안정 계약의 파괴적 변경(명령·옵션 제거·이름 변경, JSON 출력 형태 변경, 필수 frontmatter 계약 변경).

## Evidence

- `package.json` — `version` 필드가 배포 버전의 단일 소스이며 릴리스 태그와 대조된다.

## Open Questions

- 새 검증 규칙(`related.missing`, `content.not_enriched`)이 warning→error(strict)로 승격되는 시점을 어느 릴리스에서 문서화할지.

## Review Notes

- 2026-07-14에 버전 정책을 version-agnostic으로 전환하고(특정 버전 숫자 표기 제거 → `package.json` 단일 소스 참조) 사람 검토(reviewed_by: Dowon-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-15에 1.7.0 릴리스 준비로 인용 소스(`package.json` 버전 bump·`RELEASE_CHECKLIST.md` version-agnostic 갱신)가 바뀌어 evidence.stale이 떴으나, version-agnostic 정책 내용은 그대로 정확함을 확인하고 검토 기준일을 갱신해 해소했다(사람 검토 reviewed_by: Dowon-Kim). 내용 변경 없음.
