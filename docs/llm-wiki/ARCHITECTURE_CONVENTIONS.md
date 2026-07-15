---
title: Architecture Conventions
tags:
  - llm-wiki
  - verified
status: verified
doc_type: architecture_conventions
project: llm-wiki-standard
last_updated: 2026-07-15
author: cli-generated
last_edited_by: Claude Code
reviewed_by: WoongHwan-Kim
reviewed_at: 2026-07-15
wiki_block_version: v1
source_files:
  - src/cli.js
  - src/commands.js
  - src/frontmatter.js
  - src/report.js
  - src/index.js
  - src/mcp/server.js
evidence:
  - src/cli.js#symbol:parseArgs
  - src/commands.js#symbol:audit
  - src/frontmatter.js#symbol:validateFrontmatter
  - src/report.js
  - src/index.js#symbol:commands
  - src/mcp/dispatch.js#symbol:handleMessage
related:
  - docs/llm-wiki/index.md
  - docs/llm-wiki/domains/00_overview.md
  - docs/llm-wiki/PUBLIC_API.md
visibility: internal
contains_sensitive_info: false
---

# Architecture Conventions

## Summary

- 단일 CLI 진입점(`bin/llm-wiki.js` → `src/cli.js`)이 인자를 파싱하고 명령을 `src/commands.js`의 핸들러로 디스패치한다.
- 대부분의 명령은 동일한 `scan*` 패밀리(구조/frontmatter/source_files/related/evidence/link/adapter/enrichment 스캔)를 조합해 findings를 만든 뒤, `src/report.js`가 text/json/markdown으로 출력한다.
- 부수효과(파일 쓰기)는 명시적인 `init --write`·`quickstart --write`·`fix --write`와 `--out` 리포트 저장에만 한정된다. 나머지는 읽기 전용이다.

## Module Layout

- `src/cli.js` — 인자 파싱(`parseArgs`), 기본 옵션 단일 소스(`defaultOptions`), 명령→핸들러 매핑, exit code 계산.
- `src/index.js` — 공개 프로그래매틱 API 진입점(`package.json` `exports`). 동결된 `commands` 맵·개별 함수 export·`normalizeOptions`·`parseArgs`/`run`·`SCHEMA_VERSION`을 re-export하고, MCP 표면(`startMcpServer`·`MCP_TOOLS`·`handleMcpMessage`·`MCP_PROTOCOL_VERSION`)도 함께 export한다. JSDoc typedef로 반환 형태를 문서화한다.
- `src/mcp/` — Model Context Protocol 서버(1.6, `llm-wiki mcp`). `tools.js`가 읽기 전용 툴 정의(`commands` 위 얇은 래퍼)를, `dispatch.js`가 순수 JSON-RPC 핸들러(`handleMessage`)를, `server.js`가 stdio 배선(개행 구분 JSON-RPC 2.0)을 담당한다. 서드파티 SDK 없이 Node 내장만 사용(무의존성). 쓰기 명령은 노출하지 않는다.
- `src/commands.js` — 모든 명령 핸들러와 `scan*` 검증 함수, 생성 문서 템플릿 본문(`docMetadata`).
- `src/frontmatter.js` + `src/frontmatter-schema.js` — YAML frontmatter 파서와 JSON Schema 기반 필수 필드/enum 검증.
- `src/detector.js` — package.json 신호로 project type 추론.
- `src/config.js` — core/profile별 필수 문서 목록(`CORE_REQUIRED_DOCS`, `PROFILE_DOCS`).
- `src/template-renderer.js` — 생성 문서 frontmatter 템플릿과 `todayIsoDate()`.
- `src/task-prompts.js` — `prompt`/`handoff`용 반복 작업 프롬프트.
- `src/release-notes.js` — `release-notes` 구현: conventional commit 파싱·수집(`collectCommits`)과 릴리스 노트 렌더링. `buildReleaseNotesBody`가 1.7의 `--body-only` 본문(frontmatter/H1/스캐폴드 라인 제외)을 만들어 GitHub Release 본문 + 본문 민감정보 스캔에 쓰인다.
- `src/report.js` · `src/encoding.js` · `src/files.js` · `src/sensitive-info.js` — 출력, UTF-8 처리, 파일 열거, 민감정보 스캔.

## Command Pipeline

1. `main()` → `parseArgs()`가 command/options/errors를 반환하고 옵션 유효성을 검증한다.
2. 명령 핸들러가 `detectProject()`로 type/profile을 확정한다.
3. `audit()`가 여러 `scan*`을 실행해 findings를 모으고, `validate`는 audit 커버리지를 재사용한다.
4. severity(`blocked > error > warning > pass`)로 결과 등급을 정한다.
5. `withText()` + `renderTextReport()`로 사람이 읽는 리포트를, 필요 시 JSON/markdown을 만든다.

## Conventions

- 신규 검증은 `scan<Something>(cwd)` 함수로 추가하고 `audit`(및 필요 시 `status`) findings 배열에 합류시킨다. finding rule은 `category.subrule` 형태(예: `related.missing`, `content.not_enriched`)로, `findingCategory()`가 `.` 앞을 카테고리로 분류한다.
- 새 rule은 `FINDING_EXPLANATIONS`에 등록해 `explain` 명령이 조치법을 안내하게 한다.
- 안전 우선: 기존 wiki/adapter 파일은 기본 보존, `log.md`는 append-only, 민감정보 의심값은 redaction.

## Evidence

- `src/cli.js#symbol:parseArgs` — 옵션 파싱과 명령별 허용 옵션 검증.
- `src/commands.js#symbol:audit` — scan 함수들을 조합하는 중심 파이프라인.
- `src/frontmatter.js#symbol:validateFrontmatter` — 필수 필드/상태/날짜 형식 검증.
- `src/report.js` — text/json/markdown 리포트 렌더링. `--format json` 출력에 `schemaVersion`(단일 소스 `src/config.js#JSON_SCHEMA_VERSION`)을 부가한다.
- `src/index.js#symbol:commands` — CLI `COMMANDS`를 1:1로 미러링하는 프로그래매틱 API 표면.
- `src/mcp/dispatch.js#symbol:handleMessage` — 트랜스포트 무관 JSON-RPC 핸들러(초기화/tools.list/tools.call/ping). `src/mcp/server.js`가 stdio로 배선한다.

## Open Questions

- adapter 확장 구조(`ADAPTER_TARGETS`)를 플러그인화할지, 프로젝트-로컬 템플릿 override를 허용할지는 미결(ROADMAP Phase 3).

## Review Notes

- 2026-07-14에 1.3.0 명령 표면과 소스 구조를 기준으로 재검토했다.
- 2026-07-14에 1.5 프로그래매틱 API 모듈(`src/index.js`)과 `--format json`의 `schemaVersion` 부가를 반영하고, 사람 검토(reviewed_by: WoongHwan-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-14에 1.6 MCP 서버 모듈군(`src/mcp/{tools,dispatch,server}.js`, `llm-wiki mcp` 명령)을 반영했다. 사람 검토(reviewed_by: WoongHwan-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-15에 1.7 CI/CD 도입을 반영했다: Module Layout에 `src/release-notes.js`(`buildReleaseNotesBody`의 `--body-only` 본문 추출)를 추가하고, `.github/actions/validate/action.yml`·`publish.yml`의 GitHub Release 잡을 src 밖 CI 표면으로 언급했다(Gate 12). 사람 검토(reviewed_by: WoongHwan-Kim)를 거쳐 `verified`로 재승인했다.
