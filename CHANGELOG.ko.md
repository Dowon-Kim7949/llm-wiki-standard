> Language: [English](./CHANGELOG.md) | [한국어](./CHANGELOG.ko.md)

# 변경 이력 (Changelog)

`@dowonk-7949/llm-wiki-standard`의 주요 변경 사항을 기록합니다. 이 프로젝트는
[유의적 버전(Semantic Versioning)](https://semver.org/)을 따르며, 항목은 최신순입니다.

## 1.3.0 — 2026-07-14

디텍터 & 어댑터 확장. 더 많은 프로젝트·도구를 기본 지원한다. 하위호환 — 새 감지·
어댑터·opt-in 허용만 추가.

### 추가 (Added)

- backend/fullstack `init`이 업무 도메인 디렉터리(`src|app/{domains,domain,modules,
  features}`·`internal/{domain,domains,modules}`의 직속 하위, 공통 기술 디렉터리 제외)를
  감지해 도메인별 문서(`domains/NN_<name>.md`, `doc_type: domain`, `source_files`=탐지
  디렉터리)를 만들고 `domains/00_overview.md`에서 링크한다. 결정적 정렬, 여러 위치의
  동일 도메인은 하나로 병합.
- PHP(`composer.json`)·Ruby(`Gemfile`/`gems.rb`)·.NET(`*.csproj`/`*.fsproj`) 생태계
  감지. 웹 프레임워크 신호로 backend/library 판정.
- Windsurf(`.windsurf/rules/llm-wiki.md`)·Gemini CLI(`GEMINI.md`) writable 어댑터
  추가, JetBrains AI(`.junie/guidelines.md`)는 info-level candidate. `--agent all`은
  하위호환으로 codex/claude/antigravity 유지.

### 변경 (Changed)

- OKF `type`를 필수 `doc_type` 필드의 alias로 허용한다. OKF 스타일 문서가 필드를
  중복하지 않고 검증을 통과한다. Additive — 제거·rename 없음.

## 1.2.0 — 2026-07-14

안전 업그레이드 & 마이그레이션. 기존 wiki를 삭제·재생성하지 않고 CLI 계약에 맞춰
유지한다. 하위호환 — 새 opt-in 동작만 추가.

### 추가 (Added)

- `wiki_block_version` 인식 업그레이드 리포트: `migrate`(와 `doctor`)가 각 문서의
  기록된 블록버전과 설치된 CLI 사이의 계약 갭을 보여준다. stamp되는 값의 단일
  소스는 이제 `CURRENT_WIKI_BLOCK_VERSION`이다.
- `migrate --apply`를 승인된 preview-first 범위(`GATE_REVIEW.md`, Gate 8)로
  해금했다. `fix` 엔진 + `wiki_block_version` 업그레이드를 재사용해, 문서를 현재
  계약으로 올리고 부합해지면 블록버전을 stamp한다. `verified` 문서 내용이나
  `status`는 건드리지 않으며, 더 최신 CLI가 stamp한 문서는 다운그레이드하지 않는다.
- `llm-wiki drift`: `verified` 문서의 `evidence.stale` 드리프트를 보고하고,
  `--downgrade`가 있을 때만 드리프트된 문서를 `needs_review`로 내린다(`status`·
  `last_updated`만, `verified` 승격은 절대 없음; `GATE_REVIEW.md`, Gate 9).

### 변경 (Changed)

- `evidence.stale`에 라인 단위 정밀도를 추가했다: 소스가 정확한 `#Lx-Ly` evidence로만
  인용된 경우 파일 전체가 아니라 해당 라인 범위로 드리프트를 검사해, 무관한 편집은
  더는 잡지 않는다. broad 참조가 있으면 기존 file-level 검사를 유지한다.
- `VERSIONING.md`·`project-profile.md`를 version-agnostic으로 바꿨다 — 버전 숫자를
  고정하지 않고 `package.json`을 단일 소스로 참조한다.

## 1.1.0 — 2026-07-14

"inner-loop cleanup" 라인: 일상 검증을 더 빠르고 조용하게. 하위호환 — 파괴적 변경
없음.

### 추가 (Added)

- `validate --changed` — 리포트되는 findings를 작업트리(또는 `--since <ref>` 기준)
  대비 변경된 wiki 문서로 한정한다. pre-commit·PR CI를 빠르게 한다. 교차 문서
  검사는 여전히 전체 wiki에 대해 실행된다.
- `pre-commit` 훅 템플릿(`templates/git-hooks/pre-commit`) — `validate --changed`를
  실행한다. 설치법은 `templates/git-hooks/README.md`.
- CI consumer-install 잡이 packed tarball에 대해 Quick Start 명령(`doctor`,
  `init --dry-run`, `validate-frontmatter`)을 실행한다.

### 수정 (Fixed)

- `evidence.stale`이 소스 커밋일과 같은 날 검토된 verified 문서를 더는 오탐하지
  않는다. 드리프트 기준일을 그날의 끝으로 앵커링해, 다음 날 이후 커밋만 집계한다.

### 변경 (Changed)

- `ROADMAP.md`를 미래 지향·날짜 없는 `1.x` 라인으로 재작성했다(구현 이력은 이
  CHANGELOG와 `docs/llm-wiki/log.md`로 이관).
- 외부 공개 루트 문서의 국문 쌍(`CHANGELOG.ko.md`, `ROADMAP.ko.md`)을 추가하고
  영문 정본과 상호링크했으며 패키지에 포함했다. EN–KO 쌍 규약을 확립했다
  (`docs/llm-wiki/README.md`).

## 1.0.0 — 2026-07-14

첫 안정 릴리스. `1.0.0`은 `0.1.8` 계약을 **기능 명령 변경 없이** 안정 1.0
마일스톤으로 승격하며, 공개 계약을 안정으로 선언하고 릴리스 품질을 강화한다.

### 안정성 (Stability)

- CLI 명령·옵션 표면, `--format json` 출력 형태, 필수 frontmatter 계약을 안정
  계약으로 확정했다. 이후 이들에 대한 파괴적 변경은 major 버전 상승이 필요하다.
  `GATE_REVIEW.md`("1.0.0 Stability Milestone")와 `docs/llm-wiki/VERSIONING.md`
  참조.

### 추가 (Added)

- 릴리스 품질 CI: Node 18.18.0 / 20 / 22 / 24 × Windows / macOS / Linux verify
  매트릭스와 packed-tarball consumer install 스모크 테스트
  (`.github/workflows/ci.yml`).
- npm 패키지에 포함되며 누적 관리되는 루트 `CHANGELOG.md` 신설.

### 참고 (Notes)

- 보수적 쓰기 정책은 그대로다: `init` / `quickstart` / `fix`는 `--write`에서만
  쓰고, `migrate --apply`는 차단을 유지하며, `log.md`와 기존 adapter 파일은 결코
  덮어쓰지 않고, CLI·에이전트가 작성한 문서는 `needs_review`로 유지된다.

## 이전 (0.1.x)

1.0 이전 이력은 `docs/llm-wiki/log.md`와 `docs/llm-wiki/releases/` 아래 릴리스별
노트에 기록되어 있다. 주요 항목:

- `0.1.8` — 범위 한정 `fix` 자동수정 명령과 근거 드리프트 감지(`evidence.stale`).
- `0.1.7` — 다중 생태계 감지(Python/Go/Rust/JVM), Cursor·Copilot 어댑터,
  `llm-wiki.config.json`, `release-notes` 명령.
- `0.1.6` — 실제 생성 일자, `related.missing`·`content.not_enriched` 검증,
  wiki-graph orphan 감지, `--format html` 대시보드.
