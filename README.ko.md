---
title: LLM-WIKI Standard Package Korean README
tags:
  - llm-wiki
  - package
  - cli
  - stable
  - korean
status: needs_review
doc_type: package_readme
project: llm-wiki-standard
last_updated: 2026-07-10
author: ai-generated
last_edited_by: Codex
wiki_block_version: v1
source_files:
  - README.md
  - package.json
  - src/cli.js
  - src/commands.js
  - src/config.js
  - src/task-prompts.js
  - templates/github-actions/llm-wiki-validate.yml
  - tests/verification.test.js
related:
  - README.md
  - ROADMAP.md
  - GATE_REVIEW.md
  - VERIFICATION.md
  - RELEASE_CHECKLIST.md
visibility: internal
contains_sensitive_info: false
---

> Language: [English](./README.md) | [한국어](./README.ko.md)

# LLM-WIKI Standard Package

`@dowonk-7949/llm-wiki-standard`는 AI Agent가 사용할 표준화된 프로젝트 지식 기반을 생성하고 검증하는 CLI 패키지입니다. 프로젝트의 아키텍처, 도메인, API, 코딩 규칙, 기술 결정, 작업 흐름과 운영 지식을 재사용 가능한 LLM-WIKI 문서로 정리합니다.

재사용할 프로젝트 지식이 없으면 Codex나 Claude Code 같은 Agent가 유지보수 작업을 수행할 때마다 코드베이스의 많은 부분을 다시 탐색해야 할 수 있습니다. LLM-WIKI를 사용하면 Agent가 `docs/llm-wiki/index.md`에서 시작하여 현재 작업과 관련된 문서를 읽고, 작업을 검증하거나 완료하는 데 필요한 소스 파일만 확인합니다. 이를 통해 반복적인 코드 탐색, 토큰 사용량과 탐색 시간을 줄이고 프로젝트 고유 규칙을 놓칠 가능성을 낮출 수 있습니다.

주요 활용 대상은 레거시 프로젝트 유지보수, 신규 기능 개발, 장애 대응, 신규 담당자 온보딩, 복잡한 프로젝트 인수인계와 여러 AI Agent 간 프로젝트 지식 공유입니다.

## LLM-WIKI가 필요한 이유

```text
기존 방식:
작업 요청 -> 코드베이스 탐색 -> 구조와 규칙 재파악 -> 작업 수행

LLM-WIKI 적용 방식:
작업 요청 -> index.md 확인 -> 관련 wiki 문서 확인 -> 필요한 소스 파일 확인 -> 작업 수행
```

LLM-WIKI는 소스 코드 확인을 대체하는 문서가 아니라, 반복해서 사용할 수 있는 프로젝트 지식 인덱스입니다. Wiki 문서는 Agent가 관련 맥락을 빠르게 찾도록 안내하고, `source_files`와 정밀한 `evidence` 참조는 중요한 설명을 실제 코드 근거까지 추적할 수 있게 합니다. 실제 토큰 및 탐색 시간 절감 폭은 프로젝트 규모, 문서화 범위와 wiki 최신성에 따라 달라집니다.

CLI가 위키를 자동으로 완성하지는 않습니다. 안전한 시작 구조를 만들고, 생성 문서를 `needs_review` 상태로 유지하며, 이후 Codex 또는 Claude Code에서 실행할 프롬프트를 출력합니다.

## 권장 흐름

```text
CLI setup
-> Codex 또는 Claude Code 보강
-> 사람 검토
-> 선택적 verified 승인
-> CI 검증
```

| 단계 | 담당 | 목적 |
| --- | --- | --- |
| CLI setup | `llm-wiki` | 프로젝트를 감지하고, 누락된 wiki 파일과 선택한 adapter 파일을 만들며, frontmatter를 검증하고 다음 agent prompt를 출력합니다. |
| Agent enrichment | Codex 또는 Claude Code | 실제 코드를 읽고 architecture, domain, API, workflow, operations 문서를 source evidence 기반으로 보강합니다. |
| Human review | Maintainer | 정확성을 확인하고 불확실한 주장을 제거하며, 문서를 `needs_review`에서 `verified`로 올릴지 결정합니다. |
| CI validation | `llm-wiki validate` | 구조, adapter entrypoint, frontmatter, 로컬 markdown 링크, wiki link, source file reference, encoding, sensitive-info 규칙을 검사합니다. |

## 생성되는 문서 구조

실제 생성 파일은 `--type`, `--profile`, `--minimal`에 따라 달라집니다. 기본 구성은 다음과 같은 구조에서 시작합니다.

```text
AGENTS.md 또는 CLAUDE.md
docs/llm-wiki/
|-- index.md
|-- README.md
|-- project-profile.md
|-- ARCHITECTURE_CONVENTIONS.md
|-- DOMAIN_FEATURES.md
|-- GLOSSARY.md
|-- log.md
|-- domains/
|   `-- 00_overview.md
|-- profiles/
|   `-- <project-type>.md
`-- templates/
    |-- DECISION_LOG.template.md
    `-- TASK_PROMPT.template.md
```

Frontend, backend, fullstack, library, OKF profile을 선택하면 component inventory, API contract, data model, security 및 operations guide, end-to-end workflow, public API reference, OKF knowledge template 같은 프로젝트 유형별 문서가 추가됩니다. 생성 파일은 안전한 시작 초안이며, Codex 또는 Claude Code가 실제 프로젝트 근거를 확인하여 내용을 보강합니다.

## 사용 조건

- Node.js 18.18.0 이상이 필요합니다.
- CLI가 검사하고, 명시적인 `--write`가 있을 때 파일을 작성할 프로젝트 디렉터리가 필요합니다.
- Agent를 통한 wiki 보강에는 Codex 또는 Claude Code가 필요합니다. Agent를 실행하지 않아도 CLI의 초기화, audit, validation과 CI 기능은 사용할 수 있습니다.

## 빠른 시작

프로젝트 루트에서 실행합니다.

```bash
npm install -D @dowonk-7949/llm-wiki-standard
npx llm-wiki quickstart --write --type frontend --agent codex
```

Claude Code를 사용할 때는 다음처럼 실행합니다.

```bash
npm install -D @dowonk-7949/llm-wiki-standard
npx llm-wiki quickstart --write --type frontend --agent claude
```

`quickstart --write`는 CLI setup을 실행한 뒤 handoff prompt를 출력합니다. 출력된 prompt를 Codex 또는 Claude Code에 붙여 넣으면 agent가 adapter 파일과 `docs/llm-wiki/index.md`를 읽고 실제 source file 근거로 wiki를 보강합니다.

미리보기만 원하면 `quickstart --dry-run`을 사용합니다.

```bash
npx llm-wiki quickstart --dry-run --type frontend --agent codex
```

## 단계별 실행

```bash
npx llm-wiki doctor
npx llm-wiki init --dry-run --type frontend --agent codex
npx llm-wiki init --write --type frontend --agent codex
npx llm-wiki validate-frontmatter
npx llm-wiki handoff --agent codex
```

초기 wiki가 생성되고 보강된 뒤에는 반복 가능한 작업 프롬프트를 만들 수 있습니다.

```bash
npx llm-wiki prompt --task feature --agent codex
npx llm-wiki prompt --task docs-sync --agent codex
npx llm-wiki prompt --task okf-extract --agent codex
```

Agent가 wiki 보강을 마친 뒤에는 다음을 실행합니다.

```bash
npx llm-wiki validate --type frontend --agent codex
```

현재 wiki 상태를 확인하려면 다음을 실행합니다.

```bash
npx llm-wiki status --agent codex
```

## Codex에서 시작하기

```bash
npx llm-wiki quickstart --write --type frontend --agent codex
```

그 다음 출력된 handoff prompt를 Codex에 붙여 넣습니다. Codex adapter 파일은 `AGENTS.md`이며, 이 파일은 Codex가 `docs/llm-wiki/index.md`에서 탐색을 시작하도록 안내해야 합니다.

Codex가 해야 할 작업:

- `AGENTS.md`와 `docs/llm-wiki/index.md`를 읽습니다.
- 주장이나 설명을 쓰기 전에 실제 source file을 확인합니다.
- 누락된 `docs/llm-wiki` 내용을 source-backed detail로 보강합니다.
- 생성되거나 수정된 문서를 `needs_review` 상태로 둡니다.
- 검토 메모를 `docs/llm-wiki/log.md`에 append-only로 남깁니다.
- 문서를 `verified`로 승격하지 않습니다.

## Claude Code에서 시작하기

```bash
npx llm-wiki quickstart --write --type frontend --agent claude
```

그 다음 출력된 handoff prompt를 Claude Code에 붙여 넣습니다. Claude Code adapter 파일은 `CLAUDE.md`이며, 이 파일은 Claude Code가 `docs/llm-wiki/index.md`에서 탐색을 시작하도록 안내해야 합니다.

## CLI가 하는 일

- Node·Python·Go·Rust·JVM 매니페스트 signal 또는 `--type`으로 project type을 감지합니다.
- 공통 `docs/llm-wiki` 문서 구조를 만듭니다.
- 선택한 adapter 파일이 없을 때만 생성합니다. 예: `AGENTS.md`(Codex), `CLAUDE.md`(Claude Code), `.cursor/rules/llm-wiki.mdc`(Cursor), `.github/copilot-instructions.md`(GitHub Copilot).
- frontmatter, encoding, local markdown link, `[[wiki links]]`, adapter entrypoint, sensitive-info 규칙을 검증합니다.
- LLM-WIKI frontmatter contract를 `rules/frontmatter.schema.json`으로 게시하고, 같은 runtime contract로 frontmatter를 검증합니다.
- wiki frontmatter의 local `source_files` 항목이 실제로 존재하는지 확인합니다.
- `src/file.ts#L10-L20`, `src/file.ts#symbol:Name`, `README.md#section:Usage`, `src/routes.ts#route:/users` 같은 선택적 정밀 `evidence` 참조를 검사합니다.
- frontend, backend, fullstack, library evidence focus가 포함된 handoff prompt를 출력합니다.
- 초기 보강 이후 feature, fix, refactor, docs-sync, okf-extract 작업 프롬프트를 출력합니다.
- 문서 수, wiki link, unresolved concept, alias, orphan document를 포함하는 Wiki Graph 요약을 제공합니다.
- CLI가 생성한 문서를 `needs_review` 상태로 둡니다.

## CLI가 하지 않는 일

- Codex 또는 Claude Code를 자동 실행하지 않습니다.
- 모든 source file을 읽고 domain knowledge를 자동 완성하지 않습니다.
- 문서를 `verified`로 승격하지 않습니다.
- 기존 adapter 파일을 덮어쓰지 않습니다.
- `docs/llm-wiki/log.md`를 덮어쓰지 않습니다.
- `migrate --apply`는 아직 활성화하지 않습니다.

## 명령어

| 명령 | 사용 시점 |
| --- | --- |
| `llm-wiki doctor` | local runtime, package readiness, project detection을 확인합니다. |
| `llm-wiki status` | 초기화 상태, document status count, missing docs, adapter state, link 및 source file finding, Wiki Graph 요약을 확인합니다. |
| `llm-wiki next` | Audit finding과 Wiki Graph를 바탕으로 다음 review, repair, setup 작업을 추천합니다. |
| `llm-wiki explain <finding>` | Finding 규칙의 의미와 안전한 해결 방법을 설명합니다. |
| `llm-wiki quickstart --dry-run` | 파일을 쓰지 않고 setup과 handoff prompt를 미리 봅니다. |
| `llm-wiki quickstart --write` | 누락된 wiki 파일을 만들고 frontmatter를 검증한 뒤 handoff prompt를 출력합니다. |
| `llm-wiki handoff` | setup 이후 Codex 또는 Claude Code에 넘길 다음 prompt를 출력합니다. |
| `llm-wiki prompt --task <name>` | feature, fix, refactor, docs-sync, OKF extraction용 반복 작업 prompt를 출력합니다. |
| `llm-wiki init --dry-run` | 생성 예정 파일을 미리 봅니다. |
| `llm-wiki init --write` | 누락된 wiki 파일과 선택한 adapter 파일을 생성합니다. |
| `llm-wiki validate-frontmatter` | frontmatter만 검사합니다. |
| `llm-wiki validate` | local check 또는 CI용 구조/안전 검증을 수행합니다. |
| `llm-wiki audit` | 더 넓은 audit report를 생성합니다. |
| `llm-wiki migrate --dry-run` | 파일을 쓰지 않고 검토 가능한 migration plan을 만듭니다. |
| `llm-wiki release-notes` | 마지막 `v*` 태그 이후 conventional commit으로 `needs_review` 릴리스 노트 문서를 생성합니다. |

명령별 옵션은 의도적으로 제한됩니다. 예를 들어 `validate --write`와 `handoff --existing overwrite`는 해당 명령에 속하지 않는 옵션이므로 거부됩니다.

Validation 계열 명령의 JSON 출력에는 `findingSummary`가 포함되고, text 출력에는 severity와 category별 `Finding Summary`가 포함되어 CI report에서 활용할 수 있습니다.

CLI exit code는 local automation과 CI에서 다음 의미로 사용할 수 있습니다.

| Exit code | 의미 |
| --- | --- |
| `0` | Error 또는 blocked finding 없이 완료되었습니다. Non-strict warning은 명령을 실패시키지 않습니다. |
| `1` | Validation error가 있거나 `--strict`가 warning을 failure로 처리했습니다. |
| `2` | 요청한 작업 또는 선택한 workflow가 안전 정책에 의해 차단되었습니다. |
| `3` | 명령, 인자, 옵션 또는 출력 format이 올바르지 않습니다. |

명령별 도움말:

```bash
npx llm-wiki help quickstart
npx llm-wiki help prompt
npx llm-wiki help status
npx llm-wiki help next
npx llm-wiki help explain
```

Handoff prompt를 report로 저장하려면 다음을 사용합니다.

```bash
npx llm-wiki handoff --agent codex --out docs/llm-wiki/tasks/initial-enrichment.prompt.md
```

반복 작업 prompt를 report로 저장하려면 다음을 사용합니다.

```bash
npx llm-wiki prompt --task feature --agent codex --out docs/llm-wiki/tasks/feature.prompt.md
```

CLI에 다음 유지보수 작업을 추천받으려면 다음을 실행합니다.

```bash
npx llm-wiki next --agent codex
```

Validation finding의 의미와 안전한 해결 방법을 확인하려면 다음을 실행합니다.

```bash
npx llm-wiki explain wiki_link.missing
```

`llm-wiki prompt --task feature`, `fix`, `refactor`는 agent에게 `docs/llm-wiki/index.md`를 먼저 읽고, 관련 wiki 문서와 실제 source file을 확인하고, 짧은 계획을 만든 뒤 code와 영향을 받은 LLM-WIKI 문서를 함께 수정하고, `docs/llm-wiki/log.md`를 append-only로 갱신하며, 수정 문서를 `needs_review`로 유지하고 관련 테스트를 실행하도록 지시합니다.

`llm-wiki prompt --task docs-sync`는 변경된 code를 감지하고 stale wiki 문서를 찾아 갱신하는 데 집중합니다. 관련 없는 code edit은 피해야 합니다.

`llm-wiki prompt --task okf-extract`는 OKF v0.1 추출을 위한 prompt-assisted workflow입니다. 자동 추출 명령이 아니며, Markdown plus YAML frontmatter, required `type`, optional `aliases`/`tags`, `[[Concept Name]]` 형태의 body wiki links를 사용하고 LLM-WIKI에 저장되는 추출 문서는 `needs_review`로 유지합니다.

선택한 wiki 문서를 OKF v0.1 frontmatter shape에도 맞추고 싶다면 `status`, `audit`, `validate`에서 `--profile okf-v0.1`을 사용합니다.

```bash
npx llm-wiki validate --profile okf-v0.1
```

OKF profile은 명시적인 frontmatter `type`을 요구하고, optional `aliases`와 `tags` 배열을 허용하며, 기존 `[[wiki links]]` missing-target validation을 함께 사용합니다. OKF `type`은 LLM-WIKI `doc_type`에서 자동 추론하지 않으므로 두 contract가 모두 필요한 문서는 두 필드를 함께 유지해야 합니다.

`init --profile okf-v0.1`은 `concept`, `project`, `api_reference`, `meeting_note`, `event` 문서용 OKF-oriented template도 `docs/llm-wiki/templates/` 아래에 생성합니다.

또한 `docs/llm-wiki/OKF_CONVERSION_GUIDE.md`를 생성해 LLM-WIKI metadata를 자동 변환하지 않고 검토 후 명시적으로 OKF v0.1 field에 매핑하는 방법을 설명합니다.

## 공통 옵션

- `--cwd <path>`: 검사하거나 작성할 project root입니다.
- `--task <feature|fix|refactor|docs-sync|okf-extract>`: `llm-wiki prompt`의 task preset입니다.
- `--type <frontend|backend|fullstack|library|mixed|unknown>`: 명시적 project type입니다.
- `--profile <profile>`: 추가 profile입니다. 반복 사용할 수 있습니다.
- `--agent <codex|claude|cursor|copilot|antigravity|all>`: 선택한 adapter target입니다. 반복 사용할 수 있습니다. `all`은 codex/claude/antigravity로 확장하며 cursor·copilot은 명시 선택합니다.
- `--format <text|json|markdown|html>`: output format입니다. `html`은 `audit`/`validate`/`status`용 자체완결형 대시보드를 렌더링합니다.
- `--version <x.y.z>`: `release-notes`의 대상 버전입니다(기본값은 `package.json`).
- `--out <path>`: report file을 씁니다.
- `--strict`: warning을 failure로 처리합니다.
- `--minimal`: core document만 생성합니다.
- `--write`: 명시적 write가 필요한 명령에서 쓰기 작업을 허용합니다.
- `--existing <skip|overwrite>`: 기존 wiki document 처리 방식입니다. 기본값은 `skip`입니다.

`--agent antigravity`는 아직 adapter candidate입니다. Tool contract가 확정되기 전에는 Antigravity handoff prompt를 출력하지 않습니다. Handoff prompt는 `--agent codex`, `--agent claude`, `--agent cursor`, `--agent copilot`을 사용하세요.

## 설정 파일

프로젝트 루트의 선택적 `llm-wiki.config.json`으로 `type`/`profiles`/`agents`/`strict` 기본값을 선언해 매번 플래그를 반복하지 않을 수 있습니다.

```json
{
  "type": "library",
  "agents": ["codex", "claude"]
}
```

적용 우선순위는 CLI 플래그 > config > 자동감지입니다. 잘못된 config는 exit code `3`으로 거부되고, `doctor`가 config 존재 여부를 보고합니다. 스키마는 현재 의도적으로 최소한만 지원합니다.

## Evidence 계약

다음 세 가지 근거 계층을 함께 사용합니다.

- `source_files`는 문서 내용을 뒷받침하는 project-root 기준의 넓은 파일 범위를 기록합니다.
- 선택적 `evidence`는 파일, line, symbol, section, route 단위의 정밀 참조를 기록합니다.
- 본문의 `## Evidence`는 사람이 검토할 수 있는 근거 목록이며, frontmatter에 정밀 `evidence`가 있으면 각 참조를 본문에도 명시해야 합니다.

```markdown
---
source_files:
  - package.json
  - src/routes/users.ts
evidence:
  - package.json#L1-L5
  - src/routes/users.ts#symbol:loadUsers
  - src/routes/users.ts#route:/users
---

## Evidence

- `package.json#L1-L5`는 프로젝트 맥락에 사용한 package metadata의 근거입니다.
- `src/routes/users.ts#symbol:loadUsers`는 문서에 설명된 사용자 조회 동작의 근거입니다.
- `src/routes/users.ts#route:/users`는 문서에 기록된 route path의 근거입니다.
```

## 안전 정책

- Markdown은 UTF-8로 읽고 씁니다.
- 민감정보로 보이는 raw value는 출력하거나 report에 쓰지 않습니다.
- 기존 wiki 문서는 기본적으로 유지하고, 명시적 `--existing overwrite`가 있을 때만 다시 씁니다.
- Local `source_files` 항목은 project root 기준으로 존재하는 file을 가리켜야 합니다.
- 선택적 `evidence` 항목은 `file`, `file#L10`, `file#L10-L20`, `file#symbol:Name`, `file#section:Heading`, `file#route:/path` 형식을 사용해야 하며, local file target과 line range를 검증합니다.
- Frontmatter에 `evidence`가 있으면 본문에 각 정밀 참조를 언급하는 `## Evidence` bullet 목록이 있어야 합니다.
- `docs/llm-wiki` 내부 local markdown link는 존재하는 상대 파일을 가리켜야 합니다.
- `docs/llm-wiki` 내부 `[[wiki links]]`는 기존 wiki file path, basename, frontmatter `title`, 또는 frontmatter `aliases` 항목으로 해석되어야 합니다.
- `--strict` 모드에서 `verified` 문서는 `reviewed_by`와 `reviewed_at`을 포함해야 하며 evidence contract warning도 error로 처리됩니다.
- `rules/frontmatter.schema.json`은 required frontmatter fields, valid `status`/`visibility` values, optional `aliases`와 `evidence`, `verified` 문서의 review metadata를 정의합니다.
- `docs/llm-wiki/log.md`는 append-only이며 덮어쓰지 않습니다.
- 기존 `AGENTS.md`, `CLAUDE.md`, `ANTIGRAVITY.md` 파일은 덮어쓰지 않습니다.
- `migrate --apply`는 자동 migration 범위를 명시적으로 승인하기 전까지 차단됩니다.
- CLI가 생성하거나 agent가 수정한 wiki/report 문서는 사람 검토 전까지 `needs_review` 상태입니다.

## 기존 Wiki 문서 재생성

현재 표준에 맞춰 기존 LLM-WIKI 문서를 다시 만들 필요가 있을 때만 사용합니다.

```bash
npx llm-wiki quickstart --write --type frontend --agent codex --existing overwrite
```

`--existing overwrite`는 일반 wiki 문서에만 적용됩니다. `docs/llm-wiki/log.md`나 기존 adapter 파일은 덮어쓰지 않습니다.

## 검증

```bash
npm test
npx llm-wiki validate-frontmatter
npx llm-wiki doctor --format markdown
npx llm-wiki prompt --task feature --agent codex
```

## GitHub Actions 예시

이 패키지를 사용하는 프로젝트에서 `templates/github-actions/llm-wiki-validate.yml`을 `.github/workflows/llm-wiki-validate.yml`로 복사할 수 있습니다. 예제는 다음 명령을 실행합니다.

```bash
npm test
npx llm-wiki validate-frontmatter
npx llm-wiki validate --strict --agent codex
```

프로젝트에서 사용하는 adapter에 맞게 `--agent codex`를 변경할 수 있습니다. 예제는 `--strict`를 사용하므로 `verified` 문서에는 `reviewed_by`와 `reviewed_at`이 있어야 하며 warning도 workflow를 실패시킵니다.

## 릴리스 자동화

CI는 pull request와 `main` push에서 검증을 실행합니다. Publish는 `.github/workflows/publish.yml`을 통한 `v*` tag push로 제한됩니다.

자동 publish 전에 GitHub Actions workflow filename을 `publish.yml`로 지정하여 npm Trusted Publisher를 등록해야 합니다. Publish job은 GitHub Environment `npm-release`를 사용하므로 GitHub UI에서 required reviewer 또는 deployment approval rule을 설정할 수 있습니다.

검증 후 version `0.1.7`를 배포하려면 다음을 실행합니다.

```bash
git tag v0.1.7
git push origin v0.1.7
```

## 관련 문서

- `README.md`: 영어 README.
- `ROADMAP.md`: 제품 방향, 구현 단계, 단기 우선순위와 향후 작업 후보.
- `GATE_REVIEW.md`: stable release gate decision과 caveat.
- `VERIFICATION.md`: verification record.
- `RELEASE_CHECKLIST.md`: stable release checklist.
