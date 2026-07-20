---
title: LLM-WIKI README
tags:
  - llm-wiki
  - verified
status: verified
doc_type: wiki_readme
project: llm-wiki-standard
last_updated: 2026-07-20
author: cli-generated
last_edited_by: Claude Code
reviewed_by: Dowon-Kim
reviewed_at: 2026-07-20
wiki_block_version: v1
source_files:
  - package.json
  - README.md
evidence:
related:
  - docs/llm-wiki/index.md
  - docs/llm-wiki/project-profile.md
  - docs/llm-wiki/log.md
visibility: internal
contains_sensitive_info: false
---

# LLM-WIKI README

이 디렉터리는 `llm-wiki-standard` 저장소의 지식·의사결정·작업 규칙을 LLM과 개발자가 함께 참조하기 위한 공간입니다. 이 wiki는 패키지가 제공하는 CLI를 저장소 자신에게 적용한 dogfooding 결과입니다.

## Entry Point

- 시작점은 [index.md](index.md)이며 권장 읽기 순서를 안내합니다.
- 사용자 대상 설치/사용 안내는 저장소 루트 `README.md`를, 릴리스 게이트는 `GATE_REVIEW.md`를, 방향성은 `ROADMAP.md`를 참조하세요.
- 초급자와 팀원을 위한 설명 자료는 [LLM-WIKI 팀 공유 프레젠테이션](../../outputs/llm-wiki-team-introduction-v1.5.1.pptx)을 참조하세요.
- 루트의 외부 공개 문서는 영문 `.md`(정본)와 국문 `.ko.md`를 쌍으로 유지합니다: `README`, `CHANGELOG`, `ROADMAP`. 두 파일 상단에 `> Language:` 상호링크를 두고, 새 `.ko.md`는 `package.json` `files`에 등록하며, 한쪽을 고치면 짝도 함께 갱신합니다.
- 루트 `README.md`/`README.ko.md`는 사용자용이라 LLM-WIKI frontmatter를 두지 않고, `ROADMAP`은 frontmatter를 두며 국문본이 이를 미러링합니다. 이들 루트 문서는 `docs/llm-wiki/` 밖이라 `validate`/`validate-frontmatter` 스캔 대상이 아닙니다.

## Operating Rules

- 모든 wiki 문서는 YAML frontmatter를 가집니다.
- CLI 또는 에이전트가 생성/수정한 문서는 `needs_review` 상태를 유지합니다.
- 민감정보 raw value는 기록하지 않습니다.
- 변경 기록은 [log.md](log.md)에 append-only로 남깁니다.
- 문서가 아직 보강되지 않으면 `llm-wiki validate`가 `content.not_enriched`로 표시합니다.
