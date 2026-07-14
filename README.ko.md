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

Frontend, backend, fullstack, library, OKF profile을 선택하면 component inventory, API contract, data model, security 및 operations guide, end-to-end workflow, public API reference, OKF knowledge template 같은 프로젝트 유형별 문서가 추가됩니다. backend·fullstack 프로젝트에서는 `init`이 업무 도메인 디렉터리(예: `src/modules/*`, `app/domains/*`, `internal/domain/*`)를 감지해 도메인별 문서(`docs/llm-wiki/domains/NN_<name>.md`, `doc_type: domain`)를 만들고 `domains/00_overview.md`에서 링크합니다. 생성 파일은 안전한 시작 초안이며, Codex 또는 Claude Code가 실제 프로젝트 근거를 확인하여 내용을 보강합니다.

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
- 선택한 adapter 파일이 없을 때만 생성합니다. 예: `AGENTS.md`(Codex), `CLAUDE.md`(Claude Code), `.cursor/rules/llm-wiki.mdc`(Cursor), `.github/copilot-instructions.md`(GitHub Copilot), `.windsurf/rules/llm-wiki.md`(Windsurf), `GEMINI.md`(Gemini CLI). 파일 계약이 미확인인 도구(JetBrains AI, Antigravity)는 info-level candidate로 두고 생성하지 않습니다.
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
- `fix --write`·`migrate --apply` 중에도 `verified` 문서 내용을 편집하지 않으며, 문서의 `status`를 바꾸는 것은 opt-in `drift --downgrade`(드리프트된 `verified` 문서를 `needs_review`로) 뿐입니다.

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
| `llm-wiki validate` | local check 또는 CI용 구조/안전 검증을 수행합니다. `--changed`로 변경된 문서만 대상으로 좁힐 수 있습니다(빠른 pre-commit/CI). |
| `llm-wiki audit` | 더 넓은 audit report를 생성합니다. |
| `llm-wiki migrate` | `wiki_block_version` 업그레이드 갭을 보고하고 변경을 미리봅니다. `--apply`로 문서를 현재 계약으로 업그레이드합니다(`fix` 범위 재사용, `verified` 보존). |
| `llm-wiki fix` | `docs/llm-wiki` 내부의 안전한 자동수정을 미리보기합니다. `--write`로 실제 적용합니다. |
| `llm-wiki drift` | `verified` 문서의 `evidence.stale` 드리프트를 보고합니다. `--downgrade`로 드리프트된 문서를 `needs_review`로 내립니다. |
| `llm-wiki graph` | 지식 그래프(문서 + 해소된 링크)를 text/JSON/Mermaid/Graphviz DOT로 출력합니다. |
| `llm-wiki stats` | wiki 헬스 스냅샷(verified %, enrichment %, evidence coverage, staleness, orphan)을 보고합니다. |
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

## 자동수정 (Autofix)

`llm-wiki fix`는 `docs/llm-wiki` 내부에 승인된 좁은 범위의 안전한 수정만 적용합니다. 기본은 미리보기이고 `--write`가 있을 때만 씁니다.

```bash
npx llm-wiki fix            # 계획만 미리보기, 쓰기 없음
npx llm-wiki fix --write    # 실제 적용
```

수정 대상은 다음뿐입니다.

- 누락된 기계적 필수 frontmatter 필드 삽입(`status`, `visibility`, `contains_sensitive_info`, `wiki_block_version`, `last_updated`, `last_edited_by`, 그리고 빈 `tags`/`source_files`/`related`);
- 기존 frontmatter `evidence` 항목을 근거로 본문 `## Evidence` 섹션 추가·보완;
- `docs/llm-wiki/*.md` 내부의 깨진 `related`/markdown 링크 타깃에 대한 `needs_review` 스텁 생성;
- 실제로 수정한 문서에 한해 `last_updated` 갱신.

`verified` 문서 내용, `title`/`doc_type`/`project`/`author`나 `source_files`/`evidence` 값, 미보강(placeholder) 내용은 절대 지어내거나 수정하지 않으며 `docs/llm-wiki` 밖에는 쓰지 않습니다. mojibake·민감정보로 보이는 결과는 건너뛰고, 반복 실행해도 결과가 같습니다(멱등). 정확한 범위는 `GATE_REVIEW.md`에 기록되어 있습니다.

## 업그레이드 & 드리프트 (Upgrades & Drift)

`llm-wiki migrate`는 기존 wiki를 삭제·재생성하지 않고 CLI 계약에 맞춰 올려줍니다. 각 문서와 설치된 CLI 사이의 `wiki_block_version` 갭을 보고하며, 기본은 미리보기이고 `--apply`로 적용합니다.

```bash
npx llm-wiki migrate            # 업그레이드 리포트 + 계획, 쓰기 없음
npx llm-wiki migrate --apply    # 문서를 현재 계약으로 업그레이드
```

`fix` 범위를 재사용하고, 문서가 계약에 부합해지면 그 문서의 `wiki_block_version`을 현재로 올려 stamp합니다. `verified` 문서 내용은 편집하지 않고, `status`는 바꾸지 않으며, 더 최신 CLI가 stamp한 문서(ahead)는 다운그레이드 없이 보고만 합니다(`GATE_REVIEW.md`, Gate 8).

`llm-wiki drift`는 `verified` 문서의 `evidence.stale` 드리프트를 보고하며(소스가 정확한 `#Lx-Ly` evidence로만 인용된 경우 해당 라인 범위로 정밀 검사), `--downgrade`가 있을 때만 드리프트된 문서를 `needs_review`로 내립니다(`status`·`last_updated`만, `verified` 승격은 절대 없음; Gate 9).

```bash
npx llm-wiki drift              # 드리프트된 verified 문서 보고
npx llm-wiki drift --downgrade  # 드리프트된 verified 문서를 needs_review로
```

## 사람 독자를 위한 공개 (Publishing for Human Readers)

LLM-WIKI는 Markdown-in-git 코퍼스로 남습니다 — **정적 사이트 생성기가 아닙니다.** 비개발자도 읽기 쉽게 하려면 이미 Markdown을 잘 렌더링하는 도구를 활용하세요:

- **GitHub / GitLab** — `docs/llm-wiki/`를 웹 UI에서 그대로 렌더링합니다. 폴더를 탐색하면 됩니다.
- **Obsidian** — 저장소를 vault로 엽니다. 코퍼스의 `[[wiki links]]`와 `aliases`를 그대로 읽어 그래프 탐색을 제공합니다.
- **MkDocs**(또는 유사 도구) — 호스팅 정적 사이트가 필요하면 `docs/llm-wiki/`를 가리키게 합니다.

렌더러를 직접 소유하지 않고도 지식을 보고·공유할 수 있게 CLI가 돕습니다:

```bash
npx llm-wiki graph --format mermaid   # GitHub/Obsidian Markdown 페이지에 붙여넣기
npx llm-wiki graph --format dot        # Graphviz로 렌더링
npx llm-wiki stats                     # 헬스 스냅샷(verified %, enrichment %, staleness)
npx llm-wiki audit --format html --out wiki-dashboard.html   # 탐색용 Document Index가 포함된 대시보드
```

`--format html` 대시보드에는 이제 모든 wiki 문서를 나열하는 **Document Index**(인바운드 링크 수·고아 표시 포함)가 들어가, 독자가 코퍼스를 한눈에 탐색할 수 있습니다. Document Index 링크는 `--out` 파일 위치 기준 상대경로로 계산되므로, 하위 폴더에 쓴 대시보드(예: `--out docs/reports/dashboard.html`)에서도 wiki 문서로 정상 연결됩니다.

## 공통 옵션

- `--cwd <path>`: 검사하거나 작성할 project root입니다.
- `--task <feature|fix|refactor|docs-sync|okf-extract>`: `llm-wiki prompt`의 task preset입니다.
- `--type <frontend|backend|fullstack|library|mixed|unknown>`: 명시적 project type입니다.
- `--profile <profile>`: 추가 profile입니다. 반복 사용할 수 있습니다.
- `--agent <codex|claude|cursor|copilot|antigravity|all>`: 선택한 adapter target입니다. 반복 사용할 수 있습니다. `all`은 codex/claude/antigravity로 확장하며 cursor·copilot은 명시 선택합니다.
- `--format <text|json|markdown|html>`: output format입니다. `html`은 `audit`/`validate`/`status`용 자체완결형 대시보드를 렌더링합니다.
- `--version <x.y.z>`: `release-notes`의 대상 버전입니다(기본값은 `package.json`).
- `--since <git-ref>`: `release-notes` commit 범위 base를 `<ref>..HEAD`로 강제합니다(태그 생성 후 특정 버전 노트를 재생성할 때 유용).
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

## 프로그래매틱 API (Programmatic API)

CLI 외에, 패키지를 import해 in-process로 실행할 수 있습니다. CLI를 spawn하던 CI 래퍼·에디터 통합·테스트에 유용합니다.

```js
import { commands, normalizeOptions, parseArgs, run, SCHEMA_VERSION } from "@dowonk-7949/llm-wiki-standard";

// 부분 옵션으로 직접 호출:
const result = await commands.audit(normalizeOptions({ cwd: process.cwd() }));
console.log(result.command, result.result, result.findings.length, result.schemaVersion);

// 또는 argv를 파싱해 in-process 실행하고 exit code로 분기:
const parsed = parseArgs(["audit", "--cwd", process.cwd(), "--strict"]);
await commands.audit(normalizeOptions(parsed));   // parseArgs 결과 직접 수용
const code = await run(["audit", "--cwd", process.cwd()]);  // 0 pass / 1 error / 2 blocked / 3 usage
```

- `commands`는 CLI 명령 이름(`audit`, `validate`, `graph`, …)을 키로 하는 동결(frozen) 맵입니다. 각 핸들러는 정규화된 옵션 객체를 받아 결과 객체(`{ schemaVersion, command, result, findings, … }`)로 resolve합니다. 모든 결과는 `schemaVersion`(= `SCHEMA_VERSION`)을 담고, `.text`는 항상 렌더된 텍스트 리포트입니다 — `format`은 CLI/`run()` stdout·`--out` 파일에만 영향을 주고 반환 객체는 바꾸지 않습니다.
- `normalizeOptions(overrides)`가 모든 기본값을 채우고 `cwd`를 절대경로로 해석합니다. 부분 옵션 객체는 물론 `parseArgs(argv)` 결과도 그대로 받아(`.options`를 읽음), `normalizeOptions(parseArgs(argv))`와 `normalizeOptions(parseArgs(argv).options)`가 동일하게 동작합니다. 개별 함수(`audit`, `doctor`, …)·`parseArgs`도 export됩니다.
- `run(argv)`는 전체 CLI(파싱 → 렌더)를 실행하고 숫자 exit code(`0` pass, `1` error/strict-warning, `2` blocked, `3` usage)를 **반환**합니다. `process.exitCode`도 같은 값으로 설정합니다.
- `--format json` 출력에는 부가적(additive) 최상단 `schemaVersion` 필드(export된 `SCHEMA_VERSION`과 동일)가 붙어 래퍼가 출력 계약을 pin할 수 있습니다. JSON 형태의 파괴적 변경 시에만 이 값을 올립니다.

명령 표면·`SCHEMA_VERSION`·공통 결과 필드가 안정 계약입니다 — `docs/llm-wiki/PUBLIC_API.md` 참조.

## MCP 서버 (에이전트 네이티브)

`llm-wiki mcp`는 stdio 위에서 [Model Context Protocol](https://modelcontextprotocol.io) 서버를 실행해, 에이전트(Claude Code·Cursor 등 MCP 클라이언트)가 CLI를 spawn하지 않고 위키를 툴로 질의·점검하게 합니다. 개행 구분 JSON-RPC 2.0을 Node 내장만으로 직접 구현하여(서드파티 MCP SDK 없음) 무의존성 정책을 유지합니다.

MCP 클라이언트 등록:

```json
{
  "mcpServers": {
    "llm-wiki": { "command": "npx", "args": ["-y", "@dowonk-7949/llm-wiki-standard", "mcp"] }
  }
}
```

- **읽기 전용 툴:** `validate`, `audit`, `next`, `status`, `doctor`, `stats`, `graph`, `explain`, `handoff`, `prompt`. 쓰기/변경 명령(`init`, `fix`, `migrate`, `drift`, `quickstart`)은 노출하지 않습니다 — **어떤 MCP 툴도 파일을 쓰지 않습니다.**
- 각 `tools/call`은 명령의 구조화 결과(`schemaVersion` 포함)를 `structuredContent`로, 사람용 요약을 텍스트로 반환합니다. 명령이 예외를 던지면 프로토콜 에러가 아니라 `isError: true`로 감쌉니다.
- `--cwd`는 툴 호출의 기본 프로젝트 루트이며, 툴이 자체 `cwd`를 넘길 수 있습니다. `docs/llm-wiki/PUBLIC_API.md`(MCP Server)와 `GATE_REVIEW.md`(Gate 11) 참조.

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
- 검토 이후 `source_files`/`evidence` 파일이 git에서 변경된 `verified` 문서는 `evidence.stale`로 표시해 재검토를 유도합니다. 소스가 정확한 `#Lx-Ly` evidence로만 인용된 경우 해당 라인 범위로 좁혀 검사하고, 그 외에는 파일 단위 휴리스틱입니다. best-effort이며 git 이력이 없으면 조용히 건너뜁니다. `llm-wiki drift --downgrade`로 표시된 문서를 `needs_review`로 내릴 수 있습니다.
- `rules/frontmatter.schema.json`은 required frontmatter fields, valid `status`/`visibility` values, optional `aliases`와 `evidence`, `verified` 문서의 review metadata를 정의합니다.
- `docs/llm-wiki/log.md`는 append-only이며 덮어쓰지 않습니다.
- 기존 `AGENTS.md`, `CLAUDE.md`, `ANTIGRAVITY.md` 파일은 덮어쓰지 않습니다.
- `migrate --apply`는 승인된 preview-first 범위(`GATE_REVIEW.md`, Gate 8)로 활성화되어 있습니다: `fix` 범위 + `wiki_block_version` 업그레이드를 재사용하며 `verified` 문서 내용이나 `status`는 건드리지 않습니다.
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

`release-notes`는 conventional commit을 한국어 우선 이중 언어 섹션으로 묶으며, `--since`로 특정 base부터 재생성할 수 있습니다.

```bash
npx llm-wiki release-notes --version 1.0.0 --since v0.1.8 --out docs/llm-wiki/releases/v1.0.0.md
```

검증 후 version `1.0.0`을 배포하려면 다음을 실행합니다.

```bash
git tag v1.0.0
git push origin v1.0.0
```

## 커뮤니티

- [`CONTRIBUTING.ko.md`](./CONTRIBUTING.ko.md) — 변경 제안 방법, 보수적 쓰기·`needs_review` 관례, 로컬 검증 절차.
- [`CODE_OF_CONDUCT.ko.md`](./CODE_OF_CONDUCT.ko.md) — 참여자 행동 규범.
- [`SECURITY.ko.md`](./SECURITY.ko.md) — 취약점을 비공개로 신고하는 방법.

각 문서는 영문 짝(`*.md`)이 있습니다. 이슈·PR 템플릿은 `.github/` 아래에 있습니다.

## 관련 문서

- `README.md`: 영어 README.
- `ROADMAP.md`: 제품 방향, 구현 단계, 단기 우선순위와 향후 작업 후보.
- `GATE_REVIEW.md`: stable release gate decision과 caveat.
- `VERIFICATION.md`: verification record.
- `RELEASE_CHECKLIST.md`: stable release checklist.
