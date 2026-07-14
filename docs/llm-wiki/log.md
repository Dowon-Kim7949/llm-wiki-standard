---
title: LLM-WIKI Change Log
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: change_log
project: llm-wiki-standard
last_updated: 2026-07-14
author: cli-generated
last_edited_by: Claude Code
wiki_block_version: v1
source_files:
  - package.json
evidence:

related:
  - docs/llm-wiki/index.md
visibility: internal
contains_sensitive_info: false
---

# LLM-WIKI Change Log

이 문서는 append-only 변경 로그입니다. 기존 항목은 수정하지 말고 새 변경 사항을 위에 추가합니다.

## 2026-07-14 - docs: PUBLIC_API·ARCHITECTURE_CONVENTIONS·DOMAIN_FEATURES verified 재승인 (1.5)

- status: verified
- actor: Claude Code (사용자 WoongHwan-Kim 검토·승인)
- scope: docs
- changed:
  - docs/llm-wiki/PUBLIC_API.md
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md
  - docs/llm-wiki/DOMAIN_FEATURES.md
- summary:
  - 1.5 프로그래매틱 API doc-sync로 needs_review로 내려갔던 세 문서를 사람 검토·승인에 따라 `verified`로 재승인하고 `reviewed_by: WoongHwan-Kim`/`reviewed_at: 2026-07-14`를 기록했다. 리뷰 노트도 재승인 문구로 갱신했다.
- caveats:
  - validate-frontmatter --strict pass(22 files, findings 0). 이로써 1.5 배포 전 재검토 부채가 없다(log.md·release notes만 관례상 needs_review).

## 2026-07-14 - feat: 프로그래매틱 API (exports 맵 + schemaVersion) — 1.5 step 1

- status: needs_review
- actor: Claude Code
- scope: code, docs
- changed:
  - src/index.js (신규: 공개 API 진입점)
  - src/config.js (JSON_SCHEMA_VERSION 상수)
  - src/report.js (--format json에 schemaVersion 부가)
  - src/cli.js (기본 옵션 단일 소스 defaultOptions 추출)
  - package.json (main + exports 필드)
  - tests/verification.test.js (회귀 테스트 +7)
  - docs/llm-wiki/PUBLIC_API.md
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md
  - docs/llm-wiki/DOMAIN_FEATURES.md
- summary:
  - ROADMAP 1.5의 프로그래매틱 API를 구현했다. `package.json` `exports`(`.` → `src/index.js`)로 in-process import를 공식 지원한다. `src/index.js`는 CLI `COMMANDS`와 1:1인 동결된 `commands` 맵, 개별 함수 export, `normalizeOptions`(부분 옵션 → 완전 옵션, `cli.js`의 `defaultOptions`와 단일 소스 공유), `parseArgs`/`run`, `SCHEMA_VERSION`을 공개하고 JSDoc typedef로 반환 형태를 문서화한다.
  - `--format json` 출력(콘솔 + `--out *.json` 파일) 최상단에 부가적 `schemaVersion` 정수 필드를 넣었다. 단일 소스는 `src/config.js`의 `JSON_SCHEMA_VERSION`(현재 1). 기존 필드는 불변이라 기존 JSON 소비자를 깨지 않는다(회귀 테스트로 `command` 보존·파일 출력의 `text` 제거 유지·비-JSON graph 미부착 확인).
- evidence:
  - src/index.js
  - src/config.js
  - src/report.js
- caveats:
  - node --test 155개(신규 7개) pass, validate-frontmatter --strict pass.
  - 계약 동결 성격이라 각 명령의 실제 반환 JSON 형태를 편집 전 재확인했다.
  - 아직 배포 전이다(버전 bump/tag/npm 미실행). 관련 verified 문서 3개(PUBLIC_API·ARCHITECTURE_CONVENTIONS·DOMAIN_FEATURES)는 LLM 편집으로 needs_review로 강등됐으며 사람 재검토가 필요하다.

## 2026-07-14 - docs: DOMAIN_FEATURES·PUBLIC_API verified 재승인 (1.4.0)

- status: verified
- actor: Claude Code (사용자 WoongHwan-Kim 검토·승인)
- scope: docs
- changed:
  - docs/llm-wiki/DOMAIN_FEATURES.md
  - docs/llm-wiki/PUBLIC_API.md
- summary:
  - 1.4.0 doc-sync로 needs_review로 내려갔던 두 문서를 사람 검토·승인에 따라 `verified`로 재승인하고 `reviewed_by: WoongHwan-Kim`/`reviewed_at: 2026-07-14`를 기록했다. 리뷰 노트도 재승인 문구로 갱신했다.
- caveats:
  - validate-frontmatter --strict pass. 이로써 1.4.0 배포 전 재검토 부채가 없다(log.md·release notes만 관례상 needs_review).

## 2026-07-14 - release: 1.4.0 준비 (보이는 지식 + Gate 10 번들)

- status: needs_review
- actor: Claude Code
- scope: release, docs
- changed:
  - package.json
  - tests/verification.test.js
  - CHANGELOG.md
  - CHANGELOG.ko.md
  - ROADMAP.md
  - ROADMAP.ko.md
  - docs/llm-wiki/DOMAIN_FEATURES.md
  - docs/llm-wiki/PUBLIC_API.md
  - docs/llm-wiki/releases/v1.4.0.md
- summary:
  - 1.4(보이는 지식) 라인을 1.4.0으로 릴리스 준비했다. package.json·버전 assertion을 1.3.0 → 1.4.0으로 올렸다. 이 릴리스는 `graph`·`stats`·publishing(step 1–3)과 **이전에 보류했던 Gate 10 파일/디렉터리 도메인 탐지**(`16825e9`)를 함께 번들한다. → 앞서 미룬 버전 결정을 1.4.0으로 확정.
  - CHANGELOG(EN·KO)에 1.4.0 항목 작성. ROADMAP(EN·KO)의 1.4를 shipped로 옮기고 Release Plan을 1.5→1.7로 조정. doc-sync: DOMAIN_FEATURES(파일 기반 감지 + graph/stats)와 PUBLIC_API(graph/stats 명령·graph format 토큰·stale "migrate --apply 차단" 정정)를 갱신 → 두 문서 `verified` → `needs_review` 강등. v1.4.0 릴리스 노트 작성.
- caveats:
  - push/tag(v1.4.0)·npm 배포는 사용자의 명시적 "배포" 지시 후에만.
  - needs_review 재검토 대기: DOMAIN_FEATURES, PUBLIC_API(이번 doc-sync로 강등). 사람 검토 후 verified 재승인 필요.

## 2026-07-14 - feat: bounded reader-friendly publishing (1.4 step 3)

- status: needs_review
- actor: Claude Code
- scope: code, docs, test
- changed:
  - src/report.js
  - README.md
  - README.ko.md
  - tests/verification.test.js
- summary:
  - 1.4 세 번째(마지막) 항목: 사람 독자용 공개를 SSG 없이 지원한다. `renderHtmlDashboard`에 탐색용 **Document Index** 섹션 추가(wikiGraph.documents를 정렬해 제목·경로 링크·인바운드 수·orphan 배지로 나열).
  - README(EN·KO)에 "Publishing for Human Readers" 절 추가: GitHub/GitLab 네이티브 렌더, Obsidian([[links]]+aliases), MkDocs 안내 + `graph --format mermaid|dot`·`stats`·`audit --format html`(Document Index) 활용법. "SSG 아님" 명시. Commands 표에 graph·stats 행 추가.
  - 테스트 추가(대시보드 Document Index에 문서 경로·제목 포함). 전체 148 pass.
- caveats:
  - 로드맵 1.4 3개 항목(graph·stats·publishing)이 모두 구현됐다. 다음: release: prepare 1.4.0 — 이 셋 + 보류 중인 Gate 10 파일/디렉터리 도메인 탐지를 함께 번들.
  - Document Index의 문서 링크는 대시보드 html이 저장소 루트 기준으로 서빙될 때 해석된다(상대경로). push/배포는 지시 시.

## 2026-07-14 - feat: llm-wiki stats 명령 (1.4 step 2)

- status: needs_review
- actor: Claude Code
- scope: code, test
- changed:
  - src/commands.js
  - src/cli.js
  - tests/verification.test.js
- summary:
  - 1.4 두 번째 항목: 읽기전용 `llm-wiki stats`(wiki 헬스 스냅샷)를 추가했다. 문서 1회 순회로 status 분포·evidence coverage(source_files/evidence 인용 문서 수)를 집계하고, `audit`를 재사용해 not_enriched(→ enriched%)·evidence.stale(stale_verified)·orphan(wikiGraph)을 얻는다.
  - 헬스 스코어 = verified%·enriched%·evidence_coverage%의 평균(0–100). text/json/markdown/html 지원. cli.js에 명령·옵션 규칙(cwd/type/profile/agent/strict/format/out)·usage·help 추가.
  - 테스트 추가(status 집계·verified% 50·evidence 집계·headScore 범위·미초기화 0). 전체 147 pass. 이 저장소 stats: 21 docs, health 92/100(verified 76%, enriched 100%, evidence 100%, stale 8, orphan 9).
- caveats:
  - 읽기전용(findings 없음 → exit 0). listTargetMarkdown 기준이라 templates 포함(validate-frontmatter와 동일 범위). stale 8은 2026-07-13 검토 문서가 2026-07-14 소스 변경을 참조하는 기존 드리프트(비회귀).
  - 로드맵 1.4 두 번째 항목. 다음: step 3 bounded publishing → release: prepare 1.4.0. push/배포는 지시 시. 로컬 커밋(미푸시).

## 2026-07-14 - feat: llm-wiki graph 명령 (1.4 step 1)

- status: needs_review
- actor: Claude Code
- scope: code, test
- changed:
  - src/commands.js
  - src/cli.js
  - src/report.js
  - tests/verification.test.js
- summary:
  - 1.4(knowledge you can see) 첫 항목: 읽기전용 `llm-wiki graph` 명령을 추가했다. `collectWikiGraph` 데이터를 graph 전용 `--format`으로 출력한다 — `text`(기본 요약), `json`(구조화 그래프), `mermaid`(GitHub/Obsidian용 fenced `graph TD`), `dot`(Graphviz digraph).
  - `collectWikiGraph`에 `edges`를 추가했다(additive): wiki `[[links]]`·`related` frontmatter·로컬 markdown 링크가 문서→문서로 해소되는 엣지를 dedup·정렬해 수집(각 `{source,target,kind}`). summary에 `edges` 카운트, `emptyWikiGraph`에도 반영. 기존 필드 불변이라 status/audit 대시보드 영향 없음.
  - cli.js: `graph` 명령 등록, format 검증을 명령 인지(graph만 mermaid/dot 허용, 전역은 text/json/markdown/html), 옵션 규칙(cwd/format/out)·usage·per-command help 추가. report.js: `graph --out`(mermaid/dot)은 raw 텍스트로 기록.
  - 테스트 추가(text/json/mermaid/dot 출력·related 엣지 반영·미초기화 0 문서·parseArgs mermaid/dot 수용). 전체 145 pass. 이 저장소에서 graph text(21 docs/54 edges/9 orphans)·mermaid·dot·json 확인, html은 graph에서 거부(exit 3).
- caveats:
  - graph는 읽기전용(쓰기 없음, findings 없음 → exit 0). 로드맵 1.4의 첫 항목. 다음: stats → publishing → release: prepare 1.4.0(보류 중인 Gate 10 도메인 탐지 번들).
  - push/tag/배포는 사용자 지시 시에만. 현재 로컬 main 커밋(미푸시).

## 2026-07-14 - feat: 파일+디렉터리 통합 도메인 탐지 (Gate 10, 1.4 이전 선행)

- status: needs_review
- actor: Claude Code (사용자 WoongHwan-Kim 설계·범위 승인)
- scope: code, test, docs, gate
- changed:
  - GATE_REVIEW.md
  - src/commands.js
  - tests/verification.test.js
- summary:
  - 실사용 갭 대응: 1.3 도메인 분리는 "폴더=도메인" 레이아웃만 잡아, FastAPI처럼 도메인이 **모듈 파일**(`app/api/api_v2/endpoints/hazard.py`)인 백엔드에서는 `00_overview`만 나왔다. 사용자 승인(Gate 10)에 따라 파일·디렉터리 **양쪽**을 잡도록 탐지를 확장했다.
  - `detectDomainDirectories`를 bounded DFS(최대 깊이 8)로 재작성했다. 디렉터리-도메인 부모(`domains/domain/modules/features`)의 하위 폴더 + 파일-도메인 부모(`endpoints/routers/routes/resources/controllers/handlers`)의 소스 파일을 도메인으로 수집한다. 부모를 만나면 수집 후 prune(하위 재탐색 안 함). 파일+폴더는 slug로 병합.
  - 오탐 0에 가깝게: node_modules/dist/build/target/bin/obj/venv/vendor/coverage/migrations/spec/docs/examples/scripts·기술명 세트·숨김/dunder 디렉터리는 traverse 제외. 파일은 소스 확장자(.py/.js/.ts/.rb/.go/... )만, 집계자/인프라 파일명(index/main/app/base/router/routes/urls/deps/schemas/models/... )·`__init__`·dunder·`*.d.ts`·`*.test/spec.*` 제외.
  - 범위는 GATE_REVIEW "Domain Detection Scope Decision"(Gate 10)에 명문화했다(정직한 한계 포함: Django 앱/자바 패키지/단일 라우터 파일/더 깊은 중첩은 미탐지 → `00_overview` 폴백).
  - 테스트 6개 추가(파일 도메인·집계자/`__init__` 제외·node_modules/.venv/tests skip·파일↔폴더 병합·중첩 prune·단일파일 미탐지·FastAPI e2e). 전체 142 pass. temp FastAPI 레이아웃(endpoints/*.py 11개)에서 01_customers~10_user 10개 문서 + overview 링크 확인.
- caveats:
  - DOMAIN_FEATURES.md 본문(파일 기반 탐지 반영)과 버전 bump·CHANGELOG/README·PUBLIC_API 반영은 **이 기능의 릴리스 준비 시점**에 함께 한다(선례대로). 버전은 릴리스 시 결정(도메인 분리 완성 관점의 1.3.1 vs 부가 minor 1.4.0 — 사용자 확인).
  - push/tag/배포는 사용자 지시 시에만. 현재 로컬 main 커밋(미푸시).

## 2026-07-14 - docs: 1.3 wiki 문서 verified 재승인 + stale 0.1.8 리뷰 baseline 정리

- status: verified
- actor: Claude Code (사용자 WoongHwan-Kim 검토·승인)
- scope: docs
- changed:
  - docs/llm-wiki/VERSIONING.md
  - docs/llm-wiki/project-profile.md
  - docs/llm-wiki/DOMAIN_FEATURES.md
  - docs/llm-wiki/PUBLIC_API.md
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md
  - docs/llm-wiki/domains/00_overview.md
  - docs/llm-wiki/RELEASE_FLOW.md
  - docs/llm-wiki/README.md
- summary:
  - 사용자 검토·승인에 따라 콘텐츠/레퍼런스 문서 8개를 `verified`로 (재)승인하고 `reviewed_by: WoongHwan-Kim`/`reviewed_at: 2026-07-14`를 기록했다. 1.2/1.3에서 needs_review로 내려갔던 4개(VERSIONING·project-profile·DOMAIN_FEATURES·PUBLIC_API)와 docs/llm-wiki/README.md를 승격하고, 이미 verified였던 3개(ARCHITECTURE_CONVENTIONS·domains/00_overview·RELEASE_FLOW)를 리프레시했다.
  - stale한 "2026-07-13에 0.1.8 …기준으로 검토했다" 리뷰 baseline을 1.3.0 기준 재검토 문구로 갱신했다(위 5개 문서). PUBLIC_API의 stale evidence 서술(`migrateCommand — --apply 차단`)을 `wiki_block_version 업그레이드 + --apply(Gate 8)`로 정정했다.
  - 역사적 0.1.8 기록은 보존했다: 이 log.md의 과거 항목(append-only), `releases/v0.1.8.md`, `releases/v1.0.0.md`의 "0.1.8→1.0.0" 서술, README의 팀 소개 pptx 파일명 링크(`...v0.1.8.pptx`, 실제 자산).
- caveats:
  - needs_review로 남는 문서: `log.md`(append-only 러닝 로그, 본질상 verified 안 함), `releases/v1.0.0–v1.3.0.md`(생성된 릴리스 노트, 역사적 산출물). v1.3.0 노트는 배포 완료 후에도 생성물이라 needs_review 유지.
  - validate-frontmatter --strict pass, 전체 136 tests pass. 이 커밋은 docs만 변경(코드·npm 패키지 내용 불변; docs/는 package files 미포함).

## 2026-07-14 - release: 1.3.0 준비 (디텍터 & 어댑터 확장)

- status: needs_review
- actor: Claude Code
- scope: release, docs
- changed:
  - package.json
  - tests/verification.test.js
  - CHANGELOG.md
  - CHANGELOG.ko.md
  - README.md
  - README.ko.md
  - ROADMAP.md
  - ROADMAP.ko.md
  - docs/llm-wiki/DOMAIN_FEATURES.md
  - docs/llm-wiki/PUBLIC_API.md
  - docs/llm-wiki/releases/v1.3.0.md
- summary:
  - 1.3(디텍터 & 어댑터 확장) 라인을 1.3.0으로 릴리스 준비했다. package.json·버전 assertion 테스트를 1.2.0 → 1.3.0으로 올렸다. 이 릴리스는 앞서 main에 올라간 A2(PHP/Ruby/.NET 감지)·B(Windsurf/Gemini/JetBrains 어댑터)·C(OKF type alias)와 domain 분리 생성(`611b82b`)을 함께 포함한다.
  - CHANGELOG(EN·KO)에 1.3.0 항목 작성. README(EN·KO)에 domain 분리 생성과 Windsurf/Gemini 어댑터를 반영. ROADMAP(EN·KO)의 1.3을 shipped로 옮기고 Release Plan을 1.4→1.7로 조정, 보류한 stdlib-server 감지를 Unscheduled 백로그에 기록했다.
  - doc-sync: DOMAIN_FEATURES(감지 생태계 확장 + 도메인 분리 + OKF alias)와 PUBLIC_API(migrate --apply·drift 명령·신규 --agent·--apply/--downgrade 옵션 — 1.2부터 뒤처져 있던 부분까지 정합)를 갱신했다. 두 문서는 내용 변경으로 `verified` → `needs_review`로 강등됐다. v1.3.0 릴리스 노트 작성.
- caveats:
  - push/tag(v1.3.0)·npm 배포는 사용자의 명시적 "배포" 지시 후에만 진행한다.
  - needs_review 재검토 대기 문서: DOMAIN_FEATURES, PUBLIC_API(이번), 그리고 이전 사이클의 VERSIONING·project-profile. 사람 검토 후 verified 재승인 필요.
  - stdlib-server 감지(로드맵 A1)는 이번 1.3에서 제외(백로그).

## 2026-07-14 - feat: OKF type를 doc_type 병행 alias로 허용 (1.3 C)

- status: needs_review
- actor: Claude Code
- scope: code, test
- changed:
  - src/frontmatter.js
  - src/commands.js
  - tests/frontmatter.test.js
- summary:
  - OKF 정렬(additive): 문서가 `doc_type` 대신/과 함께 OKF `type`를 가질 수 있게 했다. 비어 있지 않은 스칼라 `type`가 코어의 `doc_type` 필수 요구를 충족한다. 공용 헬퍼 `hasRequiredField(frontmatter, field)`를 `src/frontmatter.js`에 추가해 `validateFrontmatter`와 fix/migrate 엔진의 누락 필드 판정(verified skip 이유 + Tier A/B 계산)이 동일 규칙을 쓰도록 통일했다.
  - 순수 additive다: 기존 `doc_type` 문서는 불변이고, 이전에 실패하던 `type`-only 문서만 이제 통과한다. 제거·rename·통합은 없다(계약 파괴는 1.x 밖 유지). okf-v0.1 프로필의 `type` 필수 검사(okf.type_required)와는 독립적이라 상호 보완된다.
  - 테스트 추가(frontmatter.test.js): `type`만 있어도 doc_type 요구 충족, 둘 다 있어도 OK, 둘 다 없으면 여전히 실패. 전체 136 pass.
- caveats:
  - 로드맵 1.3의 세 번째(마지막) 기능 항목. 이로써 1.3 계획 3항목(A2 생태계 감지 · B 어댑터 확장 · C OKF type alias)이 모두 구현됐다. 다음은 release: prepare 1.3.0(이미 main에 있는 domain 분리 포함).

## 2026-07-14 - feat: 어댑터 확장 Windsurf/Gemini/JetBrains (1.3 B)

- status: needs_review
- actor: Claude Code
- scope: code, test
- changed:
  - src/commands.js
  - src/cli.js
  - templates/adapters/windsurf/llm-wiki.md (신규)
  - templates/adapters/gemini/GEMINI.md (신규)
  - templates/adapters/jetbrains/guidelines.md (신규)
  - tests/verification.test.js
- summary:
  - `ADAPTER_TARGETS`에 어댑터 3종을 추가했다. 사용자 정책(미확인 계약은 candidate)에 따라 **확인된 계약만 writable**로: Windsurf(`.windsurf/rules/llm-wiki.md`)·Gemini(`GEMINI.md`)는 writable(+handoffLabel → handoff 지원), JetBrains AI(`.junie/guidelines.md`)는 계약 미확인이라 info-level candidate(파일 미생성, antigravity와 동일 취급).
  - `planAdapterSuggestions`의 antigravity 하드코딩을 `!target.writable`로 일반화해 모든 candidate가 동일한 미리보기 문구를 받도록 했다. `writeAdapterFiles`는 이미 `writable` 플래그를 존중하므로 그대로 동작.
  - 각 어댑터 템플릿은 `docs/llm-wiki/index.md` 엔트리포인트와 운영 규칙을 담아 `adapter.entrypoint` 검증을 통과한다. templates/는 package `files`에 포함돼 함께 배포된다.
  - cli.js `SUPPORTED_AGENTS`에 windsurf/gemini/jetbrains 추가, help/usage의 에이전트 목록 갱신. **`--agent all`은 하위호환으로 codex/claude/antigravity 3개 유지**(cursor/copilot처럼 신규 어댑터도 명시 선택).
  - 테스트 추가: windsurf/gemini 생성 + jetbrains candidate 미생성 + 엔트리포인트 포함, parseArgs 신규 에이전트 수용·`--agent all` 3개 유지. 전체 135 pass.
- caveats:
  - JetBrains 경로(`.junie/guidelines.md`)는 미확인 후보다. 계약이 확인되면 `writable: true`로 승격(1줄 변경)한다. Windsurf/Gemini 경로가 실제와 다르면 사용자가 지적 시 조정한다.
  - 로드맵 1.3의 두 번째 항목. 버전 bump·README/CHANGELOG 반영은 릴리스 준비 시점.

## 2026-07-14 - feat: PHP/Ruby/.NET 생태계 감지 (1.3 A2)

- status: needs_review
- actor: Claude Code
- scope: code, test
- changed:
  - src/detector.js
  - tests/verification.test.js
- summary:
  - `detectNonNodeEcosystems`에 PHP(`composer.json`)·Ruby(`Gemfile`/`gems.rb`)·.NET(`*.csproj`/`*.fsproj`)를 추가했다. 매니페스트의 웹 프레임워크 신호로 backend/library role을 판정한다: PHP=laravel/symfony/slim/laminas/cakephp/yii/codeigniter, Ruby=rails/sinatra/rack/hanami/roda/grape/padrino, .NET=`Microsoft.NET.Sdk.Web`/`Microsoft.AspNetCore`.
  - .NET 프로젝트 파일은 이름이 임의라 `findProjectByExtension`(깊이 3 제한, files-before-dirs·정렬 결정적 DFS, node_modules/bin/obj/.git 등 스킵)로 탐색한다. `src/<Name>/<Name>.csproj` 같은 일반 배치를 찾는다.
  - 감지된 role은 기존 배선(backend→backendSignals, library→librarySignals)을 그대로 타서 projectType/ecosystems/primaryManifest에 반영된다. 순수 additive.
  - 테스트 추가: PHP/Ruby/.NET 웹 프레임워크→backend(ecosystems·primaryManifest 포함), 프레임워크 없는 PHP/Ruby→library. 전체 133 pass.
- caveats:
  - stdlib-only 서버(Go net/http, Python http.server 등) 감지(로드맵 A1)는 매니페스트만으론 불가·오탐 위험이 커 이번 1.3에서 제외(백로그).
  - 로드맵 1.3(detect & adapt breadth)의 첫 항목. 버전 bump·CHANGELOG/README 반영은 1.3 릴리스 준비 시점.

## 2026-07-14 - feat: backend/fullstack 개별 domain 문서 분리 생성

- status: needs_review
- actor: Claude Code
- scope: code, test
- changed:
  - src/commands.js
  - tests/verification.test.js
- summary:
  - Backend/Fullstack `init`이 `00_overview.md`만 만들던 문제를 고쳤다. 원인은 쓰기 단계가 아니라 계획 단계였다: `plannedDocs()`가 소스 스캔 없이 정적 문서 목록(CORE + PROFILE)만 반환해 개별 domain 문서가 애초에 후보에 없었다.
  - 디렉터리 경계 기반 domain 탐지를 추가했다. `src|app/{domains,domain,modules,features}`·`internal/{domain,domains,modules}`의 직속 하위 디렉터리를 domain 후보로 보고, `common/shared/core/config(s)/util(s)/middleware(s)/infrastructure/test(s)/fixture(s)`와 숨김 디렉터리는 제외한다. 클래스/파일명 추론이나 LLM 호출은 하지 않는다.
  - 순수 함수로 분리해 export했다: `normalizeDomainSlug`(camel/Pascal/kebab/snake/공백/한글 정규화), `domainDisplayName`, `detectDomainDirectories`(best-effort I/O, 후보별 try/catch), `planDomainDocs`(slug 기준 결정적 정렬 + 중복 병합 + `NN_slug` 순번). init 파이프라인에는 선택지 A(문자열 배열 유지 + `domainContext` 스레딩)로 최소 변경 적용.
  - 개별 domain 문서는 `doc_type: domain`, `source_files`=탐지된 디렉터리(중복 시 모든 경로 병합, 존재하는 경로만), `related`=[00_overview, DOMAIN_FEATURES, (+API_CONTRACTS/DATA_MODEL은 이번 생성 후보에 있을 때만)]. `00_overview.md`는 탐지된 domain을 상대링크로 나열(미탐지 시 검토 안내). `docTypeFromPath`가 `/domains/`에서 00_overview만 domain_overview, 나머지는 domain으로 구분.
  - 기존 계약 보존: `--minimal`은 개별 domain 미생성, `--dry-run`은 미기록, `--existing skip`은 기존 domain 문서 보존, 생성 문서는 needs_review, verified 승격 없음. frontend/library/unknown/mixed는 빈 컨텍스트로 기존 결과 불변.
  - 테스트 9개 추가(유닛 3 + 통합 6). node --test 131 pass, validate-frontmatter --strict clean. temp backend 프로젝트 e2e(dry-run/write/validate)로 확인.
- caveats:
  - 버전 bump·CHANGELOG/README·DOMAIN_FEATURES(verified) 반영은 다음 릴리스 준비 시점에 한다(현재 서술이 틀리진 않고 미포함일 뿐이라 이번엔 미변경).
  - 지정 부모 디렉터리 목록 밖 구조나 파일명 규약 기반 도메인은 의도적으로 미탐지. 기존 overview가 skip될 경우 새 domain 문서는 인바운드 링크가 없어 wiki graph 고아 경고(warning) 가능.
  - 로드맵 배치(예: 1.3 detect breadth 편입)와 사용자용 문서 반영 여부는 사용자 확인 후 결정한다.

## 2026-07-14 - release: 1.2.0 준비 (안전 업그레이드 & 마이그레이션)

- status: needs_review
- actor: Claude Code
- scope: release, docs
- changed:
  - package.json
  - tests/verification.test.js
  - CHANGELOG.md
  - CHANGELOG.ko.md
  - README.md
  - README.ko.md
  - ROADMAP.md
  - ROADMAP.ko.md
  - docs/llm-wiki/releases/v1.2.0.md
- summary:
  - 1.2(안전 업그레이드 & 마이그레이션) 헤드라인을 1.2.0으로 릴리스 준비했다. package.json 버전과 버전 assertion 테스트를 1.1.0 → 1.2.0으로 올렸다.
  - CHANGELOG(EN·KO)에 1.2.0 항목 작성(Added: 업그레이드 리포트·migrate --apply·drift 명령 / Changed: evidence.stale 라인 granularity·version-agnostic 문서). README(EN·KO)에 migrate 해금·drift 명령·evidence.stale granularity를 반영하고 "Upgrades & Drift" 절을 추가했다. ROADMAP(EN·KO)의 1.2를 shipped로 옮기고 Release Plan을 1.3→1.7로 조정했다.
  - v1.2.0 릴리스 노트를 작성했다. 전체를 한 "release: prepare 1.2.0" 커밋으로 묶는다.
- caveats:
  - push/tag(v1.2.0)·npm 배포는 사용자의 명시적 "배포" 지시 후에만 진행한다(태그가 publish.yml로 npm Trusted Publishing을 트리거).
  - 이 릴리스에 포함된 게이트 결정: Gate 8(migrate --apply 범위), Gate 9(drift 강등 범위). 둘 다 accepted_for_1.2.0.
  - VERSIONING·project-profile은 version-agnostic 전환으로 needs_review로 내려가 있어, 사람 재검토 후 verified 재승인이 필요하다.

## 2026-07-14 - docs: VERSIONING·project-profile version-agnostic 전환

- status: needs_review
- actor: Claude Code
- scope: docs
- changed:
  - docs/llm-wiki/VERSIONING.md
  - docs/llm-wiki/project-profile.md
- summary:
  - 두 문서에서 고정 버전 숫자("현재 버전 1.0.0") 표기를 걷어내고 `package.json`의 `version`을 단일 진실 소스로 참조하도록 바꿨다. 이로써 매 릴리스마다 이 문서들을 버전 숫자 때문에 갱신·재검토하던 부채를 없앴다(2버전 뒤처짐 문제 해소).
  - VERSIONING: Policy를 재작성(package.json 단일 소스 명시, "1.0.0에서 안정 계약 확정"은 역사적 사실로 유지), bump 예시를 version-agnostic(x.y.Z / x.Y.0 / X.0.0)으로 일반화. project-profile: Detected Project·Evidence의 버전 숫자 제거, 1.2에서 해금된 `migrate --apply`를 반영해 보수적 쓰기 정책 서술 갱신.
  - 규칙에 따라 두 문서를 `verified` → `needs_review`로 강등하고 `reviewed_by`/`reviewed_at`를 제거했다(내용이 바뀌어 더 이상 사람 검증 상태가 아님). tags의 `verified` → `needs-review`. validate-frontmatter는 normal·strict 모두 pass.
- caveats:
  - 두 문서는 사람 재검토 후 verified 재승인이 필요하다(reviewed_by/reviewed_at 재기록).
  - 부수 효과: needs_review가 되면서 두 문서는 더 이상 evidence.stale(verified 전용) 대상이 아니다.

## 2026-07-14 - feat: drift 명령 + opt-in 강등 (1.2 step 3b, Gate 9)

- status: needs_review
- actor: Claude Code (사용자 WoongHwan-Kim 표면 승인)
- scope: code, test, docs, gate
- changed:
  - GATE_REVIEW.md
  - src/commands.js
  - src/cli.js
  - tests/verification.test.js
- summary:
  - Gate 9(Drift Downgrade Scope)를 `accepted_for_1.2.0`으로 작성하고, 새 `llm-wiki drift` 명령을 구현했다. 사용자가 "새 drift 명령" 표면을 선택했다(fix·migrate가 status를 못 만지므로 강등은 격리된 전용 표면이 필요).
  - `drift`(기본/`--dry-run`)는 verified 문서의 `evidence.stale` 드리프트를 리포트만 한다(라인/심볼 인지, 3a 재사용). `drift --downgrade`는 드리프트된 verified 문서만 `status: verified → needs_review`로 바꾸고 `last_updated`를 갱신한다 — 그 외 필드/본문/reviewed_at은 불변, verified 승격은 절대 안 함. preview-first(`--dry-run`↔`--downgrade` 배타), 멱등, mojibake/민감정보 스킵.
  - CLI에 `drift` 명령·`--downgrade` 옵션·옵션 규칙·배타쌍·usage/help/per-command help를 추가했다. `fix` 엔진의 splitFrontmatter/replaceFrontmatterScalar 헬퍼를 재사용한다.
  - 테스트 추가: 리포트 미기록·downgrade 강등·멱등·미초기화 pass·parseArgs(--downgrade, dry-run+downgrade 거부). 전체 122 pass. CLI 스모크(help·배타 exit 3·레포 read-only 리포트 13건)와 temp end-to-end로 확인.
- caveats:
  - drift는 advisory다: `findings`에는 sensitive 블록만 담고 evidence.stale은 `driftFindings`로 분리해 exit code에 영향 주지 않는다. CI 게이트가 필요하면 기존대로 `validate --strict`(evidence.stale를 warning으로)를 쓴다.
  - 로드맵 1.2 item 3의 강등 절반이다(granularity는 3a). 이로써 1.2의 3개 헤드라인 항목이 모두 구현됐다: 업그레이드 리포트 · migrate --apply · (드리프트 granularity + opt-in 강등).
  - 버전 bump·CHANGELOG·README·ROADMAP 반영은 1.2 릴리스 준비 시점에 한다.

## 2026-07-14 - feat: evidence.stale 라인 단위 granularity (1.2 step 3a, 읽기전용)

- status: needs_review
- actor: Claude Code
- scope: code, test
- changed:
  - src/git.js
  - src/commands.js
  - tests/verification.test.js
- summary:
  - `evidence.stale` 드리프트 감지에 라인 단위 정밀도를 추가했다. `src/git.js`에 `lineRangeChangedSince`(git `log -L<start>,<end>:<file> -s`)를 추가하고, `driftTargets`가 source_files(broad)와 evidence 참조(locator 포함)를 구분해 반환하도록 확장했다(기존 `.files` 계약 유지, `.sources`/`.evidenceRefs` 추가).
  - `scanEvidenceDrift`는 이제 어떤 파일이 **오직 라인 범위 evidence(`#Lx-Ly`)로만** 인용된 경우(source_files·심볼/섹션/라우트·bare-file 같은 broad 참조가 없을 때) 그 라인 범위만 검사한다 → 파일 내 무관한 편집은 드리프트로 잡지 않는다. broad 참조가 하나라도 있으면 기존 file-level 검사를 유지한다(보수적). 라인 쿼리 실패(범위 초과 등) 시 file-level로 폴백한다.
  - 테스트 추가: `lineRangeChangedSince` 유닛(인용 라인만 감지, 무관 라인 미감지, 같은날 미감지)과 audit 통합(line-only evidence의 인용 라인 변경 → 드리프트, 무관 라인 인용 → 미드리프트). 전체 119 pass.
- caveats:
  - 심볼/섹션/라우트 locator는 소스 파싱 없이 라인 매핑이 불가하므로 file-level로 남겨 정직성을 유지한다(향후 심볼→라인 해석은 별도 후보).
  - 레포 문서는 대부분 source_files(broad)를 함께 쓰므로 file-level이 유지된다 — 이번 변경은 line-only 인용의 오탐만 줄인다. 읽기전용이며 status/frontmatter를 쓰지 않는다.
  - 로드맵 1.2 item 3의 granularity 절반이다. opt-in verified→needs_review 자동 강등(쓰기)은 3b로 별도 게이트/표면 결정 후 구현한다.

## 2026-07-14 - feat: migrate --apply 해금 (1.2 step 2, fix 엔진 재사용)

- status: needs_review
- actor: Claude Code
- scope: code, test
- changed:
  - src/commands.js
  - src/cli.js
  - tests/verification.test.js
- summary:
  - 0.1.0부터 차단돼 있던 `migrate --apply`를 GATE_REVIEW Gate 8 범위로 해금했다. fix 엔진의 문서별 처리 루프+스텁 생성을 공용 함수 `runMechanicalRemediation(cwd, { write, upgradeBlockVersion })`로 추출하고, `fixCommand`는 이를 `upgradeBlockVersion:false`로 호출하도록 리팩터했다(동작 바이트 동일, 113 pass 확인).
  - migrate는 fix의 "버전 인식 형제"로 동작한다: `upgradeBlockVersion:true`일 때 기존 "behind" `wiki_block_version`을 현재로 업그레이드하되, 문서가 그 외 계약에 부합할 때만(미충족 Tier B 필드가 없을 때만) stamp한다. 누락 필드는 fix와 동일하게 Tier A 삽입으로 backfill된다. verified 문서는 내용/stamp 모두 건드리지 않고 갭만 skipped로 보고하며, ahead(현재보다 최신) 문서는 절대 다운스탬프하지 않는다.
  - `migrate`는 preview-first다: 기본/`--dry-run`은 업그레이드 리포트+계획을 보여주고 쓰지 않으며, `--apply`만 적용한다(`--dry-run`↔`--apply`는 파서에서 이미 배타). doctor의 `migration_apply` 라인과 CLI usage/help(migrate --apply 사용법·Gate 8 범위)를 갱신했다.
  - 테스트 추가: behind→current 업그레이드(쓰기), dry-run 미기록, verified 미변경/미stamp, Tier B 미충족 시 behind 유지, 멱등. 전체 117 pass. temp 프로젝트 end-to-end(dry-run→apply→재apply 0건)와 레포 dry-run(gap 0/17)·validate-frontmatter(0 findings)로 확인했다.
- caveats:
  - apply 모드의 "Upgrade Report" 섹션 카운트는 엔진 실행 전(pre-migration) 상태를 보여준다(감지된 갭). 실제 적용 결과는 Summary의 `applied:`와 "Applied Changes"에 나온다.
  - `BLOCK_VERSION_FIELD_RENAMES`는 여전히 비어 있어 renamed-field 경로는 no-op이다(v1 단일 계약). v2 도입 시 채운다.
  - 로드맵 1.2의 두 번째(헤드라인) 항목이다. 버전 bump·CHANGELOG·README·ROADMAP 반영은 1.2 릴리스 시점에 한다.

## 2026-07-14 - feat: wiki_block_version 인식 업그레이드 리포트 (1.2 step 1, 읽기전용)

- status: needs_review
- actor: Claude Code
- scope: code, test
- changed:
  - src/config.js
  - src/template-renderer.js
  - src/commands.js
  - tests/verification.test.js
- summary:
  - `wiki_block_version`을 단일 소스 상수로 승격했다: `src/config.js`에 `CURRENT_WIKI_BLOCK_VERSION = "v1"`과 (현재 비어 있는) `BLOCK_VERSION_FIELD_RENAMES`를 추가하고, 문서 생성 템플릿(`template-renderer.js`)과 fix의 Tier A 기본값이 이 상수에서 값을 받도록 했다(출력은 v1로 동일).
  - 읽기전용 업그레이드 리포트를 추가했다: `analyzeBlockVersions`가 각 wiki 콘텐츠 문서(templates 제외)의 기록된 블록버전을 현재 계약과 비교해 current/behind/unrecorded/unknown/ahead로 분류한다. `migrate --dry-run`에 "Upgrade Report (wiki_block_version)" + "Documents to Upgrade" 섹션과 `upgradeReport` JSON 페이로드를 노출하고, `doctor`에 `wiki_block_version: current=… gap=n/N docs` 요약 라인을 추가했다.
  - fix가 새 공용 헬퍼 `listWikiContentDocs`(templates 제외 파일셋)를 재사용하도록 리팩터해 migrate와 파일셋 정의를 통일했다. 테스트 추가(버전 갭 분류·ahead는 갭 아님). 전체 113 pass.
- caveats:
  - 이 커밋은 읽기전용이다. `migrate --apply`는 이 빌드에서 아직 blocked이며(메시지를 Gate 8 수락 상태에 맞게 갱신), 실제 해금은 step 2에서 fix 엔진 재사용으로 구현한다.
  - `ahead`(현재 CLI보다 최신 블록버전) 문서는 리포트만 하고 절대 강등/다운스탬프하지 않는다.

## 2026-07-14 - docs(gate): Gate 8 수락 (accepted_for_1.2.0)

- status: needs_review
- actor: Claude Code (사용자 WoongHwan-Kim 승인)
- scope: docs, gate
- changed:
  - GATE_REVIEW.md
- summary:
  - 사용자가 "Gate 8 수락, 진행"으로 승인함에 따라 Gate 8을 `proposed_for_1.2.0` → `accepted_for_1.2.0`로 확정했다. rename map은 비운 채 출시(현재 v1이 유일한 블록버전). 이로써 migrate --apply 구현(step 2) 착수가 해금된다.
- caveats:
  - 결정 문서만 변경. 코드 변경은 후속 커밋(step 1 업그레이드 리포트 → step 2 migrate --apply).

## 2026-07-14 - docs(gate): Gate 8 초안 — migrate --apply 범위 (1.2 착수)

- status: needs_review
- actor: Claude Code
- scope: docs, gate
- changed:
  - GATE_REVIEW.md
- summary:
  - 1.2(안전 업그레이드 & 마이그레이션) 헤드라인의 전제조건인 Gate 8(Migration Apply Scope Approval)을 `proposed_for_1.2.0`으로 초안 작성했다. Review Status 표에 Gate 8 행을 추가하고, fix 엔진(Gate 6)의 승인 범위를 그대로 재사용하는 "Migration Apply Scope Decision (proposed for 1.2.0)" 섹션을 넣었다.
  - 핵심 결정: migrate는 fix의 "버전 인식 형제"다 — 문서의 `wiki_block_version`과 CLI 현재 블록버전의 계약 갭을 보고하고, fix가 신뢰받는 동일한 기계적 수정을 적용하며, 문서가 현재 계약에 부합해진 뒤에만 `wiki_block_version`을 stamp한다. preview-first(`--dry-run`↔`--apply` 배타), verified 문서 내용·status·source_files/evidence 값·Tier B 필드는 보고만. renamed-field 기계는 만들되 rename map은 현재 비어 있음(v1 단일 계약).
  - Gate 8 수락 시 Gate 4의 migrate --apply 차단을 1.x 라인에서 대체함을 명시했고, Release Caveats도 갱신했다.
- caveats:
  - **사람 승인 대기 상태다.** Gate 8이 수락되기 전까지 migrate --apply 구현(코드)은 착수하지 않는다. GATE_REVIEW.md는 docs/llm-wiki/ 밖이라 validate 스캔 대상이 아니며, frontmatter status는 이미 needs_review다.
  - 이 커밋은 결정 문서만 바꾼다. 코드·CLI 표면 변경 없음.

## 2026-07-14 - fix(ci): CRLF-안전 okf 테스트 + .gitattributes(eol=lf)

- status: needs_review
- actor: Claude Code
- scope: test, ci
- changed:
  - tests/verification.test.js
  - .gitattributes
- summary:
  - 1.0.0에서 추가한 Windows CI 매트릭스가 드러낸 실패를 수정했다. 원인은 제품이 아니라 테스트다: okf 픽스처 테스트가 `corpus.includes("evidence:\n  - ...")`로 `\n`을 하드코딩해 Windows 체크아웃(CRLF)에서 매칭에 실패했다. corpus를 LF로 정규화했다(validate 자체는 CRLF를 정상 처리하며 findings 단언은 통과했었다).
  - 재발 방지로 `.gitattributes`(`* text=auto eol=lf`, png/pptx는 binary)를 추가해 전 플랫폼 LF 체크아웃을 강제했다.
- caveats:
  - 로컬(LF)에선 정규화가 no-op이라 112 pass 유지. Windows CI 그린 여부는 push 후 확인한다. 1.1.0 태그 이후의 저장소 위생 커밋이며 배포된 패키지 내용에는 영향이 없다(tests/·.gitattributes는 npm files 미포함).

## 2026-07-14 - release: 1.1.0 준비 (1.0.1 흡수)

- status: needs_review
- actor: Claude Code
- scope: release, docs
- changed:
  - package.json
  - tests/verification.test.js
  - CHANGELOG.md
  - CHANGELOG.ko.md
  - README.md
  - README.ko.md
  - ROADMAP.md
  - ROADMAP.ko.md
  - docs/llm-wiki/releases/v1.1.0.md
  - docs/llm-wiki/releases/v1.0.1.md (삭제)
- summary:
  - 1.1(inner-loop) 항목을 1.1.0으로 릴리스 준비했다. package.json·버전 assertion 테스트를 1.0.1 → 1.1.0으로 올리고, 배포된 적 없는 1.0.1을 1.1.0에 흡수했다(CHANGELOG의 1.0.1 항목을 1.1.0으로 병합, releases/v1.0.1.md 삭제).
  - CHANGELOG(EN·KO)에 1.1.0 항목 작성(Added: validate --changed·pre-commit 훅·CI Quick Start / Fixed: evidence.stale 경계 / Changed: 로드맵 재작성·EN-KO 쌍). README(EN·KO) validate 행에 --changed 반영. ROADMAP(EN·KO)의 1.1을 shipped로 이동하고 Release Plan을 1.2→1.7로 조정.
  - v1.1.0 릴리스 노트를 작성했다. 전체를 한 커밋으로 묶어 배포한다.
- caveats:
  - VERSIONING.md·project-profile.md는 여전히 "현재 버전 1.0.0" 표기라 2 버전 뒤처진다. 다만 npm 패키지 미포함이라 배포 영향은 없다. 버전 숫자를 빼고 package.json을 단일 소스로 참조하는 version-agnostic 전환을 다음 작업으로 권장한다(사람 재검토 필요).

## 2026-07-14 - feat: pre-commit 훅 템플릿 + CI Quick Start 점검 (1.1)

- status: needs_review
- actor: Claude Code
- scope: code, ci, docs
- changed:
  - templates/git-hooks/pre-commit
  - templates/git-hooks/README.md
  - .github/workflows/ci.yml
- summary:
  - 소비 프로젝트용 pre-commit 훅 템플릿을 추가했다: `npx --no-install llm-wiki validate --changed`로 변경된 wiki 문서만 커밋 전에 검증한다(설치법은 templates/git-hooks/README.md). templates/는 package files에 이미 포함돼 함께 배포된다.
  - CI consumer-install 잡을 확장해 packed tarball에 대해 Quick Start 명령(doctor, init --dry-run, validate-frontmatter)을 실행하게 했다(Phase 7 "Quick Start against packed artifacts" 항목 충족).
  - 로컬(Windows)에서 pack→install→Quick Start 3종 exit 0 확인, 훅 템플릿·README가 tarball에 포함됨을 확인.
- caveats:
  - 로드맵 1.1의 세 번째(마지막) 항목이다. 이로써 1.1 계획 항목(evidence.stale 경계 수정 · validate --changed · pre-commit 훅/Quick Start 점검)이 모두 구현됐다. 버전 1.1.0 bump·CHANGELOG·README 반영·릴리스는 사용자 결정 후 진행한다.

## 2026-07-14 - feat: validate --changed (변경 문서 한정 검증, 1.1)

- status: needs_review
- actor: Claude Code
- scope: code, test
- changed:
  - src/cli.js
  - src/commands.js
  - src/git.js
  - tests/verification.test.js
- summary:
  - `validate --changed`를 추가했다: git diff 기준(기본은 작업트리 vs HEAD, `--since <ref>` 지정 시 해당 ref 이후)으로 변경된 문서의 findings만 리포트한다. 그래프/related 같은 교차 문서 검사는 전역 실행하되 결과만 변경 문서로 한정한다. pre-commit·CI 가속용이다.
  - `src/git.js`에 `changedFiles` 헬퍼 추가, `src/cli.js`에 `--changed` 플래그와 validate의 `--since` 허용, `changed.unavailable` 설명 등록, help/usage 갱신.
  - 테스트 추가: 변경 문서만 리포트(git 기반 시나리오)와 `--since` 파싱 계약 갱신. 전체 112 pass.
- caveats:
  - 저장소 루트에서 실행을 가정한다(git 경로 정렬). git을 못 쓰면 `changed.unavailable`(error)로 보고한다.
  - 로드맵 1.1의 두 번째 항목이다. 버전 bump·CHANGELOG·README 반영은 1.1 릴리스 시점에 한다.

## 2026-07-14 - fix: evidence.stale 같은날 경계 수정 (1.1 착수)

- status: needs_review
- actor: Claude Code
- scope: code, test
- changed:
  - src/git.js
  - tests/verification.test.js
- summary:
  - `fileChangedSince`가 `git log --since=<date>`로 리뷰 당일 커밋까지 포함해 발생하던 evidence.stale 오탐(같은 날 리뷰+커밋)을 수정했다. 기준일을 그날의 끝(`<date> 23:59:59`)으로 앵커링해, 같은 날 커밋은 리뷰가 커버한 것으로 처리하고 다음 날 이후 커밋만 드리프트로 본다.
  - dated-commit 기반 테스트를 추가했다(같은 날 → 미탐, 전날 기준 → 탐지). 저장소 evidence.stale 경고가 21 → 11로 줄었다(남은 11건은 2026-07-14에 실제로 바뀐 package.json/README.md/RELEASE_CHECKLIST.md를 참조하는 진짜 드리프트).
- caveats:
  - 로드맵 1.1(inner-loop cleanup)의 첫 항목이다. 버전 bump와 CHANGELOG/ROADMAP 반영은 1.1 릴리스 시점에 한다.

## 2026-07-14 - 1.0.1 패치 릴리스 준비 (문서 전용)

- status: needs_review
- actor: Claude Code
- scope: release, docs
- changed:
  - package.json
  - tests/verification.test.js
  - CHANGELOG.md
  - CHANGELOG.ko.md
  - docs/llm-wiki/releases/v1.0.1.md
- summary:
  - 아래 두 문서 변경(ROADMAP 1.x 재작성, 핵심 외부 문서 EN-KO 쌍 도입)을 patch로 묶어 package.json 버전과 버전 assertion 테스트를 1.0.1로 올렸다. 기능·API·명령 표면 변경은 없다.
  - CHANGELOG(EN·KO 동기화)에 1.0.1 항목을 추가하고 v1.0.1 릴리스 노트를 작성했다. 전체를 한 커밋으로 묶는다.
- caveats:
  - VERSIONING.md·project-profile.md는 "현재 버전 1.0.0" 표기가 남아 patch만큼 뒤처진다. 매 릴리스 재검토를 피하려면 버전 숫자를 빼고 package.json을 단일 소스로 참조하도록 바꾸는 것을 별도로 검토한다(사람 재검토 필요).
  - v1.0.1 태그 push와 npm 배포는 별도 승인 후 진행한다.

## 2026-07-14 - 핵심 외부 문서 EN-KO 쌍 도입 (CHANGELOG, ROADMAP)

- status: needs_review
- actor: Claude Code
- scope: docs
- changed:
  - CHANGELOG.md
  - CHANGELOG.ko.md
  - ROADMAP.md
  - ROADMAP.ko.md
  - package.json
  - docs/llm-wiki/README.md
  - RELEASE_CHECKLIST.md
- summary:
  - 외부 공개 루트 문서를 README처럼 영문 .md(정본)+국문 .ko.md 쌍으로 관리하기로 하고, 사용자가 지정한 핵심 외부 문서(CHANGELOG, ROADMAP)의 국문본을 추가했다.
  - 각 쌍 상단에 `> Language:` 상호링크를 넣고, CHANGELOG.ko.md·ROADMAP.ko.md를 package.json files에 등록했다. ROADMAP.ko.md는 정본 frontmatter를 미러링한다.
  - 규약을 docs/llm-wiki/README.md에 문서화하고, RELEASE_CHECKLIST에 ".ko.md 쌍 동기화" 점검 항목을 추가했다.
- caveats:
  - 루트 문서는 docs/llm-wiki/ 밖이라 validate 스캔 대상이 아니다(frontmatter는 규약일 뿐 강제되지 않음).
  - 국문본은 정본과 수동 동기화가 필요하다(RELEASE_CHECKLIST 점검으로 보완). 짝 없는 .md/.ko.md 자동 감지 검사는 향후 1.x 후보로 검토 가능.

## 2026-07-14 - ROADMAP를 1.x 1년 계획으로 재작성

- status: needs_review
- actor: Claude Code
- scope: docs
- changed:
  - ROADMAP.md
- summary:
  - 1.0.0까지 구현 완료된 Phase 1–8 이력 나열을 걷어내고(이력은 CHANGELOG.md·log.md·releases/로 위임) 미래 지향 로드맵으로 재작성했다.
  - 2.0(파괴 변경) 프레이밍을 제거하고, 1.0.0 이후 작업을 1.1~1.7 마이너 릴리스로 (목표 날짜 없이) 순서만 배치했다: 1.1 inner-loop 정리, 1.2 마이그레이션/안전 업그레이드(헤드라인), 1.3 디텍터·어댑터 확장, 1.4 지식 뷰·헬스, 1.5 프로그래매틱 API, 1.6 MCP 서버, 1.7 팀/조직 확장.
  - 모든 1.x 항목은 하위호환(부가)이며, 계약 파괴 변경은 "Beyond the 1.x Horizon"으로 보류했다. 전면 SSG 렌더러·자동 OKF 추출·owner 필수화·자동 verified 승격·Notion 네이티브 모드는 declined로 유지했다.
- caveats:
  - 방향성 문서로 needs_review이다. 목표 날짜는 두지 않으며 각 릴리스는 필요에 의해 순서대로 당겨진다. migrate --apply 해금(1.2)은 착수 전 GATE_REVIEW 게이트가 필요하다.

## 2026-07-14 - VERSIONING·project-profile verified 승격

- status: verified
- actor: Claude Code
- scope: docs
- changed:
  - docs/llm-wiki/VERSIONING.md
  - docs/llm-wiki/project-profile.md
- summary:
  - 1.0.0 갱신 후 needs_review로 내려갔던 VERSIONING.md·project-profile.md를 사람 검토(reviewed_by: WoongHwan-Kim, 2026-07-14) 완료에 따라 verified로 승격하고 reviewed_by/reviewed_at를 기록했다.
- caveats:
  - 두 문서가 참조하는 package.json이 같은 날(2026-07-14) 커밋되어 validate의 evidence.stale이 same-day 특성(src/git.js의 --since)으로 경고를 낼 수 있으나 warning이며 비차단이다.

## 2026-07-14 - 1.0.0 안정성 릴리스 준비

- status: needs_review
- actor: Claude Code
- scope: release, docs, ci
- changed:
  - package.json
  - tests/verification.test.js
  - RELEASE_CHECKLIST.md
  - VERIFICATION.md
  - ROADMAP.md
  - GATE_REVIEW.md
  - CHANGELOG.md
  - .github/workflows/ci.yml
  - docs/llm-wiki/VERSIONING.md
  - docs/llm-wiki/project-profile.md
  - docs/llm-wiki/releases/v1.0.0.md
- summary:
  - 0.1.8 계약을 기능 변경 없이 1.0.0 안정 릴리스로 승격했다. package.json 버전과 버전 assertion 테스트(tests/verification.test.js)를 1.0.0으로 올렸다.
  - 0.1.5로 방치돼 있던 RELEASE_CHECKLIST.md·VERIFICATION.md를 1.0.0으로 정합하고, ROADMAP 스냅샷과 Phase 7·후보 상태를 갱신했다.
  - GATE_REVIEW.md에 Gate 7과 "1.0.0 Stability Milestone" 섹션을 추가해 명령·옵션 표면, --format json 출력 형태, 필수 frontmatter 계약을 안정 계약으로 확정했다.
  - Phase 7 릴리스 품질 CI를 추가했다: .github/workflows/ci.yml에 Node 18.18.0/20/22/24 × Windows/macOS/Linux verify 매트릭스와 packed-tarball consumer install 스모크 잡을 넣었다.
  - 루트 CHANGELOG.md를 신설(package.json files에 포함)하고 v1.0.0 릴리스 노트(docs/llm-wiki/releases/v1.0.0.md)를 작성했다.
  - 살아있는 버전 주장을 담은 VERSIONING.md·project-profile.md를 1.0.0으로 갱신하고 규칙에 따라 verified → needs_review로 강등했다.
- evidence:
  - package.json
  - .github/workflows/ci.yml
  - GATE_REVIEW.md
  - docs/llm-wiki/VERSIONING.md
- caveats:
  - CI 매트릭스의 macOS/Linux 실행은 로컬에서 검증할 수 없고 GitHub Actions에서만 확인된다. consumer install 스모크는 로컬 Windows에서 pack→install→doctor(exit 0)로 검증했다.
  - validate의 evidence.stale 경고 21개는 리뷰와 같은 날 커밋된 소스 때문에 발생하는 기존 warning이며 이번 작업의 회귀가 아니다(src/git.js의 --since 경계 특성).
  - VERSIONING.md·project-profile.md는 사람 재검토 후 verified 재승인이 필요하다.
  - v1.0.0 태그 push와 npm 배포는 별도 승인 후 진행한다.

## 2026-07-13 - 팀 공유용 LLM-WIKI 소개 프레젠테이션 추가

- status: needs_review
- actor: Codex
- scope: docs
- changed:
  - outputs/llm-wiki-team-introduction-v0.1.8.pptx
  - docs/assets/presentations/llm-wiki-lego-city.png
  - docs/llm-wiki/README.md
- summary:
  - 초급 개발자도 LLM-WIKI의 목적, 동작 방식, 이점, 안전 원칙과 자동화 범위를 이해할 수 있도록 12장 분량의 팀 공유용 PowerPoint를 작성했다.
  - 프로젝트를 레고 도시에 비유한 전용 일러스트와 도입 전후 비교, 작업 흐름, 팀 적용 단계 등을 포함했다.
- evidence:
  - README.md
  - README.ko.md
  - docs/llm-wiki/index.md
  - docs/llm-wiki/PUBLIC_API.md
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md
- caveats:
  - 발표 전 팀의 용어와 실제 도입 사례에 맞는 발표자 설명을 보완할 수 있다.

## 2026-07-13 - 사용자용 README frontmatter 제거

- status: needs_review
- actor: Codex
- scope: docs
- changed:
  - README.md
  - README.ko.md
  - docs/llm-wiki/README.md
- summary:
  - npm/GitHub에서 바로 노출되는 영어·한국어 README 상단의 내부 LLM-WIKI frontmatter를 제거했다.
  - 공식 위키 문서는 `docs/llm-wiki/` 아래에서 관리하며, 루트 README는 사용자용 문서로 유지한다는 경계를 위키 README에 명시했다.
- evidence:
  - src/commands.js#symbol:listTargetMarkdown
  - package.json
- caveats:
  - 이번 작업에서 수정한 위키 README와 변경 로그는 사람 재검토 전까지 `needs_review`로 유지한다.

## 2026-07-13 - LLM-WIKI 문서 검토 및 verified 승격

- status: verified
- actor: Codex
- reviewed_by: WoongHwan-Kim
- scope: docs
- changed:
  - docs/llm-wiki/**/*.md
  - docs/llm-wiki/VERSIONING.md
  - docs/llm-wiki/project-profile.md
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md
- summary:
  - 프로젝트 관리자의 검토 지시에 따라 위키 문서 17개의 frontmatter를 `verified`로 승격하고 `reviewed_by`/`reviewed_at` 메타데이터를 추가했다.
  - 현재 패키지 버전과 맞지 않던 `VERSIONING.md` 및 `project-profile.md`의 0.1.5 표기를 0.1.8로 수정했다.
  - 0.1.8의 실제 쓰기 경로에 맞춰 아키텍처 설명에 `quickstart --write`와 `fix --write`를 반영하고, 공개 옵션에 `release-notes --since`를 보완했다.
- evidence:
  - package.json
  - src/cli.js
  - src/commands.js
  - git tag v0.1.8
- caveats:
  - 이 승격은 현재 저장소 상태를 기준으로 하며, 이후 CLI 또는 에이전트가 문서를 수정하면 해당 문서는 다시 `needs_review`로 전환해야 한다.

## 2026-07-13 - obsolete v0.2.0 로드맵 구현 프롬프트 삭제

- status: needs_review
- actor: Claude Code
- scope: docs
- changed:
  - templates/prompts/v0.2.0-roadmap-task.md (삭제)
  - ROADMAP.md (related 항목 정리)
- summary:
  - `templates/prompts/v0.2.0-roadmap-task.md`를 삭제했다. 이 1회성 구현 지시 프롬프트의 항목(`prompt --task`, feature/fix/refactor·docs-sync·okf-extract 프롬프트, API 인벤토리 등)은 이미 전부 구현·출시되어 obsolete이며, 로컬 절대경로가 하드코딩된 채 `templates/`로 npm 배포물에 포함되던 내부 산출물이었다.
  - ROADMAP.md `related`에서 해당 파일 참조를 제거했다(다른 참조처 없음).
- evidence:
  - ROADMAP.md
- caveats:
  - 반복 작업 프롬프트는 이제 `llm-wiki prompt --task <name>`로 동적으로 생성하므로 정적 템플릿은 불필요하다.

## 2026-07-13 - ROADMAP 후보 섹션 0.1.8 기준 재정비

- status: needs_review
- actor: Claude Code
- scope: docs
- changed:
  - ROADMAP.md
- summary:
  - "Post-0.1.7 Candidates" → "Post-0.1.8 Candidates"로 재프레이밍하고, 0.1.8에서 출시된 scoped `fix`를 후보 목록에서 제거(후속 정제 항목은 drift/downgrade 항목에 병합)했다.
  - 실사용 인사이트를 신규 1순위 후보로 추가: 구버전(~0.1.0)에 생성된 기존 `docs/llm-wiki`를 폴더 삭제·재생성 없이 현재 계약으로 올릴 수 있는 업그레이드/마이그레이션 경로(`wiki_block_version` 인지 + `fix` 엔진 재사용, 미리보기 우선).
- evidence:
  - ROADMAP.md
- caveats:
  - 방향성 문서이며 구현 착수 전이다. 사람 검토 전까지 needs_review로 유지한다.

## 2026-07-13 - 범위 한정 자동수정 `fix` 명령 추가

- status: needs_review
- actor: Claude Code
- scope: code + docs
- changed:
  - src/commands.js (fixCommand 및 헬퍼 신설), src/cli.js (COMMANDS/옵션/도움말)
  - tests/verification.test.js
  - GATE_REVIEW.md (Gate 6 + "Autofix (--fix) Scope Decision")
  - ROADMAP.md, docs/llm-wiki/PUBLIC_API.md, DOMAIN_FEATURES.md, domains/00_overview.md
- summary:
  - `llm-wiki fix`(기본 미리보기, `--write` 시 적용)를 추가했다. 승인된 좁은 범위만 수정한다: 누락 Tier A frontmatter 필드 삽입, frontmatter `evidence` 기준 본문 `## Evidence` 섹션 보완, 깨진 related/markdown 링크에 대한 `needs_review` 스텁 생성, 수정 문서의 `last_updated` 갱신.
  - `verified` 문서 내용, `docs/llm-wiki/` 밖 파일, `source_files`/`evidence` 값, Tier B 필드(title/doc_type/project/author), 미보강 내용은 보고만 하고 자동수정하지 않는다. mojibake·민감정보 위험 결과는 건너뛴다. 멱등이며 편집은 최소 타깃 삽입으로 처리한다(frontmatter 재직렬화 없음).
  - 허용 범위는 GATE_REVIEW.md에 사전 확정한 뒤 구현했다(blocked `migrate --apply`와 동일한 보수 모델).
- evidence:
  - src/commands.js#symbol:fixCommand
  - GATE_REVIEW.md
- caveats:
  - 버전 bump·릴리스는 별도 절차이며 이 변경에는 포함하지 않았다(미배포 누적분에 합류).
  - Tier B 필드 유도, 경로 자동 복구, `verified`→`needs_review` 자동 강등은 후속 게이트로 남겼다.
  - 모든 생성/수정 문서는 사람 검토 전까지 needs_review로 유지한다.

## 2026-07-10 - evidence drift 감지 추가 (evidence.stale)

- status: needs_review
- actor: Claude Code
- scope: code + docs
- changed:
  - src/git.js (신규), src/release-notes.js, src/commands.js, tests/verification.test.js
  - ROADMAP.md
- summary:
  - `verified` 문서가 참조하는 `source_files`/`evidence` 로컬 파일이 `reviewed_at`(없으면 `last_updated`) 이후 git에서 변경되면 `evidence.stale` 경고를 낸다. best-effort(git 없으면 스킵), 파일 단위 휴리스틱, warning 레벨. 공용 `src/git.js`(runGit/fileChangedSince)를 신설하고 release-notes가 재사용한다.
  - ROADMAP에 Post-0.1.7 Candidates 섹션을 추가하고 drift 후보를 구현 상태로 갱신.
- evidence:
  - src/git.js
  - src/commands.js
- caveats:
  - 파일 단위라 무관한 변경도 flag될 수 있어 warning으로 유지. 라인/심볼 정밀도·자동 강등은 후속.

## 2026-07-10 - release-notes --since 옵션 추가

- status: needs_review
- actor: Claude Code
- scope: code
- changed:
  - src/release-notes.js, src/commands.js, src/cli.js, tests/verification.test.js
- summary:
  - `release-notes --since <git-ref>` 추가. 범위를 `<ref>..HEAD`로 강제해, 태그 생성 후에도 특정 기준점부터 노트를 재생성할 수 있다. `collectCommitsSinceLastTag`를 `collectCommits(cwd, { since })`로 일반화.
- evidence:
  - src/release-notes.js
- caveats:
  - `--since`는 `<ref>..HEAD` 범위이므로, 과거 버전을 정확히 재현하려면 태그 이후 커밋이 섞이지 않도록 주의한다.

## 2026-07-10 - 릴리스 노트 한국어·영어 이중 언어화

- status: needs_review
- actor: Claude Code
- scope: code + docs
- changed:
  - src/release-notes.js, src/cli.js, tests/verification.test.js
  - docs/llm-wiki/releases/v0.1.7.md
- summary:
  - `release-notes` 생성 골격(제목·안내문·섹션 헤더·폴백)을 한국어 우선 이중 언어(예: `## 추가 · Added`)로 변경. 커밋에서 온 항목은 소스 그대로 유지한다.
- evidence:
  - src/release-notes.js
- caveats:
  - 릴리스 노트는 태그 생성 "전"에 만들어야 한다(태그 생성 후에는 "마지막 v* 태그 이후"가 비어 v0.1.7 노트는 수동 복원함).

## 2026-07-10 - release-notes 명령 추가 (docs-sync)

- status: needs_review
- actor: Claude Code
- scope: code + docs
- changed:
  - src/release-notes.js (신규), src/commands.js, src/cli.js, src/report.js, tests/verification.test.js
  - docs/llm-wiki/PUBLIC_API.md
- summary:
  - `llm-wiki release-notes [--version x.y.z] [--out]` 명령 추가. 마지막 `v*` 태그 이후 conventional commit을 Added/Changed/Fixed/Documentation/Other로 분류해 needs_review 릴리스 노트 문서를 생성. git 없으면 채워 넣기용 스캐폴드로 폴백.
- evidence:
  - src/release-notes.js
- caveats:
  - chore/release 타입 커밋은 노트에서 제외한다. README 반영은 다음 릴리스 시점.

## 2026-07-10 - llm-wiki.config.json 지원 추가 (docs-sync)

- status: needs_review
- actor: Claude Code
- scope: code + docs + config
- changed:
  - src/config-file.js (신규), src/cli.js, src/commands.js, tests/verification.test.js
  - llm-wiki.config.json (저장소 dogfooding: type=library)
  - docs/llm-wiki/GLOSSARY.md, docs/llm-wiki/PUBLIC_API.md
- summary:
  - 프로젝트 루트 `llm-wiki.config.json`으로 `type`/`profiles`/`agents`/`strict` 기본값을 선언하도록 지원. CLI 플래그 > config > 자동감지 우선순위. 잘못된 config는 exit 3.
  - doctor가 config 존재 여부를 보고. 스키마는 보수적으로 최소 4개 필드만.
- evidence:
  - src/config-file.js
- caveats:
  - 스키마 확장(커스텀 문서세트/규칙/템플릿 override)은 실사용 피드백 이후 결정한다.
  - README.md/README.ko.md 반영은 다음 릴리스 시점.

## 2026-07-10 - Cursor/Copilot adapter 추가 (docs-sync)

- status: needs_review
- actor: Claude Code
- scope: code + docs
- changed:
  - src/commands.js, src/cli.js, tests/verification.test.js
  - templates/adapters/cursor/llm-wiki.mdc, templates/adapters/copilot/copilot-instructions.md
  - docs/llm-wiki/GLOSSARY.md, docs/llm-wiki/PUBLIC_API.md
- summary:
  - Cursor(`.cursor/rules/llm-wiki.mdc`)·GitHub Copilot(`.github/copilot-instructions.md`) adapter를 추가하고 handoff를 adapter 기반으로 일반화했다.
  - `--agent all`은 backward-compat을 위해 codex/claude/antigravity 세 개만 유지하고, cursor·copilot은 명시 선택하도록 했다.
- evidence:
  - src/commands.js
- caveats:
  - README.md/README.ko.md의 adapter·옵션 표기 갱신은 다음 릴리스 시점에 함께 반영한다.

## 2026-07-10 - detector 다중 생태계 지원 반영 (docs-sync)

- status: needs_review
- actor: Claude Code
- scope: code + docs
- changed:
  - src/detector.js, src/commands.js, tests/verification.test.js
  - docs/llm-wiki/DOMAIN_FEATURES.md
- summary:
  - detector가 Python/Go/Rust/JVM 매니페스트를 인식하도록 확장하고, 생성 문서의 기본 source_files를 감지된 primaryManifest로 앵커링했다.
- evidence:
  - src/detector.js
- caveats:
  - Go/Python의 stdlib 기반 서버는 프레임워크 신호가 없으면 library로 분류될 수 있다(향후 개선 후보).

## 2026-07-10 - core/library 문서 소스 근거로 보강 (dogfooding)

- status: needs_review
- actor: Claude Code
- scope: docs
- changed:
  - docs/llm-wiki/index.md, README.md, project-profile.md
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md, GLOSSARY.md
  - docs/llm-wiki/DOMAIN_FEATURES.md, domains/00_overview.md
  - docs/llm-wiki/PUBLIC_API.md, VERSIONING.md, EXAMPLES.md, RELEASE_FLOW.md
  - docs/llm-wiki/profiles/library.md
- summary:
  - 생성 스캐폴드의 placeholder를 실제 소스 근거(src/*, package.json)로 교체했다.
  - frontmatter `project`를 `llm-wiki-standard`로 교정하고 source_files/evidence/`## Evidence` 섹션을 채웠다.
- evidence:
  - src/cli.js
  - src/commands.js
  - package.json
- caveats:
  - templates/ 하위 문서는 의도적 템플릿이라 보강하지 않았다.
  - 모든 문서는 사람 검토 전까지 needs_review로 유지한다.

## 2026-07-10 - LLM-WIKI 초기 문서 생성

- status: needs_review
- actor: llm-wiki-cli
- scope: docs
- changed:
  - docs/llm-wiki/
- summary:
  - `llm-wiki init --write` 명령으로 초기 LLM-WIKI 문서 구조를 생성했다.
- evidence:
  - package.json
- caveats:
  - CLI 생성 초안이므로 사람 검토가 필요하다.
