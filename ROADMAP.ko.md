---
title: LLM-WIKI Standard Roadmap
tags:
  - llm-wiki
  - roadmap
  - package
  - cli
status: needs_review
doc_type: roadmap
project: llm-wiki-standard
last_updated: 2026-07-15
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

# LLM-WIKI Standard Roadmap

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

검증·그래프를 집계하는 패키지별 wiki를, **이미 cwd 파라미터화된 파이프라인**
(`audit` / `collectWikiGraph` / `findMissingDocs`) 위의 opt-in map으로 만든다. JSON
형태는 엄격히 부가적인 `packages[]`라 단일 저장소 출력은 byte 동일하게 유지된다. 이제
config 토글·실 CI 피드백·enrichment 신호를 손에 쥐고 만든다. `detector.js`에 부가적
워크스페이스 *감지*를 먼저 넣고, 무의존성 pnpm/YAML 워크스페이스 파싱은 정직하게
미룬다(npm/yarn `workspaces` 먼저).

### 1.11 — 크로스레포 지식 링크

보수적·**비-fetch** 참조 포맷(예약 스킴)으로, 별도 저장소의 API 스펙·도메인
문서·서비스 계약에 대한 크로스레포 참조가 missing-target 규칙에 걸리지 않고 해소되게
한다 — 인식하되 절대 검증하지 않는다(검증은 네트워크/git이 필요해 무의존성 불변식을
깬다). 마지막: 가장 설계 부담이 크고 피드백이 필요하며, 모노레포·config 확장·가시성이
먼저 갖춰져야 한다. 지금 바로 가능한 슬라이스는 먼저 낼 수 있다 — external-reference
분류기를 강화해 크로스레포 `[[..]]` 링크가 잘못된 `wiki_link.missing`을 뱉지 않게 한다.

이렇게 나눈 이유: 순서는 레버리지·리스크·의존성 기준이다. 각 마이너는 독립적으로
출시·검증 가능하고, 가장 크고 피드백이 필요한 기능(모노레포, 크로스레포)은 더 저렴한
도입·config 작업이 CLI를 실제 다중 팀 사용 앞에 세운 뒤에 온다.

## 미배치 1.x 백로그 (Unscheduled 1.x Backlog)

할 만하지만 아직 릴리스에 배치하지 않은 부가 후보:

- 실제 워크플로가 드러나면 `prompt --task` 프리셋 추가.
- stdlib 서버 감지 — Go `net/http`·Python stdlib HTTP 서버를 `library`가 아닌
  `backend`로 분류(1.3에서 보류: 신뢰할 수 있는 감지는 소스 스캔이 필요하고 오탐
  위험이 커 bounded 휴리스틱이 필요).

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
