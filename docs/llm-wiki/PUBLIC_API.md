---
title: Public Api
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: public_api
project: llm-wiki-standard
last_updated: 2026-07-10
author: cli-generated
last_edited_by: Claude Code
wiki_block_version: v1
source_files:
  - src/cli.js
  - src/commands.js
  - package.json
evidence:
  - src/cli.js#symbol:COMMANDS
  - src/cli.js#symbol:parseArgs
  - src/commands.js#symbol:migrateCommand
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
| `init --dry-run\|--write` | 누락 wiki 문서·선택 adapter 생성 | `--write` 시 |
| `migrate --dry-run` | 이관 계획 미리보기(`--apply`는 차단) | 없음 |

## Key Options

- `--cwd <path>`, `--type <frontend|backend|fullstack|library|mixed|unknown>`, `--profile <p>...`, `--agent <codex|claude|cursor|copilot|antigravity|all>...` (`all`은 codex/claude/antigravity 세 개만 확장; cursor·copilot은 명시 선택)
- `--format <text|json|markdown>`, `--out <path>`, `--strict`, `--minimal`
- `--write`, `--dry-run`, `--existing <skip|overwrite>`

## Exit Codes

- `0` pass(그리고 `--strict`가 아니면 warning), `1` error(또는 `--strict`에서 warning), `2` blocked, `3` 사용법 오류. 근거: `src/cli.js`의 `exitCodeFor()`.

## Stability

- 명령 이름·JSON 출력 형태는 CI/래퍼가 의존하므로 보수적으로 유지한다.
- `migrate --apply`는 자동 변경 범위가 합의될 때까지 의도적으로 차단 상태다.

## Evidence

- `src/cli.js#symbol:COMMANDS` — 명령 이름 → 핸들러 매핑.
- `src/cli.js#symbol:parseArgs` — 옵션/사용법 검증과 exit code 근거.
- `src/commands.js#symbol:migrateCommand` — `--apply` 차단 정책.

## Review Notes

- 사람 검토 전까지 `needs_review`를 유지한다.
