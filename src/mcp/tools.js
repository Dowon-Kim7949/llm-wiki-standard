// MCP tool definitions for the LLM-WIKI server (1.6).
//
// Each tool is a thin, READ-ONLY wrapper over a command from the programmatic
// API (src/index.js `commands`). No write/mutating command (init/fix/migrate/
// drift/quickstart --write) is exposed over MCP: agents query and check the
// wiki through these tools, they do not change it. This mirrors the
// conservative-write safety ethos of the CLI (GATE_REVIEW.md).
//
// A tool declares a JSON-Schema `inputSchema` for its arguments; the dispatcher
// maps those arguments to a normalized options object via buildToolOptions()
// and then runs commands[tool.command](options).

const cwdProp = {
  type: "string",
  description: "Project root to inspect. Defaults to the MCP server's working directory."
};
const typeProp = {
  type: "string",
  enum: ["frontend", "backend", "fullstack", "library", "mixed", "unknown"],
  description: "Force the project type instead of auto-detecting it."
};
const profilesProp = {
  type: "array",
  items: { type: "string" },
  description: "Extra profiles to activate (for example okf-v0.1)."
};
const strictProp = {
  type: "boolean",
  description: "Treat warnings as failures; verified documents then require review metadata."
};
const agentsProp = {
  type: "array",
  items: { type: "string", enum: ["codex", "claude", "cursor", "copilot", "windsurf", "gemini", "jetbrains", "antigravity"] },
  description: "Adapter/agent targets for the handoff or task prompt. Defaults to claude when omitted."
};
const statusFilterProp = { type: "string", description: "Filter by document status (for example needs_review or verified)." };
const visibilityFilterProp = { type: "string", enum: ["internal", "public", "restricted"], description: "Filter by document visibility." };
const docTypeFilterProp = { type: "string", description: "Filter by doc_type (or OKF type)." };
const includeSensitiveProp = { type: "boolean", description: "Include restricted/sensitive documents (excluded from list/search by default)." };
const docPathProp = { type: "string", description: "Document path: repo-relative (docs/llm-wiki/GLOSSARY.md), wiki-relative (GLOSSARY.md), or a bare name (GLOSSARY)." };
const domainProp = { type: "string", description: "Work area (domain) to onboard into — a docs/llm-wiki/domains/* name. Omit for a project-wide orientation." };
const goalProp = { type: "string", description: "Optional free-text learning goal to focus the onboarding." };
const taskTextProp = { type: "string", description: "Free-text description of the change you intend to make (feature or fix)." };
const langProp = { type: "string", enum: ["en", "ko"], description: "Language for human-facing guidance prose (default en)." };
const sectionProp = { type: "string", description: "Optional focused read: return only the most relevant ## sections (plus the preamble) matching these terms instead of the full body. Falls back to the full body when nothing matches." };
const strictSectionProp = { type: "boolean", description: "With `section`: withhold the full body when no section matches (returns section.noSectionMatch instead of falling back to a whole-doc read). Token guard; default false." };
const compactProp = { type: "boolean", description: "Compact result (opt-in). get_doc: omit the frontmatter echo and keep the body only in structuredContent (avoids duplicating it in the text content). prepare: return one bounded context bundle (chosen path, <=3 docs, the top doc's most-relevant section, next-lookup) instead of the full report. Default false." };
const maxCharsProp = { type: "integer", minimum: 1, description: "Cap the returned body/section to at most this many characters (clamped after redaction). Adds a diagnostic estimatedTokens (chars/4 proxy, not a measured token count)." };

function schema(properties, required = []) {
  return { type: "object", properties, required, additionalProperties: false };
}

export const TOOL_DEFS = [
  {
    name: "validate",
    title: "Validate LLM-WIKI",
    description:
      "Run audit-backed structure and safety validation (CI-style). Reports missing required docs, broken markdown links, unresolved [[wiki links]], evidence drift on verified docs, and frontmatter contract issues.",
    command: "validate",
    inputSchema: schema({
      cwd: cwdProp,
      type: typeProp,
      profiles: profilesProp,
      strict: strictProp,
      changed: { type: "boolean", description: "Scope findings to files changed vs the working tree (or since --since)." },
      since: { type: "string", description: "Git ref baseline for changed-file scoping (for example a previous tag)." }
    })
  },
  {
    name: "audit",
    title: "Audit LLM-WIKI",
    description:
      "Report detection, structure, frontmatter, evidence, link, adapter, encoding, and sensitive-info findings, plus the wiki knowledge-graph summary.",
    command: "audit",
    inputSchema: schema({ cwd: cwdProp, type: typeProp, profiles: profilesProp, strict: strictProp })
  },
  {
    name: "next",
    title: "Next actions",
    description: "Reuse audit coverage and the wiki graph to recommend prioritized next review/repair/setup actions. Advisory; writes nothing.",
    command: "next",
    inputSchema: schema({ cwd: cwdProp, type: typeProp, profiles: profilesProp })
  },
  {
    name: "status",
    title: "Wiki status",
    description: "Report whether LLM-WIKI is initialized, document status counts, missing recommended docs, link health, and selected adapter state.",
    command: "status",
    inputSchema: schema({ cwd: cwdProp, type: typeProp, profiles: profilesProp })
  },
  {
    name: "doctor",
    title: "Doctor",
    description: "Check local runtime, package readiness, project detection, and stable safety-policy signals.",
    command: "doctor",
    inputSchema: schema({ cwd: cwdProp })
  },
  {
    name: "stats",
    title: "Wiki health stats",
    description: "Read-only health snapshot: total documents, a health score (mean of verified %, enrichment %, evidence coverage %), status mix, and stale-verified / orphan counts.",
    command: "stats",
    inputSchema: schema({ cwd: cwdProp, type: typeProp, profiles: profilesProp })
  },
  {
    name: "graph",
    title: "Knowledge graph",
    description:
      "Emit the wiki knowledge graph (documents plus resolved document-to-document links). structuredContent always carries the full structured graph as JSON, regardless of format. The text content is the human-readable summary for text/json, or the rendered diagram for mermaid (fenced graph TD) and dot (Graphviz).",
    command: "graph",
    inputSchema: schema({
      cwd: cwdProp,
      format: { type: "string", enum: ["text", "json", "mermaid", "dot"], description: "Rendering of the text content: text/json give the human-readable summary; mermaid/dot render the diagram. The JSON graph is always in structuredContent." }
    })
  },
  {
    name: "explain",
    title: "Explain a finding rule",
    description: "Explain a finding rule (for example wiki_link.missing, frontmatter.required, evidence.stale, okf.type_required) and suggest safe remediation steps.",
    command: "explain",
    inputSchema: schema({ rule: { type: "string", description: "The finding rule id to explain." } }, ["rule"])
  },
  {
    name: "handoff",
    title: "Agent handoff prompt",
    description: "Produce the next prompt to run in a coding agent after CLI setup, with project-type-specific source-evidence guidance.",
    command: "handoff",
    inputSchema: schema({ cwd: cwdProp, type: typeProp, profiles: profilesProp, agents: agentsProp })
  },
  {
    name: "prompt",
    title: "Repeatable task prompt",
    description: "Produce a repeatable agent workflow prompt for a task (bootstrap for first-time wiki enrichment, or feature, fix, refactor, docs-sync, or okf-extract).",
    command: "prompt",
    inputSchema: schema({
      task: { type: "string", enum: ["bootstrap", "feature", "fix", "refactor", "docs-sync", "okf-extract"], description: "The task workflow to generate a prompt for." },
      cwd: cwdProp,
      type: typeProp,
      profiles: profilesProp,
      agents: agentsProp
    }, ["task"])
  },
  {
    name: "list_docs",
    title: "List wiki documents",
    description:
      "Read-only retrieval. Enumerate wiki documents with metadata (path, title, status, doc_type, visibility, last_updated, tags) and optional status/visibility/docType filters. Returns no bodies. Restricted/sensitive documents are excluded unless includeSensitive is set.",
    command: "list-docs",
    inputSchema: schema({ cwd: cwdProp, status: statusFilterProp, visibility: visibilityFilterProp, docType: docTypeFilterProp, includeSensitive: includeSensitiveProp })
  },
  {
    name: "search_docs",
    title: "Search wiki documents",
    description:
      "Read-only keyword/substring search (deterministic, NOT semantic/vector) over document titles, bodies, and frontmatter. Every whitespace-separated term must appear (AND); returns ranked matches with a redacted snippet. Use get_doc for full content. Restricted/sensitive documents are excluded unless includeSensitive is set.",
    command: "search-docs",
    inputSchema: schema({
      query: { type: "string", description: "Keyword query. Every whitespace-separated term must appear in a document." },
      cwd: cwdProp,
      status: statusFilterProp,
      visibility: visibilityFilterProp,
      docType: docTypeFilterProp,
      includeSensitive: includeSensitiveProp,
      limit: { type: "integer", minimum: 1, description: "Maximum results to return (default 20)." }
    }, ["query"])
  },
  {
    name: "get_doc",
    title: "Get a wiki document",
    description:
      "Read-only retrieval. Return one document's frontmatter and body by path. Sensitive-looking body lines are redacted; the document's own visibility/contains_sensitive_info frontmatter is preserved. Opt-in token controls: strictSection (with section, no full-body fallback), maxChars (exact body cap), compact (omit frontmatter echo and keep the body only in structuredContent — avoids duplicating it in the text content).",
    command: "get-doc",
    inputSchema: schema({ path: docPathProp, section: sectionProp, strictSection: strictSectionProp, compact: compactProp, maxChars: maxCharsProp, cwd: cwdProp }, ["path"])
  },
  {
    name: "get_related",
    title: "Get related wiki documents",
    description:
      "Read-only retrieval. Return a document's resolved graph neighbors — outbound (documents it links to) and inbound (documents that link to it) — over wiki [[links]], related frontmatter, and local markdown links.",
    command: "get-related",
    inputSchema: schema({ path: docPathProp, cwd: cwdProp }, ["path"])
  },
  {
    name: "onboard",
    title: "Guided onboarding",
    description:
      "Read-only guided onboarding for a newcomer. Deterministically assembles a domain learning path from the existing wiki — documents to read, source/test entrypoints (from the docs' source_files/evidence), invariants/risks as recorded in the docs, freshness/needs_review warnings, and evidence-anchored comprehension checks. Assembles only; invents no explanation. Restricted/sensitive docs excluded; returned text redacted.",
    command: "onboard",
    inputSchema: schema({ cwd: cwdProp, domain: domainProp, goal: goalProp, type: typeProp, profiles: profilesProp, lang: langProp })
  },
  {
    name: "prepare",
    title: "Prepare a task",
    description:
      "Read-only task preparation. For a described change, scopes the work before implementing: most-relevant wiki docs (reusing the search ranking), graph neighbors, candidate domains/source/test files, related API/state/screen/config docs, invariants/risks, freshness warnings, unknowns, and a scope checklist. Phrases candidates as candidates and concludes nothing — the code stays the source of truth. Restricted/sensitive docs excluded; text redacted.",
    command: "prepare",
    inputSchema: schema({ task: taskTextProp, compact: compactProp, maxChars: maxCharsProp, cwd: cwdProp, type: typeProp, profiles: profilesProp, lang: langProp }, ["task"])
  }
];

// Map validated MCP tool `arguments` to a partial options object (the dispatcher
// fills the default cwd and runs it through normalizeOptions). Only known,
// read-safe fields are copied; anything else is ignored.
export function buildToolOptions(tool, args = {}) {
  const options = {};
  if (typeof args.cwd === "string") options.cwd = args.cwd;
  if (typeof args.type === "string") options.type = args.type;
  if (Array.isArray(args.profiles)) options.profiles = args.profiles;
  if (typeof args.strict === "boolean") options.strict = args.strict;
  if (typeof args.changed === "boolean") options.changed = args.changed;
  if (typeof args.since === "string") options.since = args.since;
  if (typeof args.format === "string") options.format = args.format;
  if (typeof args.rule === "string") options.findingRule = args.rule;
  if (typeof args.task === "string") options.task = args.task;
  if (typeof args.domain === "string") options.domain = args.domain;
  if (typeof args.goal === "string") options.goal = args.goal;
  if (typeof args.lang === "string") options.lang = args.lang;
  if (typeof args.query === "string") options.query = args.query;
  if (typeof args.path === "string") options.docPath = args.path;
  if (typeof args.section === "string") options.section = args.section;
  if (typeof args.strictSection === "boolean") options.strictSection = args.strictSection;
  if (typeof args.compact === "boolean") options.compact = args.compact;
  if (Number.isInteger(args.maxChars)) options.maxChars = args.maxChars;
  if (typeof args.status === "string") options.status = args.status;
  if (typeof args.visibility === "string") options.visibility = args.visibility;
  if (typeof args.docType === "string") options.docType = args.docType;
  if (typeof args.includeSensitive === "boolean") options.includeSensitive = args.includeSensitive;
  if (Number.isInteger(args.limit)) options.limit = args.limit;
  if (Array.isArray(args.agents)) options.agents = args.agents;

  // handoff/prompt need an agent to render a prompt; default to claude so the
  // tool is useful when the client does not specify one.
  if ((tool.command === "handoff" || tool.command === "prompt") && (!options.agents || options.agents.length === 0)) {
    options.agents = ["claude"];
  }
  return options;
}
