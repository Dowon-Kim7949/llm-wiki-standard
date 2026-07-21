// Public programmatic API for llm-wiki-governance.
//
// This module is the package's importable entry point (package.json "exports").
// It lets CI wrappers, editors, and tests run LLM-WIKI in-process instead of
// spawning the `llm-wiki` binary. The command surface here mirrors the CLI
// (src/cli.js COMMANDS) one-to-one; each command is an async function that takes
// a normalized options object and resolves to a plain result object.
//
// Stability (see docs/llm-wiki/PUBLIC_API.md, "Programmatic API"):
//   - `commands` keys, the individual function exports, `SCHEMA_VERSION`, and the
//     shared result fields (`command`, `result`, `findings`, `text`) are the
//     stable contract. Per-command payload fields follow the same additive
//     SemVer policy as the CLI `--format json` output.
//   - `SCHEMA_VERSION` matches the `schemaVersion` field stamped into every
//     `--format json` report, so a wrapper can pin the same contract whether it
//     shells out or imports.

import path from "node:path";
import {
  audit,
  doctor,
  driftCommand,
  explainCommand,
  fixCommand,
  getDocCommand,
  getRelatedCommand,
  graphCommand,
  handoffCommand,
  impactCommand,
  initCommand,
  listDocsCommand,
  migrateCommand,
  monorepoCommand,
  nextCommand,
  promptCommand,
  quickstartCommand,
  releaseNotesCommand,
  searchDocsCommand,
  statsCommand,
  statusCommand,
  validateCommand,
  validateFrontmatterCommand
} from "./commands.js";
import { applyProjectConfig, defaultOptions, main, parseArgs } from "./cli.js";
import { JSON_SCHEMA_VERSION } from "./config.js";
import { startMcpServer } from "./mcp/server.js";
import { handleMessage as handleMcpMessage, MCP_PROTOCOL_VERSION } from "./mcp/dispatch.js";
import { TOOL_DEFS as MCP_TOOLS } from "./mcp/tools.js";

/**
 * A single finding produced by a scan/validation.
 * @typedef {Object} Finding
 * @property {"blocked"|"error"|"warning"|"info"} severity
 * @property {string} rule    Dotted rule id, e.g. "related.missing".
 * @property {string} path    Repo-relative path the finding is anchored to (or ".").
 * @property {string} message Human-readable explanation.
 */

/**
 * The options object every command handler reads. Produce one with
 * {@link normalizeOptions} (or {@link parseArgs}); all fields are always present.
 * @typedef {Object} Options
 * @property {string} cwd            Project root (absolute).
 * @property {string} format         "text"|"json"|"markdown"|"html" ("text"|"json"|"mermaid"|"dot" for graph).
 * @property {string|null} type      Forced project type, or null to auto-detect.
 * @property {string[]} profiles     Extra profiles to activate.
 * @property {string[]} agents       Selected adapter agents.
 * @property {boolean} strict        Treat warnings as failures.
 * @property {boolean} write         init/quickstart/fix write toggle.
 * @property {boolean} apply         migrate apply toggle.
 * @property {boolean} downgrade     drift downgrade toggle.
 * @property {boolean} dryRun        Explicit preview toggle.
 * @property {boolean} minimal       Minimal doc set for init/quickstart.
 * @property {boolean} changed       validate --changed scope.
 * @property {string|null} since     Git ref baseline (validate/release-notes).
 * @property {string|null} version   release-notes version override.
 * @property {string|null} task      prompt task name.
 * @property {string|null} findingRule explain target rule.
 * @property {string|null} query     search-docs query.
 * @property {string|null} docPath   get-doc/get-related target document path.
 * @property {string|null} status    list-docs/search-docs status filter.
 * @property {string|null} visibility list-docs/search-docs visibility filter.
 * @property {string|null} docType   list-docs/search-docs doc_type filter.
 * @property {boolean} includeSensitive Include restricted/sensitive docs in list/search.
 * @property {number|null} limit     search-docs max results.
 * @property {string} existing       "skip"|"overwrite".
 * @property {string|null} out       Report output path, or null.
 */

/**
 * A command result. Every command returns at least these fields; individual
 * commands add their own payload (e.g. `detection`, `wikiGraph`, `stats`,
 * `upgradeReport`, `applied`/`planned`/`skipped`). `text` is the rendered
 * text report and is omitted from JSON files written with `--out`.
 * @typedef {Object} CommandResult
 * @property {string} command                 The command name (discriminator).
 * @property {string} [result]                Overall grade, e.g. "pass"|"warning"|"fail"|"blocked".
 * @property {Finding[]} findings             Findings (may be empty).
 * @property {string} [text]                  Rendered text report.
 * @property {number} [schemaVersion]         Present only on `--format json` output; equals {@link SCHEMA_VERSION}.
 */

/**
 * The `--format json` output contract version. Equal to the `schemaVersion`
 * field stamped into JSON reports. Additive changes keep this number; a breaking
 * shape change bumps it.
 * @type {number}
 */
export const SCHEMA_VERSION = JSON_SCHEMA_VERSION;

/**
 * Command handlers keyed by their CLI command name. Frozen: the key set is part
 * of the stable contract.
 * @type {Readonly<Record<string, (options: Options) => Promise<CommandResult>>>}
 */
export const commands = Object.freeze({
  doctor,
  validate: validateCommand,
  "validate-frontmatter": validateFrontmatterCommand,
  monorepo: monorepoCommand,
  status: statusCommand,
  next: nextCommand,
  explain: explainCommand,
  audit,
  quickstart: quickstartCommand,
  handoff: handoffCommand,
  prompt: promptCommand,
  init: initCommand,
  migrate: migrateCommand,
  fix: fixCommand,
  drift: driftCommand,
  impact: impactCommand,
  graph: graphCommand,
  stats: statsCommand,
  "list-docs": listDocsCommand,
  "search-docs": searchDocsCommand,
  "get-doc": getDocCommand,
  "get-related": getRelatedCommand,
  "release-notes": releaseNotesCommand
});

/**
 * Build a complete {@link Options} object from a partial override. Fills every
 * default so a command can be called directly, and resolves `cwd` to an absolute
 * path. Does not parse CLI flags — use {@link parseArgs} for argv.
 *
 * As a convenience it also accepts a {@link parseArgs} result directly: if the
 * argument carries an `options` object (the `{ command, options, errors }`
 * shape), that nested `options` is used as the override source. This makes both
 * `normalizeOptions(parseArgs(argv))` and `normalizeOptions(parseArgs(argv).options)`
 * produce the same result, instead of the whole parse result silently falling
 * back to defaults.
 * @param {Partial<Options> | { options: Partial<Options> }} [overrides]
 * @returns {Options}
 */
export function normalizeOptions(overrides = {}) {
  const source = overrides && typeof overrides.options === "object" && overrides.options !== null
    ? overrides.options
    : overrides;
  const options = { ...defaultOptions(), ...source };
  if (typeof options.cwd === "string") options.cwd = path.resolve(options.cwd);
  return options;
}

/**
 * Config-aware companion to {@link normalizeOptions}. Builds a full options
 * object, then loads the project's `llm-wiki.config.json` (from `cwd`) and merges
 * it in — the same resolution the `llm-wiki` binary performs — so in-process
 * callers and the MCP server get the same effective options the CLI would.
 * Explicit/override values win; config only fills what was left unset and can
 * additively turn `strict` on. Async because it reads the config file. Returns
 * the resolved options plus any config `errors` (malformed JSON, invalid field,
 * or an invalid config-supplied agent) — the same conditions the CLI exits 3 on;
 * callers decide how to surface them.
 * @param {Partial<Options> | { options: Partial<Options> }} [overrides]
 * @returns {Promise<{ options: Options, errors: string[] }>}
 */
export async function resolveOptions(overrides = {}) {
  const options = normalizeOptions(overrides);
  const { errors } = await applyProjectConfig(options);
  return { options, errors };
}

// Individual command functions, exported under their source names for direct
// import (e.g. `import { audit } from "llm-wiki-governance"`).
export {
  audit,
  doctor,
  driftCommand,
  explainCommand,
  fixCommand,
  getDocCommand,
  getRelatedCommand,
  graphCommand,
  handoffCommand,
  impactCommand,
  initCommand,
  listDocsCommand,
  migrateCommand,
  monorepoCommand,
  nextCommand,
  promptCommand,
  quickstartCommand,
  releaseNotesCommand,
  searchDocsCommand,
  statsCommand,
  statusCommand,
  validateCommand,
  validateFrontmatterCommand
};

// CLI helpers: `parseArgs` for argv, `run` as the full CLI entry (argv -> print
// -> exit code), matching bin/llm-wiki.js.
export { parseArgs };
export { main as run };

// MCP (Model Context Protocol) server surface (1.6). `startMcpServer(options)`
// runs the read-only stdio server (the `llm-wiki mcp` command); `MCP_TOOLS` is
// the frozen read-only tool set exposed over MCP; `handleMcpMessage(msg, ctx)`
// is the pure JSON-RPC dispatcher (transport-agnostic, for tests/wrappers);
// `MCP_PROTOCOL_VERSION` is the advertised MCP protocol version. All MCP tools
// are read-only — no MCP tool writes files. See docs/llm-wiki/PUBLIC_API.md.
export { startMcpServer };
export { handleMcpMessage, MCP_PROTOCOL_VERSION, MCP_TOOLS };
