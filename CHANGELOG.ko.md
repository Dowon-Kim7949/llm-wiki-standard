> Language: [English](./CHANGELOG.md) | [한국어](./CHANGELOG.ko.md)

# 변경 이력 (Changelog)

`@dowonk-7949/llm-wiki-standard`의 주요 변경 사항을 기록합니다. 이 프로젝트는
[유의적 버전(Semantic Versioning)](https://semver.org/)을 따르며, 항목은 최신순입니다.

## 1.0.1 — 2026-07-14

문서 전용 패치. 기능·API·명령 표면 변경 없음.

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
