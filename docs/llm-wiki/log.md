---
title: LLM-WIKI Change Log
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: change_log
project: llm-wiki-standard
last_updated: 2026-07-10
author: cli-generated
last_edited_by: llm-wiki-cli
wiki_block_version: v1
source_files:
  - package.json
evidence:

related:
  - docs/llm-wiki/index.md
visibility: internal
contains_sensitive_info: false
---

# LLM-WIKI Change Log

이 문서는 append-only 변경 로그입니다. 기존 항목은 수정하지 말고 새 변경 사항을 위에 추가합니다.

## 2026-07-10 - release-notes --since 옵션 추가

- status: needs_review
- actor: Claude Code
- scope: code
- changed:
  - src/release-notes.js, src/commands.js, src/cli.js, tests/verification.test.js
- summary:
  - `release-notes --since <git-ref>` 추가. 범위를 `<ref>..HEAD`로 강제해, 태그 생성 후에도 특정 기준점부터 노트를 재생성할 수 있다. `collectCommitsSinceLastTag`를 `collectCommits(cwd, { since })`로 일반화.
- evidence:
  - src/release-notes.js
- caveats:
  - `--since`는 `<ref>..HEAD` 범위이므로, 과거 버전을 정확히 재현하려면 태그 이후 커밋이 섞이지 않도록 주의한다.

## 2026-07-10 - 릴리스 노트 한국어·영어 이중 언어화

- status: needs_review
- actor: Claude Code
- scope: code + docs
- changed:
  - src/release-notes.js, src/cli.js, tests/verification.test.js
  - docs/llm-wiki/releases/v0.1.7.md
- summary:
  - `release-notes` 생성 골격(제목·안내문·섹션 헤더·폴백)을 한국어 우선 이중 언어(예: `## 추가 · Added`)로 변경. 커밋에서 온 항목은 소스 그대로 유지한다.
- evidence:
  - src/release-notes.js
- caveats:
  - 릴리스 노트는 태그 생성 "전"에 만들어야 한다(태그 생성 후에는 "마지막 v* 태그 이후"가 비어 v0.1.7 노트는 수동 복원함).

## 2026-07-10 - release-notes 명령 추가 (docs-sync)

- status: needs_review
- actor: Claude Code
- scope: code + docs
- changed:
  - src/release-notes.js (신규), src/commands.js, src/cli.js, src/report.js, tests/verification.test.js
  - docs/llm-wiki/PUBLIC_API.md
- summary:
  - `llm-wiki release-notes [--version x.y.z] [--out]` 명령 추가. 마지막 `v*` 태그 이후 conventional commit을 Added/Changed/Fixed/Documentation/Other로 분류해 needs_review 릴리스 노트 문서를 생성. git 없으면 채워 넣기용 스캐폴드로 폴백.
- evidence:
  - src/release-notes.js
- caveats:
  - chore/release 타입 커밋은 노트에서 제외한다. README 반영은 다음 릴리스 시점.

## 2026-07-10 - llm-wiki.config.json 지원 추가 (docs-sync)

- status: needs_review
- actor: Claude Code
- scope: code + docs + config
- changed:
  - src/config-file.js (신규), src/cli.js, src/commands.js, tests/verification.test.js
  - llm-wiki.config.json (저장소 dogfooding: type=library)
  - docs/llm-wiki/GLOSSARY.md, docs/llm-wiki/PUBLIC_API.md
- summary:
  - 프로젝트 루트 `llm-wiki.config.json`으로 `type`/`profiles`/`agents`/`strict` 기본값을 선언하도록 지원. CLI 플래그 > config > 자동감지 우선순위. 잘못된 config는 exit 3.
  - doctor가 config 존재 여부를 보고. 스키마는 보수적으로 최소 4개 필드만.
- evidence:
  - src/config-file.js
- caveats:
  - 스키마 확장(커스텀 문서세트/규칙/템플릿 override)은 실사용 피드백 이후 결정한다.
  - README.md/README.ko.md 반영은 다음 릴리스 시점.

## 2026-07-10 - Cursor/Copilot adapter 추가 (docs-sync)

- status: needs_review
- actor: Claude Code
- scope: code + docs
- changed:
  - src/commands.js, src/cli.js, tests/verification.test.js
  - templates/adapters/cursor/llm-wiki.mdc, templates/adapters/copilot/copilot-instructions.md
  - docs/llm-wiki/GLOSSARY.md, docs/llm-wiki/PUBLIC_API.md
- summary:
  - Cursor(`.cursor/rules/llm-wiki.mdc`)·GitHub Copilot(`.github/copilot-instructions.md`) adapter를 추가하고 handoff를 adapter 기반으로 일반화했다.
  - `--agent all`은 backward-compat을 위해 codex/claude/antigravity 세 개만 유지하고, cursor·copilot은 명시 선택하도록 했다.
- evidence:
  - src/commands.js
- caveats:
  - README.md/README.ko.md의 adapter·옵션 표기 갱신은 다음 릴리스 시점에 함께 반영한다.

## 2026-07-10 - detector 다중 생태계 지원 반영 (docs-sync)

- status: needs_review
- actor: Claude Code
- scope: code + docs
- changed:
  - src/detector.js, src/commands.js, tests/verification.test.js
  - docs/llm-wiki/DOMAIN_FEATURES.md
- summary:
  - detector가 Python/Go/Rust/JVM 매니페스트를 인식하도록 확장하고, 생성 문서의 기본 source_files를 감지된 primaryManifest로 앵커링했다.
- evidence:
  - src/detector.js
- caveats:
  - Go/Python의 stdlib 기반 서버는 프레임워크 신호가 없으면 library로 분류될 수 있다(향후 개선 후보).

## 2026-07-10 - core/library 문서 소스 근거로 보강 (dogfooding)

- status: needs_review
- actor: Claude Code
- scope: docs
- changed:
  - docs/llm-wiki/index.md, README.md, project-profile.md
  - docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md, GLOSSARY.md
  - docs/llm-wiki/DOMAIN_FEATURES.md, domains/00_overview.md
  - docs/llm-wiki/PUBLIC_API.md, VERSIONING.md, EXAMPLES.md, RELEASE_FLOW.md
  - docs/llm-wiki/profiles/library.md
- summary:
  - 생성 스캐폴드의 placeholder를 실제 소스 근거(src/*, package.json)로 교체했다.
  - frontmatter `project`를 `llm-wiki-standard`로 교정하고 source_files/evidence/`## Evidence` 섹션을 채웠다.
- evidence:
  - src/cli.js
  - src/commands.js
  - package.json
- caveats:
  - templates/ 하위 문서는 의도적 템플릿이라 보강하지 않았다.
  - 모든 문서는 사람 검토 전까지 needs_review로 유지한다.

## 2026-07-10 - LLM-WIKI 초기 문서 생성

- status: needs_review
- actor: llm-wiki-cli
- scope: docs
- changed:
  - docs/llm-wiki/
- summary:
  - `llm-wiki init --write` 명령으로 초기 LLM-WIKI 문서 구조를 생성했다.
- evidence:
  - package.json
- caveats:
  - CLI 생성 초안이므로 사람 검토가 필요하다.

