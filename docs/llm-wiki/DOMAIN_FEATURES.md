---
title: Domain Features
tags:
  - llm-wiki
  - verified
status: verified
doc_type: domain_overview
project: llm-wiki-standard
last_updated: 2026-07-21
author: cli-generated
last_edited_by: Claude Code
reviewed_by: Dowon-Kim
reviewed_at: 2026-07-21
wiki_block_version: v1
source_files:
  - src/commands.js
  - src/cli.js
  - src/detector.js
  - src/encoding.js
  - src/index.js
  - src/mcp/tools.js
  - src/release-notes.js
evidence:
  - src/commands/scans.js#symbol:scanEnrichment
  - src/commands/scans.js#symbol:scanRelatedReferences
  - src/commands/fix-migrate.js#symbol:fixCommand
  - src/commands/domains.js#symbol:planDomainDocs
  - src/detector.js#symbol:detectProject
  - src/index.js#symbol:commands
  - src/mcp/tools.js#symbol:TOOL_DEFS
  - src/release-notes.js#symbol:buildReleaseNotesBody
  - src/cli.js#symbol:applyProjectConfig
  - src/index.js#symbol:resolveOptions
  - src/commands.js#symbol:scaffoldProjectConfig
  - src/commands/findings.js#symbol:applyRuleConfig
  - src/commands/scans.js#symbol:scanThinBody
  - src/commands.js#symbol:findMissingDocs
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

# Domain Features

명령어군을 넘는, 사용자가 체감하는 기능 단위를 소스 근거와 연결합니다.

## Features

- **프로젝트 자동 감지** — `src/detector.js`가 Node(`package.json`)뿐 아니라 Python(`pyproject.toml`/`requirements.txt` 등)·Go(`go.mod`)·Rust(`Cargo.toml`)·JVM(`pom.xml`/`build.gradle`)·PHP(`composer.json`)·Ruby(`Gemfile`)·.NET(`*.csproj`/`*.fsproj`) 매니페스트 신호로 `frontend/backend/fullstack/library` 유형과 생태계·주 매니페스트(`primaryManifest`)를 추론한다. 1.12부터 `mobile` 유형도 감지한다(Android Gradle 플러그인/AndroidX/AndroidManifest.xml, Flutter `pubspec.yaml`, Apple/iOS Podfile·`*.xcodeproj`·Package.swift, React Native `react-native` 의존성). 1.13부터 `infra` 유형도 감지한다(Docker `Dockerfile`·Compose, Kubernetes(apiVersion+kind YAML), Helm `Chart.yaml`, Terraform `*.tf`) — 단 앱 신호가 없을 때만 선택되는 fallback이라 컨테이너화된 앱 레포는 앱 유형을 유지한다. 1.14부터 Go `net/http`·Python stdlib HTTP 서버를 소스에서 감지하면 해당 생태계를 `library`가 아닌 `backend`로 단방향 승격한다. 1.14.1부터 매니페스트/소스 읽기가 BOM 인식이라 UTF-16(LE/BE)·UTF-8 BOM으로 저장된 매니페스트(Windows에서 저장된 `requirements.txt` 등이 mojibake로 `library` 오분류되던 문제 교정)도 올바르게 디코드한다. `--type`로 명시 override 가능.
- **초기 문서 생성** — `init --write`가 core + profile 문서와 선택 adapter를 생성한다. backend/fullstack에서는 업무 도메인을 감지해 도메인별 문서(`domains/NN_<name>.md`, `doc_type: domain`, `source_files`=탐지 경로)를 만들고 `domains/00_overview.md`에서 상대링크로 연결한다. 두 컨벤션을 모두 잡는다: **디렉터리 도메인**(`domains/domain/modules/features`의 직속 하위 폴더)과 **파일 도메인**(`endpoints/routers/routes/resources/controllers/handlers`의 소스 파일, 예: FastAPI `app/api/api_v2/endpoints/hazard.py`). bounded 탐색·제외 가드로 오탐을 0에 가깝게(vendored/venv/test/dunder 제외, 집계자 파일명 제외). 1.14.4부터 가상환경·의존성 트리를 확실히 배제한다: `pyvenv.cfg`를 가진 디렉터리는 venv로 간주해 통째 스킵(이름 무관 — `venv3.10`·`.venv-py39` 등), `site-packages`/`dist-packages`와 버전형 `venv*`/`env<N>` 이름도 제외 — 그래서 설치된 라이브러리(passlib `handlers/`, boto3 `resources/`)가 도메인으로 오탐되지 않는다. 결정적 정렬·파일↔폴더 slug 병합. 기존 파일은 기본 보존, `log.md`는 append-only. 범위는 `GATE_REVIEW.md`(Gate 10).
- **frontmatter 계약 검증** — 필수 필드/status enum/날짜 형식/배열 형태를 검증하고, `verified`는 `--strict`에서 리뷰 메타를 요구한다.
- **근거 추적** — `source_files`(넓은 근거)와 `evidence`(파일/라인/심볼/섹션/라우트 정밀 근거)를 검증하고 본문 `## Evidence` 정렬을 확인한다. 1.14.2부터 `evidence`는 `파일#L10` 외에 콜론-라인 표기(`파일:10`·`파일:10-20`)도 동등하게 수용한다(에디터/grep 스타일 근거가 헛 `evidence.missing`을 내지 않음).
- **연결성 검증** — 로컬 markdown 링크, 위키 링크(이중 대괄호 표기), `related` 항목의 존재성을 검증한다(`related.missing`).
- **enrichment 신호** — placeholder만 남은 미보강 문서를 `content.not_enriched`로 표시해 "빈 스캐폴드가 통과"하는 것을 막는다.
- **지식 그래프** — `wikiGraph`가 문서→문서 엣지(wiki/related/markdown 링크)·미해결 개념·별칭·고아 문서를 집계한다. `llm-wiki graph`가 이를 text/JSON/Mermaid/DOT로 내보내고, `llm-wiki stats`가 헬스 스코어(verified%/enrichment%/evidence coverage/staleness)를 보고한다. `--format html` 대시보드에는 탐색용 Document Index가 있다.
- **에이전트 인수인계** — `handoff`/`prompt`가 코드 근거로 문서를 보강하도록 유도하는 반복 프롬프트를 출력한다. 1.14.1부터 `handoff` 진입점은 명시적으로 선택된 에이전트의 어댑터 파일만 나열하고, 미선택 시 `docs/llm-wiki/index.md`만 가리켜 setup이 생성하지 않은 `AGENTS.md`/`CLAUDE.md`를 먼저 읽으라고 하지 않는다. 같은 1.14.1에서 `Next Step`이 "이 프롬프트는 CLI가 실행하는 게 아니라 코딩 에이전트(Claude Code/Codex)에 붙여넣는 지시문"임을 3단계(붙여넣기→코드 근거 보강→사람 검토·verified)로 설명하도록 명료화했다.
- **스킬 생성(자동화 프롬프트)** — 1.15부터 `init`/`quickstart`이 `feature`/`fix`/`docs-sync` 위키-그라운디드 워크플로를 각 에이전트 네이티브 형식의 **호출 가능한 아티팩트**로 생성한다: Claude 스킬(`.claude/skills/llm-wiki-<task>/SKILL.md`, `/llm-wiki-feature`로 호출)·Cursor 룰(`.cursor/rules/llm-wiki-<task>.mdc`)·에이전트-중립 프롬프트(`.llm-wiki/prompts/llm-wiki-<task>.md`, Codex 등). 각 본문은 `src/task-prompts.js` 워크플로를 재사용하고 프로젝트 **도메인 맵**(`docs/llm-wiki/domains/` 스냅샷)을 주입해 에이전트가 어떤 문서를 먼저 읽을지 즉시 알게 한다. `--skills` 또는 `--agent claude|cursor`로 opt-in, preview-first, 기존 파일 미덮어씀, **recognize-don't-run**(도구는 생성만, 실행은 에이전트), needs_review 규율 본문 내장. 생성한 위키가 실제 기능 작업에 쓰이도록 하는 진입점이다. **재시작 요건**: Claude Code는 스킬을 세션 시작 시점에 로드(hot-reload 아님)하므로, 갓 생성한 스킬은 에이전트를 재시작해야 `/llm-wiki-*`로 나타난다 — 이 때문에 생성 직후 명령이 "unknown"으로 보일 수 있어, `init`/`quickstart` 출력이 스킬을 실제로 만들었을 때만 재시작 안내 한 줄을 표시한다. 근거: `src/commands/skills.js#symbol:writeSkillArtifacts`(생성), `src/commands.js#symbol:quickstartInitSummary`(재시작 안내), 범위는 `GATE_REVIEW.md`(Gate 21, accepted).
- **범위 한정 자동수정(`fix`)** — `fix`가 승인된 좁은 범위의 안전한 수정만 적용한다: 누락 Tier A frontmatter 필드 삽입, frontmatter `evidence` 기준 본문 `## Evidence` 섹션 보완, 깨진 related/markdown 링크에 대한 `needs_review` 스텁 생성, 수정 문서의 `last_updated` 갱신. 기본은 미리보기이고 `--write` 시에만 쓴다. `verified` 문서 내용·`docs/llm-wiki/` 밖 파일·`source_files`/`evidence` 값·Tier B 필드(title/doc_type/project/author)·미보강 내용은 건드리지 않는다. 근거: `src/commands/fix-migrate.js#symbol:fixCommand`, 범위 결정은 `GATE_REVIEW.md`.
- **OKF v0.1 호환** — `--profile okf-v0.1`로 `type`/`aliases`/`tags`와 wiki 링크를 검증한다. 코어 검증도 OKF `type`를 필수 `doc_type`의 부가적 alias로 수용한다(1.3).
- **프로그래매틱 API** — CLI를 spawn하지 않고 패키지를 import해 명령을 in-process로 실행한다. `package.json` `exports`(`src/index.js`)가 동결된 `commands` 맵(CLI 표면과 1:1)·개별 함수 export·`normalizeOptions`(옵션 정규화)·`parseArgs`/`run`·`SCHEMA_VERSION`을 공개한다. `--format json` 출력에는 계약 pin용 `schemaVersion` 부가 필드가 붙는다(단일 소스 `src/config.js#JSON_SCHEMA_VERSION`, 기존 필드 불변). 근거: `src/index.js#symbol:commands`, 계약은 `docs/llm-wiki/PUBLIC_API.md`(Programmatic API).
- **에이전트 네이티브(MCP 서버)** — `llm-wiki mcp`가 stdio 위에서 Model Context Protocol 서버를 띄워, 읽기 전용 명령(validate/audit/next/status/doctor/stats/graph/explain/handoff/prompt)을 MCP 툴로 노출한다. 에이전트(Claude Code·Cursor 등)가 shell out 대신 툴로 위키를 질의·점검한다. 각 툴은 명령 결과를 `structuredContent`(1.5 `schemaVersion` 포함)로, 사람용 요약을 텍스트 콘텐츠로 반환한다. 서드파티 SDK 없이 Node 내장만으로 개행 구분 JSON-RPC 2.0을 직접 구현(무의존성 불변식 유지). **쓰기 명령은 노출하지 않는다**(읽기 전용). 근거: `src/mcp/tools.js#symbol:TOOL_DEFS`, 범위 결정은 `GATE_REVIEW.md`(Gate 11).
- **CI/CD 도입(1.7)** — `release-notes --body-only`가 변경 섹션 본문만 안전 추출(frontmatter/H1/스캐폴드 라인 제외)하고 본문 민감정보 스캔에 매치 시 차단(exit 2)해 GitHub Release 본문으로 쓴다. `.github/actions/validate/action.yml` 컴포지트 GitHub Action이 읽기 전용 `validate`를 `npx`로 감싸며 다른 액션을 끌어오지 않아 무의존성을 유지한다. `v*` 태그 push 시 `publish.yml`의 격리된 `contents: write` 잡이 러너 `gh` CLI로 GitHub Release를 만든다(본문은 `release-notes --body-only`). 근거: `src/release-notes.js#symbol:buildReleaseNotesBody`, 범위 결정은 `GATE_REVIEW.md`(Gate 12).
- **프로젝트 설정 일관화(config, 1.7.2 enabling-prep)** — `llm-wiki.config.json` 병합이 CLI뿐 아니라 프로그래매틱 API·MCP 세 표면에서 동일하게 동작한다(공유 `applyProjectConfig`; API는 config 인식 async `resolveOptions` 추가; MCP는 `tools/call`마다 대상 프로젝트 config를 병합, malformed는 `isError`). `init`/`quickstart --write`가 최소 starter config를 scaffold하고(감지 type·선택 agents 반영·기존 파일 미덮어씀·preview-first) `doctor`가 effective config를 echo해, Gate 13(1.8 config schema growth)의 "실사용" 전제를 관측 가능하게 만든다. additive·opt-in, 1.0.0 계약·zero-dep 불변. 근거: `src/cli.js#symbol:applyProjectConfig`·`src/index.js#symbol:resolveOptions`, 범위는 `GATE_REVIEW.md`(Gate 13).
- **config rule 토글(1.8)** — `llm-wiki.config.json`의 `rules` 맵으로 프로젝트가 개별 finding rule을 끄거나(`off`) severity를 재정의한다(`{ "rule.id": "off"|"blocked"|"error"|"warning"|"info" }`). `audit`/`status`/`validate-frontmatter`에 중앙(`applyRuleConfig`) 적용되고 세 표면(CLI/API/MCP) 모두 반영된다. 레지스트리 rule만 대상이며 **`sensitive.*`(민감정보)는 안전상 절대 토글 불가**. opt-in lint `content.thin_body`(기본 off, `rules`로 켬)가 얇은 본문 문서를 표시해 토글 기계를 dogfood한다. 근거: `src/commands/findings.js#symbol:applyRuleConfig`, 범위는 `GATE_REVIEW.md`(Gate 13, accepted).
- **커스텀 문서셋·템플릿 오버라이드(1.8)** — config `requiredDocs`로 프로젝트 자체 필수 문서를 core/profile 목록에 추가하고(같은 `structure.required_doc` 검사; 검증 전용), `templates`로 생성 문서를 프로젝트-로컬 템플릿에서 만든다. 템플릿 오버라이드는 **body만** 쓰고 frontmatter는 항상 CLI 생성이라 `status: verified`를 절대 만들 수 없다(구조적 가드레일). 이로써 Gate 13 config 3피처(rule 토글·커스텀 문서셋·템플릿 오버라이드)가 완성된다. 근거: `src/commands.js#symbol:renderOverriddenDoc`.
- **visibility governance(1.9)** — 이미 필수인 `visibility` 필드에 대한 opt-in 일관성 린트 2개(sensitive-info 스캔 재사용): `visibility.public_sensitive`(`visibility: public` 문서에 민감값), `visibility.declared_mismatch`(`contains_sensitive_info: false`인데 민감값). 둘 다 기본 off·warning·read-only, config `rules`로 활성화(1.8 토글 재사용), 절대 default error/blocked 금지, **민감값은 finding에 미노출**(redacted count만). 접근 통제 아님(값-내용 일관성만). 정책은 `docs/llm-wiki/VISIBILITY.md`. 근거: `src/commands/scans.js#symbol:scanVisibilityConsistency`, 범위는 `GATE_REVIEW.md`(Gate 14, accepted).
- **monorepo profile(1.10)** — `llm-wiki monorepo`가 npm/yarn `workspaces`를 감지해 `docs/llm-wiki`가 있는 각 패키지를 validate하고 집계한다(strictly additive `packages[]` roll-up + 패키지 경로 prefix된 findings). 각 패키지는 자기 `llm-wiki.config.json`을 반영하고, 새 필드는 이 명령에만 나타나 단일 레포 출력은 byte-identical. pnpm/YAML은 zero-dep 위해 미파싱(unsupported 보고). read-only 집계. 근거: `src/commands.js#symbol:monorepoCommand`·`src/detector.js#symbol:detectWorkspaces`, 범위는 `GATE_REVIEW.md`(Gate 15, accepted).
- **cross-repo knowledge links(1.11)** — 예약 cross-repo 참조 스킴 `repo:<name>/<path>`(+ 기존 http(s))를 wiki 링크·`source_files`/`evidence`/`related`에서 external로 인식한다. 인식된 참조는 missing-target 규칙(`wiki_link.missing`/`related.missing`/`source_files.missing`/`evidence.missing`/`markdown_link.missing`)에서 제외되지만 **절대 fetch/verify하지 않는다**(network/git 없음, zero-dep). URL 형태 wiki 링크의 false `wiki_link.missing`도 해소. additive: 로컬 해석 불변(진짜 미해결 로컬 링크는 여전히 flag). 근거: `src/commands/references.js#symbol:isCrossRepoReference`, 범위는 `GATE_REVIEW.md`(Gate 16, accepted).
- **mobile profile(1.12)** — 부가적 `mobile` 프로젝트 유형. `detectMobile`이 Android(`build.gradle`(.kts)/`settings.gradle`의 Android Gradle 플러그인·AndroidX, 또는 중첩 `AndroidManifest.xml`)·Flutter(`pubspec.yaml`의 flutter 섹션/`sdk: flutter`)·Apple/iOS(Podfile·`*.xcodeproj`/`*.xcworkspace`·Apple-플랫폼 `Package.swift`)·React Native(`package.json`의 `react-native` 의존성)를 감지하고, `decideType`에서 최우선 순위를 가진다. 이로써 지금까지 `jvm`+`library`로 잘못 분류되던 Android `build.gradle`이 교정된다. `init`이 mobile 문서셋(`profiles/mobile.md`·`PLATFORM_MATRIX.md`·`SCREENS.md`·`BUILD_RELEASE.md`)을 생성한다. **빌드 도구(Gradle/Xcode/CocoaPods) 미호출·의존성 그래프 미파싱**(recognize-don't-build, zero-dep), bounded·exclusion-guarded 스캔(Gate 10 규율). additive: `--type`에 `mobile` 추가, 신호 없는 레포는 byte-identical(plain JVM/Dart 미재분류). 근거: `src/detector.js#symbol:detectMobile`, 범위는 `GATE_REVIEW.md`(Gate 17, accepted).
- **infra/DevOps profile(1.13)** — 부가적 `infra` 프로젝트 유형. `detectInfra`가 Docker(`Dockerfile`)·Compose(`docker-compose.y*ml`/`compose.y*ml`)·Kubernetes(`apiVersion`+`kind` YAML, top-level/k8s·kubernetes·manifests 등)·Helm(`Chart.yaml`)·Terraform(`*.tf`)를 감지한다. **`infra`는 fallback** — `decideType`에서 앱 신호(frontend/backend/library/mobile)가 없을 때만 선택되므로, `Dockerfile`을 가진 백엔드 레포는 여전히 `backend`로 남고 기존 출력은 byte-identical(infra 신호는 `infra`로 확정될 때만 표면화). `init`이 infra 문서셋(`profiles/infra.md`·`DEPLOYMENT.md`·`RUNBOOK.md`·`SERVICE_TOPOLOGY.md`)을 생성한다. **클러스터/레지스트리 접근 없음·배포 없음**(recognize-don't-deploy, zero-dep), bounded 스캔. 근거: `src/detector.js#symbol:detectInfra`, 범위는 `GATE_REVIEW.md`(Gate 18, accepted).
- **stdlib-server 감지(1.14)** — 프레임워크 없이 표준 라이브러리만 쓰는 서버를 소스에서 감지해 role을 교정한다: Go `net/http`(비-test `.go`가 `net/http` import + `ListenAndServe`/`http.Serve` 호출)와 Python stdlib HTTP(`.py`가 `http.server`/`socketserver` import + `serve_forever`/`HTTPServer(...)`)를 만나면 해당 생태계를 `library`→`backend`로 승격한다. **단방향·보수적** — 강한 import+시작-호출 쌍에만 반응하고, `http.client`만 쓰는 라이브러리는 `library`로 남으며, 기존 `backend`를 강등하지 않는다. bounded·exclusion-guarded 소스 스캔(vendored/test/example 제외, maxFiles 캡), zero-dep. 근거: `src/detector.js#symbol:detectGoStdlibServer`, 범위는 `GATE_REVIEW.md`(Gate 19, accepted).

## Evidence

- `src/commands/scans.js#symbol:scanEnrichment` — enrichment 미완성 감지.
- `src/commands/scans.js#symbol:scanRelatedReferences` — related 존재성 검증.
- `src/commands/fix-migrate.js#symbol:fixCommand` — 범위 한정 자동수정.
- `src/commands/domains.js#symbol:planDomainDocs` — backend/fullstack 도메인 문서 계획(정렬·병합·순번).
- `src/detector.js#symbol:detectProject` — 프로젝트 유형 추론.
- `src/index.js#symbol:commands` — 프로그래매틱 API의 동결된 명령 맵(CLI 표면과 1:1).
- `src/mcp/tools.js#symbol:TOOL_DEFS` — MCP로 노출하는 읽기 전용 툴 정의(commands 위 얇은 래퍼).
- `src/release-notes.js#symbol:buildReleaseNotesBody` — `release-notes --body-only`의 변경 섹션 본문 추출(GitHub Release 본문 + 민감정보 차단).
- `src/cli.js#symbol:applyProjectConfig` — CLI/API/MCP 공유 config 로드·병합 seam(1.7.2).
- `src/index.js#symbol:resolveOptions` — config 인식 옵션 해석(프로그래매틱 API·MCP 사용).
- `src/commands.js#symbol:scaffoldProjectConfig` — init/quickstart starter config scaffold(미덮어씀).
- `src/commands/findings.js#symbol:applyRuleConfig` — config `rules` 토글을 findings에 중앙 적용(1.8; `sensitive.*` 비토글).
- `src/commands/scans.js#symbol:scanThinBody` — opt-in `content.thin_body` lint(1.8; 기본 off).
- `src/commands.js#symbol:findMissingDocs` — config `requiredDocs`(커스텀 문서셋)를 필수 목록에 병합(1.8).
- `src/commands.js#symbol:renderOverriddenDoc` — config `templates` 오버라이드(body-only, `verified` 불가 가드레일)(1.8).
- `src/commands/scans.js#symbol:scanVisibilityConsistency` — opt-in visibility 일관성 린트(public_sensitive·declared_mismatch; sensitive 스캔 재사용, 값 미노출)(1.9).
- `src/commands.js#symbol:monorepoCommand` — monorepo profile: 패키지별 validate 집계(additive `packages[]`)(1.10).
- `src/detector.js#symbol:detectWorkspaces` — npm/yarn workspaces 감지(pnpm/YAML unsupported)(1.10).
- `src/detector.js#symbol:detectMobile` — Android/Flutter/iOS/React Native 신호로 `mobile` 유형 감지(recognize-don't-build, zero-dep); Android `build.gradle` library 오분류 교정(1.12).
- `src/detector.js#symbol:detectInfra` — Docker/Compose/Kubernetes/Helm/Terraform 신호로 `infra` 유형 감지(fallback, recognize-don't-deploy, zero-dep; 앱 레포 byte-identical)(1.13).
- `src/detector.js#symbol:detectGoStdlibServer`·`detectPythonStdlibServer` — Go `net/http`·Python stdlib HTTP 서버 소스 감지 → role `library`→`backend` 단방향 승격(bounded 스캔, 클라이언트-only 미승격)(1.14).
- `src/commands/references.js#symbol:isCrossRepoReference` — 예약 cross-repo 참조 스킴 인식(recognize-don't-verify)(1.11).
- `src/encoding.js#symbol:readTextAuto` — detector 매니페스트/소스 읽기용 BOM 인식 리더(UTF-16/UTF-8-BOM 디코드, BOM 없는 파일 byte-identical); 위키 문서 `readUtf8`는 불변(1.14.1).
- `src/commands.js#symbol:buildHandoff` — handoff 진입점을 명시적 선택 에이전트의 어댑터 파일로만 한정(1.14.1).
- `src/commands/skills.js#symbol:writeSkillArtifacts` — feature/fix/docs-sync 위키-그라운디드 자동화 프롬프트를 Claude 스킬/Cursor 룰/중립 프롬프트로 생성(도메인 맵 주입, opt-in, recognize-don't-run, 미덮어씀)(1.15).

## Open Questions

- 각 기능의 실제 채택 사례를 수집해 다음 로드맵 우선순위(config 스키마, `fix` 자동수정 범위 확대)에 반영해야 한다.
- `fix` 초기 범위 밖 항목(Tier B 필드 유도, 경로 자동 복구, `verified`→`needs_review` 자동 강등)은 실사용 피드백 후 별도 게이트로 검토한다.

## Review Notes

- 2026-07-14에 1.3.0 기능(PHP/Ruby/.NET 감지 · backend/fullstack 도메인 문서 분리 생성 · OKF `type` alias)을 반영해 갱신하고 사람 검토(reviewed_by: Dowon-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-14에 1.4.0 기능(파일 기반 도메인 감지[Gate 10] · `graph`/`stats` 명령 · 대시보드 Document Index)을 반영해 갱신하고 사람 검토(reviewed_by: Dowon-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-14에 1.5 프로그래매틱 API(`exports`/`commands` 맵 · `normalizeOptions` · `--format json`의 `schemaVersion`)를 기능으로 추가하고, 사람 검토(reviewed_by: Dowon-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-14에 1.6 에이전트 네이티브(MCP 서버 `llm-wiki mcp`, 읽기 전용 툴 10개)를 기능으로 추가했다. 사람 검토(reviewed_by: Dowon-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-15에 1.7 CI/CD 도입(`release-notes --body-only` + 본문 민감정보 차단, 컴포지트 validate GitHub Action, 태그 트리거 GitHub Release 잡)을 기능으로 추가했다(Gate 12). 사람 검토(reviewed_by: Dowon-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-15에 1.7.2 enabling-prep(config 로딩을 CLI/API/MCP로 일원화 + `resolveOptions`, init/quickstart starter config scaffold, doctor effective-config echo)를 "프로젝트 설정 일관화" 기능으로 추가했다(Gate 13). 사람 검토(reviewed_by: Dowon-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-15에 1.8.0 config schema growth(Gate 13, accepted)를 반영했다: config `rules` 맵의 per-project rule 토글(중앙 `applyRuleConfig`; `sensitive.*` 비토글)과 opt-in lint `content.thin_body`(기본 off)를 기능으로 추가했다. 사람 검토(reviewed_by: Dowon-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-15에 1.8.1 config schema growth 2부(Gate 13 완성)를 반영했다: 커스텀 문서셋(config `requiredDocs`)과 템플릿 오버라이드(config `templates`, body-only 가드레일)를 기능으로 추가했다. 사람 검토(reviewed_by: Dowon-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-15에 1.9.0 visibility governance(Gate 14, accepted)를 반영했다: opt-in 일관성 린트 2개(`visibility.public_sensitive`·`visibility.declared_mismatch`, sensitive-info 스캔 재사용, 기본 off·warning·read-only, 값 미노출)를 기능으로 추가했다. 사람 검토(reviewed_by: Dowon-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-15에 1.10.0 monorepo profile(Gate 15, accepted)을 반영했다: opt-in `monorepo` 명령(npm/yarn workspaces 감지 후 패키지별 validate 집계, additive `packages[]`, 단일 레포 byte-identical, 패키지별 config, pnpm/YAML unsupported)을 기능으로 추가했다. 사람 검토(reviewed_by: Dowon-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-15에 1.11.0 cross-repo knowledge links(Gate 16, accepted)를 반영했다: 예약 cross-repo 참조 스킴(`repo:<name>/<path>`+http(s))을 external로 인식해 missing-target 규칙에서 제외하되 fetch/verify하지 않는 기능을 추가했다. 사람 검토(reviewed_by: Dowon-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-16에 1.11.1 commands.js 모듈 분리(동작 보존 내부 리팩터)를 반영했다: 기능은 불변이며, Evidence와 근거 심볼 포인터를 이동한 모듈로 갱신했다(`scanEnrichment`/`scanRelatedReferences`/`scanThinBody`/`scanVisibilityConsistency`→scans, `applyRuleConfig`→findings, `fixCommand`→fix-migrate, `planDomainDocs`→domains, `isCrossRepoReference`→references). 코드에 맞춰 문서를 수정한 뒤 사람 검토(reviewed_by: Dowon-Kim, reviewed_at: 2026-07-16)를 거쳐 `verified`로 재승인했다.
- 2026-07-16에 1.12.0 mobile profile(Gate 17, accepted)을 반영했다: 부가적 `mobile` 유형(`detectMobile`의 Android/Flutter/iOS/React Native 감지 + Android `build.gradle` 오분류 교정 + mobile 문서셋)을 기능·Evidence로 추가했다. 코드에 맞춰 문서를 수정한 뒤 사람 검토(reviewed_by: Dowon-Kim, reviewed_at: 2026-07-16)를 거쳐 `verified`로 재승인했다.
- 2026-07-16에 1.13.0 infra/DevOps profile(Gate 18, accepted)을 반영했다: 부가적 `infra` 유형(`detectInfra`의 Docker/Compose/Kubernetes/Helm/Terraform 감지 + fallback 우선순위 + infra 문서셋)을 기능·Evidence로 추가했다. 코드에 맞춰 문서를 수정한 뒤 사람 검토(reviewed_by: Dowon-Kim, reviewed_at: 2026-07-16)를 거쳐 `verified`로 재승인했다.
- 2026-07-16에 1.14.0 stdlib-server detection(Gate 19, accepted)을 반영했다: Go `net/http`·Python stdlib HTTP 서버 소스 감지로 role을 `library`→`backend` 단방향 승격하는 기능(`detectGoStdlibServer`/`detectPythonStdlibServer`)을 기능·Evidence로 추가했다. 코드에 맞춰 문서를 수정한 뒤 사람 검토(reviewed_by: Dowon-Kim, reviewed_at: 2026-07-16)를 거쳐 `verified`로 재승인했다.
- 2026-07-20에 1.14.1 노출-테스트 fix 배치를 반영했다: (A) 매니페스트/소스 읽기의 BOM 인식(`readTextAuto`; UTF-16/UTF-8-BOM 매니페스트 오분류 교정)을 "프로젝트 자동 감지" 기능과 Evidence에, (B) `handoff` 진입점을 명시적 선택 에이전트의 어댑터 파일로만 한정하는 변경을 "에이전트 인수인계" 기능과 Evidence에 추가했다. (C) 모드 플래그 없는 `init`/`quickstart`이 `Blocked` 대신 `Ready (needs --write)`(exit 0)로 안내하도록 한 변경도 함께 반영했다. (D) BE 개발자 추가 보고서를 반영해 handoff `Next Step`을 워크플로 3단계로 명료화(프롬프트는 에이전트에 붙여넣는 지시문)하고 `quickstart` 출력에 skip 사유 주석·브라운필드 안내를 추가한 것을 "에이전트 인수인계" 기능에 함께 반영했다. 코드에 맞춰 문서를 수정한 뒤 사람 검토(reviewed_by: Dowon-Kim, reviewed_at: 2026-07-20)를 거쳐 `verified`로 재승인했다.
- 2026-07-20에 1.14.2 사용성 다듬기(첫 외부 end-to-end 성공 후속)를 반영했다: (1) `evidence` 콜론-라인 표기(`파일:10`·`파일:10-20`) 수용을 "근거 추적" 기능에 기술했다. (2) 생성 `templates/*`를 orphan 보고에서 제외, (3) gitignore된 위키 출력 경고(`structure.output_gitignored`; init/quickstart·doctor), (4) `init --write` 안심 요약 라인 — 이 3건은 출력 명료화라 기능 목록은 불변으로 두고 이 노트로 갈음한다. 코드에 맞춰 문서를 수정한 뒤 사람 검토(reviewed_by: Dowon-Kim, reviewed_at: 2026-07-20)를 거쳐 `verified`로 재승인했다.
- 2026-07-20에 1.14.3 온보딩 오리엔테이션(두 번째 노출 보고서)을 반영했다: `llm-wiki`/`--help`에 이중언어(KO+EN) "무엇/왜/3단계 흐름" 헤더 + 버전·`@latest` 팁, `quickstart` 출력의 `About · 소개` 라인을 추가했다(사용자-대면 텍스트 이중언어화; finding ID는 영문 유지). 프레젠테이션 변경이라 기능 목록은 불변으로 두고 이 노트로 갈음한다. 사람 검토(reviewed_by: Dowon-Kim, reviewed_at: 2026-07-20)를 거쳐 `verified`로 재승인했다.
- 2026-07-20에 1.14.4 도메인 감지 수정을 반영했다: virtualenv/site-packages를 도메인 스캔에서 확실히 배제(`pyvenv.cfg` 마커 디렉터리 통째 스킵 + `site-packages`/`dist-packages` + 버전형 `venv*`/`env<N>` 이름)한 것을 "초기 문서 생성" 기능에 기술했다 — 설치 의존성(passlib `handlers/`, boto3 `resources/`)이 도메인으로 오탐되어 빈 문서를 대량 생성하던 버그 교정. 사람 검토(reviewed_by: Dowon-Kim, reviewed_at: 2026-07-20)를 거쳐 `verified`로 재승인했다.
- 2026-07-20에 1.15.0 스킬 생성(Gate 21, accepted)을 반영했다: `init`/`quickstart`이 feature/fix/docs-sync 위키-그라운디드 자동화 프롬프트를 Claude 스킬·Cursor 룰·중립 프롬프트로 생성하고 도메인 맵을 주입하는 \"스킬 생성\" 기능과 Evidence(`writeSkillArtifacts`)를 추가했다. 코드에 맞춰 문서를 수정한 뒤 사람 검토(reviewed_by: Dowon-Kim, reviewed_at: 2026-07-20)를 거쳐 `verified`로 재승인했다.
- 2026-07-21에 `/llm-wiki-feature` 스킬(에이전트 실행)로 "스킬 생성 후 재시작 요건 안내" 기능 작업을 하며 이 "스킬 생성" 설명을 갱신했다(재시작 요건 추가). 에이전트가 편집한 직후엔 `status`를 `needs_review`로 강등했으나(에이전트는 verified 승격 불가), 이후 사람 검토(reviewed_by: Dowon-Kim, reviewed_at: 2026-07-21)를 거쳐 `verified`로 재승인했다 — 이 재검토·재승인은 1.15.1 릴리스의 일부다.
