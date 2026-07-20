> Language: [English](./CHANGELOG.md) | [한국어](./CHANGELOG.ko.md)

# 변경 이력 (Changelog)

`@dowonk-7949/llm-wiki-standard`의 주요 변경 사항을 기록합니다. 이 프로젝트는
[유의적 버전(Semantic Versioning)](https://semver.org/)을 따르며, 항목은 최신순입니다.

## 1.15.1 — 2026-07-21

스킬 생성 온보딩 수정 — dogfood: 이 변경은 도구 자신의 `/llm-wiki-feature` 스킬을 자기 자신에게
실행해서 만들었다. 명령·옵션·`--format json`·frontmatter 계약 불변, 런타임 의존성 추가 없음.

### Changed

- **`init`/`quickstart --write`가 스킬을 생성하면 재시작 안내를 출력한다.** Claude Code는 스킬을
  세션 시작 시점에 로드(hot-reload 아님)하므로, 갓 생성한 스킬의 `/llm-wiki-*` 명령은 에이전트를
  재시작하기 전까지 "unknown"으로 보인다. 이 이중언어 한 줄 안내는 스킬을 실제로 만들었을 때만
  표시되어, 사용자가 새 명령이 왜 안 보이는지 헤매지 않게 한다.

## 1.15.0 — 2026-07-20

스킬 생성(Gate 21) — feature/fix/docs-sync 작업용 위키-그라운디드 자동화 프롬프트. 생성한 위키가
실제로 쓰이도록 한다. 부가적·opt-in이며 기존 명령·`--format json`·frontmatter 계약 불변, 런타임
의존성 추가 없음.

### Added

- **`init`/`quickstart`이 위키-그라운디드 자동화 프롬프트를 생성**한다 — `feature`/`fix`/`docs-sync`
  워크플로를 각 에이전트의 네이티브 형식으로:
  - Claude Code 스킬 — `.claude/skills/llm-wiki-<task>/SKILL.md` (`/llm-wiki-feature`로 호출),
  - Cursor 룰 — `.cursor/rules/llm-wiki-<task>.mdc`,
  - 에이전트-중립 프롬프트 — `.llm-wiki/prompts/llm-wiki-<task>.md` (Codex 등 임의 에이전트용).
  각 본문은 기존 위키-그라운디드 워크플로(위키 읽기 → 근거로 변경 → 문서 `needs_review` 갱신 →
  `log.md` append → 자동 `verified` 금지)를 재사용하고, 프로젝트 **도메인 맵**(`docs/llm-wiki/domains/`)
  스냅샷을 본문에 주입해 에이전트가 어떤 문서를 읽을지 즉시 알게 한다.
- **`--skills` 플래그**(init/quickstart)가 아티팩트 생성을 요청한다. `claude`/`cursor` 에이전트 선택
  시에도 생성된다. opt-in·preview-first(`--dry-run`이 생성 예정을 나열), 기존 skill/rule/prompt 파일은
  절대 덮어쓰지 않음. 도구는 아티팩트를 **생성만** 하고 실행은 에이전트가 함(recognize-don't-run).
  스킬을 요청하지 않은 레포는 byte-identical.

## 1.14.4 — 2026-07-20

테스터 산출물을 유지관리자가 검토하다 발견한 도메인 감지 수정. 명령·옵션·`--format json`·
frontmatter 계약 불변, 런타임 의존성 추가 없음.

### Fixed

- **도메인 감지가 가상환경/설치된 의존성을 스캔하지 않는다.** 버전형 가상환경(예: `venv3.10/`)이 있는
  Python 프로젝트에서 스캔이 `venv3.10/Lib/site-packages/`로 파고들어 서드파티 라이브러리(passlib의
  `handlers/`, boto3의 `resources/` 등)에 대해 빈 도메인 문서를 수십 개 만들던 문제 — venv 이름이 스킵
  목록에 없고 `site-packages`도 제외되지 않아서였다. 이제: `pyvenv.cfg`를 가진 디렉터리는 가상환경으로
  간주해 통째로 스킵(이름 무관 — `venv3.10`·`.venv-py39` 등 모두 포착), `site-packages`/`dist-packages`를
  순회에서 제외, 버전형 `venv*`/`env<N>` 이름도 스킵. 가상환경이 없는 레포는 영향 없음(byte-identical),
  프로젝트 자기 `handlers`/`routers`/… 도메인은 그대로 감지된다.

## 1.14.3 — 2026-07-20

두 번째 노출 보고서 기반 온보딩 오리엔테이션. 처음 쓰는 사용자가 bare 명령만으로는 도구가 뭘 하는지
알 수 없었고, 한국 테스터가 한글 출력을 원했다. 명령·옵션·`--format json`·frontmatter 계약 불변,
런타임 의존성 추가 없음.

### Added

- **`llm-wiki` / `--help`에 이중언어(KO+EN) 오리엔테이션 헤더.** bare 명령이 이제 Usage부터 나열하는
  대신, LLM-WIKI가 무엇인지·왜 도움 되는지(에이전트가 매번 코드를 다시 읽는 대신 검증된 위키를 근거로
  삼음)·3단계 흐름(뼈대 생성 → 프롬프트를 에이전트에 붙여넣기 → 사람 검토·verified)을 먼저 보여준다.
- **`--help`에 패키지 버전과 `@latest` 팁.** `llm-wiki vX.Y.Z`를 표시하고 `npx …@latest`를 권장 —
  npx가 옛 버전을 조용히 재사용(캐시)하는 상황을 눈치챌 수 있게.
- **`quickstart` 출력에 이중언어 `About · 소개` 라인** — `--help`를 안 보고 `quickstart`를 바로
  실행한 사용자도 방향을 잡게.

## 1.14.2 — 2026-07-20

첫 외부 end-to-end 성공(백엔드 개발자가 handoff 프롬프트를 실행해 위키 전체를 추출) 이후의 사용성
다듬기. 검토자가 보는 헛경고를 줄이고 사일런트 실패 하나를 표면화한다. 명령·옵션·`--format json`·
frontmatter 계약 불변, 런타임 의존성 추가 없음.

### Fixed

- **콜론-라인 evidence 표기(`file:10`)를 수용한다** — `file#L10`과 함께(그리고 `file:10-20`을
  `file#L10-L20`과 함께). 보강 에이전트가 에디터/grep 스타일로 evidence를 써도 더 이상 헛
  `evidence.missing`이 뜨지 않고, 참조가 소스+라인 범위로 정상 해석된다.
- **생성된 `templates/*.template.md`를 orphan으로 보고하지 않는다.** 의도적으로 링크되지 않는
  스캐폴드이므로, 갓 만든 위키가 `graph`/`stats`에서 false-positive orphan을 표시하던 문제를 없앤다.
  실제로 링크 안 된 문서는 여전히 표시한다.

### Added

- **위키 출력 경로가 gitignore될 때 경고.** `docs/llm-wiki`가 git에서 무시되면
  `init --write`/`quickstart`가 `structure.output_gitignored` 경고(차단 아님)를 내고 `doctor`도
  보고한다 — 생성 문서가 만들어졌지만 git에 추적되지 않던 사일런트 케이스를 잡는다.
- **`init --write` 안심 요약.** `N created, N overwritten, N kept (existing files preserved)`
  한 줄로 무엇을 건드렸고 안 건드렸는지 명확히 보여준다.

## 1.14.1 — 2026-07-20

1.14 이후 노출 테스트에서 나온 버그 수정 배치. 온램프·브라운필드 적합성 수정이며, 새 명령·옵션·
`--format json` 필드·frontmatter 변경 없음, 런타임 의존성 추가 없음.

### Fixed

- **비-UTF-8 매니페스트가 더 이상 프로젝트 유형을 오분류하지 않는다.** UTF-16 또는 UTF-8-BOM으로
  저장된 매니페스트(Windows에서 흔함, 예: PowerShell로 리다이렉트한 `requirements.txt`)가 UTF-8로
  읽히며 mojibake가 되어 프레임워크 키워드를 놓쳤고, FastAPI 백엔드가 `library`로 오분류됐다. 이제
  detector의 모든 매니페스트/소스 읽기를 BOM 인식 리더가 담당한다(UTF-16LE·UTF-16BE·UTF-8 BOM).
  BOM이 없는 파일은 이전과 동일하게 디코드되며, 위키 문서 인코딩 스캔은 그대로다.
- **handoff 프롬프트가 생성되지 않은 어댑터 파일을 가리키지 않는다.** `--agent`를 명시하지 않으면
  `quickstart`/`init`은 어댑터 파일을 만들지 않는데도, 프롬프트는 받는 에이전트에게 존재하지 않는
  `AGENTS.md`/`CLAUDE.md`를 먼저 읽으라고 시작했다. 이제 명시적으로 선택된 에이전트의 어댑터 파일만
  진입점에 넣고, 그 외에는 `docs/llm-wiki/index.md`를 가리킨다.

### Changed

- **모드 플래그 없는 `init`/`quickstart`이 오류가 아니라 안내로 읽힌다.** `--dry-run`도 `--write`도
  없이 실행하면 이전에는 `Blocked` 리포트(exit 2)를 출력해 실패처럼 보였다. 이제 `Ready (needs
  --write)`와 `Next Step`을 렌더하고 exit 0으로 끝난다(`next` 명령의 `ready` 결과와 동일). `--dry-run`과
  `--write`를 동시에 주는 것은 여전히 거부된다.
- **handoff `Next Step`이 워크플로를 설명한다.** `Handoff Prompt`는 CLI가 실행하는 게 아니라 저장소에서
  연 코딩 에이전트(Claude Code/Codex)에 붙여넣는 지시문이며, 에이전트가 코드를 읽어 문서(도메인별
  `domains/*.md` 포함)를 채우고 사람이 검토해 `verified`로 올린다는 3단계를 명시한다.
- **`quickstart` 출력이 브라운필드를 인식한다.** skip 개수에 사유를 주석으로 단다(예:
  `skipped: 18 (18 already exist, kept)`). 위키가 이미 있어 새로 만들 문서가 없으면 "도구가 아무것도 안
  한 것"처럼 보이지 않도록, 기존 문서를 handoff 프롬프트로 보강하라(또는 `--existing overwrite`로
  재생성)는 안내를 덧붙인다.

## 1.14.0 — 2026-07-16

stdlib-server 감지(Gate 19) — "detect & adapt 확장" 라인의 마지막 마이너. 부가적·opt-in이며
CLI·`--format json`·프로그래매틱 API·frontmatter 계약 불변, 런타임 의존성 추가 없음.

### Changed

- role 추론이 Go `net/http` 서버와 Python stdlib HTTP 서버(`http.server`/`socketserver`)를
  `library`가 아닌 `backend`로 분류한다 — bounded·exclusion-guarded 소스 스캔으로: `net/http`를
  import하고 `ListenAndServe`/`http.Serve`를 호출하는 Go 파일, 또는 `http.server`/`socketserver`를
  import하고 서버를 시작(`serve_forever` / `HTTPServer(...)`)하는 Python 파일.

### Notes

- 단방향·보수적: 신호는 `library`→`backend` 승격만 하며, 강한 import + 서버-시작 쌍에만 반응하고,
  기존 `backend`를 강등하지 않는다. `http.client`만 쓰는 라이브러리는 `library`로 남는다. 인식만
  함 — 읽기 전용 소스 스캔(maxDepth 4·파일 캡·vendored/test/example 제외), 프레임워크 의존성 불요,
  zero-dep 유지. 범위: `GATE_REVIEW.md`(Gate 19). 이로써 `1.12`–`1.14` detect & adapt 확장 라인이
  완성된다.

## 1.13.0 — 2026-07-16

infra/DevOps 프로젝트 프로필(Gate 18) — "detect & adapt 확장" 라인의 두 번째 마이너.
부가적·opt-in이며 CLI·`--format json`·프로그래매틱 API·frontmatter 계약 불변, 런타임
의존성 추가 없음.

### Added

- 새 `infra` 프로젝트 유형. `detectInfra`가 Docker(`Dockerfile`)·Docker Compose
  (`docker-compose.y*ml`/`compose.y*ml`)·Kubernetes(top-level 또는 관례 디렉터리의
  `apiVersion:`+`kind:` YAML)·Helm(`Chart.yaml`)·Terraform(`*.tf`)을 감지한다.
- `init`이 생성하는 infra 문서셋(`profiles/infra.md`, `DEPLOYMENT.md`, `RUNBOOK.md`,
  `SERVICE_TOPOLOGY.md`).

### Notes

- `infra`는 **fallback** 유형 — 앱 신호(frontend/backend/library/mobile)가 없을 때만
  선택되므로, `Dockerfile`을 가진 백엔드 레포는 앱 유형을 유지하고 기존 출력은
  byte-identical. IaC 중심 레포(이전 `unknown`)만 `infra`가 된다.
- 인식만 함: 클러스터/레지스트리 접근·배포·의존성 그래프 파싱 없음(zero-dep 유지),
  bounded·exclusion-guarded 스캔. 범위: `GATE_REVIEW.md`(Gate 18).

## 1.12.0 — 2026-07-16

모바일 프로젝트 프로필(Gate 17) — `1.11` 이후 "detect & adapt 확장" 라인의 첫 마이너.
부가적·opt-in이며 CLI·`--format json`·프로그래매틱 API·frontmatter 계약 불변, 런타임
의존성 추가 없음.

### Added

- 새 `mobile` 프로젝트 유형. `detectMobile`이 Android(`build.gradle`(.kts)/
  `settings.gradle`의 Android Gradle 플러그인·AndroidX, 또는 중첩 `AndroidManifest.xml`),
  Flutter(`pubspec.yaml`의 `flutter:` 섹션 / `sdk: flutter`), Apple/iOS(`Podfile`,
  Apple-플랫폼 `Package.swift`, 또는 `*.xcodeproj`/`*.xcworkspace`), React Native
  (`react-native` 의존성)를 감지한다.
- `init`이 생성하는 모바일 문서셋(`profiles/mobile.md`, `PLATFORM_MATRIX.md`,
  `SCREENS.md`, `BUILD_RELEASE.md`).

### Fixed

- Android `build.gradle` 프로젝트가 JVM `library`로 오분류되던 문제 — `decideType`에서
  모바일 신호가 최우선이 되어 `mobile`로 감지된다.

### Notes

- 인식만 함: 빌드 도구(Gradle/Xcode/CocoaPods) 미호출·의존성 그래프 미파싱(zero-dep
  유지). 매니페스트 신호 + bounded·exclusion-guarded 스캔. 모바일 신호가 없는 레포는
  byte-identical(plain JVM/Dart 미재분류). 범위: `GATE_REVIEW.md`(Gate 17).

## 1.11.1 — 2026-07-16

동작 보존 내부 리팩터: 모놀리식 `src/commands.js`를 `src/commands/` 하위의 목적별 모듈로
분리했다. 사용자 표면 변화 없음 — CLI, `--format json` 출력, 프로그래매틱 API(동결된
`commands` 맵과 개별 export), frontmatter 계약이 byte-identical하며 런타임 의존성도 추가되지
않았다.

### Changed

- `src/commands.js`(~4,119 → ~1,612줄)에서 재사용 로직을
  `src/commands/{references,findings,scans,wiki-graph,adapters,wiki-files,fix-migrate,domains,doc-templates}.js`로
  추출하고, 배럴 re-export로 모든 `from "./commands.js"` import와 공개 API 표면을 동일하게
  유지했다. 의존성은 단방향(leaf 파서 → wiki-graph/adapters → scans → fix-migrate →
  `commands.js`)이며, `migrateCommand`는 `audit` 파이프라인을 호출하므로 모듈 그래프를
  비순환으로 유지하기 위해 `commands.js`에 남겼다(`graphCommand`/`statsCommand`과 동일 패턴).

## 1.11.0 — 2026-07-15

cross-repository knowledge links(Gate 16). 예약된 non-fetching cross-repo 참조 스킴을
인식해 cross-repo 참조가 missing-target 규칙을 건드리지 않게 한다 — 계획된 `1.x` 마지막
마이너. Additive이며 CLI·JSON·프로그래매틱 API·frontmatter 계약 불변, 런타임 의존성 추가 없음.

### 추가 (Added)

- 예약 cross-repo 참조 스킴 `repo:<name>/<path>`(기존 `http(s)://` URL과 함께)를 wiki
  링크와 `source_files`/`evidence`/`related`에서 external로 인식한다. 인식된 참조는 external로
  처리돼 `wiki_link.missing`/`related.missing`/`source_files.missing`/`evidence.missing`/
  `markdown_link.missing`에서 제외되지만 **절대 fetch/verify하지 않는다**(network/git 필요). URL
  형태의 wiki 링크가 false `wiki_link.missing`을 내지 않게 분류기도 강화한다. 근거:
  `src/commands.js`(`isCrossRepoReference`, `isExternalSourceReference`).

### 참고 (Notes)

- 인식만 함 — network/git/의존성 없음(zero-runtime-dependency 불변). Additive: 로컬(레포 내)
  해석은 불변이며 진짜 미해결 로컬 링크는 여전히 flag된다. 범위: `GATE_REVIEW.md`(Gate 16,
  accepted). 실제 fetch/resolve는 out of scope(future major). 이로써 분할된 `1.7`–`1.11`
  로드맵 라인이 완성된다.

## 1.10.0 — 2026-07-15

monorepo profile(Gate 15). opt-in `monorepo` 명령이 각 워크스페이스 패키지의 위키를
validate하고 결과를 집계한다. Additive이며 단일 레포의 CLI·JSON·프로그래매틱 API·frontmatter
계약은 불변, 런타임 의존성 추가 없음.

### 추가 (Added)

- `llm-wiki monorepo` — npm/yarn `workspaces`(배열 또는 `{ packages }`)를 감지해
  `docs/llm-wiki/`가 있는 각 패키지에 기존 cwd-파라미터라이즈드 validate를 실행하고 집계한다.
  결과는 strictly additive `packages[]` roll-up(경로·패키지별 result·finding 수)과 패키지 경로
  prefix된 `findings`(exit code 결정)를 담는다. 각 패키지는 자기 `llm-wiki.config.json`을
  반영한다. pnpm/`pnpm-workspace.yaml`은 unsupported로 보고한다(YAML 미파싱 — zero-dep). 근거:
  `src/detector.js`(`detectWorkspaces`), `src/commands.js`(`monorepoCommand`). CLI와
  프로그래매틱 API `commands` 맵에 노출.

### 참고 (Notes)

- opt-in·additive: 새 `packages[]` 필드와 패키지별 findings는 `monorepo` 명령에만 나타나 단일 레포
  출력은 byte-identical. read-only 집계, `1.0.0` 계약·zero-runtime-dependency 정책 불변. 범위:
  `GATE_REVIEW.md`(Gate 15, accepted). deeper glob·pnpm/YAML은 후속, cross-repo 링크는 다음
  마이너(`1.11`).

## 1.9.0 — 2026-07-15

visibility governance(Gate 14). 이미 필수인 `visibility` 필드에 대한 opt-in 일관성 린트로,
1.8 config `rules` 토글 위에 세운다. Additive·opt-in이며 CLI·JSON·프로그래매틱 API·frontmatter
계약 불변, 런타임 의존성 추가 없음.

### 추가 (Added)

- sensitive-info 스캔을 재사용하는 opt-in·기본 off·warning·read-only 린트 2개:
  - `visibility.public_sensitive` — `visibility: public` 문서 내용이 스캔에 매치(공개 문서에
    민감해 보이는 값이 있으면 안 됨).
  - `visibility.declared_mismatch` — `contains_sensitive_info: false`인데 스캔에 매치(선언과
    내용 불일치).
  각 프로젝트가 `rules` 맵으로 켠다(예: `"visibility.public_sensitive": "warning"`). **민감값은
  finding에 절대 포함하지 않는다**(redacted count만). 근거: `src/commands.js`.
- 정책: `docs/llm-wiki/VISIBILITY.md`가 `internal`/`restricted`/`public` 레벨과 값-내용 일관성
  정책을 정의한다.

### 참고 (Notes)

- Additive·opt-in·read-only: 규칙은 절대 기본 `error`/`blocked`가 되지 않고(additive `1.0.0`
  불변식), `sensitive.*`는 여전히 비토글, 값-내용 일관성만 점검(접근 통제 아님). 범위:
  `GATE_REVIEW.md`(Gate 14, accepted). 다음 예정 마이너: `1.10` monorepo profile.

## 1.8.1 — 2026-07-15

config 스키마 확장 2부 — 커스텀 문서셋과 템플릿 오버라이드. 이로써 Gate 13의 config 피처
3개가 완성된다(rule 토글은 1.8.0). Additive·opt-in이며 CLI·JSON·프로그래매틱 API·frontmatter
계약 불변, 런타임 의존성 추가 없음.

### 추가 (Added)

- 커스텀 문서셋: `llm-wiki.config.json`의 `requiredDocs` 배열로 프로젝트 자체 필수 문서를
  core/profile 목록에 추가하면 같은 `structure.required_doc` 검사가 적용된다(검증 전용 —
  `init`은 임의 커스텀 문서를 scaffold하지 않는다). 근거: `src/config-file.js`, `src/commands.js`.
- 템플릿 오버라이드: `templates` 맵으로 생성 문서를 프로젝트-로컬 템플릿에서 만든다.
  오버라이드는 **body만** 사용하고 frontmatter는 항상 CLI 생성이 감싸므로 오버라이드가 절대
  `status: verified`를 만들 수 없다(구조적 하드 가드레일). 오버라이드 파일 부재 시 built-in
  폴백. 근거: `src/commands.js`.
- `doctor`가 config 라인에 `requiredDocs`·`templates` 개수를 echo한다.

### 참고 (Notes)

- Additive·opt-in: `1.0.0` 계약과 zero-runtime-dependency 정책 불변. 범위: `GATE_REVIEW.md`
  (Gate 13, accepted). 이로써 config 스키마 확장 라인이 완성되며, 다음 예정 마이너는 visibility
  governance(`1.9`)다.

## 1.8.0 — 2026-07-15

config 스키마 확장 — per-project rule 토글(Gate 13). config-schema-growth 라인의 첫 피처
슬라이스로, 1.7.2 enabling-prep 위에 세운다. Additive·opt-in이며 CLI·JSON·프로그래매틱
API·frontmatter 계약은 불변, 런타임 의존성 추가 없음.

### 추가 (Added)

- per-project **rule 토글**: `llm-wiki.config.json`의 `rules` 맵으로 개별 finding rule을
  끄거나 severity를 재정의한다 — `{ "rule.id": "off" | "blocked" | "error" | "warning" |
  "info" }`. `audit`/`status`/`validate-frontmatter`의 findings에 중앙에서 적용되며(그래서
  `validate`·`next`도 상속), 1.7.2의 통합 `resolveOptions`를 타고 CLI·프로그래매틱 API·MCP
  전반에 동일 적용된다. 레지스트리 rule만 토글 대상이고 **민감정보 카테고리는 절대 토글
  불가** — config로 비밀 탐지를 끌 수 없다. 근거: `src/config-file.js`, `src/commands.js`.
- `content.thin_body` — 기본 off인 opt-in enrichment lint. 본문 prose가 매우 얇은 wiki
  콘텐츠 문서를 표시한다. 프로젝트별로 `rules` 맵에 `"content.thin_body"`를 설정해 켠다.
  토글 기계를 dogfood한다. 근거: `src/commands.js`.
- `doctor`가 `llm_wiki_config` 라인에 활성 rule 토글 수를 echo한다.

### 참고 (Notes)

- Additive·opt-in: 명시/CLI 값이 이기고 zero-runtime-dependency 정책은 불변. 범위:
  `GATE_REVIEW.md`(Gate 13, accepted). severity 레지스트리 수렴 pre-work는 감사로 동작
  보존 확인(push 지점·레지스트리 불일치 0). Gate 13의 나머지(커스텀 문서셋·템플릿
  오버라이드)는 `1.8.x`로 후속.

## 1.7.2 — 2026-07-15

config 스키마 확장(Gate 13)을 위한 enabling-prep. Additive·하위호환 — CLI·JSON·프로그래매틱
API·frontmatter 계약 변경 없음, 런타임 의존성 추가 없음. 이제 config가 세 표면에서 일관되게
해석되고, init/quickstart/doctor가 이를 관측 가능하게 만든다.

### 추가 (Added)

- `resolveOptions(overrides)` — 프로그래매틱 API에 `normalizeOptions`의 config 인식 async
  동반자를 추가한다: 프로젝트의 `llm-wiki.config.json`(`cwd` 기준)을 CLI처럼 병합해
  `{ options, errors }`를 돌려준다. 동기 `normalizeOptions`와 동결 `commands` 맵은 불변.
  근거: `src/index.js`, `src/cli.js`.
- `init` / `quickstart --write`가 프로젝트 루트에 최소 `llm-wiki.config.json`을 scaffold한다
  (감지된 type·선택 agents로 시드). additive·preview-first이며 기존 config는 절대 덮어쓰지
  않는다. 근거: `src/commands.js`.
- `doctor`가 단순 present/absent 대신 effective config를 echo한다(`llm_wiki_config: present
  (type=..., agents=...)`, 잘못된 파일은 `present (invalid: N errors)`).

### 변경 (Changed)

- config 로딩을 command layer 아래로 이동: MCP 서버가 이제 `tools/call`마다 대상 프로젝트의
  `llm-wiki.config.json`을 병합한다(malformed는 `isError`로 표면화). 이로써 CLI·프로그래매틱
  API·MCP가 동일한 effective options를 해석한다. 근거: `src/cli.js`(`applyProjectConfig`),
  `src/mcp/dispatch.js`. 이전에는 CLI만 config를 병합했다(Gate 11 honest limit).

### 참고 (Notes)

- Additive·opt-in: 명시/CLI 값이 이기고 config는 미설정 항목만 채우며 `strict`를 additive로만
  켠다. `1.0.0` 계약과 zero-runtime-dependency 정책은 불변. 범위: `GATE_REVIEW.md`(Gate 13,
  proposed). 이는 `1.8`이 스키마(커스텀 문서셋·rule 토글·템플릿 오버라이드)를 확장하기 전에
  config 실사용을 축적하기 위한 enabling-prep다.

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
