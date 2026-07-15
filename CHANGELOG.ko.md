> Language: [English](./CHANGELOG.md) | [한국어](./CHANGELOG.ko.md)

# 변경 이력 (Changelog)

`@dowonk-7949/llm-wiki-standard`의 주요 변경 사항을 기록합니다. 이 프로젝트는
[유의적 버전(Semantic Versioning)](https://semver.org/)을 따르며, 항목은 최신순입니다.

## 1.7.1 — 2026-07-15

패치. 저장소 위생만 정리 — CLI·JSON·프로그래매틱 API·frontmatter 계약 변경 없음,
런타임 동작 변경 없음.

### 수정 (Fixed)

- `src/commands.js`가 `wikiGraph` 엣지 중복제거 키(`collectWikiGraph` → `addEdge`)의
  구분자로 날것의 `U+0000`(NUL) 제어 바이트를 소스에 박아 두고 있었다. git `text=auto`가
  이 파일을 바이너리로 분류해, 저장소 `.gitattributes`의 `eol=lf` 정규화에서 유일하게
  제외되어 CRLF로 저장됐다. 날것 바이트를 `\\u0000` 이스케이프로 교체하고 파일을 LF로
  재정규화해, 이제 다른 모든 소스 파일과 동일하게 줄바꿈 정책을 따른다.

### 참고 (Notes)

- 기능 변경 없음: 템플릿 리터럴의 `\\u0000`은 런타임에서 동일한 NUL 코드포인트를
  만들므로 엣지 중복제거는 바이트 단위로 동일하다. 커밋 diff 대부분은 `src/commands.js`의
  일회성 CRLF→LF 재정규화다.

## 1.7.0 — 2026-07-15

CI/CD 도입. 위키를 GitHub Actions·릴리스 자동화에 쉽게 연결한다. 분할된 "팀 & 조직
확장" 라인의 리드 슬라이스다. 하위호환 — 부가 명령 모드·컴포지트 액션·릴리스 잡만
추가하며 CLI·JSON·프로그래매틱 API·frontmatter 계약은 불변이고 런타임 의존성 추가도
없다.

### 추가 (Added)

- `release-notes --body-only` — 변경 섹션 본문만 출력한다(frontmatter·H1 제목·"게시
  전 검토" 스캐폴드 라인 제외). GitHub Release 본문용이다. 커밋 제목이 본문에
  들어가므로 민감정보 스캔을 돌려 매치 시 차단한다(exit 2, 본문 withhold). 근거:
  `src/release-notes.js`, `src/commands.js`, `src/cli.js`.
- `.github/actions/validate/action.yml`의 컴포지트 GitHub Action — 읽기 전용
  `validate`를 `npx`로 감싼다. 다른 액션을 전혀 끌어오지 않아(bash + npx만) 무의존성
  원칙을 유지하고 읽기만 한다. 정확한 `vX.Y.Z` 태그/커밋 SHA로 고정해 참조한다.
- `v*` 태그 push 시 GitHub Release 자동화: `.github/workflows/publish.yml`의 격리된
  `contents: write` 잡(`needs: publish`)이 `release-notes --body-only` 본문으로,
  러너 내장 `gh` CLI로 릴리스를 생성한다(서드파티 릴리스 액션 없음).
- 읽기 전용 리포트 명령 10개(`doctor`·`validate`·`validate-frontmatter`·`audit`·
  `status`·`next`·`stats`·`graph`·`explain`·`release-notes`)의 `help`에 명령별
  `--format json` 예시 추가.

### 참고 (Notes)

- 부가적·하위호환이며 무의존성 정책을 유지한다. 범위: `GATE_REVIEW.md`(Gate 12).
  CI/CD 라인을 분할해 `1.7.0`은 리드 슬라이스만 낸다 — Marketplace 게시, floating
  `@v1` 태그, config 로딩/init 스캐폴딩/doctor echo enabling prep, `1.8`–`1.11`은
  보류다.

## 1.6.0 — 2026-07-14

에이전트 네이티브(MCP). 에이전트가 CLI를 spawn하지 않고 위키를 툴로 질의·점검하게
한다. 하위호환 — 새 명령·모듈만 추가하며 CLI·JSON·프로그래매틱 API·frontmatter 계약은
그대로다.

### 추가 (Added)

- `llm-wiki mcp` — stdio 위의 Model Context Protocol 서버(개행 구분 JSON-RPC 2.0).
  Node 내장만으로 구현(서드파티 MCP SDK 없음)해 무의존성 정책을 유지한다. MCP 클라이언트에
  `{ "command": "npx", "args": ["-y", "@dowonk-7949/llm-wiki-standard", "mcp"] }`로 등록한다.
- 읽기 전용 MCP 툴: `validate`, `audit`, `next`, `status`, `doctor`, `stats`, `graph`,
  `explain`, `handoff`, `prompt`. 쓰기/변경 명령은 노출하지 않으며 어떤 MCP 툴도 파일을 쓰지
  않는다(`annotations.readOnlyHint`). 각 `tools/call`은 명령의 구조화 결과(`schemaVersion`
  포함)를 `structuredContent`로, 사람용 요약을 텍스트로 반환한다. 명령 예외는 `isError`로.
- 패키지 진입점의 프로그래매틱 MCP 표면: `startMcpServer`, `MCP_TOOLS`, `handleMcpMessage`,
  `MCP_PROTOCOL_VERSION`. 범위: `GATE_REVIEW.md`(Gate 11).

### 참고 (Notes)

- 하위호환·부가적 변경. 배칭 미지원(pinned 프로토콜 `2025-06-18`에서 제거) — 배열 메시지는
  단일 `-32600`으로 응답한다. 이 버전은 MCP 툴 호출에 `llm-wiki.config.json` 기본값을
  병합하지 않는다(명시 인자만).

## 1.5.2 — 2026-07-14

커뮤니티 표준(Community standards). GitHub 권장 커뮤니티 표준을 충족하도록 저장소용
문서를 추가한다. CLI/API 변경 없음.

### 추가 (Added)

- 저장소 루트에 커뮤니티 헬스 문서(EN/KO 쌍): `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`,
  `SECURITY.md`(각각 `.ko.md` 짝). `package.json` `files`에 등록해 패키지에 포함한다.
- GitHub 템플릿: `.github/ISSUE_TEMPLATE/`(버그 리포트·기능 요청·config)와
  `.github/pull_request_template.md`.

### 참고 (Notes)

- 저장소/GitHub 대상 변경일 뿐, CLI 명령 표면·JSON 출력·프로그래매틱 API는 그대로다.
  `.github/` 템플릿은 npm에 실리지 않는다.

## 1.5.1 — 2026-07-14

1.5 신규 API를 소비 프로젝트에서 스모크 테스트하다 발견한 API/출력 결함 수정.
모두 additive/refinement라 안정 계약(CLI·JSON·frontmatter)은 그대로다.

### 수정 (Fixed)

- 명령 결과 객체가 최상단 `schemaVersion`(export된 `SCHEMA_VERSION`과 동일)을 항상
  담는다. 프로그래매틱 결과가 상수를 따로 import하지 않고도 출력 계약을 스스로 밝힌다.
  `.text`는 어떤 경우에도 렌더된 텍스트 리포트다 — `--format`은 CLI/`run()` stdout과
  `--out` 파일에만 영향을 주고 반환 객체는 바꾸지 않음(문서에 명시).
- `normalizeOptions`가 `parseArgs(argv)` 결과를 그대로 받는다(중첩 `.options`를 읽음).
  이제 `normalizeOptions(parseArgs(argv))`가 조용히 기본값으로 폴백되지 않는다. 일반 부분
  옵션을 넘기는 기존 방식도 그대로 동작한다.
- `run(argv)`가 `process.exitCode` 설정에 더해 숫자 exit code(`0`/`1`/`2`/`3`)를 **반환**해,
  in-process 호출자가 성패로 분기할 수 있다.
- `--format html` 대시보드의 Document Index 링크를 `--out` 파일 디렉터리 기준 상대경로로
  계산한다. 하위 폴더에 쓴 대시보드에서 문서 링크가 깨지던(404) 문제 해결.

## 1.5.0 — 2026-07-14

프로그래매틱 API. CLI 바이너리를 spawn하지 않고 CI 래퍼·에디터·테스트가
LLM-WIKI를 in-process로 쓸 수 있게 한다. 하위호환 — 새 import 표면과 부가적 JSON
필드 하나만 추가.

### 추가 (Added)

- `package.json` `exports`(`.` → `src/index.js`)로 import 가능한 프로그래매틱 API.
  CLI 명령 이름을 키로 하는 동결(frozen) `commands` 맵, 개별 명령 함수, `parseArgs`,
  `run`, `normalizeOptions`(부분 옵션 → 완전 옵션 객체), `SCHEMA_VERSION`을 공개한다.
  반환 형태는 JSDoc typedef와 `docs/llm-wiki/PUBLIC_API.md`로 문서화한다.
- `--format json` 출력에 부가적 최상단 `schemaVersion` 정수(export된 `SCHEMA_VERSION`과
  동일)가 붙어 래퍼가 출력 계약을 pin할 수 있다. 단일 소스는 `src/config.js`의
  `JSON_SCHEMA_VERSION`.

### 참고 (Notes)

- 부가적·하위호환: 기존 JSON 필드는 불변이라 현재 `--format json` 소비자는 그대로
  동작하고, 비-JSON 출력(text/markdown/html·graph mermaid/dot)은 영향받지 않는다.
  내부 모듈의 심층 외부 import는 `exports` 맵으로 캡슐화됐으며 `llm-wiki` 바이너리는
  영향받지 않는다.

## 1.4.0 — 2026-07-14

보이는 지식(knowledge you can see). wiki의 지식을 탐색·측정 가능하게 하고 도메인
감지를 넓혔다. 하위호환 — 읽기전용 명령·부가 감지만 추가.

### 추가 (Added)

- `llm-wiki graph` — 지식 그래프(문서 + wiki `[[links]]`·`related`·markdown 링크로
  해소된 문서→문서 엣지)를 text/JSON/Mermaid(fenced `graph TD`)/Graphviz DOT로
  출력. `graph`의 `--format`은 `text|json|mermaid|dot`.
- `llm-wiki stats` — 읽기전용 헬스 스냅샷: 헬스 스코어(verified %·enrichment %·
  evidence coverage %의 평균) + status 분포·stale·orphan 카운트.
- `--format html` 대시보드에 탐색용 **Document Index**(문서별 인바운드 수·orphan
  표시) 추가, README에 "사람 독자용 공개" 가이드(GitHub/GitLab, Obsidian, MkDocs).
- `init` 파일 기반 도메인 감지: FastAPI/Flask/Express/Rails/Go처럼 도메인이 라우트/
  리소스 모듈 **파일**(`endpoints/routers/routes/resources/controllers/handlers/
  *.ext`)인 경우도 디렉터리-도메인과 함께 감지한다. bounded·제외 가드로 오탐을 0에
  가깝게(`GATE_REVIEW.md`, Gate 10).

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
