---
title: Examples
tags:
  - llm-wiki
  - verified
status: verified
doc_type: examples
project: llm-wiki-governance
last_updated: 2026-07-23
author: cli-generated
last_edited_by: Claude Code
reviewed_by: Dowon-Kim
reviewed_at: 2026-07-23
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

## 생성 문서 언어 선택 (--doc-lang, 1.24)

```bash
llm-wiki quickstart --write --agent claude                # 위키 본문 = 영어(기본)
llm-wiki quickstart --write --agent claude --doc-lang ko  # 위키 본문 = 한국어
llm-wiki init --write --type backend --doc-lang ko        # 도메인 문서까지 한국어
```

`--doc-lang`은 생성 문서(와 handoff/스킬의 문서 작성 지시) 언어를, `--lang`은 findings/`explain` 메시지 언어를 고른다(독립적). config `llm-wiki.config.json`의 `docLanguage: "ko"`로도 기본값을 둘 수 있고 CLI가 우선한다. 기술 식별자(경로·JSON 키·frontmatter 필드·status 값·evidence locator)는 번역하지 않는다.

## 스킬 생성 + 최초 보강(bootstrap)

```bash
# init과 함께 에이전트 네이티브 스킬 생성:
#   --agent codex  -> .agents/skills/llm-wiki-<task>/SKILL.md
#   --agent claude -> .claude/skills/llm-wiki-<task>/SKILL.md
#   --skills       -> 모든 네이티브 형식(claude·codex·cursor·중립 프롬프트)
llm-wiki init --write --type backend --agent codex        # Codex 스킬 4개(bootstrap/feature/fix/docs-sync)
llm-wiki init --write --type backend --skills             # 모든 형식

# 최초 보강 워크플로를 프롬프트로도 받을 수 있다(스킬과 동일 규칙, handoff와 단일 소스 공유):
llm-wiki prompt --task bootstrap --type backend --agent codex
```

생성된 `llm-wiki-bootstrap` 스킬(또는 `prompt --task bootstrap`)을 에이전트에 붙여넣으면, `init --write`가 만든 뼈대를 실제 코드 근거로 보강하고 모든 문서를 `needs_review`로 남긴다(도구는 스킬 파일만 만들고 실행은 에이전트가 한다 — recognize-don't-run). 기존 스킬 파일은 덮어쓰지 않는다.

## 온보딩·작업 준비 (onboard · prepare)

```bash
# 신입이 업무 영역을 코드 근거와 함께 학습(읽기 전용):
llm-wiki onboard                          # 프로젝트 전체 오리엔테이션
llm-wiki onboard --domain authentication  # 특정 업무 영역
llm-wiki onboard --domain authentication --lang ko

# 기능 추가/수정 착수 전 범위 조사(읽기 전용, 후보만 제시·단정 없음):
llm-wiki prepare --task "로그인 실패 횟수를 화면에 표시"
llm-wiki prepare --task "사용자 목록 API의 500 오류 수정" --lang ko
```

`onboard`는 읽을 문서·소스/테스트 진입점·불변조건·최신성 경고·이해도 점검 질문을 기존 위키에서 조립하고, `prepare`는 관련 문서·후보 소스/테스트·위험·범위 점검표를 낸다. 둘 다 CLI가 설명을 창작하지 않으며(코드가 최종 사실) 아무것도 쓰지 않는다 — 실제 설명·구현은 `/llm-wiki-onboard`·`/llm-wiki-prepare` 스킬과 이어지는 `/llm-wiki-feature`·`/llm-wiki-fix`가 담당한다. 흐름: 신입 → onboard → prepare → feature/fix → 사람 검토.

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
- 2026-07-23에 "스킬 생성 + 최초 보강(bootstrap)" 예시 섹션을 추가했다(`--agent codex`→`.agents/skills/`, `--agent claude`→`.claude/skills/`, `--skills`→모든 형식, `prompt --task bootstrap`). 예시 명령은 현재 CLI 표면과 일치한다. 에이전트(Claude Code) 편집이라 `needs_review`로 강등 — 사람 검토 후 재승인 예정.
- 2026-07-23에 위 bootstrap/Codex 반영분을 release-prep 1.23.0의 일부로 사람 검토(reviewed_by: Dowon-Kim, reviewed_at: 2026-07-23)를 거쳐 `verified`로 재승인했다. 1.23.0 `package.json` 범프로 생긴 evidence.stale 드리프트도 reviewed_at 갱신으로 함께 해소했다(284 tests·validate --strict 0).
- 2026-07-23에 Guided Onboarding and Task Preparation(1.24 대상; 읽기 전용 `onboard`/`prepare` 명령·스킬, 검색 랭킹 `rankDocsByQuery` 재사용)을 반영했다. 에이전트(Claude Code) 편집이라 `verified`→`needs_review`로 강등한다 — 사람 검토 전까지 미확정이며 허위 검토 메타를 넣지 않는다. 이번 소스 변경(`src/commands/guided.js` 신규 등)으로 소스를 참조하는 다른 verified 문서도 재검토가 필요하다(그 문서들은 `drift --downgrade`로 정직하게 needs_review 처리).
- 2026-07-23에 "생성 문서 언어 선택(--doc-lang, 1.24)" 예시 섹션을 추가했다(`quickstart --write --agent claude` 영어 기본 / `--doc-lang ko` 한국어 / config `docLanguage`). 예시 명령은 현재 CLI 표면과 일치한다. 에이전트(Claude Code) 편집이라 `needs_review` 유지 — 사람 검토 후 재승인 예정.
- 2026-07-23에 위 1.24.0(doc-language i18n + guided onboarding) 반영분을 사람 검토(reviewed_by: Dowon-Kim, reviewed_at: 2026-07-23)를 거쳐 `verified`로 재승인했다. `--doc-lang` 예시가 현재 CLI 표면(HEAD c7a1a7a, npm dist-tags.latest=1.24.0)과 일치함을 확인했다.
