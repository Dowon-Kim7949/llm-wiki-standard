# Project Agent Guide

## Wiki <!-- wiki-block v1 -->

모든 개발 작업은 `docs/llm-wiki/index.md`에서 시작한다. 이 파일은 프로젝트 LLM-WIKI의 공식 진입점이며, 작업 전 참조 순서와 문서 상태를 안내한다.

### 필수 운영 규칙

- 모든 wiki 문서는 YAML frontmatter를 가진다.
- LLM이 새로 만들거나 수정한 문서의 `status`는 항상 `needs_review`로 둔다.
- `verified`는 사람 검토가 끝난 뒤에만 사용할 수 있다.
- 코드 또는 문서를 변경하면 관련 wiki와 `docs/llm-wiki/log.md`를 같은 작업 안에서 갱신한다.
- 민감정보는 wiki에 기록하지 않는다.
- Markdown 파일은 UTF-8로 읽고 쓴다.

## Development Notes

Project-specific notes go here.
