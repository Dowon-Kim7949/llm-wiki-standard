> Language: [English](./CONTRIBUTING.md) | [한국어](./CONTRIBUTING.ko.md)

# llm-wiki-governance 기여 가이드

`llm-wiki-governance`(AI가 쓴 프로젝트 문서를 검증·드리프트 감지·코드 그라운딩하는
무의존성 거버넌스 CLI, OKF-compatible) 개선에 관심 가져주셔서 감사합니다. 이 문서는 개발 환경 구성, 변경 방법,
PR 여는 방법을 안내합니다.

기여에 참여하면 [행동 강령](./CODE_OF_CONDUCT.md)을 준수하는 데 동의하는 것으로
봅니다.

## 기여 방법

- **버그 신고** — [버그 리포트](https://github.com/Dowon-Kim7949/llm-wiki-governance/issues/new?template=bug_report.md)를 열어 주세요.
- **기능 제안** — [기능 요청](https://github.com/Dowon-Kim7949/llm-wiki-governance/issues/new?template=feature_request.md)을 열어 주세요. 먼저 [ROADMAP.md](./ROADMAP.md)에서 이미 계획된 항목인지 확인해 주세요.
- **문서 개선** — README/CHANGELOG/ROADMAP 및 `docs/llm-wiki/`의 LLM-WIKI.
- **취약점 신고** — 공개 이슈로 열지 **마시고** [보안 정책](./SECURITY.md)을 따라 주세요.

## 사전 요구사항

- **Node.js `>=18.18.0`** (`package.json`의 `engines` 참고).
- 런타임 서드파티 의존성 없음 — CLI는 Node 내장 모듈만 사용합니다. 충분히
  논의된 강한 이유가 없다면 이 원칙을 유지해 주세요.

## 시작하기

```bash
git clone https://github.com/Dowon-Kim7949/llm-wiki-governance.git
cd llm-wiki-governance
npm install
npm test             # node --test tests/*.test.js
```

자주 쓰는 스크립트:

| 명령 | 설명 |
|---|---|
| `npm test` | 테스트 실행 (`node --test tests/*.test.js`) |
| `npm run verify` | 테스트 + `validate-frontmatter` (릴리스 게이트 점검) |
| `npm run doctor` | 환경·프로젝트 진단 |
| `npm run audit` | 이 저장소의 전체 LLM-WIKI 감사 |
| `npm run validate-frontmatter` | wiki frontmatter 계약 검증 |
| `npm run lint` | zero-dep 문법 게이트 — 모든 소스에 `node --check`(linter 의존성 없음) |
| `npm run test:coverage` | Node 내장 커버리지로 테스트(`node --test --experimental-test-coverage`, Node 20+) |
| `npm run sbom` | 공급망 검토용 CycloneDX SBOM 생성(`npm sbom`) |

개발 중에는 `node bin/llm-wiki.js <command>`로 CLI를 직접 실행할 수 있습니다.

## 프로젝트 규칙

이 저장소는 **자기 표준을 자체 적용(dogfooding)** 하며, 지식 기반은
`docs/llm-wiki/`에 있습니다. 코드나 문서를 변경하기 전에
[`docs/llm-wiki/index.md`](./docs/llm-wiki/index.md)를 읽어 주세요.

- **모든 파일 UTF-8.** Markdown은 UTF-8로 읽고 씁니다.
- **크로스플랫폼.** CI는 Linux/Windows/macOS에서 Node 18.18/20/22/24로
  실행됩니다. OS 종속 경로 처리를 피하고 `node:path`를 사용하세요.
- **민감정보 금지** — 문서, 로그, 리포트, 프롬프트에 민감정보를 넣지 않습니다.
- **LLM-WIKI 규율:**
  - LLM이 생성·수정한 문서는 `needs_review`로 유지합니다. `verified`는 사람
    검토 후에만 설정합니다.
  - 코드나 문서를 변경하면 관련 wiki 문서를 갱신하고
    [`docs/llm-wiki/log.md`](./docs/llm-wiki/log.md)에 항목을 추가합니다(append-only).
- **영·국문 문서 쌍.** `README`, `CHANGELOG`, `ROADMAP` 및 이 커뮤니티 문서는
  영문(`*.md`, 정본) + 국문(`*.ko.md`) 쌍으로 유지하며 상단에 `> Language:`
  상호링크를 둡니다. 한쪽을 고치면 짝도 갱신하세요.
- **새 검증을 추가하나요?** 기존 패턴을 따르세요: `scan<Something>(cwd)` 함수
  추가 → `audit`에 findings 합류 → rule은 `category.subrule` 형식 →
  `FINDING_EXPLANATIONS`에 등록해 `explain`이 조치법을 안내하도록. 자세한 내용은
  [`docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md`](./docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md).

## 테스트

- 동작이 바뀌면 `tests/` 아래 테스트를 추가·갱신하세요.
- 테스트는 결정적이고 플랫폼 독립적으로 유지하세요.
- PR을 열기 전에 `npm test`(및 `npm run verify`)가 통과해야 합니다. CI가 전체
  매트릭스를 실행합니다.

## 품질 게이트 & 의존성

이 프로젝트는 **런타임 AND 개발 의존성 모두 0**을 유지합니다 — 실수가 아니라
의도된 정체성입니다. 기여자에게 두 가지 함의가 있습니다:

- **스타일은 linter 의존성이 아니라 리뷰로 강제합니다.** ESLint/Prettier가
  없습니다. `npm run lint`는 소스에 대한 `node --check` 문법 게이트이고
  (`scripts/lint-syntax.mjs`), `.editorconfig`가 공백 규칙을 담습니다. 주변
  코드의 스타일을 따르세요 — 리뷰어가 이탈을 지적합니다.
- **커버리지는 Node 내장을 씁니다.** `npm run test:coverage`
  (`node --test --experimental-test-coverage`, Node 20+) — `nyc`/`c8`가 아닙니다.
  게이트가 아니라 보고용이라 커버리지 도구가 의존성이 되지 않습니다.

강력히 논의된 이유 없이 런타임·개발 의존성(또는 lockfile 항목)을 **추가하지
마세요** — 이 프로젝트의 정체성인 zero-dependency 입장을 깨뜨립니다. 공급망 검토:
`npm run sbom`이 CycloneDX SBOM을 내고, GitHub 네이티브 CodeQL 워크플로가 push/PR에서
스캔합니다.

## 커밋 & PR 흐름

1. 포크 후 `main`에서 토픽 브랜치를 만듭니다.
2. 명확한 메시지로 집중된 커밋을 남깁니다.
3. 로컬에서 `npm run verify`가 통과하는지 확인합니다.
4. `main` 대상으로 PR을 열고 [PR 템플릿](./.github/pull_request_template.md)을 채웁니다.
5. CI(테스트, frontmatter 검증, `doctor`, `npm pack --dry-run`, consumer
   install)가 모두 통과해야 합니다.

PR은 작고 범위를 좁게 유지하세요. 관련 없는 변경은 별도 PR로 나누면 리뷰가
쉬워집니다.

## 릴리스

릴리스는 메인테이너가 담당합니다. 배포는 `v*` 태그로 npm Trusted Publishing을
통해 자동화됩니다(`.github/workflows/publish.yml`). 게이트와 의사결정 기록은
[`RELEASE_CHECKLIST.md`](./RELEASE_CHECKLIST.md)와 [`GATE_REVIEW.md`](./GATE_REVIEW.md)를
참고하세요.

## 질문

[이슈](https://github.com/Dowon-Kim7949/llm-wiki-governance/issues)를 열어 주세요 —
다만 README와 `docs/llm-wiki/`를 먼저 확인해 주세요. 많은 답이 이미 거기에
있습니다.
