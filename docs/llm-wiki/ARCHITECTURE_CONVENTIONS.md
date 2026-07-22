---
title: Architecture Conventions
tags:
  - llm-wiki
  - verified
status: verified
doc_type: architecture_conventions
project: llm-wiki-governance
last_updated: 2026-07-22
author: cli-generated
last_edited_by: Claude Code
reviewed_by: Dowon-Kim
reviewed_at: 2026-07-22
wiki_block_version: v1
source_files:
  - src/cli.js
  - src/commands.js
  - src/frontmatter.js
  - src/report.js
  - src/index.js
  - src/config-file.js
  - src/detector.js
  - src/encoding.js
  - src/git.js
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
  - `scans.js` — `scan*` 패밀리 전체(encoding/sensitive/source_files/related/enrichment/thin_body/visibility/evidence/okf/markdown_link/wiki_link)와 드리프트 로직: date-앵커 `scanEvidenceDrift`와 diff-앵커 `scanReverseImpact`(Gate 23, 1.17), 그리고 둘이 공유하는 순수·export되는 앵커 추출기 `verifiedSourceAnchors`(+ 그 위에 review-date baseline을 얹는 `driftTargets`). 1.19(Gate 25)부터 evidence 검증이 FORMAT을 넘어 MEANING을 본다: `scanEvidenceReferences`가 `#symbol:`/`#section:` locator의 **타깃 실재**를 보수적으로 확인하고(파일이 이름/헤딩을 전혀 언급 안 할 때만 `evidence.symbol_unverified`/`evidence.section_unverified`; `·`-결합 심볼 목록·`.md` 섹션만·`readTextAuto` BOM 인식), 신규 `scanUngroundedVerified`가 grounding 없는 `verified` 문서를 `evidence.ungrounded`(warning, `--strict` 미승격)로 flag하며, 순수 `evidenceTier`(+ `EVIDENCE_REFERENCE_RULES`)가 `reference_checked`/`human_verified` 단계를 계산해 `stats` JSON에 additive로 노출한다(신규 frontmatter 필드/status값 없음).
  - `wiki-graph.js` — 지식 그래프 구성/렌더(`collectWikiGraph`·`buildWikiLinkTargetIndex`·`emptyWikiGraph`·`renderGraphMermaid`/`renderGraphDot`).
  - `adapters.js` — 어댑터 레지스트리 `ADAPTER_TARGETS`(+ `TEMPLATE_ROOT`)와 스캔/제안/쓰기/상태 헬퍼(`scanAdapters`·`planAdapterSuggestions`·`writeAdapterFiles`·`summarizeAdapterStatus`·`selectedAgents`).
  - `wiki-files.js` — 스캔·어댑터·fix/migrate가 공유하는 파일 열거/판별 유틸(`listTargetMarkdown`·`listWikiContentDocs`·`isAppendOnlyLog`).
  - `fix-migrate.js` — `fix`/`drift` 명령과 fix/migrate 공유 헬퍼(block-version 분석·`runMechanicalRemediation`·frontmatter/evidence 편집·`renderStubDocument`·`blockedApply`). `migrateCommand`는 `audit` 순환 회피로 commands.js에 잔류하며 이 헬퍼들을 import한다.
  - `domains.js` — 도메인 감지·계획. backend/fullstack은 `detectDomainDirectories`(디렉터리/파일 도메인), frontend/mobile(SPA)은 `detectFrontendDomains`(`pages`/`views`/`features`/`modules`/`screens` 하위 폴더 + vue-router/react-router 라우트 그룹 정규식 파싱, zero-dep, SPA UI 배관 폴더 제외); 둘 다 `planDomainDocs`로 결정적 계획. `buildDomainContext`가 유형별로 게이팅한다(백엔드/풀스택 경로 byte-identical).
  - `doc-templates.js` — 생성 문서 본문 템플릿(`docMetadata` + 본문 빌더).
  - `skills.js` — (1.15, Gate 21) 위키-그라운디드 자동화 프롬프트 아티팩트 생성. `SKILL_TASKS`(feature/fix/docs-sync)와 `selectedSkillFormats`/`planSkillArtifacts`/`writeSkillArtifacts`로 Claude 스킬(`.claude/skills/`)·Cursor 룰(`.cursor/rules/`)·중립 프롬프트(`.llm-wiki/prompts/`)를 만든다. 본문은 `task-prompts.js` 재사용 + `docs/llm-wiki/domains/` 도메인 맵 스냅샷 주입. opt-in·미덮어씀·recognize-don't-run. init이 어댑터 쓰기와 나란히 호출.
  - `retrieval.js` — (1.18, Gate 24) read-only retrieval 4개 핸들러(`listDocsCommand`·`searchDocsCommand`·`getDocCommand`·`getRelatedCommand`). 거버넌스 리포트가 아니라 문서 **본문**을 반환하는 유일 표면. `listWikiContentDocs`(열거)·`parseFrontmatter`(필터/본문)·`collectWikiGraph`(get-related 이웃)·`scanSensitiveInfo`(redaction) 재사용. `search-docs`는 zero-dep 키워드/부분문자열(AND, 점수 랭크; semantic 아님). restricted/민감(visibility restricted·contains_sensitive_info·sensitive 스캔 히트) 문서는 list/search 기본 제외(opt-in `includeSensitive`), 반환 본문/스니펫은 민감 라인 redact. commands.js가 배럴 re-export.
- `src/frontmatter.js` + `src/frontmatter-schema.js` — YAML frontmatter 파서와 JSON Schema 기반 필수 필드/enum 검증.
- `src/detector.js` — package.json 신호로 project type 추론. 1.10부터 `detectWorkspaces`가 npm/yarn `workspaces`를 감지한다(pnpm/YAML은 zero-dep 위해 unsupported로 보고). 1.12부터 `detectMobile`이 Android(Gradle Android 플러그인/AndroidX/AndroidManifest.xml)·Flutter(`pubspec.yaml` flutter 섹션)·Apple/iOS(Podfile/`*.xcodeproj`/Apple-플랫폼 Package.swift)·React Native(`react-native` 의존성) 신호로 `mobile` 유형을 감지하고, `decideType`에서 최우선 순위를 가져 Android `build.gradle`의 JVM `library` 오분류를 교정한다(빌드 도구 미호출·bounded 스캔·zero-dep). 1.13부터 `detectInfra`가 Docker(`Dockerfile`)·Compose·Kubernetes(apiVersion+kind YAML)·Helm(`Chart.yaml`)·Terraform(`*.tf`) 신호로 `infra` 유형을 감지한다 — 단, `infra`는 **fallback**이라 앱 신호(frontend/backend/library/mobile)가 없을 때만 선택되어 컨테이너화된 앱 레포는 앱 유형을 유지한다(클러스터/레지스트리 접근 없음·zero-dep). 1.14부터 `detectGoStdlibServer`/`detectPythonStdlibServer`가 bounded 소스 스캔(import + 서버 시작 호출)으로 Go `net/http`·Python stdlib HTTP 서버를 감지해 해당 생태계 role을 `library`→`backend`로 **단방향** 승격한다(강등 없음, 프레임워크 의존성 불요). 1.14.1부터 detector의 모든 매니페스트/소스 읽기는 BOM 인식(`readTextAuto`)이라 UTF-16(LE/BE)·UTF-8 BOM으로 저장된 매니페스트(예: Windows에서 저장된 `requirements.txt`)도 mojibake 없이 디코드해 유형 오분류를 막는다.
- `src/config.js` — core/profile별 필수 문서 목록(`CORE_REQUIRED_DOCS`, `PROFILE_DOCS`).
- `src/config-file.js` — `llm-wiki.config.json` 로딩·병합 엔진(`CONFIG_FILENAME`·`RULE_TOGGLE_ACTIONS`·`loadProjectConfig`·`mergeConfigIntoOptions`). `src/cli.js`·`src/commands.js`가 함께 import하며, cli.js의 공유 seam `applyProjectConfig`가 이 위에서 CLI·프로그래매틱 API·MCP 세 표면의 effective options를 일원화한다(1.7.2).
- `src/template-renderer.js` — 생성 문서 frontmatter 템플릿과 `todayIsoDate()`.
- `src/task-prompts.js` — `prompt`/`handoff`용 반복 작업 프롬프트.
- `src/release-notes.js` — `release-notes` 구현: conventional commit 파싱·수집(`collectCommits`)과 릴리스 노트 렌더링. `buildReleaseNotesBody`가 1.7의 `--body-only` 본문(frontmatter/H1/스캐폴드 라인 제외)을 만들어 GitHub Release 본문 + 본문 민감정보 스캔에 쓰인다.
- `src/git.js` — git 프리미티브(`runGit`·`changedFiles`·`fileChangedSince`·`lineRangeChangedSince`·`isPathIgnored`). `impact`/`validate --changed`의 변경집합(1.17), date-앵커 drift, `initWrite`/`doctor`의 `structure.output_gitignored` 탐지(1.14.2)를 구동한다 — 모두 best-effort라 비-git 환경/미무시 경로는 안전 폴백(false/빈 집합).
- `src/report.js` · `src/encoding.js` · `src/files.js` · `src/sensitive-info.js` — 출력, UTF-8 처리, 파일 열거, 민감정보 스캔. 1.14.1부터 `encoding.js`는 detector 전용 BOM 인식 리더(`readTextAuto`/`decodeWithBom`; UTF-16LE/BE·UTF-8 BOM)도 제공한다 — 위키 문서용 `readUtf8`는 raw UTF-8을 보존해 mojibake 스캔이 계속 동작하도록 불변.

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
- `src/encoding.js#symbol:readTextAuto` — detector 매니페스트/소스 읽기용 BOM 인식 리더(UTF-16LE/BE·UTF-8 BOM 디코드; BOM 없는 파일은 byte-identical). 위키 문서용 `readUtf8`는 raw UTF-8 보존으로 불변(1.14.1).
- `src/commands.js#symbol:buildHandoff` — handoff 진입점을 명시적으로 선택된 에이전트의 어댑터 파일로만 한정(미선택 시 `docs/llm-wiki/index.md`), 생성되지 않은 `AGENTS.md`/`CLAUDE.md`를 가리키지 않음(1.14.1).
- `src/commands/fix-migrate.js#symbol:needsWriteFlag` — 모드 플래그 없는 `init`/`quickstart`을 `Ready (needs --write)`(result `ready`, exit 0)로 안내; 충돌 플래그는 여전히 `blockedApply`(1.14.1).
- `src/git.js#symbol:isPathIgnored` — `git check-ignore` 기반 gitignore 탐지(best-effort; 비-git·미무시는 false). `initWrite`·`doctor`가 위키 출력(`docs/llm-wiki`)이 gitignore되면 `structure.output_gitignored` 경고를 낸다(차단 아님)(1.14.2).
- `src/commands/references.js#symbol:parseEvidenceReference` — evidence 참조 파서. 1.14.2부터 콜론-라인 표기(`파일:10`·`파일:10-20`)를 `#L` 형과 동등한 line locator로 수용(external 우선 처리 뒤).
- `src/cli.js#symbol:helpText` — bare 명령/`--help`의 이중언어(KO+EN) 오리엔테이션(무엇/왜/3단계) + 버전·`@latest` 팁을 담은 테스트 가능한 help 문자열; `packageVersion()`으로 stale npx 캐시를 표면화(1.14.3).
- `src/commands/skills.js#symbol:writeSkillArtifacts` — feature/fix/docs-sync 위키-그라운디드 자동화 프롬프트를 Claude 스킬/Cursor 룰/중립 프롬프트로 생성; `task-prompts.js` 본문 재사용 + 도메인 맵 주입, `--skills`/`--agent claude|cursor` opt-in, 미덮어씀, recognize-don't-run(1.15, Gate 21).
- `src/commands.js#symbol:impactCommand` — `impact` 명령(read-only, Gate 23): `changedFiles`로 변경집합을 구하고 `scanReverseImpact`로 diff-앵커 reverse-impact를 낸다. 기본 warning, `--strict`는 공유 `exitCodeFor`의 warning-in-strict 규칙으로 CI 실패, 빈 변경집합은 no-op(1.17).
- `src/commands.js#symbol:checkRunCommand` — `check-run` 명령(read-only, Gate 26): `.llm-wiki/runs/`의 최신(또는 `--run <path>`) **run manifest**를 읽어 스킬 실행이 주장한 파이프라인을 검증한다 — `changedSource`가 `touchedDocs`의 `source_files`/`evidence`에 참조되는지, 로그 append·validate pass 여부. 신규 토글 `run.*`(`run.doc_gap`/`run.log_missing`/`run.unvalidated` warning, `run.manifest_missing` warning, `run.manifest_invalid` error), 기본 warning·`--strict` CI 실패. `impact`(diff-앵커)의 intent-앵커 보완. 쓰기 없음(매니페스트는 에이전트가 자기 실행 중 작성). 스킬 본문에 완성 계약이 내장된다(`src/commands/skills.js#symbol:artifactBody`)(1.19).
- `src/commands/scans.js#symbol:scanReverseImpact` — 변경집합에 든 소스를 참조하나 문서 자신은 안 바뀐 `verified` 문서를 `impact.source_changed`로 flag(file-level; date-앵커 `scanEvidenceDrift`의 pre-merge 보완; 같은 diff에서 바뀐 문서는 미flag)(1.17).
- `src/commands/scans.js#symbol:verifiedSourceAnchors` — `verified` 문서의 로컬 소스 앵커 추출기(순수). date-앵커 drift와 diff-앵커 impact가 공유하는 단일 추출기(외부 `http(s)`/`repo:` 참조 제외)(1.17).
- `src/git.js#symbol:changedFiles` — 변경집합 프리미티브(working tree, 또는 `--since <ref>`의 `git diff --name-only`); `impact`와 `validate --changed`가 공유(1.17).
- `src/commands/retrieval.js#symbol:searchDocsCommand`·`getDocCommand` — read-only retrieval(Gate 24, 1.18): 문서 본문을 반환하는 `list-docs`/`search-docs`/`get-doc`/`get-related`. zero-dep 키워드 검색, visibility 존중 + sensitive-info redaction, 쓰기 표면 없음. API+MCP+CLI 3표면(MCP 툴은 snake_case). commands.js 배럴 re-export.
- `src/commands/scans.js#symbol:scanEvidenceReferences` — evidence 검증(Gate 25, 1.19): FORMAT(shape/파일 존재/line 범위)에 더해 `#symbol:`/`#section:` locator의 **타깃 실재**를 보수적으로 확인(파일이 이름/헤딩을 전혀 언급 안 할 때만 `evidence.symbol_unverified`/`evidence.section_unverified`; `.md` 섹션만; AST 아님).
- `src/commands/scans.js#symbol:scanUngroundedVerified` — grounding(`source_files`·`evidence`) 없는 `verified` 문서를 `evidence.ungrounded`로 flag(warning, `--strict` 미승격; config `rules`로 off/escalate)(Gate 25, 1.19).
- `src/commands/scans.js#symbol:evidenceTier` — `reference_checked`(grounding 있고 모든 참조 해소) vs `human_verified`(verified+리뷰 메타) 단계를 계산하는 순수 함수(+ `EVIDENCE_REFERENCE_RULES`); `stats` JSON `evidenceTiers`에 additive 노출(신규 frontmatter 필드/status값 없음)(Gate 25, 1.19).

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
- 2026-07-20에 1.14.1 노출-테스트 fix 배치를 반영했다: (A) `src/encoding.js`의 BOM 인식 리더(`readTextAuto`/`decodeWithBom`)와 이를 쓰는 detector 매니페스트/소스 읽기 — UTF-16/UTF-8-BOM 매니페스트 오분류 교정 — 를 Module Layout·Evidence에 추가하고 `src/encoding.js`를 source_files에 넣었다. (B) `buildHandoff`가 진입점에 명시적 선택 에이전트의 어댑터 파일만 넣도록, (C) `needsWriteFlag`로 모드 플래그 없는 `init`/`quickstart`이 `Ready (needs --write)`(exit 0)로 안내하도록 한 변경을 Evidence에 기술했다. (D) BE 개발자 추가 보고서를 반영해 `handoffNextStep`(handoff `Next Step`을 "프롬프트는 CLI가 아니라 에이전트에 붙여넣는 지시문"임을 명시하는 3단계 안내)과 `quickstartInitSummary`의 skip 사유 주석·브라운필드 안내를 commands.js에 추가했다(출력 명료화, 계약·동작 불변). 코드에 맞춰 문서를 수정한 뒤 사람 검토(reviewed_by: Dowon-Kim, reviewed_at: 2026-07-20)를 거쳐 `verified`로 재승인했다.
- 2026-07-20에 1.14.2 사용성 다듬기를 반영했다: `parseEvidenceReference`의 콜론-라인 수용(`파일:10`→line locator), `collectWikiGraph` orphan에서 `/templates/` 제외, `src/git.js#isPathIgnored` + `structure.output_gitignored` 경고(initWrite·doctor에서 gitignore된 위키 출력 탐지), `initWrite` 안심 요약 라인을 Evidence·Module Layout에 기술했다(출력 명료화, 계약·동작 불변; git 호출은 best-effort). 코드에 맞춰 문서를 수정한 뒤 사람 검토(reviewed_by: Dowon-Kim, reviewed_at: 2026-07-20)를 거쳐 `verified`로 재승인했다.
- 2026-07-20에 1.14.3 온보딩 오리엔테이션을 반영했다: `src/cli.js`에 `helpText()`(테스트 가능한 help 문자열 — 이중언어 KO+EN 오리엔테이션 + 버전 + `@latest` 팁)와 `packageVersion()`을 추가하고 `printHelp`가 이를 출력하도록 리팩터했으며, `quickstartCommand`에 이중언어 `About · 소개` 섹션을 추가했다(프레젠테이션 변경; CLI 명령·`--format json`·동결 프로그래매틱 API 불변). Evidence에 `helpText` 포인터를 추가했다. 사람 검토(reviewed_by: Dowon-Kim, reviewed_at: 2026-07-20)를 거쳐 `verified`로 재승인했다.
- 2026-07-20에 1.14.4 도메인 감지 수정을 반영했다: `src/commands/domains.js`의 순회 제외를 강화했다 — `pyvenv.cfg` 마커를 가진 디렉터리(=virtualenv)는 `scanForDomainParents`에서 통째 스킵하고, `site-packages`/`dist-packages`와 버전형 `venv*`/`env<N>` 이름을 제외 목록/`isSkippedTraversalDir`에 추가했다. `venv3.10/Lib/site-packages/`의 서드파티(passlib `handlers/`·boto3 `resources/`)가 파일-도메인으로 오탐되던 버그를 교정(venv 없는 레포는 byte-identical). 사람 검토(reviewed_by: Dowon-Kim, reviewed_at: 2026-07-20)를 거쳐 `verified`로 재승인했다.
- 2026-07-20에 1.15.0 스킬 생성(Gate 21, accepted)을 반영했다: 신규 `src/commands/skills.js`(위키-그라운디드 자동화 프롬프트를 Claude 스킬·Cursor 룰·중립 프롬프트로 생성, 도메인 맵 주입, recognize-don't-run)를 Module Layout·Evidence에 추가하고, `src/cli.js`의 `--skills` 플래그와 `initDryRun`/`initWrite`의 skill plan/write 배선(어댑터 쓰기와 나란히)을 기술했다. 코드에 맞춰 문서를 수정한 뒤 사람 검토(reviewed_by: Dowon-Kim, reviewed_at: 2026-07-20)를 거쳐 `verified`로 재승인했다.
- 2026-07-21에 1.16.0 English-first 출력 전환 + rename을 반영했다: `src/cli.js`의 `helpText()`를 EN-first로 재정렬하고, `src/commands.js`의 `buildHandoff`에서 에이전트에 붙여넣는 handoff 프롬프트를 **완전 영어**로, 주변 message/Next Step(`handoffNextStep`)·quickstart `About`·brownfield/gitignore/`SKILL_RELOAD_NOTE` 안내를 EN-first 이중언어로 재정렬했다. `handoffLabel`(`또는`→`or`)·`handoffEntrypoints`(`와/를`→`and`)도 영어화. 프레젠테이션 변경으로 CLI 명령·`--format json`·동결 프로그래매틱 API·zero-dep은 불변. 함께 패키지명 `@dowonk-7949/llm-wiki-standard`→`llm-wiki-governance` 개명·저장소 rename도 반영했다. 에이전트(Claude Code) 편집이라 `needs_review`로 강등 — 사람 검토 후 재승인 예정.
- 2026-07-21에 1.17.0 reverse-impact(Gate 23, accepted)를 반영했다: `src/commands/scans.js`에 diff-앵커 `scanReverseImpact`와, date-앵커 drift와 공유하는 순수 앵커 추출기 `verifiedSourceAnchors`(driftTargets는 이제 여기에 baseline을 얹는 델리게이트 — 동작 보존)를 추가하고, `src/commands.js`에 read-only `impactCommand`(`changedFiles` 변경집합 + `scanReverseImpact`; `--strict` CI 실패; 빈 집합 no-op)를 추가했다. `src/cli.js`/`src/index.js`에 `impact` 명령을 등록하고 `impact.source_changed`(toggleable, 기본 warning)·`impact.unavailable`(error)를 finding 레지스트리에 등록했다. Module Layout·Evidence를 갱신했다. additive·zero-dep(기존 git 프리미티브 재사용)·1.0.0 계약 불변. 에이전트(Claude Code) 편집이라 `needs_review`로 강등 — 사람 검토 후 재승인 예정.
- 2026-07-21에 1.18.0 read-only retrieval(Gate 24, accepted)를 반영했다: 신규 `src/commands/retrieval.js`(4개 핸들러 `listDocsCommand`/`searchDocsCommand`/`getDocCommand`/`getRelatedCommand`)를 Module Layout `src/commands/*` 목록·Evidence에 추가했다. 거버넌스 리포트가 아니라 문서 **본문**을 반환하는 유일 표면으로, `listWikiContentDocs`·`parseFrontmatter`·`collectWikiGraph`·`scanSensitiveInfo`를 재사용하는 leaf 모듈(commands.js가 배럴 re-export). `src/cli.js`(COMMANDS·parseArgs 플래그[`--status`/`--visibility`/`--doc-type`/`--include-sensitive`/`--limit`]·positional[search/get의 `<query>`/`<path>`]·COMMAND_OPTION_RULES·help/COMMAND_HELP), `src/index.js`(동결 commands 맵 4개 kebab 키 + Options typedef), `src/mcp/tools.js`(TOOL_DEFS 4개 + buildToolOptions 매핑), `src/mcp/dispatch.js`(instructions)에 배선했다. `search-docs`는 zero-dep 키워드/부분문자열(semantic 아님), restricted/민감 문서는 list/search 기본 제외(opt-in)·반환 본문/스니펫 redact, 쓰기 표면 없음. additive·zero-dep·1.0.0 계약 불변. 에이전트(Claude Code) 편집이라 `needs_review`로 강등 — 사람 검토 후 재승인 예정.
- 2026-07-21에 1.19 evidence 의미 단계화(Gate 25, accepted[Dowon-Kim 위임])를 반영했다: `scans.js`에 (1) `scanEvidenceReferences`의 `#symbol:`/`#section:` 타깃 실재 보수적 검사(`evidence.symbol_unverified`/`evidence.section_unverified`; 파일이 이름/헤딩을 전혀 언급 안 할 때만, `·`-결합 목록·`.md` 섹션만·`readTextAuto` BOM 인식), (2) grounding 없는 verified를 flag하는 `scanUngroundedVerified`(`evidence.ungrounded`, warning·`--strict` 미승격), (3) 순수 `evidenceTier`(+ `EVIDENCE_REFERENCE_RULES`)를 추가하고 `stats` JSON에 `evidenceTiers` additive 노출했다. `findings.js`에 3개 rule 등록, `commands.js` audit/validate 배선. 251 tests·validate --strict 0(청결 dogfood: 50/50 reference_checked, 14/50 human_verified). additive·read-only·zero-dep·1.0.0 계약·frontmatter/status 불변. 에이전트(Claude Code) 편집이라 `needs_review`로 강등 — 사람 검토 후 재승인 예정.
- 2026-07-21에 1.19 agent update runner(Gate 26, accepted[Dowon-Kim 위임, 야간 자율])를 반영했다: read-only `check-run` 명령(`src/commands.js#symbol:checkRunCommand`)이 `.llm-wiki/runs/`의 run manifest를 읽어 스킬 실행 파이프라인(changedSource↔touchedDocs 참조·로그 append·validate)을 검증한다. `findings.js`에 `run.*` 5개 rule 등록, `cli.js`/`index.js`에 `check-run`+`--run` 배선(command-set 단언 갱신), `skills.js#artifactBody`에 스킬 본문 완성 계약(매니페스트 작성→check-run) 내장. `impact`(diff-앵커)의 intent-앵커 보완, read-only(매니페스트는 에이전트가 작성), additive·zero-dep·1.0.0 계약 불변. 254 tests·validate --strict 0. 커밋된 dogfood 스킬 아티팩트는 미덮어씀 규율상 재생성 필요(`init --write --skills --existing overwrite`). 에이전트 편집이라 `needs_review` — 사람 검토 후 재승인 예정.
- 2026-07-22에 1.16.0→1.19 누적분(rename·reverse-impact·retrieval·Gate 25 evidence 단계화·Gate 26 check-run)을 사람 검토(reviewed_by: Dowon-Kim, reviewed_at: 2026-07-22)를 거쳐 `verified`로 재승인했다. 함께 커밋된 dogfood 스킬을 Gate 26 완성 계약이 담기도록 재생성했는데, `writeSkillArtifacts`는 `--existing overwrite`와 무관하게 기존 파일을 덮지 않으므로(그 플래그는 오히려 위키 문서를 덮으니 사용 금지) **기존 9개 삭제 후 `init --write --skills`**로 재생성하는 것이 올바른 방법이다(위 Gate 26 노트의 괄호 표기 정정).
- 2026-07-22에 frontend/mobile(SPA) 도메인 자동 탐지를 반영했다(외부 실사용 피드백 P1): `src/commands/domains.js`에 `detectFrontendDomains`(pages/views/features/modules/screens 폴더 + vue/react-router 라우트 그룹 정규식 파싱; 프론트 전용 제외 집합 `FRONTEND_EXCLUDE_NAMES`)를 추가하고 `buildDomainContext`를 유형별 게이팅(backend/fullstack→`detectDomainDirectories`, frontend/mobile→`detectFrontendDomains`, 나머지→empty)으로 리팩터했다. `detectFrontendDomains`는 `commands.js` 배럴에 노출하지 않고 내부 유지(테스트는 `src/commands/domains.js`에서 직접 import) — 다수 verified 문서가 참조하는 `commands.js`의 불필요한 evidence 드리프트를 피하려는 의도적 선택. 백엔드/풀스택 경로는 byte-identical(전용 스캐너 분리·별도 제외 집합). additive·zero-dep·정규식만·1.0.0 계약 불변, 미릴리스(main 한정). 262 tests(신규 3)·validate --strict 0. 에이전트(Claude Code) 편집이라 `needs_review`로 강등 — 사람 검토 후 재승인 예정.
- 2026-07-22에 재검증 정리 중 Module Layout 완결성 갭을 교정했다: 실제로 config 로딩을 구동하는 `src/config-file.js`(`loadProjectConfig`/`mergeConfigIntoOptions`, `src/cli.js`·`src/commands.js`가 함께 import)와 git 프리미티브 `src/git.js`(`changedFiles`/`isPathIgnored` 등; `impact`/drift/gitignore 탐지 구동)가 모듈 지도에서 누락돼 있어 두 모듈을 Module Layout에 추가하고 `src/git.js`를 source_files에 등재했다(config-file.js는 이미 등재). 서술 추가만 있고 기존 주장·계약·동작은 불변이며, 대조 검증 결과 기존 서술에 틀린 항목은 없었다(`defaultOptions`·index.js MCP export·모듈 목록 11개 모두 소스와 일치). 유지보수자(Dowon-Kim)가 재검증 정리 과정에서 이 보강을 지시·검토해 `verified`를 유지한다(reviewed_at: 2026-07-22). 269 tests·validate --strict 0.
