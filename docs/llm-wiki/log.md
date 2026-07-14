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
