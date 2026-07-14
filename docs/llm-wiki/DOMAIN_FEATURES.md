---
title: Domain Features
tags:
  - llm-wiki
  - verified
status: verified
doc_type: domain_overview
project: llm-wiki-standard
last_updated: 2026-07-15
author: cli-generated
last_edited_by: Claude Code
reviewed_by: WoongHwan-Kim
reviewed_at: 2026-07-15
wiki_block_version: v1
source_files:
  - src/commands.js
  - src/detector.js
  - src/index.js
  - src/mcp/tools.js
evidence:
  - src/commands.js#symbol:scanEnrichment
  - src/commands.js#symbol:scanRelatedReferences
  - src/commands.js#symbol:fixCommand
  - src/commands.js#symbol:planDomainDocs
  - src/detector.js#symbol:detectProject
  - src/index.js#symbol:commands
  - src/mcp/tools.js#symbol:TOOL_DEFS
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

- **프로젝트 자동 감지** — `src/detector.js`가 Node(`package.json`)뿐 아니라 Python(`pyproject.toml`/`requirements.txt` 등)·Go(`go.mod`)·Rust(`Cargo.toml`)·JVM(`pom.xml`/`build.gradle`)·PHP(`composer.json`)·Ruby(`Gemfile`)·.NET(`*.csproj`/`*.fsproj`) 매니페스트 신호로 `frontend/backend/fullstack/library` 유형과 생태계·주 매니페스트(`primaryManifest`)를 추론한다. `--type`로 명시 override 가능.
- **초기 문서 생성** — `init --write`가 core + profile 문서와 선택 adapter를 생성한다. backend/fullstack에서는 업무 도메인을 감지해 도메인별 문서(`domains/NN_<name>.md`, `doc_type: domain`, `source_files`=탐지 경로)를 만들고 `domains/00_overview.md`에서 상대링크로 연결한다. 두 컨벤션을 모두 잡는다: **디렉터리 도메인**(`domains/domain/modules/features`의 직속 하위 폴더)과 **파일 도메인**(`endpoints/routers/routes/resources/controllers/handlers`의 소스 파일, 예: FastAPI `app/api/api_v2/endpoints/hazard.py`). bounded 탐색·제외 가드로 오탐을 0에 가깝게(vendored/venv/test/dunder 제외, 집계자 파일명 제외). 결정적 정렬·파일↔폴더 slug 병합. 기존 파일은 기본 보존, `log.md`는 append-only. 범위는 `GATE_REVIEW.md`(Gate 10).
- **frontmatter 계약 검증** — 필수 필드/status enum/날짜 형식/배열 형태를 검증하고, `verified`는 `--strict`에서 리뷰 메타를 요구한다.
- **근거 추적** — `source_files`(넓은 근거)와 `evidence`(파일/라인/심볼/섹션/라우트 정밀 근거)를 검증하고 본문 `## Evidence` 정렬을 확인한다.
- **연결성 검증** — 로컬 markdown 링크, 위키 링크(이중 대괄호 표기), `related` 항목의 존재성을 검증한다(`related.missing`).
- **enrichment 신호** — placeholder만 남은 미보강 문서를 `content.not_enriched`로 표시해 "빈 스캐폴드가 통과"하는 것을 막는다.
- **지식 그래프** — `wikiGraph`가 문서→문서 엣지(wiki/related/markdown 링크)·미해결 개념·별칭·고아 문서를 집계한다. `llm-wiki graph`가 이를 text/JSON/Mermaid/DOT로 내보내고, `llm-wiki stats`가 헬스 스코어(verified%/enrichment%/evidence coverage/staleness)를 보고한다. `--format html` 대시보드에는 탐색용 Document Index가 있다.
- **에이전트 인수인계** — `handoff`/`prompt`가 코드 근거로 문서를 보강하도록 유도하는 반복 프롬프트를 출력한다.
- **범위 한정 자동수정(`fix`)** — `fix`가 승인된 좁은 범위의 안전한 수정만 적용한다: 누락 Tier A frontmatter 필드 삽입, frontmatter `evidence` 기준 본문 `## Evidence` 섹션 보완, 깨진 related/markdown 링크에 대한 `needs_review` 스텁 생성, 수정 문서의 `last_updated` 갱신. 기본은 미리보기이고 `--write` 시에만 쓴다. `verified` 문서 내용·`docs/llm-wiki/` 밖 파일·`source_files`/`evidence` 값·Tier B 필드(title/doc_type/project/author)·미보강 내용은 건드리지 않는다. 근거: `src/commands.js#symbol:fixCommand`, 범위 결정은 `GATE_REVIEW.md`.
- **OKF v0.1 호환** — `--profile okf-v0.1`로 `type`/`aliases`/`tags`와 wiki 링크를 검증한다. 코어 검증도 OKF `type`를 필수 `doc_type`의 부가적 alias로 수용한다(1.3).
- **프로그래매틱 API** — CLI를 spawn하지 않고 패키지를 import해 명령을 in-process로 실행한다. `package.json` `exports`(`src/index.js`)가 동결된 `commands` 맵(CLI 표면과 1:1)·개별 함수 export·`normalizeOptions`(옵션 정규화)·`parseArgs`/`run`·`SCHEMA_VERSION`을 공개한다. `--format json` 출력에는 계약 pin용 `schemaVersion` 부가 필드가 붙는다(단일 소스 `src/config.js#JSON_SCHEMA_VERSION`, 기존 필드 불변). 근거: `src/index.js#symbol:commands`, 계약은 `docs/llm-wiki/PUBLIC_API.md`(Programmatic API).
- **에이전트 네이티브(MCP 서버)** — `llm-wiki mcp`가 stdio 위에서 Model Context Protocol 서버를 띄워, 읽기 전용 명령(validate/audit/next/status/doctor/stats/graph/explain/handoff/prompt)을 MCP 툴로 노출한다. 에이전트(Claude Code·Cursor 등)가 shell out 대신 툴로 위키를 질의·점검한다. 각 툴은 명령 결과를 `structuredContent`(1.5 `schemaVersion` 포함)로, 사람용 요약을 텍스트 콘텐츠로 반환한다. 서드파티 SDK 없이 Node 내장만으로 개행 구분 JSON-RPC 2.0을 직접 구현(무의존성 불변식 유지). **쓰기 명령은 노출하지 않는다**(읽기 전용). 근거: `src/mcp/tools.js#symbol:TOOL_DEFS`, 범위 결정은 `GATE_REVIEW.md`(Gate 11).

## Evidence

- `src/commands.js#symbol:scanEnrichment` — enrichment 미완성 감지.
- `src/commands.js#symbol:scanRelatedReferences` — related 존재성 검증.
- `src/commands.js#symbol:fixCommand` — 범위 한정 자동수정.
- `src/commands.js#symbol:planDomainDocs` — backend/fullstack 도메인 문서 계획(정렬·병합·순번).
- `src/detector.js#symbol:detectProject` — 프로젝트 유형 추론.
- `src/index.js#symbol:commands` — 프로그래매틱 API의 동결된 명령 맵(CLI 표면과 1:1).
- `src/mcp/tools.js#symbol:TOOL_DEFS` — MCP로 노출하는 읽기 전용 툴 정의(commands 위 얇은 래퍼).

## Open Questions

- 각 기능의 실제 채택 사례를 수집해 다음 로드맵 우선순위(config 스키마, `fix` 자동수정 범위 확대)에 반영해야 한다.
- `fix` 초기 범위 밖 항목(Tier B 필드 유도, 경로 자동 복구, `verified`→`needs_review` 자동 강등)은 실사용 피드백 후 별도 게이트로 검토한다.

## Review Notes

- 2026-07-14에 1.3.0 기능(PHP/Ruby/.NET 감지 · backend/fullstack 도메인 문서 분리 생성 · OKF `type` alias)을 반영해 갱신하고 사람 검토(reviewed_by: WoongHwan-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-14에 1.4.0 기능(파일 기반 도메인 감지[Gate 10] · `graph`/`stats` 명령 · 대시보드 Document Index)을 반영해 갱신하고 사람 검토(reviewed_by: WoongHwan-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-14에 1.5 프로그래매틱 API(`exports`/`commands` 맵 · `normalizeOptions` · `--format json`의 `schemaVersion`)를 기능으로 추가하고, 사람 검토(reviewed_by: WoongHwan-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-14에 1.6 에이전트 네이티브(MCP 서버 `llm-wiki mcp`, 읽기 전용 툴 10개)를 기능으로 추가했다. 사람 검토(reviewed_by: WoongHwan-Kim)를 거쳐 `verified`로 재승인했다.
