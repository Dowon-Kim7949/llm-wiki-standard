---
title: Impact Measurement Baseline
tags:
  - llm-wiki
  - benchmark
  - needs-review
status: needs_review
doc_type: reference
project: llm-wiki-governance
last_updated: 2026-07-22
author: ai-generated
last_edited_by: Claude Code
reviewed_by: Dowon-Kim
reviewed_at: 2026-07-22
wiki_block_version: v1
source_files:
  - bench/run.js
  - bench/lib/strategies.js
  - bench/tasks.json
  - bench/results/baseline.json
  - bench/results/current.json
evidence:
  - bench/run.js
  - bench/lib/strategies.js#symbol:strategyWikiGrounded
  - bench/lib/strategies.js#symbol:strategyWikiRetrieval
  - bench/results/baseline.md
  - bench/results/current.md
  - GATE_REVIEW.md#section:Impact Measurement Scope Decision
related:
  - docs/llm-wiki/project-profile.md
  - GATE_REVIEW.md
  - ROADMAP.md
visibility: internal
contains_sensitive_info: false
---

# Impact Measurement Baseline

이 문서는 Gate 22(Impact Measurement, `GATE_REVIEW.md` accepted)의 결과 기록이다.
"거버넌스 코어는 실재하나 가치 사슬(durable memory → 재발견 감소 → 토큰 절감)은 아직
입증되지 않았다"는 product-identity 감사 결론에 대응해, **feature 게이트를 더 쌓기 전에**
위키가 실제로 코드 작업 컨텍스트를 줄이는지 측정하는 재현 가능·zero-dep·repo-내부
harness(`bench/`)를 만들고 베이스라인을 남긴 것이다. 이 도구는 npm `files` allowlist 밖이라
배포되지 않는다. 방법론과 한계는 [`bench/METHODOLOGY.md`](../../bench/METHODOLOGY.md), 자동
생성 결과는 [`bench/results/baseline.md`](../../bench/results/baseline.md)를 참조.

## 무엇을 쟀나 · What is measured

대표 질문 6개(detector·audit 파이프라인·config 병합·rule 토글·skill 생성·MCP)에 답하려면
관련 소스를 **찾아 읽어야** 하고, 그 읽기가 입력 컨텍스트(토큰)다. harness는 그 컨텍스트
비용의 **결정적 프록시**를 5가지 방식으로 잰다(LLM 미실행):

- **A0 whole-repo** — 모든 `src` 파일 통독(순진한 상한).
- **A1 grep-full** — 위키 없이 질문의 cold 키워드로 grep해 매칭 파일을 통독.
- **A2 grep-snippet** — 같은 grep 히트지만 매치 주변 ±40줄만 읽는 **보수적(위키에 가장 불리한)** 코드-only 하한.
- **B wiki-grounded** — 위키 오리엔테이션 문서를 먼저 읽고, 그 문서가 키워드에 대해 가리키는 evidence 포인터의 **소스**를 통독(**pre-retrieval** 위키 모델).
- **B2 wiki-retrieval** *(Gate 24)* — 소스 재독 대신 위키를 질의: `search-docs`로 검색해 상위 매칭 **문서 본문**을 `get-doc`으로 읽음. `B2 vs B`는 같은 코퍼스라 retrieval 메커니즘만 분리한다(아래 전용 절).

B의 대상 파일은 **정답 키가 아니라 위키 본문에서 파생**되므로, 위키의 evidence 포인터가
불완전하면 B는 실제로 대상 파일을 못 찾아 `success=false`가 된다(비순환·정직).

## 베이스라인 헤드라인 · Baseline (2026-07-21)

측정 대상: 소스 29파일 83,262 tokens, 오리엔테이션 6문서 12,761 tokens(세션당 1회),
전체 위키 코퍼스 47문서 67,698 tokens(작성·유지 비용, 공개하되 태스크당 미부과).
추정기: `chars/4`(절대값은 근사, arm 간 **비율**은 divisor가 상쇄되어 견고).

세션(6태스크; A0/A1/A2는 태스크마다 재독, B는 오리엔테이션 1회 후 대상만):

| arm | tokens | vs B |
| --- | ---: | ---: |
| A0 whole-repo | 499,572 | — |
| A1 grep-full | 386,912 | B = 0.59x (−41%) |
| A2 grep-snippet (보수적 하한) | 256,649 | B = 0.89x (−11%) |
| **B wiki-grounded** | **228,648** | — |

- **탐색 성공률: 위키 100% vs grep 100% 동률.** 이 레포·이 태스크에서는 grep도 정답 코드를
  찾았으므로, 베이스라인이 보여주는 위키의 이점은 **탐색(findability)이 아니라 컨텍스트
  크기**다.
- **정직한 불리 결과(요구대로 보고):** 보수적 A2 대비 **단일 태스크 3/6에서 위키가 더 비싸다**
  (config-merge +37%, skill-generation +41%, mcp-tools +43%). 위키가 큰 파일을 가리켜 통독하는데
  snippet-grep은 매치 창만 읽기 때문. 세션에서 위키가 앞서는 11%는 전적으로
  오리엔테이션 비용의 **분할상환** 덕이다 — 1~2태스크짜리 세션이면 A2가 이긴다.

## Gate 24 재측정 · Re-measurement after retrieval shipped (2026-07-21)

Gate 24(읽기 전용 retrieval, 1.18.0) 배포 후 `node bench/run.js --against bench/results/baseline.json`으로
재측정했다(baseline.json은 "before" 기준이라 덮어쓰지 않음). 결과는 **정직하게 불리**하다:

| arm | baseline (Gate 22) | 재측정 (Gate 24 후) | 이동 |
| --- | ---: | ---: | ---: |
| B vs A1 (session) | 0.59x (−41%) | 0.69x (−31%) | 이점 축소 |
| **B vs A2 (보수적 하한)** | **0.89x (−11%)** | **1.05x (+5.3%)** | **역전 — 이제 위키가 더 비쌈** |
| B wiki-grounded total | 228,648 | 294,783 | +29% |
| 오리엔테이션(1회) | 12,761 | 14,441 | 코퍼스 성장 |
| 전체 위키 코퍼스 | 47문서 67,698 | 50문서 75,512 | 성장 |

- **왜 나빠졌나:** 위키가 커지며 더 많은 소스를 가리키자, 전략 B의 **대상 소스 통독**이 늘었다(215,887→280,342).
  A2는 매치 창만 읽으므로, 위키가 성장할수록 "대상 파일을 통독하는" B 모델은 보수적 하한 대비 상대적으로 불리해진다.
- **핵심(정직):** 이 재측정은 **retrieval 메커니즘이 아니라 코퍼스 드리프트**를 잰 것이다. harness의 전략 B는
  대상 **소스**를 통독할 뿐 Gate 24의 `get_doc`/`search_docs`를 **호출하지 않는다**. 즉 raw 재실행만으로는 로드맵이 원한
  **"retrieval 전/후 델타"를 만들 수 없다.** 이를 위해 아래의 retrieval-aware 전략 `B2_retrieval`을 추가했다(다음 절).
- **재측정 결론:** raw 재실행만으로는 Gate 24의 가치를 보일 수 없다(오히려 드리프트로 불리하게 보인다). retrieval 델타는
  아래 `B2_retrieval` 절에서 측정한다. README/런치 토큰·속도 주장은 그 측정이 나온 뒤에도 **여전히 금지**다(아래 규율 — 실제 LLM 실측 전까지).

## B2 retrieval 델타 · Retrieval mechanism, measured (2026-07-21)

위 재측정이 드리프트만 보이는 문제를 풀기 위해 harness에 다섯 번째 arm **`B2_retrieval`**을 추가했다. B2는 Gate 24
메커니즘을 그대로 모델링한다: 소스를 다시 읽는 대신 **위키를 질의**한다 — 배포된 `search-docs`(zero-dep 키워드/AND,
`src/commands/retrieval.js`와 **동일 스코어링**)를 돌리고 상위 매칭 **문서 본문**을 `get-doc`으로 읽는다(소스 재독 없음).
append-only `log.md`는 검색은 되지만 get-doc하지 않는다(체인지로그이지 서브시스템 설명이 아님 — 명시). B2가 읽는 문서 수는
공개 파라미터 `retrievalGetDocs`(기본 2)다.

**핵심: B2와 B는 같은 코퍼스·같은 태스크에서 돌므로, `B2 vs B`는 코퍼스 드리프트를 상쇄하고 retrieval 메커니즘만 분리한다**
— raw `--against`가 못 하던 바로 그 "전/후 델타"다.

현재 실행(소스 30파일 91,555 tokens, 위키 50문서 ~77k tokens; 정확 수치·태스크별 표는 자동 생성
[`bench/results/current.md`](../../bench/results/current.md)):

| arm | session tokens | vs B2 |
| --- | ---: | ---: |
| A0 whole-repo | 549,330 | — |
| A1 grep-full | 425,138 | — |
| A2 grep-snippet (보수적 하한) | 280,064 | — |
| B wiki-grounded (pre-retrieval, 소스 통독) | 294,783 | — |
| **B2 wiki-retrieval (Gate 24)** | **54,586** | — |

- **B2 vs B = 0.19× (−81.5%)** — retrieval 델타(같은 코퍼스, 드리프트 상쇄). 위키 본문을 읽는 게 위키가 가리키는 소스를
  통독하는 것의 약 1/5 비용이다. **이것이 메커니즘 자체의 효과**다.
- **B2 vs A2 = 0.19× (−80.5%)** — retrieval은 보수적 snippet-grep 하한도 이긴다. pre-retrieval arm B는 이 하한에 **졌었다**
  (1.05×). 즉 토큰 이점이 "통독 대비"에서 "규율 있는 snippet 읽기 대비"로 넘어왔다.
- **B2 grounding success = 100%** — 6/6 태스크에서 상위 매칭 문서 본문이 ground-truth 소스를 **모두 참조**했다(에이전트를
  코드를 열지 않고도 정확한 파일로 grounding). 민감도: **K=1**(최상위 1문서만)에서도 100%이고 토큰 이점은 더 크다 —
  기본 K=2는 더 비싼·보수적 선택이다.
- **정직 caveat(범위):** B2의 success는 **grounding 프록시**(위키가 올바른 코드를 가리키고 설명함)이지, 에이전트가 소스를
  전혀 안 열고 수정을 끝낸다는 뜻이 아니다. 최종 편집은 여전히 그 한 파일을 열 수 있다 — B2는 위키가 없애 주는 **재발견/오리엔테이션
  비용**을 재는 것이지 작업 전체가 아니다. 또한 `chars/4` 프록시·단일 자기참조 레포·top-K 순진 랭킹은 [`bench/METHODOLOGY.md`](../../bench/METHODOLOGY.md)
  §8의 한계 그대로다.
- **결론:** raw 재실행이 드리프트로 불리해 보였던 것과 달리, retrieval을 **직접 모델링하면** 큰(−80% 규모) 토큰 감소가 정직하게
  드러난다. 그럼에도 이는 결정적 토큰 프록시이지 실제 LLM 실측이 아니므로 README/런치 토큰·속도 주장은 **여전히 금지**다.

## 실측 · Real-LLM measurement (external project, N=3, 2026-07-22)

`chars/4` 프록시를 넘어 **실제 LLM 실행**으로 처음 측정했다. 대상은 외부 대표 프로젝트
`csap-roadkeeper-frontend`(Vue3/Quasar, 브랜치 `aws-global`; 위키는 1.19로 구축·0% verified),
드라이버는 Claude Code Explore 서브에이전트(**Opus 4.8**), 6개 cold-keyword 코드이해 태스크
× 2 arm(B=소스만, B2=위키 retrieval) × **N=3**. 서브에이전트별 실제 토큰·wall-clock을 캡처했다
(단일 total 토큰; 프로덕트 MCP가 아닌 CLI `search-docs`/`get-doc` 경로). **csap 저장소는 무변경**
(위키 드리프트 수정본은 job tmp의 스크래치 복사본에서만).

- **최신(de-drifted) 위키, N=3:** B2 = 0.90× 토큰(**−10%**), 0.95× wall(−5%), **정확도 18/18 동률**,
  B2는 **전부 위키만으로 응답(소스 fallback 0)**. 태스크 의존적: auth 0.76×·hazard 0.67× 승,
  routing 1.17× 패(소스가 파일 2개뿐), api/session/state ≈ 무승부. B2가 B보다 변동이 작다.
- **stale(as-built 1.19) 위키:** B2가 보안상 **오답**(로그인 비밀번호 평문이라 주장; 실제 aws-global
  소스는 RSA-OAEP 클라이언트 암호화)을 냈고, hazard 문서 드리프트로 소스 fallback 발생 → B2 5/6.
  두 드리프트 모두 이 도구가 `evidence.stale`/`source_files.missing`로 잡는 조건이었다.

**정직한 결론:** retrieval의 토큰 이득은 **실재하나 modest·태스크 의존**(−10%)이다. **결정적 가치는
효율이 아니라 신선도-종속 정확도** — stale 위키는 자신 있게 오답을 내고, 문서 최신화로 18/18 회복.
즉 verify·drift·`validate --changed` 거버넌스가 retrieval의 신뢰를 만든다. 상세·원자료:
`bench/results/real-driver-csap-aws-global-pilot-2026-07-22.md`.

## 한계 · Caveats

- `chars/4`는 실제 토크나이저가 아니다(절대값 근사). 벽시계 시간·답변 품질은 미측정 →
  더 무거운 LLM 실측이 후속(별도). 위키 **유지 비용**은 공개했으나 모델링하지 않았다.
- 단일·자기참조 레포(성숙한 evidence 링크 위키)라 더 크거나 얇거나 낡은 위키로 일반화 불가.
- **핵심 caveat(순서):** "재발견 감소" 메커니즘은 retrieval(Gate 24)에서 완성된다. 그 전에 잰
  베이스라인은 modest한 게 정상이며, 로드맵 헤드라인은 raw 베이스라인이 아니라
  **retrieval 전/후 델타**다. 이후 게이트마다 `node bench/run.js --against`로 재측정한다.

## 규율 · Governance

- **2026-07-22 실측 이후 갱신된 규율:** 이제 실제 LLM **N=3** 측정이 존재하므로 README/포지셔닝에
  **스코프를 명시한 정직한 수치**는 허용한다 — 단 **볼드 헤드라인은 금지**한다(−10% 평균에 한 태스크는
  +17%, 단일 에이전트[Opus 4.8]·단일 레포·6 태스크·total-token 프록시). 항상 **정확도-동률 + 신선도-종속**을
  앞세우고 수치엔 조건(N=3, 모델, 레포)을 붙인다. `chars/4` 프록시 수치(−81.5% 등)를 README에 싣는 것은
  계속 금지(프록시이지 실측 아님).
- 이 문서는 에이전트(Claude Code)가 작성했으므로 `needs_review`다 — 사람 검토 후 `verified`.

## Evidence

- `bench/run.js` — harness 오케스트레이터(5개 arm 실행·세션 집계·정직 verdict; current.* 기록, baseline.*는 frozen).
- `bench/lib/strategies.js#symbol:strategyWikiGrounded` — B arm: 위키 본문에서 대상 소스를 파생해 소스 통독(pre-retrieval, 비순환).
- `bench/lib/strategies.js#symbol:strategyWikiRetrieval` — B2 arm: `search-docs`(동일 스코어링) + 상위 매칭 문서 본문 `get-doc`(소스 재독 없음); B2 vs B가 드리프트를 상쇄한 retrieval 델타.
- `bench/results/baseline.md` — frozen Gate 22 before-retrieval 결과표.
- `bench/results/current.md` — 현재 실행(B2 포함) 자동 생성 결과표.
- `GATE_REVIEW.md#section:Impact Measurement Scope Decision` — 수용된 Gate 22 범위·불변식·수용 기준.

## Review Notes

- 2026-07-22에 Gate 22 베이스라인 + Gate 24 재측정(정직/불리) + B2 retrieval 델타를 사람 검토(reviewed_by: Dowon-Kim, reviewed_at: 2026-07-22)를 거쳐 `verified`로 승인했다(최초 verified 승격). **핵심 불변 조건**: 이 문서의 모든 수치(특히 B2 −81.5%/−80.5%)는 `chars/4` **프록시**이지 실제 LLM 실행 결과가 아니다. 따라서 README·런치 카피에 토큰/속도/생산성 수치를 싣는 것은 **여전히 금지**이며, 실측(`bench/real/` 실행)이 뒷받침될 때까지 이 규율을 유지한다. 실측 방법은 `bench/REAL_LLM_METHODOLOGY.md` 참조.
- 2026-07-22에 **실제 LLM N=3 실측**(외부 프로젝트 `csap-roadkeeper-frontend`@`aws-global`, Opus 4.8)을 반영했다: "실측 · Real-LLM measurement" 섹션 추가(최신 위키에서 B2 −10% 토큰·−5% wall·정확도 18/18 동률·소스 fallback 0; stale 위키는 보안 오답 → 신선도-종속 정확도가 핵심)와 규율 갱신(스코프 명시 정직 수치 허용, 볼드 헤드라인·`chars/4` 프록시 수치는 계속 금지). 원자료: `bench/results/real-driver-csap-aws-global-pilot-2026-07-22.md`. 에이전트(Claude Code) 편집이라 `needs_review`로 강등 — 사람 검토 후 재승인 예정.
