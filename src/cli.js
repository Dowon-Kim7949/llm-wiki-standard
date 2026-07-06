import path from "node:path";
import { audit, doctor, initCommand, migrateCommand, validateCommand, validateFrontmatterCommand } from "./commands.js";
import { printResult } from "./report.js";

const COMMANDS = new Map([
  ["doctor", doctor],
  ["validate", validateCommand],
  ["validate-frontmatter", validateFrontmatterCommand],
  ["audit", audit],
  ["init", initCommand],
  ["migrate", migrateCommand]
]);

const SUPPORTED_FORMATS = new Set(["text", "json", "markdown"]);
const SUPPORTED_AGENTS = new Set(["codex", "claude", "antigravity", "all"]);
const SUPPORTED_EXISTING_POLICIES = new Set(["skip", "overwrite"]);
const ALL_AGENTS = ["codex", "claude", "antigravity"];

export async function main(argv) {
  const { command, options, errors } = parseArgs(argv);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    printHelp();
    process.exitCode = 3;
    return;
  }

  if (!SUPPORTED_FORMATS.has(options.format)) {
    console.error(`Unsupported format: ${options.format}`);
    console.error("Supported formats: text, json, markdown");
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

  const result = await handler(options);
  await printResult(result, options);
  process.exitCode = exitCodeFor(result, options);
}

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const errors = [];
  const options = {
    cwd: process.cwd(),
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
      const value = readOptionValue(rest, index, arg, errors);
      if (value) {
        options.cwd = path.resolve(value);
        index += 1;
      }
    } else if (arg === "--type") {
      const value = readOptionValue(rest, index, arg, errors);
      if (value) {
        options.type = value;
        index += 1;
      }
    } else if (arg === "--profile") {
      const value = readOptionValue(rest, index, arg, errors);
      if (value) {
        options.profiles.push(value);
        index += 1;
      }
    } else if (arg === "--agent") {
      const value = readOptionValue(rest, index, arg, errors);
      if (value) {
        options.agents.push(value);
        index += 1;
      }
    } else if (arg === "--format") {
      const value = readOptionValue(rest, index, arg, errors);
      if (value) {
        options.format = value;
        index += 1;
      }
    } else if (arg === "--out") {
      const value = readOptionValue(rest, index, arg, errors);
      if (value) {
        options.out = path.resolve(value);
        index += 1;
      }
    } else if (arg === "--existing") {
      const value = readOptionValue(rest, index, arg, errors);
      if (value) {
        options.existing = value;
        index += 1;
      }
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--write") {
      options.write = true;
    } else if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--strict") {
      options.strict = true;
    } else if (arg === "--minimal") {
      options.minimal = true;
    } else if (arg === "--with-adapters") {
      options.withAdapters = true;
    } else if (arg === "--no-adapters") {
      options.withAdapters = false;
      options.agents = [];
    } else if (arg.startsWith("-")) {
      errors.push(`Unknown option: ${arg}`);
    } else {
      errors.push(`Unexpected argument: ${arg}`);
    }
  }

  options.agents = normalizeAgents(options.agents, options.withAdapters, errors);
  if (!SUPPORTED_EXISTING_POLICIES.has(options.existing)) {
    errors.push(`Unsupported existing policy: ${options.existing}`);
  }

  return { command, options, errors };
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
  console.log(`llm-wiki prototype

Usage:
  llm-wiki doctor [--cwd <path>] [--format text|json|markdown]
  llm-wiki validate [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|antigravity|all>...] [--strict] [--format text|json|markdown] [--out <path>]
  llm-wiki validate-frontmatter [--cwd <path>] [--strict]
  llm-wiki audit [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|antigravity|all>...] [--strict] [--format text|json|markdown] [--out <path>]
  llm-wiki init --dry-run [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|antigravity|all>...] [--minimal] [--format text|json|markdown] [--out <path>]
  llm-wiki init --write [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|antigravity|all>...] [--existing skip|overwrite] [--minimal] [--format text|json|markdown] [--out <path>]
  llm-wiki migrate --dry-run [--cwd <path>] [--type <project-type>] [--profile <profile>...] [--agent <codex|claude|antigravity|all>...] [--format text|json|markdown] [--out <path>]

Safety:
  init writes only when --write is explicit. Existing wiki docs default to --existing skip.
  Existing adapter files are never overwritten. migrate --apply remains blocked.
  Adapter checks and suggestions are opt-in with --agent. ANTIGRAVITY.md remains an info-level candidate.
`);
}
