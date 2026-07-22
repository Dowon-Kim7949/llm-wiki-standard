---
title: Examples
tags:
  - llm-wiki
  - verified
status: needs_review
doc_type: examples
project: llm-wiki-governance
last_updated: 2026-07-22
author: cli-generated
last_edited_by: Claude Code
reviewed_by: Dowon-Kim
reviewed_at: 2026-07-21
wiki_block_version: v1
source_files:
  - src/cli.js
  - README.md
evidence:
  - src/cli.js#symbol:printHelp
related:
  - docs/llm-wiki/index.md
  - docs/llm-wiki/PUBLIC_API.md
visibility: internal
contains_sensitive_info: false
---

# Examples

실제로 검증된 사용 예시입니다. 명령/옵션 근거는 [Public Api](PUBLIC_API.md).

## Zero-base 프로젝트 초기화

```bash
llm-wiki init --dry-run --type library --agent codex --agent claude
llm-wiki init --write   --type library --agent codex --agent claude
llm-wiki validate --type library
```

## 이 저장소를 dogfooding한 방법

```bash
# 뼈대 생성(core + library profile + adapters)
node bin/llm-wiki.js init --write --type library --agent codex --agent claude
# 이후 각 문서를 실제 소스 근거로 보강하고 재검증
node bin/llm-wiki.js validate --type library
```

## CI에서 검증

```bash
npx llm-wiki validate-frontmatter
npx llm-wiki validate --strict --agent codex
```

`--strict`는 warning을 실패로 처리하므로 `related.missing`·`content.not_enriched`·`evidence.*`가 릴리스 게이트에서 CI를 실패시킬 수 있다.

## 다음 조치 추천 / 규칙 설명

```bash
llm-wiki next
llm-wiki explain content.not_enriched
```

## Evidence

- `src/cli.js#symbol:printHelp` — 지원 명령·옵션의 실제 사용법 문자열.

## Review Notes

- 2026-07-13에 CLI 도움말과 공개 명령 표면을 기준으로 검토했다.
- 2026-07-16에 1.12.0 release-prep에서 `README.md`가 변경되어(감지 대상 행 추가) `evidence.stale`이 발생했다. 이 문서 내용은 무관하며 변경되지 않았다. 사람 검토(reviewed_by: Dowon-Kim, reviewed_at: 2026-07-16)로 baseline을 refresh해 `verified`를 유지한다(내용 불변).
- 2026-07-20에 1.14.3 release-prep에서 `src/cli.js`가 변경되어(bare 명령/`--help` 오리엔테이션 헤더 추가) `evidence.stale`이 발생했다. 이 문서의 명령 예시는 그대로 유효하며 내용은 변경되지 않았다. 사람 검토(reviewed_by: Dowon-Kim, reviewed_at: 2026-07-20)로 baseline을 refresh해 `verified`를 유지한다(내용 불변).
