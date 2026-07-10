import path from "node:path";
import { audit, doctor, explainCommand, handoffCommand, initCommand, migrateCommand, nextCommand, promptCommand, quickstartCommand, releaseNotesCommand, statusCommand, validateCommand, validateFrontmatterCommand } from "./commands.js";
import { printResult } from "./report.js";
import { loadProjectConfig, mergeConfigIntoOptions } from "./config-file.js";

const COMMANDS = new Map([
  ["doctor", doctor],
  ["validate", validateCommand],
  ["validate-frontmatter", validateFrontmatterCommand],
  ["status", statusCommand],
  ["next", nextCommand],
  ["explain", explainCommand],
  ["audit", audit],
  ["quickstart", quickstartCommand],
  ["handoff", handoffCommand],
  ["prompt", promptCommand],
  ["init", initCommand],
  ["migrate", migrateCommand],
  ["release-notes", releaseNotesCommand]
]);

const SUPPORTED_FORMATS = new Set(["text", "json", "markdown", "html"]);
const SUPPORTED_AGENTS = new Set(["codex", "claude", "cursor", "copilot", "antigravity", "all"]);
const SUPPORTED_EXISTING_POLICIES = new Set(["skip", "overwrite"]);
const ALL_AGENTS = ["codex", "claude", "antigravity"];

export async function main(argv) {
  if (!argv[0] || argv[0] === "--help" || argv[0] === "-h") {
    printHelp();
    return;
  }

  if (argv[0] === "help") {
    printCommandHelp(argv[1]);
    return;
  }

  const { command, options, errors } = parseArgs(argv);

  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    printHelp();
    process.exitCode = 3;
    return;
  }

  if (!SUPPORTED_FORMATS.has(options.format)) {
    console.error(`Unsupported format: ${options.format}`);
    console.error("Supported formats: text, json, markdown, html");
    process.exitCode = 3;
    return;
  }

  const handler = COMMANDS.get(command);
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    printHelp();
    process.exitCode = 3;
    return;
  }

  const { config, errors: configErrors } = await loadProjectConfig(options.cwd);
  if (configErrors.length > 0) {
    for (const error of configErrors) console.error(error);
    process.exitCode = 3;
    return;
  }
  const usedConfigAgents = (!options.agents || options.agents.length === 0) && Array.isArray(config?.agents);
  mergeConfigIntoOptions(options, config);
  if (usedConfigAgents) {
    const agentErrors = [];
    options.agents = normalizeAgents(options.agents, options.withAdapters, agentErrors);
    if (agentErrors.length > 0) {
      for (const error of agentErrors) console.error(error);
      process.exitCode = 3;
      return;
    }
  }

  const result = await handler(options);
  await printResult(result, options);
  process.exitCode = exitCodeFor(result, options);
}

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const errors = [];
  const usedOptions = new Set();
  const options = {
    cwd: process.cwd(),
    task: null,
    findingRule: null,
    version: null,
    since: null,
    type: null,
    format: "text",
    dryRun: false,
    write: false,
    apply: false,
    strict: false,
    minimal: false,
    withAdapters: false,
    existing: "skip",
    out: null,
    profiles: [],
    agents: []
  };

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
    } else if (arg === "--strict") {
      usedOptions.add("strict");
      options.strict = true;
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
  validate: new Set(["cwd", "type", "profile", "agent", "strict", "format", "out"]),
  "validate-frontmatter": new Set(["cwd", "strict", "format", "out"]),
  status: new Set(["cwd", "type", "profile", "agent", "format", "out"]),
  next: new Set(["cwd", "type", "profile", "agent", "strict", "format", "out"]),
  explain: new Set(["format", "out"]),
  audit: new Set(["cwd", "type", "profile", "agent", "strict", "format", "out"]),
  quickstart: new Set(["cwd", "type", "profile", "agent", "existing", "minimal", "dry-run", "write", "format", "out"]),
  handoff: new Set(["cwd", "type", "profile", "agent", "format", "out"]),
  prompt: new Set(["cwd", "task", "type", "profile", "agent", "format", "out"]),
  init: new Set(["cwd", "type", "profile", "agent", "existing", "minimal", "dry-run", "write", "format", "out", "with-adapters", "no-adapters"]),
  migrate: new Set(["cwd", "type", "profile", "agent", "dry-run", "apply", "format", "out"]),
  "release-notes": new Set(["cwd", "version", "since", "format", "out"])
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

  for (const [left, right] of [["dry-run", "write"], ["dry-run", "apply"], ["write", "apply"]]) {
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

function printHelp() {
  console.log(`llm-wiki

Usage:
  llm-wiki doctor [--cwd <path>] [--format text|json|markdown|html]
  llm-wiki status [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|antigravity|all>...] [--format text|json|markdown|html] [--out <path>]
  llm-wiki next [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|antigravity|all>...] [--strict] [--format text|json|markdown|html] [--out <path>]
  llm-wiki explain <finding> [--format text|json|markdown|html] [--out <path>]
  llm-wiki validate [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|antigravity|all>...] [--strict] [--format text|json|markdown|html] [--out <path>]
  llm-wiki validate-frontmatter [--cwd <path>] [--strict]
  llm-wiki audit [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|antigravity|all>...] [--strict] [--format text|json|markdown|html] [--out <path>]
  llm-wiki quickstart --write [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|antigravity|all>...] [--existing skip|overwrite] [--minimal] [--format text|json|markdown|html] [--out <path>]
  llm-wiki quickstart --dry-run [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|antigravity|all>...] [--minimal] [--format text|json|markdown|html] [--out <path>]
  llm-wiki handoff [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|antigravity|all>...] [--format text|json|markdown|html] [--out <path>]
  llm-wiki prompt --task <feature|fix|refactor|docs-sync|okf-extract> [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|antigravity|all>...] [--format text|json|markdown|html] [--out <path>]
  llm-wiki init --dry-run [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|antigravity|all>...] [--minimal] [--format text|json|markdown|html] [--out <path>]
  llm-wiki init --write [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|antigravity|all>...] [--existing skip|overwrite] [--minimal] [--format text|json|markdown|html] [--out <path>]
  llm-wiki migrate --dry-run [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|antigravity|all>...] [--format text|json|markdown|html] [--out <path>]
  llm-wiki release-notes [--version <x.y.z>] [--since <git-ref>] [--cwd <path>] [--format text|json|markdown|html] [--out <path>]

Safety:
  init writes only when --write is explicit. Existing wiki docs default to --existing skip.
  quickstart writes only when --write is explicit and prints the next Codex/Claude Code handoff prompt.
  Existing adapter files are never overwritten. migrate --apply remains blocked.
  Adapter checks and suggestions are opt-in with --agent. ANTIGRAVITY.md remains an info-level candidate.
  prompt prints repeatable post-wiki agent workflows and does not write project files unless --out is used for the report.
  next is advisory: it reuses audit coverage and recommends follow-up actions without writing files.
  explain is advisory: it explains a finding rule and suggests safe remediation steps.

Use llm-wiki help <command> for command-specific guidance.
`);
}

function printCommandHelp(command) {
  const text = COMMAND_HELP[command];
  if (!text) {
    console.error(command ? `Unknown help topic: ${command}` : "Missing help topic.");
    printHelp();
    process.exitCode = command ? 3 : 0;
    return;
  }

  console.log(text);
}

const COMMAND_HELP = {
  doctor: `llm-wiki doctor

Usage:
  llm-wiki doctor [--cwd <path>] [--format text|json|markdown|html] [--out <path>]

Purpose:
  Checks local runtime, package readiness, project detection, and stable safety policy signals.
`,
  status: `llm-wiki status

Usage:
  llm-wiki status [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|antigravity|all>...] [--format text|json|markdown|html] [--out <path>]

Purpose:
  Shows whether LLM-WIKI is initialized, counts document statuses, reports missing recommended docs, markdown links, source file references, and selected adapter state.
`,
  next: `llm-wiki next

Usage:
  llm-wiki next [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|antigravity|all>...] [--strict] [--format text|json|markdown|html] [--out <path>]

Purpose:
  Reuses audit coverage and wikiGraph data to recommend the next review, repair, or setup actions. This command is advisory and does not write files.
`,
  explain: `llm-wiki explain

Usage:
  llm-wiki explain <finding> [--format text|json|markdown|html] [--out <path>]

Purpose:
  Explains a finding rule such as wiki_link.missing, frontmatter.required, okf.type_required, or source_files.missing, then suggests safe remediation steps.
`,
  quickstart: `llm-wiki quickstart

Usage:
  llm-wiki quickstart --write [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|antigravity|all>...] [--existing skip|overwrite] [--minimal] [--format text|json|markdown|html] [--out <path>]
  llm-wiki quickstart --dry-run [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|antigravity|all>...] [--minimal] [--format text|json|markdown|html] [--out <path>]

Purpose:
  Runs doctor, init, optional frontmatter validation, and prints the Codex/Claude Code handoff prompt.
`,
  handoff: `llm-wiki handoff

Usage:
  llm-wiki handoff [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|antigravity|all>...] [--format text|json|markdown|html] [--out <path>]

Purpose:
  Prints the next prompt to run in Codex or Claude Code after CLI setup, with project-type-specific source evidence guidance. Antigravity handoff remains blocked until the adapter contract is confirmed.
`,
  prompt: `llm-wiki prompt

Usage:
  llm-wiki prompt --task <feature|fix|refactor|docs-sync|okf-extract> [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|antigravity|all>...] [--format text|json|markdown|html] [--out <path>]

Purpose:
  Prints a repeatable post-wiki agent workflow prompt. Use feature, fix, or refactor for code-and-doc tasks, docs-sync for stale wiki updates without unrelated code edits, and okf-extract for prompt-assisted OKF v0.1 extraction.
`,
  init: `llm-wiki init

Usage:
  llm-wiki init --dry-run [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|antigravity|all>...] [--minimal] [--format text|json|markdown|html] [--out <path>]
  llm-wiki init --write [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|antigravity|all>...] [--existing skip|overwrite] [--minimal] [--format text|json|markdown|html] [--out <path>]

Purpose:
  Previews or creates missing LLM-WIKI documents and selected adapter files. Existing adapter files are never overwritten.
`,
  validate: `llm-wiki validate

Usage:
  llm-wiki validate [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|antigravity|all>...] [--strict] [--format text|json|markdown|html] [--out <path>]

Purpose:
  Runs audit-backed structure and safety validation for local checks or CI.
`,
  "validate-frontmatter": `llm-wiki validate-frontmatter

Usage:
  llm-wiki validate-frontmatter [--cwd <path>] [--strict] [--format text|json|markdown|html] [--out <path>]

Purpose:
  Checks only required YAML frontmatter fields and values.
`,
  audit: `llm-wiki audit

Usage:
  llm-wiki audit [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|antigravity|all>...] [--strict] [--format text|json|markdown|html] [--out <path>]

Purpose:
  Reports detection, structure, frontmatter, encoding, sensitive-info, and selected adapter findings.
`,
  migrate: `llm-wiki migrate

Usage:
  llm-wiki migrate --dry-run [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|cursor|copilot|antigravity|all>...] [--format text|json|markdown|html] [--out <path>]

Purpose:
  Prepares a reviewable migration plan without writing files. migrate --apply remains intentionally blocked.
`,
  "release-notes": `llm-wiki release-notes

Usage:
  llm-wiki release-notes [--version <x.y.z>] [--since <git-ref>] [--cwd <path>] [--format text|json|markdown|html] [--out <path>]

Purpose:
  Generates a needs_review release-notes document for a version. It groups conventional commits (feat/fix/perf/refactor/docs) into Korean-first bilingual sections (추가/변경/수정/문서/기타), and falls back to a fillable scaffold when git history is unavailable. Defaults the version to package.json; use --out to write the document.

  By default the range is "since the last v* tag". Pass --since <git-ref> (for example the previous release tag) to force the base range as <git-ref>..HEAD, which is useful for regenerating a version's notes after its tag already exists.
`
};
