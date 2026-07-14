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
    description: "Produce a repeatable post-wiki agent workflow prompt for a task (feature, fix, refactor, docs-sync, or okf-extract).",
    command: "prompt",
    inputSchema: schema({
      task: { type: "string", enum: ["feature", "fix", "refactor", "docs-sync", "okf-extract"], description: "The task workflow to generate a prompt for." },
      cwd: cwdProp,
      type: typeProp,
      profiles: profilesProp,
      agents: agentsProp
    }, ["task"])
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
  if (Array.isArray(args.agents)) options.agents = args.agents;

  // handoff/prompt need an agent to render a prompt; default to claude so the
  // tool is useful when the client does not specify one.
  if ((tool.command === "handoff" || tool.command === "prompt") && (!options.agents || options.agents.length === 0)) {
    options.agents = ["claude"];
  }
  return options;
}
