// Skill/automation-prompt artifact generation (Gate 21, 1.15.0). Packages the
// wiki-grounded feature/fix/docs-sync workflows already in task-prompts.js as
// invocable agent artifacts, in each agent's native shape:
//   - Claude Code skill  .claude/skills/llm-wiki-<task>/SKILL.md
//   - Cursor rule        .cursor/rules/llm-wiki-<task>.mdc
//   - Agent-neutral      .llm-wiki/prompts/llm-wiki-<task>.md  (Codex / any agent)
// Each body embeds a generation-time snapshot of the project's domain map (from the
// generated wiki) so the agent knows which docs to read. Recognize-don't-run: this
// module only WRITES the artifacts; the agent runs them. Existing files are never
// overwritten. Depends only on the Node stdlib, files.js, encoding.js, frontmatter.js,
// and task-prompts.js; no back-dependency on commands.js.
import { mkdir, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathExists, toPosix } from "../files.js";
import { readUtf8 } from "../encoding.js";
import { parseFrontmatter } from "../frontmatter.js";
import { buildTaskPrompt } from "../task-prompts.js";

// The workflows exposed as skills, and their invocable slug/description.
export const SKILL_TASKS = [
  { task: "feature", slug: "llm-wiki-feature", description: "Add or modify a feature grounded in the project's LLM-WIKI, then update the wiki (needs_review)." },
  { task: "fix", slug: "llm-wiki-fix", description: "Fix a bug grounded in the project's LLM-WIKI, then update the wiki (needs_review)." },
  { task: "docs-sync", slug: "llm-wiki-docs-sync", description: "Sync LLM-WIKI docs with recent code changes (needs_review)." }
];

// Which artifact formats to emit for the given agents/options. Skills are opt-in:
// active only when --skills is set or a claude/cursor agent is selected. The
// agent-neutral prompt always accompanies any emission so Codex/other agents are
// covered. Returns a Set of "claude" | "cursor" | "neutral".
export function selectedSkillFormats(agents, options) {
  const formats = new Set();
  const explicit = Boolean(options && options.skills);
  if (explicit || agents.includes("claude")) formats.add("claude");
  if (explicit || agents.includes("cursor")) formats.add("cursor");
  if (formats.size > 0) formats.add("neutral");
  return formats;
}

// Whether any skill artifact would be emitted for this invocation.
export function skillsRequested(agents, options) {
  return selectedSkillFormats(agents, options).size > 0;
}

// Generation-time snapshot of the project's domain map: the enriched domain docs
// under docs/llm-wiki/domains (excluding the aggregator overview), by title + path.
// Best-effort and deterministic; returns [] when there are no domain docs.
async function readDomainMap(cwd) {
  const dir = path.join(cwd, "docs", "llm-wiki", "domains");
  if (!(await pathExists(dir))) return [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const docs = [];
  for (const entry of entries.filter((e) => e.isFile() && e.name.endsWith(".md")).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === "00_overview.md") continue;
    const rel = `docs/llm-wiki/domains/${entry.name}`;
    let title = entry.name.replace(/\.md$/, "");
    try {
      const fm = parseFrontmatter(await readUtf8(path.join(dir, entry.name))).frontmatter;
      if (fm && typeof fm.title === "string" && fm.title.trim()) title = fm.title.trim();
    } catch {
      // unreadable frontmatter — fall back to the filename-derived title
    }
    docs.push({ title, rel });
  }
  return docs;
}

function domainMapSection(domains) {
  if (!domains.length) {
    return "Project domain map: none detected yet — read docs/llm-wiki/index.md and browse docs/llm-wiki/domains/ to find the relevant area.";
  }
  return ["Project domain map (read the relevant one(s) FIRST before editing):", ...domains.map((d) => `- ${d.title} — ${d.rel}`)].join("\n");
}

// The shared artifact body: the project domain-map snapshot followed by the reusable
// wiki-grounded workflow from task-prompts.js.
async function artifactBody(cwd, task, detection) {
  const domains = await readDomainMap(cwd);
  const built = buildTaskPrompt({
    // The artifact is committed to the repo and invoked from its root, so the body
    // must not bake in the generating machine's absolute path (non-portable, and it
    // would leak the local username). "." keeps the workspace reference repo-relative.
    task,
    cwd: ".",
    projectType: detection?.projectType ?? "unknown",
    profiles: detection?.activeProfiles ?? [],
    agents: []
  });
  return `${domainMapSection(domains)}\n\n${forArtifact(built.prompt)}\n`;
}

// task-prompts.js is written for one-shot terminal output; strip the two bits that
// don't belong in a committed, agent-invoked artifact: the ephemeral "Workspace:"
// block (the agent already runs in the repo) and the generic "Target agent context:"
// clause (the artifact IS the agent's). The task workflow itself is unchanged.
function forArtifact(prompt) {
  return prompt
    .replace(/\n\nWorkspace:\n[^\n]*\n/, "\n")
    .replace(/ Target agent context: [^.\n]*\./, "");
}

function renderClaudeSkill(entry, body) {
  return `---\nname: ${entry.slug}\ndescription: ${entry.description}\n---\n\n${body}`;
}

function renderCursorRule(entry, body) {
  return `---\ndescription: ${entry.description}\nalwaysApply: false\n---\n\n${body}`;
}

function renderNeutralPrompt(entry, body) {
  return `# ${entry.slug}\n\n> Paste this prompt into your coding agent (Codex or any other) to run the workflow below. It is an instruction for the agent, not run by the CLI.\n\n${body}`;
}

// Plan/write helpers return { path, content } artifacts for the active formats.
function artifactTargets(formats, entry) {
  const targets = [];
  if (formats.has("claude")) targets.push({ format: "claude", path: `.claude/skills/${entry.slug}/SKILL.md`, render: renderClaudeSkill });
  if (formats.has("cursor")) targets.push({ format: "cursor", path: `.cursor/rules/${entry.slug}.mdc`, render: renderCursorRule });
  if (formats.has("neutral")) targets.push({ format: "neutral", path: `.llm-wiki/prompts/${entry.slug}.md`, render: renderNeutralPrompt });
  return targets;
}

// Dry-run: list what would be created / kept, without writing. Read-only.
export async function planSkillArtifacts(cwd, agents, detection, options) {
  const formats = selectedSkillFormats(agents, options);
  const planned = [];
  const skipped = [];
  if (formats.size === 0) return { planned, skipped };
  for (const entry of SKILL_TASKS) {
    const body = await artifactBody(cwd, entry.task, detection);
    for (const target of artifactTargets(formats, entry)) {
      if (await pathExists(path.join(cwd, target.path))) {
        skipped.push(`${target.path} exists; would not overwrite.`);
      } else {
        planned.push(`${target.path} would be created (llm-wiki ${entry.task} skill; ${target.format}).`);
      }
      void body; // body is computed to fail fast if task-prompts break; content is written in writeSkillArtifacts
    }
  }
  return { planned, skipped };
}

// Write the artifacts. Never overwrites an existing file. Read-once/write-once;
// returns created/skipped message lists.
export async function writeSkillArtifacts(cwd, agents, detection, options) {
  const formats = selectedSkillFormats(agents, options);
  const created = [];
  const skipped = [];
  if (formats.size === 0) return { created, skipped };
  for (const entry of SKILL_TASKS) {
    const body = await artifactBody(cwd, entry.task, detection);
    for (const target of artifactTargets(formats, entry)) {
      const absolutePath = path.join(cwd, target.path);
      if (await pathExists(absolutePath)) {
        skipped.push(`${target.path} exists; kept existing file and did not overwrite it.`);
        continue;
      }
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, target.render(entry, body), { encoding: "utf8" });
      created.push(`${target.path} created (llm-wiki ${entry.task} skill; ${target.format}).`);
    }
  }
  return { created, skipped };
}
