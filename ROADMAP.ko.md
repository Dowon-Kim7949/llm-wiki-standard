---
title: LLM-WIKI Governance Roadmap
tags:
  - llm-wiki
  - roadmap
  - package
  - cli
status: needs_review
doc_type: roadmap
project: llm-wiki-governance
last_updated: 2026-07-21
author: ai-generated
last_edited_by: Claude Code
wiki_block_version: v1
source_files:
  - package.json
  - src/cli.js
  - src/commands.js
  - src/frontmatter-schema.js
  - src/detector.js
  - src/git.js
  - src/config-file.js
  - CHANGELOG.md
related:
  - GATE_REVIEW.md
  - VERIFICATION.md
  - RELEASE_CHECKLIST.md
  - docs/llm-wiki/VERSIONING.md
visibility: internal
contains_sensitive_info: false
---

> Language: [English](./ROADMAP.md) | [한국어](./ROADMAP.ko.md)

# LLM-WIKI Governance Roadmap

이 로드맵은 미래 지향 문서다. 구현 이력은 `CHANGELOG.md`, `docs/llm-wiki/log.md`,
그리고 `docs/llm-wiki/releases/` 아래 릴리스별 노트에 있다. 이 문서는 안정 `1.0.0`
라인 이후의 `1.x` 마이너 릴리스를 — 한 번에 하나씩, 순서대로 — 계획한다.

## 제품 원칙 (Product Principle)

```text
CLI는 구조와 안전 가드레일을 만든다.
Codex나 Claude Code가 소스 근거로 문서를 보강한다.
사람이 검토하고 verified 상태를 승인한다.
CI가 품질을 지속적으로 점검한다.
```

## 1.7.0까지 구현 완료 (Shipped Through 1.7.0)

`1.7.0`(이번 릴리스)은 CI/CD 도입 라인이다 — 분할된 "팀 & 조직 확장" 계획의 리드
슬라이스: 읽기 전용 `validate`를 `npx`로 감싸는 컴포지트 GitHub Action
(`.github/actions/validate/action.yml`, 다른 액션을 끌어오지 않아 무의존성, 정확한
`vX.Y.Z` 태그/SHA로 참조); `v*` 태그 push 시 `publish.yml`의 격리된
`contents: write` 잡이 러너 `gh` CLI로 만드는 GitHub Release(본문은 새 부가 모드
`release-notes --body-only`에서 나오고 민감정보 스캔을 거쳐 매치 시 차단); 읽기 전용
리포트 명령 10개의 `help`에 명령별 `--format json` 예시. 하위호환 — 부가 명령 모드와
CI 산출물만 추가. Marketplace 게시와 floating `@v1` 태그는 후속 게이트로 보류한다
(먼저 `v*` 태그 네임스페이스 deconflict 필요). 범위: `GATE_REVIEW.md`(Gate 12).

`1.6.0`은 에이전트 네이티브 라인이다: `llm-wiki mcp`가 stdio 위에서 Model
Context Protocol 서버를 실행해, 에이전트(Claude Code·Cursor 등 MCP 클라이언트)가 shell을
거치지 않고 위키를 툴로 질의·점검한다. 읽기 전용 명령(`validate`/`audit`/`next`/`status`/
`doctor`/`stats`/`graph`/`explain`/`handoff`/`prompt`)을 MCP 툴로 노출한다 — 쓰기 명령은
노출하지 않고 어떤 툴도 파일을 쓰지 않는다. 서드파티 SDK 없이 Node 내장만으로 JSON-RPC
2.0을 직접 구현(무의존성 불변식 유지)하고, 결과는 1.5 result 형태(`schemaVersion`)를
재사용한다. 하위호환 — 새 명령·모듈만 추가. 범위: `GATE_REVIEW.md`(Gate 11).

`1.5.0`은 프로그래매틱 API 라인이다: `package.json` `exports`
(`src/index.js`)로 패키지를 in-process import할 수 있고, 명령 함수 위의 동결된
`commands` 맵·`normalizeOptions`·`parseArgs`/`run`·`SCHEMA_VERSION`을 공개하며 반환
형태를 JSDoc typedef와 `PUBLIC_API.md`로 문서화한다. `--format json` 출력에 부가적
최상단 `schemaVersion` 필드가 붙어 CI 래퍼·에디터가 출력 계약을 고정할 수 있다.
하위호환 — 새 import 표면과 부가적 JSON 필드 하나만 추가.

`1.4.0`은 "보이는 지식" 라인이다: `llm-wiki graph`(지식 그래프를
text/JSON/Mermaid/DOT로), `llm-wiki stats`(헬스 스코어), `--format html` 대시보드의
탐색용 Document Index + 사람 독자용 공개 가이드, 그리고 라우트/리소스 모듈 **파일**
(FastAPI/Flask/Express/Rails/Go의 endpoints/routers/…)도 디렉터리-도메인과 함께
`init`이 감지하는 파일 기반 도메인 감지(GATE_REVIEW Gate 10).

`1.3.0`은 디텍터 & 어댑터 확장 라인이다: backend/fullstack `init`이 업무
도메인 디렉터리를 감지해 overview에서 링크되는 도메인별 문서(`domains/NN_<name>.md`,
`doc_type: domain`)를 생성; PHP/Ruby/.NET 생태계 감지; Windsurf·Gemini CLI writable
어댑터(JetBrains AI는 info-level candidate); OKF `type`를 `doc_type`의 부가적 alias로
수용.

`1.2.0`은 안전 업그레이드 & 마이그레이션 라인이다: `migrate`/`doctor`의
`wiki_block_version` 인식 업그레이드 리포트; `fix` 엔진 + 블록버전 stamp를 재사용하는
승인된 미리보기 우선·`verified` 보존 범위(GATE_REVIEW Gate 8)로 해금된
`migrate --apply`; 드리프트된 `verified` 문서를 `--downgrade`로 `needs_review`로
내리는 새 `llm-wiki drift` 명령(GATE_REVIEW Gate 9); 라인 단위 `evidence.stale`
정밀도; version-agnostic으로 전환한 `VERSIONING`·`project-profile` 문서.

`1.1.0`은 inner-loop 정리 라인을 추가했다: `evidence.stale` 같은날 드리프트 경계
수정, 변경 문서로 findings를 좁히는 `validate --changed`, 그리고 `pre-commit` 훅
템플릿과 packed tarball 대상 CI Quick Start 점검. 앞서 `1.0.1`로 준비했던 문서 작업 —
날짜 없는 로드맵 재작성과 `README`·`CHANGELOG`·`ROADMAP`의 EN–KO 쌍 — 도 함께
흡수했다.

`1.0.0`은 CLI 명령·옵션 표면, `--format json` 출력 형태, 필수 frontmatter 계약을
안정으로 선언했다. 이미 갖춰진 것: 전체 명령 표면(`doctor`, `status`, `next`,
`explain`, `validate`, `validate-frontmatter`, `audit`, `init`, `quickstart`,
`migrate`[dry-run 전용], `fix`, `handoff`, `prompt`, `release-notes`); 보수적 쓰기
안전장치; 다중 생태계 감지(Node/Python/Go/Rust/JVM); 어댑터 4종
(codex/claude/cursor/copilot)과 Antigravity 후보; `okf-v0.1` 프로필;
frontmatter/링크/소스/근거/드리프트 검증; `--format html` 대시보드; 크로스플랫폼
릴리스 CI. 자세한 내용은 `CHANGELOG.md` 참조 — 이 로드맵은 완료된 작업을 다시
나열하지 않는다.

## 이 로드맵을 운용하는 방식 (How This Roadmap Works)

- **모든 `1.x` 릴리스는 부가적이고 하위호환된다.** 새 명령·옵션·어댑터·디텍터와
  *opt-in* 동작만 추가한다. 여기 있는 어떤 것도 `1.0.0` 계약을 깨지 않는다.
- **한 번에 하나씩, 순서대로.** 순서는 레버리지·리스크·의존성 기준이며, 각
  릴리스는 일정이 아니라 필요가 당길 때 진행한다.
- **날짜 없음.** 이 릴리스들에는 목표 날짜를 붙이지 않는다. 일정보다 품질을
  우선한다 — 절반만 검증된 채 내보내느니 릴리스를 미룬다.
- **계약을 깨는 변경은 `1.x` 범위 밖**이며, 아래 "Beyond the 1.x Horizon"에 보류한다.

## 릴리스 계획 (1.8–1.11) — 팀 & 조직 확장, 분할

목표: 단일 저장소·단일 유지보수자를 넘어선 도입을 지원한다.

이 라인은 원래 단일 `1.7 — 팀 & 조직 확장`으로, 게이트 크기의 상호의존적 기능 5개
(모노레포 프로필, 크로스레포 링크, config 스키마 확장, 가시성 거버넌스, GitHub
Action + Release)를 묶고 있었다. 이는 표면이 가장 넓고 의존성이 가장 많으며 — 그
자체 서술대로 — 설계 전에 실제 다중 팀 피드백이 가장 필요하다. 다섯을 한 릴리스로
내보내는 것은 이 로드맵 자신의 두 규칙과 충돌한다: *한 번에 하나씩, 순서대로*, 그리고
*절반만 검증된 채 내보내느니 릴리스를 미룬다*(하나가 늦어지면 나머지 넷이 함께 막힌다).
그래서 이 라인을 **리스크가 낮고 레버리지가 높은 것부터 순서대로 나눈 마이너들**로
분할한다. 각 마이너는 필요가 당길 때 진행하고, 각자의 범위를 코드 *이전에* 새
`GATE_REVIEW.md` 게이트(Gate 12가 출시된 1.7을 담당했고, 다음은 1.8용 Gate 13)로
기록한다 — 이전의 모든 범위 결정을 규율한 바로 그 방식이다.

### enabling prep (부가적; 새 헤드라인 릴리스 아님)

후속 마이너를 해금하고, 큰 기능들이 필요로 하는 실사용 피드백이 흐르기 시작하게 하는
작은 하위호환 패치들. 어느 것도 `1.0.0` 계약을 바꾸지 않는다:

**상태:** 앞의 둘 — config 로딩 통일과 starter config scaffold + `doctor` echo — 는
**`1.7.2`**로 출시됐다(Gate 13 enabling prep). 아래 설계 문서 항목은 남아 있다.

- **config 로딩을 명령 계층 아래로 통일.** 지금 `loadProjectConfig` /
  `mergeConfigIntoOptions`(`src/config-file.js`)는 CLI 경로(`src/cli.js#main`)에서만
  돈다; 1.5 프로그래매틱 API와 1.6 MCP 표면은 `llm-wiki.config.json`을 병합하지 않는다
  (Gate 11 정직한 한계). 병합을 공통 진입부로 내려 세 표면이 동일한 유효 옵션을 쓰게
  한다 — 그러지 않으면 config 확장이 새 안정 계약에 불일치를 박는다.
- **스타터 `llm-wiki.config.json` 스캐폴딩.** `init` / `quickstart`가 최소 config를
  쓴다(부가적·미리보기 우선·`--write`에서만·기존 파일 절대 미덮음). `doctor`는 병합된
  유효 config를 echo한다. 로드맵은 config 확장을 "최소 config의 실사용"에 게이트로
  걸었지만, 어떤 명령도 config를 만들어 주지 않으면 사용이 쌓일 수 없다 — 이 작업이
  게이트의 전제 조건을 관측 가능하게 만든다.
- **후속 마이너가 의존하는 설계 입력을 코드 이전에 작성:** 누락된 가시성 거버넌스
  정책 문서(`project-profile`의 Open Question), `tests/fixtures/` 아래 모노레포
  픽스처, 크로스레포 참조 포맷 스펙 — 각각을 승인된 `GATE_REVIEW` 게이트로 기록한다.

### 1.8 — config 스키마 확장

**출시 — Gate 13 완성:** config 3피처 모두. `1.8.0`에서 per-project rule 토글(`rules` 맵)과
`content.thin_body` opt-in lint, `1.8.1`에서 커스텀 문서셋(`requiredDocs`)과 템플릿
오버라이드(`templates`, never-`verified` 가드레일). severity 수렴 pre-work 완료(감사로 동작
보존 확인, 불일치 0). 다음 예정 마이너: visibility governance(`1.9`).

미리 예약된 `llm-wiki.config.json` seam(unknown 키는 이미 설계상 무시)을 **커스텀
문서 세트, 프로젝트별 규칙 토글, 템플릿 오버라이드**로 확장한다. 이것이 하드 의존성
게이트다: 모노레포(패키지별 config)와 가시성 거버넌스(규칙 토글)가 모두 이걸 소비한다.
선행 작업: 규칙 토글이 정합적이도록 스캔별로 인라인된 severity를 하나의 레지스트리로
통합하고, 템플릿 오버라이드가 `status: verified`를 절대 설정할 수 없다는 하드
가드레일을 둔다. 토글 기계를 dogfood하려고 더 풍부한 enrichment 린팅
(`content.thin_body`, warning 레벨)을 토글 가능한 규칙으로 포함한다. 스캐폴딩된
config가 설계 근거가 될 실사용을 만들어낸 뒤 당긴다.

### 1.9 — 가시성 거버넌스

**1.9.0 출시:** sensitive-info 스캔을 재사용하는 opt-in 일관성 린트 2개
(`visibility.public_sensitive`, `visibility.declared_mismatch`)와 정책 문서
`docs/llm-wiki/VISIBILITY.md`(GATE_REVIEW Gate 14). 기본 off·warning·read-only, 민감값
미노출. 다음 예정 마이너: `1.10`.

이미 필수인 `internal|restricted|public` 필드를 config 규칙 토글로 선택적 강제 —
**기본 off, warning 레벨, 읽기 전용** — 하며, public-대-내용 일관성 검사에 민감정보
스캔을 재사용한다. 작지만 1.8 config 설계를 실기능으로 end-to-end 증명하므로, 더 큰
모노레포 소비자가 이에 의존하기 전에 검증된다. 정책 문서와 그 게이트에 blocked이고,
기본 error/blocked 규칙이 되어서는 절대 안 된다(부가성 불변식을 깬다).

### 1.10 — 모노레포 프로필

**1.10.0 출시:** `monorepo` 명령이 npm/yarn `workspaces`를 감지해 각 패키지를 validate하고
additive `packages[]` roll-up으로 집계한다(GATE_REVIEW Gate 15). read-only, 단일 레포
byte-identical, pnpm/YAML은 후속. 패키지 간 집계 그래프·deeper glob은 이후. 다음 예정 마이너: `1.11`.

검증·그래프를 집계하는 패키지별 wiki를, **이미 cwd 파라미터화된 파이프라인**
(`audit` / `collectWikiGraph` / `findMissingDocs`) 위의 opt-in map으로 만든다. JSON
형태는 엄격히 부가적인 `packages[]`라 단일 저장소 출력은 byte 동일하게 유지된다. 이제
config 토글·실 CI 피드백·enrichment 신호를 손에 쥐고 만든다. `detector.js`에 부가적
워크스페이스 *감지*를 먼저 넣고, 무의존성 pnpm/YAML 워크스페이스 파싱은 정직하게
미룬다(npm/yarn `workspaces` 먼저).

### 1.11 — 크로스레포 지식 링크

**1.11.0 출시 — 1.7–1.11 라인 완성.** 예약 `repo:<name>/<path>` 참조 스킴(+ http(s))을
wiki 링크·frontmatter 참조에서 external로 인식해 cross-repo 참조가 missing-target 규칙에
걸리지 않게 한다(GATE_REVIEW Gate 16). 인식만 함 — fetch/verify 안 함.

보수적·**비-fetch** 참조 포맷(예약 스킴)으로, 별도 저장소의 API 스펙·도메인
문서·서비스 계약에 대한 크로스레포 참조가 missing-target 규칙에 걸리지 않고 해소되게
한다 — 인식하되 절대 검증하지 않는다(검증은 네트워크/git이 필요해 무의존성 불변식을
깬다). 마지막: 가장 설계 부담이 크고 피드백이 필요하며, 모노레포·config 확장·가시성이
먼저 갖춰져야 한다. 지금 바로 가능한 슬라이스는 먼저 낼 수 있다 — external-reference
분류기를 강화해 크로스레포 `[[..]]` 링크가 잘못된 `wiki_link.missing`을 뱉지 않게 한다.

이렇게 나눈 이유: 순서는 레버리지·리스크·의존성 기준이다. 각 마이너는 독립적으로
출시·검증 가능하고, 가장 크고 피드백이 필요한 기능(모노레포, 크로스레포)은 더 저렴한
도입·config 작업이 CLI를 실제 다중 팀 사용 앞에 세운 뒤에 온다.

## 릴리스 계획 (1.12–1.14) — detect & adapt 확장

**상태: 완료 — `1.12`(모바일, Gate 17)·`1.13`(infra/DevOps, Gate 18)·`1.14`(stdlib-server, Gate 19) 모두 출시.** `1.7–1.11` "팀 & 조직 확장" 라인은 완료·출시됐다
(`1.11.1` npm). 다음 라인은 프로젝트 *브레드스*를 확장한다 — `1.3`의 PHP/Ruby/.NET 작업의
후속 테마 — 그리고 같은 규율을 따른다: 한 번에 한 마이너, 순서대로, 각자 코드보다 **먼저**
새 `GATE_REVIEW.md` 게이트로 범위를 못박는다(Gate 17 → 18 → 19). 세 항목은 대체로 독립적이라
하드 의존성이 아니라 레버리지·리스크 기준으로 순서를 정한다.

### 1.12 — 모바일 프로필 (Gate 17)

**1.12.0 출시.** 부가적 새 `mobile` 프로젝트 유형. Android(`build.gradle`/`build.gradle.kts`/`settings.gradle`에
Android Gradle Plugin 또는 AndroidX 신호, `AndroidManifest.xml`), Flutter(`flutter:` 섹션이
있는 `pubspec.yaml`), Apple/iOS(`*.xcodeproj`/`*.xcworkspace`, `Podfile`, Apple 플랫폼 대상
`Package.swift`), React Native(`package.json`의 `react-native` 의존성)를 감지하고 모바일
문서셋을 추가한다. **먼저 하는 이유는 실제 오분류도 고치기 때문** — 지금 Android `build.gradle`은
`jvm`+`library`로 감지된다(`src/detector.js`). 부가적·opt-in(새 감지 유형·프로필 문서, `--type`에
값 추가); 감지는 매니페스트/파일 신호 + bounded 스캔이며 빌드 도구를 절대 호출하지 않는다;
무의존성. 범위: `GATE_REVIEW.md`(Gate 17).

### 1.13 — infra/DevOps 프로필 (Gate 18)

**1.13.0 출시.** 부가적 새 `infra` 프로젝트 유형. `Dockerfile`, Docker Compose, Kubernetes 매니페스트, Helm
차트(`Chart.yaml`), Terraform(`*.tf`)을 감지하고 infra/DevOps 문서셋을 추가한다. Gate 17과
동일한 bounded 감지 패턴을 재사용하므로 두 번째로 온다. 부가적·opt-in; 무의존성(신호 파일 존재
+ bounded 내용 스니프, 클러스터/레지스트리/`terraform`/`kubectl`/`helm` 접근 없음). 범위:
`GATE_REVIEW.md`(Gate 18).

### 1.14 — stdlib 서버 감지 (Gate 19)

**1.14.0 출시 — 1.12–1.14 detect & adapt 확장 라인 완성.** 오래된 백로그 항목 승격(1.3에서 보류): Go `net/http`·Python stdlib HTTP 서버를 `library`가
아닌 `backend`로 분류 — bounded·오탐 방지 소스 스캔(HTTP import **와** 서버 시작 호출)으로.
셋 중 가장 작고 마지막; 유일한 리스크는 과분류라서 휴리스틱은 보수적·단방향(`library`→`backend`
승격만, 강등 없음)을 유지한다. 무의존성. 범위: `GATE_REVIEW.md`(Gate 19).

## 릴리스 계획 (1.15–1.16) — 완료 (shipped)

- **1.15 — 스킬 생성 (Gate 21).** `init`/`quickstart`이 `feature`/`fix`/`docs-sync` 위키-그라운디드 자동화 프롬프트를 Claude 스킬·Cursor 룰·에이전트-중립 프롬프트로 생성하고 각 본문에 프로젝트 도메인 맵을 주입한다. opt-in·preview-first·미덮어씀·recognize-don't-run. `1.15.0`에서 출시, `1.15.1`에서 재시작 안내 추가(스킬은 세션 시작 시 로드).
- **1.16 — 개명 + 거버넌스 리포지셔닝 + English-first 출력.** `@dowonk-7949/llm-wiki-standard` → `llm-wiki-governance`(unscoped; `llm-wiki` 명령은 불변) 개명, "AI가 쓴 프로젝트 문서를 위한 거버넌스(OKF-compatible)"로 포지셔닝, CLI 출력을 English-first로 전환(붙여넣는 handoff 프롬프트는 완전 영어; help/About/Next Step은 영어 우선). 부가적·프레젠테이션 — `1.0.0` 명령/`--format json`/프로그래매틱 API/frontmatter 계약·zero-dep 불변. `1.16.1`에서 스토어프론트(README 제목·`keywords`) 교정. 신규 게이트 없음.

## 릴리스 계획 (post-1.16) — 가치를 증명하고, 메모리 루프를 닫는다

독립 제품 정체성 감사(`outputs/audits/product-identity-audit.md`, **Conditional Go**)는 거버넌스 코어는 실제이고 이름도 정확하지만, 궁극적 가치 사슬 — 지속적 프로젝트 메모리 → 재탐색 감소 → 토큰 절감/더 빠르고 안전한 작업 — 이 **미검증**이고, 런치 주장 2개(프로즈의 의미적 "검증", MCP로 문서 본문 "query")를 철회해야 했음을 밝혔다. 그래서 이 라인은 **먼저 측정하고, 그다음 메모리 스토리를 진짜로 만드는 두 기능을 만든다** — 동일 규율(코드 전에 게이트), 각 후속 게이트는 Gate 22 하니스로 재측정. 순서: 측정 → 최고 레버 거버넌스 완결 → "프로젝트 메모리"를 참으로 만드는 메커니즘.

### Gate 22 — Impact 측정 (앞으로 당김)

더 만들기 전에 코어 가치를 증명(또는 반증)한다. 재현 가능·opt-in·zero-dep 벤치마크 하니스가 대표 태스크를 **위키 있음/없음**으로 실행해 input tokens·열어본 파일 수·task 성공·소요시간을 기록하고, 위키 읽기+유지 비용까지 세는 정직한 방법론과 baseline을 남긴다. 주로 검증 트랙(shipped 계약 변경 없음; `bench` 헬퍼는 후속 minor). 불리한 결과 포함 정직하게 보고. **숫자가 뒷받침하기 전까지 token/속도 주장은 안 싣는다.** 주의: 재탐색 감소 메커니즘은 retrieval(Gate 24)이 완성하므로, 헤드라인은 raw baseline이 아니라 retrieval 전후 **delta**다. 범위: `GATE_REVIEW.md`(Gate 22, accepted).

**상태: 하니스+베이스라인 완료.** `bench/` 하니스(zero-dep·repo-내부·npm `files` 밖이라 미배포)를 만들고 베이스라인을 기록했다 — `bench/README.md`·`bench/METHODOLOGY.md`·`bench/results/baseline.md`(거버넌스 기록: `docs/llm-wiki/BENCHMARK.md`). 이 레포 첫 측정(태스크 6개): 세션 단위로 거버넌스 위키는 whole-file grep(A1)의 **0.59×**, 보수적 snippet-grep(A2)의 **0.89×** 입력 토큰이지만, **단일 태스크 6개 중 3개**에서는 보수적 하한(A2)에 진다. 탐색 성공률은 **100%/100% 동률** — 즉 여기서 입증된 이점은 findability가 아니라 컨텍스트 크기이며, 오리엔테이션 읽기를 멀티-태스크 세션에 분할상환할 때만 성립한다. 예측대로 modest·정직한 베이스라인이고, 헤드라인은 여전히 retrieval 전후 delta다(이후 게이트마다 `node bench/run.js --against`로 재측정).

### Gate 23 — 변경소스 → 위키 reverse-impact 게이트

감사가 찾은 최대 비전-현실 간극: 현재 drift는 날짜 기반이라 가장 중요한 경우 — 코드와 문서가 **다른 곳/PR**에서 바뀌는 경우 — 를 놓친다. `source_files`/`evidence`의 git-diff 역색인을 만들어, 참조된 코드를 건드리는 변경이 관련 `verified` 문서를 flag하게 한다(working-tree/PR-base 인식), strict-governance preset은 drift에서 CI 실패 가능. "위키가 코드를 따라간다"를 실제·CI 강제로 만든다. 부가적·opt-in·zero-dep. 범위: `GATE_REVIEW.md`(Gate 23, **accepted for 1.17.0**; 기존 `changedFiles`/`verifiedSourceAnchors` 프리미티브 재사용이라 대부분 배선 작업).

**상태: 1.17.0에 shipped.** 읽기 전용 `impact` 명령이, 참조한 `source_files`/`evidence`가 현재 변경집합(working tree 또는 `--since <ref>`)에 들어 있는데 문서 자신은 같은 diff에서 안 바뀐 `verified` 문서를 flag한다 — 날짜 기준 `evidence.stale`의 diff 기준·pre-merge 보완이다. 신규 toggleable `impact.source_changed`(기본 warning), `--strict`는 CI 실패 error로 승격, 빈 변경집합은 no-op. `driftTargets`와 `scanReverseImpact`가 순수 `verifiedSourceAnchors` 추출기를 공유한다(동작 보존). 릴리스 노트: `docs/llm-wiki/releases/v1.17.0.md`.

### Gate 24 — 읽기 전용 retrieval (search/get) MCP + API

"프로젝트 메모리 / 에이전트가 위키를 query" 스토리를 참으로 만든다(런치에서 철회한 부분). status/visibility 필터가 있는 읽기 전용 `list_docs`/`search_docs`/`get_doc`/`get_related`를 MCP·프로그래매틱 API로 추가 — 거버넌스 보고가 아니라 **문서 본문**을 반환. **여기서 재측정** — 재탐색/토큰 delta가 나타날 지점. 부가적·opt-in·zero-dep.

**상태: 초안 — proposed, 아직 미수락.** 범위는 `GATE_REVIEW.md`(Gate 24): 읽기 전용 4개 연산 — `list_docs`, `search_docs`(**zero-dep 키워드/부분문자열, 정직하게 semantic 아님**), `get_doc`, `get_related` — 이며 `listWikiContentDocs`·frontmatter 파서·`collectWikiGraph`를 재사용한다. `visibility` 필터 + sensitive-info 스캔 재사용(raw 민감값 미반환), 쓰기 표면 없음. MINOR(`1.18.0`) 예상. 코드 전 사람 수락 대기.

### Gate 25 — Evidence 의미 단계화

감사가 실증한 신뢰 갭 해소(존재하지 않는 symbol을 인용해도 지금은 통과). `reference_checked`와 `human_verified`를 구분하고, 지원 언어부터 symbol/route 존재를 실제 검사하며, strict preset은 근거 없는 `verified`를 실패시킨다. 부가적·opt-in·zero-dep. (코드 전에 신규 게이트.)

### Gate 26 — Agent 실행 러너 + 완료 계약

self-evolving 워크플로 조각: 스킬 실행이 구조화된 manifest(변경 코드·영향 문서·log 갱신·검증)를 남기고 CI가 누락된 위키 갱신을 검출 — 프로즈는 여전히 에이전트가 쓰되 파이프라인은 강제된다. 크고 모호 → 마지막. (코드 전에 신규 게이트.)

### P3 도입 장벽 (흡수)

brownfield 적합성(기존 대형 문서셋)과 비-JS 팀의 Node 런타임 장벽은 별도 기능이 아니라 위 게이트(특히 23/24) 안에서 다루고, 측정(Gate 22)이 실제 어디서 도입이 막히는지 보여준 뒤 재검토한다.

## 미배치 1.x 백로그 (Unscheduled 1.x Backlog)

할 만하지만 아직 릴리스에 배치하지 않은 부가 후보:

- 실제 워크플로가 드러나면 `prompt --task` 프리셋 추가.

위 릴리스 계획으로 승격: stdlib 서버 감지(→ 1.14, Gate 19).

1.7.0에서 출시: 명령별 JSON `help` 예시. 위 릴리스 계획으로 승격: 더 풍부한
enrichment 린팅(→ 1.8, 토글 가능한 `content.thin_body` 규칙으로).

## 1.x 지평 너머 (Beyond the 1.x Horizon — 지금 계획 안 함)

`1.0.0` 계약을 깨므로 향후 major 버전이 필요한 변경. 잊지 않도록 기록하되 —
**일정 없음, 실제 필요가 당길 때만**:

- frontmatter 계약 정리: 중복된 `verified` 태그 폐기(status가 이미 담고 있음),
  `doc_type`를 OKF `type`으로 통일(별칭 제거).
- 기본값 전환: `content.not_enriched`/`related.missing`를 error로 만들거나,
  드리프트 자동 강등을 opt-in이 아닌 기본으로.

## 명시적 보류/반려 (Explicitly Declined or Deferred — 현재 판단)

- **core에 전면 Markdown → HTML 정적 사이트 생성기/렌더러: 반려.** 무런타임 의존성
  불변식과 충돌하고 MkDocs/Docusaurus 영역으로 scope creep을 부르며, 생태계가 이미
  Markdown-in-git corpus를 더 잘 렌더링한다. 한정된 퍼블리시 가이드 + 대시보드
  인덱스(1.4)가 목표를 저렴하게 달성한다.
- **원문 → OKF 완전 자동 추출: 보류.** `okf-extract`로 프롬프트 보조 방식을 유지;
  엔티티/이벤트 자동 추출은 사람 검토 모델과 상충한다.
- **모든 문서에 `owner` 필수화: 반려.** 기존 저장소를 오류로 뒤덮고 점진적 도입과
  충돌한다.
- **`verified` 자동 승격: 절대 안 함.** `verified`는 마이그레이션 엔진을 포함한 모든
  명령에서 사람만 승인한다.
- **Notion 네이티브 모드: 계획 없음.** Notion은 손실 import가 필요하다; 수요가
  생기면 core 기능이 아니라 단방향 하위 Markdown → Notion 미러로 다룬다.

## 비목표 (Non-Goals — 안전 원칙 불변)

- 명시적 `--write`/`--apply` 없이는 쓰지 않는다; 어디서나 미리보기 우선.
- `log.md`나 기존 adapter 파일을 결코 덮어쓰지 않는다; 민감정보 raw value를 결코
  기록하지 않는다.
- core CLI에 런타임 서드파티 의존성 없음.
- AI·CLI가 작성한 문서는 사람이 검증하기 전까지 `needs_review`.
