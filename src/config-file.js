import path from "node:path";
import { pathExists } from "./files.js";
import { readUtf8 } from "./encoding.js";

export const CONFIG_FILENAME = "llm-wiki.config.json";

// Allowed values for a per-project rule toggle in `rules`: "off" disables the
// rule; the others override its severity. Enforced here so a malformed toggle is
// reported like any other config error. The applier (src/commands.js) additionally
// refuses to toggle safety rules (the sensitive-info category).
export const RULE_TOGGLE_ACTIONS = new Set(["off", "blocked", "error", "warning", "info"]);

// Conservative v1 schema: persistent defaults that mirror existing CLI options.
// Unknown keys are ignored so the contract can grow without breaking old files.
export async function loadProjectConfig(cwd) {
  const file = path.join(cwd, CONFIG_FILENAME);
  if (!(await pathExists(file))) {
    return { found: false, config: null, errors: [] };
  }

  let parsed;
  try {
    parsed = JSON.parse(await readUtf8(file));
  } catch {
    return { found: true, config: null, errors: [`${CONFIG_FILENAME} is not valid JSON.`] };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { found: true, config: null, errors: [`${CONFIG_FILENAME} must be a JSON object.`] };
  }

  const errors = [];
  const config = {};

  if ("type" in parsed) {
    if (typeof parsed.type !== "string") errors.push(`${CONFIG_FILENAME}: "type" must be a string.`);
    else config.type = parsed.type;
  }

  for (const field of ["profiles", "agents"]) {
    if (field in parsed) {
      if (!Array.isArray(parsed[field]) || parsed[field].some((value) => typeof value !== "string")) {
        errors.push(`${CONFIG_FILENAME}: "${field}" must be an array of strings.`);
      } else {
        config[field] = parsed[field];
      }
    }
  }

  if ("strict" in parsed) {
    if (typeof parsed.strict !== "boolean") errors.push(`${CONFIG_FILENAME}: "strict" must be a boolean.`);
    else config.strict = parsed.strict;
  }

  if ("rules" in parsed) {
    const rules = parsed.rules;
    if (rules === null || typeof rules !== "object" || Array.isArray(rules)) {
      errors.push(`${CONFIG_FILENAME}: "rules" must be an object mapping rule ids to a severity or "off".`);
    } else {
      const bad = Object.entries(rules).filter(([, value]) => !RULE_TOGGLE_ACTIONS.has(value));
      if (bad.length > 0) {
        errors.push(`${CONFIG_FILENAME}: "rules" values must be one of ${[...RULE_TOGGLE_ACTIONS].join(", ")} (invalid: ${bad.map(([key]) => key).join(", ")}).`);
      } else {
        config.rules = { ...rules };
      }
    }
  }

  if ("requiredDocs" in parsed) {
    const docs = parsed.requiredDocs;
    if (!Array.isArray(docs) || docs.some((value) => typeof value !== "string")) {
      errors.push(`${CONFIG_FILENAME}: "requiredDocs" must be an array of document path strings.`);
    } else {
      config.requiredDocs = [...docs];
    }
  }

  if ("templates" in parsed) {
    const templates = parsed.templates;
    if (templates === null || typeof templates !== "object" || Array.isArray(templates)) {
      errors.push(`${CONFIG_FILENAME}: "templates" must be an object mapping wiki doc paths to template file paths.`);
    } else if (Object.values(templates).some((value) => typeof value !== "string")) {
      errors.push(`${CONFIG_FILENAME}: "templates" values must be template file path strings.`);
    } else {
      config.templates = { ...templates };
    }
  }

  return { found: true, config, errors };
}

// Explicit CLI flags win; config fills only what the CLI left unset.
// strict is additive (config can turn it on; the CLI has no way to turn it off).
export function mergeConfigIntoOptions(options, config) {
  if (!config) return options;

  if (options.type == null && config.type != null) {
    options.type = config.type;
  }
  if ((!options.profiles || options.profiles.length === 0) && Array.isArray(config.profiles)) {
    options.profiles = [...config.profiles];
  }
  if ((!options.agents || options.agents.length === 0) && Array.isArray(config.agents)) {
    options.agents = [...config.agents];
  }
  if (config.strict) {
    options.strict = true;
  }
  if (options.lang == null && (config.lang === "ko" || config.lang === "en")) {
    options.lang = config.lang;
  }
  if (config.rules && (!options.rules || Object.keys(options.rules).length === 0)) {
    options.rules = { ...config.rules };
  }
  if (Array.isArray(config.requiredDocs) && (!options.requiredDocs || options.requiredDocs.length === 0)) {
    options.requiredDocs = [...config.requiredDocs];
  }
  if (config.templates && (!options.templates || Object.keys(options.templates).length === 0)) {
    options.templates = { ...config.templates };
  }

  return options;
}
