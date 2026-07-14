---
title: Domain Overview
tags:
  - llm-wiki
  - verified
status: verified
doc_type: domain_overview
project: llm-wiki-standard
last_updated: 2026-07-15
author: cli-generated
last_edited_by: Claude Code
reviewed_by: WoongHwan-Kim
reviewed_at: 2026-07-15
wiki_block_version: v1
source_files:
  - src/commands.js
  - src/cli.js
  - src/mcp/tools.js
evidence:
  - src/commands.js#symbol:validateCommand
  - src/commands.js#symbol:initCommand
  - src/commands.js#symbol:nextCommand
  - src/commands.js#symbol:fixCommand
  - src/cli.js#symbol:COMMANDS
  - src/mcp/tools.js#symbol:TOOL_DEFS
related:
  - docs/llm-wiki/index.md
  - docs/llm-wiki/DOMAIN_FEATURES.md
  - docs/llm-wiki/PUBLIC_API.md
visibility: internal
contains_sensitive_info: false
---

# Domain Overview

이 문서는 `llm-wiki-standard`의 "도메인" 지도입니다. 여기서 도메인은 UI가 아니라 **명령어군/서브시스템**을 의미합니다.

## Domains

- **Diagnose (진단)** — `doctor`, `status`: 런타임/패키지 준비 상태, 초기화 여부, 문서 상태 카운트. 근거: `src/commands.js` `doctor`, `statusCommand`.
- **Validate (검증)** — `validate`, `validate-frontmatter`, `audit`: 구조/frontmatter/source_files/related/evidence/link/adapter/enrichment 스캔. `validate`는 `audit` 커버리지를 재사용한다.
- **Generate (생성)** — `init --dry-run|--write`, `quickstart`: 누락 문서와 선택 adapter 파일 생성. `--write` 명시 시에만 실제 쓰기.
- **Guide (안내)** — `handoff`, `prompt`, `next`, `explain`: 에이전트 인수인계 프롬프트, 반복 작업 프롬프트, 다음 조치 추천, finding 규칙 설명.
- **Knowledge (지식)** — `graph`, `stats`: 지식 그래프(문서→문서 링크)를 text/JSON/Mermaid/DOT로 출력, 위키 헬스 스냅샷(verified%/enrichment%/evidence coverage + 헬스 스코어). 둘 다 읽기 전용(1.4).
- **Migrate & Repair (이관·자동수정)** — `migrate [--apply]`: 기본은 이관 계획 미리보기, `--apply` 시 `fix` 범위 재사용 + `wiki_block_version` 업그레이드로 문서를 현재 계약으로 올림(`verified` 내용 보존; GATE_REVIEW Gate 8). `fix [--write]`: 승인된 좁은 범위의 안전한 자동수정(누락 Tier A frontmatter 필드, `## Evidence` 보완, 깨진 related/링크 `needs_review` 스텁, `last_updated` 갱신; 기본 미리보기). `drift [--downgrade]`: `evidence.stale` 드리프트를 리포트하고 `--downgrade` 시 드리프트된 `verified` 문서를 `needs_review`로 강등(GATE_REVIEW Gate 9). `verified` 내용·`docs/llm-wiki/` 밖은 건드리지 않는다. 근거: `src/commands.js` `fixCommand`.
- **Release (릴리스)** — `release-notes`: 마지막 `v*` 태그 이후 conventional commit을 한국어 우선 이중언어 섹션으로 묶어 릴리스 노트 문서를 생성(`--out` 시 쓰기).
- **Agent-native (에이전트 네이티브)** — `mcp`: stdio 위 Model Context Protocol 서버를 실행해 읽기 전용 명령(validate/audit/next/status/doctor/stats/graph/explain/handoff/prompt)을 MCP 툴로 노출. 무의존성(Node 내장 JSON-RPC), 쓰기 미노출(1.6, GATE_REVIEW Gate 11). 근거: `src/mcp/tools.js` `TOOL_DEFS`.

## Cross-Cutting Concerns

- **Detection** (`src/detector.js`) — package.json 신호로 project type/profile 추론.
- **Safety** — 기존 wiki/adapter 보존, `log.md` append-only, 민감정보 redaction, UTF-8 강제.
- **Reporting** (`src/report.js`) — 모든 명령이 공통 finding/summary 구조와 text/json/markdown 출력을 공유.

## Evidence

- `src/commands.js#symbol:validateCommand` — Validate 도메인의 진입점(audit 재사용).
- `src/commands.js#symbol:initCommand` — Generate 도메인의 dry-run/write 분기.
- `src/commands.js#symbol:nextCommand` — Guide 도메인의 조치 추천.
- `src/commands.js#symbol:fixCommand` — Repair 도메인의 범위 한정 자동수정.
- `src/cli.js#symbol:COMMANDS` — 전체 명령 표면(도메인 지도가 이를 반영해야 한다).
- `src/mcp/tools.js#symbol:TOOL_DEFS` — Agent-native(MCP) 도메인이 노출하는 읽기 전용 툴.

## Review Notes

- 2026-07-14에 1.3.0 명령어군과 공통 관심사를 기준으로 재검토했다.
- 2026-07-14에 도메인 지도를 현행화했다: 누락됐던 Knowledge(`graph`/`stats`, 1.4)·Release(`release-notes`)·Agent-native(`mcp`, 1.6)를 추가하고, stale했던 "migrate --apply 안정판 차단" 서술을 Gate 8(해금, preview-first) 기준으로 정정했으며, `drift`(Gate 9)를 반영했다. 사람 검토(reviewed_by: WoongHwan-Kim)를 거쳐 `verified`로 재승인했다.
