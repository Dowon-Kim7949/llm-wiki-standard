---
title: Public Api
tags:
  - llm-wiki
  - verified
status: verified
doc_type: public_api
project: llm-wiki-standard
last_updated: 2026-07-15
author: cli-generated
last_edited_by: Claude Code
reviewed_by: WoongHwan-Kim
reviewed_at: 2026-07-15
wiki_block_version: v1
source_files:
  - src/cli.js
  - src/commands.js
  - src/release-notes.js
  - src/config-file.js
  - src/index.js
  - src/report.js
  - src/mcp/tools.js
  - src/mcp/dispatch.js
  - package.json
evidence:
  - src/cli.js#symbol:COMMANDS
  - src/cli.js#symbol:parseArgs
  - src/cli.js#symbol:main
  - src/commands.js#symbol:migrateCommand
  - src/commands.js#symbol:fixCommand
  - src/config-file.js#symbol:mergeConfigIntoOptions
  - src/index.js#symbol:commands
  - src/index.js#symbol:normalizeOptions
  - src/index.js#symbol:resolveOptions
  - src/cli.js#symbol:applyProjectConfig
  - src/commands.js#symbol:scaffoldProjectConfig
  - src/commands.js#symbol:applyRuleConfig
  - src/commands.js#symbol:scanThinBody
  - src/report.js#symbol:dashboardDocHref
  - src/mcp/tools.js#symbol:TOOL_DEFS
  - src/mcp/dispatch.js#symbol:handleMessage
related:
  - docs/llm-wiki/index.md
  - docs/llm-wiki/domains/00_overview.md
  - docs/llm-wiki/EXAMPLES.md
visibility: internal
contains_sensitive_info: false
---

# Public Api

이 패키지의 공개 계약은 `llm-wiki` CLI 명령어 표면입니다(`package.json`의 `bin.llm-wiki` → `bin/llm-wiki.js`). 명령 매핑은 `src/cli.js`의 `COMMANDS`에 정의됩니다.

## Commands

| 명령 | 목적 | 쓰기 |
| --- | --- | --- |
| `doctor` | 런타임/패키지 준비 상태, 초기화 여부, 안전 정책 신호 점검 | 없음 |
| `status` | 초기화 여부·문서 상태 카운트·구조/링크/adapter 상태 | 없음 |
| `next` | audit 결과 기반 다음 조치 추천(advisory) | 없음 |
| `explain <finding>` | finding 규칙 의미와 안전한 조치법 설명 | 없음 |
| `validate` | audit 커버리지 재사용 구조/안전 검증(CI용) | 없음 |
| `validate-frontmatter` | 필수 frontmatter 필드/값만 검증 | 없음 |
| `audit` | detection/structure/frontmatter/related/evidence/link/adapter/enrichment findings | 없음 |
| `quickstart --dry-run\|--write` | doctor+init+frontmatter+handoff 프롬프트 | `--write` 시 |
| `handoff` | Codex/Claude Code 인수인계 프롬프트 출력 | `--out` 시 |
| `prompt --task <name>` | 반복 작업 프롬프트(feature/fix/refactor/docs-sync/okf-extract) | `--out` 시 |
| `init --dry-run\|--write` | 누락 wiki 문서·선택 adapter 생성. backend/fullstack은 도메인별 문서(`domains/NN_<name>.md`)도 생성 | `--write` 시 |
| `migrate [--apply]` | `wiki_block_version` 업그레이드 리포트 + 계획. `--apply`로 `fix` 범위 재사용해 문서를 현재 계약으로 올림(preview-first, `verified` 보존; GATE_REVIEW Gate 8) | `--apply` 시 |
| `fix [--write]` | 승인된 범위의 안전한 자동수정(누락 Tier A frontmatter 필드, `## Evidence` 섹션 보완, 깨진 related/링크 `needs_review` 스텁, 수정 문서 `last_updated` 갱신). 기본은 미리보기 | `--write` 시 |
| `drift [--downgrade]` | `verified` 문서의 `evidence.stale` 드리프트 리포트. `--downgrade`로 드리프트 문서를 `needs_review`로 강등(GATE_REVIEW Gate 9) | `--downgrade` 시 |
| `graph` | 지식 그래프(문서 + 해소된 문서→문서 링크)를 출력. `--format text\|json\|mermaid\|dot`(graph 전용 토큰) | 없음 |
| `stats` | wiki 헬스 스냅샷(verified%/enrichment%/evidence coverage/staleness/orphan) + 헬스 스코어 | 없음 |
| `release-notes [--body-only]` | 마지막 `v*` 태그 이후 conventional commit으로 릴리스 노트 문서 생성. `--body-only`는 변경 섹션 본문만 출력(frontmatter/H1/스캐폴드 라인 제외, GitHub Release 본문용)하고 본문 민감정보 스캔에 매치 시 차단(exit 2, 본문 withhold) | `--out` 시 |

## Key Options

- `--cwd <path>`, `--type <frontend|backend|fullstack|library|mixed|unknown>`, `--profile <p>...`, `--agent <codex|claude|cursor|copilot|windsurf|gemini|jetbrains|antigravity|all>...` (`all`은 codex/claude/antigravity 세 개만 확장; 나머지는 명시 선택. writable: codex/claude/cursor/copilot/windsurf/gemini, candidate: jetbrains/antigravity)
- `--format <text|json|markdown|html>`(대부분 명령), `graph`는 `--format <text|json|mermaid|dot>`(mermaid/dot는 graph 전용). `--out <path>`, `--strict`, `--minimal`
- `--write`, `--dry-run`, `--apply` (migrate), `--downgrade` (drift), `--existing <skip|overwrite>`, `--version <x.y.z>`, `--since <git-ref>` (release-notes/validate), `--body-only` (release-notes), `--changed` (validate)

## Exit Codes

- `0` pass(그리고 `--strict`가 아니면 warning), `1` error(또는 `--strict`에서 warning), `2` blocked, `3` 사용법 오류. 근거: `src/cli.js`의 `exitCodeFor()`.

## Configuration

- 프로젝트 루트의 `llm-wiki.config.json`으로 `type`/`profiles`/`agents`/`strict`의 영속 기본값을 선언할 수 있다.
- 1.8부터 `rules` 맵으로 개별 finding rule을 끄거나 severity를 재정의한다: `{ "rule.id": "off"|"blocked"|"error"|"warning"|"info" }`. `audit`/`status`/`validate-frontmatter`에 중앙 적용되고(그래서 `validate`·`next`도 상속) CLI·API·MCP 모두에 반영된다. 레지스트리 rule만 토글되며 **`sensitive.*`(민감정보)는 절대 토글 불가**(안전 불변식). opt-in lint `content.thin_body`(기본 off)는 `rules`에 설정해 켠다.
- 적용 우선순위: CLI 플래그 > config > 자동감지. 잘못된 config는 exit code `3`으로 거부된다.
- 배포물에는 포함되지 않는 저장소-로컬 설정이다(`package.json` `files` 미포함).

## Programmatic API

CLI 표면과 별개로, 패키지를 in-process로 import해 쓸 수 있는 프로그래매틱 API를 `package.json` `exports`(`.` → `src/index.js`)로 공개한다. CI 래퍼·에디터·테스트가 `llm-wiki` 바이너리를 spawn하지 않고 명령을 실행할 때 쓴다.

```js
import { commands, normalizeOptions, resolveOptions, parseArgs, run, SCHEMA_VERSION } from "@dowonk-7949/llm-wiki-standard";

// 1) 부분 옵션으로 직접 호출
const result = await commands.audit(normalizeOptions({ cwd: process.cwd() }));
// result.command === "audit", result.result: "pass" | ..., result.findings: Finding[]
// result.schemaVersion === SCHEMA_VERSION

// 2) argv를 파싱해 실행 (parseArgs 결과를 그대로 넘겨도 됨)
const parsed = parseArgs(["audit", "--cwd", process.cwd(), "--strict"]);
const audited = await commands.audit(normalizeOptions(parsed));  // parseArgs 결과 직접 수용

// 2b) config 인식: 프로젝트의 llm-wiki.config.json을 CLI처럼 병합 (1.7.2)
const { options, errors } = await resolveOptions({ cwd: process.cwd() });
if (errors.length === 0) await commands.audit(options);          // 세 표면(CLI/API/MCP) 동일 effective options

// 3) CLI 전체를 in-process로 실행하고 exit code로 성패 분기
const code = await run(["audit", "--cwd", process.cwd()]);       // 0 pass / 1 error / 2 blocked / 3 usage
```

- **`commands`** — CLI 명령 이름 → 핸들러 함수의 **동결(frozen) 맵**. 키 집합은 `src/cli.js`의 `COMMANDS`와 1:1이며 안정 계약이다. 각 핸들러는 정규화된 옵션 객체를 받아 결과 객체로 resolve한다.
- **개별 함수 export** — `audit`, `doctor`, `validateCommand`, `fixCommand`, `graphCommand` 등 소스 이름으로도 직접 import할 수 있으며 `commands` 맵의 값과 동일 참조다.
- **`normalizeOptions(overrides?)`** — 부분 옵션을 받아 모든 기본값을 채우고 `cwd`를 절대경로로 해석한 완전한 옵션 객체를 돌려준다(배열은 매 호출마다 새로 만든다). 편의상 `parseArgs` 결과(`{ command, options, errors }`)를 그대로 넘겨도 되며, 이 경우 중첩된 `.options`를 override로 쓴다 → `normalizeOptions(parseArgs(argv))`와 `normalizeOptions(parseArgs(argv).options)`가 동일 결과를 낸다(전체 객체가 조용히 기본값으로 폴백되지 않는다). **동기(sync)** 이며 config는 로드하지 않는다(계약 불변).
- **`resolveOptions(overrides?)`** — `normalizeOptions`의 **config 인식(async) 동반자**(1.7.2). 완전 옵션을 만든 뒤 프로젝트의 `llm-wiki.config.json`(`cwd` 기준)을 로드·병합해 CLI가 계산하는 것과 동일한 effective options를 `{ options, errors }`로 돌려준다. 명시/override 값이 이기고 config는 미설정 항목만 채우며 `strict`는 additive로만 켤 수 있다. `errors`는 CLI가 exit 3으로 처리하는 조건(잘못된 JSON·필드·config-supplied agent)과 동일하며, 호출자가 표면화 방식을 정한다. 이로써 CLI·프로그래매틱 API·MCP 세 표면이 하나의 config에서 동일 옵션을 해석한다(공유 `src/cli.js#applyProjectConfig`). 동기 `normalizeOptions`·동결 `commands` 맵은 불변이고 `resolveOptions`는 부가 export다.
- **`parseArgs(argv)`** — argv 배열을 `{ command, options, errors }`로 파싱한다(CLI와 동일). **`run(argv)`** — argv를 받아 출력까지 처리하고 **숫자 exit code를 반환**한다(0 pass / 1 error·strict-warning / 2 blocked / 3 usage). `process.exitCode`도 같은 값으로 설정하므로 `bin/llm-wiki.js`는 그대로 동작한다.
- **`SCHEMA_VERSION`** — JSON 출력의 `schemaVersion` 필드 및 결과 객체의 `schemaVersion`과 같은 정수. shell-out이든 import든 동일 계약을 pin할 수 있다.

### Result Shape

모든 명령 결과는 최소 다음 공통 필드를 가진다(명령별 payload가 추가된다):

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `schemaVersion` | `number` | 출력 계약 버전(= `SCHEMA_VERSION`). 결과 객체에 **항상** 담기며, `--format json` 출력 최상단에도 그대로 나타난다. |
| `command` | `string` | 명령 이름(판별자). |
| `result` | `string?` | 종합 등급(`pass`/`warning`/`fail`/`blocked` 등). `doctor`/`graph` 등 일부는 없음. |
| `findings` | `Finding[]` | 발견 항목(비어 있을 수 있음). |
| `text` | `string?` | **항상 사람용 텍스트 리포트**. `format`은 CLI/`run()` stdout과 `--out` 파일 렌더링에만 영향을 주고, 반환 객체의 `.text` 내용은 바꾸지 않는다. `--format json` **파일** 출력에서만 제거된다. |

`Finding`은 `{ severity: "blocked"|"error"|"warning"|"info", rule: string, path: string, message: string }`. 명령별 payload(예: `detection`, `wikiGraph`, `findingSummary`, `documentStatus`, `stats`, `graph`, `upgradeReport`, `applied`/`planned`/`skipped`)는 `src/index.js`의 JSDoc typedef와 각 핸들러를 근거로 한다.

프로그래매틱 소비자가 JSON을 원하면 결과 객체 자체가 데이터이므로 `JSON.stringify(result)`를 쓰거나 `run([..., "--format", "json"])`의 stdout을 파싱한다. `.text`를 JSON으로 기대하지 말 것.

### `schemaVersion`

단일 소스는 `src/config.js`의 `JSON_SCHEMA_VERSION`이다. **부가(additive)** 필드이므로 기존 필드(`command` 등)는 그대로이고 기존 소비자를 깨지 않는다. 두 곳에서 동일하게 나타난다: (1) 모든 명령의 **반환 객체**(1.5.1부터 — 결과 객체가 스스로 계약을 밝힌다), (2) `--format json` 출력과 `--out *.json` 파일 최상단. mermaid/dot 등 비-JSON 출력에는 붙지 않는다. JSON 형태에 **파괴적** 변경(필드 제거/개명/타입 변경)이 있을 때만 이 정수를 올린다.

### HTML 대시보드 링크

`audit`/`validate`/`status`의 `--format html` 대시보드에는 Document Index가 있고, 각 문서 링크(`<a href>`)는 **`--out` 파일의 위치 기준 상대경로**로 계산된다(1.5.1부터). 예를 들어 `--out docs/reports/dash.html`로 쓰면 링크가 그 파일에서 위키 문서로 가는 상대경로가 되어, 하위 폴더에서 열어도 링크가 깨지지 않는다. `--out` 없이 stdout으로 출력할 때는 repo-root 기준 상대경로를 그대로 쓴다.

## MCP Server (Agent-native) — 1.6

`llm-wiki mcp`는 **stdio 위에서 Model Context Protocol(MCP) 서버**를 실행한다. 에이전트(Claude Code·Cursor 등 MCP 클라이언트)가 CLI를 spawn하지 않고 위키를 **툴로 질의·점검**하게 한다. 서드파티 SDK 없이 Node 내장만으로 **개행 구분 JSON-RPC 2.0**을 직접 구현한다(무의존성 불변식 유지). 프로그래매틱으로는 `startMcpServer(options)`로 실행하고, 순수 핸들러 `handleMcpMessage(msg, ctx)`·툴 정의 `MCP_TOOLS`·`MCP_PROTOCOL_VERSION`도 export된다.

MCP 클라이언트 등록 예시:

```json
{ "mcpServers": {
  "llm-wiki": { "command": "npx", "args": ["-y", "@dowonk-7949/llm-wiki-standard", "mcp"] }
}}
```

### 노출 툴 (모두 읽기 전용)

`validate` · `audit` · `next` · `status` · `doctor` · `stats` · `graph` · `explain` · `handoff` · `prompt`. **쓰기/변경 명령(init/fix/migrate/drift/quickstart)은 MCP로 노출하지 않는다** — 에이전트는 위키를 조회·점검할 뿐 바꾸지 않는다(`annotations.readOnlyHint: true`). 각 툴 인자는 `inputSchema`(JSON Schema)로 검증되며 `cwd`(기본=서버 실행 위치)·`type`·`profiles`·`strict` 등을 받는다.

### 툴 결과 형태

`tools/call` 결과는 `structuredContent`(명령 결과 객체 = `schemaVersion` 포함, `.text` 제거)와 `content[{type:"text"}]`(사람용 텍스트 리포트; graph는 요청 format의 렌더링, mermaid/dot 포함)로 반환한다. 명령이 예외를 던지면 프로토콜 에러가 아니라 `isError: true` 결과로 감싼다(MCP 관례).

### 프로토콜 처리

- 지원 메서드: `initialize`(protocolVersion 협상 — 지원 버전만 echo, 아니면 pinned로 폴백), `notifications/initialized`, `ping`, `tools/list`, `tools/call`.
- JSON-RPC 2.0 준수: 알림(id 없음)에는 무응답, 미지원 메서드 `-32601`, 잘못된 툴/파라미터 `-32602`, 파싱 오류 `-32700`, 배열(배치)은 `-32600`(2025-06-18은 배칭 제거).
- stdout은 프로토콜 전용(로그는 stderr). stdin EOF 시 정상 종료.

## Stability

- 명령 이름·JSON 출력 형태는 CI/래퍼가 의존하므로 보수적으로 유지한다.
- 프로그래매틱 API(`commands` 맵 키, 개별 함수 export, `SCHEMA_VERSION`, 공통 결과 필드)는 안정 계약이다. 명령별 payload 필드는 CLI `--format json`과 동일한 부가적(additive) SemVer 정책을 따른다.
- `migrate --apply`는 GATE_REVIEW Gate 8 범위로 활성화돼 있다(preview-first, `fix` 범위 + `wiki_block_version` 업그레이드, `verified` 내용·status 불변). `graph`/`stats`는 읽기전용이다.
- `fix`는 `GATE_REVIEW.md`의 "Autofix (--fix) Scope Decision"에 명시된 좁은 범위만 수정한다: `verified` 문서 내용·`docs/llm-wiki/` 밖 파일·`source_files`/`evidence` 값·Tier B 필드(title/doc_type/project/author)·미보강 내용은 건드리지 않는다.
- `llm-wiki.config.json` 스키마는 Gate 13(1.8)으로 성장 중이다: `type`/`profiles`/`agents`/`strict`에 더해 1.8이 `rules`(rule 토글)를 추가한다. 1.7.2부터 `init`/`quickstart --write`가 최소 config를 scaffold하고(기존 파일 미덮어씀) `doctor`가 effective config를 echo한다. 커스텀 문서셋·템플릿 오버라이드는 `1.8.x`로 후속.
- MCP 서버(1.6)는 읽기 전용 툴만 노출하고 무의존성(Node 내장 JSON-RPC)으로 구현한다. MCP 툴 이름 집합과 결과 형태(1.5 result + `schemaVersion`)가 새 안정 계약이다(GATE_REVIEW Gate 11). 1.7.2부터 MCP 툴 호출도 대상 프로젝트의 `llm-wiki.config.json`을 `resolveOptions`로 병합해 CLI·API와 동일한 effective options를 쓴다(malformed config는 `isError`로 표면화).

## Evidence

- `src/cli.js#symbol:COMMANDS` — 명령 이름 → 핸들러 매핑.
- `src/cli.js#symbol:parseArgs` — 옵션/사용법 검증과 exit code 근거.
- `src/commands.js#symbol:migrateCommand` — `wiki_block_version` 업그레이드 리포트 + `--apply`(Gate 8 범위).
- `src/commands.js#symbol:fixCommand` — 범위 한정 자동수정(기본 미리보기, `--write` 적용).
- `src/config-file.js#symbol:mergeConfigIntoOptions` — config 기본값과 CLI 플래그의 병합 우선순위.
- `src/index.js#symbol:commands` — 프로그래매틱 API의 동결된 명령 맵과 개별 함수 export.
- `src/index.js#symbol:normalizeOptions` — 부분 옵션 또는 `parseArgs` 결과(`.options`)를 완전 옵션으로 정규화(`src/cli.js#symbol:defaultOptions` 공유). 동기·config 미로드.
- `src/index.js#symbol:resolveOptions` — config 인식 옵션 해석(normalizeOptions + `llm-wiki.config.json` 병합); CLI·API·MCP 세 표면 공유(1.7.2).
- `src/commands.js#symbol:applyRuleConfig` — config `rules` 토글을 findings에 중앙 적용(off 드롭·severity override; `sensitive.*` 비토글)(1.8).
- `src/commands.js#symbol:scanThinBody` — opt-in `content.thin_body` lint(기본 off, config로 활성화)(1.8).
- `src/cli.js#symbol:applyProjectConfig` — config 로드+병합+agent 재정규화의 공유 구현(세 표면이 동일 effective options를 얻는 seam).
- `src/commands.js#symbol:scaffoldProjectConfig` — init/quickstart의 starter config scaffold(additive·preview-first·기존 파일 미덮어씀).
- `src/cli.js#symbol:main` — `run(argv)`의 실체. 숫자 exit code를 반환하고 `process.exitCode`도 설정한다.
- `src/commands.js#symbol:withText` — 모든 명령 결과 객체에 `schemaVersion`을 부여한다.
- `src/config.js#symbol:JSON_SCHEMA_VERSION` — 결과 객체·`--format json`의 `schemaVersion` 단일 소스.
- `src/report.js#symbol:dashboardDocHref` — HTML 대시보드 Document Index 링크를 `--out` 위치 기준 상대경로로 계산.
- `src/mcp/tools.js#symbol:TOOL_DEFS` — MCP로 노출하는 읽기 전용 툴 정의(commands 위 얇은 래퍼).
- `src/mcp/dispatch.js#symbol:handleMessage` — MCP JSON-RPC 핸들러(initialize/tools.list/tools.call/ping; 프로토콜 준수).

## Review Notes

- 2026-07-14에 1.3.0 CLI 명령·옵션 계약(migrate --apply, drift, 신규 --agent, OKF type alias 포함)을 기준으로 재검토하고 사람 검토(reviewed_by: WoongHwan-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-14에 1.4.0의 새 명령(`graph`, `stats`)과 graph 전용 `--format mermaid|dot`을 반영하고, stale했던 "migrate --apply 차단" 서술을 정정한 뒤, 사람 검토(reviewed_by: WoongHwan-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-14에 1.5 프로그래매틱 API(`package.json` `exports` → `src/index.js`, 동결된 `commands` 맵·개별 함수 export·`normalizeOptions`·`parseArgs`/`run`·`SCHEMA_VERSION`)와 `--format json`의 부가적 `schemaVersion` 필드를 반영하고, 사람 검토(reviewed_by: WoongHwan-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-14에 1.5.1 API/출력 결함 수정을 반영했다(소비 프로젝트 스모크 테스트 발견): 결과 객체가 `schemaVersion`을 항상 담고 `.text`는 항상 텍스트임을 명시, `normalizeOptions`가 `parseArgs` 결과를 수용, `run(argv)`가 exit code 반환, HTML 대시보드 링크를 `--out` 기준 상대경로로. 모두 additive/refinement라 안정 계약을 깨지 않는다. 사람 검토(reviewed_by: WoongHwan-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-14에 1.6 에이전트 네이티브(MCP 서버 `llm-wiki mcp`) 계약을 추가했다: stdio JSON-RPC 2.0 직접 구현(무의존성), 읽기 전용 툴 10개(쓰기 미노출), 결과는 `structuredContent`(schemaVersion 포함)+텍스트. 적대적 다차원 리뷰(프로토콜/정확성/안전/통합/테스트)로 확정 결함(버전 협상·알림 무응답·배치 처리·graph 설명)을 수정했다. 사람 검토(reviewed_by: WoongHwan-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-15에 1.7 계약을 반영했다: `release-notes`에 `--body-only`(변경 섹션 본문만; frontmatter/H1/스캐폴드 제외, 본문 민감정보 스캔·매치 시 차단 exit 2)를 추가하고 Key Options에 등재했다. `src/release-notes.js`를 source_files에 추가했다. 사람 검토(reviewed_by: WoongHwan-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-15에 1.7.2(enabling-prep) 계약을 반영했다: `resolveOptions`(config 인식 async 옵션 해석)를 프로그래매틱 API에 추가하고, MCP 툴 호출이 `llm-wiki.config.json`을 병합하도록 갱신하면서 1.6의 "MCP는 config 미병합" 서술을 정정했다. `init`/`quickstart`의 starter config scaffold와 `doctor`의 effective-config echo도 명시했다. 모두 additive(동기 `normalizeOptions`·동결 `commands` 맵 불변). 사람 검토(reviewed_by: WoongHwan-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-15에 1.8.0 config schema growth(Gate 13)를 반영했다: `llm-wiki.config.json`의 `rules` 맵으로 finding rule을 끄거나 severity를 재정의하는 per-project 토글(중앙 `applyRuleConfig`, `sensitive.*`는 안전상 비토글)과 opt-in lint `content.thin_body`(기본 off)를 추가하고, `doctor`가 토글 수를 echo함을 명시했다. Configuration/Stability에 `rules`를 등재했다. additive·opt-in. 사람 검토(reviewed_by: WoongHwan-Kim)를 거쳐 `verified`로 재승인했다.
