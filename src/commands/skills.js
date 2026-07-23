// Skill/automation-prompt artifact generation (Gate 21, 1.15.0). Packages the
// wiki-grounded bootstrap/feature/fix/docs-sync workflows already in task-prompts.js
// as invocable agent artifacts, in each agent's native shape:
//   - Claude Code skill  .claude/skills/llm-wiki-<task>/SKILL.md
//   - Codex skill        .agents/skills/llm-wiki-<task>/SKILL.md
//   - Cursor rule        .cursor/rules/llm-wiki-<task>.mdc
//   - Agent-neutral      .llm-wiki/prompts/llm-wiki-<task>.md  (any other agent)
// Each body embeds a generation-time snapshot of the project's domain map (from the
// generated wiki) so the agent knows which docs to read. Recognize-don't-run: this
// module only WRITES the artifacts; the agent runs them. Existing files are never
// overwritten. Depends only on the Node stdlib, files.js, encoding.js, frontmatter.js,
// and task-prompts.js; no back-dependency on commands.js.
import { mkdir, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathExists, toPosix } from "../files.js";
import { readUtf8 } from "../encoding.js";
import { parseFrontmatter } from "../frontmatter.js";
import { buildTaskPrompt } from "../task-prompts.js";
import { normalizeLang } from "../i18n.js";

// Bumped when the generated skill format changes. Recorded in each artifact's
// trailing marker (informational — refresh detection uses the content hash, not
// this version). See withGeneratedMarker / isManagedUnmodified.
const SKILL_ARTIFACT_VERSION = "2";

// The workflows exposed as skills, and their invocable slug/description.
export const SKILL_TASKS = [
  { task: "bootstrap", slug: "llm-wiki-bootstrap", description: "Enrich a newly initialized LLM-WIKI from actual source evidence while keeping documents needs_review." },
  { task: "onboard", slug: "llm-wiki-onboard", description: "Guide a newcomer through a work area from real code evidence, using the project's LLM-WIKI (read-only)." },
  { task: "prepare", slug: "llm-wiki-prepare", description: "Scope a feature/fix from the LLM-WIKI (relevant docs, source, tests, risks) before implementing (read-only)." },
  { task: "feature", slug: "llm-wiki-feature", description: "Add or modify a feature grounded in the project's LLM-WIKI, then update the wiki (needs_review)." },
  { task: "fix", slug: "llm-wiki-fix", description: "Fix a bug grounded in the project's LLM-WIKI, then update the wiki (needs_review)." },
  { task: "docs-sync", slug: "llm-wiki-docs-sync", description: "Sync LLM-WIKI docs with recent code changes (needs_review)." }
];

// Read-only guided tasks: they investigate/explain but never change files, so they
// carry NO Gate 26 run manifest (nothing changed to record) — a read-only note
// replaces the completion contract in their skill body.
const READ_ONLY_TASKS = new Set(["onboard", "prepare"]);

// Which artifact formats to emit for the given agents/options. Skills are opt-in:
// active only when --skills is set or a native-skill agent (claude/codex/cursor) is
// selected. --skills emits every native format; a specific --agent emits that agent's
// native format. The agent-neutral prompt always accompanies any emission so other
// agents are covered. Returns a Set of "claude" | "codex" | "cursor" | "neutral".
export function selectedSkillFormats(agents, options) {
  const formats = new Set();
  const explicit = Boolean(options && options.skills);
  if (explicit || agents.includes("claude")) formats.add("claude");
  if (explicit || agents.includes("codex")) formats.add("codex");
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
// Retained for the `bootstrap` skill only — first-time enrichment benefits from
// knowing exactly which skeleton domain docs to fill. Feature/fix/docs-sync use the
// live run-time map instead (liveWikiMapSection). Best-effort and deterministic.
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

// For feature/fix/docs-sync (and the read-only guided tasks): instead of baking a
// generation-time domain-map SNAPSHOT into every skill (which goes stale and
// inflates the fixed prompt), point the agent at the LIVE wiki map it should
// assemble at run time — reusing the compact retrieval so the map is always current
// and the fixed body stays small.
function liveWikiMapSection(task) {
  const step = READ_ONLY_TASKS.has(task)
    ? "`llm-wiki onboard` (add --domain <area>)"
    : "`llm-wiki prepare --task \"<the task>\" --compact` (or `llm-wiki onboard --domain <area>`)";
  return `Get the current wiki map at RUN TIME (not a snapshot): run ${step}, then read the docs it points to and confirm against the source.`;
}

// --- refresh markers -----------------------------------------------------
// Each generated artifact carries a trailing marker holding the hash of its own
// body. `--refresh` overwrites an artifact only when it is still an unmodified
// package-generated file (its body hashes to the value in its marker); a
// user-edited or foreign file has no matching hash and is never overwritten.
const GENERATED_MARKER_RE = /\n<!-- llm-wiki-generated v\S+ ([0-9a-f]{16}) -->\n?$/;

function contentHash(text) {
  return createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
}

function withGeneratedMarker(content) {
  return `${content}\n<!-- llm-wiki-generated v${SKILL_ARTIFACT_VERSION} ${contentHash(content)} -->\n`;
}

function stripMarker(content) {
  return content.replace(GENERATED_MARKER_RE, "");
}

// True iff `fileContent` is an unmodified package-generated artifact: it carries
// our marker AND the body-minus-marker hashes to the value stored in the marker.
function isManagedUnmodified(fileContent) {
  const match = fileContent.match(GENERATED_MARKER_RE);
  if (!match) return false;
  return contentHash(stripMarker(fileContent)) === match[1];
}

// The shared artifact body: the wiki-map step (a generation-time snapshot for
// bootstrap; the live run-time map for the rest), the reusable wiki-grounded
// workflow from task-prompts.js, then the Gate 26 completion contract (a run
// manifest the agent writes so `llm-wiki check-run` can verify the pipeline).
async function artifactBody(cwd, task, detection, docLang = "en") {
  const built = buildTaskPrompt({
    // The artifact is committed to the repo and invoked from its root, so the body
    // must not bake in the generating machine's absolute path (non-portable, and it
    // would leak the local username). "." keeps the workspace reference repo-relative.
    task,
    cwd: ".",
    projectType: detection?.projectType ?? "unknown",
    profiles: detection?.activeProfiles ?? [],
    agents: [],
    docLang
  });
  const mapSection = task === "bootstrap"
    ? domainMapSection(await readDomainMap(cwd))
    : liveWikiMapSection(task);
  const closing = READ_ONLY_TASKS.has(task) ? readOnlyNote() : manifestContractSection(task);
  return `${mapSection}\n\n${forArtifact(built.prompt)}\n\n${closing}\n`;
}

// Closing note for read-only skills (onboard/prepare): no run manifest, no writes.
function readOnlyNote() {
  return `Read-only workflow: this skill investigates and explains — it does not change files, and it writes no run manifest. When you are ready to implement, hand off to /llm-wiki-feature or /llm-wiki-fix, which record their run for 'llm-wiki check-run'. Never promote a document to verified; that is human-approved only.`;
}

// Gate 26 completion contract embedded in each skill body: after the run, the agent
// writes a small run manifest so a read-only `llm-wiki check-run` can confirm the
// code change was reflected in the wiki (no backticks in the body — the artifact is
// plain Markdown pasted into an agent). Records intent; never replaces human review.
function manifestContractSection(task) {
  return `Completion contract (Gate 26 — enables 'llm-wiki check-run'): after finishing, write .llm-wiki/runs/run-${task}-<timestamp>.json with fields: task="${task}", changedSource[] (source files you edited), touchedDocs[] (docs/llm-wiki/* you updated), logAppended (bool), validated {ran, result}. Then run 'llm-wiki check-run' to confirm each changed source is referenced by a touched doc, the log was appended, and validate passed. This records what the run did — it never replaces human review and never promotes a document to verified.`;
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

// Codex native skill: .agents/skills/<name>/SKILL.md with name/description
// frontmatter. Same shape as the Claude skill body (both are SKILL.md contracts).
function renderCodexSkill(entry, body) {
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
  if (formats.has("codex")) targets.push({ format: "codex", path: `.agents/skills/${entry.slug}/SKILL.md`, render: renderCodexSkill });
  if (formats.has("cursor")) targets.push({ format: "cursor", path: `.cursor/rules/${entry.slug}.mdc`, render: renderCursorRule });
  if (formats.has("neutral")) targets.push({ format: "neutral", path: `.llm-wiki/prompts/${entry.slug}.md`, render: renderNeutralPrompt });
  return targets;
}

// Dry-run: classify each artifact as create / refresh / keep, without writing.
// Read-only. Without --refresh, existing files are always kept (byte-identical to
// the pre-refresh behavior aside from the message wording). With --refresh, a
// managed-and-unmodified file that has drifted from the current template is
// planned for refresh; a user-modified or foreign file is kept (conflict).
export async function planSkillArtifacts(cwd, agents, detection, options) {
  const formats = selectedSkillFormats(agents, options);
  const planned = [];
  const skipped = [];
  if (formats.size === 0) return { planned, skipped };
  const refresh = Boolean(options && options.refresh);
  const docLang = normalizeLang(options && options.docLang);
  for (const entry of SKILL_TASKS) {
    const body = await artifactBody(cwd, entry.task, detection, docLang);
    for (const target of artifactTargets(formats, entry)) {
      const absolutePath = path.join(cwd, target.path);
      if (!(await pathExists(absolutePath))) {
        planned.push(`${target.path} would be created (llm-wiki ${entry.task} skill; ${target.format}).`);
        continue;
      }
      if (!refresh) {
        skipped.push(`${target.path} exists; would not overwrite (use --refresh to update managed skills).`);
        continue;
      }
      const current = await readUtf8(absolutePath);
      const next = withGeneratedMarker(target.render(entry, body));
      if (!isManagedUnmodified(current)) {
        skipped.push(`${target.path} was modified (or is not a managed artifact); would keep it (conflict).`);
      } else if (stripMarker(current) === stripMarker(next)) {
        skipped.push(`${target.path} is already up to date.`);
      } else {
        planned.push(`${target.path} would be refreshed (managed artifact; llm-wiki ${entry.task} skill; ${target.format}).`);
      }
    }
  }
  return { planned, skipped };
}

// Write the artifacts. Without --refresh, an existing file is NEVER overwritten
// (the original safety contract). With --refresh, an existing file is overwritten
// ONLY when it is still an unmodified package-generated artifact (its body hashes
// to the value in its own trailing marker); a user-modified or foreign file is
// kept and reported as a conflict, and an up-to-date managed file is left
// unchanged. Every written artifact carries a fresh marker. Returns created/skipped
// message lists (refreshes are reported under created; conflicts under skipped).
export async function writeSkillArtifacts(cwd, agents, detection, options) {
  const formats = selectedSkillFormats(agents, options);
  const created = [];
  const skipped = [];
  if (formats.size === 0) return { created, skipped };
  const refresh = Boolean(options && options.refresh);
  const docLang = normalizeLang(options && options.docLang);
  for (const entry of SKILL_TASKS) {
    const body = await artifactBody(cwd, entry.task, detection, docLang);
    for (const target of artifactTargets(formats, entry)) {
      const absolutePath = path.join(cwd, target.path);
      const content = withGeneratedMarker(target.render(entry, body));
      if (await pathExists(absolutePath)) {
        if (!refresh) {
          skipped.push(`${target.path} exists; kept existing file and did not overwrite it (use --refresh to update managed skills).`);
          continue;
        }
        const current = await readUtf8(absolutePath);
        if (!isManagedUnmodified(current)) {
          skipped.push(`${target.path} was modified (or is not a managed artifact); kept existing file (conflict — remove it and re-run to regenerate).`);
          continue;
        }
        if (stripMarker(current) === stripMarker(content)) {
          skipped.push(`${target.path} is already up to date; left unchanged.`);
          continue;
        }
        await writeFile(absolutePath, content, { encoding: "utf8" });
        created.push(`${target.path} refreshed (managed artifact; llm-wiki ${entry.task} skill; ${target.format}).`);
        continue;
      }
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, content, { encoding: "utf8" });
      created.push(`${target.path} created (llm-wiki ${entry.task} skill; ${target.format}).`);
    }
  }
  return { created, skipped };
}
