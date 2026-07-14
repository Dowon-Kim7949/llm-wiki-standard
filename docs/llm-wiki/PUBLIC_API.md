---
title: Public Api
tags:
  - llm-wiki
  - verified
status: verified
doc_type: public_api
project: llm-wiki-standard
last_updated: 2026-07-14
author: cli-generated
last_edited_by: Claude Code
reviewed_by: WoongHwan-Kim
reviewed_at: 2026-07-14
wiki_block_version: v1
source_files:
  - src/cli.js
  - src/commands.js
  - src/config-file.js
  - package.json
evidence:
  - src/cli.js#symbol:COMMANDS
  - src/cli.js#symbol:parseArgs
  - src/commands.js#symbol:migrateCommand
  - src/commands.js#symbol:fixCommand
  - src/config-file.js#symbol:mergeConfigIntoOptions
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
| `release-notes` | 마지막 `v*` 태그 이후 conventional commit으로 릴리스 노트 문서 생성 | `--out` 시 |

## Key Options

- `--cwd <path>`, `--type <frontend|backend|fullstack|library|mixed|unknown>`, `--profile <p>...`, `--agent <codex|claude|cursor|copilot|windsurf|gemini|jetbrains|antigravity|all>...` (`all`은 codex/claude/antigravity 세 개만 확장; 나머지는 명시 선택. writable: codex/claude/cursor/copilot/windsurf/gemini, candidate: jetbrains/antigravity)
- `--format <text|json|markdown|html>`(대부분 명령), `graph`는 `--format <text|json|mermaid|dot>`(mermaid/dot는 graph 전용). `--out <path>`, `--strict`, `--minimal`
- `--write`, `--dry-run`, `--apply` (migrate), `--downgrade` (drift), `--existing <skip|overwrite>`, `--version <x.y.z>`, `--since <git-ref>` (release-notes/validate), `--changed` (validate)

## Exit Codes

- `0` pass(그리고 `--strict`가 아니면 warning), `1` error(또는 `--strict`에서 warning), `2` blocked, `3` 사용법 오류. 근거: `src/cli.js`의 `exitCodeFor()`.

## Configuration

- 프로젝트 루트의 `llm-wiki.config.json`으로 `type`/`profiles`/`agents`/`strict`의 영속 기본값을 선언할 수 있다.
- 적용 우선순위: CLI 플래그 > config > 자동감지. 잘못된 config는 exit code `3`으로 거부된다.
- 배포물에는 포함되지 않는 저장소-로컬 설정이다(`package.json` `files` 미포함).

## Stability

- 명령 이름·JSON 출력 형태는 CI/래퍼가 의존하므로 보수적으로 유지한다.
- `migrate --apply`는 GATE_REVIEW Gate 8 범위로 활성화돼 있다(preview-first, `fix` 범위 + `wiki_block_version` 업그레이드, `verified` 내용·status 불변). `graph`/`stats`는 읽기전용이다.
- `fix`는 `GATE_REVIEW.md`의 "Autofix (--fix) Scope Decision"에 명시된 좁은 범위만 수정한다: `verified` 문서 내용·`docs/llm-wiki/` 밖 파일·`source_files`/`evidence` 값·Tier B 필드(title/doc_type/project/author)·미보강 내용은 건드리지 않는다.
- `llm-wiki.config.json` 스키마는 실사용 피드백 전까지 최소(위 4개 필드)로 유지한다.

## Evidence

- `src/cli.js#symbol:COMMANDS` — 명령 이름 → 핸들러 매핑.
- `src/cli.js#symbol:parseArgs` — 옵션/사용법 검증과 exit code 근거.
- `src/commands.js#symbol:migrateCommand` — `wiki_block_version` 업그레이드 리포트 + `--apply`(Gate 8 범위).
- `src/commands.js#symbol:fixCommand` — 범위 한정 자동수정(기본 미리보기, `--write` 적용).
- `src/config-file.js#symbol:mergeConfigIntoOptions` — config 기본값과 CLI 플래그의 병합 우선순위.

## Review Notes

- 2026-07-14에 1.3.0 CLI 명령·옵션 계약(migrate --apply, drift, 신규 --agent, OKF type alias 포함)을 기준으로 재검토하고 사람 검토(reviewed_by: WoongHwan-Kim)를 거쳐 `verified`로 재승인했다.
- 2026-07-14에 1.4.0의 새 명령(`graph`, `stats`)과 graph 전용 `--format mermaid|dot`을 반영하고, stale했던 "migrate --apply 차단" 서술을 정정한 뒤, 사람 검토(reviewed_by: WoongHwan-Kim)를 거쳐 `verified`로 재승인했다.
