// Zero-dependency localization for human-facing findings prose (Gate 27, P4).
//
// Only PROSE is localized: finding `message` strings and the FINDING_EXPLANATIONS
// registry's `meaning`/`whyItMatters`/`remediation` rendered by `explain`. Rule
// IDs, all `--format json` keys + its SHAPE, category names, config keys,
// command/option names, evidence-locator syntax, the CLI commands in
// `commands`/`related`, and file paths stay English (frozen 1.0.0 contract).
//
// The default `en` path NEVER routes through this module (callers guard on
// `normalizeLang(lang) === "en"`), so English output stays byte-identical. A
// missing KO key falls back to the caller's English source string, never blank.

export const DEFAULT_LANG = "en";
export const SUPPORTED_LANGS = ["en", "ko"];

// Maps any input (CLI flag, config, undefined) to a supported language, defaulting
// to English. Keeps the "unset -> en" resolution in one place.
export function normalizeLang(lang) {
  return SUPPORTED_LANGS.includes(lang) ? lang : DEFAULT_LANG;
}

// `{name}` interpolation. An unknown placeholder is left verbatim; a param whose
// value is null/undefined renders as an empty string.
function interpolate(template, params) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key) => {
    if (!Object.prototype.hasOwnProperty.call(params, key)) return whole;
    const value = params[key];
    return value == null ? "" : String(value);
  });
}

// Returns a localized finding message, or null when nothing localizes (the caller
// keeps the finding's English `message`). Only `ko` localizes today.
export function localizeMessage(messageId, params, lang) {
  if (normalizeLang(lang) === "en" || !messageId) return null;
  const table = MESSAGE_CATALOG[normalizeLang(lang)];
  const template = table && table[messageId];
  if (template == null) return null;
  return interpolate(template, params);
}

// Localizes one finding: returns a new finding with a localized `message`, or the
// same finding reference when nothing localizes. Pure; safe to call repeatedly.
export function localizeFinding(finding, lang) {
  if (!finding || normalizeLang(lang) === "en") return finding;
  // A finding opts into localization by carrying an explicit `messageId`, or
  // implicitly by its `rule` when the catalog has a matching key. Catalog keys are
  // therefore an allowlist: only rules whose message is single-shape across the
  // codebase belong here (verified via the `frontmatter.verified_review[.strict]`
  // split, which uses an explicit messageId to keep the two variants distinct).
  const key = finding.messageId ?? finding.rule;
  const localized = localizeMessage(key, finding.params, lang);
  return localized == null ? finding : { ...finding, message: localized };
}

// Merges localized `meaning`/`whyItMatters`/`remediation` over an English
// FINDING_EXPLANATIONS entry. `commands` (CLI examples), `relatedRules` (rule IDs),
// `category`, and `defaultSeverity` stay English. Returns the entry unchanged for
// `en` or when no KO entry exists (per-field EN fallback).
export function localizeExplanation(rule, explanation, lang) {
  if (!explanation || normalizeLang(lang) === "en") return explanation;
  const table = EXPLANATION_CATALOG[normalizeLang(lang)];
  const ko = table && table[rule];
  if (!ko) return explanation;
  return {
    ...explanation,
    meaning: ko.meaning ?? explanation.meaning,
    whyItMatters: ko.whyItMatters ?? explanation.whyItMatters,
    remediation: ko.remediation ?? explanation.remediation
  };
}

// Localized finding `message` templates, keyed by a finding's `messageId`
// (v1: the finding families surfaced by validate/audit/status/next — scans,
// frontmatter, structure). Operational/edge messages intentionally fall back to
// English until localized in a follow-up.
const MESSAGE_CATALOG = {
  ko: {
    // encoding
    "encoding.bom": "UTF-8 BOM이 감지되었습니다.",
    "encoding.mojibake": "Mojibake로 보이는 지표가 감지되어 자동 재작성을 건너뜁니다.",
    // source_files / related / links
    "source_files.missing": "source_files 항목이 존재하지 않습니다: {source}.",
    "related.missing": "related 항목이 존재하지 않습니다: {target}.",
    "markdown_link.missing": "Markdown 링크 대상이 존재하지 않습니다: {link}.",
    // content
    "content.not_enriched": "문서에 아직 생성 시 placeholder 안내가 남아 있고 소스 기반 내용으로 보강되지 않았습니다.",
    "content.thin_body": "문서 본문의 프로즈가 {words}단어뿐입니다(최소 {min}); 소스 기반 내용으로 보강하세요.",
    // visibility
    "visibility.public_sensitive": "public 문서에 민감해 보이는 값이 {count}개 있습니다(값 생략). redact하거나 visibility를 낮추세요.",
    "visibility.declared_mismatch": "문서가 contains_sensitive_info: false로 선언했지만 민감해 보이는 값이 {count}개 발견되었습니다(값 생략).",
    // evidence
    "evidence.shape": "잘못된 evidence 참조: {reference}.",
    "evidence.missing": "evidence 소스가 존재하지 않습니다: {source}.",
    "evidence.line_range": "evidence 라인 범위가 {source}를 벗어납니다: {start}-{end}(파일은 {lineCount}줄).",
    "evidence.symbol_unverified": "evidence 심볼이 {source}에 언급되지 않습니다: {value}.",
    "evidence.section_unverified": "evidence 섹션 헤딩을 {source}에서 찾을 수 없습니다: {value}.",
    "evidence.section_missing": "문서에 frontmatter evidence 항목이 있지만 본문 ## Evidence 섹션이 없습니다.",
    "evidence.section_empty": "본문 ## Evidence 섹션에는 최소 한 개의 불릿 항목이 있어야 합니다.",
    "evidence.section_unlisted": "frontmatter evidence 항목이 본문 ## Evidence에 언급되지 않았습니다: {reference}.",
    "evidence.ungrounded": "verified 문서에 source_files도 evidence도 없습니다(grounding 없는 verified).",
    "evidence.stale": "verified 문서가 {reference}를 참조하는데 {baseline} 이후 변경되었습니다; 재검토·갱신하거나 needs_review로 강등하세요.",
    // impact
    "impact.source_changed": "verified 문서가 {sources}에 의존하는데 이번 diff에서 변경되었지만 문서 자신은 변경되지 않았습니다; 재검토·갱신하거나 needs_review로 강등하세요.",
    // okf
    "okf.type_required": "OKF v0.1 프로필은 frontmatter 필드 type을 요구합니다.",
    "okf.type_shape": "OKF v0.1 frontmatter 필드 type은 문자열이어야 합니다.",
    "okf.array_shape": "OKF v0.1 frontmatter 필드 {field}는 존재할 경우 배열이어야 합니다.",
    // frontmatter
    "frontmatter.exists": "YAML frontmatter가 필요합니다.",
    "frontmatter.required": "필수 필드가 누락되었습니다: {field}.",
    "frontmatter.status": "잘못된 status: {status}.",
    "frontmatter.last_updated": "last_updated는 YYYY-MM-DD 형식이어야 합니다.",
    "frontmatter.array": "{field}는 배열이어야 합니다.",
    "frontmatter.visibility": "예상치 못한 visibility: {visibility}.",
    "frontmatter.contains_sensitive_info": "contains_sensitive_info는 boolean이어야 합니다.",
    "frontmatter.verified_review": "verified 문서는 팀이 해당 정책을 채택하면 reviewed_by와 reviewed_at을 포함해야 합니다.",
    "frontmatter.verified_review.strict": "strict 모드에서 verified 문서는 reviewed_by와 reviewed_at을 반드시 포함해야 합니다.",
    // structure
    "structure.wiki_missing": "LLM-WIKI가 초기화되지 않았습니다; 그대로 진행할지 아니면 먼저 init --write를 실행할지 사용자에게 확인하세요.",
    "structure.required_doc": "필수 또는 프로필 권장 LLM-WIKI 문서가 누락되었습니다.",
    "structure.output_gitignored": "docs/llm-wiki가 git에서 무시됩니다; 생성된 문서가 만들어졌지만 추적되지 않습니다. 무시 규칙을 제거하거나 git add -f docs/llm-wiki를 실행하세요."
  }
};

// Localized `explain` prose (meaning/whyItMatters/remediation), keyed by rule ID.
// Mirrors every FINDING_EXPLANATIONS entry. `commands`/`relatedRules` stay English.
const EXPLANATION_CATALOG = {
  ko: {
    "structure.wiki_missing": {
      meaning: "프로젝트에 docs/llm-wiki/index.md가 없어 LLM-WIKI가 초기화되지 않았습니다.",
      whyItMatters: "에이전트와 CI는 문서 계약을 따르기 전에 안정적인 위키 진입점이 필요합니다.",
      remediation: ["지금 프로젝트를 초기화할지 사용자에게 확인하세요.", "파일을 미리 보려면 먼저 init --dry-run을 실행하세요.", "누락된 위키 구조를 생성할 준비가 되면 init --write를 실행하세요."]
    },
    "structure.required_doc": {
      meaning: "필수 코어·프로젝트 유형·프로필 문서 중 하나가 누락되었습니다.",
      whyItMatters: "필수 문서가 없으면 에이전트가 기대하는 프로젝트·도메인·API·프로필 컨텍스트를 얻지 못합니다.",
      remediation: ["finding에 보고된 경로를 확인하세요.", "status를 needs_review로 하여 문서를 생성하세요.", "적절할 때 init --write로 누락된 표준 템플릿을 생성하세요."]
    },
    "structure.output_gitignored": {
      meaning: "위키 출력 경로(docs/llm-wiki)가 git에서 무시되어, 생성된 문서가 만들어져도 추적되지 않습니다.",
      whyItMatters: "추적되지 않는 위키 문서는 팀원·코드 리뷰·CI에 보이지 않습니다 — 파일이 로컬에만 있고 저장소에는 조용히 반영되지 않습니다.",
      remediation: [".gitignore에서 docs/ 또는 docs/llm-wiki를 덮는 규칙이 있는지 확인하세요.", "그 규칙을 제거·축소하거나 git add -f docs/llm-wiki로 위키를 강제 추가하세요.", "git status로 문서가 추적되는지 확인하세요."]
    },
    "frontmatter.exists": {
      meaning: "마크다운 파일이 YAML frontmatter 펜스로 시작하지 않습니다.",
      whyItMatters: "frontmatter가 없으면 LLM-WIKI 도구가 status·소스 근거·visibility·리뷰 메타데이터를 검증할 수 없습니다.",
      remediation: ["파일 맨 위에 YAML frontmatter 블록을 추가하세요.", "필수 LLM-WIKI 필드를 모두 포함하세요.", "frontmatter 검증을 다시 실행하세요."]
    },
    "frontmatter.required": {
      meaning: "마크다운 파일에 필수 LLM-WIKI frontmatter 필드 중 하나가 누락되었습니다.",
      whyItMatters: "필수 메타데이터는 문서를 검색·리뷰 가능하고 자동화에 안전하게 유지합니다.",
      remediation: ["보고된 마크다운 파일을 여세요.", "finding에 표시된 누락 필드를 추가하세요.", "AI가 만들거나 편집한 문서는 사람 검토 전까지 status needs_review로 유지하세요."]
    },
    "frontmatter.parse": {
      meaning: "지원되는 LLM-WIKI 서브셋으로 frontmatter 블록을 파싱할 수 없습니다.",
      whyItMatters: "잘못된 메타데이터는 신뢰할 수 있는 검증과 리포트 생성을 막습니다.",
      remediation: ["보고된 라인에서 지원되지 않는 문법을 확인하세요.", "지원되는 YAML 서브셋의 단순 스칼라 값이나 리스트 항목을 사용하세요.", "validate-frontmatter를 다시 실행하세요."]
    },
    "frontmatter.array": {
      meaning: "리스트여야 하는 필드가 스칼라 값으로 제공되었습니다.",
      whyItMatters: "tags·source_files·related·aliases 같은 필드는 도구와 에이전트를 위해 안정적인 리스트 형태가 필요합니다.",
      remediation: ["보고된 필드를 YAML 리스트로 다시 쓰세요.", "앞에 대시를 붙여 한 줄에 한 항목씩 쓰세요.", "validate-frontmatter를 다시 실행하세요."]
    },
    "frontmatter.status": {
      meaning: "문서 status가 지원되는 LLM-WIKI status 값 중 하나가 아닙니다.",
      whyItMatters: "status 값은 리뷰 워크플로를 이끌고 AI 생성 콘텐츠가 너무 일찍 verified로 취급되는 것을 막습니다.",
      remediation: ["needs_review·in_progress·verified·deprecated 같은 지원되는 status를 사용하세요.", "생성되었거나 최근 편집된 문서는 needs_review를 사용하세요.", "validate-frontmatter를 다시 실행하세요."]
    },
    "frontmatter.verified_review": {
      meaning: "verified 문서에 리뷰 메타데이터가 없습니다.",
      whyItMatters: "verified 문서는 특히 strict CI에서 누가 언제 검토했는지 밝혀야 합니다.",
      remediation: ["문서가 실제로 검토되었을 때 reviewed_by와 reviewed_at을 추가하세요.", "검토가 안 됐다면 status를 needs_review로 낮추세요.", "경고를 CI 실패로 만들려면 --strict를 사용하세요."]
    },
    "source_files.missing": {
      meaning: "source_files 항목이 존재하지 않는 로컬 파일을 가리킵니다.",
      whyItMatters: "LLM-WIKI 주장은 실제 소스 근거나 명시적 외부 참조로 추적 가능해야 합니다.",
      remediation: ["참조된 소스 파일이 이동했다면 경로를 고치세요.", "더 이상 문서를 뒷받침하지 않는 오래된 항목을 제거하세요.", "소스가 저장소 밖일 때만 명시적 외부 URL을 사용하세요."]
    },
    "evidence.shape": {
      meaning: "evidence 항목이 지원되는 참조 형태와 일치하지 않습니다.",
      whyItMatters: "evidence 참조는 파일·라인 범위·심볼·섹션·라우트를 가리킬 수 있게 작고 기계 검증 가능해야 합니다.",
      remediation: ["file, file#L10, file#L10-L20, file#symbol:Name, file#section:Heading, file#route:/path 형식을 사용하세요.", "더 풍부한 프로즈는 frontmatter 항목이 아니라 문서 본문에 두세요.", "validate를 다시 실행하세요."]
    },
    "evidence.missing": {
      meaning: "evidence 항목이 존재하지 않는 로컬 파일을 가리킵니다.",
      whyItMatters: "정밀한 evidence는 프로젝트 루트에서 기준 파일을 찾을 수 있을 때만 유용합니다.",
      remediation: ["참조된 소스 파일이 이동했다면 경로를 고치세요.", "더 이상 주장을 뒷받침하지 않는 오래된 evidence 항목을 제거하세요.", "소스가 저장소 밖일 때만 명시적 외부 URL을 사용하세요."]
    },
    "evidence.line_range": {
      meaning: "evidence 라인 참조가 참조된 파일 범위를 벗어납니다.",
      whyItMatters: "라인 참조는 리뷰어가 주장을 빠르게 확인할 수 있도록 소스에 충분히 가깝게 유지되어야 합니다.",
      remediation: ["소스 편집 후 라인 번호나 범위를 갱신하세요.", "라인 번호가 자주 바뀌면 심볼·라우트·섹션 evidence를 사용하세요.", "validate를 다시 실행하세요."]
    },
    "evidence.section_missing": {
      meaning: "frontmatter evidence가 있는 문서에 본문 ## Evidence 섹션이 없습니다.",
      whyItMatters: "본문 섹션은 frontmatter에 저장된 정밀 evidence 참조를 리뷰어가 읽기 쉽게 설명해 줍니다.",
      remediation: ["문서 본문에 ## Evidence 섹션을 추가하세요.", "각 frontmatter evidence 항목을 불릿으로 언급하세요.", "참조 뒤에 자세한 해석을 프로즈로 남기세요."]
    },
    "evidence.section_empty": {
      meaning: "본문 ## Evidence 섹션이 있지만 불릿 항목이 없습니다.",
      whyItMatters: "evidence 섹션은 생성 문서와 관리 문서 전반에서 스캔하기 쉽고 일관돼야 합니다.",
      remediation: ["## Evidence 아래에 한 개 이상의 불릿 항목을 추가하세요.", "소스 참조·명령·테스트·검토된 evidence 노트를 사용하세요.", "문서 계약의 일부가 아니라면 섹션을 제거하세요."]
    },
    "evidence.stale": {
      meaning: "verified 문서가 검토 이후 git에서 변경된 소스 파일을 참조합니다.",
      whyItMatters: "verified 문서는 검토된 소스 기반 지식을 주장하는데, 참조 코드가 이후 이동하면 문서가 소스와 더 이상 맞지 않을 수 있어 재확인이 필요합니다.",
      remediation: ["변경된 소스를 다시 읽고 문서를 갱신하세요.", "주장이 더 이상 성립하지 않으면 문서를 needs_review로 낮추세요.", "새 사람 검토 후 reviewed_by/reviewed_at을 갱신하세요.", "이는 git 이력 기반 파일 수준 휴리스틱이니, 변경이 문서화된 주장에 영향이 없다면 무시하세요."]
    },
    "evidence.section_unlisted": {
      meaning: "frontmatter evidence 참조가 본문 ## Evidence 섹션에 언급되지 않았습니다.",
      whyItMatters: "frontmatter와 본문 evidence를 맞춰두면 도구가 참조를 검증하면서도 사람이 본문에서 맥락을 검토할 수 있습니다.",
      remediation: ["누락된 참조를 ## Evidence 아래 불릿에 추가하세요.", "더 이상 문서를 뒷받침하지 않으면 오래된 frontmatter evidence를 제거하세요.", "validate를 다시 실행하세요."]
    },
    "evidence.symbol_unverified": {
      meaning: "evidence #symbol: 참조가 참조된 파일이 언급하지 않는 심볼을 가리킵니다. 보수적 검사: 파일이 참조된 이름을 하나도 언급하지 않을 때만 flag합니다.",
      whyItMatters: "파일이 아예 언급조차 않는 심볼 포인터는 거의 확실히 오래됐거나 잘못된 것이라 'code-grounded' 주장이 성립하지 않으며, 형식 전용 검증으로는 잡을 수 없습니다.",
      remediation: ["심볼이 이동·개명됐다면 심볼 이름이나 파일 경로를 고치세요.", "심볼이 더 이상 없으면 locator를 제거하세요(파일만 남김).", "이는 텍스트 존재 여부 floor일 뿐 AST 리졸버가 아닙니다 — 심볼이 실제 정의인지 확인하지 않습니다; --strict나 config rules로 승격하세요.", "validate를 다시 실행하세요."]
    },
    "evidence.section_unverified": {
      meaning: "(마크다운 소스의) evidence #section: 참조가 파일에 없는 헤딩을 가리킵니다.",
      whyItMatters: "일치하는 헤딩이 없는 섹션 포인터는 오래된 것이라, 리뷰어가 evidence를 따라 주장된 구절로 갈 수 없습니다.",
      remediation: ["헤딩이 개명·이동됐다면 섹션 이름이나 파일 경로를 고치세요.", "섹션이 더 이상 없으면 locator를 제거하세요(파일만 남김).", "섹션 존재 검사는 마크다운 소스에만 적용됩니다; --strict나 config rules로 승격하세요.", "validate를 다시 실행하세요."]
    },
    "evidence.ungrounded": {
      meaning: "verified 문서에 source_files도 evidence도 없어, 코드 grounding 없이 'verified'입니다.",
      whyItMatters: "verified는 검토된 소스 기반 지식을 주장하기 위한 것인데, grounding이 전혀 없는 verified 문서는 코드와 대조할 수 없어 verified 상태의 신뢰를 약화시킵니다.",
      remediation: ["문서가 설명하는 코드를 가리키도록 source_files나 evidence를 추가하세요.", "실제로 소스 기반이 아니면 문서를 needs_review로 낮추세요.", "일부 verified 문서(예: 서술형 노트)에는 의도적일 수 있습니다; llm-wiki.config.json rules에서 \"evidence.ungrounded\": \"off\"로 프로젝트별로 끄세요.", "validate를 다시 실행하세요."]
    },
    "changed.unavailable": {
      meaning: "--changed 범위가 git 이력을 읽을 수 없습니다.",
      whyItMatters: "validate --changed는 비교 대상 git 저장소가 필요하며, 없으면 변경 파일 집합을 알 수 없습니다.",
      remediation: ["저장소 루트에서 git 저장소 안에서 실행하세요.", "--changed를 빼고 전체 위키를 검증하세요.", "CI에서는 체크아웃에 이력과 base ref가 포함되도록 하세요."]
    },
    "impact.source_changed": {
      meaning: "verified 문서가 현재 diff에서 변경된 소스 파일에 의존하는데, 문서 자신은 변경되지 않았습니다.",
      whyItMatters: "이는 날짜 기준 evidence.stale의 diff 기준·pre-merge 보완으로, 가장 중요한 경우 — 코드와 그 문서가 서로 다른 위치/PR에서 바뀌는 경우 — 를 잡아 verified 문서가 문서화한 코드와 조용히 어긋나지 않게 합니다.",
      remediation: ["변경된 소스를 다시 읽고 같은 변경집합에서 verified 문서를 갱신하세요.", "주장이 더 이상 성립하지 않으면 문서를 needs_review로 낮추세요(llm-wiki drift --downgrade).", "새 사람 검토 후 reviewed_by/reviewed_at을 갱신하세요.", "이는 diff 기반 파일 수준 휴리스틱이니, 변경이 문서화된 주장에 영향이 없다면 무시하세요.", "impact --strict로 CI 실패를 켜거나 llm-wiki.config.json rules에서 \"impact.source_changed\"를 설정하세요."]
    },
    "impact.unavailable": {
      meaning: "impact 검사가 git 이력을 읽을 수 없습니다.",
      whyItMatters: "impact는 verified 문서를 대조할 변경 파일 집합을 계산할 git 저장소가 필요하며, 없으면 reverse-impact 검사를 실행할 수 없습니다.",
      remediation: ["저장소 루트에서 git 저장소 안에서 실행하세요.", "--since <ref>로 PR base ref와 비교하세요.", "CI에서는 체크아웃에 이력과 base ref가 포함되도록 하세요."]
    },
    "run.doc_gap": {
      meaning: "run manifest가 나열한 변경 소스 파일을 touch된 위키 문서 중 어느 것도 참조하지 않습니다.",
      whyItMatters: "위키-그라운디드 스킬 워크플로(Gate 21)는 코드 변경이 문서에 반영되기를 기대하는데, 그것을 인용하는 touch된 문서가 없는 변경 소스는 파이프라인에서 가장 빠지기 쉬운 단계입니다.",
      remediation: ["변경 소스를 설명하는 위키 문서를 갱신하고 그 문서의 source_files/evidence에 추가하세요.", "갱신 후 manifest의 touchedDocs에 문서를 추가하세요.", "영향받은 verified 문서의 주장이 바뀌었으면 needs_review로 낮추세요.", "이는 파일 수준 휴리스틱이니, 변경이 어떤 문서화된 주장에도 영향이 없다면 무시하세요."]
    },
    "run.log_missing": {
      meaning: "run manifest가 append-only 변경 로그가 갱신되지 않았다고 보고합니다.",
      whyItMatters: "docs/llm-wiki/log.md는 무엇이 바뀌었는지 기록하는 append-only 기록이며, 이를 건너뛰면 스킬 실행이 남겨야 할 감사 추적을 잃습니다.",
      remediation: ["docs/llm-wiki/log.md에 변경 내용을 기술하는 항목을 append하세요.", "완료 후 manifest에서 logAppended를 true로 설정하세요.", "check-run --strict로 CI 실패를 켜세요."]
    },
    "run.unvalidated": {
      meaning: "run manifest가 검증이 실행되지 않았거나 통과하지 않았다고 보고합니다.",
      whyItMatters: "스킬 실행은 위키를 검증 통과 상태로 남겨야 하는데, 검증되지 않은 실행은 확인되지 않은 findings를 도입했을 수 있습니다.",
      remediation: ["llm-wiki validate를 실행하고 findings를 고치세요.", "manifest에 검증 결과를 기록하세요(validated: { ran: true, result: \"pass\" }).", "check-run --strict로 CI 실패를 켜세요."]
    },
    "run.manifest_missing": {
      meaning: "check-run이 검사할 run manifest를 찾지 못했습니다.",
      whyItMatters: "manifest가 없으면 검증할 대상이 없습니다; 스킬 실행은 .llm-wiki/runs/ 아래에 하나를 남기도록 기대됩니다.",
      remediation: ["스킬 실행이 .llm-wiki/runs/ 아래에 manifest를 쓰도록 하세요(스킬 워크플로 참조).", "--run <path>로 특정 manifest를 검사하세요.", "run-manifest 워크플로를 쓰지 않는 프로젝트에서는 no-op입니다."]
    },
    "run.manifest_invalid": {
      meaning: "run manifest를 파싱할 수 없거나 필수 필드가 없습니다.",
      whyItMatters: "잘못된 manifest는 검사할 수 없고, 보통 실행이 계약을 완료하지 못했음을 뜻합니다.",
      remediation: ["manifest가 task·changedSource·touchedDocs·logAppended·validated 필드를 가진 유효한 JSON인지 확인하세요.", "스킬 워크플로에서 manifest를 재생성하세요.", "--run <path>로 의도한 manifest를 가리키세요."]
    },
    "related.missing": {
      meaning: "related frontmatter 항목이 존재하지 않는 로컬 문서를 가리킵니다.",
      whyItMatters: "related 링크는 에이전트와 독자가 연결된 위키 문서 사이를 이동하게 돕는데, 깨진 항목은 위키 그래프를 약화시키고 생성 리포트의 신뢰를 떨어뜨립니다.",
      remediation: ["related 문서가 이동·개명됐다면 경로를 고치세요.", "더 이상 해당되지 않는 오래된 related 항목을 제거하세요.", "존재해야 하는 문서라면 그 related 문서를 생성하세요.", "참조가 저장소 밖일 때만 명시적 외부 URL을 사용하세요."]
    },
    "markdown_link.missing": {
      meaning: "로컬 마크다운 링크 대상이 존재하지 않습니다.",
      whyItMatters: "깨진 로컬 링크는 위키 탐색을 어렵게 하고 생성 리포트의 신뢰를 떨어뜨립니다.",
      remediation: ["대상 경로가 개명·이동됐는지 확인하세요.", "링크를 갱신하거나 누락된 대상 문서를 생성하세요.", "외부 링크·mailto 링크·로컬 앵커는 의도적으로 건너뜁니다."]
    },
    "wiki_link.missing": {
      meaning: "[[wiki link]] 대상이 파일 경로·basename·제목·별칭으로 해소되지 않습니다.",
      whyItMatters: "해소되지 않는 위키 링크는 개념 탐색을 깨뜨리고 OKF 스타일 지식 그래프 출력을 약화시킵니다.",
      remediation: ["실재하는 개념이면 누락된 개념의 문서를 생성하세요.", "링크 텍스트를 기존 제목·basename·파일 경로·별칭과 맞추세요.", "적절하다면 의도한 대상 문서에 검토된 aliases 항목을 추가하세요."]
    },
    "okf.type_required": {
      meaning: "OKF v0.1 프로필 문서에 필수 frontmatter type 필드가 없습니다.",
      whyItMatters: "OKF는 명시적 문서 type 메타데이터를 요구하며 LLM-WIKI는 doc_type에서 이를 추론하지 않습니다.",
      remediation: ["frontmatter에 명시적 type 필드를 추가하세요.", "concept·project·person·meeting_note·event·api_reference 같은 검토된 OKF type을 사용하세요.", "문서가 LLM-WIKI 계약도 필요하면 doc_type을 유지하세요."]
    },
    "okf.type_shape": {
      meaning: "OKF type 필드가 있지만 문자열이 아닙니다.",
      whyItMatters: "도구가 OKF 문서를 분류하려면 안정적인 스칼라 type 값이 필요합니다.",
      remediation: ["type을 단일 스칼라 문자열로 바꾸세요.", "type에 리스트나 객체 값을 쓰지 마세요.", "OKF 프로필로 validate를 다시 실행하세요."]
    },
    "okf.array_shape": {
      meaning: "OKF aliases 또는 tags 필드가 있지만 배열이 아닙니다.",
      whyItMatters: "OKF 호환 aliases와 tags는 그래프·검색 워크플로를 위해 안정적인 배열 형태가 필요합니다.",
      remediation: ["aliases나 tags를 YAML 리스트로 다시 쓰세요.", "aliases는 검토되고 의도적으로 유지하세요.", "OKF 프로필로 validate를 다시 실행하세요."]
    },
    "content.thin_body": {
      meaning: "위키 콘텐츠 문서의 본문 프로즈가 매우 적습니다. Opt-in lint: 기본 off, config rules로 프로젝트별 활성화.",
      whyItMatters: "시작만 하고 발전시키지 않은 스텁은 구조 검증을 통과하지만 지식이 거의 없습니다; 이를 잡고 싶은 팀은 프로젝트별로 규칙을 켤 수 있습니다.",
      remediation: ["소스 기반 내용(요약·근거·리뷰 노트)으로 문서를 보강하세요.", "llm-wiki handoff로 보강 프롬프트를 받으세요.", "이 규칙은 기본 off입니다; llm-wiki.config.json rules에서 \"content.thin_body\"를 설정해 켜세요(생략하면 off 유지)."]
    },
    "content.not_enriched": {
      meaning: "생성된 위키 문서에 아직 placeholder 안내가 남아 있고 소스 기반 내용으로 보강되지 않았습니다.",
      whyItMatters: "빈 스캐폴드는 구조 검증을 통과하지만 실제 지식이 없으므로, 에이전트나 사람이 소스 근거로 채우기 전까지 토큰 절감·인수인계 대체 목표가 달성되지 않습니다.",
      remediation: ["문서와 source_files에 나열된 파일을 읽고 placeholder 불릿을 소스 기반 내용으로 바꾸세요.", "llm-wiki next를 실행해 문서별로 아직 생성 placeholder 텍스트가 남은 ## 섹션(Enrichment Checklist)을 확인하세요.", "llm-wiki handoff --agent codex 또는 --agent claude로 보강 프롬프트를 받으세요.", "사람 검토가 끝날 때까지 문서를 needs_review로 유지하세요."]
    },
    "adapter.missing": {
      meaning: "선택된 에이전트 어댑터 파일이 없습니다.",
      whyItMatters: "어댑터 파일은 Codex나 Claude Code에 위키 진입점 위치와 프로젝트 계약을 따르는 방법을 알려줍니다.",
      remediation: ["선택한 에이전트로 init --write를 실행하세요.", "생성된 어댑터 텍스트를 신뢰하기 전에 검토하세요.", "기존 어댑터 파일은 절대 덮어쓰지 않습니다."]
    },
    "adapter.entrypoint": {
      meaning: "어댑터가 있지만 docs/llm-wiki/index.md를 가리키지 않습니다.",
      whyItMatters: "에이전트는 코드를 편집하기 전에 프로젝트 지식을 찾을 신뢰할 수 있는 진입점이 필요합니다.",
      remediation: ["보고된 어댑터 파일을 여세요.", "docs/llm-wiki/index.md 참조를 추가하거나 고치세요.", "선택한 에이전트로 audit을 다시 실행하세요."]
    },
    "encoding.bom": {
      meaning: "UTF-8 BOM이 감지되었습니다.",
      whyItMatters: "BOM은 보통 무해하지만 diff를 지저분하게 만들거나 단순 파서를 놀라게 할 수 있습니다.",
      remediation: ["팀이 BOM을 허용하면 그대로 두세요.", "더 깔끔한 diff를 원하면 UTF-8을 보존하는 에디터로 BOM을 제거하세요.", "audit을 다시 실행하세요."]
    },
    "encoding.mojibake": {
      meaning: "mojibake로 보이는 텍스트가 감지되었습니다.",
      whyItMatters: "텍스트가 이미 손상됐을 수 있을 때 자동 재작성은 안전하지 않습니다.",
      remediation: ["보고된 파일에 대한 자동 재작성 작업을 멈추세요.", "알려진 정상 UTF-8 소스에서 파일을 복구하거나 인코딩을 수동으로 고치세요.", "복구 후 audit을 다시 실행하세요."]
    },
    "visibility.public_sensitive": {
      meaning: "visibility: public 문서에 민감해 보이는 콘텐츠가 있습니다. Opt-in lint, config rules로 활성화.",
      whyItMatters: "public 문서는 조직 밖으로 나갈 수 있으므로 토큰·자격증명·비밀 같은 값을 담아선 안 됩니다.",
      remediation: ["민감 값을 제거·redact하거나 문서의 visibility를 낮추세요.", "이 규칙은 기본 off입니다; llm-wiki.config.json rules에서 \"visibility.public_sensitive\"를 설정해 켜세요.", "민감 값은 finding에 표시되지 않습니다; 파일을 로컬에서 확인하세요."]
    },
    "visibility.declared_mismatch": {
      meaning: "문서가 contains_sensitive_info: false로 선언했지만 민감해 보이는 콘텐츠가 발견되었습니다. Opt-in lint, config rules로 활성화.",
      whyItMatters: "frontmatter 선언은 콘텐츠와 일치해야 도구와 리뷰어가 신뢰할 수 있습니다.",
      remediation: ["contains_sensitive_info: true로 설정하거나 민감 값을 제거·redact하세요.", "이 규칙은 기본 off입니다; llm-wiki.config.json rules에서 \"visibility.declared_mismatch\"를 설정해 켜세요.", "민감 값은 finding에 절대 표시되지 않습니다."]
    },
    "sensitive.redacted": {
      meaning: "민감해 보이는 콘텐츠가 감지되어 finding 메시지에서 redact되었습니다.",
      whyItMatters: "리포트와 생성 문서는 토큰·자격증명·비밀 같은 값을 누출해선 안 됩니다.",
      remediation: ["보고된 파일과 라인을 로컬에서 확인하세요.", "실제 값이면 민감 값을 제거하거나 rotate하세요.", "예시는 명백히 가짜인 placeholder 값으로 교체하세요."]
    },
    "project.review_item": {
      meaning: "프로젝트 감지가 사람이 검토해야 할 항목을 발견했습니다.",
      whyItMatters: "감지는 보수적이라, 명시적 검토가 생성 템플릿을 실제 프로젝트에 맞게 유지합니다.",
      remediation: ["finding 메시지를 읽으세요.", "자동 감지가 약하면 --type이나 --profile을 명시적으로 전달하세요.", "status나 audit을 다시 실행하세요."]
    },
    "handoff.unsupported_agent": {
      meaning: "선택된 handoff 대상이 아직 지원되지 않습니다.",
      whyItMatters: "지원되지 않는 어댑터 계약은 안전한 handoff 지침으로 취급해선 안 됩니다.",
      remediation: ["codex나 claude 같은 지원되는 에이전트를 사용하세요.", "Antigravity는 어댑터 계약이 확인될 때까지 차단 상태로 두세요.", "지원되는 에이전트로 handoff를 다시 실행하세요."]
    },
    "prompt.unsupported_task": {
      meaning: "요청한 task 프롬프트 프리셋이 지원되지 않습니다.",
      whyItMatters: "프롬프트 프리셋은 task 워크플로가 예측 가능하고 검토 가능하도록 의도적으로 좁게 유지됩니다.",
      remediation: ["feature·fix·refactor·docs-sync·okf-extract 중 하나를 선택하세요.", "help prompt로 지원되는 task 이름을 확인하세요.", "워크플로가 안정되면 새 프리셋을 신중히 추가하세요."]
    }
  }
};
