---
title: Visibility Governance Policy
tags:
  - llm-wiki
  - verified
status: verified
doc_type: policy
project: llm-wiki-standard
last_updated: 2026-07-15
author: ai-generated
last_edited_by: Claude Code
reviewed_by: WoongHwan-Kim
reviewed_at: 2026-07-15
wiki_block_version: v1
source_files:
  - src/frontmatter-schema.js
  - src/config.js
  - src/sensitive-info.js
evidence:
  - src/frontmatter-schema.js
  - src/config.js#symbol:VALID_VISIBILITIES
  - src/sensitive-info.js#symbol:scanSensitiveInfo
related:
  - docs/llm-wiki/project-profile.md
  - GATE_REVIEW.md
visibility: internal
contains_sensitive_info: false
---

# Visibility Governance Policy

이 문서는 LLM-WIKI 문서의 `visibility` 필드(`internal` | `restricted` | `public`) 의미와,
그 값과 문서 내용의 일관성을 어떻게 점검할지에 대한 정책을 정의한다. `1.9` visibility
governance 기능(GATE_REVIEW Gate 14)의 설계 입력이며, `project-profile.md`의 Open
Question("팀/조직 도입 시 visibility 경계 정책 문서가 필요하다")을 해소한다.

## 레벨 정의 · Levels

- **`internal`** (기본값) — 조직 내부 공유. 대부분의 wiki 문서가 여기에 해당한다. 조직 밖으로
  나가지 않는다는 전제이므로 내부 세부 구현·경로·의사결정을 담을 수 있으나, **비밀값(토큰·자격
  증명 등)은 어느 레벨에서도 raw로 기록하지 않는다**(기존 sensitive-info 불변식).
- **`restricted`** — 더 좁은 범위(특정 팀/역할)만 접근. `internal`보다 민감한 맥락을 담을 수
  있으나 접근 통제는 저장소/조직 레이어의 책임이며, 이 CLI는 값의 선언만 검증한다.
- **`public`** — 조직 밖 공개 가능. 공개해도 안전한 내용만 담아야 한다. **비밀값은 물론이고
  sensitive-info 스캔에 걸리는 값이 있으면 안 된다**(공개-내용 일관성).

## 일관성 규칙 · Consistency (1.9, opt-in)

`1.9`는 이미 필수인 `visibility` 필드를 **강제(enforce)하지 않고**, opt-in 일관성 린트를 추가한다.
기존 sensitive-info 스캔을 재사용한다:

- **public-vs-content**: `visibility: public` 문서가 sensitive-info 스캔에 매치되면 경고한다
  (공개 문서에 민감해 보이는 값이 있으면 leak 위험).
- **contains_sensitive_info 일관성**: `contains_sensitive_info: false`인데 sensitive-info
  스캔에 매치되면 선언과 내용이 어긋난다.

### 불변식 · Invariants

- **off by default**: 규칙은 config `rules`로 명시 활성화해야 동작한다(1.8 토글 기계 재사용).
- **warning-level, read-only**: 절대 기본 `error`/`blocked`가 되지 않으며 파일을 수정하지 않는다.
  additive 불변식(1.0.0 계약)을 깨지 않기 위함이다.
- **접근 통제 아님**: 이 CLI는 `visibility` 값과 내용의 일관성만 점검한다. 실제 접근 통제(누가
  무엇을 보는가)는 저장소/조직 레이어의 책임이다.
- 민감정보는 어느 visibility 레벨에서도 raw로 기록하지 않는다(redaction 우선).

## Evidence

- `src/frontmatter-schema.js` — `visibility` enum(`internal`|`public`|`restricted`)과 필수 필드.
- `src/config.js#symbol:VALID_VISIBILITIES` — 허용 visibility 값 집합.
- `src/sensitive-info.js#symbol:scanSensitiveInfo` — 1.9 일관성 규칙이 재사용할 민감정보 스캔.

## Open Questions

- `restricted`의 세부 접근 경계(어떤 팀/역할)를 config로 선언·검증할지는 실사용 피드백 후 별도
  검토한다(현재는 값 선언만 검증).
- 조직 정책에 따라 특정 `doc_type`을 특정 visibility로 강제하고 싶을 수 있으나(예: release_notes는
  최소 internal), 이는 default-blocking 금지 불변식과 상충하지 않게 opt-in으로만 다룬다.

## Review Notes

- 2026-07-15에 `1.9` 준비(Gate 14 초안)의 설계 입력으로 생성했다. 사람 검토(reviewed_by: WoongHwan-Kim)를 거쳐 Gate 14 수락과 함께 `verified`로 승인했다.
