> Language: [English](./README.md) | [한국어](./README.ko.md)

# LLM-WIKI Standard

`@dowonk-7949/llm-wiki-standard`는 AI 코딩 에이전트를 위한 표준화된·근거 기반 지식 기반(`docs/llm-wiki/`)을 만들고 검증하는 **무의존성 CLI**입니다. 에이전트가 매 작업마다 코드베이스 전체를 다시 읽는 대신, 하나의 인덱스에서 시작하게 합니다.

```text
기존 방식:        작업 -> 코드베이스 재탐색 -> 구조·규칙 재파악 -> 작업 수행
LLM-WIKI 방식:    작업 -> index.md 확인 -> 관련 wiki 문서 확인 -> 필요한 소스만 확인 -> 작업 수행
```

CLI는 안전한 구조와 가드레일을 만들고, 에이전트(Codex·Claude Code 등)가 실제 코드 근거로 문서를 보강하며, 사람이 검토해 `verified`를 승인하고, CI가 품질을 지켜줍니다. 레거시 유지보수, 신규 기능, 장애 대응, 온보딩, 인수인계, 여러 에이전트 간 지식 공유에 유용합니다.

## 지원 환경

| | |
| --- | --- |
| **런타임** | Node.js ≥ 18.18.0 · Windows, macOS, Linux |
| **의존성** | 없음 — 런타임 서드파티 의존성 0 |
| **감지 대상** | Node · Python · Go · Rust · JVM · PHP · Ruby · .NET · 모바일(Android / Flutter / iOS / React Native) · 인프라(Docker / Compose / Kubernetes / Helm / Terraform) |
| **에이전트/에디터** | Codex(`AGENTS.md`), Claude Code(`CLAUDE.md`), Cursor, GitHub Copilot, Windsurf, Gemini CLI — 그리고 `llm-wiki mcp`로 모든 MCP 클라이언트 |
| **단독 사용** | CLI(init/validate/audit/graph/stats/CI)는 **에이전트 없이도** 완전히 동작 |

## 빠른 시작

```bash
npm install -D @dowonk-7949/llm-wiki-standard
npx llm-wiki quickstart --write --type frontend --agent claude   # 또는 --agent codex
```

`quickstart --write`는 프로젝트를 감지하고 wiki·adapter 파일을 만든 뒤 handoff 프롬프트를 출력합니다. 그 프롬프트를 에이전트에 붙여넣으면 `docs/llm-wiki/index.md`를 읽고 실제 소스 근거로 문서를 보강하며, 모든 문서를 `needs_review`로 남겨 검토를 기다립니다. 먼저 보려면 `quickstart --dry-run`.

`--skills`(또는 `--agent claude|cursor`)를 더하면, 이후 feature/fix/docs-sync 작업용 위키-그라운디드 자동화 프롬프트도 생성합니다 — Claude 스킬(`/llm-wiki-feature`)·Cursor 룰·에이전트-중립 프롬프트. 각 본문에 프로젝트 도메인 맵 스냅샷이 들어갑니다.

## 권장 에이전트 & 모델

CLI 자체는 모델이 필요 없습니다. 오직 **보강(enrichment)** 단계 — 에이전트가 코드를 읽고 정확한 근거 기반 문서를 쓰는 단계 — 에서만 모델을 쓰며, 품질이 가장 크게 갈리는 지점입니다.

| 작업 | 권장 모델 티어 |
| --- | --- |
| **위키 보강**(코드에서 문서 작성·갱신) | 각 에이전트의 **최상위 추론/코딩 모델**(예: Claude Opus 급, 고추론 GPT-5 급, 또는 도구별 최상위 코딩 모델). 정확도·낮은 환각이 중요합니다. |
| **일상 유지보수**(소규모 `docs-sync`, `validate`/`status` 실행) | 중급·경량 모델로 충분합니다. |
| **CLI 자체**(`init`·`validate`·`audit`·`graph`·`stats`·`mcp` 서버) | 모델 불필요 — 순수 Node, 어디서나·CI에서 실행. |

`llm-wiki mcp` 서버는 결정적(모델 없음)이며, 그 툴을 *호출하는* 에이전트는 아무 모델이나 가능하되 위 보강 원칙을 따릅니다.

## 핵심 명령

| 명령 | 설명 |
| --- | --- |
| `quickstart --write` | wiki·adapter를 구성하고 에이전트 handoff 프롬프트를 출력. |
| `validate` | 로컬/CI용 구조·안전 검증(`--strict`, `--changed`). |
| `audit` · `status` | 전체 finding 리포트 · 현재 wiki 상태. |
| `graph` · `stats` | 지식 그래프(text/JSON/Mermaid/DOT) · 헬스 스냅샷. |
| `fix` · `migrate` · `drift` | 범위 한정 자동수정 · 계약 업그레이드 · 드리프트 강등(모두 미리보기 우선). |
| `handoff` · `prompt` | 에이전트 handoff 프롬프트 · 반복 작업 프롬프트(feature/fix/refactor/docs-sync/okf-extract). |
| `mcp` | 읽기 전용 MCP 서버 실행(아래 참조). |

전체 명령·옵션·exit code·프로그래매틱 API 레퍼런스: `npx llm-wiki help <command>`(오프라인) 또는 [PUBLIC_API.md](https://github.com/Dowon-Kim7949/llm-wiki-standard/blob/main/docs/llm-wiki/PUBLIC_API.md) 참조.

## 잘 쓰는 법

- **최신으로 유지.** 코드와 같은 변경에서 위키도 갱신(`prompt --task docs-sync`)하고, pre-commit/CI에서 `validate --changed`로 드리프트를 조기에 잡으세요.
- **신뢰하되 검증.** 에이전트가 쓴 문서는 `needs_review`로 두고 사람이 `verified`로 승격합니다. 소스가 바뀐 verified 문서는 `drift`로 잡습니다.
- **에이전트가 스스로 쓰게.** `mcp` 서버를 연결하면 에이전트가 코드를 다시 훑는 대신 위키를 툴로 질의합니다.
- **눈에 보이게.** `graph --format mermaid`·`stats`·`audit --format html`로 사람이 코퍼스를 볼 수 있습니다. GitHub/GitLab·Obsidian·MkDocs에서 그대로 렌더됩니다(정적 사이트 생성기가 아니라 Markdown-in-git 유지).
- **CI 연결.** [`templates/github-actions/llm-wiki-validate.yml`](https://github.com/Dowon-Kim7949/llm-wiki-standard/blob/main/templates/github-actions/llm-wiki-validate.yml)을 복사해 PR마다 `validate`를 실행하거나, 컴포지트 액션을 한 스텝으로 참조하세요 — `uses: Dowon-Kim7949/llm-wiki-standard/.github/actions/validate@v1.7.0`(정확한 태그로 고정).

## 에이전트 네이티브 (MCP)

`llm-wiki mcp`는 stdio 위에서 [Model Context Protocol](https://modelcontextprotocol.io) 서버를 실행합니다(개행 구분 JSON-RPC 2.0, Node 내장만 사용 — 서드파티 SDK 없음). MCP 클라이언트에 등록:

```json
{ "mcpServers": { "llm-wiki": { "command": "npx", "args": ["-y", "@dowonk-7949/llm-wiki-standard", "mcp"] } } }
```

**읽기 전용** 툴 — `validate`, `audit`, `next`, `status`, `doctor`, `stats`, `graph`, `explain`, `handoff`, `prompt` — 만 노출해, 에이전트가 위키를 조회하되 쓰지는 못합니다. 상세: [PUBLIC_API.md](https://github.com/Dowon-Kim7949/llm-wiki-standard/blob/main/docs/llm-wiki/PUBLIC_API.md) · [GATE_REVIEW.md](./GATE_REVIEW.md)(Gate 11).

## 코드에서 사용

CLI를 spawn하는 대신 패키지를 import — CI 래퍼·에디터 통합·테스트에 유용:

```js
import { commands, normalizeOptions, run } from "@dowonk-7949/llm-wiki-standard";

const r = await commands.audit(normalizeOptions({ cwd: process.cwd() }));
// r.command, r.result, r.findings, r.schemaVersion

const code = await run(["validate", "--strict"]); // 0 pass / 1 error / 2 blocked / 3 usage
```

`--format json` 출력에는 최상단 `schemaVersion`이 붙어 래퍼가 계약을 고정할 수 있습니다. 전체 API는 [PUBLIC_API.md](https://github.com/Dowon-Kim7949/llm-wiki-standard/blob/main/docs/llm-wiki/PUBLIC_API.md).

## 안전 요약

어디서나 미리보기 우선(`--write`/`--apply` 시에만 쓰기), `verified`는 모든 명령에서 사람만 승인, `docs/llm-wiki/log.md`와 기존 adapter 파일은 절대 덮어쓰지 않음, 민감정보로 보이는 값은 출력·기록하지 않음, 런타임 서드파티 의존성 없음. 전체 범위 결정: [GATE_REVIEW.md](./GATE_REVIEW.md).

## 더 알아보기

- [PUBLIC_API.md](https://github.com/Dowon-Kim7949/llm-wiki-standard/blob/main/docs/llm-wiki/PUBLIC_API.md) — 전체 명령·옵션·exit code·설정·프로그래매틱 API·MCP 레퍼런스.
- [GATE_REVIEW.md](./GATE_REVIEW.md) — 승인된 안전 범위(fix/migrate/drift/MCP)와 릴리스 게이트.
- [ROADMAP.md](./ROADMAP.md) — 방향성과 구현 이력.
- [EXAMPLES.md](https://github.com/Dowon-Kim7949/llm-wiki-standard/blob/main/docs/llm-wiki/EXAMPLES.md) — 실사용 예시 · [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) — 유지보수자 릴리스 절차.
- 커뮤니티: [CONTRIBUTING.ko.md](./CONTRIBUTING.ko.md) · [CODE_OF_CONDUCT.ko.md](./CODE_OF_CONDUCT.ko.md) · [SECURITY.ko.md](./SECURITY.ko.md).
