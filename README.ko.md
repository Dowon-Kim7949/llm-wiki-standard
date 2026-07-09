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
last_updated: 2026-07-08
author: ai-generated
last_edited_by: Codex
wiki_block_version: v1
source_files:
  - README.md
  - package.json
  - src/cli.js
  - src/commands.js
  - src/task-prompts.js
  - templates/github-actions/llm-wiki-validate.yml
  - tests/verification.test.js
related:
  - README.md
  - GATE_REVIEW.md
  - VERIFICATION.md
  - RELEASE_CHECKLIST.md
visibility: internal
contains_sensitive_info: false
---

> Language: [English](./README.md) | [한국어](./README.ko.md)

# LLM-WIKI Standard Package

`@dowonk-7949/llm-wiki-standard`는 로컬 터미널, CI, Codex, Claude Code, 후보 어댑터 파일에서 공통 LLM-WIKI 문서 구조를 만들고 검증하는 CLI 패키지입니다.

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

- 로컬 signal 또는 `--type`으로 project type을 감지합니다.
- 공통 `docs/llm-wiki` 문서 구조를 만듭니다.
- 선택한 adapter 파일이 없을 때만 생성합니다. 예: `AGENTS.md`, `CLAUDE.md`.
- frontmatter, encoding, local markdown link, `[[wiki links]]`, adapter entrypoint, sensitive-info 규칙을 검증합니다.
- LLM-WIKI frontmatter contract를 `rules/frontmatter.schema.json`으로 게시하고, 같은 runtime contract로 frontmatter를 검증합니다.
- wiki frontmatter의 local `source_files` 항목이 실제로 존재하는지 확인합니다.
- frontend, backend, fullstack, library evidence focus가 포함된 handoff prompt를 출력합니다.
- 초기 보강 이후 feature, fix, refactor, docs-sync, okf-extract 작업 프롬프트를 출력합니다.
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
| `llm-wiki status` | 초기화 상태, document status count, missing docs, adapter state, markdown link/source file finding을 확인합니다. |
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

명령별 도움말:

```bash
npx llm-wiki help quickstart
npx llm-wiki help prompt
npx llm-wiki help status
```

Handoff prompt를 report로 저장하려면 다음을 사용합니다.

```bash
npx llm-wiki handoff --agent codex --out docs/llm-wiki/tasks/initial-enrichment.prompt.md
```

반복 작업 prompt를 report로 저장하려면 다음을 사용합니다.

```bash
npx llm-wiki prompt --task feature --agent codex --out docs/llm-wiki/tasks/feature.prompt.md
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
- `--agent <codex|claude|antigravity|all>`: 선택한 adapter target입니다. 반복 사용할 수 있습니다.
- `--format <text|json|markdown>`: output format입니다.
- `--out <path>`: report file을 씁니다.
- `--strict`: warning을 failure로 처리합니다.
- `--minimal`: core document만 생성합니다.
- `--write`: 명시적 write가 필요한 명령에서 쓰기 작업을 허용합니다.
- `--existing <skip|overwrite>`: 기존 wiki document 처리 방식입니다. 기본값은 `skip`입니다.

`--agent antigravity`는 아직 adapter candidate입니다. Tool contract가 확정되기 전에는 Antigravity handoff prompt를 출력하지 않습니다. Handoff prompt는 `--agent codex` 또는 `--agent claude`를 사용하세요.

## 안전 정책

- Markdown은 UTF-8로 읽고 씁니다.
- 민감정보로 보이는 raw value는 출력하거나 report에 쓰지 않습니다.
- 기존 wiki 문서는 기본적으로 유지하고, 명시적 `--existing overwrite`가 있을 때만 다시 씁니다.
- Local `source_files` 항목은 project root 기준으로 존재하는 file을 가리켜야 합니다.
- `docs/llm-wiki` 내부 local markdown link는 존재하는 상대 파일을 가리켜야 합니다.
- `docs/llm-wiki` 내부 `[[wiki links]]`는 기존 wiki file path, basename, frontmatter `title`, 또는 frontmatter `aliases` 항목으로 해석되어야 합니다.
- `--strict` 모드에서 `verified` 문서는 `reviewed_by`와 `reviewed_at`을 포함해야 합니다.
- `rules/frontmatter.schema.json`은 required frontmatter fields, valid `status`/`visibility` values, optional `aliases`, `verified` 문서의 review metadata를 정의합니다.
- `docs/llm-wiki/log.md`는 append-only이며 덮어쓰지 않습니다.
- 기존 `AGENTS.md`, `CLAUDE.md`, `ANTIGRAVITY.md` 파일은 덮어쓰지 않습니다.
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

이 패키지를 사용하는 프로젝트에서 `templates/github-actions/llm-wiki-validate.yml`을 `.github/workflows/llm-wiki-validate.yml`로 복사할 수 있습니다.

```bash
npm test
npx llm-wiki validate-frontmatter
npx llm-wiki validate --strict --agent codex
```

## 릴리스 자동화

CI는 pull request와 `main` push에서 검증을 실행합니다. Publish는 `.github/workflows/publish.yml`을 통한 `v*` tag push로 제한됩니다.

검증 후 version `0.1.4`를 배포하려면 다음을 실행합니다.

```bash
git tag v0.1.4
git push origin v0.1.4
```

## 관련 문서

- `README.md`: 영어 README.
- `GATE_REVIEW.md`: stable release gate decision과 caveat.
- `VERIFICATION.md`: verification record.
- `RELEASE_CHECKLIST.md`: stable release checklist.
