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
last_updated: 2026-07-14
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

## 1.0.0까지 구현 완료 (Shipped Through 1.0.0)

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

## 릴리스 계획 (1.1 → 1.7)

### 1.1 — Inner-loop 정리

목표: 일상 사용과 CI를 더 빠르고 조용하게 하고, 알려진 흠 하나를 없앤다.

- **`evidence.stale` 같은날 경계 수정.** `fileChangedSince`가
  `git log --since=<date>`(`src/git.js`)를 쓰는데, 이 방식은 리뷰 당일 커밋도
  포함한다. 그래서 소스가 커밋된 날과 같은 날 검토된 문서는 즉시 `evidence.stale`
  경고를 낸다(1.0.0 준비 중 21건 관측). 날짜 포함 `--since` 대신 커밋
  타임스탬프로 비교한다.
- **`validate --changed`** — 특정 git ref 이후 변경된 문서(및 그 근거)만 검증하는
  diff 한정 실행. pre-commit·CI를 빠르게 한다.
- **pre-commit 훅 템플릿**과 packed 아티팩트 대상 Quick Start 명령 점검(Phase 7
  체크리스트의 남은 항목 하나).

먼저 하는 이유: 작고 위험이 낮으며 자주 쓰여 효과가 크고, 드리프트 로직 위에
무언가를 쌓기 전에 혼란스러운 경고를 없앤다.

### 1.2 — 안전 업그레이드 & 마이그레이션 — 헤드라인

목표: 버전 업그레이드를 안전하게 만들어, 도입자가 삭제-후-재생성을 하지 않도록 한다.

- **`wiki_block_version` 인식 업그레이드 리포트** — wiki의 생성 버전과 설치된 CLI
  사이의 계약 격차를 보여준다.
- **`migrate --apply`를 승인된 범위로 해금** — 0.1.0부터 차단돼 있었다(GATE_REVIEW
  Gate 4). `fix` 엔진을 재사용해 기계적 격차(누락·개명된 필수 필드, `## Evidence`
  섹션, 오래된 메타데이터)를 채우는, 사전 결정된 미리보기 우선·`verified` 보존
  범위를 부여한다.
- **드리프트 시 opt-in `verified → needs_review` 자동 강등**과 line/symbol 단위
  드리프트 정밀도(`evidence.stale` 확장).

전제: 구현 전 `migrate --apply` 범위에 대한 새 GATE_REVIEW 게이트 결정이 필요하다.
여기 두는 이유: 이것이 실사용 최대 통증이다 — 한 유지보수자가 구버전 wiki를
업그레이드하는 대신 `docs/llm-wiki`를 삭제했다.

### 1.3 — 디텍터 & 어댑터 확장

목표: 더 많은 프로젝트와 도구를 기본 지원한다.

- **디텍터 심화** — stdlib 서버 한계 해소(현재 Go `net/http`, Flask 등은
  `library`로 분류됨)와 PHP(`composer.json`), Ruby(`Gemfile`), .NET(`*.csproj`)
  추가.
- **어댑터 추가** — Windsurf(`.windsurf/rules`), JetBrains AI, 그리고
  Gemini/Antigravity 계약 확정. `ADAPTER_TARGETS` 패턴 재사용.
- **부가적 OKF 정렬** — OKF `type`을 `doc_type`과 병존하는 선택적 별칭으로 수용
  (제거는 하지 않음; 파괴적 통일은 `1.x` 밖으로 유지).

여기 두는 이유: 위험이 낮고 대상 범위를 넓히며 의존성이 없다.

### 1.4 — 보이는 지식 (Knowledge you can see)

목표: 정적 사이트 생성기가 되지 않으면서 "쉬운 지식 전달" 격차를 메운다.

- **`llm-wiki graph`** — 지식 그래프를 Mermaid·DOT·JSON으로 내보내는 1급 명령.
- **`llm-wiki stats`** — 헬스 점수: enrichment %, verified %, 근거 커버리지,
  staleness.
- **한정된 reader-friendly 퍼블리싱** — 짧은 "사람 독자용 퍼블리시" 가이드(GitHub
  렌더링; corpus의 `[[links]]`와 `aliases`를 네이티브로 읽는 Obsidian; MkDocs)와,
  많아야 기존 zero-dependency 대시보드에 소스 마크다운으로 링크되는 문서 인덱스를
  추가. 정적 사이트 생성기는 아니다(아래 Declined 참조).

여기 두는 이유: 안정된 그래프/리포트 데이터 위에 쌓는다; 비개발자 독자와 테크
리드에게 도움이 된다.

### 1.5 — 프로그래매틱 API

목표: CI 래퍼·에디터·테스트가 프로세스를 띄우지 않고 LLM-WIKI를 쓰게 한다.

- **문서화된 임포트 가능 API** — 명령 함수 위의 `exports` 맵과 안정적인 타입 반환
  형태.
- **`--format json`에 `schemaVersion`**(부가) — 래퍼가 출력 계약을 고정할 수 있게.

여기 두는 이유: 생태계 작업(1.6)이 의존하는 토대이며, 반환 형태 계약을 의도적으로
고정하게 만든다.

### 1.6 — 에이전트 네이티브 (MCP)

목표: Codex / Claude Code / 기타 에이전트가 wiki를 네이티브로 유지관리하게 한다.

- **MCP 서버** — `validate`, `audit`, `next`, `graph`, `handoff`/`prompt`를 도구로
  노출해, 에이전트가 shell을 거치지 않고 wiki를 질의·점검한다.

여기 두는 이유: 에이전트 우선 레버리지가 가장 크지만, 1.5 API의 안정화에 의존한다.

### 1.7 — 팀 & 조직 확장

목표: 단일 저장소·단일 유지보수자를 넘어선 도입을 지원한다.

- **모노레포 프로필** — 검증·그래프를 집계하는 패키지별 wiki.
- **크로스레포 지식 링크** — 별도 저장소에 있는 API 스펙·도메인 문서·서비스 계약을
  위한 보수적 참조 형식.
- **config 스키마 확장** — 커스텀 문서 세트, 프로젝트별 규칙 토글, 템플릿
  오버라이드(최소 `llm-wiki.config.json` 형태의 실사용을 게이트로).
- **가시성 거버넌스** — `internal|restricted|public`의 선택적 강제.
- **1급 GitHub Action + GitHub Release** — 한 `uses:` 스텝짜리 composite action과,
  태그 push 시 릴리스 노트로 생성되는 GitHub Release.

마지막에 두는 이유: 표면이 가장 넓고 의존성이 가장 많으며, 설계 전에 실제 다중 팀
피드백이 가장 필요하다.

## 미배치 1.x 백로그 (Unscheduled 1.x Backlog)

할 만하지만 아직 릴리스에 배치하지 않은 부가 후보:

- 더 풍부한 enrichment 린팅(근거는 있으나 본문이 빈약한 문서 감지).
- 래퍼 작성자를 위한, `help` 출력의 명령별 JSON 예시.
- 실제 워크플로가 드러나면 `prompt --task` 프리셋 추가.

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
