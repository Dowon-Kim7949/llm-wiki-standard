// Adapter targets (per-agent instruction files) and their scan/plan/write/status
// helpers, extracted from commands.js on 2026-07-16 (behavior-preserving refactor,
// GATE_REVIEW stabilization). ADAPTER_TARGETS is the single registry of supported
// agent adapters (Codex/Claude/Cursor/...); the helpers check, suggest, create,
// and summarize those files. Depends only on the Node stdlib, files.js,
// encoding.js, and sensitive-info.js; no back-dependency on commands.js.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathExists } from "../files.js";
import { readUtf8 } from "../encoding.js";
import { scanSensitiveInfo } from "../sensitive-info.js";

const TEMPLATE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "templates");

export const ADAPTER_TARGETS = {
  codex: {
    path: "AGENTS.md",
    template: path.join(TEMPLATE_ROOT, "adapters", "codex", "AGENTS.md"),
    writable: true,
    handoffLabel: "Codex",
    missingSeverity: "warning",
    missingMessage: "Codex adapter file is missing; init --dry-run can suggest AGENTS.md and init --write can create it when absent."
  },
  claude: {
    path: "CLAUDE.md",
    template: path.join(TEMPLATE_ROOT, "adapters", "claude-code", "CLAUDE.md"),
    writable: true,
    handoffLabel: "Claude Code",
    missingSeverity: "warning",
    missingMessage: "Claude Code adapter file is missing; init --dry-run can suggest CLAUDE.md and init --write can create it when absent."
  },
  cursor: {
    path: ".cursor/rules/llm-wiki.mdc",
    template: path.join(TEMPLATE_ROOT, "adapters", "cursor", "llm-wiki.mdc"),
    writable: true,
    handoffLabel: "Cursor",
    missingSeverity: "warning",
    missingMessage: "Cursor adapter file is missing; init --dry-run can suggest .cursor/rules/llm-wiki.mdc and init --write can create it when absent."
  },
  copilot: {
    path: ".github/copilot-instructions.md",
    template: path.join(TEMPLATE_ROOT, "adapters", "copilot", "copilot-instructions.md"),
    writable: true,
    handoffLabel: "GitHub Copilot",
    missingSeverity: "warning",
    missingMessage: "GitHub Copilot adapter file is missing; init --dry-run can suggest .github/copilot-instructions.md and init --write can create it when absent."
  },
  windsurf: {
    path: ".windsurf/rules/llm-wiki.md",
    template: path.join(TEMPLATE_ROOT, "adapters", "windsurf", "llm-wiki.md"),
    writable: true,
    handoffLabel: "Windsurf",
    missingSeverity: "warning",
    missingMessage: "Windsurf adapter file is missing; init --dry-run can suggest .windsurf/rules/llm-wiki.md and init --write can create it when absent."
  },
  gemini: {
    path: "GEMINI.md",
    template: path.join(TEMPLATE_ROOT, "adapters", "gemini", "GEMINI.md"),
    writable: true,
    handoffLabel: "Gemini CLI",
    missingSeverity: "warning",
    missingMessage: "Gemini adapter file is missing; init --dry-run can suggest GEMINI.md and init --write can create it when absent."
  },
  jetbrains: {
    path: ".junie/guidelines.md",
    template: path.join(TEMPLATE_ROOT, "adapters", "jetbrains", "guidelines.md"),
    writable: false,
    missingSeverity: "info",
    missingMessage: "JetBrains AI adapter path is unconfirmed; keep .junie/guidelines.md as an info-level candidate only."
  },
  antigravity: {
    path: "ANTIGRAVITY.md",
    template: path.join(TEMPLATE_ROOT, "adapters", "antigravity", "ANTIGRAVITY.md"),
    writable: false,
    missingSeverity: "info",
    missingMessage: "Antigravity adapter filename is unconfirmed; keep ANTIGRAVITY.md as an info-level candidate only."
  }
};

export async function scanAdapters(cwd, agents) {
  const findings = [];
  for (const agent of agents) {
    const target = ADAPTER_TARGETS[agent];
    if (!target) continue;
    const rel = target.path;
    const file = path.join(cwd, rel);
    if (!(await pathExists(file))) {
      findings.push({ severity: target.missingSeverity, rule: "adapter.missing", path: rel, message: target.missingMessage });
      continue;
    }

    const content = await readUtf8(file);
    if (!content.includes("docs/llm-wiki/index.md")) {
      findings.push({ severity: "warning", rule: "adapter.entrypoint", path: rel, message: "Adapter should point to docs/llm-wiki/index.md." });
    }
  }
  return findings;
}

export async function planAdapterSuggestions(cwd, agents) {
  const planned = [];
  const skipped = [];

  for (const agent of agents) {
    const target = ADAPTER_TARGETS[agent];
    if (!target) continue;

    const fileExists = await pathExists(path.join(cwd, target.path));
    if (fileExists) {
      skipped.push(`${target.path} exists; would not overwrite. Adapter entrypoint would be checked for ${agent}.`);
      continue;
    }

    if (!target.writable) {
      planned.push(`${target.path} remains an info-level adapter candidate for ${agent}; no file would be created until the tool contract is confirmed.`);
      continue;
    }

    planned.push(`${target.path} adapter would be suggested from templates/adapters for ${agent}; no file would be written in dry-run.`);
  }

  return { planned, skipped };
}

export async function writeAdapterFiles(cwd, agents) {
  const created = [];
  const skipped = [];
  const blocked = [];

  for (const agent of agents) {
    const target = ADAPTER_TARGETS[agent];
    if (!target) continue;

    if (!target.writable) {
      skipped.push(`${target.path} remains an info-level adapter candidate; no file was created because the ${agent} tool contract is unconfirmed.`);
      continue;
    }

    const absolutePath = path.join(cwd, target.path);
    if (await pathExists(absolutePath)) {
      skipped.push(`${target.path} exists; kept existing adapter file and did not overwrite it.`);
      continue;
    }

    const content = await readUtf8(target.template);
    const sensitiveFindings = scanSensitiveInfo(content);
    if (sensitiveFindings.length > 0) {
      blocked.push(`${target.path} was not written because generated content matched sensitive-info rules.`);
      continue;
    }

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, { encoding: "utf8" });
    created.push(`${target.path} created for ${agent}.`);
  }

  return { created, skipped, blocked };
}

export async function summarizeAdapterStatus(cwd, agents) {
  const statuses = [];
  for (const agent of agents) {
    const target = ADAPTER_TARGETS[agent];
    if (!target) continue;

    const exists = await pathExists(path.join(cwd, target.path));
    if (exists) {
      statuses.push(`${agent}: ${target.path} present`);
    } else if (!target.writable) {
      statuses.push(`${agent}: ${target.path} candidate only; tool contract unconfirmed`);
    } else {
      statuses.push(`${agent}: ${target.path} missing`);
    }
  }
  return statuses;
}

export function selectedAgents(options) {
  if (options.agents?.length) return options.agents;
  if (options.withAdapters) return Object.keys(ADAPTER_TARGETS);
  return [];
}
