---
title: LLM-WIKI Change Log
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: change_log
project: llm-wiki-governance
last_updated: 2026-07-22
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

## 2026-07-22 - docs: 재검증 정리 — DOMAIN_FEATURES verified 승격 + ARCHITECTURE Module Layout 완결성 보강

- status: verified
- actor: Claude Code (유지보수자 Dowon-Kim 지시·검토)
- scope: docs
- changed:
  - docs/llm-wiki/DOMAIN_FEATURES.md (needs_review→verified; 1.20→1.21 누적 재검증 리뷰노트 추가)
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md (Module Layout에 src/config-file.js·src/git.js 추가 + source_files에 src/git.js 등재 + 리뷰노트; verified 유지)
- summary:
  - DOMAIN_FEATURES: 1.20.0/1.21.0 신규 기능(P1 frontend/SPA 탐지·P2 evidence 경로 매칭·P3 `--domains`·P5 enrichment 체크리스트·P6 도메인 사전 배선·P7 휴리스트 투명성) 서술을 현재 소스와 대조 확인 후 verified 승격.
  - ARCHITECTURE: 재검증 정리 중, 실제 코드를 구동하나 Module Layout에서 누락돼 있던 `src/config-file.js`(config 로딩 엔진)·`src/git.js`(git 프리미티브)를 보강. 기존 서술에 틀린 항목 없음(`defaultOptions`·index.js MCP export·모듈 11개 일치 확인), 서술 추가만이라 계약·동작 불변.
- verification:
  - 269 tests pass, validate --strict 0 findings (exit 0)

## 2026-07-22 - feat: enrichment 체크리스트(P5) + 탐지/미완 휴리스틱 테스트·투명성(P7), release 1.21.0

- status: needs_review
- actor: Claude Code
- scope: src, tests, docs, release
- changed:
  - src/commands/scans.js (enrichmentChecklist + finding checklist 필드)
  - src/commands/findings.js (formatEnrichmentChecklist + explain content.not_enriched 보강)
  - src/commands.js (nextCommand enrich 액션·체크리스트 섹션·payload)
  - tests/verification.test.js (P5 2 + P7 2 신규 + 버전 assertion 1.21.0)
  - docs/llm-wiki/DOMAIN_FEATURES.md (P5 문장 + Detection & Enrichment Heuristics 섹션 + 리뷰노트)
  - package.json (1.20.0→1.21.0), CHANGELOG.md/.ko.md (1.21.0), ROADMAP.md/.ko.md (1.21 항목)
- summary:
  - P5: `next`가 미완(`content.not_enriched`) 문서별 Enrichment Checklist(placeholder가 남은 `##` 섹션+힌트)와 `enrich-placeholder-docs` 액션을 노출. 순수 `enrichmentChecklist` 헬퍼 + finding의 additive `checklist` 필드 + `next` payload additive `enrichmentChecklist`.
  - P7: `planDomainDocs` 결정적 스냅샷 테스트 + `FILE_DOMAIN_EXCLUDE` 폭넓은 제외 테스트로 휴리스틱 회귀 잠금. DOMAIN_FEATURES에 "Detection & Enrichment Heuristics" 투명성 섹션 추가, `explain content.not_enriched`에 `next` 체크리스트 포인터.
  - 1.21.0으로 P6(사전 배선)+P5+P7 묶어 릴리스.
- evidence:
  - src/commands/scans.js#symbol:enrichmentChecklist
  - src/commands.js#symbol:nextCommand
- caveats:
  - 269 tests·validate --strict 0·additive·read-only·zero-dep·1.0.0 계약 불변. DOMAIN_FEATURES는 에이전트 편집이라 `needs_review` — 사람 재검토 후 재승인 예정.

## 2026-07-22 - feat: 도메인 문서 orphan/링크 사전 배선 (외부 피드백 P6)

- status: needs_review
- actor: Claude Code
- scope: src, tests, docs
- changed:
  - src/commands/doc-templates.js
  - tests/verification.test.js
  - docs/llm-wiki/DOMAIN_FEATURES.md
  - CHANGELOG.md, CHANGELOG.ko.md
- summary:
  - `docMetadata`가 도메인이 계획될 때만 `index.md`(읽기 순서에 `domains/00_overview.md` 실제 링크 + `related` 추가)와 `DOMAIN_FEATURES.md`(`## Domains` 섹션으로 각 per-domain 문서 링크)를 사전 배선하도록 했다(공유 헬퍼 `domainLinkList`). overview↔per-domain 배선의 보완 — 진입점에서 도메인 지도로 가는 경로 제공, 테스터 수동 배선 자동화.
  - 도메인이 없으면 두 문서 byte-identical(플래그 게이팅). 스코프는 스캐폴드(init/quickstart)만.
- evidence:
  - src/commands/doc-templates.js#symbol:domainLinkList
  - src/commands/doc-templates.js#symbol:docMetadata
- caveats:
  - 265 tests·zero-dep·additive·1.0.0 계약 불변. 그래프 검증: index→overview·DOMAIN_FEATURES→per-domain inbound 확인, broken-link 0. `fix`-타임 재배선은 후속. 에이전트 편집이라 `needs_review` — 사람 검토 후 재승인 예정.

## 2026-07-22 - review: 1.20 누적분 코어 문서 verified 재승인 (human)

- status: verified
- actor: Dowon-Kim (사람 검토·승인) / 편집 적용 Claude Code
- scope: docs (frontmatter status/tags/reviewed_at)
- changed:
  - 내용 편집분 needs_review → verified: PUBLIC_API.md, ARCHITECTURE_CONVENTIONS.md, DOMAIN_FEATURES.md (1.16→1.20 누적 + P1·P2·P3 + get-doc --section·check-run·evidence tiers).
  - P1 드리프트 강등분 needs_review → verified(내용 불변, cli.js/mcp additive 변경): index.md, project-profile.md, EXAMPLES.md, domains/00_overview.md, profiles/library.md.
  - 버전-bump/소스 드리프트 verified 유지 + reviewed_at 갱신(내용 불변): README.md, releases/v0.1.7.md, releases/v0.1.8.md, RELEASE_FLOW.md, templates/DECISION_LOG.template.md, templates/TASK_PROMPT.template.md, VERSIONING.md, GLOSSARY.md.
- summary:
  - 유지관리자 검토 결정에 따라 1.20 누적 작업으로 needs_review/드리프트된 코어 문서 16개를 verified로 재승인(reviewed_by: Dowon-Kim, reviewed_at: 2026-07-22). package.json 버전 bump·소스 변경發 evidence.stale 전부 해소 → validate --strict 0.
- evidence:
  - package.json
- caveats:
  - 재승인 = 같은 날 검토라 evidence.stale 미발생. 다음 소스/버전 변경 시 다시 드리프트될 수 있음(정상). BENCHMARK.md는 이미 verified 유지.

## 2026-07-22 - feat(init): --domains 옵션 + no-domains 명시 안내 (외부 피드백 P3)

- status: needs_review
- actor: Claude Code
- scope: code(src/cli.js·commands.js·commands/domains.js) + tests + docs(PUBLIC_API·DOMAIN_FEATURES·CHANGELOG×2·log)
- changed:
  - src/cli.js: `--domains <a,b,c>` 옵션(defaultOptions·parseArgs 쉼표분해·COMMAND_OPTION_RULES init/quickstart·help 4곳).
  - src/commands/domains.js: `buildDomainContext(cwd, type, minimal, candidateSet, manualDomains=[])`로 확장 — 수동 도메인을 `{kind:"manual", sourceFile:null}`로 병합하고 `domainCapable` 플래그 반환. `planDomainDocs`는 빈 sourceFile을 건너뜀(수동 도메인은 source_files 빈 스캐폴드).
  - src/commands.js: `initCommand`이 `options.domains`를 전달하고, domainCapable인데 plans가 0이면 `domainNotice`(KO/EN)를 계산해 `initDryRun`/`initWrite`가 출력(silent no-op 제거).
  - tests/verification.test.js: no-domains 안내 + --domains per-domain 계획 테스트.
- summary:
  - `--type` 강제(또는 프론트) 프로젝트에서 도메인 부모를 못 찾으면 침묵하던 문제(P3) 해소 + `--domains`로 수동 지정. 실측: 프론트 fixture에서 안내 출력, `--domains hazards,jobs`로 01/02 계획·`--write` 생성 확인.
- evidence:
  - src/commands/domains.js#symbol:buildDomainContext
  - src/commands.js#symbol:initCommand
- caveats:
  - additive·zero-dep, 기존 backend/fullstack 동작 불변. 수동 도메인 문서는 source_files 빈 needs_review 스캐폴드(에이전트가 근거 채움). 미릴리스(1.20 후보).

## 2026-07-22 - fix(evidence): section 정렬 검사를 경로 기준으로 완화 (외부 피드백 P2)

- status: needs_review
- actor: Claude Code
- scope: code(src/commands/scans.js) + tests + docs(DOMAIN_FEATURES·log)
- changed:
  - src/commands/scans.js: `scanEvidenceSections`의 `evidence.section_unlisted` 매칭을 verbatim `section.text.includes(reference)`에서 경로 기준(`evidenceMentionedInSection`/`sectionMentionsPath`)으로 완화. frontmatter evidence를 `parseEvidenceReference`로 파싱해 로컬 참조는 본문이 같은 소스 경로를 언급하면 통과(경계 검사로 `.map` 등 오매칭 방지); 외부 `http(s)`/`repo:` 참조는 verbatim 유지.
  - tests/verification.test.js: section-alignment 두 테스트를 새 의미(경로 미언급만 unlisted)로 갱신 + `파일:60-70` 본문이 `파일#L60-L70` frontmatter를 만족하는 완화 케이스 추가.
- summary:
  - 외부 프로젝트 구축에서 46개 `evidence.section_unlisted` 경고를 유발한 형식 이중성(`#L` vs `:line`) 페이퍼컷 해소. 스키마 pattern은 이미 콜론-라인을 통과(hash 없는 경로로 매칭)해 스키마 변경(옵션 A)은 불필요했다.
- evidence:
  - src/commands/scans.js#symbol:scanEvidenceSections
  - src/commands/references.js#symbol:parseEvidenceReference
- caveats:
  - additive·zero-dep, 기존 `#L`/`#route:`/`#symbol:`/`#section:` 및 external 동작 유지. 미릴리스(main 한정).

## 2026-07-22 - feat(domains): frontend/mobile(SPA) 도메인 자동 탐지 (외부 피드백 P1)

- status: needs_review
- actor: Claude Code
- scope: code(src/commands/domains.js·commands.js) + tests + docs(DOMAIN_FEATURES·ARCHITECTURE·log)
- changed:
  - src/commands/domains.js: 신규 `detectFrontendDomains`(+`scanForFrontendDomains`·`parseRouteFile`·`firstRouteSegment`·`isFrontendSourceFile`·`isExcludedFrontendDomain`). `pages`/`views`/`features`/`modules`/`screens` 하위 1-depth 폴더와 vue-router/react-router 라우트 파일(`router.*`/`routes.*` 또는 `router/`·`routes/` 하위)의 최상위 라우트 그룹을 정규식으로 파싱(파서 의존성 없음). `FRONTEND_EXCLUDE_NAMES`로 SPA UI 배관(components/layouts/composables/assets 등) 제외.
  - `buildDomainContext`를 유형별 게이팅으로 리팩터: backend/fullstack→`detectDomainDirectories`(불변), frontend/mobile→`detectFrontendDomains`, 나머지→empty.
  - tests/verification.test.js: 프론트 폴더 탐지·라우트 파싱(vue+react)·백엔드 불변 가드 3개(`detectFrontendDomains`를 `src/commands/domains.js`에서 직접 import — commands.js 배럴은 미변경, 다수 verified 문서가 참조하는 commands.js의 불필요한 드리프트 회피).
  - drift: get-doc `--section`(0204176)이 cli.js/mcp/tools.js를 바꿔 드리프트된 verified 문서 5개(00_overview·EXAMPLES·index·profiles/library·project-profile)를 `drift --downgrade`로 needs_review 강등(내용 보존; validate --strict 0 회복).
- summary:
  - `csap-roadkeeper-frontend`(Vue3/Quasar) 실사용 피드백 최우선 항목(P1) 대응. 프론트/모바일 SPA에서 out-of-box 도메인 경험이 0이던 문제 해소. init --dry-run --type frontend에서 per-domain 문서(01_hazards 등) 계획 확인.
- evidence:
  - src/commands/domains.js#symbol:detectFrontendDomains
  - src/commands/domains.js#symbol:buildDomainContext
- caveats:
  - 백엔드/풀스택 탐지는 byte-identical(전용 스캐너·별도 제외 집합). additive·zero-dep·정규식만.
  - **미릴리스**(main 한정, npm 미반영). 다음 minor에서 버전 bump+태그로 배포 예정.
  - 외부 피드백 문서의 나머지 항목(P2 evidence DX ~ P7)은 후속.

## 2026-07-22 - feat(retrieval): get-doc --section 집중 읽기 + 벤치 재측정

- status: needs_review
- actor: Claude Code
- scope: code(src/commands/retrieval.js·cli.js·mcp/tools.js) + tests + docs(PUBLIC_API·log) + bench
- changed:
  - src/commands/retrieval.js: `getDocCommand`에 `--section <terms>` 집중 읽기 추가. 순수 `selectSections`가 본문을 `##` 레벨 섹션으로 나눠 terms 매치 상위 N(기본 3)개 섹션+프리앰블만 반환; `##` 섹션이 없거나 매치 없으면 full body로 fallback. 필터 시에만 additive `document.section` `{query,returned,total}` 부가(기본 출력 byte-identical).
  - src/cli.js: `--section` 옵션(defaultOptions·parseArgs·COMMAND_OPTION_RULES get-doc·help 2곳) 배선.
  - src/mcp/tools.js: `get_doc`에 `section` inputSchema + `buildToolOptions` 매핑. (API는 `normalizeOptions`가 defaultOptions 전파로 자동.)
  - tests/verification.test.js: get-doc --section 회귀 테스트(매치 섹션만 반환, 무매치 fallback, 기본 출력에 section 필드 없음).
  - docs/llm-wiki/PUBLIC_API.md: get-doc 행에 `--section` 등재(needs_review 강등).
  - bench/results/real-driver-pilot-claude-2026-07-22.md: B2-section 재측정 기록.
- summary:
  - 벤치가 지목한 "retrieval이 큰 문서 전문을 읽어 토큰이 비쌈" 문제 대응. `--section`으로 관련 부분만 읽게 함. 실측: 잘 구조화된 문서 −53%(PUBLIC_API), 거대 단일 섹션 문서 1~8%(DOMAIN_FEATURES·ARCHITECTURE).
  - **재측정(B2-section, N=1) 결론: 토큰 이득 불확정.** 에이전트가 실제 여는 문서가 거대-섹션이라 축소가 작고 N=1 변동(~±40%)이 효과를 삼킴. retrieval은 여전히 소스-only(B)보다 총 토큰이 많다. **README 토큰-절감 주장 계속 금지.**
- evidence:
  - src/commands/retrieval.js#symbol:getDocCommand
  - src/commands/retrieval.js#symbol:selectSections
- caveats:
  - additive·read-only·zero-dep·1.0.0 계약 불변; 기본(무 --section) 출력 불변. **미릴리스**(main 한정, npm 1.19.0엔 없음) — 다음 minor에서 버전 bump+태그로 배포 예정.
  - 거대-섹션 문서에 대한 후속: 문서 재구조화(작은 `##` 섹션) 또는 sub-section/bullet 단위 chunking, 또는 retrieval 가치를 "토큰 절감"이 아닌 "오리엔테이션+정확성"으로 규정.

## 2026-07-22 - fix(retrieval): search-docs가 append-only change log를 후순위로 강등

- status: needs_review
- actor: Claude Code
- scope: code(src/commands/retrieval.js) + tests
- changed:
  - src/commands/retrieval.js: `searchDocsCommand`이 append-only change log(`isAppendOnlyLog`=`docs/llm-wiki/log.md`, 또는 `doc_type: change_log`)를 다른 모든 매치보다 **후순위로 강등**하는 1차 정렬 키를 추가했다(제외 아님 — 여전히 반환). 순진한 출현-횟수 스코어러가 모든 키워드를 누적한 `log.md`를 대부분 질의에서 1위로 올리던 문제를 교정. 출력 형태 불변(내부 `deprioritized` 정렬 키는 반환 전 제거).
  - tests/verification.test.js: 회귀 테스트 추가(change log가 raw score는 더 높아도 참조 문서 아래로 랭크됨).
- summary:
  - option-B 드라이버 파일럿에서 드러난 retrieval 품질 결함 수정: `log.md`가 search-docs를 독식해 retrieval arm이 1위 결과를 건너뛰게 만들었다. 이제 참조 문서가 change log 위에 온다. 실측: `search-docs "mobile android detect"`에서 log.md 1위→4위, DOMAIN_FEATURES가 1위.
- evidence:
  - src/commands/retrieval.js#symbol:searchDocsCommand
  - src/commands/wiki-files.js#symbol:isAppendOnlyLog
- caveats:
  - 계약 불변(명령/인자/옵션/출력 형태 동일) — PUBLIC_API의 "점수순 랭크" 서술은 여전히 정확하므로 이 랭킹 정제만으로 verified 문서를 재강등하지 않았다.

## 2026-07-22 - review: 4개 코어 문서 verified 재승인 (human)

- status: verified
- actor: Dowon-Kim (사람 검토·승인) / 편집 적용 Claude Code
- scope: docs (frontmatter status/tags/reviewed_at + Review Notes)
- changed:
  - docs/llm-wiki/PUBLIC_API.md: needs_review → verified (1.16.0→1.19 명령 표면 누적분).
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md: needs_review → verified (1.16.0→1.19; dogfood 재생성 방법 정정 노트 포함).
  - docs/llm-wiki/DOMAIN_FEATURES.md: needs_review → verified (1.16.0→1.19).
  - docs/llm-wiki/BENCHMARK.md: needs_review → verified (최초 승격; Gate 22 베이스라인 + Gate 24 재측정 + B2 델타).
- summary:
  - 유지관리자 검토 결정에 따라 4개 코어 문서를 verified로 승격했다. 각 frontmatter를 status: verified·reviewed_by: Dowon-Kim·reviewed_at: 2026-07-22로 갱신하고 Review Notes에 재승인 근거를 남겼다.
- evidence:
  - src/commands.js
  - src/cli.js
  - bench/run.js
- caveats:
  - BENCHMARK.md의 모든 수치는 chars/4 프록시다 — README/런치 토큰·속도 수치 주장은 실측(`bench/real/`) 전까지 계속 금지.

## 2026-07-22 - release: 1.19.0 배포 + dogfood/PUBLIC_API 후속

- status: needs_review
- actor: Claude Code
- scope: release + code(dogfood skills) + repo hygiene + docs(PUBLIC_API·log)
- changed:
  - 배포: 야간 자율 10개 커밋 push + `v1.19.0` 태그 → CI Trusted Publishing로 npm 배포(latest=1.19.0) + GitHub Release. Gate 25(evidence 의미 단계화)+Gate 26(check-run) 번들.
  - .claude/skills·.cursor/rules·.llm-wiki/prompts: 커밋된 dogfood 스킬 9개를 `init --write --skills`로 재생성 — Gate 26 완성 계약(run manifest→check-run)을 본문에 포함(과거 아티팩트는 Gate 21 시점이라 누락). writeSkillArtifacts가 미덮어씀이라 삭제 후 재생성; docs/llm-wiki 미변경.
  - .gitignore(신규): node_modules·`.llm-wiki/runs/`(에이전트 작성 run manifest)·`bench/real/agent.js`(실-LLM 벤치 드라이버).
  - docs/llm-wiki/PUBLIC_API.md: 야간 Gate 25/26 커밋이 놓친 명령 표면 갭 보강 — `check-run [--run <path>] [--strict]` 행, `--run` 옵션, `stats` JSON `evidenceTiers`, Evidence·frontmatter `checkRunCommand`.
- summary:
  - 1.19.0을 npm에 배포하고, 커밋된 dogfood 스킬이 Gate 26 계약을 담도록 재생성했으며, 저장소 위생(.gitignore)과 PUBLIC_API 문서 동기화 갭을 메웠다.
- evidence:
  - package.json
  - src/commands.js#symbol:checkRunCommand
  - src/commands/skills.js#symbol:artifactBody
- caveats:
  - PUBLIC_API.md는 에이전트 편집이라 needs_review 유지 — ARCHITECTURE_CONVENTIONS·DOMAIN_FEATURES·BENCHMARK와 함께 사람 재검토(verified 승격)가 필요하다.
  - README token/speed 수치 주장은 여전히 금지(−80% B2 델타는 chars/4 프록시이지 실제 LLM 실행이 아님).

## 2026-07-21 - feat: Gate 26 agent update runner + 완성 계약 (accepted[위임, 야간 자율]+built)

- status: needs_review
- actor: Claude Code (야간 자율 루프; 게이트 수용은 Dowon-Kim 위임)
- scope: code(src/commands.js·findings.js·cli.js·index.js·commands/skills.js) + tests + docs(GATE_REVIEW·ARCHITECTURE·DOMAIN_FEATURES·log)
- changed:
  - src/commands.js: read-only `checkRunCommand`(+ docSourceAnchors/checkRunValidated/finishCheckRun) — `.llm-wiki/runs/`의 최신/`--run` manifest로 스킬 실행 파이프라인 검증.
  - src/commands/findings.js: `run.*` 5개 rule 등록(doc_gap/log_missing/unvalidated warning, manifest_missing warning, manifest_invalid error).
  - src/cli.js·src/index.js: `check-run` 명령·`--run` 옵션·help·동결 API 맵 배선(command-set 단언 갱신).
  - src/commands/skills.js: `artifactBody`에 Gate 26 완성 계약 섹션(run manifest 작성→check-run) 내장(backtick-free).
  - GATE_REVIEW.md: Gate 26 accepted + Resolved/Built 절. ARCHITECTURE_CONVENTIONS·DOMAIN_FEATURES: Evidence/기능/Review Notes.
- summary:
  - Gate 21 스킬 워크플로를 감사 가능하게: 실행이 run manifest를 남기고 `check-run`이 changedSource↔touchedDocs 참조·로그 append·validate를 검증 → CI가 "코드 바꾸고 위키 안 고친" 실행을 잡는다. Gate 23 `impact`(diff-앵커)의 intent-앵커 보완.
  - 수용 결정(위임): 독립 `check-run`, 에이전트가 매니페스트 작성(도구는 read-only), `.llm-wiki/runs/` git-ignore, file-level 매칭, `impact`와 분리, `--strict` CI 실패.
  - 254 tests pass, `validate --strict` 0 findings.
- evidence:
  - src/commands.js#symbol:checkRunCommand
  - src/commands/skills.js#symbol:artifactBody
- caveats:
  - **커밋된 dogfood 스킬 아티팩트(.claude/.cursor/.llm-wiki)는 미덮어씀 규율상 자동 갱신 안 됨** — 아침에 `init --write --skills --existing overwrite`(또는 삭제 후 재생성)로 완성 계약을 반영할 것. v1은 스킬 주도 실행만; 매니페스트는 에이전트가 작성. 릴리스(버전 bump·태그)는 별도 승인. 에이전트 편집이라 needs_review.

## 2026-07-21 - feat: Gate 25 evidence 의미 단계화 (accepted[위임]+built)

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시 — "수용 + 지금 빌드"; 게이트 수용은 위임)
- scope: code(src/commands/scans.js·findings.js·commands.js) + tests + docs(GATE_REVIEW·ARCHITECTURE·DOMAIN_FEATURES·ROADMAP·log)
- changed:
  - src/commands/scans.js: `scanEvidenceReferences`에 `#symbol:`/`#section:` 타깃 실재 보수적 검사 추가(`evidence.symbol_unverified`/`evidence.section_unverified`; `·`-결합 심볼 목록·`.md` 섹션만·`readTextAuto` BOM 인식) + 신규 `scanUngroundedVerified`(`evidence.ungrounded`) + 순수 `evidenceTier`·`EVIDENCE_REFERENCE_RULES`.
  - src/commands/findings.js: 3개 rule 등록(FINDING_EXPLANATIONS; 모두 evidence 카테고리·warning).
  - src/commands.js: audit·validate에 `scanUngroundedVerified` 배선, `statsCommand`에 `evidenceTiers` 계산·노출, 배럴 re-export(`evidenceTier`/`scanUngroundedVerified`).
  - tests/verification.test.js: symbol/section flag-vs-not+`--strict`, `evidence.ungrounded`(warning·미승격·config off/escalate), `evidenceTier` 축, `stats` tier 표면(4개 신규 테스트).
  - GATE_REVIEW.md: Gate 25 accepted + Resolved/Built 절. ARCHITECTURE_CONVENTIONS·DOMAIN_FEATURES: Module Layout/기능/Evidence/Review Notes. ROADMAP(.ko): Gate 25 accepted+built.
- summary:
  - product-identity 감사가 지목한 "evidence가 FORMAT만 검사(심볼/섹션 실재 미확인)·grounding 없는 verified 허용" 갭을 닫는다. 모두 additive·read-only·zero-dep·기본 error 아님, `1.0.0` 계약·frontmatter/status 불변.
  - 수용 결정(위임): `evidence.ungrounded` 기본 warning, section `.md`만, tier 계산전용, `--strict`는 `*_unverified`만 승격.
  - 251 tests pass, `validate --strict` 0 findings(청결 dogfood: 50/50 reference_checked, 14/50 human_verified).
- evidence:
  - src/commands/scans.js#symbol:scanEvidenceReferences
  - src/commands/scans.js#symbol:scanUngroundedVerified
  - src/commands/scans.js#symbol:evidenceTier
- caveats:
  - symbol/section 검사는 텍스트 존재 floor이지 AST 해석이 아니다(오탐 회피 위한 보수성). 진짜 심볼 해석·`route` 실재는 v1 제외. 릴리스(버전 bump·태그)는 별도 승인 단계. 에이전트 편집이라 needs_review.

## 2026-07-21 - bench: B2_retrieval arm 추가 — retrieval 델타 측정(드리프트 상쇄)

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시 — "다음 작업 진행")
- scope: bench (코드+메타) + docs (BENCHMARK·ROADMAP·log) — src/·shipped 계약 미변경(bench는 npm files 밖)
- changed:
  - bench/lib/strategies.js: 다섯 번째 arm `strategyWikiRetrieval`(B2) 추가 — `search-docs`(retrieval.js와 동일 스코어링) + 상위 매칭 문서 본문 `get-doc`; append-only log는 검색은 되나 get-doc 제외; frontmatter 파서·occurrences·snippet 헬퍼.
  - bench/run.js: B2를 세션 집계·per-task 표·세션 뷰·정직 verdict·markdown·`--against` 비교에 배선. 기본 write 대상을 `current.{json,md}`로 변경(`baseline.{json,md}`는 before-retrieval 기준으로 frozen).
  - bench/tasks.json: 공개 파라미터 `retrievalGetDocs`(기본 2) 추가.
  - bench/README.md · bench/METHODOLOGY.md: B2 arm·B2-vs-B(드리프트 상쇄)·log 제외·top-K·success=grounding 프록시·§9 재현(출력 파일명) 문서화.
  - docs/llm-wiki/BENCHMARK.md: "B2 retrieval 델타" 절 추가(측정 완료); frontmatter source_files/evidence·Evidence 절 갱신.
  - ROADMAP.md · ROADMAP.ko.md: Gate 22 status에 "Retrieval 델타 측정 완료" 문단.
- summary:
  - raw `--against` 재측정이 코퍼스 드리프트만 보여준 문제를 풀기 위해 Gate 24 메커니즘을 직접 모델링한 `B2_retrieval`을 추가했다: 소스 재독 대신 위키를 질의(search-docs)하고 상위 매칭 **문서 본문**을 get-doc.
  - **B2와 B는 같은 코퍼스에서 돌아 `B2 vs B`가 드리프트를 상쇄하고 메커니즘만 분리**한다: **B2 = B의 0.19×(−81.5%)**, **A2(보수적 하한)의 0.19×(−80.5%)** — pre-retrieval B가 A2 대비 갖지 못했던 이점 — , **grounding success 100%**(민감도: K=1에서도 100%, 토큰 이점은 더 큼).
  - 247 tests pass, validate --strict 0 findings, validate-frontmatter 0.
- evidence:
  - bench/lib/strategies.js#symbol:strategyWikiRetrieval
  - bench/run.js
  - bench/results/current.md
- caveats:
  - B2의 success는 **grounding 프록시**(위키가 올바른 코드를 가리킴)이지 소스를 안 열고 편집 완료한다는 뜻이 아니다. 결정적 `chars/4` 프록시·단일 자기참조 레포·top-K 순진 랭킹 한계는 METHODOLOGY §8 그대로.
  - **README/런치 token·속도 주장은 여전히 금지** — 실제 LLM 실측 전까지. 에이전트 편집이라 needs_review.

## 2026-07-21 - bench: Gate 24 후 재측정 기록 (정직하게 불리 — 드리프트, 메커니즘 아님)

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시 — "벤치 재측정")
- scope: docs (BENCHMARK·ROADMAP·log) — **코드 미변경**, 벤치 결과 파일 미변경(--against는 write 안 함)
- changed:
  - docs/llm-wiki/BENCHMARK.md: "Gate 24 재측정" 섹션 추가(baseline 대비 이동표 + 정직 해석).
  - ROADMAP.md · ROADMAP.ko.md: Gate 22 status에 재측정 결과 + 후속(`B2_retrieval`) 문단.
- summary:
  - 1.18.0(Gate 24 retrieval) 배포 후 `node bench/run.js --against bench/results/baseline.json` 재측정. baseline.json(=Gate 22 "before")은 덮어쓰지 않음.
  - **결과(정직·불리):** `B vs A2`가 0.89×(−11%)→**1.05×(+5.3%)**로 역전(보수적 snippet-grep 하한 대비 위키가 이제 더 비쌈). `B vs A1`은 0.59×→0.69×. 위키 코퍼스 성장(47→50문서)으로 전략 B의 대상 소스 통독이 늘어난 결과.
  - **핵심:** 이 재측정은 retrieval **메커니즘이 아니라 코퍼스 드리프트**를 잰 것. harness의 전략 B는 대상 소스를 통독할 뿐 Gate 24의 `get_doc`/`search_docs`를 호출하지 않는다 → 로드맵이 원한 "retrieval 전/후 델타"를 아직 못 만든다. 진짜 델타는 retrieval-aware 전략(`B2_retrieval` — 소스 재독 대신 매칭 위키 문서 본문 읽기)을 모델링해야 하며, 그게 다음 bench 작업.
- caveats:
  - README/런치 token·속도 주장은 **여전히 금지**(보수적 하한 대비 현재 불리). 벤치 결과 파일(baseline.{json,md})은 불변 — "before" 기준 보존. 에이전트 편집이라 needs_review.

## 2026-07-21 - release: prepare 1.18.0 (Gate 24 read-only retrieval)

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시 — "다음 작업 진행")
- scope: release, docs
- changed:
  - package.json (1.17.0→1.18.0), tests/verification.test.js(버전 assertion 1.17.0→1.18.0)
  - CHANGELOG.md / CHANGELOG.ko.md (1.18.0 항목: retrieval 4개 명령 Added + Safety)
  - docs/llm-wiki/releases/v1.18.0.md (신규 이중언어 릴리스 노트)
  - ROADMAP.md / ROADMAP.ko.md (Gate 24 `accepted`→"**Status: shipped in 1.18.0**")
- summary:
  - 직전 feat 커밋(5ef75a7)이 버전 미범프 순수 기능 커밋이라, feat→release-prep→배포 리듬의 release-prep 단계를 채웠다. Gate 24 read-only retrieval(`list-docs`/`search-docs`/`get-doc`/`get-related`)를 1.18.0으로 준비. 코드 동작 불변 — feat 커밋에서 이미 구현/테스트됨.
  - **247 tests pass, validate result:pass 0 findings, validate-frontmatter --strict pass.**
- caveats:
  - 실제 배포(태그 `v1.18.0` push → CI Trusted Publishing)는 사용자의 명시적 "배포" 지시 대기. main 커밋/푸시는 준비 단계.
  - 배포 후: (1) Gate 22 벤치 재측정(`node bench/run.js --against`)으로 헤드라인 before/after-retrieval delta 산출, (2) doc-sync로 needs_review인 PUBLIC_API·ARCHITECTURE_CONVENTIONS·DOMAIN_FEATURES 사람 재검토→verified.

## 2026-07-21 - feat: Gate 24 read-only retrieval (list/search/get-doc/get-related, 1.18.0) 구현

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시 — "다음 작업 진행")
- scope: src + tests + docs
- changed:
  - src/commands/retrieval.js(신규): read-only 4개 핸들러 `listDocsCommand`/`searchDocsCommand`/`getDocCommand`/`getRelatedCommand` + 헬퍼(loadContentDocs·isRestrictedOrSensitive·redactSensitive·필터·스니펫/스코어·경로 해석). `listWikiContentDocs`·`parseFrontmatter`·`collectWikiGraph`·`scanSensitiveInfo` 재사용.
  - src/commands.js: 4개 배럴 re-export. src/index.js: 동결 commands 맵 4개 kebab 키 + 개별 export + Options typedef(query/docPath/status/visibility/docType/includeSensitive/limit).
  - src/cli.js: COMMANDS 4개, defaultOptions 7개 필드, parseArgs 플래그(`--status`/`--visibility`/`--doc-type`/`--include-sensitive`/`--limit`)·positional(search `<query>`/get `<path>`)·필수 인자 검증·COMMAND_OPTION_RULES·helpText usage·COMMAND_HELP·Safety.
  - src/mcp/tools.js: TOOL_DEFS 4개(snake_case `list_docs`/`search_docs`/`get_doc`/`get_related`) + buildToolOptions 매핑. src/mcp/dispatch.js: initialize instructions 갱신.
  - tests: verification.test.js(+6: list 제외/포함·필터·search 랭크/제외/redact/AND·get-doc redact/not_found·get-related·parseArgs; 동결 맵 기대값 4개 추가), mcp.test.js(+2: buildToolOptions retrieval 매핑·tools/call get_doc 본문).
  - docs: PUBLIC_API·ARCHITECTURE_CONVENTIONS·DOMAIN_FEATURES 동기화(→needs_review), GATE_REVIEW Gate 24 Evidence를 "planned"→"shipped".
- summary:
  - 거버넌스 리포트가 아니라 문서 **본문**을 반환하는 첫 표면(런치에서 철회한 "에이전트가 위키를 query" 스토리의 실체). `search-docs`는 zero-dep 키워드/부분문자열(AND, 점수 랭크; semantic 아님). 안전 불변식: 읽기 전용, restricted/민감 문서는 list/search 기본 제외(opt-in `--include-sensitive`), 반환 본문/스니펫은 sensitive-info 스캔으로 민감 라인 redact(raw 미반환).
  - **239→247 tests(+8) pass, validate result:pass 0 findings, validate-frontmatter --strict pass.** 4개 명령 CLI 스모크 + 픽스처로 민감 제외/redaction end-to-end 확인. MCP tools/list 14개(10+4).
- caveats:
  - v1은 키워드 검색(semantic/vector·인덱스·전체본문 검색 opt-in 플래그는 범위 밖). 버전 미범프(1.17.0 유지) — 릴리스 준비(1.18.0)는 별도 단계. 에이전트 편집이라 needs_review — 사람 검토 후 verified.

## 2026-07-21 - gate: Gate 24 (읽기 전용 retrieval search/get) 수락 (accepted_for_1.18.0)

- status: needs_review
- actor: Dowon-Kim (게이트 수락) · 기록 Claude Code
- scope: docs (gate-review, roadmap) — **코드 미변경**
- changed:
  - GATE_REVIEW.md: Gate 24 표 행 `proposed_for_next`→`accepted_for_1.18.0` + Scope Decision 헤더/오프닝을 accepted로, "Open questions"→"Resolved at acceptance"(4개 결정).
  - ROADMAP.md · ROADMAP.ko.md: Gate 24 상태 문단을 "accepted for 1.18.0"로 갱신.
- summary:
  - Dowon-Kim이 Gate 24(읽기 전용 retrieval)를 `accepted_for_1.18.0`으로 수락했다. 수락 시 오픈 질문을 제안 기본값으로 확정: (1) `list_docs`/`search_docs`/`get_doc`/`get_related`를 그 이름 그대로 API+MCP+CLI 3표면에 제공, (2) restricted/민감 문서는 list/search 기본 제외(opt-in 포함), `get_doc`은 민감값 redact, (3) `search_docs`는 기본 스니펫(전체 본문은 opt-in/`get_doc`), (4) 키워드/부분문자열만 — semantic/vector 없음(zero-dep).
  - 다음 단계: 코드 구현(1.18.0). 단, 준비된 1.17.0을 먼저 배포한 뒤 착수.
- caveats:
  - 수락 단계까지만 — 아직 코드/테스트 변경 없음. 1.0.0 계약·zero-dep 불변. 구현은 1.17.0 배포 후.

## 2026-07-21 - gate: Gate 24 (읽기 전용 retrieval search/get) 초안 — proposed, 미수락

- status: needs_review
- actor: Claude Code (초안 작성; 수락은 사람 Dowon-Kim)
- scope: docs (gate-review, roadmap) — **코드 미변경**
- changed:
  - GATE_REVIEW.md: Gate 24 표 행(`proposed_for_next` DRAFT) + "Read-Only Retrieval (Search/Get) Scope Decision" 섹션(proposed — 미수락) 추가.
  - ROADMAP.md · ROADMAP.ko.md: Gate 24 섹션에 "drafted — proposed, not yet accepted" 상태 문단 추가.
- summary:
  - post-1.16 measure-first 라인의 다음 게이트(측정→reverse-impact→**retrieval**). 제품 정체성 감사가 철회하게 한 런치 주장("에이전트가 위키를 query / 프로젝트 메모리")을 참으로 만드는 조각. 현재 모든 명령·MCP 툴은 거버넌스 **리포트**만 반환하고 문서 본문은 반환하지 않는다(`src/mcp/tools.js`) — 이 갭을 채운다.
  - 읽기 전용 4개 연산: `list_docs`(status/visibility/type 필터 열거), `search_docs`(**zero-dep 키워드/부분문자열 — 정직하게 semantic/vector 아님**), `get_doc`(frontmatter+본문), `get_related`(그래프 이웃). `listWikiContentDocs`·frontmatter 파서·`collectWikiGraph` 재사용. MCP+프로그래매틱 API(+CLI) 표면. **여기서 Gate 22 하니스를 재측정** — 헤드라인 before/after-retrieval delta가 나오는 지점.
  - 불변식: 읽기 전용·zero-dep(임베딩/인덱스/네트워크 없음)·additive·`visibility` 존중 + sensitive-info 스캔 재사용(raw 민감값 미반환)·쓰기 표면 없음. MINOR(`1.18.0`) 예상.
- caveats:
  - **코드 전 초안**: 저장소 규율상 사람 수락 후 빌드. Evidence 심볼(`listWikiContentDocs`·`collectWikiGraph`·`parseFrontmatter`·`scanSensitiveInfo`·`TOOL_DEFS`·`commands`) 실존 확인. Open questions(툴 이름·CLI 패리티 v1 필수 여부·restricted 문서 기본 처리·본문 반환 여부)는 수락 시 결정.

## 2026-07-21 - release: prepare 1.17.0 (Gate 23 reverse-impact)

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시 — "다음 추천작업 진행")
- scope: release, docs
- changed:
  - package.json (1.16.1→1.17.0), tests/verification.test.js(버전 assertion 1.16.1→1.17.0)
  - CHANGELOG.md / CHANGELOG.ko.md (1.17.0 항목: `impact` 명령 Added + Internal `verifiedSourceAnchors`)
  - docs/llm-wiki/releases/v1.17.0.md (신규 이중언어 릴리스 노트)
  - ROADMAP.md / ROADMAP.ko.md (Gate 23 `drafted`→`accepted for 1.17.0` + "**Status: shipped in 1.17.0**" 문단)
- summary:
  - 직전 feat 커밋(07d4383)이 버전 미범프 순수 기능 커밋이라, 저장소 리듬(feat → release-prep → 배포)의 release-prep 단계를 채웠다. Gate 23 reverse-impact(`impact` 명령)를 1.17.0으로 준비. 코드 동작 불변 — feat 커밋에서 이미 구현/테스트됨.
  - **239 tests pass, validate result:pass 0 findings, validate-frontmatter --strict pass.** `impact`(clean tree=no-op) / `impact --since HEAD~1`(변경 소스 참조 verified 문서 flag, result:warning) CLI 스모크 확인.
- evidence:
  - package.json
  - CHANGELOG.md
- caveats:
  - 실제 배포(태그 `v1.17.0` push → CI Trusted Publishing)는 사용자의 명시적 "배포" 지시 대기. main 커밋/푸시는 준비 단계.
  - feat 커밋에서 doc-sync로 needs_review로 강등된 PUBLIC_API·ARCHITECTURE_CONVENTIONS·DOMAIN_FEATURES는 배포 후 사람 재검토로 verified 재승인 필요.

## 2026-07-21 - feat: Gate 23 reverse-impact (`impact` 명령, 1.17.0) 구현

- status: needs_review
- actor: Claude Code (사용자 승인·수락 위임; 게이트 수락자 Dowon-Kim)
- scope: src + tests + docs
- changed:
  - GATE_REVIEW.md: Gate 23 `proposed_for_next`→`accepted_for_1.17.0`(open questions 해소: 독립 `impact` 명령·`impact.source_changed`·`--strict`는 impact만·빈 집합 no-op).
  - src/commands/scans.js: 순수 `verifiedSourceAnchors` 추출(driftTargets가 델리게이트 — 동작 보존) + diff-앵커 `scanReverseImpact`.
  - src/commands.js: read-only `impactCommand`(`changedFiles` 변경집합 + `scanReverseImpact`).
  - src/commands/findings.js: `impact.source_changed`(warning, toggleable)·`impact.unavailable`(error) 레지스트리 등록.
  - src/cli.js: `impact` COMMANDS/옵션 규칙(`--since`/`--strict`)/usage/COMMAND_HELP. src/index.js: 동결 commands 맵 + 개별 export.
  - tests/verification.test.js: impact 7종(working-tree flag/미변경 제외/같은 diff 미flag/`--since`/no-op/config escalation/no-git unavailable/parseArgs) + 명령셋 기대값 갱신.
  - docs/llm-wiki: PUBLIC_API·ARCHITECTURE_CONVENTIONS·DOMAIN_FEATURES 동기화(→needs_review).
- summary:
  - date-앵커 `evidence.stale`(drift)이 놓치는 "코드·문서 별도 PR" 케이스를 잡는 **diff-앵커 pre-merge** 체크. 변경집합(working tree 또는 `--since <ref>`)에 든 소스를 참조하나 문서 자신은 안 바뀐 `verified` 문서를 flag. 기존 `changedFiles`(`validate --changed` 재사용)·`verifiedSourceAnchors`(drift와 공유) 재사용이라 대부분 배선.
  - **229→239 tests(+10) pass, validate 0 findings.** 이 커밋 자체에 `impact`를 돌려 변경 소스를 참조하는 verified 문서 9개가 flag됐고, 그중 실질 3개(PUBLIC_API/ARCHITECTURE/DOMAIN_FEATURES)를 동기화했다(나머지는 broad `src/cli.js` 앵커의 file-level 오버플래그로 판단, 내용 불변).
- caveats:
  - v1은 file-level(line-level·per-doc `reviewed_sha`·write/downgrade·MCP 노출은 out of scope). read-only·additive·zero-dep·1.0.0 계약 불변. 에이전트 편집이라 needs_review — 사람 검토 후 verified. 배포는 별도 승인 후.

## 2026-07-21 - gate: Gate 23 (변경소스 → 위키 reverse-impact) 초안

- status: needs_review
- actor: Claude Code (초안 작성; 수락은 사람 Dowon-Kim)
- scope: docs (gate-review) — **코드 미변경**
- changed:
  - GATE_REVIEW.md: Gate 23 표 행 + "Reverse-Impact (Changed-Source → Wiki) Scope Decision" 섹션을 `proposed_for_next`(DRAFT — 미수락)로 추가.
  - ROADMAP.md · ROADMAP.ko.md: Gate 23 섹션에 "drafted — proposed, not yet accepted" + 재사용 프리미티브 명시.
- summary:
  - 감사가 지목한 최대 비전-현실 간극(날짜 기반 drift가 코드·문서 별도 PR 케이스를 놓침)에 대응하는 **diff-앵커 reverse-impact** 초안. 기존 date-앵커 `evidence.stale`의 **pre-merge 보완**: 변경집합(working-tree 또는 `--since <ref>`)에 든 코드를 참조하는 `verified` 문서가 같은 diff에서 변경되지 않았으면 flag. 신규 read-only `impact` 명령(또는 `drift --since` 모드), 신규 toggleable `impact` 카테고리(기본 warning), opt-in `--strict`로 CI 실패. 기존 `changedFiles`(src/git.js)·`driftTargets`·참조 파서 재사용이라 대부분 배선.
- caveats:
  - **코드 전 초안**: 저장소 규율상 사람 수락 후 빌드. v1은 file-level(line-level·per-doc `reviewed_sha`·write/downgrade·MCP 노출은 out of scope). 부가적·opt-in·zero-dep·1.0.0 계약 불변. 수용 시 open questions(명령 형태·rule 이름·`evidence.stale`도 strict 승격할지) 결정.

## 2026-07-21 - feat: Gate 22 벤치마크 하니스 + 베이스라인 구축

- status: needs_review
- actor: Claude Code (사용자 승인 작업)
- scope: bench (repo-내부 검증 트랙) + docs
- changed:
  - bench/: zero-dep·repo-내부 harness 신설(npm `files` allowlist 밖이라 미배포). `run.js`(오케스트레이터·4 arm·세션 집계·자동 verdict·베이스라인 기록), `lib/{tokens,fs-walk,strategies}.js`, `tasks.json`(대표 태스크 6개, cold 키워드), `README.md`·`METHODOLOGY.md`, `results/baseline.{json,md}`.
  - docs/llm-wiki/BENCHMARK.md: 신규 거버넌스 기록(needs_review) — 베이스라인 헤드라인·한계·규율.
  - ROADMAP.md · ROADMAP.ko.md: Gate 22 `proposed`→`accepted` + 베이스라인 링크·헤드라인 반영.
- summary:
  - 대표 질문 6개에 답하는 데 필요한 입력 컨텍스트를 4방식(A0 whole-repo·A1 grep-full·A2 grep-snippet 보수적 하한·B wiki-grounded)으로 측정. B의 대상 파일은 위키 본문에서 파생(비순환). 세션 단위 B는 A1의 0.59×(−41%)·A2의 0.89×(−11%)·A0의 0.46×.
  - **정직한 불리 결과 보고:** 보수적 A2 대비 단일 태스크 3/6에서 위키가 더 비싸고(오리엔테이션 오버헤드), 탐색 성공률은 100%/100% 동률 — 즉 입증된 이점은 findability가 아니라 컨텍스트 크기이며 멀티-태스크 분할상환에 의존.
- evidence:
  - bench/run.js
  - bench/results/baseline.md
- caveats:
  - chars/4 프록시(절대값 근사·비율 견고), 벽시계·답변 품질·위키 유지비용 미모델링. 단일 자기참조 레포. 헤드라인은 retrieval(Gate 24) 전후 delta. 에이전트 작성이라 needs_review — 사람 검토 후 verified. README token/속도 주장은 측정 뒷받침 전까지 금지.

## 2026-07-21 - gate: Gate 22 (Impact Measurement) 수락

- status: needs_review
- actor: Dowon-Kim (게이트 수락) · 기록 Claude Code
- scope: docs (gate-review)
- changed:
  - GATE_REVIEW.md: Gate 22 표 행 + Scope Decision을 `proposed`→`accepted`(Accepted by Dowon-Kim 2026-07-21)로 갱신.
- summary:
  - 제품 정체성 감사(Conditional Go)의 measurement-first 판단에 따라, 벤치마크 하니스 + baseline 구축을 다음 작업으로 수락. 검증 트랙(shipped 계약 변경 없음·zero-dep). 실제 빌드는 사용자 요청대로 context /clear 후 착수 예정.
- caveats:
  - 불리한 결과도 정직 보고. 헤드라인 숫자는 retrieval(Gate 24) 전후 delta. README token/속도 주장은 측정 뒷받침 전까지 금지.

## 2026-07-21 - roadmap: post-1.16 계획(측정 우선) + Gate 22 초안 + 제목 정리

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시 — "문서 현행화 확인 후 로드맵 작성; a안 = 측정을 Gate 22로 앞당김")
- scope: docs (roadmap, gate-review, 제목)
- changed:
  - GATE_REVIEW.md: Gate 22(Impact Measurement) 표 행 + 상세 Scope Decision(proposed — NOT accepted) 추가; 제목 "…Standard Package Gate Review"→"…Governance…"
  - ROADMAP.md + ROADMAP.ko.md: "Release Plan (post-1.16)" 추가 — 측정 우선 순서(Gate 22 측정 → 23 reverse-impact → 24 retrieval → 25 evidence tiers → 26 agent runner) + 1.15–1.16 shipped 요약; 제목→Governance (EN/KO 쌍 동기화)
  - RELEASE_CHECKLIST.md, VERIFICATION.md: 제목 "…Standard Package …"→"…Governance…"
- summary:
  - 문서 현행화 확인(validate/strict/drift 0, repo pkg==npm latest 1.16.1) 후, 제품 정체성 감사(`outputs/audits/product-identity-audit.md`, Conditional Go)의 Top-5를 게이트로 배열. 사용자 선택(a): 측정(감사 #5)을 "주장의 전제"로 보고 Gate 22로 앞당김 — 단발 게이트가 아니라 계측 트랙(baseline now, retrieval[Gate 24] 후 delta가 헤드라인).
  - 개명 완결: "LLM-WIKI Standard" 제목 잔여 4건(ROADMAP/GATE_REVIEW/RELEASE_CHECKLIST/VERIFICATION)을 Governance로 교정. fixtures·역사 기록(CHANGELOG/log 본문)은 의도적으로 유지.
- caveats:
  - Gate 22~26은 proposed/draft — 사람 수락 전. Gate 22만 상세 Scope Decision 작성, 23~26은 ROADMAP에 계획으로만(코드 전 게이트 규율).

## 2026-07-21 - release: prepare 1.16.1 (1.16.0 개명 후속 정리 + 첫 TP 자동배포)

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시 — "1.16.1 릴리스 준비 진행")
- scope: docs, config, tests
- changed:
  - package.json (1.16.0→1.16.1), tests/verification.test.js(버전 assertion), CHANGELOG.md/CHANGELOG.ko.md(1.16.1 항목), docs/llm-wiki/releases/v1.16.1.md(신규)
  - (앞선 커밋 55b283f의 README H1·CONTRIBUTING·schema `$id`·keywords 정리를 스토어프론트에 반영하기 위한 릴리스)
- summary:
  - 1.16.0을 새 이름 첫 배포로 수동 publish한 뒤, npm 페이지(README)가 여전히 옛 "LLM-WIKI Standard" 제목을 보여줘 이를 교정하고 정체성/포지셔닝 잔여 정리를 스토어프론트에 반영하기 위해 1.16.1로 릴리스. 코드 동작 불변.
  - 태그 `v1.16.1` push 시 CI가 Trusted Publishing으로 자동 배포(+provenance)하는 **첫 정상 자동배포** — 1.16.0의 수동 publish 절차 불필요.
- evidence:
  - package.json
  - README.md
- caveats:
  - 실제 배포(태그 `v1.16.1` push)는 사용자 "배포" 시 진행. main 커밋/푸시는 준비 단계.

## 2026-07-21 - review: 1.16.0 rename+flip 문서 13개 사람 검토 → verified 재승인

- status: verified
- actor: Dowon-Kim (사람 검토·승인) · 편집 Claude Code
- scope: docs (frontmatter status)
- changed:
  - needs_review→verified 재승인(reviewed_by: Dowon-Kim, reviewed_at: 2026-07-21): index, project-profile, PUBLIC_API, GLOSSARY, domains/00_overview, docs/llm-wiki/README, ARCHITECTURE_CONVENTIONS, DOMAIN_FEATURES, EXAMPLES, VERSIONING, VISIBILITY, RELEASE_FLOW, profiles/library (13개). EXAMPLES·VISIBILITY는 reviewed_at도 오늘로 refresh.
- summary:
  - 1.16.0 개명 + English-first flip + docs-sync로 needs_review로 강등됐던 13개 문서를 사람이 diff 요약 검토 후 전부 승인 → verified 재승인. 개명 이후 위키 전체가 `llm-wiki-governance`로 정합·verified 상태가 됐다.
- caveats:
  - `log.md`·`releases/v1.16.0.md`는 관례상 `needs_review` 유지(승격 대상 아님).

## 2026-07-21 - docs-sync: /llm-wiki-docs-sync (rename 완결 — 잔여 verified 4문서 project: 라벨)

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim이 `/llm-wiki-docs-sync` 스킬로 실행 — 1.16.0 dogfood)
- scope: docs (frontmatter only)
- changed:
  - docs/llm-wiki/VERSIONING.md · VISIBILITY.md · RELEASE_FLOW.md · profiles/library.md: `project: llm-wiki-standard`→`llm-wiki-governance` + `status: verified`→`needs_review`(LLM 편집 규율). 본문 불변(메타데이터 라벨만; VISIBILITY는 last_updated도 07-16→07-21, library는 last_edited_by Codex→Claude Code).
- summary:
  - 1.16.0 개명 후 잔여 정합성 점검. 도구 자신의 `drift`(0 drifted) + `validate`(0 findings)로 의미적·구조적 staleness 없음 확인. 남은 불일치는 위 4개 verified 문서의 `project:` frontmatter 라벨뿐(내부 메타·validate 비검사)이라 새 이름으로 통일 → 위키 전체가 `llm-wiki-governance`로 코히런트해짐.
  - 의도적 유지(역사/비대상): releases/v0.1.7·v0.1.8(과거 릴리스 기록, verified), templates/*(`project: project` 플레이스홀더), releases/** 및 log 본문(옛 이름은 당시 사실이므로 보존).
- evidence:
  - package.json (name: llm-wiki-governance)
  - src/commands.js#symbol:initWrite (project frontmatter = 스코프 뗀 packageJson.name → 신규 문서는 자동으로 llm-wiki-governance)
- caveats:
  - 4개 문서는 내용 변화 없는 라벨 갱신이라 사람 재검토는 빠르다. 전체 재검토 대상: 1.16.0 강등 9 + 이번 4 = 13문서(+ 상시 needs_review인 release notes).

## 2026-07-21 - release: prepare 1.16.0 (rename @dowonk-7949/llm-wiki-standard → llm-wiki-governance + governance reposition + English-first output)

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시 — "다음 작업[English-first flip] 진행 + 패키지 개명·repo 제자리 rename·옛 패키지 deprecate; 이름 llm-wiki-governance, 버전 1.16.0")
- scope: src, tests, docs, config, CI
- changed:
  - src/cli.js (helpText EN-first 재정렬 + npx/mcp 예시를 `llm-wiki-governance`로), src/commands.js (`buildHandoff` 프롬프트 완전 영어 + message/`handoffNextStep`/quickstart `About`/brownfield·gitignore/`SKILL_RELOAD_NOTE` EN-first + `handoffLabel` "또는"→"or" + `handoffEntrypoints` "와/를"→"and"), src/index.js (주석 패키지명)
  - package.json (name `@dowonk-7949/llm-wiki-standard`→`llm-wiki-governance`, version 1.15.1→1.16.0, repository.url, description 거버넌스로 갱신)
  - CI: `.github/workflows/publish.yml`·`ci.yml`(identity 체크 + ci.yml tarball glob `llm-wiki-governance-*.tgz`), `.github/actions/validate/action.yml`, `.github/ISSUE_TEMPLATE/config.yml`
  - 문서(개명·repo URL): README.md/README.ko.md, CONTRIBUTING(.ko), SECURITY(.ko), RELEASE_CHECKLIST.md, VERIFICATION.md, ROADMAP(.ko)·GATE_REVIEW·adapters/README·rules/README·templates/git-hooks/README frontmatter, CHANGELOG.md/CHANGELOG.ko.md(헤더+1.16.0)
  - wiki(정체성/doc-sync, verified→needs_review): index.md, project-profile.md, PUBLIC_API.md, GLOSSARY.md, domains/00_overview.md, docs/llm-wiki/README.md, ARCHITECTURE_CONVENTIONS.md, DOMAIN_FEATURES.md, EXAMPLES.md; docs/llm-wiki/releases/v1.16.0.md(신규)
  - tests/verification.test.js (package name/repo url assertion + helpText 헤딩 + handoff 프롬프트 영어 + entrypoint " and " assertion)
- summary:
  - global-reach P1 마무리(English-first 출력) + 전략 정합 개명. "standard"가 거버넌스/OKF-compatible 포지션과 충돌해 이름을 `llm-wiki-governance`로 바꾸고, repo는 제자리 rename(GitHub 리다이렉트 유지), 옛 스코프드 패키지는 deprecate(unpublish 불가 — 생성>72h·주 3,445 다운로드로 npm 정책 미충족).
  - 프레젠테이션·additive: `llm-wiki` 명령·`--format json`·동결 프로그래매틱 API·frontmatter 계약·zero-dep 불변.
- evidence:
  - package.json
  - src/cli.js
  - src/commands.js
- caveats:
  - 개명·doc-sync로 verified 문서 다수를 `needs_review`로 강등 — 사람 검토 후 재승인 필요(릴리스 게이트).
  - 계정 작업(사용자): GitHub repo rename, npm Trusted Publisher 재설정(새 이름 + rename된 repo), 필요 시 새 이름 첫 수동 publish, `npm deprecate` 옛 패키지. "배포" 시 태그 push.

## 2026-07-21 - release: prepare 1.15.1 (스킬 생성 재시작 안내, dogfood) + doc-sync

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시 — "스킬 아티팩트 유지한 채 릴리스, 문서 검토 완료")
- scope: src, tests, docs, dogfood-artifacts
- changed:
  - (직전 feat 항목의 `src/commands.js`·tests·DOMAIN_FEATURES 변경 포함)
  - package.json (1.15.0→1.15.1), tests/verification.test.js(버전 assertion), CHANGELOG.md/CHANGELOG.ko.md(1.15.1), docs/llm-wiki/releases/v1.15.1.md(신규)
  - docs/llm-wiki/DOMAIN_FEATURES.md: 사람 검토 완료 → `needs_review`에서 `verified`로 재승인(reviewed_at 2026-07-21)
  - dogfood: `.claude/skills/`·`.cursor/rules/`·`.llm-wiki/prompts/`(llm-wiki-feature/fix/docs-sync 9개)를 저장소에 커밋해 추적 — 이 패키지가 자기 스킬을 dogfood. npm `files` allowlist 밖이라 패키지엔 미포함.
- summary:
  - 1.15.0 스킬 생성의 온보딩 마찰(생성 직후 `/llm-wiki-*`가 "unknown" — Claude Code는 세션 시작 시 스킬 로드)을 도구 자신의 `/llm-wiki-feature` 스킬로 고쳐 1.15.1로 릴리스. `init`/`quickstart --write`가 스킬 생성 시에만 이중언어 재시작 안내를 출력.
  - 사용자 결정: 스킬 아티팩트는 "패키지 성능·개편"을 위해 유지(dogfood 커밋).
- evidence:
  - src/commands.js
  - package.json
- caveats:
  - 배포 후 package.json/commands.js를 인용하는 verified 문서의 per-release evidence.stale는 baseline-refresh로 해소(관례).

## 2026-07-21 - feat: 스킬 생성 후 "에이전트 재시작 필요" 안내 (/llm-wiki-feature 스킬로 실행)

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim이 `/llm-wiki-feature` 스킬로 실행 — 1.15.0 스킬 dogfood)
- scope: src, tests, docs
- changed:
  - src/commands.js (`SKILL_RELOAD_NOTE` 상수 + `initWrite`의 Summary에 조건부 안내[스킬 실제 생성 시만] + payload `skillsCreated` + `quickstartInitSummary` 동일 반영)
  - tests/verification.test.js (재시작 안내 표시/미표시 테스트 추가)
  - docs/llm-wiki/DOMAIN_FEATURES.md ("스킬 생성" 기능에 재시작 요건 반영 + 에이전트 편집이라 `verified`→`needs_review` 강등)
- summary:
  - Claude Code는 스킬을 세션 시작 시점에만 로드(hot-reload 아님)하므로, `--skills`로 갓 생성한 스킬은 에이전트 재시작 전까지 `/llm-wiki-*`가 "unknown"으로 보인다. 이를 도구가 스스로 안내하도록, `init`/`quickstart --write`가 스킬을 실제로 생성했을 때만 이중언어(KO+EN) 재시작 안내 한 줄을 출력에 추가했다.
  - 실사용 마찰(사용자가 직접 겪음) 기반 개선. 스킬을 요청하지 않은 실행은 출력 불변.
- evidence:
  - src/commands.js
- caveats:
  - `/llm-wiki-feature` 스킬(에이전트)로 수행한 작업 — DOMAIN_FEATURES는 `needs_review`로 남으며 사람 재검토 대기. verified 승격은 하지 않았다.
  - 아직 릴리스 아님(버전 미변경). 유지관리자가 검토 후 패치(예: 1.15.1)로 낼지 결정.
  - node --test / validate 결과는 아래 워크플로 마지막 단계에서 기록.

## 2026-07-20 - release: prepare 1.15.0 (스킬 생성, Gate 21) + doc-sync

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시 — "스킬 활용 자동화-프롬프트 기능 추가", Gate 21 스코프 조정 후 수락)
- scope: src, tests, docs
- changed:
  - src/commands/skills.js(신규 — `SKILL_TASKS`/`selectedSkillFormats`/`planSkillArtifacts`/`writeSkillArtifacts`; Claude 스킬·Cursor 룰·중립 프롬프트 생성 + 도메인 맵 주입), src/commands.js(initDryRun/initWrite에 skill plan/write 배선), src/cli.js(`--skills` 플래그 + init/quickstart 허용 옵션 + help usage)
  - tests/verification.test.js (+2 스킬 테스트; 버전 assertion 1.14.4→1.15.0)
  - package.json (1.14.4→1.15.0), CHANGELOG.md/CHANGELOG.ko.md, docs/llm-wiki/releases/v1.15.0.md(신규)
  - doc-sync + re-verify: ARCHITECTURE_CONVENTIONS(skills.js Module Layout·Evidence)·DOMAIN_FEATURES(스킬 생성 기능·Evidence)·PUBLIC_API(`--skills` 옵션) (reviewed_at 2026-07-20 유지)
  - GATE_REVIEW.md: Gate 21 accepted_for_1.15.0(도메인 맵 주입 + 다중 에이전트 포맷 2가지 추가)
- summary:
  - Gate 21(스킬 생성). `init`/`quickstart`이 feature/fix/docs-sync 위키-그라운디드 워크플로를 각 에이전트 네이티브 아티팩트로 생성: Claude 스킬(`.claude/skills/llm-wiki-<task>/SKILL.md`)·Cursor 룰(`.cursor/rules/llm-wiki-<task>.mdc`)·중립 프롬프트(`.llm-wiki/prompts/llm-wiki-<task>.md`).
  - 본문은 `task-prompts.js` 재사용 + 프로젝트 도메인 맵(`docs/llm-wiki/domains/` 스냅샷) 주입. `--skills` 또는 `--agent claude|cursor` opt-in, preview-first, 미덮어씀, recognize-don't-run(도구는 생성만). 생성 머신 절대경로(사용자명) 미유출(workspace=`.`). 중립 프롬프트는 검증 트리 밖(`.llm-wiki/prompts/`)에 둠.
  - 생성한 위키가 실제 기능 작업에 쓰이도록 하는 진입점 → 가치 루프(#8) 해소.
  - 검증: node --test 231 통과(신규 2), validate result:pass 0 findings, strict pass. `init --write --agent claude --skills`로 9개 아티팩트 + 도메인 맵 주입 + 절대경로 미유출 CLI 확인.
- evidence:
  - src/commands/skills.js
  - src/cli.js
  - package.json
- caveats:
  - 배포(태그 push→npm)는 사용자의 명시적 "배포" 지시 대기.
  - 게이트 초안의 중립 프롬프트 경로(`docs/llm-wiki/prompts/`)를 `.llm-wiki/prompts/`로 조정(검증 트리 밖, 어댑터와 동일 취급) — 릴리스 노트에 명시.

## 2026-07-20 - release: prepare 1.14.4 (도메인 감지 venv 스캔 버그 수정) + doc-sync

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시 — 테스터 산출물 검토 중 발견, "지금 고쳐서 1.14.4로 함께 배포")
- scope: src, tests, docs
- changed:
  - src/commands/domains.js (`scanForDomainParents`에 `pyvenv.cfg` venv 통째 스킵 + `DOMAIN_TRAVERSAL_SKIP`에 site-packages/dist-packages/virtualenv + `isSkippedTraversalDir`에 버전형 `venv*`/`env<N>` 패턴)
  - tests/verification.test.js (+1 테스트: venv3.10/site-packages 제외 & 실제 app/handlers 감지; 버전 assertion 1.14.3→1.14.4)
  - package.json (1.14.3→1.14.4), CHANGELOG.md/CHANGELOG.ko.md, docs/llm-wiki/releases/v1.14.4.md(신규)
  - doc-sync + re-verify: ARCHITECTURE_CONVENTIONS·DOMAIN_FEATURES (reviewed_at 2026-07-20 유지)
- summary:
  - 유지관리자가 테스터 산출물을 검토하다 발견: 도메인 문서 40여 개가 전부 빈 스캐폴드였고 `source_files`가 `venv3.10/Lib/site-packages/{passlib,boto3}/...` — 즉 도메인 감지가 **가상환경을 스캔**해 설치된 의존성을 도메인으로 오탐하고 있었다.
  - 근본 원인: 버전형 venv 이름(`venv3.10`)이 스킵 목록에 없고 `site-packages`도 제외 안 됨, venv 마커 체크 없음.
  - 수정: (1) `pyvenv.cfg`를 가진 디렉터리는 venv로 간주해 통째 스킵(이름 무관), (2) `site-packages`/`dist-packages` 제외, (3) 버전형 `venv*`/`env<N>` 이름 스킵. venv 없는 레포는 byte-identical, 프로젝트 자기 `handlers`/`routers`/… 도메인은 그대로 감지.
  - 검증: node --test 229 통과(신규 1), validate result:pass 0 findings, strict pass. venv3.10 시뮬레이션에서 passlib 미유출·실제 endpoint만 감지 CLI 확인.
- evidence:
  - src/commands/domains.js
  - package.json
- caveats:
  - 배포(태그 push→npm)는 사용자의 명시적 "배포" 지시 대기. 1.14.2·1.14.3·1.14.4 함께 배포 예정.

## 2026-07-20 - release: prepare 1.14.3 (온보딩 오리엔테이션 + 이중언어) + doc-sync

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시 — 두 번째 노출 보고서 반영, 한글 출력 범위 "사용자-대면 이중언어" 선택)
- scope: src, tests, docs
- changed:
  - src/cli.js (`helpText()`+`packageVersion()` 추가, `printHelp` 리팩터 — 이중언어 KO+EN 오리엔테이션[무엇/왜/3단계] + 버전 + `@latest` 팁), src/commands.js (`quickstartCommand`에 `About · 소개` 이중언어 섹션)
  - tests/verification.test.js (+2 테스트; 버전 assertion 1.14.2→1.14.3)
  - package.json (1.14.2→1.14.3), CHANGELOG.md/CHANGELOG.ko.md, docs/llm-wiki/releases/v1.14.3.md(신규)
  - doc-sync + re-verify: ARCHITECTURE_CONVENTIONS·DOMAIN_FEATURES (reviewed_at 2026-07-20 유지)
- summary:
  - 두 번째 노출 보고서(백엔드 개발자): (a) `npx …@1.14.0`(npx 캐시)로 실행 → 1.14.1 `Ready` 리네임 못 받고 옛 `Blocked`를 봄, (b) bare 명령/`--help`에 "무슨 도구인지" 설명이 없어 의도 파악 실패(#2·#9·#10), (c) 한글 출력 희망(#7), (d) 아직 실제로 써보질 않아 가치 판단 불가(#8).
  - 진단: (a)는 캐시 문제(1.14.1/1.14.2 이미 fix, 전달만 안 됨) → `@latest` 재실행 relay. (b)(c)가 코드로 해결 대상.
  - 1.14.3: `--help`/bare 명령이 Usage 나열 전에 이중언어(KO+EN) 오리엔테이션(무엇/왜/3단계 흐름) + 버전 + `@latest` 팁을 보여줌. `quickstart` 출력에 이중언어 `About · 소개` 라인(help 안 보고 quickstart 직행한 사용자용). finding ID·정밀 리포트는 영문 유지. 전면 i18n(`--lang`)은 별도 결정.
  - 검증: node --test 228 통과(신규 2), validate result:pass 0 findings, strict pass. bare 명령 오리엔테이션 실제 CLI 확인.
- evidence:
  - src/cli.js
  - src/commands.js
  - package.json
- caveats:
  - 배포(태그 push→npm)는 사용자의 명시적 "배포" 지시 대기.
  - 캐시 이슈: 두 번째 테스터에게 `npx @dowonk-7949/llm-wiki-standard@latest`로 재실행 요청 필요(relay).
  - 도메인 감지(app/api/v2/*.py, endpoints/ 없는 경우)·가치 실현(#8, 실제 사용/ROI 실험)은 여전히 대기.

## 2026-07-20 - release: prepare 1.14.2 (usability 다듬기) + Gate 20 draft

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시 — 첫 외부 end-to-end 성공 후 "사용성 극대화")
- scope: src, tests, docs
- changed:
  - src/commands/references.js (`parseEvidenceReference` 콜론-라인 `파일:10` 수용), src/commands/wiki-graph.js (orphan에서 `/templates/` 제외), src/git.js (`isPathIgnored`), src/commands/findings.js (`structure.output_gitignored` 룰 등록), src/commands.js (`initWrite` gitignore 경고+안심 요약, `doctor` wiki_output 체크, `quickstartInitSummary` gitignore 라인)
  - tests/verification.test.js (+5 테스트; 버전 assertion 1.14.1→1.14.2)
  - package.json (1.14.1→1.14.2), CHANGELOG.md/CHANGELOG.ko.md, docs/llm-wiki/releases/v1.14.2.md(신규)
  - doc-sync + re-verify: ARCHITECTURE_CONVENTIONS·DOMAIN_FEATURES (reviewed_at 2026-07-20 유지)
  - GATE_REVIEW.md: Gate 20(review 워크플로) DRAFTED proposed_* (수락 전, 코드 없음)
- summary:
  - 첫 외부 end-to-end 성공(BE 개발자가 handoff 프롬프트로 위키 전체 추출) 이후의 사용성 다듬기 4건. 검토자가 보는 헛경고를 줄이고 사일런트 실패를 표면화. 계약·zero-dep 불변.
  - (1) `evidence` 콜론-라인 표기(`파일:10`) 수용 — 에디터/grep 스타일 근거가 헛 `evidence.missing`을 내지 않음. (2) 생성 `templates/*`를 orphan 보고에서 제외. (3) `docs/llm-wiki`가 gitignore되면 `init --write`/`quickstart`·`doctor`가 `structure.output_gitignored` 경고(차단 아님). (4) `init --write` 안심 요약 라인.
  - 별도: 사람 검토→verified 승인을 돕는 `review` 워크플로를 GATE_REVIEW Gate 20으로 초안만 작성(수락 대기, 코드 없음).
  - 검증: node --test 226 통과(신규 5), validate result:pass 0 findings, strict pass. gitignore 경고·evidence 표기 실제 CLI 확인.
- evidence:
  - src/commands/references.js
  - src/git.js
  - package.json
- caveats:
  - 배포(태그 push→npm)는 사용자의 명시적 "배포" 지시 대기.
  - Gate 20은 아직 수락 전 — review 워크플로는 코드 미구현(초안만).

## 2026-07-20 - feat: handoff Next Step 명료화 + skipped/브라운필드 안내 (1.14.1에 fold-in)

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시 — BE 개발자 추가 보고서 반영, "1.14.1에 접어넣기")
- scope: src, tests, docs
- changed:
  - src/commands.js (`handoffNextStep` 헬퍼 + quickstart/handoff `Next Step`에 적용; `quickstartInitSummary` skip 사유 주석·브라운필드 안내)
  - tests/verification.test.js (+1 UX 테스트)
  - CHANGELOG.md/CHANGELOG.ko.md·releases/v1.14.1.md(1.14.1 항목에 UX 2건 추가), doc-sync: ARCHITECTURE_CONVENTIONS·DOMAIN_FEATURES(1.14.1 review note + handoff 기능 서술 확장, reviewed_at 2026-07-20 유지)
- summary:
  - BE 개발자 노출 보고서: 도구가 원하는 도메인 문서(hazard/customer/road_scan)를 이미 스캐폴드하고 handoff 프롬프트가 이미 그 보강을 지시하는데도, 출력이 그 가치를 전달하지 못해 "프롬프트를 실행하는 게 목적인가?"라는 워크플로 혼란이 발생. 기능이 아니라 **출력 명료화** 문제로 진단.
  - (가) handoff `Next Step`이 "Handoff Prompt는 CLI가 실행하는 게 아니라 코딩 에이전트에 붙여넣는 지시문"임을 3단계(붙여넣기→코드 근거 보강[도메인별 domains/*.md 포함]→사람 검토·verified)로 설명. `handoff.message`(프로그래매틱 필드)는 불변으로 첫 줄 보존(계약 안정).
  - (나) `quickstart` 출력이 브라운필드 인식: skip 개수에 `(N already exist, kept)` 주석, 새로 만들 문서가 없으면 기존 문서를 handoff로 보강하라는 안내(“도구가 아무것도 안 한 것”처럼 보이지 않게).
  - 검증: node --test 221 통과(신규 1), validate result:pass 0 findings, strict pass. 실제 CLI로 fresh/브라운필드 출력 확인.
- evidence:
  - src/commands.js
- caveats:
  - 도메인 감지 (다)[버전 디렉터리 `app/api/v2/*.py`가 `endpoints/` 없이 직접 놓인 경우]는 BE 개발자에게 실제 레이아웃 확인 후 결정하기로 보류.
  - 배포(태그 push→npm)는 사용자의 명시적 "배포" 지시 대기. 이 UX 2건은 미배포 1.14.1에 fold-in.

## 2026-07-20 - release: prepare 1.14.1 (exposure-test fix batch) + doc-sync

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시 — "다음 작업 진행" + 배포 방향 선택)
- scope: src, tests, docs
- changed:
  - src/encoding.js (`decodeWithBom`/`readTextAuto` BOM 인식 리더 추가; UTF-16LE/BE·UTF-8 BOM)
  - src/detector.js (매니페스트/소스 읽기를 `readTextAuto`로 전환), src/commands.js (`buildHandoff` 진입점 명시적-에이전트 한정 + `needsWriteFlag` 사용), src/commands/fix-migrate.js (`needsWriteFlag` 헬퍼)
  - tests/verification.test.js (+3 테스트; 버전 assertion 1.14.0→1.14.1)
  - package.json (1.14.0→1.14.1), CHANGELOG.md/CHANGELOG.ko.md(1.14.1 항목), docs/llm-wiki/releases/v1.14.1.md(신규)
  - doc-sync + re-verify: ARCHITECTURE_CONVENTIONS.md·DOMAIN_FEATURES.md
- summary:
  - 1.14 이후 노출 테스트 P0/P1 버그 수정 배치. (A) 비-UTF-8 매니페스트(UTF-16/UTF-8-BOM)가 mojibake로 읽혀 FastAPI 백엔드가 `library`로 오분류되던 문제를 BOM 인식 리더로 교정. detector의 모든 매니페스트/소스 읽기를 `readTextAuto`로 전환(BOM 없는 파일 byte-identical, 위키 문서 `readUtf8` 불변).
  - (B) `--agent` 미지정 시 handoff 프롬프트가 생성되지 않은 `AGENTS.md`/`CLAUDE.md`를 먼저 읽으라고 하던 문제를, 진입점을 명시적 선택 에이전트의 어댑터 파일로만 한정해 교정(미선택 시 `docs/llm-wiki/index.md`).
  - (C) 모드 플래그 없는 `init`/`quickstart`이 `Blocked`(exit 2)로 실패처럼 보이던 것을 `Ready (needs --write)`(result `ready`, exit 0)로 리네임. 충돌 플래그는 여전히 hard error.
  - 검증: node --test 220 통과(신규 3), validate result:pass 0 findings, validate-frontmatter --strict pass. 세 수정 모두 실제 CLI로 end-to-end 확인.
- evidence:
  - src/encoding.js
  - src/detector.js
  - package.json
- caveats:
  - 배포(태그 push→npm)는 사용자의 명시적 "배포" 지시 대기.
  - (C)는 no-flag 종료코드를 2→0으로 바꾸는 동작 변경 — 사용자가 명시적으로 승인함("Ready + exit 0").

## 2026-07-16 - release: prepare 1.14.0 (stdlib-server detection, Gate 19) + doc-sync

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시 — "승인")
- scope: src, tests, docs
- changed:
  - src/detector.js (`detectGoStdlibServer`/`detectPythonStdlibServer` + `anySourceMatches` bounded 소스 스캐너; Go/Python 브랜치 one-directional library→backend)
  - tests/verification.test.js (+2 stdlib 테스트; 버전 assertion 1.13.0→1.14.0)
  - package.json (1.13.0→1.14.0), CHANGELOG.md/CHANGELOG.ko.md, ROADMAP.md/ROADMAP.ko.md(1.14 shipped·라인 완성), GATE_REVIEW.md(Gate 19 accepted+shipped), docs/llm-wiki/releases/v1.14.0.md(신규)
  - doc-sync: ARCHITECTURE_CONVENTIONS.md·DOMAIN_FEATURES.md → needs_review
- summary:
  - 1.14.0 = stdlib-server 감지(Gate 19). Go `net/http`(비-test .go가 net/http import + ListenAndServe/http.Serve 호출)·Python stdlib HTTP(.py가 http.server/socketserver import + serve_forever/HTTPServer) 서버를 bounded 소스 스캔으로 감지해 role을 `library`→`backend`로 **단방향** 승격한다.
  - 보수적: 강한 import+시작-호출 쌍에만 반응, `http.client`만 쓰는 라이브러리는 library 유지, 기존 backend 미강등. 인식만 함(읽기 전용 스캔, 프레임워크 의존성 불요, zero-dep). README는 새 생태계/유형 추가가 아니라 변경 없음.
  - 검증: node --test 217 통과(신규 2), validate result:pass 0 findings, strict pass. Go server→backend / Go client→library CLI e2e 스모크 확인. **이로써 1.12–1.14 detect & adapt 확장 라인 완성.**
- evidence:
  - src/detector.js
  - package.json
- caveats:
  - 배포(태그 push→npm)는 사용자의 명시적 "배포" 지시 대기. 배포 후 doc-sync 2개 문서(ARCHITECTURE·DOMAIN_FEATURES) 사람 재검토 필요.

## 2026-07-16 - release: prepare 1.13.0 (infra/DevOps profile, Gate 18) + doc-sync

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시 — "진행")
- scope: src, tests, docs
- changed:
  - src/detector.js (`detectInfra` + `findKubernetesManifest` + `decideType` infra fallback), src/config.js (`PROFILE_DOCS.infra`)
  - tests/verification.test.js (+3 infra 테스트; 버전 assertion 1.12.0→1.13.0)
  - package.json (1.12.0→1.13.0), CHANGELOG.md/CHANGELOG.ko.md, ROADMAP.md/ROADMAP.ko.md(1.13 shipped), README.md/README.ko.md(감지 대상 행에 infra), GATE_REVIEW.md(Gate 18 accepted+shipped), docs/llm-wiki/releases/v1.13.0.md(신규)
  - doc-sync: ARCHITECTURE_CONVENTIONS.md·DOMAIN_FEATURES.md → needs_review
- summary:
  - 1.13.0 = infra/DevOps 프로젝트 프로필(Gate 18). `detectInfra`가 Docker/Compose/Kubernetes/Helm/Terraform 신호로 부가적 `infra` 유형을 감지하고, `init`이 infra 문서셋(profiles/infra.md·DEPLOYMENT·RUNBOOK·SERVICE_TOPOLOGY)을 생성한다.
  - `infra`는 **fallback** — `decideType`에서 앱 신호(frontend/backend/library/mobile)가 없을 때만 선택. `Dockerfile`을 가진 백엔드 레포는 backend 유지, 기존 출력 byte-identical(infra 신호는 infra로 확정될 때만 표면화). 인식만 함(클러스터/레지스트리 접근·배포 없음, zero-dep).
  - 검증: node --test 215 통과(신규 3), validate result:pass 0 findings, strict pass. Terraform→infra / backend+Dockerfile→backend CLI end-to-end 스모크 확인.
- evidence:
  - src/detector.js
  - src/config.js
  - package.json
- caveats:
  - 배포(태그 push→npm)는 사용자의 명시적 "배포" 지시 대기. 배포 후 doc-sync 2개 문서(ARCHITECTURE·DOMAIN_FEATURES) 사람 재검토 필요.

## 2026-07-16 - release: prepare 1.12.0 (mobile profile, Gate 17) + doc-sync

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시 — "작업을 진행하자. push 하도록 해")
- scope: src, tests, docs
- changed:
  - src/detector.js (`detectMobile` + `decideType` mobile 최우선 분기), src/config.js (`PROFILE_DOCS.mobile`)
  - tests/verification.test.js (+6 mobile 테스트; 버전 assertion 1.11.1→1.12.0)
  - package.json (1.11.1→1.12.0), CHANGELOG.md/CHANGELOG.ko.md, ROADMAP.md/ROADMAP.ko.md(1.12 shipped), README.md/README.ko.md(감지 대상 행), GATE_REVIEW.md(Gate 17 shipped), docs/llm-wiki/releases/v1.12.0.md(신규)
  - doc-sync: ARCHITECTURE_CONVENTIONS.md·DOMAIN_FEATURES.md → needs_review, VISIBILITY.md → needs_review(config.js 드리프트, 내용 불변)
- summary:
  - 1.12.0 = 모바일 프로젝트 프로필(Gate 17). `detectMobile`이 Android/Flutter/iOS/React Native 신호로 부가적 `mobile` 유형을 감지하고, `decideType` 최우선 순위로 Android `build.gradle`의 JVM `library` 오분류를 교정한다. `init`이 mobile 문서셋(profiles/mobile.md·PLATFORM_MATRIX·SCREENS·BUILD_RELEASE)을 생성한다.
  - 인식만 함(빌드 도구 미호출·의존성 그래프 미파싱, zero-dep). additive: `--type`에 `mobile` 추가, 신호 없는 레포 byte-identical(plain JVM/Dart 미재분류).
  - 검증: node --test 212 통과(신규 6), validate result:pass 0 findings, validate-frontmatter --strict pass. Android 감지 CLI end-to-end 스모크 확인.
- evidence:
  - src/detector.js
  - src/config.js
  - package.json
- caveats:
  - 배포(태그 push→npm)는 사용자의 명시적 "배포" 지시 대기. 배포 후 doc-sync 3개 문서(ARCHITECTURE·DOMAIN_FEATURES·VISIBILITY) 사람 재검토 필요.

## 2026-07-16 - decision: Gate 17 (모바일 프로필, 1.12.0) 승인

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 승인 기록)
- scope: docs (게이트 결정; 코드 없음)
- changed:
  - GATE_REVIEW.md (Gate 17 상태 `proposed_for_1.12.0` → `accepted_for_1.12.0`; scope 서술 "Accepted by Dowon-Kim on 2026-07-16"로 갱신)
  - ROADMAP.md / ROADMAP.ko.md ("Release Plan (1.12–1.14)" 상태를 Gate 17 승인/활성 다음 마이너로 갱신; Gate 18·19는 proposed 유지)
- summary:
  - Dowon-Kim이 Gate 17(모바일 프로필)을 `accepted_for_1.12.0`으로 승인했다. 이로써 `1.12`가 다음 활성 마이너가 된다: 부가적 `mobile` 프로젝트 유형(Android/Flutter/iOS/React Native 감지 + 모바일 문서셋)이며, 지금 Android `build.gradle`이 `jvm`+`library`로 오분류되는 문제(`src/detector.js`)도 함께 고친다.
  - Gate 18(1.13 infra)·Gate 19(1.14 stdlib-server)는 여전히 `proposed_*`로 승인 대기 — 로드맵 규율(한 번에 한 마이너)에 따라 1.12 완료 후 순서대로 당긴다.
- caveats:
  - 승인 단계까지만 진행 — 아직 코드/테스트 변경 없음. 1.0.0 계약·zero-dep 불변. 구현은 다음 단계.

## 2026-07-16 - chore: 유지보수자 표기명 정정 (WoongHwan-Kim → Dowon-Kim, 동일 인물)

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시 — 옛 이름 표기를 현재 이름으로 교정)
- scope: docs, git-config
- changed:
  - git config user.name (local + global): WoongHwan-Kim → Dowon-Kim (email whkim@dareesoft.com 유지)
  - 문서 21개 파일 149곳의 "WoongHwan-Kim" → "Dowon-Kim" 일괄 치환(reviewed_by·"Accepted by …"·리뷰 노트 등)
- summary:
  - 유지보수자의 옛 이름(WoongHwan-Kim)을 현재 이름(Dowon-Kim)으로 통일했다. 동일 인물의 표기명 정정이므로 리뷰의 유효성은 불변 — verified 문서의 status는 유지했다(재검토 부채 없음). GitHub 계정·npm 스코프는 이미 Dowon-Kim7949/@dowonk-7949라 신원과도 정렬된다.
  - 과거 커밋 히스토리(132개 커밋의 author/committer)는 의도적으로 건드리지 않았다: SHA 재작성·강제 push·태그 재작성·npm provenance 훼손을 피하기 위함. 즉 git log 상 옛 이름은 역사적 기록으로 보존된다.
  - 이 log.md의 과거 항목 66곳도 이름 일관성을 위해 정정했다(엄밀한 append-only에서 벗어난 예외 — 무엇이 일어났는지는 불변, 사람 이름 철자만 정정).
- caveats:
  - 코드/CLI/JSON/frontmatter 계약과 zero-dep 불변(내용 변경 없음, 표기명만 정정).
  - 바이너리 프레젠테이션(outputs/*.pptx)에 옛 이름이 남아 있을 수 있으며, 필요 시 별도로 갱신해야 한다.

## 2026-07-16 - plan: 다음 라인(1.12–1.14 detect & adapt 브레드스) 게이트/로드맵 초안 (제안, 승인 대기)

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시 — "다음 버전 작업" + "모든 것에 대해 진행")
- scope: docs (계획만; 코드 변경 없음)
- changed:
  - GATE_REVIEW.md (Gate 17–19 테이블 행 + scope 서술 3개; source_files에 src/detector.js·src/config.js 추가 → needs_review)
  - ROADMAP.md / ROADMAP.ko.md ("Release Plan (1.12–1.14)" 신규 섹션; stdlib-server 백로그→1.14 승격 → needs_review)
- summary:
  - `1.7–1.11` "팀 & 조직 확장" 라인이 `1.11.1`로 완성·npm 배포된 상태에서, 사용자가 다음 세 후보(모바일 프로필·infra/DevOps 프로필·stdlib-server 감지)를 모두 진행하기로 결정했다. 로드맵 규율(한 번에 한 마이너, 코드보다 먼저 게이트)에 맞춰 한 릴리스로 묶지 않고 순서 있는 마이너 3개로 계획했다: 1.12 모바일(Gate 17, Android build.gradle→library 오분류도 수정) → 1.13 infra(Gate 18) → 1.14 stdlib-server(Gate 19).
  - 세 게이트 모두 `proposed_for_*` 상태로 기록하고 Dowon-Kim 승인 대기임을 명시했다. 승인 후에야 코드 착수한다.
- evidence:
  - src/detector.js
  - src/config.js
  - package.json
- caveats:
  - 아직 계획 단계다 — 코드/테스트 변경 없음, `1.0.0` 계약·zero-dep 불변. 게이트는 사람 승인 전까지 proposed로 유지한다.
  - 계획 문서(GATE_REVIEW·ROADMAP·ROADMAP.ko)는 LLM 편집이라 needs_review로 강등했다.

## 2026-07-16 - refactor: commands.js 모듈 분리 완료 (안정화 2단계, 동작 보존) + doc-sync

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시 — "분리 마저 진행")
- scope: src, docs
- changed:
  - src/commands.js (3,434→1,612줄)
  - src/commands/{references,findings,wiki-graph,wiki-files,adapters,scans,fix-migrate}.js (신규 7개)
  - docs/llm-wiki/{ARCHITECTURE_CONVENTIONS,DOMAIN_FEATURES,PUBLIC_API,domains/00_overview}.md (Module Layout·이동 심볼 evidence 포인터 갱신 → needs_review)
- summary:
  - 안정화 2단계: commands.js에서 재사용 로직을 동작 보존 방식으로 7개 sibling 모듈로 추출했다(누적 ~4,119→1,612줄; 앞선 domains/doc-templates 포함 총 9개 서브모듈). 단방향 의존(leaf references/findings/wiki-files/doc-templates/domains → wiki-graph/adapters → scans → fix-migrate → commands.js). `migrateCommand`는 `audit` 파이프라인을 호출하므로 commands.js<->fix-migrate.js 순환을 피하려 commands.js에 잔류(graphCommand/statsCommand과 동일 패턴; 헬퍼만 분리). 배럴 re-export로 동결 CLI/프로그래매틱 API(18-명령 맵·`driftTargets`·`fixCommand`·`driftCommand`)와 `from "./commands.js"` import 표면은 byte-identical. 각 추출 커밋마다 206 테스트 통과 + validate는 날짜-롤오버 evidence.stale만.
- evidence:
  - src/commands/scans.js#symbol:scanEvidenceDrift
  - src/commands/findings.js#symbol:applyRuleConfig
  - src/commands/fix-migrate.js#symbol:runMechanicalRemediation
- caveats:
  - 동작 보존 내부 리팩터라 CLI/JSON/frontmatter 계약과 zero-dep 불변. 릴리스는 1.11.1로 예정.
  - doc-sync한 4개 문서는 needs_review로 강등(사람 재검토 대기; 재검토 시 각 문서의 evidence.stale 해소). GLOSSARY는 광의의 src/commands.js 참조만 있어 내용 불변 — 사람 재검토로 reviewed_at만 갱신하면 evidence.stale 해소.

## 2026-07-15 - test: 안정화 1단계 — 교차기능 통합 테스트 3개 (invariant 재감사)

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시 — "안정화 우선" 방향 선택)
- scope: tests
- changed:
  - tests/verification.test.js (+3 통합 테스트)
- summary:
  - 8릴리스(1.7.1–1.11.0)를 additive로 얹은 뒤 안정화 패스 1단계. 기능별로만 검증됐던 교차 상호작용을 잠갔다: (1) `rules`+`requiredDocs`+`visibility`+`content.thin_body`가 한 audit에서 함께 적용되고 `sensitive.redacted`-off 시도에도 sensitive 탐지가 유지됨(안전 불변식), (2) `monorepo`가 패키지별 config를 독립 적용, (3) cross-repo 참조 무시와 visibility 규칙 공존. 206 pass. 이 3개가 곧 종합 불변식 재감사 역할(zero-dep/additive/single-repo byte-identical/sensitive 비토글/never-verified는 각 릴리스에서 개별 확인됨).
- caveats:
  - 안정화 2단계(commands.js 4,119줄 분리)는 대량 코드 이동 위험 관리를 위해 별도 focused pass로 진행 예정(barrel re-export·클러스터별 추출·추출마다 전체 테스트 게이트). 테스트 전용 변경이라 릴리스는 분리 완료 후 함께.

## 2026-07-15 - docs: 1.11.0 cross-repo 문서 2개 verified 재승인 (1.7–1.11 라인 완주)

- status: verified
- actor: Claude Code (사용자 Dowon-Kim 검토·승인)
- scope: docs
- changed:
  - docs/llm-wiki/DOMAIN_FEATURES.md, ARCHITECTURE_CONVENTIONS.md (needs_review → verified)
- summary:
  - 1.11.0 doc-sync(cross-repo knowledge links)로 needs_review로 내려갔던 지식 문서 2개를 사람 검토·승인에 따라 `verified`로 재승인했다(`reviewed_by: Dowon-Kim`·`reviewed_at: 2026-07-15`). 이로써 1.11.0 재검토 부채가 없고, 배포된 1.7–1.11 로드맵 라인 전체가 재검토까지 완료됐다(PUBLIC_API는 1.11에서 표면 변경 없어 verified 유지).
- caveats:
  - `reviewed_at: 2026-07-15`가 같은날 src 변경을 end-of-day 기준으로 커버하므로 `evidence.stale` 없음. validate 0, strict clean. 계획된 다음 마이너 없음(Unscheduled 1.x Backlog / Beyond-1.x-Horizon만 잔여).

## 2026-07-15 - release: 1.11.0 준비 (cross-repo links) — 1.7–1.11 라인 완성

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시)
- scope: release, docs
- changed:
  - package.json (1.10.0 → 1.11.0), tests/verification.test.js (버전 assertion → 1.11.0)
  - CHANGELOG.md, CHANGELOG.ko.md (1.11.0 항목)
  - docs/llm-wiki/releases/v1.11.0.md (신규 릴리스 노트)
  - docs/llm-wiki/DOMAIN_FEATURES.md, ARCHITECTURE_CONVENTIONS.md (cross-repo doc-sync; verified → needs_review)
  - ROADMAP.md, ROADMAP.ko.md (1.11 섹션에 1.11.0 출시 + 1.7–1.11 라인 완성 표기)
- summary:
  - Gate 16 1.11.0(cross-repository knowledge links): 예약 cross-repo 참조 스킴(`repo:<name>/<path>`+http(s)) 인식(recognize-don't-verify)을 릴리스 준비했다. MINOR bump. 지식 문서 2개 doc-sync → needs_review(PUBLIC_API는 명령/JSON/옵션 표면 변경 없어 verified 유지). **이로써 분할된 1.7–1.11 로드맵 라인이 완성된다.**
- caveats:
  - 배포 전 검증: node --test 203 pass, validate 0, validate-frontmatter --strict 0, npm pack v1.11.0 확인 예정.
  - RE-VERIFY 부채: DOMAIN_FEATURES/ARCHITECTURE_CONVENTIONS (배포 후 사람 검토로 verified 재승인 필요).
  - 태그·push는 사용자 "배포" 승인 후.

## 2026-07-15 - feat: cross-repo knowledge links (recognize-don't-verify) — 1.11.0, Gate 16

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시)
- scope: code, tests
- changed:
  - src/commands.js (`isCrossRepoReference`[`repo:<name>/<path>`] 헬퍼; `isExternalSourceReference`에 반영; wiki-link 해석기에 external 스킵 추가)
  - tests/verification.test.js (+2: cross-repo/URL 참조 미flag, 로컬 미해결 링크는 여전히 flag)
- summary:
  - Gate 16 1.11.0(로드맵 마지막 마이너). 예약 cross-repo 참조 스킴 `repo:<name>/<path>`(+ 기존 http(s))를 인식한다. `isExternalSourceReference`를 확장해 source_files/evidence/related/markdown가 이를 external로 처리(missing 미flag)하고, wiki-link 해석기에도 external 스킵을 추가해 cross-repo/URL wiki 링크가 false wiki_link.missing을 안 낸다. **절대 fetch/verify하지 않음**(network/git 없음, zero-dep). additive: 로컬 해석 불변(진짜 미해결 로컬 링크는 여전히 flag). 203 pass, 레포 validate 0.
- evidence:
  - src/commands.js#symbol:isCrossRepoReference
  - src/commands.js#symbol:isExternalSourceReference
- caveats:
  - 지식 문서 doc-sync는 1.11.0 release-prep에서 일괄. 실제 fetch/resolve는 out of scope(future major).

## 2026-07-15 - docs: Gate 16 accepted_for_1.11.0 (cross-repo links)

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 검토·수락)
- scope: docs
- changed:
  - GATE_REVIEW.md (Gate 16 `proposed_for_1.11.0` → `accepted_for_1.11.0`)
- summary:
  - 마지막 마이너 1.11 cross-repo links의 Gate 16을 사람 검토로 `accepted_for_1.11.0`으로 승격했다. 스코프: 예약 cross-repo 참조 스킴(`repo:<name>/<path>`+http(s))을 wiki 링크·source_files/evidence/related에서 인식, missing-target 규칙 제외, 절대 fetch/verify 안 함(zero-dep), `isExternalSourceReference` 확장. 이로써 1.11 피처 코드 착수 가능.
- caveats:
  - validate 0, validate-frontmatter --strict clean.

## 2026-07-15 - docs: 1.11 준비 — Gate 16 (cross-repo links) proposed 초안

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시)
- scope: docs
- changed:
  - GATE_REVIEW.md (Gate 16 표 행 + "Cross-Repository Links Scope Decision (proposed for 1.11.0)" 섹션)
- summary:
  - 마지막 마이너 1.11 cross-repo knowledge links의 스코프를 코드 전에 Gate 16으로 초안화했다(`proposed_for_1.11.0`, 아직 accepted 아님). 스코프: 예약 cross-repo 참조 스킴(`repo:<name>/<path>` + 기존 http(s))을 wiki 링크(이중 대괄호 표기)와 source_files/evidence/related에서 인식. 인식된 참조는 external로 처리해 missing-target 규칙(wiki_link.missing/related.missing/source_files.missing/evidence.missing/markdown_link.missing)에서 제외하되 **절대 fetch/verify하지 않음**(network/git 없음, zero-dep). ready-now slice: 분류기를 강화해 cross-repo wiki 링크가 false wiki_link.missing을 안 내게. additive(로컬 해석 불변).
- caveats:
  - Gate 16은 proposed 단계다. 사람 검토·수락(accepted_for_1.11.0) 전까지 1.11 코드 착수하지 않는다.
  - validate 0, validate-frontmatter --strict clean.

## 2026-07-15 - docs: 1.10.0 monorepo 문서 3개 verified 재승인

- status: verified
- actor: Claude Code (사용자 Dowon-Kim 검토·승인)
- scope: docs
- changed:
  - docs/llm-wiki/PUBLIC_API.md, DOMAIN_FEATURES.md, ARCHITECTURE_CONVENTIONS.md (needs_review → verified)
- summary:
  - 1.10.0 doc-sync(monorepo profile)로 needs_review로 내려갔던 지식 문서 3개를 사람 검토·승인에 따라 `verified`로 재승인했다(`reviewed_by: Dowon-Kim`·`reviewed_at: 2026-07-15`). 이로써 1.10.0 재검토 부채가 없다.
- caveats:
  - `reviewed_at: 2026-07-15`가 같은날 src 변경을 end-of-day 기준으로 커버하므로 `evidence.stale` 없음. validate 0, strict clean.

## 2026-07-15 - release: 1.10.0 준비 (monorepo profile)

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시)
- scope: release, docs
- changed:
  - package.json (1.9.0 → 1.10.0), tests/verification.test.js (버전 assertion → 1.10.0)
  - CHANGELOG.md, CHANGELOG.ko.md (1.10.0 항목)
  - docs/llm-wiki/releases/v1.10.0.md (신규 릴리스 노트)
  - docs/llm-wiki/PUBLIC_API.md, DOMAIN_FEATURES.md, ARCHITECTURE_CONVENTIONS.md (monorepo doc-sync; verified → needs_review)
  - ROADMAP.md, ROADMAP.ko.md (1.10 섹션에 1.10.0 출시 표기)
- summary:
  - Gate 15 1.10.0(monorepo profile): opt-in `monorepo` 명령(npm/yarn workspaces 감지 후 패키지별 validate 집계, additive `packages[]`, 단일 레포 byte-identical, 패키지별 config, pnpm/YAML unsupported)을 릴리스 준비했다. MINOR bump(새 명령). PUBLIC_API도 명령 표면 변경이라 doc-sync(3개 문서 needs_review). 다음 예정 1.11 cross-repo links(마지막).
- caveats:
  - 배포 전 검증: node --test 201 pass, validate 0, validate-frontmatter --strict 0, npm pack v1.10.0 확인 예정.
  - RE-VERIFY 부채: PUBLIC_API/DOMAIN_FEATURES/ARCHITECTURE_CONVENTIONS (배포 후 사람 검토로 verified 재승인 필요).
  - 태그·push는 사용자 "배포" 승인 후.

## 2026-07-15 - feat: monorepo profile (per-package 검증) — 1.10.0, Gate 15

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시)
- scope: code, tests
- changed:
  - src/detector.js (`detectWorkspaces`: npm/yarn `workspaces` 감지 + `/*` glob·literal 확장; pnpm/YAML은 unsupported 보고)
  - src/commands.js (`monorepoCommand`: 패키지별 validate + additive `packages[]`·패키지 prefix된 flattened findings 집계; 패키지별 loadProjectConfig/mergeConfigIntoOptions)
  - src/cli.js (`monorepo` 명령 등록 + help), src/index.js (commands 맵 + 개별 export)
  - tests/verification.test.js (파리티 목록에 monorepo 추가 + 3: workspaces 감지·집계·skip, single/pnpm unsupported, 패키지별 config 적용)
- summary:
  - Gate 15 1.10.0. `llm-wiki monorepo`가 npm/yarn `workspaces`를 감지해 각 패키지의 `docs/llm-wiki`를 validate하고 집계한다. additive `packages[]`(패키지별 roll-up)과 패키지 경로 prefix된 flattened `findings`는 이 명령에만 나타나 단일 레포 출력은 byte-identical 유지. 각 패키지는 자기 `llm-wiki.config.json`을 반영(패키지별 config 로드). pnpm/`pnpm-workspace.yaml`은 zero-dep 위해 미파싱(unsupported로 보고). read-only 집계. 201 pass, 레포 validate 0.
- evidence:
  - src/detector.js#symbol:detectWorkspaces
  - src/commands.js#symbol:monorepoCommand
- caveats:
  - 지식 문서 doc-sync는 1.10.0 release-prep에서 일괄. deeper glob(`dir/**`)·pnpm/YAML은 후속(Gate 15 out of scope 명시).

## 2026-07-15 - docs: Gate 15 accepted_for_1.10.0 (monorepo profile)

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 검토·수락)
- scope: docs
- changed:
  - GATE_REVIEW.md (Gate 15 `proposed_for_1.10.0` → `accepted_for_1.10.0`)
- summary:
  - 1.10 monorepo profile의 Gate 15를 사람 검토로 `accepted_for_1.10.0`으로 승격했다. 스코프: npm/yarn workspaces 감지(pnpm/YAML defer) + opt-in 패키지별 파이프라인 실행 + additive packages[] JSON(단일 레포 byte-identical) + tests/fixtures monorepo 픽스처 + 패키지별 config. read-only·zero-dep 유지. 이로써 1.10 피처 코드 착수 가능.
- caveats:
  - validate 0, validate-frontmatter --strict clean.

## 2026-07-15 - docs: 1.10 준비 — Gate 15 (monorepo profile) proposed 초안

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시)
- scope: docs
- changed:
  - GATE_REVIEW.md (Gate 15 표 행 + "Monorepo Profile Scope Decision (proposed for 1.10.0)" 섹션)
- summary:
  - 1.10 monorepo profile의 스코프를 코드 전에 Gate 15로 초안화했다(`proposed_for_1.10.0`, 아직 accepted 아님). 스코프: (1) `detector.js`에 npm/yarn `workspaces` 감지(pnpm/YAML은 zero-dep 위해 defer, unsupported로 보고), (2) 기존 cwd-파라미터라이즈드 read 파이프라인(audit/collectWikiGraph/findMissingDocs)을 패키지별 실행·집계, (3) strictly additive `packages[]` JSON(단일 레포 출력 byte-identical 유지), (4) tests/fixtures/에 monorepo 픽스처. 각 패키지는 자기 `llm-wiki.config.json`을 resolveOptions로 반영. read-only, zero-dep 불변(YAML 파서 미도입).
- caveats:
  - Gate 15는 proposed 단계다. 사람 검토·수락(accepted_for_1.10.0) 전까지 1.10 코드 착수하지 않는다.
  - validate 0, validate-frontmatter --strict clean.

## 2026-07-15 - docs: 1.9.0 visibility 문서 2개 verified 재승인

- status: verified
- actor: Claude Code (사용자 Dowon-Kim 검토·승인)
- scope: docs
- changed:
  - docs/llm-wiki/DOMAIN_FEATURES.md, ARCHITECTURE_CONVENTIONS.md (needs_review → verified)
- summary:
  - 1.9.0 doc-sync(visibility governance)로 needs_review로 내려갔던 지식 문서 2개를 사람 검토·승인에 따라 `verified`로 재승인했다(`reviewed_by: Dowon-Kim`·`reviewed_at: 2026-07-15`). 이로써 1.9.0 재검토 부채가 없다.
- caveats:
  - `reviewed_at: 2026-07-15`가 같은날 src 변경을 end-of-day 기준으로 커버하므로 `evidence.stale` 없음. validate 0, strict clean.

## 2026-07-15 - release: 1.9.0 준비 (visibility governance)

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시)
- scope: release, docs
- changed:
  - package.json (1.8.1 → 1.9.0), tests/verification.test.js (버전 assertion → 1.9.0)
  - CHANGELOG.md, CHANGELOG.ko.md (1.9.0 항목)
  - docs/llm-wiki/releases/v1.9.0.md (신규 릴리스 노트)
  - docs/llm-wiki/DOMAIN_FEATURES.md, ARCHITECTURE_CONVENTIONS.md (visibility governance doc-sync; verified → needs_review)
  - ROADMAP.md, ROADMAP.ko.md (1.9 섹션에 1.9.0 출시 표기)
- summary:
  - Gate 14 1.9.0(visibility governance): opt-in 일관성 린트 2개(`visibility.public_sensitive`·`visibility.declared_mismatch`, sensitive-info 스캔 재사용, 기본 off·warning·read-only, 값 미노출) + 정책 문서 VISIBILITY.md(이미 verified). MINOR bump. 지식 문서 2개 doc-sync → needs_review(PUBLIC_API는 rules 메커니즘만 문서화해 계약 변경 없음 → verified 유지). 다음 예정 1.10 monorepo.
- caveats:
  - 배포 전 검증: node --test 198 pass, validate 0, validate-frontmatter --strict 0, npm pack v1.9.0 확인 예정.
  - RE-VERIFY 부채: DOMAIN_FEATURES/ARCHITECTURE_CONVENTIONS (배포 후 사람 검토로 verified 재승인 필요).
  - 태그·push는 사용자 "배포" 승인 후.

## 2026-07-15 - feat: visibility governance opt-in 일관성 rule 2개 (1.9.0, Gate 14)

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시)
- scope: code, tests
- changed:
  - src/commands.js (`FINDING_EXPLANATIONS`에 `visibility.public_sensitive`·`visibility.declared_mismatch`[warning] 등록; `scanVisibilityConsistency`; audit/status 배선)
  - tests/verification.test.js (+2: public_sensitive opt-in·no-leak, declared_mismatch)
- summary:
  - Gate 14 1.9.0. sensitive-info 스캔을 재사용하는 opt-in 일관성 rule 2개. `visibility.public_sensitive`: `visibility: public` 문서에 민감값. `visibility.declared_mismatch`: `contains_sensitive_info: false`인데 민감값. 둘 다 기본 off(config `rules`로 활성화, `content.thin_body` 패턴), warning, read-only. **민감값은 finding에 절대 노출하지 않는다**(redacted count만; 실측 leak 0). `sensitive.*`는 여전히 비토글. 접근 통제 아님(값-내용 일관성만). 기본 off라 레포 자신의 validate 0 유지.
- evidence:
  - src/commands.js#symbol:scanVisibilityConsistency
- caveats:
  - 지식 문서 doc-sync는 1.9.0 release-prep에서 일괄. 198 pass, 레포 validate 0.

## 2026-07-15 - docs: Gate 14 accepted_for_1.9.0 + VISIBILITY.md verified

- status: verified
- actor: Claude Code (사용자 Dowon-Kim 검토·수락)
- scope: docs
- changed:
  - GATE_REVIEW.md (Gate 14 `proposed_for_1.9.0` → `accepted_for_1.9.0`)
  - docs/llm-wiki/VISIBILITY.md (needs_review → verified)
- summary:
  - 1.9 visibility governance의 Gate 14를 사람 검토로 `accepted_for_1.9.0`으로 승격하고, 정책 문서 `VISIBILITY.md`를 `verified`로 승인했다(reviewed_by: Dowon-Kim, reviewed_at: 2026-07-15). 스코프: opt-in 일관성 rule 2개(`visibility.public_sensitive`, `visibility.declared_mismatch`) — 기본 off·warning·read-only, 1.8 config `rules`로 활성화, 절대 default error/blocked 금지, sensitive-info 스캔 재사용, `sensitive.*` 비토글, 접근 통제 아님.
- caveats:
  - 이로써 1.9 피처 코드 착수 가능. validate 0, validate-frontmatter --strict clean.

## 2026-07-15 - docs: 1.9 준비 — visibility 정책 문서 + Gate 14 proposed 초안

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시)
- scope: docs
- changed:
  - docs/llm-wiki/VISIBILITY.md (신규 정책 문서, needs_review) — project-profile Open Question 해소용 설계 입력
  - GATE_REVIEW.md (Gate 14 표 행 + "Visibility Governance Scope Decision (proposed for 1.9.0)" 섹션)
- summary:
  - 1.9 visibility governance의 blocker(정책 문서 + 게이트)를 코드 전에 준비했다. `docs/llm-wiki/VISIBILITY.md`가 internal/restricted/public 의미와 public-vs-content 일관성 정책을 정의한다. Gate 14(`proposed_for_1.9.0`, 아직 accepted 아님)는 opt-in 일관성 rule 2개(`visibility.public_sensitive`, `visibility.declared_mismatch`)를 스코프한다: 기본 off·warning·read-only, 1.8 config `rules` 토글로 활성화, 절대 default error/blocked 금지(additive 불변식). sensitive-info 스캔 재사용, 접근 통제 아님. `sensitive.*`는 여전히 비토글.
- caveats:
  - Gate 14는 proposed 단계다. 사람 검토·수락(accepted_for_1.9.0) 전까지 1.9 코드 착수하지 않는다. VISIBILITY.md는 사람 검토 전까지 needs_review.
  - validate 0, validate-frontmatter --strict clean.

## 2026-07-15 - docs: 1.8.1 config 피처 문서 3개 verified 재승인

- status: verified
- actor: Claude Code (사용자 Dowon-Kim 검토·승인)
- scope: docs
- changed:
  - docs/llm-wiki/PUBLIC_API.md, DOMAIN_FEATURES.md, ARCHITECTURE_CONVENTIONS.md (needs_review → verified)
- summary:
  - 1.8.1 doc-sync(커스텀 문서셋·템플릿 오버라이드)로 needs_review로 내려갔던 지식 문서 3개를 사람 검토·승인에 따라 `verified`로 재승인했다(`reviewed_by: Dowon-Kim`·`reviewed_at: 2026-07-15`, 리뷰 노트를 재승인 문구로 갱신). 이로써 1.8.1 재검토 부채가 없다.
- caveats:
  - `reviewed_at: 2026-07-15`가 같은날 src 변경을 end-of-day 기준으로 커버하므로 `evidence.stale` 없음. validate 0, validate-frontmatter --strict clean. Gate 13 config schema growth 완성.

## 2026-07-15 - release: 1.8.1 준비 (config schema growth 2부 — 커스텀 문서셋 + 템플릿 오버라이드)

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시)
- scope: release, docs
- changed:
  - package.json (1.8.0 → 1.8.1), tests/verification.test.js (버전 assertion → 1.8.1)
  - CHANGELOG.md, CHANGELOG.ko.md (1.8.1 항목)
  - docs/llm-wiki/releases/v1.8.1.md (신규 릴리스 노트)
  - docs/llm-wiki/PUBLIC_API.md, DOMAIN_FEATURES.md, ARCHITECTURE_CONVENTIONS.md (requiredDocs·templates doc-sync; verified → needs_review)
  - ROADMAP.md, ROADMAP.ko.md (1.8 섹션을 "Gate 13 완성"으로 갱신)
- summary:
  - Gate 13 config 3피처의 나머지 둘(커스텀 문서셋 `requiredDocs` + 템플릿 오버라이드 `templates`)을 1.8.1로 릴리스 준비했다. 커밋 e325e27(커스텀 문서셋)·6e1cfef(템플릿 오버라이드, body-only never-verified 가드레일). 이로써 Gate 13 config schema growth가 완성된다(다음 예정 1.9 visibility governance). 지식 문서 3개 doc-sync → needs_review.
- caveats:
  - 배포 전 검증: node --test 196 pass, validate 0, validate-frontmatter --strict 0, npm pack v1.8.1 확인 예정.
  - RE-VERIFY 부채: PUBLIC_API/DOMAIN_FEATURES/ARCHITECTURE_CONVENTIONS (배포 후 사람 검토로 verified 재승인 필요).
  - 태그·push는 사용자 "배포" 승인 후.

## 2026-07-15 - feat: 템플릿 오버라이드 (config templates, never-verified 가드레일) — Gate 13, 1.8.x

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시)
- scope: code, tests
- changed:
  - src/config-file.js (config `templates`[obj str→str] 검증 + 병합)
  - src/cli.js (`defaultOptions`에 `templates: {}`)
  - src/commands.js (`renderOverriddenDoc`[body-only 가드레일]; initWrite/initDryRun 오버라이드 인식; doctor echo `templates=N`; `renderTemplate` import)
  - tests/verification.test.js (+3: templates 검증 / verified 가드레일 / 누락 fallback)
- summary:
  - Gate 13 마지막 피처(템플릿 오버라이드). config `templates`로 생성 문서를 프로젝트-로컬 템플릿에서 만든다. **핵심 안전 설계: 오버라이드는 body만 사용** — frontmatter는 항상 CLI 생성(`status: needs_review`)이라 오버라이드가 절대 `verified`를 만들 수 없다(오버라이드 파일의 frontmatter는 파싱 후 폐기). 오버라이드 파일 부재 시 built-in 폴백 + skipped 노트. `doctor`가 개수 echo. 실측: 오버라이드가 `status:verified`를 담아도 생성 문서는 `needs_review`.
- evidence:
  - src/commands.js#symbol:renderOverriddenDoc
- caveats:
  - 지식 문서 doc-sync는 1.8.1 release-prep에서 일괄. 196 pass, 레포 validate 0. 이로써 Gate 13의 3개 피처(rule 토글·커스텀 문서셋·템플릿 오버라이드) 모두 구현 완료.

## 2026-07-15 - feat: 커스텀 문서셋 (config requiredDocs) — Gate 13, 1.8.x

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시)
- scope: code, tests
- changed:
  - src/config-file.js (config `requiredDocs`[string[]] 검증 + 병합)
  - src/cli.js (`defaultOptions`에 `requiredDocs: []`)
  - src/commands.js (`findMissingDocs`가 customDocs를 required 목록에 병합[dedupe]; audit/status 호출부 갱신; doctor echo에 `requiredDocs=N`)
  - tests/verification.test.js (+2: requiredDocs 검증 / 누락→structure.required_doc·존재→해소)
- summary:
  - Gate 13의 두 번째 피처(커스텀 문서셋). config `requiredDocs`로 프로젝트가 core/profile 필수 문서 목록에 자체 문서를 추가하면 같은 `structure.required_doc` 검사가 audit/status/validate에 적용된다. **검증 전용**(init 자동생성 아님 — 임의 이름엔 템플릿이 없음). `doctor`가 개수를 echo. additive·opt-in, 1.0.0 계약·zero-dep 불변.
- evidence:
  - src/commands.js#symbol:findMissingDocs
- caveats:
  - 지식 문서 doc-sync는 1.8.x release-prep에서 일괄. 193 pass, 레포 validate 0.

## 2026-07-15 - docs: 1.8.0 rule-toggle 문서 3개 verified 재승인

- status: verified
- actor: Claude Code (사용자 Dowon-Kim 검토·승인)
- scope: docs
- changed:
  - docs/llm-wiki/PUBLIC_API.md, DOMAIN_FEATURES.md, ARCHITECTURE_CONVENTIONS.md (needs_review → verified)
- summary:
  - 1.8.0 rule-토글 doc-sync로 needs_review로 내려갔던 지식 문서 3개를 사람 검토·승인에 따라 `verified`로 재승인했다(`reviewed_by: Dowon-Kim`·`reviewed_at: 2026-07-15`, 리뷰 노트를 재승인 문구로 갱신). 이로써 1.8.0 재검토 부채가 없다(log.md·releases/*.md만 관례상 needs_review).
- caveats:
  - `reviewed_at: 2026-07-15`가 같은날 src 변경을 end-of-day 기준으로 커버하므로 `evidence.stale` 없음. validate 0, validate-frontmatter --strict clean.

## 2026-07-15 - release: 1.8.0 준비 (config schema growth — rule 토글)

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시)
- scope: release, docs
- changed:
  - package.json (1.7.2 → 1.8.0), tests/verification.test.js (버전 assertion → 1.8.0)
  - CHANGELOG.md, CHANGELOG.ko.md (1.8.0 항목)
  - docs/llm-wiki/releases/v1.8.0.md (신규 릴리스 노트)
  - docs/llm-wiki/PUBLIC_API.md, DOMAIN_FEATURES.md, ARCHITECTURE_CONVENTIONS.md (rule 토글 doc-sync; verified → needs_review)
  - ROADMAP.md, ROADMAP.ko.md (1.8 섹션에 1.8.0 출시 표기)
- summary:
  - Gate 13 1.8.0(config schema growth 첫 피처): per-project rule 토글(`rules` 맵; 중앙 `applyRuleConfig`, `sensitive.*` 안전 비토글) + opt-in lint `content.thin_body`(기본 off)를 릴리스 준비했다. MINOR bump(피처 추가). severity 수렴 pre-work는 감사로 동작 보존 확인. 커스텀 문서셋·템플릿 오버라이드는 `1.8.x` 잔여. 지식 문서 3개 doc-sync → needs_review.
- caveats:
  - 배포 전 검증: node --test 191 pass, validate 0, validate-frontmatter --strict 0, npm pack v1.8.0 확인 예정.
  - RE-VERIFY 부채: PUBLIC_API/DOMAIN_FEATURES/ARCHITECTURE_CONVENTIONS (배포 후 사람 검토로 verified 재승인 필요).
  - 태그·push는 사용자 "배포" 승인 후. log.md·releases/*.md는 관례상 needs_review 유지.

## 2026-07-15 - feat: content.thin_body opt-in lint (1.8.0 dogfood)

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시)
- scope: code, tests
- changed:
  - src/commands.js (`FINDING_EXPLANATIONS`에 `content.thin_body`[warning] 등록; `scanThinBody`+`bodyProseWordCount`; audit/status 배선)
  - tests/verification.test.js (+1: 기본 off / opt-in 생성)
- summary:
  - rule-토글 기계를 dogfood하는 첫 opt-in lint. `content.thin_body`는 레지스트리에 등록되지만 기본 INERT — config `rules`에서 명시 활성화(예: `"content.thin_body":"warning"`)해야 wiki 콘텐츠 문서의 얇은 본문(prose 단어 < 25)을 표시한다. placeholder 문서는 `content.not_enriched` 담당이라 제외, append-only log 제외. severity는 config로 override 가능(warning→error 확인). 기본 off라 레포 자신의 validate 0은 유지된다.
- evidence:
  - src/commands.js#symbol:scanThinBody
- caveats:
  - 지식 문서 doc-sync는 1.8.0 release-prep에서 일괄. 191 pass, 레포 validate 0.

## 2026-07-15 - feat: per-project rule toggles (1.8.0 config schema growth)

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시)
- scope: code, tests
- changed:
  - src/config-file.js (config `rules` 맵 검증 + 병합; `RULE_TOGGLE_ACTIONS`)
  - src/cli.js (`defaultOptions`에 `rules: {}`)
  - src/commands.js (중앙 `applyRuleConfig` 적용: audit/status/validate-frontmatter; `NON_TOGGLEABLE_CATEGORIES` 안전 가드; doctor echo에 `rules=N`)
  - tests/verification.test.js (+3: rules 검증 / off·override 재등급 / sensitive 비토글 안전)
- summary:
  - Gate 13 1.8.0 첫 피처. `llm-wiki.config.json`에 `rules: { "rule.id": "off"|"blocked"|"error"|"warning"|"info" }`를 추가해 프로젝트가 개별 finding rule을 끄거나 severity를 재정의한다. EP1의 통합 옵션 해석(`resolveOptions`)을 타고 CLI/API/MCP 모두에서 동일 적용. 중앙 `applyRuleConfig`가 audit/status/validate-frontmatter의 findings에 idempotent하게 적용된다. 레지스트리(`FINDING_EXPLANATIONS`) rule만 토글 대상이며, **안전 불변식으로 `sensitive.*` 카테고리는 절대 토글 불가**(민감정보 탐지를 config로 끌 수 없음). `doctor`가 활성 토글 수를 echo. additive·opt-in, 1.0.0 계약·zero-dep 불변.
- evidence:
  - src/commands.js#symbol:applyRuleConfig
  - src/config-file.js#symbol:loadProjectConfig
- caveats:
  - severity 수렴 pre-work는 감사로 이미 동작 보존 확인(불일치 0); 토글은 rule 단위 중앙 override라 push 지점 재작성 불필요.
  - 지식 문서 doc-sync는 1.8.0 release-prep에서 일괄. 테스트 190 pass, validate 0.

## 2026-07-15 - docs: Gate 13 accepted_for_1.8.0 (config schema growth)

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 검토·수락)
- scope: docs
- changed:
  - GATE_REVIEW.md (Gate 13 `proposed_for_1.8.0` → `accepted_for_1.8.0`; 점진 딜리버리·severity 감사 결과 반영)
- summary:
  - Gate 13(1.8 config schema growth)을 사람 검토로 `accepted_for_1.8.0`으로 승격했다. 딜리버리는 점진: enabling-prep는 1.7.2로 출시됨, `1.8.0` = pre-work(인라인 severity를 `FINDING_EXPLANATIONS` 단일 레지스트리로 수렴[2026-07-15 감사: push 지점 severity 불일치 0 → 동작 보존] + 템플릿 오버라이드가 `status: verified`를 절대 못 만드는 가드레일) + per-project **rule 토글**; **커스텀 문서셋**·**템플릿 오버라이드**는 `1.8.x`로 후속. `blocked` 제어 findings 3개(`explain.unknown_rule`/`init.write_blocked`/`sensitive.release_body`)는 레지스트리 밖·토글 비대상.
- caveats:
  - 이로써 1.8 피처 코드 착수 가능. 실제 착수는 사용자 지시 후.

## 2026-07-15 - docs: 1.7.2 doc-synced 문서 3개 verified 재승인

- status: verified
- actor: Claude Code (사용자 Dowon-Kim 검토·승인)
- scope: docs
- changed:
  - docs/llm-wiki/PUBLIC_API.md, DOMAIN_FEATURES.md, ARCHITECTURE_CONVENTIONS.md (needs_review → verified)
- summary:
  - 1.7.2 EP1/EP2 doc-sync로 needs_review로 내려갔던 지식 문서 3개를 사람 검토·승인에 따라 `verified`로 재승인했다(`verified` 태그·`reviewed_by: Dowon-Kim`·`reviewed_at: 2026-07-15`, 리뷰 노트를 재승인 문구로 갱신). 이로써 1.7.2 재검토 부채가 없다(log.md·releases/*.md만 관례상 needs_review).
- caveats:
  - `reviewed_at: 2026-07-15`가 같은날 src 변경을 end-of-day 기준으로 커버하므로 `evidence.stale` 없음. validate 0, validate-frontmatter --strict clean.

## 2026-07-15 - release: 1.7.2 준비 (EP1+EP2 enabling-prep, config 일관화)

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시)
- scope: release, docs
- changed:
  - package.json (1.7.1 → 1.7.2), tests/verification.test.js (버전 assertion → 1.7.2)
  - CHANGELOG.md, CHANGELOG.ko.md (1.7.2 항목: Added resolveOptions·config scaffold·doctor echo / Changed MCP config 병합)
  - docs/llm-wiki/releases/v1.7.2.md (신규 릴리스 노트)
  - docs/llm-wiki/PUBLIC_API.md, DOMAIN_FEATURES.md, ARCHITECTURE_CONVENTIONS.md (EP1/EP2 doc-sync; verified → needs_review)
  - ROADMAP.md, ROADMAP.ko.md (enabling-prep EP1/EP2를 1.7.2 출시로 표기)
- summary:
  - EP1(config 로딩 CLI/API/MCP 일원화 + `resolveOptions`)과 EP2(init/quickstart starter config scaffold + doctor effective-config echo)를 묶어 1.7.2로 릴리스 준비했다. Gate 13(1.8 config schema growth)의 enabling-prep으로, config 실사용을 축적하기 위한 additive 패치다. CLI·JSON·프로그래매틱 API·frontmatter 계약과 zero-dep 불변. 지식 문서 3개는 doc-sync로 needs_review로 내렸다.
- caveats:
  - 배포 전 검증: node --test 187 pass, validate 0, validate-frontmatter --strict 0, npm pack 확인 예정.
  - RE-VERIFY 부채: PUBLIC_API/DOMAIN_FEATURES/ARCHITECTURE_CONVENTIONS (배포 후 사람 검토로 verified 재승인 필요).
  - 태그·push는 사용자 "배포" 승인 후. log.md·releases/*.md는 관례상 needs_review 유지.

## 2026-07-15 - feat: EP2 starter config scaffold + doctor echo — 1.7.2 enabling-prep

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시)
- scope: code, tests
- changed:
  - src/commands.js (init/quickstart가 최소 llm-wiki.config.json을 scaffold: `scaffoldProjectConfig` 헬퍼 — additive·preview-first·기존 파일 절대 미덮어씀[--existing overwrite에서도]; `doctor`가 `describeEffectiveConfig`로 config 선언 키[type/profiles/agents/strict]를 echo; config-file.js import 추가)
  - tests/verification.test.js (doctor echo 테스트 갱신 + EP2 4개: doctor invalid echo, init scaffold, init never-overwrite, init dry-run preview)
- summary:
  - Gate 13 enabling-prep #2. `init`/`quickstart --write`가 감지된 type과 선택된 agents를 담은 최소 starter config를 생성하고(quickstart는 initCommand 위임으로 자동 상속), dry-run은 미리보기만 한다. 기존 config는 append-only log처럼 사용자 소유로 보고 절대 덮어쓰지 않는다. `doctor`는 이제 `llm_wiki_config: present (type=..., agents=...)`처럼 effective config를 echo해 Gate 13의 "실사용" 전제를 관측 가능하게 만든다. EP1과 함께 1.7.2 patch로 배포 예정. additive·preview-first, 1.0.0 계약·zero-dep 불변.
- evidence:
  - src/commands.js#symbol:scaffoldProjectConfig
  - src/commands.js#symbol:describeEffectiveConfig
- caveats:
  - 지식 문서 doc-sync(DOMAIN_FEATURES/PUBLIC_API 등)는 1.7.2 release-prep에서 EP1과 함께 일괄 반영한다.
  - 테스트 187 pass. validate/validate-frontmatter 0. 실제 init/doctor 구동으로 scaffold·skip·echo 확인.

## 2026-07-15 - feat: EP1 config 로딩 일원화 (CLI/API/MCP 동일 effective options) — 1.7.2 enabling-prep

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시)
- scope: code, tests
- changed:
  - src/cli.js (인라인 config 로드+병합+agent 재정규화를 공유 export `applyProjectConfig`로 추출; main()은 이를 호출 — 동작 보존)
  - src/index.js (async `resolveOptions` 추가·export: normalizeOptions + applyProjectConfig; 동기 normalizeOptions 계약 불변)
  - src/mcp/dispatch.js (handleToolCall이 normalizeOptions 대신 resolveOptions 사용 → MCP가 프로젝트 llm-wiki.config.json 반영; malformed config는 isError로 표면화)
  - tests/verification.test.js (+4 resolveOptions), tests/mcp.test.js (+2 MCP config)
- summary:
  - Gate 13 enabling-prep #1. 지금까지 config 병합은 CLI(main)에만 있었고 1.5 프로그래매틱 API·1.6 MCP는 llm-wiki.config.json을 무시했다(Gate 11 honest limit). 공유 `applyProjectConfig`로 로직을 한 곳에 모으고, index.js가 config-aware async `resolveOptions`를 추가 export하며, MCP dispatcher가 이를 호출하도록 해 세 표면이 동일한 effective options를 얻는다. additive: 동기 normalizeOptions·프로즌 commands 맵·1.0.0 계약 불변, zero-dep 유지. 실사용 축적을 위해 EP2(starter config scaffold + doctor echo)와 함께 1.7.2 patch로 배포 예정.
- evidence:
  - src/cli.js#symbol:applyProjectConfig
  - src/index.js#symbol:resolveOptions
  - src/mcp/dispatch.js#symbol:handleToolCall
- caveats:
  - 지식 문서 doc-sync(PUBLIC_API/DOMAIN_FEATURES/ARCHITECTURE_CONVENTIONS)는 1.7.2 release-prep에서 EP2와 함께 일괄 반영한다.
  - 테스트 183 pass. validate/validate-frontmatter 0 findings.

## 2026-07-15 - docs: Gate 13 (1.8 config schema growth) proposed 초안

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시·결정)
- scope: docs
- changed:
  - GATE_REVIEW.md (Gate 13 표 행 + "Config Schema Growth Scope Decision (proposed for 1.8.0)" 섹션; source_files에 src/config-file.js 추가)
- summary:
  - 1.8(config schema growth)의 스코프를 코드 전에 Gate 13으로 초안화했다(`proposed_for_1.8.0`, 아직 accepted 아님). 스코프: per-project rule 토글(FINDING_EXPLANATIONS를 severity 단일 진실원으로 수렴) + 커스텀 문서셋 + 템플릿 오버라이드(verified 금지 하드 가드레일). enabling-prep(config 로딩을 CLI/프로그래매틱 API/MCP에 일원화 + starter config scaffold + doctor echo)를 1.7.x patch로 먼저 배포해 config 실사용을 축적한 뒤 1.8을 pull하는 순서를 명시했다. additive·opt-in·1.0.0 계약 불변·zero-dep·preview-first 유지. 1.7 Gate 12 draft→accepted 선례를 따른다.
- caveats:
  - proposed 단계다. 사람 검토·수락(accepted_for_1.8.0) 전까지 1.8 코드에 착수하지 않는다.
  - GATE_REVIEW.md는 docs/llm-wiki/ 밖이라 validate/validate-frontmatter 스캔 대상이 아니다.

## 2026-07-15 - release: 1.7.1 준비 (commands.js NUL 바이트 제거 + LF 재정규화)

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시)
- scope: code, docs
- changed:
  - src/commands.js (wikiGraph 엣지 키의 날것 U+0000 → `\\u0000` 이스케이프; 파일 CRLF→LF 재정규화)
  - package.json (1.7.0 → 1.7.1)
  - tests/verification.test.js (버전 assertion 1.7.0 → 1.7.1)
  - CHANGELOG.md, CHANGELOG.ko.md (1.7.1 항목)
  - docs/llm-wiki/releases/v1.7.1.md (신규 릴리스 노트)
- summary:
  - `src/commands.js`가 `wikiGraph` 엣지 중복제거 키(`collectWikiGraph` → `addEdge`)의 구분자로 날것의 NUL(U+0000) 제어 바이트를 소스에 담고 있어, git `text=auto`가 파일을 바이너리로 분류했다. 그 결과 `.gitattributes`의 `eol=lf` 정규화에서 이 파일 하나만 제외되어 CRLF로 저장돼 있었다. 날것 바이트를 `\\u0000` 이스케이프로 교체(런타임 문자열 불변)하고 `git add --renormalize`로 LF로 정규화해, 다른 모든 소스 파일과 동일한 줄바꿈 정책에 편입시켰다. 순수 저장소 위생 패치로 CLI·JSON·프로그래매틱 API·frontmatter·런타임 동작 변경은 없다.
- evidence:
  - src/commands.js#symbol:collectWikiGraph
  - .gitattributes
- caveats:
  - 커밋 diff 대부분은 commands.js의 일회성 CRLF→LF 재정규화다(실제 내용 변경은 1줄).
  - 릴리스 노트/로그는 관례상 needs_review로 유지한다. 태그·push는 별도 승인 후 진행한다.

## 2026-07-15 - docs: 1.7 doc-sync 문서 6개 verified 재승인

- status: verified
- actor: Claude Code (사용자 Dowon-Kim 검토·승인)
- scope: docs
- changed:
  - docs/llm-wiki/RELEASE_FLOW.md, PUBLIC_API.md, DOMAIN_FEATURES.md, domains/00_overview.md, project-profile.md, ARCHITECTURE_CONVENTIONS.md (needs_review → verified)
  - docs/llm-wiki/VERSIONING.md (verified 유지, reviewed_at/last_updated → 2026-07-15)
- summary:
  - 1.7.0 doc-sync로 needs_review로 내려갔던 지식 문서 6개를 사람 검토·승인에 따라 `verified`로 재승인했다(`verified` 태그·`reviewed_by: Dowon-Kim`·`reviewed_at: 2026-07-15`, 리뷰 노트를 재승인 문구로 갱신). 추가로 VERSIONING.md가 인용 소스(`package.json` 버전 bump·`RELEASE_CHECKLIST.md` 갱신) 변경으로 `evidence.stale`이 떠서, version-agnostic 내용이 여전히 정확함을 확인하고 검토 기준일을 2026-07-15로 갱신해 해소했다(내용 변경 없음). 이로써 1.7.0 배포 전 재검토 부채가 없다(log.md·releases/*.md만 관례상 needs_review).
- caveats:
  - `reviewed_at: 2026-07-15`가 같은날(2026-07-15) src 변경을 end-of-day 기준으로 커버하므로 `evidence.stale` 없음. validate 0 findings, validate-frontmatter --strict clean. 배포 직전 상태.

## 2026-07-15 - release: 1.7.0 준비 (CI/CD 도입) + 전 문서 1.7.0 정합화

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 지시: "모든 문서가 1.7.0에 맞는지 분석 후 릴리스")
- scope: release, docs
- changed:
  - package.json (1.6.0 → 1.7.0), tests/verification.test.js (버전 어서션 → 1.7.0)
  - CHANGELOG.md / CHANGELOG.ko.md (1.7.0 항목)
  - ROADMAP.md / ROADMAP.ko.md (1.7을 Shipped Through 1.7.0로 이동, Release Plan → 1.8–1.11, "next is Gate 12" 정정, 승격 노트 갱신)
  - docs/llm-wiki/releases/v1.7.0.md (신규)
  - doc-sync (verified → needs_review): docs/llm-wiki/RELEASE_FLOW.md, PUBLIC_API.md, DOMAIN_FEATURES.md, domains/00_overview.md, project-profile.md, ARCHITECTURE_CONVENTIONS.md
  - RELEASE_CHECKLIST.md / VERIFICATION.md (하드코딩 1.0.0 → version-agnostic, 사실오류 "migrate --apply 차단" 정정[1.2에서 해금], 1.7 표면 반영)
  - README.md / README.ko.md (CI 불릿에 composite Action 참조), GATE_REVIEW.md (source_files += action.yml)
- summary:
  - 다중 에이전트 전 문서 감사(5개 그룹, blocking 13 + recommended 다수)에 따라 1.7.0(CI/CD 도입)에 맞게 모든 문서를 정합화했다. 1.7.0은 분할된 "팀 & 조직 확장" 라인의 리드 슬라이스만 낸다.
  - BLOCKING: 버전 단일 소스(package.json)와 커플링된 버전 어서션 테스트를 1.7.0으로; CHANGELOG(EN/KO) 1.7.0 항목(2026-07-15); ROADMAP(EN/KO)에서 1.7을 Shipped로 이동하고 계획을 1.8–1.11로 축소(enabling prep·1.8–1.11은 계획에 유지); releases/v1.7.0.md 생성; 내용이 바뀌는 wiki 지식 문서 6개 doc-sync(release-notes --body-only·composite Action·태그 트리거 Release 잡 반영, `verified` → `needs_review`, reviewed_by/at 제거, 1.7 Review Note).
  - RECOMMENDED: 배포물에 포함되는 RELEASE_CHECKLIST/VERIFICATION의 하드코딩 1.0.0을 version-agnostic으로 바꾸고, 세 릴리스째 stale였던 "migrate --apply 차단"(1.2 Gate 8에서 해금됨) 사실오류를 정정했으며, README(EN/KO) CI 불릿에 `uses: .../.github/actions/validate@v1.7.0`(정확한 태그 고정, floating @v1 아님)을 추가하고 GATE_REVIEW source_files에 action.yml을 넣었다.
  - 버전 무관하게 정확한 문서(VERSIONING·SECURITY·CONTRIBUTING·CODE_OF_CONDUCT·index/README/GLOSSARY/profiles·이력 릴리스노트)는 감사에서 변경 불필요로 확인해 손대지 않았다.
- caveats:
  - node --test 177 pass, validate 0 findings, validate-frontmatter --strict 0 findings, npm pack --dry-run(v1.7.0, 58 files) 정상. 무의존성·계약 불변 유지.
  - **재검토 부채**: doc-sync로 needs_review로 내려간 wiki 지식 문서 6개(RELEASE_FLOW·PUBLIC_API·DOMAIN_FEATURES·00_overview·project-profile·ARCHITECTURE)는 사람 검토 후 `verified` 재승인이 필요하다. 내용 미변경으로 verified로 남긴 문서(index·README·GLOSSARY·profiles/library·EXAMPLES)는 `src/cli.js`/`src/commands.js`를 인용하므로 이후 리뷰일에 evidence.stale이 뜰 수 있어 같은 재검토 사이클에서 함께 처리한다.
  - **배포 미실행**: push/tag(v1.7.0)/npm은 사용자의 명시적 지시 후에만. 태그 push가 publish.yml(npm Trusted Publishing + 신규 GitHub Release 잡)을 트리거한다. README/action 참조의 `@v1.7.0`은 태그 배포 시 유효해진다.

## 2026-07-15 - feat: 1.7 CI/CD 도입 구현 (composite Action + GitHub Release + release-notes --body-only + JSON help)

- status: needs_review
- actor: Claude Code (Gate 12 accepted_for_1.7.0 범위)
- scope: code, ci, test
- changed:
  - src/release-notes.js (buildReleaseNotesBody 추출), src/commands.js (releaseNotesCommand --body-only + 민감정보 차단), src/cli.js (--body-only 배선 + 리포트 명령 10종 JSON help 예시), tests/verification.test.js (+4)
  - .github/actions/validate/action.yml (신규 composite action), .github/workflows/publish.yml (격리된 Release 잡)
- summary:
  - Gate 12(accepted_for_1.7.0) 범위대로 1.7 CI/CD 도입을 세 커밋으로 구현했다.
  - (A, 071e524) `release-notes --body-only` 부가 모드: `buildReleaseNotesBody`를 추출해 섹션 본문만(frontmatter·H1·"게시 전 검토" 스캐폴드 라인 제거) 낸다. 본문은 커밋 제목이 그대로 들어가므로 `scanSensitiveInfo`로 스캔하고, 매치 시 result "blocked"(exit 2)로 본문을 withhold한다(누출 차단). 기본 출력은 byte 동일. 테스트 4개 추가.
  - (B, 8a5d2a8) composite `.github/actions/validate/action.yml`: 읽기전용 `validate`를 `npx`로 래핑, 다른 액션을 전혀 끌어오지 않아 무의존성 유지. `publish.yml`에 격리된 `release` 잡 추가: `needs: publish`(publish 성공 후에만), 잡 레벨 `permissions: contents: write`가 워크플로 레벨 `id-token: write`를 대체(격리), 이전 v* 태그 계산 후 `release-notes --body-only --since <prev>`로 본문 생성, 러너 내장 `gh` CLI로 릴리스 생성(서드파티 액션 없음).
  - (C, 이 커밋) 리포트 명령 10종(doctor/validate/validate-frontmatter/audit/status/next/stats/graph/explain/release-notes) help에 실제 최상위 JSON 키를 근거로 한 `JSON (--format json)` 예시 블록 추가(Action/래퍼/MCP 작성자용). 키는 각 명령을 실제 실행해 추출·검증했다(stats 내부 키는 orphanDocuments 등 실제 값으로 정정).
- caveats:
  - node --test 177 pass(신규 4). 순수 additive — 기존 `release-notes` 출력·CLI/JSON/frontmatter 계약 불변. YAML 2개 파싱 확인, 잡 그래프(publish→release·권한 격리) 검증.
  - validate: warning 1건 — `project-profile.md`(verified)가 `src/cli.js`를 evidence로 인용하는데 오늘 그 파일을 수정해 `evidence.stale`이 떴다(심볼 locator라 file-level 판정). `main()`의 역할(인자 파싱·디스패치) 서술은 여전히 정확하며, 이 드리프트와 신규 기능 doc-sync(ARCHITECTURE_CONVENTIONS·DOMAIN_FEATURES·PUBLIC_API)는 저장소 관례대로 **1.7.0 릴리스 준비 시점의 사람 재검토·verified 재승인**에서 함께 해소한다(CLI/에이전트는 verified 자가 승격 불가).
  - **README/CHANGELOG/버전 bump은 저장소 관례대로 1.7.0 릴리스 준비 시점에 반영**(이번 커밋들엔 미포함). Marketplace·floating `@v1` 태그는 Gate 12에서 후속 게이트로 보류.
  - publish.yml(배포 CI) 수정 포함 → push/tag/배포는 사용자의 명시적 지시 후에만. 현재 로컬 main 커밋(미푸시).

## 2026-07-15 - docs(gate): Gate 12 수락 (accepted_for_1.7.0)

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 승인)
- scope: docs, gate
- changed:
  - GATE_REVIEW.md
- summary:
  - 사용자가 "Gate 12 수락 → 1.7 구현 착수"로 승인함에 따라 Gate 12를 `proposed_for_1.7.0` → `accepted_for_1.7.0`으로 확정했다(표 행 + 범위 섹션 제목/서두). 이로써 1.7(CI/CD 도입) 구현 착수가 해금된다: composite action.yml, publish.yml의 격리된 Release 잡, `release-notes --body-only` 부가 모드 + 본문 민감정보 스캔, 명령별 JSON help 예시.
- caveats:
  - 결정 문서만 변경. 코드 변경은 후속 커밋. publish.yml(배포 CI) 수정이 포함되므로 push/tag/배포는 사용자의 명시적 지시 후에만.

## 2026-07-15 - docs(gate): Gate 12 초안 — 1.7 CI/CD 도입(GitHub Action + Release) 범위 (proposed_for_1.7.0)

- status: needs_review
- actor: Claude Code (사용자 명시적 수락 대기 — proposed; Gate 8 선례대로 초안→수락 분리)
- scope: docs, gate
- changed:
  - GATE_REVIEW.md
- summary:
  - 분할된 1.7(CI/CD 도입, 리드)의 범위를 과거 게이트 서식(표 행 + Decisions / May change / Must not change / Guarantees / Honest limits / Unchanged guarantees)으로 사전 결정한 Gate 12를 작성했다. 실코드 확인으로 근거를 잡았다: `publish.yml`은 워크플로 레벨 `id-token: write` + `tag===version` 가드(line 34)라 floating `v1` 태그가 실제로 실패함(deconfliction 필요 확정); `release-notes.js#buildReleaseNotes`는 frontmatter + H1 + "게시 전 검토" 스캐폴드 라인을 붙이고 커밋 제목을 본문에 넣는데 민감정보 스캔을 거치지 않음(누출 갭 확정).
  - 결정: (1) composite action은 `.github/actions/validate/action.yml`에서 읽기전용 `validate`를 `npx`로 래핑(쓰기 명령 미노출, `package.json` files 미포함). (2) 태그 push 시 GitHub Release는 `publish.yml`에 **격리된 `contents: write` 잡**을 추가해 러너 내장 `gh` CLI로 생성(서드파티 액션 금지 — 무의존성 보호). (3) 릴리스 본문은 새 부가 모드 `release-notes --body-only`(frontmatter·H1·스캐폴드 라인 제거, 섹션만)로 결정적 생성; 큐레이트된 `releases/vX.Y.Z.md`는 사람용 산출물로 남기고 자동 본문 소스로 쓰지 않음. (4) 본문은 publish 전 `scanSensitiveInfo`를 거쳐 매치 시 릴리스 차단. (5) v1에서는 action을 정확한 `vX.Y.Z` 태그/SHA로만 참조(floating `@v1` 미생성).
  - 보류(후속 전용 게이트): Marketplace 게시 + floating major 태그 버저닝(먼저 `v*` 네임스페이스·버전 가드 deconfliction 필요). 불변: 기존 npm-publish 잡·Trusted Publishing·권한, 코어 스캐너·`validate` 시맨틱·JSON 형태·frontmatter 계약. `--body-only` 미사용 시 `release-notes` 출력 byte 동일.
  - frontmatter: last_updated 2026-07-15, source_files에 src/release-notes.js·.github/workflows/publish.yml 추가(존재 확인). status needs_review 유지.
- caveats:
  - **proposed 상태다** — 사용자의 명시적 "Gate 12 수락"이 있어야 `accepted_for_1.7.0`으로 확정하고 구현(태스크 3)에 착수한다(구현은 이 게이트에 blocked). GATE_REVIEW.md는 docs/llm-wiki 밖 루트 문서라 validate 스캔 대상이 아님(frontmatter 수동 검증: 중복 키 없음).

## 2026-07-15 - docs: ROADMAP 1.7 단일 라인 → 1.7~1.11 순차 분할 재작성 (1.7 계획 1단계)

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 방향 결정: "1.7 분할안에 전적으로 동의, 단계별로 진행")
- scope: docs
- changed:
  - ROADMAP.md, ROADMAP.ko.md
- summary:
  - 1.7 착수 전 다중 에이전트 분석(기능 5개 + 교차 2개, 전부 소스 근거)에 따라, monolithic `1.7 — 팀 & 조직 확장`(게이트 크기 상호의존 기능 5개 번들)을 leverage·risk·dependency 순서의 순차 마이너로 분할해 로드맵을 재작성했다. 이 번들은 로드맵 자신의 규칙("한 번에 하나씩", "절반 검증이면 릴리스를 미룬다")과 충돌한다.
  - 새 구조: (enabling prep, 새 헤드라인 릴리스 아님) config 로딩을 CLI/programmatic/MCP 세 표면에 통일(현재 CLI 경로만 병합 — Gate 11 한계) · init/quickstart 스타터 `llm-wiki.config.json` 스캐폴딩(preview-first) + doctor 유효 config echo(로드맵의 "실사용 게이트" 전제를 관측 가능하게) · visibility 정책 문서·모노레포 픽스처·cross-repo 포맷 스펙을 코드 이전에 게이트로 작성. (1.7 CI/CD 도입, 리드) composite GitHub Action + 태그 push GitHub Release(gh CLI·격리 contents:write·본문 민감정보 스캔) + 명령별 JSON help 예시. (1.8) config 스키마 확장(하드 의존성 게이트). (1.9) visibility 거버넌스(opt-in·warning·read-only). (1.10) monorepo 프로필(cwd 파라미터화 파이프라인 위 opt-in map, 부가적 `packages[]`). (1.11) cross-repo 지식 링크(비-fetch 예약 스킴).
  - Unscheduled 백로그에서 두 항목을 릴리스 계획으로 승격 표기: 명령별 JSON help 예시(→1.7), 더 풍부한 enrichment 린팅(→1.8 토글 규칙 `content.thin_body`). 각 마이너 범위는 착수 시 새 GATE_REVIEW 게이트(다음 Gate 12)로 사전 결정한다는 규율을 명문화.
  - frontmatter: last_updated 2026-07-15, source_files에 src/config-file.js 추가(존재 확인). status는 규칙대로 needs_review 유지.
- caveats:
  - 코드/명령 표면·JSON 출력·frontmatter 계약 불변(계획 문서만 변경). ROADMAP.md/.ko.md는 docs/llm-wiki 밖 루트 문서라 validate/validate-frontmatter 스캔 대상이 아니며(frontmatter 수동 검증: 중복 키 없음), KO는 EN 정본을 미러링한다.
  - 다음 단계(단계별 진행): Gate 12(1.7 GitHub Action + Release 범위) 작성 → 1.7 구현 → 후속 마이너 enabling prep. push/tag/배포는 사용자의 명시적 지시 후에만.

## 2026-07-15 - docs: 1.6 doc-sync 문서 verified 재승인 + MCP 로컬 등록 정리

- status: verified
- actor: Claude Code (사용자 Dowon-Kim 검토·승인)
- scope: docs
- changed:
  - docs/llm-wiki/PUBLIC_API.md, ARCHITECTURE_CONVENTIONS.md, DOMAIN_FEATURES.md, domains/00_overview.md (needs_review → verified)
  - docs/llm-wiki/README.md (verified 유지, reviewed_at/last_updated → 2026-07-15)
- summary:
  - 1.6.0 배포 후, 1.6 doc-sync로 needs_review로 내려가 있던 4개 문서(PUBLIC_API·ARCHITECTURE_CONVENTIONS·DOMAIN_FEATURES·domains/00_overview)를 사람 검토·승인에 따라 `verified`로 재승인했다(`verified` 태그·`reviewed_by: Dowon-Kim`·`reviewed_at: 2026-07-15`, 리뷰 노트 재승인 문구). 추가로 위키 README(`docs/llm-wiki/README.md`)가 루트 README 재작성(front-door 슬림, c21c504)을 source로 인용해 `evidence.stale`로 떠서, 내용이 여전히 정확함을 확인하고 검토일을 2026-07-15로 갱신해 해소했다.
  - 사전 검증용으로 등록해 둔 로컬 MCP 서버(`claude mcp add llm-wiki -s local`)를 정리했다. 이 등록은 사용자 홈 `~/.claude.json`에만 있던 로컬 전용 항목으로, git·npm 배포물에 흔적이 없어 배포된 1.6.0에는 아무 영향이 없었다(제거는 정돈 목적). 다시 쓰려면 배포판 기준으로 `claude mcp add llm-wiki -s local -- npx -y @dowonk-7949/llm-wiki-standard mcp`.
- caveats:
  - validate 0 findings, validate-frontmatter --strict clean(26 docs), node --test 173 통과. 이로써 재검토 부채 없음(log.md·releases/*.md만 관례상 needs_review).

## 2026-07-15 - docs: README(EN/KO) 프론트도어형으로 슬림 재구성

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 방향 결정)
- scope: docs
- changed:
  - README.md, README.ko.md (약 510/500줄 → 각 101줄)
- summary:
  - 사용자 피드백("README가 너무 방대하다")에 따라 두 README를 매뉴얼형에서 프론트도어형으로 재구성했다. 남긴 섹션: 한 줄 소개+Why, 지원 환경(표, 신규), 빠른 시작, 권장 에이전트/모델(신규 — 보강은 상위 추론 모델·CLI는 모델 불필요·MCP 서버는 결정적), 핵심 명령(compact 표), 잘 쓰는 법(신규), MCP(등록 스니펫), 코드에서 사용(짧게), 안전 요약, 더 알아보기(링크). 상세(전 옵션·evidence 계약·안전정책 전문·autofix/migrate/drift 심화·OKF·프로그래매틱 API 심화·publishing·릴리스 자동화·GitHub Actions 예시)는 삭제가 아니라 `llm-wiki help <cmd>`(오프라인)와 PUBLIC_API.md·GATE_REVIEW.md·EXAMPLES.md·템플릿으로 링크 이관(콘텐츠 손실 없음). docs/ 링크는 npm에서도 닿도록 GitHub 절대 URL 사용, 루트 배포 문서는 상대 링크.
- caveats:
  - README는 docs/llm-wiki 밖이라 validate 대상이 아니며, 링크 대상 12개 파일 존재 확인. node --test 173 통과, validate 0 findings 유지. 1.6.0 배포에 함께 포함 예정.

## 2026-07-15 - docs: 1.6.0 배포 전 validate 경고 전부 해소

- status: verified
- actor: Claude Code (사용자 Dowon-Kim 검토·승인)
- scope: docs
- changed:
  - docs/llm-wiki/EXAMPLES.md, GLOSSARY.md, index.md, profiles/library.md (reviewed_at/last_updated → 2026-07-15)
  - docs/llm-wiki/releases/v0.1.7.md, v0.1.8.md (동일 재검증)
  - docs/llm-wiki/templates/DECISION_LOG.template.md, TASK_PROMPT.template.md (동일 재검증)
  - docs/llm-wiki/log.md (아래 wiki-link 오탐 표현 정정)
- summary:
  - 1.6.0 배포 전 `validate`의 경고 15건을 전부 해소했다. (1) `evidence.stale` 13건: 위 8개 `verified` 문서의 검토 기준일이 2026-07-13이었고 1.6 작업으로 소스(cli.js·commands.js·config.js·package.json·README.md)가 2026-07-14에 바뀌어 드리프트로 떴다. 사람 검토(Dowon-Kim)로 내용이 현행과 일치함을 확인하고 `reviewed_at`/`last_updated`를 2026-07-15로 갱신해 기준선을 이동, 드리프트를 해소했다(도구가 안내하는 "re-review and update" 경로; 내용 변경 없음). (2) `wiki_link.missing` 2건: 과거 로그 항목의 이중 대괄호 리터럴 토큰이 "위키 링크 문법"을 지칭하는 서술이었으나 스캐너가 실제 문서 링크로 오탐한 것 — 사실은 그대로 두고 "위키 링크"로 표현만 정정했다.
  - 결과: `validate` findings 0.
- caveats:
  - 역사적 릴리스 노트(v0.1.7·v0.1.8)가 `package.json`을 source_files로 인용해 릴리스마다 반복 드리프트하는 구조적 스멜은 향후 별도 정리 후보다(현재는 재검증으로 유지).
  - 배포 전이다(태그/npm 미실행).

## 2026-07-14 - feat: 에이전트 네이티브 MCP 서버 + 1.6.0 준비

- status: needs_review
- actor: Claude Code
- scope: code, docs, release
- changed:
  - src/mcp/tools.js, src/mcp/dispatch.js, src/mcp/server.js (신규)
  - src/cli.js (`llm-wiki mcp` 명령 배선 + help), src/index.js (MCP 표면 export)
  - tests/mcp.test.js (신규: 단위 + spawn 라운드트립)
  - package.json (version 1.5.2 → 1.6.0), tests/verification.test.js (버전 어서션)
  - CHANGELOG.md/.ko.md, ROADMAP.md/.ko.md (Shipped Through 1.6.0, Release Plan → 1.7)
  - docs/llm-wiki/PUBLIC_API.md, ARCHITECTURE_CONVENTIONS.md, DOMAIN_FEATURES.md, GATE_REVIEW.md(Gate 11), domains/00_overview.md
  - README.md/.ko.md (MCP 서버 섹션), docs/llm-wiki/releases/v1.6.0.md (신규)
- summary:
  - ROADMAP 1.6(에이전트 네이티브)을 구현했다. `llm-wiki mcp`가 stdio 위 MCP 서버를 실행하고, 읽기 전용 명령 10개(validate/audit/next/status/doctor/stats/graph/explain/handoff/prompt)를 MCP 툴로 노출한다. 서드파티 SDK 없이 Node 내장만으로 개행 구분 JSON-RPC 2.0을 직접 구현(무의존성 불변식 유지). 툴 결과는 1.5 result(`schemaVersion`)를 `structuredContent`로, 사람용 요약을 텍스트로 반환. 쓰기 명령은 노출하지 않음. GATE_REVIEW Gate 11로 범위 승인.
  - 구현 후 적대적 다차원 리뷰(프로토콜/정확성/무의존성·안전/통합/테스트, 워크플로)로 확정 결함 4종을 수정했다: 프로토콜 버전 협상을 지원 버전 allowlist로(임의 버전 echo 금지), known-method 알림(id 없음) 무응답, 배열(배치)을 `-32600`으로 거부(2025-06-18 배칭 제거·빈 배열 무응답 해소), graph 툴 설명 정확화. 테스트 커버리지도 보강(isError 분기·파싱오류 -32700·배열·graph format·알림 무응답).
  - 최종 완결성 검증(워크플로)에서 `domains/00_overview.md` 도메인 지도가 stale함을 확인해 현행화했다: 누락됐던 Knowledge(graph/stats)·Release(release-notes)·Agent-native(mcp) 추가, `drift` 반영, stale했던 "migrate --apply 차단" 서술을 Gate 8 기준으로 정정.
- evidence:
  - src/mcp/dispatch.js#symbol:handleMessage
  - src/mcp/tools.js#symbol:TOOL_DEFS
  - src/mcp/server.js#symbol:startMcpServer
- caveats:
  - node --test 통과(신규 MCP 테스트 포함), validate-frontmatter --strict 확인 예정, 실제 stdio 라운드트립 검증. 무의존성 유지(런타임 서드파티 의존성 추가 없음).
  - 배포 전이다(태그/npm 미실행). doc-sync로 PUBLIC_API·ARCHITECTURE_CONVENTIONS·DOMAIN_FEATURES가 verified→needs_review로 강등 → 사람 재검토 필요.

## 2026-07-14 - release: 1.5.2 준비 (커뮤니티 표준)

- status: needs_review
- actor: Claude Code
- scope: release, docs
- changed:
  - CODE_OF_CONDUCT.md / .ko.md, CONTRIBUTING.md / .ko.md, SECURITY.md / .ko.md (신규, 루트)
  - .github/ISSUE_TEMPLATE/(bug_report·feature_request·config), .github/pull_request_template.md (신규)
  - package.json (version 1.5.1 → 1.5.2 + files에 커뮤니티 문서 6개)
  - tests/verification.test.js (버전 어서션 → 1.5.2)
  - CHANGELOG.md / CHANGELOG.ko.md (1.5.2 항목)
  - README.md / README.ko.md (커뮤니티 섹션)
  - docs/llm-wiki/releases/v1.5.2.md (신규)
- summary:
  - GitHub Community Standards(기본 브랜치=main 기준)를 충족하도록, 병렬 워크트리(`check-llm-model`) 브랜치에 보존해 둔 커뮤니티 헬스 문서(CODE_OF_CONDUCT·CONTRIBUTING·SECURITY EN/KO)와 GitHub 이슈/PR 템플릿을 main으로 가져와 1.5.2로 정식화했다. package.json `files`에 문서 6개를 등록하고 버전·어서션·CHANGELOG·README를 갱신했다.
  - 저장소/GitHub 대상 변경이라 CLI 명령 표면·JSON 출력·프로그래매틱 API 계약은 불변. `.github/` 템플릿은 npm 미포함.
- caveats:
  - node --test·validate-frontmatter --strict 통과 확인 예정. GitHub Community Standards는 이 커밋이 main에 push되면 Code of conduct/Contributing/Security/Issue templates/PR template가 충족으로 바뀐다.

## 2026-07-14 - docs: 팀 발표자료에 실제 화면 예시 슬라이드 2장 추가

- status: needs_review
- actor: Claude Code
- scope: docs
- changed:
  - outputs/llm-wiki-team-introduction-v1.5.1.pptx (12→14 슬라이드)
- summary:
  - 발표자료에 "실제 화면" 예시 슬라이드 2장을 추가했다(슬라이드 10 뒤). 슬라이드 11: `audit --format html` 대시보드 히어로를 헤드리스 Chrome으로 실제 스크린샷(결과·발견·문서·고아·링크 + 프로젝트 감지). 슬라이드 12: `graph --format json`의 실제 데이터(문서 24·링크 57)를 networkx로 렌더한 지식 그래프(index 진입 허브·코어 클러스터·log 허브의 릴리스 노트 부채꼴). 기존 슬라이드 번호는 재정렬(팀은 네 단계 →13, 닫는 슬라이드 →14).
  - 두 이미지 모두 AI 생성 삽화가 아니라 도구의 실제 출력(대시보드는 실 스크린샷, 그래프는 실 데이터의 시각화)이라 발표 신뢰도에 부합한다. 그래프 팔레트는 dataviz 검증 스크립트로 색맹 안전성 확인. 사람이 PowerPoint로 두 슬라이드 레이아웃을 육안 확인했다.
- caveats:
  - LibreOffice 부재로 pptx 자동 렌더 검증은 불가 → 사람이 직접 확인함. python-pptx 왕복 로드로 파일 유효성 확인.

## 2026-07-14 - docs: wiki README verified 재승인 (1.5.1)

- status: verified
- actor: Claude Code (사용자 Dowon-Kim 검토·승인)
- scope: docs
- changed:
  - docs/llm-wiki/README.md
- summary:
  - 1.5.1 발표자료 링크 갱신으로 needs_review로 내려갔던 wiki README를 사람 검토·승인(레이아웃 직접 확인 포함)에 따라 `verified`로 재승인하고 `reviewed_by: Dowon-Kim`/`reviewed_at: 2026-07-14`를 기록했다.
- caveats:
  - validate-frontmatter --strict pass. 재검토 부채 없음.

## 2026-07-14 - docs: 팀 공유 프레젠테이션 1.5.1로 갱신

- status: needs_review
- actor: Claude Code
- scope: docs
- changed:
  - outputs/llm-wiki-team-introduction-v1.5.1.pptx (신규; v0.1.8 대체)
  - outputs/llm-wiki-team-introduction-v0.1.8.pptx (제거; git 히스토리에 보존)
  - docs/llm-wiki/README.md (프레젠테이션 링크 → v1.5.1)
- summary:
  - 팀 공유 프레젠테이션(12슬라이드)을 1.5.1에 맞게 갱신했다. python-pptx로 편집: 전 슬라이드 버전 칩 `LLM-WIKI 0.1.8` → `1.5.1`(12곳), 슬라이드5 "현재" 스냅샷에 지식 그래프·헬스 스코어·마이그레이션·프로그래매틱 API 반영, 슬라이드8 어댑터 목록에 Windsurf·Gemini 추가, 슬라이드10 "현재 가능한 것" 5불릿을 그래프/stats·마이그레이션·프로그래매틱 API로 현행화. 개념 서사(레고 비유·워크플로·안전장치)는 버전 무관하게 유효해 유지.
  - 모든 텍스트박스가 auto_size=TEXT_TO_FIT_SHAPE라 편집 박스의 stale 폰트 스케일을 리셋해 PowerPoint가 재계산하도록 했다. python-pptx 왕복 로드로 파일 유효성 확인, 잔여 "0.1.8" 0개.
- caveats:
  - LibreOffice 부재로 시각적 렌더 검증은 못 했다 → 발표 전 PowerPoint로 레이아웃 한 번 확인 권장.
  - README.md는 링크 갱신으로 verified → needs_review로 강등(사람 재검토 필요). v0.1.8 pptx는 워킹트리에서 제거했으나 git 히스토리에 남아 있고, 과거 릴리스 로그 기록은 그대로 보존.

## 2026-07-14 - docs: PUBLIC_API verified 재승인 (1.5.1)

- status: verified
- actor: Claude Code (사용자 Dowon-Kim 검토·승인)
- scope: docs
- changed:
  - docs/llm-wiki/PUBLIC_API.md
- summary:
  - 1.5.1 결함 수정 doc-sync로 needs_review로 내려갔던 PUBLIC_API.md를 사람 검토·승인에 따라 `verified`로 재승인하고 `reviewed_by: Dowon-Kim`/`reviewed_at: 2026-07-14`를 기록했다. 리뷰 노트도 재승인 문구로 갱신했다.
- caveats:
  - validate-frontmatter --strict pass. 1.5.1 배포 전 재검토 부채 없음(log.md·release notes만 관례상 needs_review).

## 2026-07-14 - fix: 1.5 API/출력 결함 4건 수정 + 1.5.1 준비

- status: needs_review
- actor: Claude Code
- scope: code, docs, release
- changed:
  - src/commands.js (withText·release-notes에 schemaVersion 부여)
  - src/index.js (normalizeOptions가 parseArgs 결과 수용)
  - src/cli.js (main/run이 exit code 반환)
  - src/report.js (HTML 대시보드 링크를 --out 기준 상대경로로)
  - tests/verification.test.js (회귀 테스트 +4, 버전 어서션 → 1.5.1)
  - package.json (1.5.0 → 1.5.1)
  - docs/llm-wiki/PUBLIC_API.md
  - README.md, README.ko.md, CHANGELOG.md, CHANGELOG.ko.md
  - docs/llm-wiki/releases/v1.5.1.md (신규)
- summary:
  - 소비 프로젝트(road-monitor) in-process 스모크 테스트에서 발견된 1.5 API/출력 결함 4건을 재현·확정 후 수정했다. (FIX-1) 결과 객체가 `schemaVersion`을 항상 담도록 `withText`에서 부여하고 `.text`는 항상 텍스트임을 문서화. (FIX-2) `normalizeOptions`가 `parseArgs` 결과(`.options`)를 수용해 조용한 기본값 폴백 제거. (FIX-3) `run(argv)`가 숫자 exit code 반환. (FIX-4) HTML 대시보드 Document Index 링크를 `--out` 위치 기준 상대경로로 계산.
  - 모두 additive/refinement라 안정 계약(CLI/JSON/frontmatter)을 깨지 않아 patch(1.5.1)로 처리. graph DOT 등 보고서에서 "정상"으로 표시된 항목은 손대지 않았다.
- evidence:
  - src/commands.js#symbol:withText
  - src/index.js#symbol:normalizeOptions
  - src/cli.js#symbol:main
  - src/report.js#symbol:dashboardDocHref
- caveats:
  - node --test 159 pass(신규 4개), validate-frontmatter --strict pass, JSON에 schemaVersion 정확히 1회.
  - 아직 배포 전이다(태그/npm 미실행). PUBLIC_API.md는 LLM 편집으로 needs_review로 강등 → 사람 재검토 필요.

## 2026-07-14 - release: 1.5.0 준비 (프로그래매틱 API)

- status: needs_review
- actor: Claude Code
- scope: release, docs
- changed:
  - package.json (version 1.4.0 → 1.5.0)
  - tests/verification.test.js (버전 어서션 → 1.5.0)
  - CHANGELOG.md, CHANGELOG.ko.md (1.5.0 항목)
  - README.md, README.ko.md (Programmatic API 섹션)
  - ROADMAP.md, ROADMAP.ko.md (Shipped Through 1.5.0, Release Plan에서 1.5 제거)
  - docs/llm-wiki/releases/v1.5.0.md (신규)
- summary:
  - 1.5.0 릴리스를 준비했다. 버전 bump + 버전 어서션 갱신, CHANGELOG/README/ROADMAP EN·KO 갱신(프로그래매틱 API + `--format json`의 `schemaVersion` 부가), v1.5.0 릴리스 노트 생성.
- caveats:
  - node --test 155 pass, validate-frontmatter --strict pass(재검토 부채 없음), npm pack --dry-run 확인.
  - 배포는 v1.5.0 태그 push 시 publish.yml(Trusted Publishing)로 진행된다.

## 2026-07-14 - docs: PUBLIC_API·ARCHITECTURE_CONVENTIONS·DOMAIN_FEATURES verified 재승인 (1.5)

- status: verified
- actor: Claude Code (사용자 Dowon-Kim 검토·승인)
- scope: docs
- changed:
  - docs/llm-wiki/PUBLIC_API.md
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md
  - docs/llm-wiki/DOMAIN_FEATURES.md
- summary:
  - 1.5 프로그래매틱 API doc-sync로 needs_review로 내려갔던 세 문서를 사람 검토·승인에 따라 `verified`로 재승인하고 `reviewed_by: Dowon-Kim`/`reviewed_at: 2026-07-14`를 기록했다. 리뷰 노트도 재승인 문구로 갱신했다.
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
- actor: Claude Code (사용자 Dowon-Kim 검토·승인)
- scope: docs
- changed:
  - docs/llm-wiki/DOMAIN_FEATURES.md
  - docs/llm-wiki/PUBLIC_API.md
- summary:
  - 1.4.0 doc-sync로 needs_review로 내려갔던 두 문서를 사람 검토·승인에 따라 `verified`로 재승인하고 `reviewed_by: Dowon-Kim`/`reviewed_at: 2026-07-14`를 기록했다. 리뷰 노트도 재승인 문구로 갱신했다.
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
  - README(EN·KO)에 "Publishing for Human Readers" 절 추가: GitHub/GitLab 네이티브 렌더, Obsidian(위키 링크+aliases), MkDocs 안내 + `graph --format mermaid|dot`·`stats`·`audit --format html`(Document Index) 활용법. "SSG 아님" 명시. Commands 표에 graph·stats 행 추가.
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
  - `collectWikiGraph`에 `edges`를 추가했다(additive): wiki 링크·`related` frontmatter·로컬 markdown 링크가 문서→문서로 해소되는 엣지를 dedup·정렬해 수집(각 `{source,target,kind}`). summary에 `edges` 카운트, `emptyWikiGraph`에도 반영. 기존 필드 불변이라 status/audit 대시보드 영향 없음.
  - cli.js: `graph` 명령 등록, format 검증을 명령 인지(graph만 mermaid/dot 허용, 전역은 text/json/markdown/html), 옵션 규칙(cwd/format/out)·usage·per-command help 추가. report.js: `graph --out`(mermaid/dot)은 raw 텍스트로 기록.
  - 테스트 추가(text/json/mermaid/dot 출력·related 엣지 반영·미초기화 0 문서·parseArgs mermaid/dot 수용). 전체 145 pass. 이 저장소에서 graph text(21 docs/54 edges/9 orphans)·mermaid·dot·json 확인, html은 graph에서 거부(exit 3).
- caveats:
  - graph는 읽기전용(쓰기 없음, findings 없음 → exit 0). 로드맵 1.4의 첫 항목. 다음: stats → publishing → release: prepare 1.4.0(보류 중인 Gate 10 도메인 탐지 번들).
  - push/tag/배포는 사용자 지시 시에만. 현재 로컬 main 커밋(미푸시).

## 2026-07-14 - feat: 파일+디렉터리 통합 도메인 탐지 (Gate 10, 1.4 이전 선행)

- status: needs_review
- actor: Claude Code (사용자 Dowon-Kim 설계·범위 승인)
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
- actor: Claude Code (사용자 Dowon-Kim 검토·승인)
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
  - 사용자 검토·승인에 따라 콘텐츠/레퍼런스 문서 8개를 `verified`로 (재)승인하고 `reviewed_by: Dowon-Kim`/`reviewed_at: 2026-07-14`를 기록했다. 1.2/1.3에서 needs_review로 내려갔던 4개(VERSIONING·project-profile·DOMAIN_FEATURES·PUBLIC_API)와 docs/llm-wiki/README.md를 승격하고, 이미 verified였던 3개(ARCHITECTURE_CONVENTIONS·domains/00_overview·RELEASE_FLOW)를 리프레시했다.
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
- actor: Claude Code (사용자 Dowon-Kim 표면 승인)
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
- actor: Claude Code (사용자 Dowon-Kim 승인)
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
  - 1.0.0 갱신 후 needs_review로 내려갔던 VERSIONING.md·project-profile.md를 사람 검토(reviewed_by: Dowon-Kim, 2026-07-14) 완료에 따라 verified로 승격하고 reviewed_by/reviewed_at를 기록했다.
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
- reviewed_by: Dowon-Kim
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
