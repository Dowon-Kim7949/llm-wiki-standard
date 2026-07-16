---
title: Architecture Conventions
tags:
  - llm-wiki
  - verified
status: verified
doc_type: architecture_conventions
project: llm-wiki-standard
last_updated: 2026-07-16
author: cli-generated
last_edited_by: Claude Code
reviewed_by: Dowon-Kim
reviewed_at: 2026-07-16
wiki_block_version: v1
source_files:
  - src/cli.js
  - src/commands.js
  - src/frontmatter.js
  - src/report.js
  - src/index.js
  - src/config-file.js
  - src/detector.js
  - src/mcp/server.js
evidence:
  - src/cli.js#symbol:parseArgs
  - src/commands.js#symbol:audit
  - src/frontmatter.js#symbol:validateFrontmatter
  - src/report.js
  - src/index.js#symbol:commands
  - src/mcp/dispatch.js#symbol:handleMessage
  - src/cli.js#symbol:applyProjectConfig
  - src/commands/findings.js#symbol:applyRuleConfig
  - src/commands.js#symbol:renderOverriddenDoc
  - src/commands/scans.js#symbol:scanVisibilityConsistency
  - src/commands.js#symbol:monorepoCommand
  - src/detector.js#symbol:detectWorkspaces
  - src/commands/references.js#symbol:isCrossRepoReference
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

- `src/cli.js` — 인자 파싱(`parseArgs`), 기본 옵션 단일 소스(`defaultOptions`), 명령→핸들러 매핑, exit code 계산. 1.7.2부터 config 로드+병합+agent 재정규화를 공유 `applyProjectConfig`로 노출해, CLI·프로그래매틱 API·MCP 세 표면이 하나의 `llm-wiki.config.json`에서 동일 effective options를 얻게 한다.
- `src/index.js` — 공개 프로그래매틱 API 진입점(`package.json` `exports`). 동결된 `commands` 맵·개별 함수 export·`normalizeOptions`·`parseArgs`/`run`·`SCHEMA_VERSION`을 re-export하고, MCP 표면(`startMcpServer`·`MCP_TOOLS`·`handleMcpMessage`·`MCP_PROTOCOL_VERSION`)도 함께 export한다. JSDoc typedef로 반환 형태를 문서화한다. 1.7.2부터 config 인식 async `resolveOptions`(= 동기 `normalizeOptions` + `applyProjectConfig`)도 export한다(동기 `normalizeOptions`·동결 맵은 불변).
- `src/mcp/` — Model Context Protocol 서버(1.6, `llm-wiki mcp`). `tools.js`가 읽기 전용 툴 정의(`commands` 위 얇은 래퍼)를, `dispatch.js`가 순수 JSON-RPC 핸들러(`handleMessage`)를, `server.js`가 stdio 배선(개행 구분 JSON-RPC 2.0)을 담당한다. 서드파티 SDK 없이 Node 내장만 사용(무의존성). 쓰기 명령은 노출하지 않는다.
- `src/commands.js` — 명령 핸들러(오케스트레이션)와 중심 `audit` 파이프라인, 그리고 순환을 피해야 하는 소수의 핸들러(`migrateCommand`는 `audit`를 호출하므로 잔류; `graphCommand`/`statsCommand`도 헬퍼만 분리하고 본체는 잔류). 재사용 로직은 아래 `src/commands/*` 모듈로 분리했다(1.11.1 동작 보존 내부 리팩터). 배럴 re-export로 `from "./commands.js"` import 표면과 동결된 CLI/프로그래매틱 API는 byte-identical하게 유지된다.
- `src/commands/` — commands.js에서 추출한 동작 보존 서브모듈군(단방향 의존: leaf → wiki-graph/adapters → scans → fix-migrate → commands.js):
  - `references.js` — 링크/참조 파싱 헬퍼(`escapeRegex`/`parseEvidenceReference`/`isExternalSourceReference`/`isCrossRepoReference` + Markdown·wiki 링크 추출/정규화/해석).
  - `findings.js` — finding 레지스트리와 리포트 포매터: `FINDING_EXPLANATIONS`·`findingExplanation`·`applyRuleConfig`(+ `NON_TOGGLEABLE_CATEGORIES`)·`findingCategory`/`summarizeFindings`·`format*`·`withText`.
  - `scans.js` — `scan*` 패밀리 전체(encoding/sensitive/source_files/related/enrichment/thin_body/visibility/evidence/okf/markdown_link/wiki_link)와 드리프트 로직(`scanEvidenceDrift` + 순수·export되는 `driftTargets`).
  - `wiki-graph.js` — 지식 그래프 구성/렌더(`collectWikiGraph`·`buildWikiLinkTargetIndex`·`emptyWikiGraph`·`renderGraphMermaid`/`renderGraphDot`).
  - `adapters.js` — 어댑터 레지스트리 `ADAPTER_TARGETS`(+ `TEMPLATE_ROOT`)와 스캔/제안/쓰기/상태 헬퍼(`scanAdapters`·`planAdapterSuggestions`·`writeAdapterFiles`·`summarizeAdapterStatus`·`selectedAgents`).
  - `wiki-files.js` — 스캔·어댑터·fix/migrate가 공유하는 파일 열거/판별 유틸(`listTargetMarkdown`·`listWikiContentDocs`·`isAppendOnlyLog`).
  - `fix-migrate.js` — `fix`/`drift` 명령과 fix/migrate 공유 헬퍼(block-version 분석·`runMechanicalRemediation`·frontmatter/evidence 편집·`renderStubDocument`·`blockedApply`). `migrateCommand`는 `audit` 순환 회피로 commands.js에 잔류하며 이 헬퍼들을 import한다.
  - `domains.js` — backend/fullstack 도메인 감지·계획(`detectDomainDirectories`·`planDomainDocs` 등).
  - `doc-templates.js` — 생성 문서 본문 템플릿(`docMetadata` + 본문 빌더).
- `src/frontmatter.js` + `src/frontmatter-schema.js` — YAML frontmatter 파서와 JSON Schema 기반 필수 필드/enum 검증.
- `src/detector.js` — package.json 신호로 project type 추론. 1.10부터 `detectWorkspaces`가 npm/yarn `workspaces`를 감지한다(pnpm/YAML은 zero-dep 위해 unsupported로 보고). 1.12부터 `detectMobile`이 Android(Gradle Android 플러그인/AndroidX/AndroidManifest.xml)·Flutter(`pubspec.yaml` flutter 섹션)·Apple/iOS(Podfile/`*.xcodeproj`/Apple-플랫폼 Package.swift)·React Native(`react-native` 의존성) 신호로 `mobile` 유형을 감지하고, `decideType`에서 최우선 순위를 가져 Android `build.gradle`의 JVM `library` 오분류를 교정한다(빌드 도구 미호출·bounded 스캔·zero-dep). 1.13부터 `detectInfra`가 Docker(`Dockerfile`)·Compose·Kubernetes(apiVersion+kind YAML)·Helm(`Chart.yaml`)·Terraform(`*.tf`) 신호로 `infra` 유형을 감지한다 — 단, `infra`는 **fallback**이라 앱 신호(frontend/backend/library/mobile)가 없을 때만 선택되어 컨테이너화된 앱 레포는 앱 유형을 유지한다(클러스터/레지스트리 접근 없음·zero-dep). 1.14부터 `detectGoStdlibServer`/`detectPythonStdlibServer`가 bounded 소스 스캔(import + 서버 시작 호출)으로 Go `net/http`·Python stdlib HTTP 서버를 감지해 해당 생태계 role을 `library`→`backend`로 **단방향** 승격한다(강등 없음, 프레임워크 의존성 불요).
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
- 새 rule은 `FINDING_EXPLANATIONS`에 등록해 `explain` 명령이 조치법을 안내하게 한다. `defaultSeverity`가 rule→severity 단일 소스다(push 지점과 일치 감사됨).
- config `rules` 토글은 중앙 `applyRuleConfig`가 `audit`/`status`/`validate-frontmatter`의 findings에 적용한다(off 드롭·severity override, idempotent). `sensitive.*` 같은 안전 카테고리는 `NON_TOGGLEABLE_CATEGORIES`로 토글에서 제외한다. opt-in lint(예: `content.thin_body`)는 config로 활성화될 때만 findings를 낸다(1.8).
- config `requiredDocs`(커스텀 문서셋)는 `findMissingDocs`가 core/profile 필수 목록에 병합해 `structure.required_doc`로 검사한다. config `templates` 오버라이드는 `renderOverriddenDoc`가 **body만** 취하고 frontmatter는 항상 `renderWikiDocumentTemplate`(status: needs_review)가 생성해, 오버라이드가 `status: verified`를 만들 수 없다(구조적 가드레일)(1.8).
- 안전 우선: 기존 wiki/adapter 파일은 기본 보존, `log.md`는 append-only, 민감정보 의심값은 redaction.

## Evidence

- `src/cli.js#symbol:parseArgs` — 옵션 파싱과 명령별 허용 옵션 검증.
- `src/commands.js#symbol:audit` — scan 함수들을 조합하는 중심 파이프라인.
- `src/frontmatter.js#symbol:validateFrontmatter` — 필수 필드/상태/날짜 형식 검증.
- `src/report.js` — text/json/markdown 리포트 렌더링. `--format json` 출력에 `schemaVersion`(단일 소스 `src/config.js#JSON_SCHEMA_VERSION`)을 부가한다.
- `src/index.js#symbol:commands` — CLI `COMMANDS`를 1:1로 미러링하는 프로그래매틱 API 표면.
- `src/mcp/dispatch.js#symbol:handleMessage` — 트랜스포트 무관 JSON-RPC 핸들러(초기화/tools.list/tools.call/ping). `src/mcp/server.js`가 stdio로 배선한다. 1.7.2부터 `tools/call`이 `resolveOptions`로 프로젝트 config를 병합한다.
- `src/cli.js#symbol:applyProjectConfig` — `llm-wiki.config.json` 로드+병합의 공유 seam. CLI·`resolveOptions`(API)·MCP가 함께 써 세 표면이 동일 옵션을 해석한다(1.7.2).
- `src/commands/findings.js#symbol:applyRuleConfig` — config `rules` 토글을 findings에 중앙 적용(off 드롭·severity override; `sensitive.*` 비토글)(1.8).
- `src/commands.js#symbol:renderOverriddenDoc` — config `templates` 오버라이드를 body-only로 적용해 `verified`를 만들 수 없게 하는 가드레일(1.8).
- `src/commands/scans.js#symbol:scanVisibilityConsistency` — opt-in visibility 일관성 린트(sensitive-info 스캔 재사용, 값 미노출; 기본 off/warning/read-only)(1.9).
- `src/commands.js#symbol:monorepoCommand` — monorepo profile: cwd-파라미터라이즈드 파이프라인을 패키지별 실행·집계(additive `packages[]`)(1.10).
- `src/detector.js#symbol:detectWorkspaces` — npm/yarn workspaces 감지(pnpm/YAML unsupported)(1.10).
- `src/detector.js#symbol:detectMobile` — Android/Flutter/iOS/React Native 신호로 `mobile` 유형 감지(빌드 도구 미호출, recognize-don't-build); `decideType` 최우선 순위로 Android `build.gradle` library 오분류 교정(1.12).
- `src/detector.js#symbol:detectInfra` — Docker/Compose/Kubernetes/Helm/Terraform 신호로 `infra` 유형 감지(클러스터/레지스트리 접근 없음, recognize-don't-deploy); `decideType`에서 fallback(앱 신호 없을 때만)이라 앱 레포 byte-identical(1.13).
- `src/detector.js#symbol:detectGoStdlibServer`·`detectPythonStdlibServer` — bounded 소스 스캔(import + 서버 시작 호출)으로 Go `net/http`·Python stdlib HTTP 서버를 감지해 role을 `library`→`backend`로 단방향 승격(강등 없음, 클라이언트-only는 library 유지)(1.14).
- `src/commands/references.js#symbol:isCrossRepoReference` — 예약 cross-repo 참조 스킴(`repo:<name>/<path>`) 인식; `isExternalSourceReference`/wiki-link 해석기가 external로 처리(recognize-don't-verify)(1.11).

## Open Questions

- adapter 확장 구조(`ADAPTER_TARGETS`)를 플러그인화할지, 프로젝트-로컬 템플릿 override를 허용할지는 미결(ROADMAP Phase 3).

## Review Notes

- 2026-07-14에 1.3.0 명령 표면과 소스 구조를 기준으로 재검토했다.
- 2026-07-14에 1.5 프로그래매틱 API 모듈(`src/index.js`)과 `--format json`의 `schemaVersion` 부가를 반영하고, 사람 검토(reviewed_by: Dowon-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-14에 1.6 MCP 서버 모듈군(`src/mcp/{tools,dispatch,server}.js`, `llm-wiki mcp` 명령)을 반영했다. 사람 검토(reviewed_by: Dowon-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-15에 1.7 CI/CD 도입을 반영했다: Module Layout에 `src/release-notes.js`(`buildReleaseNotesBody`의 `--body-only` 본문 추출)를 추가하고, `.github/actions/validate/action.yml`·`publish.yml`의 GitHub Release 잡을 src 밖 CI 표면으로 언급했다(Gate 12). 사람 검토(reviewed_by: Dowon-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-15에 1.7.2 enabling-prep(config 로딩 일원화)을 반영했다: `src/cli.js`의 공유 `applyProjectConfig`와 `src/index.js`의 config 인식 `resolveOptions`, MCP `tools/call`의 config 병합을 Module Layout·Evidence에 추가했다(Gate 13). 사람 검토(reviewed_by: Dowon-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-15에 1.8.0 config schema growth(Gate 13, accepted)를 반영했다: 중앙 `applyRuleConfig`(config `rules` 토글)와 `NON_TOGGLEABLE_CATEGORIES` 안전 가드, opt-in lint 패턴(`content.thin_body`)을 Conventions·Evidence에 추가했다. 사람 검토(reviewed_by: Dowon-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-15에 1.8.1 config schema growth 2부(Gate 13 완성)를 반영했다: 커스텀 문서셋(`findMissingDocs`의 `requiredDocs` 병합)과 템플릿 오버라이드(`renderOverriddenDoc`의 body-only `verified` 가드레일)를 Conventions·Evidence에 추가했다. 사람 검토(reviewed_by: Dowon-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-15에 1.9.0 visibility governance(Gate 14, accepted)를 반영했다: opt-in 일관성 린트 `scanVisibilityConsistency`(sensitive-info 스캔 재사용, 값 미노출)를 Evidence에 추가했다. 사람 검토(reviewed_by: Dowon-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-15에 1.10.0 monorepo profile(Gate 15, accepted)을 반영했다: `detectWorkspaces`(Module Layout)와 `monorepoCommand`(Evidence)를 추가했다 — cwd-파라미터라이즈드 파이프라인을 패키지별 실행·집계(additive `packages[]`, 단일 레포 byte-identical). 사람 검토(reviewed_by: Dowon-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-15에 1.11.0 cross-repo knowledge links(Gate 16, accepted)를 반영했다: `isCrossRepoReference`(예약 `repo:<name>/<path>` 스킴)와 `isExternalSourceReference`/wiki-link 해석기의 external 처리를 Evidence에 추가했다 — recognize-don't-verify, additive(로컬 해석 불변). 사람 검토(reviewed_by: Dowon-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-16에 1.11.1 commands.js 모듈 분리(동작 보존 내부 리팩터)를 반영했다: Module Layout에 `src/commands/*` 서브모듈군(references·findings·scans·wiki-graph·adapters·wiki-files·fix-migrate·domains·doc-templates)과 단방향 의존·배럴 re-export 불변식을 기술하고, Evidence의 이동 심볼 포인터(`applyRuleConfig`→findings, `scanVisibilityConsistency`→scans, `isCrossRepoReference`→references)를 갱신했다. `migrateCommand`가 `audit` 순환 회피로 commands.js에 잔류함을 명시했다. 코드에 맞춰 문서를 수정한 뒤 사람 검토(reviewed_by: Dowon-Kim, reviewed_at: 2026-07-16)를 거쳐 `verified`로 재승인했다.
- 2026-07-16에 1.12.0 mobile profile(Gate 17, accepted)을 반영했다: `src/detector.js`에 `detectMobile`(Android/Flutter/iOS/React Native 신호)과 `decideType` mobile 최우선 분기를 Module Layout·Evidence에 추가하고, Android `build.gradle` → JVM `library` 오분류 교정을 기술했다. 코드에 맞춰 문서를 수정한 뒤 사람 검토(reviewed_by: Dowon-Kim, reviewed_at: 2026-07-16)를 거쳐 `verified`로 재승인했다.
- 2026-07-16에 1.13.0 infra/DevOps profile(Gate 18, accepted)을 반영했다: `src/detector.js`에 `detectInfra`(Docker/Compose/Kubernetes/Helm/Terraform)와 `decideType`의 infra fallback 분기(앱 신호 없을 때만)를 Module Layout·Evidence에 추가했다. 코드에 맞춰 문서를 수정한 뒤 사람 검토(reviewed_by: Dowon-Kim, reviewed_at: 2026-07-16)를 거쳐 `verified`로 재승인했다.
- 2026-07-16에 1.14.0 stdlib-server detection(Gate 19, accepted)을 반영했다: `detectGoStdlibServer`/`detectPythonStdlibServer`(bounded 소스 스캔; Go `net/http`·Python stdlib HTTP 서버 → role `library`→`backend` 단방향 승격)를 Module Layout·Evidence에 추가했다. 코드에 맞춰 문서를 수정한 뒤 사람 검토(reviewed_by: Dowon-Kim, reviewed_at: 2026-07-16)를 거쳐 `verified`로 재승인했다.
