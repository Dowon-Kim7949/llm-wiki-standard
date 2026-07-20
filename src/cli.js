import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { audit, doctor, driftCommand, explainCommand, fixCommand, graphCommand, handoffCommand, initCommand, migrateCommand, monorepoCommand, nextCommand, promptCommand, quickstartCommand, releaseNotesCommand, statsCommand, statusCommand, validateCommand, validateFrontmatterCommand } from "./commands.js";
import { printResult } from "./report.js";
import { loadProjectConfig, mergeConfigIntoOptions } from "./config-file.js";
import { startMcpServer } from "./mcp/server.js";

const COMMANDS = new Map([
  ["doctor", doctor],
  ["validate", validateCommand],
  ["validate-frontmatter", validateFrontmatterCommand],
  ["monorepo", monorepoCommand],
  ["status", statusCommand],
  ["next", nextCommand],
  ["explain", explainCommand],
  ["audit", audit],
  ["quickstart", quickstartCommand],
  ["handoff", handoffCommand],
  ["prompt", promptCommand],
  ["init", initCommand],
  ["migrate", migrateCommand],
  ["fix", fixCommand],
  ["drift", driftCommand],
  ["graph", graphCommand],
  ["stats", statsCommand],
  ["release-notes", releaseNotesCommand]
]);

const SUPPORTED_FORMATS = new Set(["text", "json", "markdown", "html"]);
const GRAPH_FORMATS = new Set(["text", "json", "mermaid", "dot"]);
const SUPPORTED_AGENTS = new Set(["codex", "claude", "cursor", "copilot", "windsurf", "gemini", "jetbrains", "antigravity", "all"]);
const SUPPORTED_EXISTING_POLICIES = new Set(["skip", "overwrite"]);
const ALL_AGENTS = ["codex", "claude", "antigravity"];

// Runs a full CLI invocation (parse -> dispatch -> render) and RETURNS the
// numeric exit code (0 pass, 1 error/strict-warning, 2 blocked, 3 usage error),
// so programmatic callers can branch on it. It also sets process.exitCode to the
// same value, so bin/llm-wiki.js keeps working without reading the return value.
export async function main(argv) {
  if (!argv[0] || argv[0] === "--help" || argv[0] === "-h") {
    printHelp();
    process.exitCode = 0;
    return 0;
  }

  if (argv[0] === "help") {
    const code = printCommandHelp(argv[1]);
    process.exitCode = code;
    return code;
  }

  const { command, options, errors } = parseArgs(argv);

  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    printHelp();
    process.exitCode = 3;
    return 3;
  }

  // mcp is a long-running stdio server, not a request/response command: it does
  // not go through the format/handler/printResult path. It resolves when stdin
  // closes (client disconnect).
  if (command === "mcp") {
    await startMcpServer(options);
    process.exitCode = 0;
    return 0;
  }

  const allowedFormats = command === "graph" ? GRAPH_FORMATS : SUPPORTED_FORMATS;
  if (!allowedFormats.has(options.format)) {
    console.error(`Unsupported format: ${options.format}`);
    console.error(command === "graph"
      ? "Supported formats for graph: text, json, mermaid, dot"
      : "Supported formats: text, json, markdown, html");
    process.exitCode = 3;
    return 3;
  }

  const handler = COMMANDS.get(command);
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exitCode = 3;
    return 3;
  }

  const { errors: configErrors } = await applyProjectConfig(options);
  if (configErrors.length > 0) {
    for (const error of configErrors) console.error(error);
    process.exitCode = 3;
    return 3;
  }

  const result = await handler(options);
  await printResult(result, options);
  const code = exitCodeFor(result, options);
  process.exitCode = code;
  return code;
}

// Loads llm-wiki.config.json for options.cwd and merges it into `options`
// (explicit/CLI values win; strict is additive; agents supplied by config are
// re-normalized). Mutates `options` in place and returns any config errors
// (malformed JSON, invalid field, or an invalid config-supplied agent). Shared by
// the CLI (main), the programmatic API (index.js resolveOptions), and the MCP
// server so all three surfaces resolve the same effective options from one file.
export async function applyProjectConfig(options) {
  const { config, errors } = await loadProjectConfig(options.cwd);
  if (errors.length > 0) return { errors };
  const usedConfigAgents = (!options.agents || options.agents.length === 0) && Array.isArray(config?.agents);
  mergeConfigIntoOptions(options, config);
  if (usedConfigAgents) {
    const agentErrors = [];
    options.agents = normalizeAgents(options.agents, options.withAdapters, agentErrors);
    if (agentErrors.length > 0) return { errors: agentErrors };
  }
  return { errors: [] };
}

// The full option set every command handler reads, with default values. This is
// the single source of truth for defaults, shared by CLI arg parsing (parseArgs)
// and the programmatic API (src/index.js normalizeOptions). Returns a fresh
// object with fresh arrays on each call so callers can safely mutate it.
export function defaultOptions() {
  return {
    cwd: process.cwd(),
    task: null,
    findingRule: null,
    version: null,
    since: null,
    bodyOnly: false,
    changed: false,
    type: null,
    format: "text",
    dryRun: false,
    write: false,
    apply: false,
    downgrade: false,
    strict: false,
    minimal: false,
    withAdapters: false,
    skills: false,
    existing: "skip",
    out: null,
    profiles: [],
    agents: [],
    rules: {},
    requiredDocs: [],
    templates: {}
  };
}

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const errors = [];
  const usedOptions = new Set();
  const options = defaultOptions();

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === "--cwd") {
      usedOptions.add("cwd");
      const value = readOptionValue(rest, index, arg, errors);
      if (value) {
        options.cwd = path.resolve(value);
        index += 1;
      }
    } else if (arg === "--task") {
      usedOptions.add("task");
      const value = readOptionValue(rest, index, arg, errors);
      if (value) {
        options.task = value;
        index += 1;
      }
    } else if (arg === "--type") {
      usedOptions.add("type");
      const value = readOptionValue(rest, index, arg, errors);
      if (value) {
        options.type = value;
        index += 1;
      }
    } else if (arg === "--version") {
      usedOptions.add("version");
      const value = readOptionValue(rest, index, arg, errors);
      if (value) {
        options.version = value;
        index += 1;
      }
    } else if (arg === "--since") {
      usedOptions.add("since");
      const value = readOptionValue(rest, index, arg, errors);
      if (value) {
        options.since = value;
        index += 1;
      }
    } else if (arg === "--profile") {
      usedOptions.add("profile");
      const value = readOptionValue(rest, index, arg, errors);
      if (value) {
        options.profiles.push(value);
        index += 1;
      }
    } else if (arg === "--agent") {
      usedOptions.add("agent");
      const value = readOptionValue(rest, index, arg, errors);
      if (value) {
        options.agents.push(value);
        index += 1;
      }
    } else if (arg === "--format") {
      usedOptions.add("format");
      const value = readOptionValue(rest, index, arg, errors);
      if (value) {
        options.format = value;
        index += 1;
      }
    } else if (arg === "--out") {
      usedOptions.add("out");
      const value = readOptionValue(rest, index, arg, errors);
      if (value) {
        options.out = path.resolve(value);
        index += 1;
      }
    } else if (arg === "--existing") {
      usedOptions.add("existing");
      const value = readOptionValue(rest, index, arg, errors);
      if (value) {
        options.existing = value;
        index += 1;
      }
    } else if (arg === "--dry-run") {
      usedOptions.add("dry-run");
      options.dryRun = true;
    } else if (arg === "--write") {
      usedOptions.add("write");
      options.write = true;
    } else if (arg === "--apply") {
      usedOptions.add("apply");
      options.apply = true;
    } else if (arg === "--downgrade") {
      usedOptions.add("downgrade");
      options.downgrade = true;
    } else if (arg === "--strict") {
      usedOptions.add("strict");
      options.strict = true;
    } else if (arg === "--changed") {
      usedOptions.add("changed");
      options.changed = true;
    } else if (arg === "--body-only") {
      usedOptions.add("body-only");
      options.bodyOnly = true;
    } else if (arg === "--minimal") {
      usedOptions.add("minimal");
      options.minimal = true;
    } else if (arg === "--with-adapters") {
      usedOptions.add("with-adapters");
      options.withAdapters = true;
    } else if (arg === "--no-adapters") {
      usedOptions.add("no-adapters");
      options.withAdapters = false;
      options.agents = [];
    } else if (arg === "--skills") {
      usedOptions.add("skills");
      options.skills = true;
    } else if (arg.startsWith("-")) {
      errors.push(`Unknown option: ${arg}`);
    } else if (command === "explain" && !options.findingRule) {
      options.findingRule = arg;
    } else {
      errors.push(`Unexpected argument: ${arg}`);
    }
  }

  options.agents = normalizeAgents(options.agents, options.withAdapters, errors);
  if (!SUPPORTED_EXISTING_POLICIES.has(options.existing)) {
    errors.push(`Unsupported existing policy: ${options.existing}`);
  }
  validateCommandOptions(command, usedOptions, errors);
  if (command === "explain" && !options.findingRule) {
    errors.push("Missing required argument for explain: <finding>.");
  }

  return { command, options, errors };
}

const COMMAND_OPTION_RULES = {
  doctor: new Set(["cwd", "format", "out"]),
  validate: new Set(["cwd", "type", "profile", "agent", "strict", "changed", "since", "format", "out"]),
  "validate-frontmatter": new Set(["cwd", "strict", "format", "out"]),
  status: new Set(["cwd", "type", "profile", "agent", "format", "out"]),
  next: new Set(["cwd", "type", "profile", "agent", "strict", "format", "out"]),
  explain: new Set(["format", "out"]),
  audit: new Set(["cwd", "type", "profile", "agent", "strict", "format", "out"]),
  quickstart: new Set(["cwd", "type", "profile", "agent", "existing", "minimal", "skills", "dry-run", "write", "format", "out"]),
  handoff: new Set(["cwd", "type", "profile", "agent", "format", "out"]),
  prompt: new Set(["cwd", "task", "type", "profile", "agent", "format", "out"]),
  init: new Set(["cwd", "type", "profile", "agent", "existing", "minimal", "skills", "dry-run", "write", "format", "out", "with-adapters", "no-adapters"]),
  migrate: new Set(["cwd", "type", "profile", "agent", "dry-run", "apply", "format", "out"]),
  fix: new Set(["cwd", "dry-run", "write", "format", "out"]),
  drift: new Set(["cwd", "dry-run", "downgrade", "format", "out"]),
  graph: new Set(["cwd", "format", "out"]),
  stats: new Set(["cwd", "type", "profile", "agent", "strict", "format", "out"]),
  "release-notes": new Set(["cwd", "version", "since", "body-only", "format", "out"]),
  mcp: new Set(["cwd"])
};

function validateCommandOptions(command, usedOptions, errors) {
  if (!command || command === "help" || command === "--help" || command === "-h") return;

  const allowed = COMMAND_OPTION_RULES[command];
  if (!allowed) return;

  for (const option of usedOptions) {
    if (!allowed.has(option)) {
      errors.push(`Option --${option} is not supported by ${command}.`);
    }
  }

  for (const [left, right] of [["dry-run", "write"], ["dry-run", "apply"], ["write", "apply"], ["dry-run", "downgrade"]]) {
    if (usedOptions.has(left) && usedOptions.has(right)) {
      errors.push(`Options --${left} and --${right} cannot be used together.`);
    }
  }

  if (command === "prompt" && !usedOptions.has("task")) {
    errors.push("Missing required option for prompt: --task.");
  }

}

function normalizeAgents(agentValues, withAdapters, errors) {
  const normalized = [];
  const values = withAdapters && agentValues.length === 0 ? ["all"] : agentValues;

  for (const rawValue of values) {
    const value = rawValue.toLowerCase();
    if (!SUPPORTED_AGENTS.has(value)) {
      errors.push(`Unsupported agent: ${rawValue}`);
      continue;
    }

    const agents = value === "all" ? ALL_AGENTS : [value];
    for (const agent of agents) {
      if (!normalized.includes(agent)) normalized.push(agent);
    }
  }

  return normalized;
}

function readOptionValue(args, index, optionName, errors) {
  const value = args[index + 1];
  if (!value || value.startsWith("-")) {
    errors.push(`Missing value for ${optionName}`);
    return null;
  }
  return value;
}

function exitCodeFor(result, options) {
  const findings = result.findings ?? [];
  if (result.result === "blocked" || findings.some((finding) => finding.severity === "blocked")) return 2;
  if (findings.some((finding) => finding.severity === "error")) return 1;
  if (options.strict && findings.some((finding) => finding.severity === "warning")) return 1;
  return 0;
}

// Read this package's version so `--help` / the bare invocation can show it —
// this also lets a user notice when npx served a stale cached version (a recurring
// support confusion). Best-effort: falls back to "unknown" if package.json is
// unreadable. Sync is fine for a one-shot help print.
export function packageVersion() {
  try {
    const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "package.json");
    return JSON.parse(readFileSync(pkgPath, "utf8")).version || "unknown";
  } catch {
    return "unknown";
  }
}

// The help text shown on `llm-wiki`, `llm-wiki --help`, and `-h`. Leads with a
// bilingual (KO+EN) orientation — what the tool is, why, and the 3-step flow —
// because exposure tests showed first-time users could not tell what the tool does
// from the bare Usage list, and a Korean tester asked for Korean. Returned as a
// string (not logged directly) so it is unit-testable.
export function helpText() {
  return `llm-wiki v${packageVersion()}

LLM-WIKI — AI 에이전트가 읽는, 코드 근거로 검증되는 프로젝트 지식베이스.
A governed, code-grounded knowledge base your AI coding agent reads.

무엇을 하나 / What it does:
  1) init/quickstart --write 로 문서 뼈대를 만들고 · scaffold the wiki docs
  2) 출력되는 handoff 프롬프트를 Claude Code/Codex에 붙여넣어 실제 코드로 채우고
     · paste the printed handoff prompt into your coding agent to fill them from real code
  3) 사람이 검토해 verified로 승인합니다 · a human reviews and marks them verified

왜 / Why:
  에이전트가 매번 코드를 다시 읽는 대신 '검증된 위키'를 근거로 삼아 토큰·오류를 줄입니다.
  Your agent grounds on a verified wiki instead of re-deriving from the code each time.
  이후 기능 추가/수정 시 에이전트에게 docs/llm-wiki를 먼저 읽히세요.
  Point your agent at docs/llm-wiki first when adding or changing features.

빠른 시작 / Quick start:
  npx @dowonk-7949/llm-wiki-standard@latest quickstart --dry-run   # 미리보기 · preview
  npx @dowonk-7949/llm-wiki-standard@latest quickstart --write     # 생성 · create
  항상 @latest 권장 — npx가 옛 버전을 캐시할 수 있습니다.
  Always use @latest; npx may reuse an old cached version.

Usage:
  llm-wiki doctor [--cwd <path>] [--format text|json|markdown|html]
  llm-wiki status [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|windsurf|gemini|jetbrains|antigravity|all>...] [--format text|json|markdown|html] [--out <path>]
  llm-wiki next [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|windsurf|gemini|jetbrains|antigravity|all>...] [--strict] [--format text|json|markdown|html] [--out <path>]
  llm-wiki explain <finding> [--format text|json|markdown|html] [--out <path>]
  llm-wiki validate [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|windsurf|gemini|jetbrains|antigravity|all>...] [--strict] [--changed] [--since <git-ref>] [--format text|json|markdown|html] [--out <path>]
  llm-wiki validate-frontmatter [--cwd <path>] [--strict]
  llm-wiki monorepo [--cwd <path>] [--format text|json|markdown|html] [--out <path>]
  llm-wiki audit [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|windsurf|gemini|jetbrains|antigravity|all>...] [--strict] [--format text|json|markdown|html] [--out <path>]
  llm-wiki quickstart --write [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|windsurf|gemini|jetbrains|antigravity|all>...] [--existing skip|overwrite] [--minimal] [--skills] [--format text|json|markdown|html] [--out <path>]
  llm-wiki quickstart --dry-run [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|windsurf|gemini|jetbrains|antigravity|all>...] [--minimal] [--format text|json|markdown|html] [--out <path>]
  llm-wiki handoff [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|windsurf|gemini|jetbrains|antigravity|all>...] [--format text|json|markdown|html] [--out <path>]
  llm-wiki prompt --task <feature|fix|refactor|docs-sync|okf-extract> [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|windsurf|gemini|jetbrains|antigravity|all>...] [--format text|json|markdown|html] [--out <path>]
  llm-wiki init --dry-run [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|windsurf|gemini|jetbrains|antigravity|all>...] [--minimal] [--format text|json|markdown|html] [--out <path>]
  llm-wiki init --write [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|windsurf|gemini|jetbrains|antigravity|all>...] [--existing skip|overwrite] [--minimal] [--skills] [--format text|json|markdown|html] [--out <path>]
  llm-wiki migrate [--dry-run] [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|windsurf|gemini|jetbrains|antigravity|all>...] [--format text|json|markdown|html] [--out <path>]
  llm-wiki migrate --apply [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|windsurf|gemini|jetbrains|antigravity|all>...] [--format text|json|markdown|html] [--out <path>]
  llm-wiki fix [--write] [--cwd <path>] [--format text|json|markdown|html] [--out <path>]
  llm-wiki drift [--downgrade] [--cwd <path>] [--format text|json|markdown|html] [--out <path>]
  llm-wiki graph [--format text|json|mermaid|dot] [--cwd <path>] [--out <path>]
  llm-wiki stats [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--strict] [--format text|json|markdown|html] [--out <path>]
  llm-wiki release-notes [--version <x.y.z>] [--since <git-ref>] [--body-only] [--cwd <path>] [--format text|json|markdown|html] [--out <path>]
  llm-wiki mcp [--cwd <path>]

Safety:
  init writes only when --write is explicit. Existing wiki docs default to --existing skip.
  quickstart writes only when --write is explicit and prints the next Codex/Claude Code handoff prompt.
  Existing adapter files are never overwritten.
  migrate previews by default and writes only with --apply, reusing the fix scope plus wiki_block_version upgrades; it never edits verified documents' content.
  fix previews by default and writes only with --write. It applies a narrow, accepted autofix scope inside docs/llm-wiki and never edits verified documents' content.
  drift reports evidence.stale drift and, only with --downgrade, flips drifted verified documents to needs_review (status + last_updated). It never promotes to verified.
  graph is read-only: it emits the wiki knowledge graph (documents + resolved doc-to-doc links) as text, JSON, Mermaid, or Graphviz DOT.
  stats is read-only: it reports a wiki health snapshot (verified %, enrichment %, evidence coverage, staleness, orphans).
  mcp starts a read-only Model Context Protocol server over stdio, exposing the read-only commands (validate/audit/next/status/doctor/stats/graph/explain/handoff/prompt) as MCP tools. No MCP tool writes files.
  Adapter checks and suggestions are opt-in with --agent. ANTIGRAVITY.md remains an info-level candidate.
  prompt prints repeatable post-wiki agent workflows and does not write project files unless --out is used for the report.
  next is advisory: it reuses audit coverage and recommends follow-up actions without writing files.
  explain is advisory: it explains a finding rule and suggests safe remediation steps.

Use llm-wiki help <command> for command-specific guidance.
`;
}

function printHelp() {
  console.log(helpText());
}

function printCommandHelp(command) {
  const text = COMMAND_HELP[command];
  if (!text) {
    console.error(command ? `Unknown help topic: ${command}` : "Missing help topic.");
    printHelp();
    return command ? 3 : 0;
  }

  console.log(text);
  return 0;
}

const COMMAND_HELP = {
  doctor: `llm-wiki doctor

Usage:
  llm-wiki doctor [--cwd <path>] [--format text|json|markdown|html] [--out <path>]

Purpose:
  Checks local runtime, package readiness, project detection, and stable safety policy signals.

JSON (--format json):
  Top-level keys: schemaVersion, command, checks[], detection, packageReadiness. schemaVersion pins the output contract.
`,
  status: `llm-wiki status

Usage:
  llm-wiki status [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|windsurf|gemini|jetbrains|antigravity|all>...] [--format text|json|markdown|html] [--out <path>]

Purpose:
  Shows whether LLM-WIKI is initialized, counts document statuses, reports missing recommended docs, markdown links, source file references, and selected adapter state.

JSON (--format json):
  Top-level keys: schemaVersion, command, result, initialized, detection, documentStatus, adapterStatus, wikiGraph, findingSummary, findings[]. findings[] items are { severity, rule, path, message }.
`,
  next: `llm-wiki next

Usage:
  llm-wiki next [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|windsurf|gemini|jetbrains|antigravity|all>...] [--strict] [--format text|json|markdown|html] [--out <path>]

Purpose:
  Reuses audit coverage and wikiGraph data to recommend the next review, repair, or setup actions. This command is advisory and does not write files.

JSON (--format json):
  Top-level keys: schemaVersion, command, result, detection, wikiGraph, auditFindingSummary, auditFindings[], actions[], findings[]. actions[] carries the recommended next steps.
`,
  explain: `llm-wiki explain

Usage:
  llm-wiki explain <finding> [--format text|json|markdown|html] [--out <path>]

Purpose:
  Explains a finding rule such as wiki_link.missing, frontmatter.required, okf.type_required, or source_files.missing, then suggests safe remediation steps.

JSON (--format json):
  Top-level keys: schemaVersion, command, result, findingRule, explanation, findings[]. explanation carries category, defaultSeverity, meaning, whyItMatters, remediation, commands, relatedRules.
`,
  quickstart: `llm-wiki quickstart

Usage:
  llm-wiki quickstart --write [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|windsurf|gemini|jetbrains|antigravity|all>...] [--existing skip|overwrite] [--minimal] [--skills] [--format text|json|markdown|html] [--out <path>]
  llm-wiki quickstart --dry-run [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|windsurf|gemini|jetbrains|antigravity|all>...] [--minimal] [--format text|json|markdown|html] [--out <path>]

Purpose:
  Runs doctor, init, optional frontmatter validation, and prints the Codex/Claude Code handoff prompt.
`,
  handoff: `llm-wiki handoff

Usage:
  llm-wiki handoff [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|windsurf|gemini|jetbrains|antigravity|all>...] [--format text|json|markdown|html] [--out <path>]

Purpose:
  Prints the next prompt to run in Codex or Claude Code after CLI setup, with project-type-specific source evidence guidance. Antigravity handoff remains blocked until the adapter contract is confirmed.
`,
  prompt: `llm-wiki prompt

Usage:
  llm-wiki prompt --task <feature|fix|refactor|docs-sync|okf-extract> [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|windsurf|gemini|jetbrains|antigravity|all>...] [--format text|json|markdown|html] [--out <path>]

Purpose:
  Prints a repeatable post-wiki agent workflow prompt. Use feature, fix, or refactor for code-and-doc tasks, docs-sync for stale wiki updates without unrelated code edits, and okf-extract for prompt-assisted OKF v0.1 extraction.
`,
  init: `llm-wiki init

Usage:
  llm-wiki init --dry-run [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|windsurf|gemini|jetbrains|antigravity|all>...] [--minimal] [--format text|json|markdown|html] [--out <path>]
  llm-wiki init --write [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|windsurf|gemini|jetbrains|antigravity|all>...] [--existing skip|overwrite] [--minimal] [--skills] [--format text|json|markdown|html] [--out <path>]

Purpose:
  Previews or creates missing LLM-WIKI documents and selected adapter files. Existing adapter files are never overwritten.
`,
  validate: `llm-wiki validate

Usage:
  llm-wiki validate [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|windsurf|gemini|jetbrains|antigravity|all>...] [--strict] [--changed] [--since <git-ref>] [--format text|json|markdown|html] [--out <path>]

Purpose:
  Runs audit-backed structure and safety validation for local checks or CI.
  --changed reports only findings on files changed vs the working tree (or since
  --since <ref>); cross-document checks still run. Run it from the repo root.

JSON (--format json):
  Top-level keys: schemaVersion, command, result, scopedToChanged, detection, wikiGraph, findingSummary, findings[]. findings[] items are { severity, rule, path, message }; gate CI on result/findingSummary.
`,
  "validate-frontmatter": `llm-wiki validate-frontmatter

Usage:
  llm-wiki validate-frontmatter [--cwd <path>] [--strict] [--format text|json|markdown|html] [--out <path>]

Purpose:
  Checks only required YAML frontmatter fields and values.

JSON (--format json):
  Top-level keys: schemaVersion, command, summary, findingSummary, findings[]. findings[] items are { severity, rule, path, message }.
`,
  audit: `llm-wiki audit

Usage:
  llm-wiki audit [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|windsurf|gemini|jetbrains|antigravity|all>...] [--strict] [--format text|json|markdown|html] [--out <path>]

Purpose:
  Reports detection, structure, frontmatter, encoding, sensitive-info, and selected adapter findings.

JSON (--format json):
  Top-level keys: schemaVersion, command, result, detection, wikiGraph, findingSummary, findings[]. findings[] items are { severity, rule, path, message }.
`,
  migrate: `llm-wiki migrate

Usage:
  llm-wiki migrate [--dry-run] [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|windsurf|gemini|jetbrains|antigravity|all>...] [--format text|json|markdown|html] [--out <path>]
  llm-wiki migrate --apply [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|windsurf|gemini|jetbrains|antigravity|all>...] [--format text|json|markdown|html] [--out <path>]

Purpose:
  Reports the wiki_block_version contract gap between existing documents and the
  installed CLI, and upgrades them to the current contract. Without --apply it
  previews the upgrade report and planned changes and writes nothing; --apply
  applies them.

Scope (see GATE_REVIEW.md "Migration Apply Scope Decision", Gate 8):
  - Reuses the accepted fix scope: fills missing Tier A frontmatter fields,
    reconciles the body ## Evidence section, creates needs_review stubs for
    broken links, and refreshes last_updated on modified documents.
  - Additionally upgrades an existing behind wiki_block_version to the current
    value, but only once the document otherwise conforms (no Tier B field left
    for a human).
  - Never edits verified documents' content, source_files/evidence values,
    Tier B fields (title/doc_type/project/author), or document status. Documents
    a newer CLI stamped (ahead) are reported, never downgraded. All writes stay
    needs_review; sensitive-matching results are blocked.
`,
  fix: `llm-wiki fix

Usage:
  llm-wiki fix [--cwd <path>] [--format text|json|markdown|html] [--out <path>]
  llm-wiki fix --write [--cwd <path>] [--format text|json|markdown|html] [--out <path>]

Purpose:
  Applies a narrow, accepted set of safe autofixes inside docs/llm-wiki. Without --write it previews the planned fixes and writes nothing; --write applies them.

Scope (see GATE_REVIEW.md "Autofix (--fix) Scope Decision"):
  - Inserts missing mechanical required frontmatter fields (status, visibility, contains_sensitive_info, wiki_block_version, last_updated, last_edited_by, and empty tags/source_files/related).
  - Adds or completes the body ## Evidence section from existing frontmatter evidence entries.
  - Creates needs_review stubs for broken related/markdown-link targets under docs/llm-wiki/*.md.
  - Refreshes last_updated only on documents it actually modifies.

  It never edits verified documents' content, never invents title/doc_type/project/author or source_files/evidence values, never enriches placeholder content, and never writes outside docs/llm-wiki. Mojibake and sensitive-looking results are skipped.
`,
  drift: `llm-wiki drift

Usage:
  llm-wiki drift [--cwd <path>] [--format text|json|markdown|html] [--out <path>]
  llm-wiki drift --downgrade [--cwd <path>] [--format text|json|markdown|html] [--out <path>]

Purpose:
  Reports evidence.stale drift on verified documents (line/symbol aware). Without
  --downgrade it only reports; --downgrade flips drifted verified documents to
  needs_review.

Scope (see GATE_REVIEW.md "Drift Downgrade Scope Decision", Gate 9):
  - Changes only status (verified -> needs_review) and last_updated, only on
    verified documents that have drifted.
  - Never promotes to verified, never edits body/reviewed_at/source_files/evidence
    or any other field, and never writes outside docs/llm-wiki. Mojibake and
    sensitive-looking results are skipped. Idempotent.
`,
  graph: `llm-wiki graph

Usage:
  llm-wiki graph [--format text|json|mermaid|dot] [--cwd <path>] [--out <path>]

Purpose:
  Read-only. Emits the wiki knowledge graph — documents plus resolved
  document-to-document links (wiki [[links]], related frontmatter, and local
  markdown links) — for visualization and export.

Formats:
  - text (default): a summary (documents, edges, orphans, unresolved links).
  - json: the structured graph (documents, edges, orphanDocuments, aliases).
  - mermaid: a fenced Mermaid graph TD block for GitHub/Obsidian.
  - dot: a Graphviz digraph for dot/other renderers.

JSON (--format json):
  Top-level keys: schemaVersion, command, format, graph, findings[]. graph carries documents[], edges[] ({ source, target, kind }), orphanDocuments[], aliases[].
`,
  stats: `llm-wiki stats

Usage:
  llm-wiki stats [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--strict] [--format text|json|markdown|html] [--out <path>]

Purpose:
  Read-only wiki health snapshot: total documents, a health score (the mean of
  verified %, enrichment %, and evidence coverage %), the document status mix,
  and stale-verified / orphan document counts. Reuses audit coverage.

JSON (--format json):
  Top-level keys: schemaVersion, command, result, stats, findings[]. stats carries documents, healthScore, status, verified/verifiedPct, enriched/enrichedPct, evidenceBacked/evidencePct, staleVerified, orphanDocuments.
`,
  "release-notes": `llm-wiki release-notes

Usage:
  llm-wiki release-notes [--version <x.y.z>] [--since <git-ref>] [--body-only] [--cwd <path>] [--format text|json|markdown|html] [--out <path>]

Purpose:
  Generates a needs_review release-notes document for a version. It groups conventional commits (feat/fix/perf/refactor/docs) into Korean-first bilingual sections (추가/변경/수정/문서/기타), and falls back to a fillable scaffold when git history is unavailable. Defaults the version to package.json; use --out to write the document.

  By default the range is "since the last v* tag". Pass --since <git-ref> (for example the previous release tag) to force the base range as <git-ref>..HEAD, which is useful for regenerating a version's notes after its tag already exists.

  --body-only emits ONLY the change-section body — no frontmatter, no H1 title, and no "review before publishing" scaffold line — for use as a GitHub Release body. Because commit subjects flow into the body, it is scanned for sensitive-looking values and the command is BLOCKED (exit 2, body withheld) if any are found; rewrite the offending commit subject and retry.

JSON (--format json):
  Top-level keys: schemaVersion, command, result, version, project, since, commitCount, gitAvailable, document, findings[]. With --body-only, document is the body (or null when blocked; findings[] then carries a sensitive.release_body entry).
`,
  mcp: `llm-wiki mcp

Usage:
  llm-wiki mcp [--cwd <path>]

Purpose:
  Starts a Model Context Protocol (MCP) server over stdio so agents (Claude
  Code, Cursor, and other MCP clients) can query and check the wiki as tools
  instead of shelling out. The server speaks newline-delimited JSON-RPC 2.0 on
  stdin/stdout; logs go to stderr. It runs until stdin closes.

  Register it in an MCP client, for example:
    { "mcpServers": { "llm-wiki": {
        "command": "npx",
        "args": ["-y", "@dowonk-7949/llm-wiki-standard", "mcp"] } } }

Tools (all read-only — no MCP tool writes files):
  validate, audit, next, status, doctor, stats, graph, explain, handoff, prompt.
  Each returns the command's structured result (with schemaVersion) as
  structuredContent plus a human-readable text summary.

  --cwd sets the default project root for tool calls that omit their own cwd.
  Implemented with Node built-ins only (no third-party MCP SDK), preserving the
  zero-runtime-dependency policy.
`
};
