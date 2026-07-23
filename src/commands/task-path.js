// Task-path selection (token-efficiency: "pick the cheapest SAFE path"). A small,
// deterministic classifier that recommends HOW an agent should approach a task so
// it reads the wiki when a wiki map is the cheaper starting point and goes straight
// to source when that is cheaper — WITHOUT ever trading away safety.
//
// Three paths:
//   - source_direct: a small, well-located change/question with 1–2 candidate
//     docs; reading the wiki first would cost more than it saves.
//   - wiki_first: onboarding, domain understanding, or a question spanning many
//     files/layers; a wiki map is the cheaper starting point.
//   - hybrid: a normal feature/fix; orient with the wiki, but ALWAYS confirm the
//     real change against the source.
//
// Inputs are ONLY what a real agent has BEFORE reading anything: the task text,
// how many candidate docs a search returned, and those candidates' statuses. It
// never uses answer filenames or internal symbols (bench-leak guard).
//
// Safety override (never negotiable): risk-sensitive work (auth/permission/payment/
// crypto/privacy/data-deletion/migration/public-API) OR any stale/unknown/
// needs_review candidate forces mustReadSource = true and never yields
// source_direct. And on any code change, mustReadSource is true even when the
// matched docs are verified — the code is the source of truth; the wiki is a map.
// Over-flagging risk only pushes toward reading source (the safe direction), so the
// keyword sets are deliberately liberal.

// Risk categories. Each entry: a category key and a matcher regex (EN + KO). These
// are matched case-insensitively against the raw task text. Liberal on purpose.
const RISK_MATCHERS = [
  ["auth", /\b(auth|authn|authz|authenticat\w*|login|log ?in|logout|sign ?in|session|token|jwt|oauth|sso|credential|password)\b|인증|로그인|로그아웃|세션|토큰|자격 ?증명|비밀번호|비번/i],
  ["permission", /\b(permission|authoriz\w*|access control|rbac|acl|role|privilege|grant|scope)\b|권한|접근 ?제어|역할|롤|스코프/i],
  ["payment", /\b(payment|billing|invoice|charge|checkout|refund|subscription|pricing|price|currency)\b|결제|과금|청구|환불|구독|가격|요금|통화/i],
  ["crypto", /\b(crypto|encrypt\w*|decrypt\w*|cipher|hash\w*|signature|signing|kms|tls|ssl|certificate|secret ?key|private ?key)\b|암호화|복호화|해시|서명|인증서|키 ?관리|비밀 ?키/i],
  ["privacy", /\b(pii|privacy|personal data|gdpr|ccpa|consent|anonymiz\w*|de-?identif\w*)\b|개인정보|프라이버시|동의|익명화|비식별/i],
  ["data_deletion", /\b(delete|deletion|drop|purge|erase|wipe|hard ?delete|truncate)\b|삭제|제거|지우|파기|영구 ?삭제/i],
  ["migration", /\b(migration|migrate|schema change|backfill|data migration|alter table|reindex)\b|마이그레이션|스키마 ?변경|백필|이관|재색인/i],
  ["public_api", /\b(public api|api compat\w*|backward ?compat\w*|breaking change|api version|public interface|exported (api|symbol|function))\b|공개 ?api|하위 ?호환|호환성|api ?버전|공개 ?인터페이스/i]
];

// Understanding / onboarding intent → a wiki map is the cheaper starting point.
const UNDERSTAND_RE = /\b(understand|learn|onboard\w*|overview|architecture|how (does|do|is|are)|walk ?through|get up to speed|familiar\w*|orient\w*|explain the (system|project|codebase|flow))\b|이해|학습|온보딩|개요|구조|아키텍처|전체 ?흐름|흐름 ?파악|둘러|파악하/i;

// Strong "small, well-located edit or question" signals — these win over a generic
// verb like "fix"/"change" (e.g. "fix a typo" is source_direct, not a hybrid feature).
const LOCALIZED_RE = /\b(typo|rename|renam\w*|comment|log message|constant|copy ?change|wording|label|tooltip|one[- ]?line|single[- ]?line|tweak|small (fix|change|edit)|where is|what does|which file)\b|오타|주석|상수|문구|라벨|한 ?줄|작은 ?(수정|변경)|사소한|버전 ?업|이름 ?변경|리네임|어디에 ?있|무엇을 ?하|어느 ?파일/i;

const UNVERIFIED_STATUSES = new Set(["needs_review", "unknown", "stale", "draft", null, undefined, ""]);

// Return the sorted, deduped list of risk categories a task text triggers.
export function classifyTaskRisk(taskText) {
  const text = String(taskText ?? "");
  const hits = [];
  for (const [key, re] of RISK_MATCHERS) {
    if (re.test(text)) hits.push(key);
  }
  return hits.sort();
}

// Decide the cheapest SAFE path. Pure and deterministic.
//   task          — the user's task/question text (free-form).
//   candidateCount — how many candidate docs a search returned (default 0).
//   docStatuses    — statuses of the top candidate docs (e.g. ["verified", "needs_review"]).
//   isCodeChange   — whether the task will change code (default true; a pure
//                    question can pass false).
// Returns { path, reasonCode, reason, risk, mustReadSource, unverifiedDocs }.
export function selectTaskPath({ task = "", candidateCount = 0, docStatuses = [], isCodeChange = true } = {}) {
  const risk = classifyTaskRisk(task);
  const statuses = Array.isArray(docStatuses) ? docStatuses : [];
  const unverifiedDocs = statuses.filter((status) => UNVERIFIED_STATUSES.has(status)).length;
  const count = Number.isInteger(candidateCount) && candidateCount > 0 ? candidateCount : 0;

  // Safety: any risk, any unverified/stale candidate, or any code change means the
  // agent MUST open the real source — a verified doc never excuses that on a change.
  const mustReadSource = risk.length > 0 || unverifiedDocs > 0 || Boolean(isCodeChange);

  const understanding = UNDERSTAND_RE.test(task);
  const localized = LOCALIZED_RE.test(task);

  // Decision order is deliberate: understanding and risk are checked before the
  // count heuristics so a risky task never becomes source_direct on a low count.
  let path;
  let reasonCode;
  if (understanding) {
    path = "wiki_first";
    reasonCode = "understanding";
  } else if (risk.length > 0) {
    // Risk-sensitive: orient with the wiki AND confirm against source. Never
    // source_direct, even if it looks small — the blast radius is too high.
    path = "hybrid";
    reasonCode = "risk_sensitive";
  } else if (count >= 5) {
    // Many candidate docs: the question likely spans files/layers — a wiki map is
    // the cheaper starting point.
    path = "wiki_first";
    reasonCode = "broad_multi_file";
  } else if (localized) {
    // A strong small-edit/question signal (typo/rename/comment/where-is): go to the
    // source; a wiki detour would cost more than it saves.
    path = "source_direct";
    reasonCode = "localized_small";
  } else if (count <= 2) {
    // Location is clear (few or no candidate docs): read the source rather than
    // paying for a wiki detour. count 0 (no/undocumented match) lands here too.
    path = "source_direct";
    reasonCode = "localized_small";
  } else {
    // Moderate spread (3–4 candidates): an ordinary feature/fix — orient with the
    // wiki, then confirm against source.
    path = "hybrid";
    reasonCode = "default_feature_fix";
  }

  return { path, reasonCode, reason: REASONS[reasonCode], risk, mustReadSource, unverifiedDocs };
}

// English reason strings keyed by reasonCode. Callers that localize (e.g. prepare)
// map the stable reasonCode to their own language; this keeps the classifier pure.
export const REASONS = {
  understanding: "Understanding/onboarding intent — a wiki map is the cheaper starting point.",
  risk_sensitive: "Risk-sensitive work — orient with the wiki, but the real source must be confirmed before changing anything.",
  localized_small: "Small, well-located task with few candidates — go straight to the source; a wiki detour would cost more than it saves.",
  broad_multi_file: "Many candidate docs — the question likely spans files/layers, so a wiki map is the cheaper starting point.",
  default_feature_fix: "Ordinary feature/fix — use the wiki to orient, then confirm the change against the source."
};
