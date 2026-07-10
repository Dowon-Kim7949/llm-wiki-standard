import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { audit, doctor, explainCommand, handoffCommand, initCommand, migrateCommand, nextCommand, promptCommand, quickstartCommand, statusCommand, validateCommand, validateFrontmatterCommand } from "../src/commands.js";
import { parseArgs } from "../src/cli.js";
import { writeReport } from "../src/report.js";

test("init dry-run works for an empty zero-base project", async () => {
  const cwd = await makeProject("empty-");
  const result = await initCommand({ cwd, dryRun: true, minimal: false, withAdapters: false, type: null });

  assert.equal(result.dryRun, true);
  assert.equal(result.detection.projectType, "unknown");
  assert.ok(result.planned.some((line) => line.includes("docs/llm-wiki/index.md")));
});

test("init dry-run detects frontend projects", async () => {
  const cwd = await makeProject("frontend-");
  await writeJson(path.join(cwd, "package.json"), {
    dependencies: { vue: "^3.0.0" },
    devDependencies: { vite: "^6.0.0" }
  });
  await mkdir(path.join(cwd, "src", "components"), { recursive: true });

  const result = await initCommand({ cwd, dryRun: true, minimal: false, withAdapters: true, type: null });

  assert.equal(result.detection.projectType, "frontend");
  assert.ok(result.planned.some((line) => line.includes("docs/llm-wiki/WCAG.md")));
  assert.ok(result.planned.some((line) => line.includes("AGENTS.md adapter would be suggested")));
  assert.ok(result.planned.some((line) => line.includes("CLAUDE.md adapter would be suggested")));
  assert.ok(result.planned.some((line) => line.includes("ANTIGRAVITY.md remains an info-level adapter candidate")));
});

test("parseArgs supports init write and existing policy", () => {
  const parsed = parseArgs(["init", "--write", "--existing", "overwrite", "--agent", "codex"]);

  assert.equal(parsed.command, "init");
  assert.equal(parsed.options.write, true);
  assert.equal(parsed.options.existing, "overwrite");
  assert.deepEqual(parsed.options.agents, ["codex"]);
  assert.deepEqual(parsed.errors, []);
});

test("parseArgs supports quickstart write and handoff options", () => {
  const quickstart = parseArgs(["quickstart", "--write", "--type", "frontend", "--agent", "codex"]);
  const handoff = parseArgs(["handoff", "--type", "backend", "--profile", "library", "--agent", "claude"]);
  const status = parseArgs(["status", "--agent", "codex"]);
  const next = parseArgs(["next", "--profile", "okf-v0.1", "--agent", "codex", "--strict"]);
  const explain = parseArgs(["explain", "wiki_link.missing", "--format", "json"]);

  assert.equal(quickstart.command, "quickstart");
  assert.equal(quickstart.options.write, true);
  assert.equal(quickstart.options.type, "frontend");
  assert.deepEqual(quickstart.options.agents, ["codex"]);
  assert.deepEqual(quickstart.errors, []);
  assert.equal(handoff.command, "handoff");
  assert.equal(handoff.options.type, "backend");
  assert.deepEqual(handoff.options.profiles, ["library"]);
  assert.deepEqual(handoff.options.agents, ["claude"]);
  assert.deepEqual(handoff.errors, []);
  assert.equal(status.command, "status");
  assert.deepEqual(status.options.agents, ["codex"]);
  assert.deepEqual(status.errors, []);
  assert.equal(next.command, "next");
  assert.deepEqual(next.options.profiles, ["okf-v0.1"]);
  assert.deepEqual(next.options.agents, ["codex"]);
  assert.equal(next.options.strict, true);
  assert.deepEqual(next.errors, []);
  assert.equal(explain.command, "explain");
  assert.equal(explain.options.findingRule, "wiki_link.missing");
  assert.equal(explain.options.format, "json");
  assert.deepEqual(explain.errors, []);
});

test("parseArgs supports prompt task options", () => {
  const parsed = parseArgs(["prompt", "--task", "feature", "--type", "frontend", "--profile", "library", "--agent", "codex", "--format", "json", "--out", "docs/llm-wiki/tasks/feature.prompt.json"]);

  assert.equal(parsed.command, "prompt");
  assert.equal(parsed.options.task, "feature");
  assert.equal(parsed.options.type, "frontend");
  assert.deepEqual(parsed.options.profiles, ["library"]);
  assert.deepEqual(parsed.options.agents, ["codex"]);
  assert.equal(parsed.options.format, "json");
  assert.deepEqual(parsed.errors, []);
});

test("parseArgs rejects conflicting and command-specific options", () => {
  const conflicting = parseArgs(["quickstart", "--dry-run", "--write"]);
  const validateWrite = parseArgs(["validate", "--write"]);
  const handoffExisting = parseArgs(["handoff", "--existing", "overwrite"]);
  const promptMissingTask = parseArgs(["prompt", "--agent", "codex"]);
  const explainMissingFinding = parseArgs(["explain", "--format", "json"]);

  assert.ok(conflicting.errors.includes("Options --dry-run and --write cannot be used together."));
  assert.deepEqual(validateWrite.errors, ["Option --write is not supported by validate."]);
  assert.deepEqual(handoffExisting.errors, ["Option --existing is not supported by handoff."]);
  assert.deepEqual(promptMissingTask.errors, ["Missing required option for prompt: --task."]);
  assert.deepEqual(explainMissingFinding.errors, ["Missing required argument for explain: <finding>."]);
});

test("parseArgs rejects unsupported existing policy", () => {
  const parsed = parseArgs(["init", "--write", "--existing", "merge"]);

  assert.deepEqual(parsed.errors, ["Unsupported existing policy: merge"]);
});

test("quickstart rejects direct dry-run and write conflict", async () => {
  const cwd = await makeProject("quickstart-conflict-");
  const result = await quickstartCommand({
    cwd,
    dryRun: true,
    write: true,
    minimal: false,
    withAdapters: false,
    type: null,
    profiles: [],
    agents: ["codex"],
    existing: "skip"
  });

  assert.equal(result.result, "blocked");
  assert.ok(result.text.includes("Choose either quickstart --dry-run or quickstart --write"));
});

test("quickstart dry-run prints preview handoff wording", async () => {
  const cwd = await makeProject("quickstart-preview-");
  const result = await quickstartCommand({
    cwd,
    dryRun: true,
    write: false,
    minimal: true,
    withAdapters: false,
    type: "frontend",
    profiles: [],
    agents: ["codex"],
    existing: "skip"
  });

  assert.equal(result.dryRun, true);
  assert.ok(result.text.includes("CLI 미리보기가 완료되었습니다. 실제 파일 생성 후 Codex에게 넘어가서 아래 프롬프트를 실행하세요."));
  assert.ok(result.text.includes("validate-frontmatter skipped because no files were written."));
});

test("quickstart writes wiki docs, validates frontmatter, and prints handoff prompt", async () => {
  const cwd = await makeProject("quickstart-");
  await writeJson(path.join(cwd, "package.json"), {
    dependencies: { vue: "^3.0.0" },
    devDependencies: { vite: "^6.0.0" }
  });

  const result = await quickstartCommand({
    cwd,
    dryRun: false,
    write: true,
    minimal: true,
    withAdapters: false,
    type: "frontend",
    profiles: [],
    agents: ["codex"],
    existing: "skip"
  });

  assert.equal(result.command, "quickstart");
  assert.equal(result.result, "pass");
  assert.ok(result.init.created.some((line) => line.includes("docs/llm-wiki/index.md created")));
  assert.ok(result.text.includes("CLI 작업이 완료되었습니다. Codex에게 넘어가서 아래 프롬프트를 실행하세요."));
  assert.ok(result.handoff.prompt.includes("AGENTS.md"));
  assert.ok(result.handoff.prompt.includes("needs_review"));
  assert.ok(result.handoff.prompt.includes("Frontend evidence focus:"));
  assert.ok((await readFile(path.join(cwd, "docs", "llm-wiki", "index.md"), { encoding: "utf8" })).includes("status: needs_review"));
});

test("handoff command prints Claude Code entrypoint without writing files", async () => {
  const cwd = await makeProject("handoff-");
  const result = await handoffCommand({
    cwd,
    dryRun: false,
    write: false,
    minimal: false,
    withAdapters: false,
    type: null,
    profiles: [],
    agents: ["claude"],
    existing: "skip"
  });

  assert.equal(result.command, "handoff");
  assert.equal(result.handoff.label, "Claude Code");
  assert.ok(result.text.includes("Claude Code에게 넘어가서 아래 프롬프트를 실행하세요."));
  assert.ok(result.handoff.prompt.includes("CLAUDE.md"));
  assert.ok(result.handoff.prompt.includes("verified 승인은 하지 말고"));
});

test("handoff command blocks Antigravity until adapter contract is confirmed", async () => {
  const cwd = await makeProject("handoff-antigravity-");
  const result = await handoffCommand({
    cwd,
    dryRun: false,
    write: false,
    minimal: false,
    withAdapters: false,
    type: null,
    profiles: [],
    agents: ["antigravity"],
    existing: "skip"
  });

  assert.equal(result.result, "blocked");
  assert.ok(result.findings.some((finding) => finding.rule === "handoff.unsupported_agent"));
  assert.equal(result.text.includes("Codex 또는 Claude Code에게 넘어가서"), false);
  assert.ok(result.text.includes("handoff는 adapter contract가 확정되지 않아 아직 지원하지 않습니다."));
});

test("handoff prompt includes project-type-specific evidence guidance", async () => {
  const cases = [
    ["frontend", "Frontend evidence focus:", "routes, pages, components"],
    ["backend", "Backend evidence focus:", "API routes, controllers, services"],
    ["fullstack", "Fullstack evidence focus:", "client/server boundaries"],
    ["library", "Library evidence focus:", "public exports"]
  ];

  for (const [projectType, marker, detail] of cases) {
    const cwd = await makeProject(`handoff-${projectType}-`);
    const result = await handoffCommand({
      cwd,
      dryRun: false,
      write: false,
      minimal: false,
      withAdapters: false,
      type: projectType,
      profiles: [],
      agents: ["codex"],
      existing: "skip"
    });

    assert.equal(result.handoff.projectType, projectType);
    assert.ok(result.handoff.prompt.includes(marker));
    assert.ok(result.handoff.prompt.includes(detail));
  }
});

test("handoff report can be written for reviewable prompt storage", async () => {
  const cwd = await makeProject("handoff-out-");
  const out = path.join(cwd, "docs", "llm-wiki", "tasks", "initial-enrichment.prompt.md");
  const result = await handoffCommand({
    cwd,
    dryRun: false,
    write: false,
    minimal: false,
    withAdapters: false,
    type: null,
    profiles: [],
    agents: ["codex"],
    existing: "skip"
  });

  await writeReport(out, result, { format: "text", out });
  const content = await readFile(out, { encoding: "utf8" });

  assert.ok(content.includes("# LLM-WIKI Handoff"));
  assert.ok(content.includes("AGENTS.md와 docs/llm-wiki/index.md"));
  assert.ok(content.includes("status: needs_review"));
});

test("prompt command generates feature task prompt with wiki update workflow", async () => {
  const cwd = await makeProject("prompt-feature-");
  const result = await promptCommand({
    cwd,
    task: "feature",
    type: "frontend",
    profiles: [],
    agents: ["codex"],
    format: "text"
  });

  assert.equal(result.command, "prompt");
  assert.equal(result.result, "pass");
  assert.equal(result.taskPrompt.task, "feature");
  assert.equal(result.taskPrompt.projectType, "frontend");
  assert.deepEqual(result.taskPrompt.agents, ["codex"]);
  assert.ok(result.taskPrompt.prompt.includes("Read docs/llm-wiki/index.md first."));
  assert.ok(result.taskPrompt.prompt.includes("Update every affected LLM-WIKI document"));
  assert.ok(result.taskPrompt.prompt.includes("Append docs/llm-wiki/log.md"));
  assert.ok(result.taskPrompt.prompt.includes("API service name."));
  assert.ok(result.taskPrompt.prompt.includes("status: needs_review"));
});

test("prompt command generates docs-sync and OKF extraction workflows", async () => {
  const cwd = await makeProject("prompt-workflows-");
  const docsSync = await promptCommand({
    cwd,
    task: "docs-sync",
    type: "fullstack",
    profiles: [],
    agents: ["codex"],
    format: "text"
  });
  const okf = await promptCommand({
    cwd,
    task: "okf-extract",
    type: "library",
    profiles: [],
    agents: ["codex"],
    format: "text"
  });

  assert.ok(docsSync.taskPrompt.prompt.includes("avoid unrelated code edits"));
  assert.ok(docsSync.taskPrompt.prompt.includes("Detect changed code"));
  assert.ok(okf.taskPrompt.prompt.includes("OKF v0.1"));
  assert.ok(okf.taskPrompt.prompt.includes("required type"));
  assert.ok(okf.taskPrompt.prompt.includes("[[Concept Name]]"));
  assert.ok(okf.taskPrompt.prompt.includes("status: needs_review"));
});

test("prompt command report can be written as JSON", async () => {
  const cwd = await makeProject("prompt-out-");
  const out = path.join(cwd, "docs", "llm-wiki", "tasks", "feature.prompt.json");
  const result = await promptCommand({
    cwd,
    task: "feature",
    type: "frontend",
    profiles: [],
    agents: ["codex"],
    format: "json"
  });

  await writeReport(out, result, { format: "json", out });
  const content = JSON.parse(await readFile(out, { encoding: "utf8" }));

  assert.equal(content.command, "prompt");
  assert.equal(content.taskPrompt.task, "feature");
  assert.ok(content.taskPrompt.prompt.includes("post-wiki feature development"));
  assert.equal(content.text, undefined);
});

test("prompt command blocks unsupported task names", async () => {
  const cwd = await makeProject("prompt-unsupported-");
  const result = await promptCommand({
    cwd,
    task: "unknown-task",
    type: null,
    profiles: [],
    agents: ["codex"],
    format: "text"
  });

  assert.equal(result.result, "blocked");
  assert.ok(result.findings.some((finding) => finding.rule === "prompt.unsupported_task"));
});

test("status command reports uninitialized wiki and selected adapter state", async () => {
  const cwd = await makeProject("status-missing-");
  const result = await statusCommand({
    cwd,
    type: null,
    profiles: [],
    agents: ["codex"],
    format: "text"
  });

  assert.equal(result.command, "status");
  assert.equal(result.initialized, false);
  assert.equal(result.result, "warning");
  assert.ok(result.findings.some((finding) => finding.rule === "structure.wiki_missing"));
  assert.ok(result.adapterStatus.some((line) => line.includes("codex: AGENTS.md missing")));
  assert.equal(result.findingSummary.byCategory.structure, 1);
  assert.equal(result.findingSummary.byCategory.adapter, 1);
  assert.equal(result.findingSummary.bySeverity.warning, 2);
  assert.ok(result.text.includes("by_category: adapter=1, structure=1"));
  assert.ok(result.text.includes("Run llm-wiki quickstart --write"));
});

test("status command counts wiki document frontmatter statuses", async () => {
  const cwd = await makeProject("status-docs-");
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "Existing wiki entry.");
  await writeWikiDoc(cwd, "README.md", "LLM-WIKI README", "Existing wiki readme.");

  const result = await statusCommand({
    cwd,
    type: "unknown",
    profiles: [],
    agents: [],
    format: "text"
  });

  assert.equal(result.initialized, true);
  assert.equal(result.documentStatus.filesChecked, 2);
  assert.equal(result.documentStatus.counts.needs_review, 2);
  assert.ok(result.text.includes("needs_review: 2"));
});

test("init write creates zero-base wiki docs and selected adapter", async () => {
  const cwd = await makeProject("write-zero-");
  await writeJson(path.join(cwd, "package.json"), {
    dependencies: { vue: "^3.0.0" },
    devDependencies: { vite: "^6.0.0" }
  });

  const result = await initCommand({
    cwd,
    dryRun: false,
    write: true,
    minimal: false,
    withAdapters: false,
    type: "frontend",
    profiles: [],
    agents: ["codex"],
    existing: "skip"
  });

  assert.equal(result.write, true);
  assert.equal(result.result, "pass");
  assert.ok(result.created.some((line) => line.includes("docs/llm-wiki/index.md created")));
  assert.ok(result.created.some((line) => line.includes("AGENTS.md created")));

  const index = await readFile(path.join(cwd, "docs", "llm-wiki", "index.md"), { encoding: "utf8" });
  const projectProfile = await readFile(path.join(cwd, "docs", "llm-wiki", "project-profile.md"), { encoding: "utf8" });
  const architecture = await readFile(path.join(cwd, "docs", "llm-wiki", "ARCHITECTURE_CONVENTIONS.md"), { encoding: "utf8" });
  const domainFeatures = await readFile(path.join(cwd, "docs", "llm-wiki", "DOMAIN_FEATURES.md"), { encoding: "utf8" });
  const agents = await readFile(path.join(cwd, "AGENTS.md"), { encoding: "utf8" });

  assert.ok(index.includes("status: needs_review"));
  assert.ok(index.includes("# LLM-WIKI Index"));
  assert.ok(projectProfile.includes("## What To Inspect"));
  assert.ok(projectProfile.includes("## Evidence"));
  assert.ok(projectProfile.includes("## Open Questions"));
  assert.ok(architecture.includes("## Summary"));
  assert.ok(architecture.includes("Concise summary:"));
  assert.ok(architecture.includes("## What To Inspect"));
  assert.ok(architecture.includes("## Evidence"));
  assert.ok(architecture.includes("## Open Questions"));
  assert.ok(architecture.includes("## Review Notes"));
  assert.ok(domainFeatures.includes("## API Services"));
  assert.ok(agents.includes("docs/llm-wiki/index.md"));
});

test("init write stamps generated documents with the current date", async () => {
  const cwd = await makeProject("write-date-");
  await writeJson(path.join(cwd, "package.json"), { name: "write-date" });

  const today = new Date().toISOString().slice(0, 10);
  await initCommand({
    cwd,
    dryRun: false,
    write: true,
    minimal: true,
    withAdapters: false,
    type: "unknown",
    profiles: [],
    agents: [],
    existing: "skip"
  });

  const index = await readFile(path.join(cwd, "docs", "llm-wiki", "index.md"), { encoding: "utf8" });
  const log = await readFile(path.join(cwd, "docs", "llm-wiki", "log.md"), { encoding: "utf8" });

  assert.ok(index.includes(`last_updated: ${today}`));
  assert.equal(index.includes("last_updated: 2026-07-02"), false);
  assert.ok(log.includes(`## ${today} - LLM-WIKI 초기 문서 생성`));
});

test("init write sets the frontmatter project from package.json name", async () => {
  const cwd = await makeProject("write-project-name-");
  await writeJson(path.join(cwd, "package.json"), { name: "@acme/widget-kit" });

  await initCommand({
    cwd,
    dryRun: false,
    write: true,
    minimal: true,
    withAdapters: false,
    type: "unknown",
    profiles: [],
    agents: [],
    existing: "skip"
  });

  const index = await readFile(path.join(cwd, "docs", "llm-wiki", "index.md"), { encoding: "utf8" });

  assert.ok(index.includes("project: widget-kit"));
  assert.equal(index.includes("project: project"), false);
});

test("init write keeps existing wiki docs by default and overwrites only when explicit", async () => {
  const cwd = await makeProject("write-existing-");
  const indexPath = path.join(cwd, "docs", "llm-wiki", "index.md");
  const logPath = path.join(cwd, "docs", "llm-wiki", "log.md");
  await mkdir(path.dirname(indexPath), { recursive: true });
  await writeFile(indexPath, "CUSTOM INDEX\n", { encoding: "utf8" });
  await writeFile(logPath, "CUSTOM LOG\n", { encoding: "utf8" });

  const skipped = await initCommand({
    cwd,
    dryRun: false,
    write: true,
    minimal: true,
    withAdapters: false,
    type: "unknown",
    profiles: [],
    agents: [],
    existing: "skip"
  });

  assert.ok(skipped.skipped.some((line) => line.includes("docs/llm-wiki/index.md exists")));
  assert.equal(await readFile(indexPath, { encoding: "utf8" }), "CUSTOM INDEX\n");

  const overwritten = await initCommand({
    cwd,
    dryRun: false,
    write: true,
    minimal: true,
    withAdapters: false,
    type: "unknown",
    profiles: [],
    agents: [],
    existing: "overwrite"
  });

  assert.ok(overwritten.overwritten.some((line) => line.includes("docs/llm-wiki/index.md overwritten")));
  assert.ok(overwritten.skipped.some((line) => line.includes("docs/llm-wiki/log.md exists; kept append-only log")));
  assert.ok((await readFile(indexPath, { encoding: "utf8" })).includes("status: needs_review"));
  assert.equal(await readFile(logPath, { encoding: "utf8" }), "CUSTOM LOG\n");
});

test("init write never overwrites existing adapter files", async () => {
  const cwd = await makeProject("write-adapter-existing-");
  const agentsPath = path.join(cwd, "AGENTS.md");
  await writeFile(agentsPath, "CUSTOM AGENTS\n", { encoding: "utf8" });

  const result = await initCommand({
    cwd,
    dryRun: false,
    write: true,
    minimal: true,
    withAdapters: false,
    type: "unknown",
    profiles: [],
    agents: ["codex"],
    existing: "overwrite"
  });

  assert.ok(result.skipped.some((line) => line.includes("AGENTS.md exists; kept existing adapter file")));
  assert.equal(await readFile(agentsPath, { encoding: "utf8" }), "CUSTOM AGENTS\n");
});

test("audit detects backend profile document needs", async () => {
  const cwd = await makeProject("backend-");
  await writeJson(path.join(cwd, "package.json"), {
    dependencies: { express: "^4.18.0" }
  });
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "Existing wiki entry.");

  const result = await audit({ cwd, type: null, format: "text", strict: false });

  assert.equal(result.detection.projectType, "backend");
  assert.ok(result.findings.some((finding) => finding.path === "docs/llm-wiki/API_CONTRACTS.md"));
});

test("audit collapses uninitialized wiki structure into one confirmation finding", async () => {
  const cwd = await makeProject("missing-wiki-");
  const result = await audit({ cwd, type: null, profiles: [], format: "text", strict: false });

  assert.equal(result.findings.filter((finding) => finding.rule === "structure.wiki_missing").length, 1);
  assert.equal(result.findings.some((finding) => finding.rule === "structure.required_doc"), false);
  assert.ok(result.findings[0].message.includes("ask the user whether to proceed"));
});

test("init dry-run detects fullstack projects", async () => {
  const cwd = await makeProject("fullstack-");
  await writeJson(path.join(cwd, "package.json"), {
    dependencies: { vue: "^3.0.0", express: "^4.18.0" }
  });

  const result = await initCommand({ cwd, dryRun: true, minimal: false, withAdapters: false, type: null });

  assert.equal(result.detection.projectType, "fullstack");
  assert.ok(result.planned.some((line) => line.includes("docs/llm-wiki/CONTRACT_BOUNDARIES.md")));
});

test("existing wiki frontmatter validates with Korean UTF-8 content", async () => {
  const cwd = await makeProject("existing-wiki-");
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "한글 문서가 UTF-8로 깨지지 않아야 합니다.");

  const validation = await validateFrontmatterCommand({ cwd, type: null, format: "text", strict: false });
  const auditResult = await audit({ cwd, type: null, format: "text", strict: false });

  assert.equal(validation.findings.length, 0);
  assert.equal(auditResult.findings.some((finding) => finding.rule === "encoding.mojibake"), false);
});

test("strict validation requires verified review metadata", async () => {
  const cwd = await makeProject("verified-strict-");
  await writeJson(path.join(cwd, "package.json"), { name: "verified-strict" });
  await writeVerifiedWikiDocMissingReview(cwd);

  const standardFrontmatter = await validateFrontmatterCommand({ cwd, type: null, format: "text", strict: false });
  const strictFrontmatter = await validateFrontmatterCommand({ cwd, type: null, format: "text", strict: true });
  const strictValidation = await validateCommand({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: true });

  assert.equal(standardFrontmatter.result, undefined);
  assert.equal(standardFrontmatter.findings.find((finding) => finding.rule === "frontmatter.verified_review")?.severity, "warning");
  assert.ok(standardFrontmatter.summary.includes("result: pass"));
  assert.equal(strictFrontmatter.findings.find((finding) => finding.rule === "frontmatter.verified_review")?.severity, "error");
  assert.equal(strictFrontmatter.findingSummary.byCategory.frontmatter, 1);
  assert.equal(strictFrontmatter.findingSummary.bySeverity.error, 1);
  assert.ok(strictFrontmatter.summary.includes("result: fail"));
  assert.equal(strictValidation.result, "fail");
  assert.equal(strictValidation.findings.find((finding) => finding.rule === "frontmatter.verified_review")?.severity, "error");
  assert.equal(strictValidation.findingSummary.byCategory.frontmatter, 1);
});

test("migrate dry-run reports safe additions without writing files", async () => {
  const cwd = await makeProject("migrate-");
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "Existing wiki entry.");

  const result = await migrateCommand({ cwd, type: null, format: "text", strict: false, apply: false });

  assert.equal(result.dryRun, true);
  assert.ok(result.safeAdds.length > 0);
  assert.equal(result.text.includes("No files were written"), true);
});

test("migrate apply is blocked by stable safety policy", async () => {
  const cwd = await makeProject("apply-blocked-");
  const result = await migrateCommand({ cwd, type: null, format: "text", strict: false, apply: true });

  assert.equal(result.result, "blocked");
  assert.equal(result.findings[0].severity, "blocked");
  assert.ok(result.text.includes("migrate --dry-run --out <path>"));
});

test("validate command reuses audit coverage for CI checks", async () => {
  const cwd = await makeProject("validate-");
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "Existing wiki entry.");

  const result = await validateCommand({ cwd, type: null, format: "text", strict: false });

  assert.equal(result.command, "validate");
  assert.equal(result.text.includes("# LLM-WIKI Validation"), true);
  assert.ok(result.findings.some((finding) => finding.rule === "structure.required_doc"));
  assert.ok(result.findingSummary.byCategory.structure > 0);
  assert.ok(result.text.includes("## Finding Summary"));
});

test("sensitive findings omit raw values", async () => {
  const cwd = await makeProject("sensitive-");
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "API_TOKEN=very-secret-token-value");

  const result = await audit({ cwd, type: null, format: "text", strict: false });
  const serialized = JSON.stringify(result);

  assert.ok(result.findings.some((finding) => finding.rule === "sensitive.redacted"));
  assert.equal(serialized.includes("very-secret-token-value"), false);
});

test("audit reports missing source_files entries without exposing file contents", async () => {
  const cwd = await makeProject("source-missing-");
  await writeWikiDocWithSourceFiles(cwd, "index.md", "LLM-WIKI Index", "Existing wiki entry.", ["missing/source.js"]);

  const result = await audit({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false });

  assert.ok(result.findings.some((finding) => finding.rule === "source_files.missing" && finding.message.includes("missing/source.js")));
  assert.equal(result.findingSummary.byCategory.source_files, 1);
});

test("audit and validate report missing related documents and accept existing ones", async () => {
  const cwd = await makeProject("related-missing-");
  await writeJson(path.join(cwd, "package.json"), { name: "related-missing" });
  await writeWikiDoc(cwd, "README.md", "LLM-WIKI README", "Existing related target.");
  await writeWikiDocWithRelated(cwd, "index.md", "LLM-WIKI Index", "Existing wiki entry.", [
    "docs/llm-wiki/README.md",
    "docs/llm-wiki/MISSING_RELATED.md",
    "https://example.com/spec"
  ]);

  const auditResult = await audit({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false });
  const validateResult = await validateCommand({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false });

  assert.ok(auditResult.findings.some((finding) => finding.rule === "related.missing" && finding.message.includes("MISSING_RELATED.md")));
  assert.equal(auditResult.findings.some((finding) => finding.rule === "related.missing" && finding.message.includes("docs/llm-wiki/README.md")), false);
  assert.equal(auditResult.findings.some((finding) => finding.rule === "related.missing" && finding.message.includes("https://example.com/spec")), false);
  assert.ok(validateResult.findings.some((finding) => finding.rule === "related.missing" && finding.message.includes("MISSING_RELATED.md")));
});

test("init write generates documents whose related entries all resolve", async () => {
  const cwd = await makeProject("related-generated-");
  await writeJson(path.join(cwd, "package.json"), {
    dependencies: { vue: "^3.0.0" },
    devDependencies: { vite: "^6.0.0" }
  });

  await initCommand({
    cwd,
    dryRun: false,
    write: true,
    minimal: false,
    withAdapters: false,
    type: "frontend",
    profiles: [],
    agents: [],
    existing: "skip"
  });

  const auditResult = await audit({ cwd, type: "frontend", profiles: [], agents: [], format: "text", strict: false });

  assert.equal(auditResult.findings.some((finding) => finding.rule === "related.missing"), false);
});

test("audit flags un-enriched generated documents but not structural or template files", async () => {
  const cwd = await makeProject("enrichment-");
  await writeJson(path.join(cwd, "package.json"), {
    dependencies: { vue: "^3.0.0" },
    devDependencies: { vite: "^6.0.0" }
  });

  await initCommand({
    cwd,
    dryRun: false,
    write: true,
    minimal: false,
    withAdapters: false,
    type: "frontend",
    profiles: [],
    agents: [],
    existing: "skip"
  });

  const auditResult = await audit({ cwd, type: "frontend", profiles: [], agents: [], format: "text", strict: false });
  const flagged = auditResult.findings
    .filter((finding) => finding.rule === "content.not_enriched")
    .map((finding) => finding.path);

  assert.ok(flagged.includes("docs/llm-wiki/DOMAIN_FEATURES.md"));
  assert.ok(flagged.includes("docs/llm-wiki/domains/00_overview.md"));
  assert.ok(flagged.includes("docs/llm-wiki/project-profile.md"));
  assert.equal(flagged.includes("docs/llm-wiki/index.md"), false);
  assert.equal(flagged.includes("docs/llm-wiki/README.md"), false);
  assert.equal(flagged.includes("docs/llm-wiki/log.md"), false);
  assert.equal(flagged.some((docPath) => docPath.includes("/templates/")), false);
  assert.ok(auditResult.findingSummary.byCategory.content > 0);
});

test("enriched documents with real content clear the not_enriched signal", async () => {
  const cwd = await makeProject("enriched-");
  await writeJson(path.join(cwd, "package.json"), { name: "enriched" });
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "Existing wiki entry.");
  await writeWikiDoc(cwd, "DOMAIN_FEATURES.md", "Domain Features", "The billing domain handles invoices through src/billing.ts and the /invoices route.");

  const auditResult = await audit({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false });

  assert.equal(auditResult.findings.some((finding) => finding.rule === "content.not_enriched"), false);
});

test("audit accepts existing source_files entries", async () => {
  const cwd = await makeProject("source-present-");
  await writeJson(path.join(cwd, "package.json"), { name: "source-present" });
  await writeWikiDocWithSourceFiles(cwd, "index.md", "LLM-WIKI Index", "Existing wiki entry.", ["package.json"]);

  const result = await audit({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false });

  assert.equal(result.findings.some((finding) => finding.rule === "source_files.missing"), false);
});

test("audit accepts precise evidence references for files, lines, symbols, sections, and routes", async () => {
  const cwd = await makeProject("evidence-present-");
  await writeJson(path.join(cwd, "package.json"), { name: "evidence-present" });
  await mkdir(path.join(cwd, "src"), { recursive: true });
  await writeFile(path.join(cwd, "src", "routes.ts"), "export function loadUsers() {}\nexport const route = '/users';\n", { encoding: "utf8" });
  const evidence = [
    "package.json",
    "src/routes.ts#L1-L2",
    "src/routes.ts#symbol:loadUsers",
    "docs/llm-wiki/index.md#section:Evidence",
    "src/routes.ts#route:/users",
    "https://example.com/spec#external-anchor"
  ];
  await writeWikiDocWithEvidence(cwd, "index.md", "LLM-WIKI Index", evidenceBody(evidence), ["package.json"], evidence);

  const auditResult = await audit({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false });
  const validateResult = await validateCommand({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false });

  assert.equal(auditResult.findings.some((finding) => finding.rule?.startsWith("evidence.")), false);
  assert.equal(validateResult.findings.some((finding) => finding.rule?.startsWith("evidence.")), false);
});

test("audit and validate report malformed, missing, and out-of-range evidence references", async () => {
  const cwd = await makeProject("evidence-invalid-");
  await writeJson(path.join(cwd, "package.json"), { name: "evidence-invalid" });
  const evidence = [
    "missing/source.ts#symbol:loadUsers",
    "package.json#L99",
    "package.json#unknown:target",
    "package.json#route:users"
  ];
  await writeWikiDocWithEvidence(cwd, "index.md", "LLM-WIKI Index", evidenceBody(evidence), ["package.json"], evidence);

  const auditResult = await audit({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false });
  const validateResult = await validateCommand({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false });

  assert.ok(auditResult.findings.some((finding) => finding.rule === "evidence.missing" && finding.message.includes("missing/source.ts")));
  assert.ok(auditResult.findings.some((finding) => finding.rule === "evidence.line_range" && finding.message.includes("package.json")));
  assert.equal(auditResult.findings.filter((finding) => finding.rule === "evidence.shape").length, 2);
  assert.equal(validateResult.findingSummary.byCategory.evidence, 4);
  assert.ok(validateResult.findings.some((finding) => finding.rule === "evidence.shape"));
});

test("audit and validate enforce body Evidence section alignment for frontmatter evidence", async () => {
  const cwd = await makeProject("evidence-section-");
  await writeJson(path.join(cwd, "package.json"), { name: "evidence-section" });
  await writeWikiDocWithEvidence(cwd, "missing-section.md", "Missing Evidence Section", "No evidence section here.", ["package.json"], ["package.json#L1"]);
  await writeWikiDocWithEvidence(cwd, "unlisted.md", "Unlisted Evidence", "## Evidence\n\n- package.json\n", ["package.json"], ["package.json#L1"]);
  await writeWikiDoc(cwd, "empty-section.md", "Empty Evidence Section", "## Evidence\n\n## Review Notes\n\n- Nothing yet.");

  const auditResult = await audit({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false });
  const validateResult = await validateCommand({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false });

  assert.ok(auditResult.findings.some((finding) => finding.rule === "evidence.section_missing" && finding.path.includes("missing-section.md")));
  assert.ok(auditResult.findings.some((finding) => finding.rule === "evidence.section_unlisted" && finding.path.includes("unlisted.md")));
  assert.ok(auditResult.findings.some((finding) => finding.rule === "evidence.section_empty" && finding.path.includes("empty-section.md")));
  assert.equal(validateResult.findingSummary.byCategory.evidence, 3);
});

test("strict validate promotes evidence contract warnings to errors", async () => {
  const cwd = await makeProject("evidence-strict-");
  await writeJson(path.join(cwd, "package.json"), { name: "evidence-strict" });
  await writeWikiDocWithEvidence(cwd, "index.md", "Strict Evidence", "## Evidence\n\n- package.json#L99\n- missing/source.ts#symbol:loadUsers\n", ["package.json"], [
    "package.json#L99",
    "missing/source.ts#symbol:loadUsers"
  ]);
  await writeWikiDocWithEvidence(cwd, "unlisted.md", "Strict Unlisted Evidence", "## Evidence\n\n- package.json\n", ["package.json"], ["package.json#L1"]);

  const standardResult = await validateCommand({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false });
  const strictResult = await validateCommand({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: true });

  for (const rule of ["evidence.line_range", "evidence.missing", "evidence.section_unlisted"]) {
    assert.equal(standardResult.findings.find((finding) => finding.rule === rule)?.severity, "warning");
    assert.equal(strictResult.findings.find((finding) => finding.rule === rule)?.severity, "error");
  }
  assert.equal(strictResult.result, "fail");
  assert.equal(strictResult.findingSummary.byCategory.evidence, 3);
  assert.equal(strictResult.findingSummary.bySeverity.error, 3);
});

test("audit and validate report missing local markdown links in wiki docs", async () => {
  const cwd = await makeProject("links-missing-");
  await writeJson(path.join(cwd, "package.json"), { name: "links-missing" });
  await writeWikiDoc(
    cwd,
    "index.md",
    "LLM-WIKI Index",
    "See [missing details](missing-details.md), [external docs](https://example.com), [email](mailto:docs@example.com), and [local section](#local-section)."
  );

  const auditResult = await audit({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false });
  const validateResult = await validateCommand({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false });

  assert.ok(auditResult.findings.some((finding) => finding.rule === "markdown_link.missing" && finding.message.includes("missing-details.md")));
  assert.ok(validateResult.findings.some((finding) => finding.rule === "markdown_link.missing" && finding.message.includes("missing-details.md")));
  assert.equal(auditResult.findingSummary.byCategory.markdown_link, 1);
  assert.equal(validateResult.findingSummary.byCategory.markdown_link, 1);
  assert.equal(auditResult.findings.some((finding) => finding.rule === "markdown_link.missing" && finding.message.includes("https://example.com")), false);
  assert.equal(auditResult.findings.some((finding) => finding.rule === "markdown_link.missing" && finding.message.includes("mailto:docs@example.com")), false);
  assert.equal(auditResult.findings.some((finding) => finding.rule === "markdown_link.missing" && finding.message.includes("#local-section")), false);
});

test("status reports missing markdown links and accepts existing local links", async () => {
  const cwd = await makeProject("links-status-");
  await writeJson(path.join(cwd, "package.json"), { name: "links-status" });
  await writeWikiDoc(cwd, "README.md", "LLM-WIKI README", "Existing target.");
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "See [readme](README.md) and [missing](missing.md).");

  const result = await statusCommand({
    cwd,
    type: "unknown",
    profiles: [],
    agents: [],
    format: "text"
  });

  assert.ok(result.findings.some((finding) => finding.rule === "markdown_link.missing" && finding.message.includes("missing.md")));
  assert.equal(result.findings.some((finding) => finding.rule === "markdown_link.missing" && finding.message.includes("README.md")), false);
});

test("audit and validate report missing wiki links and accept title, path, and alias targets", async () => {
  const cwd = await makeProject("wiki-links-");
  await writeJson(path.join(cwd, "package.json"), { name: "wiki-links" });
  await writeWikiDocWithAliases(cwd, "README.md", "LLM-WIKI README", "Existing target.", ["Main Wiki Readme"]);
  await writeWikiDocWithAliases(cwd, "domains/00_overview.md", "Domain Overview", "Existing domain map.", ["domain guide"]);
  await writeWikiDocWithAliases(cwd, "DOMAIN_FEATURES.md", "Domain Features", "Existing domain features.", []);
  await writeWikiDoc(
    cwd,
    "index.md",
    "LLM-WIKI Index",
    "See [[LLM-WIKI README]], [[Main Wiki Readme]], [[domain guide]], [[domains/00_overview]], [[Domain Features#API Services]], and [[Missing Concept]]."
  );

  const auditResult = await audit({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false });
  const validateResult = await validateCommand({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false });

  assert.ok(auditResult.findings.some((finding) => finding.rule === "wiki_link.missing" && finding.message.includes("Missing Concept")));
  assert.ok(validateResult.findings.some((finding) => finding.rule === "wiki_link.missing" && finding.message.includes("Missing Concept")));
  assert.equal(auditResult.findings.filter((finding) => finding.rule === "wiki_link.missing").length, 1);
  assert.equal(validateResult.findings.filter((finding) => finding.rule === "wiki_link.missing").length, 1);
  assert.equal(auditResult.findingSummary.byCategory.wiki_link, 1);
  assert.equal(validateResult.findingSummary.byCategory.wiki_link, 1);
});

test("status reports missing wiki links", async () => {
  const cwd = await makeProject("wiki-links-status-");
  await writeJson(path.join(cwd, "package.json"), { name: "wiki-links-status" });
  await writeWikiDocWithAliases(cwd, "README.md", "LLM-WIKI README", "Existing target.", ["readme alias"]);
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "See [[readme alias]] and [[Missing Status Target]].");

  const result = await statusCommand({
    cwd,
    type: "unknown",
    profiles: [],
    agents: [],
    format: "text"
  });

  assert.ok(result.findings.some((finding) => finding.rule === "wiki_link.missing" && finding.message.includes("Missing Status Target")));
  assert.equal(result.findings.some((finding) => finding.rule === "wiki_link.missing" && finding.message.includes("readme alias")), false);
});

test("audit and validate include wiki graph summary with aliases, unresolved concepts, and orphans", async () => {
  const cwd = await makeProject("wiki-graph-");
  await writeJson(path.join(cwd, "package.json"), { name: "wiki-graph" });
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "See [[Core Concept]], [[Main Concept]], and [[Missing Graph Concept]].");
  await writeWikiDocWithAliases(cwd, "concepts/core.md", "Core Concept", "Existing concept.", ["Main Concept"]);
  await writeWikiDoc(cwd, "concepts/orphan.md", "Orphan Concept", "No inbound wiki links.");

  const auditResult = await audit({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false });
  const validateResult = await validateCommand({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false });

  assert.equal(auditResult.wikiGraph.summary.documents, 3);
  assert.equal(auditResult.wikiGraph.summary.wikiLinks, 3);
  assert.equal(auditResult.wikiGraph.summary.resolvedWikiLinks, 2);
  assert.equal(auditResult.wikiGraph.summary.unresolvedWikiLinks, 1);
  assert.equal(auditResult.wikiGraph.summary.aliases, 1);
  assert.deepEqual(auditResult.wikiGraph.orphanDocuments, ["docs/llm-wiki/concepts/orphan.md"]);
  assert.deepEqual(auditResult.wikiGraph.unresolvedConcepts, [{ target: "Missing Graph Concept", sources: ["docs/llm-wiki/index.md"] }]);
  assert.deepEqual(auditResult.wikiGraph.aliases, [{ alias: "Main Concept", path: "docs/llm-wiki/concepts/core.md", title: "Core Concept" }]);
  assert.ok(auditResult.text.includes("## Wiki Graph"));
  assert.ok(auditResult.text.includes("unresolved_concepts: 1"));
  assert.equal(validateResult.wikiGraph.summary.orphanDocuments, 1);
  assert.ok(validateResult.text.includes("orphan_documents: 1"));
});

test("wiki graph treats related and markdown links as connectivity for orphan detection", async () => {
  const cwd = await makeProject("graph-connectivity-");
  await writeJson(path.join(cwd, "package.json"), { name: "graph-connectivity" });
  await writeWikiDocWithRelated(cwd, "index.md", "LLM-WIKI Index", "See [markdown child](markdown-child.md).", [
    "docs/llm-wiki/related-child.md"
  ]);
  await writeWikiDoc(cwd, "related-child.md", "Related Child", "Connected via related only.");
  await writeWikiDoc(cwd, "markdown-child.md", "Markdown Child", "Connected via markdown link only.");
  await writeWikiDoc(cwd, "orphan-child.md", "Orphan Child", "No inbound links of any kind.");

  const auditResult = await audit({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false });
  const orphans = auditResult.wikiGraph.orphanDocuments;

  assert.equal(orphans.includes("docs/llm-wiki/related-child.md"), false);
  assert.equal(orphans.includes("docs/llm-wiki/markdown-child.md"), false);
  assert.ok(orphans.includes("docs/llm-wiki/orphan-child.md"));
});

test("next command recommends prioritized actions from audit findings and wiki graph", async () => {
  const cwd = await makeProject("next-actions-");
  await writeJson(path.join(cwd, "package.json"), { name: "next-actions" });
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "See [[Known Concept]], [[Missing Next Concept]], and [missing](missing.md).");
  await writeWikiDocWithSourceFiles(cwd, "concepts/known.md", "Known Concept", "Known but not linked from another page.", ["missing-source.ts"]);
  await writeWikiDoc(cwd, "concepts/orphan.md", "Orphan Concept", "No inbound wiki links.");

  const result = await nextCommand({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false });

  assert.equal(result.command, "next");
  assert.equal(result.findings.length, 0);
  assert.ok(result.auditFindings.some((finding) => finding.rule === "source_files.missing"));
  assert.ok(result.actions.some((action) => action.id === "repair-source-files" && action.priority === "medium"));
  assert.ok(result.actions.some((action) => action.id === "repair-markdown-links"));
  assert.ok(result.actions.some((action) => action.id === "repair-wiki-links"));
  assert.ok(result.actions.some((action) => action.id === "review-unresolved-concepts" && action.targets.includes("Missing Next Concept")));
  assert.ok(result.actions.some((action) => action.id === "connect-orphan-documents" && action.paths.includes("docs/llm-wiki/concepts/orphan.md")));
  assert.ok(result.text.includes("# LLM-WIKI Next Actions"));
  assert.ok(result.text.includes("## Recommended Actions"));
  assert.ok(result.text.includes("command: llm-wiki validate"));
});

test("explain command describes known finding rules and blocks unknown rules", async () => {
  const explained = await explainCommand({ findingRule: "wiki_link.missing", format: "text" });
  const unknown = await explainCommand({ findingRule: "made.up", format: "text" });

  assert.equal(explained.command, "explain");
  assert.equal(explained.result, "pass");
  assert.equal(explained.findingRule, "wiki_link.missing");
  assert.equal(explained.explanation.category, "wiki_link");
  assert.ok(explained.explanation.remediation.some((step) => step.includes("title, basename, file path, or alias")));
  assert.ok(explained.text.includes("# LLM-WIKI Finding Explanation"));
  assert.ok(explained.text.includes("llm-wiki validate"));

  assert.equal(unknown.result, "blocked");
  assert.ok(unknown.findings.some((finding) => finding.rule === "explain.unknown_rule"));
  assert.ok(unknown.knownRules.includes("frontmatter.required"));
});

test("parseArgs supports report output path", () => {
  const parsed = parseArgs(["audit", "--cwd", ".", "--profile", "frontend", "--profile", "library", "--format", "markdown", "--out", "docs/llm-wiki/audits/report.md"]);

  assert.equal(parsed.command, "audit");
  assert.equal(parsed.options.format, "markdown");
  assert.deepEqual(parsed.options.profiles, ["frontend", "library"]);
  assert.deepEqual(parsed.errors, []);
  assert.ok(parsed.options.out.endsWith(path.join("docs", "llm-wiki", "audits", "report.md")));
});

test("parseArgs supports repeated agent options", () => {
  const parsed = parseArgs(["audit", "--agent", "codex", "--agent", "claude"]);

  assert.equal(parsed.command, "audit");
  assert.deepEqual(parsed.options.agents, ["codex", "claude"]);
  assert.deepEqual(parsed.errors, []);
});

test("parseArgs expands agent all", () => {
  const parsed = parseArgs(["validate", "--agent", "all"]);

  assert.deepEqual(parsed.options.agents, ["codex", "claude", "antigravity"]);
  assert.deepEqual(parsed.errors, []);
});

test("init dry-run suggests selected Claude adapter only", async () => {
  const cwd = await makeProject("agent-claude-init-");
  const result = await initCommand({ cwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: ["claude"] });

  assert.deepEqual(result.agents, ["claude"]);
  assert.ok(result.planned.some((line) => line.includes("CLAUDE.md adapter would be suggested")));
  assert.equal(result.planned.some((line) => line.includes("AGENTS.md adapter would be suggested")), false);
  assert.equal(result.planned.some((line) => line.includes("ANTIGRAVITY.md")), false);
});

test("audit reports missing Claude adapter only when Claude agent is selected", async () => {
  const cwd = await makeProject("agent-claude-audit-");
  const result = await audit({ cwd, type: null, profiles: [], agents: ["claude"], format: "text", strict: false });

  assert.ok(result.findings.some((finding) => finding.rule === "adapter.missing" && finding.path === "CLAUDE.md"));
  assert.equal(result.findings.some((finding) => finding.rule === "adapter.missing" && finding.path === "AGENTS.md"), false);
});

test("audit without agent does not require Claude adapter", async () => {
  const cwd = await makeProject("agent-none-audit-");
  const result = await audit({ cwd, type: null, profiles: [], agents: [], format: "text", strict: false });

  assert.equal(result.findings.some((finding) => finding.rule === "adapter.missing" && finding.path === "CLAUDE.md"), false);
});

test("explicit profiles add profile documents without changing project type", async () => {
  const cwd = await makeProject("profile-");
  await writeJson(path.join(cwd, "package.json"), {
    dependencies: { vue: "^3.0.0" },
    devDependencies: { vite: "^6.0.0" }
  });

  const result = await initCommand({ cwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: ["library"] });

  assert.equal(result.detection.projectType, "frontend");
  assert.deepEqual(result.detection.activeProfiles, ["core", "frontend", "library"]);
  assert.ok(result.planned.some((line) => line.includes("docs/llm-wiki/PUBLIC_API.md")));
});

test("unknown explicit profiles are surfaced as review items", async () => {
  const cwd = await makeProject("unknown-profile-");
  const result = await audit({ cwd, type: null, profiles: ["made-up"], format: "text", strict: false });

  assert.ok(result.findings.some((finding) => finding.rule === "project.review_item"));
  assert.ok(result.findings.some((finding) => finding.message.includes("made-up")));
});

test("okf-v0.1 profile is known and validates required type", async () => {
  const cwd = await makeProject("okf-profile-");
  await writeJson(path.join(cwd, "package.json"), { name: "okf-profile" });
  await writeWikiDocWithAliases(cwd, "concepts/sample.md", "Sample Concept", "See [[Sample Alias]] and [[Missing OKF Target]].", ["Sample Alias"]);
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "Existing wiki entry without OKF type.");

  const auditResult = await audit({ cwd, type: "unknown", profiles: ["okf-v0.1"], agents: [], format: "text", strict: false });
  const validateResult = await validateCommand({ cwd, type: "unknown", profiles: ["okf-v0.1"], agents: [], format: "text", strict: false });

  assert.deepEqual(auditResult.detection.activeProfiles, ["core", "okf-v0.1"]);
  assert.equal(auditResult.findings.some((finding) => finding.rule === "project.review_item" && finding.message.includes("okf-v0.1")), false);
  assert.ok(auditResult.findings.some((finding) => finding.rule === "okf.type_required" && finding.path === "docs/llm-wiki/index.md"));
  assert.ok(validateResult.findings.some((finding) => finding.rule === "okf.type_required"));
  assert.ok(auditResult.findings.some((finding) => finding.rule === "wiki_link.missing" && finding.message.includes("Missing OKF Target")));
  assert.equal(auditResult.findingSummary.byCategory.okf, 2);
});

test("okf-v0.1 profile accepts explicit type, aliases, tags, and resolved wiki links", async () => {
  const cwd = await makeProject("okf-valid-");
  await writeJson(path.join(cwd, "package.json"), { name: "okf-valid" });
  await writeOkfWikiDoc(cwd, "index.md", "OKF Index", "project", "See [[Sample Concept]] and [[Sample Alias]].", []);
  await writeOkfWikiDoc(cwd, "concepts/sample.md", "Sample Concept", "concept", "Existing OKF concept.", ["Sample Alias"]);

  const result = await validateCommand({ cwd, type: "unknown", profiles: ["okf-v0.1"], agents: [], format: "text", strict: false });

  assert.equal(result.findings.some((finding) => finding.rule?.startsWith("okf.")), false);
  assert.equal(result.findings.some((finding) => finding.rule === "wiki_link.missing"), false);
});

test("okf-v0.1 fixture corpus validates expected document types and links", async () => {
  const cwd = await makeProject("okf-fixtures-");
  await writeJson(path.join(cwd, "package.json"), { name: "okf-fixtures" });
  await cp(path.join(process.cwd(), "tests", "fixtures", "okf-v0.1", "docs"), path.join(cwd, "docs"), { recursive: true });

  const result = await validateCommand({ cwd, type: "unknown", profiles: ["okf-v0.1"], agents: [], format: "text", strict: false });
  const fixtureFiles = await Promise.all([
    readFile(path.join(cwd, "docs", "llm-wiki", "concepts", "knowledge-editor.md"), { encoding: "utf8" }),
    readFile(path.join(cwd, "docs", "llm-wiki", "projects", "llm-wiki-standard.md"), { encoding: "utf8" }),
    readFile(path.join(cwd, "docs", "llm-wiki", "people", "maintainer.md"), { encoding: "utf8" }),
    readFile(path.join(cwd, "docs", "llm-wiki", "meetings", "review-sync.md"), { encoding: "utf8" }),
    readFile(path.join(cwd, "docs", "llm-wiki", "events", "okf-roadmap-event.md"), { encoding: "utf8" }),
    readFile(path.join(cwd, "docs", "llm-wiki", "apis", "prompt-command-api.md"), { encoding: "utf8" })
  ]);
  const corpus = fixtureFiles.join("\n");

  assert.equal(result.findings.some((finding) => finding.rule?.startsWith("okf.")), false);
  assert.equal(result.findings.some((finding) => finding.rule === "wiki_link.missing"), false);
  assert.equal(result.findings.some((finding) => finding.rule === "source_files.missing"), false);
  assert.equal(result.findings.some((finding) => finding.rule?.startsWith("evidence.")), false);
  assert.equal(result.wikiGraph.summary.documents, 6);
  assert.equal(result.wikiGraph.summary.unresolvedWikiLinks, 0);
  assert.equal(result.wikiGraph.summary.aliases, 6);
  assert.equal(result.wikiGraph.summary.orphanDocuments, 0);
  for (const type of ["concept", "project", "person", "meeting_note", "event", "api_reference"]) {
    assert.ok(corpus.includes(`type: ${type}`));
  }
  assert.ok(corpus.includes("evidence:\n  - package.json#L1-L3"));
  assert.ok(corpus.includes("`package.json#L1-L3` identifies the fixture package metadata"));
});

test("init dry-run includes okf-v0.1 profile guide", async () => {
  const cwd = await makeProject("okf-init-");
  const result = await initCommand({ cwd, dryRun: true, minimal: false, withAdapters: false, type: "unknown", profiles: ["okf-v0.1"], agents: [] });

  assert.ok(result.planned.some((line) => line.includes("docs/llm-wiki/profiles/okf-v0.1.md")));
  assert.ok(result.planned.some((line) => line.includes("docs/llm-wiki/templates/OKF_CONCEPT.template.md")));
  assert.ok(result.planned.some((line) => line.includes("docs/llm-wiki/templates/OKF_PROJECT.template.md")));
  assert.ok(result.planned.some((line) => line.includes("docs/llm-wiki/templates/OKF_API_REFERENCE.template.md")));
  assert.ok(result.planned.some((line) => line.includes("docs/llm-wiki/templates/OKF_MEETING_NOTE.template.md")));
  assert.ok(result.planned.some((line) => line.includes("docs/llm-wiki/templates/OKF_EVENT.template.md")));
  assert.ok(result.planned.some((line) => line.includes("docs/llm-wiki/OKF_CONVERSION_GUIDE.md")));
});

test("init write creates okf-v0.1 profile guide and templates with concise writing sections", async () => {
  const cwd = await makeProject("okf-write-");
  const result = await initCommand({ cwd, dryRun: false, write: true, minimal: false, withAdapters: false, type: "unknown", profiles: ["okf-v0.1"], agents: [], existing: "skip" });
  const profile = await readFile(path.join(cwd, "docs", "llm-wiki", "profiles", "okf-v0.1.md"), { encoding: "utf8" });
  const concept = await readFile(path.join(cwd, "docs", "llm-wiki", "templates", "OKF_CONCEPT.template.md"), { encoding: "utf8" });
  const apiReference = await readFile(path.join(cwd, "docs", "llm-wiki", "templates", "OKF_API_REFERENCE.template.md"), { encoding: "utf8" });
  const event = await readFile(path.join(cwd, "docs", "llm-wiki", "templates", "OKF_EVENT.template.md"), { encoding: "utf8" });
  const conversionGuide = await readFile(path.join(cwd, "docs", "llm-wiki", "OKF_CONVERSION_GUIDE.md"), { encoding: "utf8" });

  assert.equal(result.result, "pass");
  assert.ok(profile.includes("## OKF-Style Writing"));
  assert.ok(profile.includes("short summary section"));
  assert.ok(profile.includes("## Evidence"));
  assert.ok(profile.includes("## Open Questions"));
  assert.ok(profile.includes("[[wiki links]]"));
  assert.ok(concept.includes("# Concept Name"));
  assert.ok(concept.includes("type: concept"));
  assert.ok(concept.includes("## Summary"));
  assert.ok(concept.includes("[[Concept Name]]"));
  assert.ok(apiReference.includes("type: api_reference"));
  assert.ok(apiReference.includes("endpoint or client module"));
  assert.ok(event.includes("type: event"));
  assert.ok(event.includes("## Timeline"));
  assert.ok(conversionGuide.includes("# OKF Conversion Guide"));
  assert.ok(conversionGuide.includes("Conversion is review-assisted, not automatic."));
  assert.ok(conversionGuide.includes("`doc_type` | `type`"));
  assert.ok(conversionGuide.includes("llm-wiki validate --profile okf-v0.1"));
  assert.ok(conversionGuide.includes("`needs_review`"));
});

test("doctor reports package release readiness for package roots", async () => {
  const cwd = await makeProject("doctor-package-");
  await writeJson(path.join(cwd, "package.json"), {
    name: "@company/llm-wiki-standard",
    version: "0.0.0-needs-review",
    private: true,
    bin: { "llm-wiki": "./bin/llm-wiki.js" }
  });
  await writeFile(path.join(cwd, "RELEASE_CHECKLIST.md"), "# Checklist\n", { encoding: "utf8" });

  const result = await doctor({ cwd, type: null, profiles: [], format: "text" });

  assert.ok(result.packageReadiness.some((line) => line.includes("package_name: @company/llm-wiki-standard")));
  assert.ok(result.text.includes("Package Release Readiness"));
});

test("package metadata targets npmjs public publish without committed tokens", async () => {
  const packageJson = JSON.parse(await readFile(path.join(process.cwd(), "package.json"), { encoding: "utf8" }));

  assert.equal(packageJson.name, "@dowonk-7949/llm-wiki-standard");
  assert.equal(packageJson.version, "0.1.5");
  assert.equal(packageJson.private, false);
  assert.equal(packageJson.publishConfig, undefined);
  assert.equal(packageJson.repository.url, "git+https://github.com/Dowon-Kim7949/llm-wiki-standard.git");
  assert.ok(packageJson.files.includes("README.ko.md"));
  assert.ok(packageJson.files.includes("ROADMAP.md"));
});

test("GitHub Actions validation example includes strict LLM-WIKI checks", async () => {
  const workflow = await readFile(path.join(process.cwd(), "templates", "github-actions", "llm-wiki-validate.yml"), { encoding: "utf8" });

  assert.ok(workflow.includes("run: npm test"));
  assert.ok(workflow.includes("run: npx llm-wiki validate-frontmatter"));
  assert.ok(workflow.includes("run: npx llm-wiki validate --strict --agent codex"));
});

test("parseArgs reports missing option values and unknown options", () => {
  const parsed = parseArgs(["audit", "--cwd", "--unknown"]);

  assert.equal(parsed.command, "audit");
  assert.deepEqual(parsed.errors, ["Missing value for --cwd", "Unknown option: --unknown"]);
});

test("writes UTF-8 markdown report with needs_review frontmatter", async () => {
  const cwd = await makeProject("report-");
  const out = path.join(cwd, "reports", "audit.md");
  const result = await audit({ cwd, type: null, format: "text", strict: false });

  await writeReport(out, result, { format: "text", out });
  const content = await readFile(out, { encoding: "utf8" });

  assert.ok(content.startsWith("---\n"));
  assert.ok(content.includes("status: needs_review"));
  assert.ok(content.includes("# LLM-WIKI Audit"));
});

async function makeProject(prefix) {
  return mkdtemp(path.join(os.tmpdir(), `llm-wiki-${prefix}`));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8" });
}

async function writeWikiDoc(cwd, filename, title, body) {
  return writeWikiDocWithSourceFiles(cwd, filename, title, body, ["package.json"]);
}

async function writeWikiDocWithSourceFiles(cwd, filename, title, body, sourceFiles) {
  const wikiRoot = path.join(cwd, "docs", "llm-wiki");
  const targetPath = path.join(wikiRoot, filename);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, frontmatter(title, body, sourceFiles), { encoding: "utf8" });
}

async function writeWikiDocWithEvidence(cwd, filename, title, body, sourceFiles, evidence) {
  const wikiRoot = path.join(cwd, "docs", "llm-wiki");
  const targetPath = path.join(wikiRoot, filename);
  const evidenceBlock = evidence.length
    ? `evidence:\n${evidence.map((item) => `  - ${item}`).join("\n")}\n`
    : "";
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, frontmatter(title, body, sourceFiles).replace("related:", `${evidenceBlock}related:`), { encoding: "utf8" });
}

async function writeWikiDocWithRelated(cwd, filename, title, body, related) {
  const wikiRoot = path.join(cwd, "docs", "llm-wiki");
  const targetPath = path.join(wikiRoot, filename);
  const relatedBlock = related.map((item) => `  - ${item}`).join("\n");
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(
    targetPath,
    frontmatter(title, body).replace("related:\n  - docs/llm-wiki/log.md", `related:\n${relatedBlock}`),
    { encoding: "utf8" }
  );
}

async function writeWikiDocWithAliases(cwd, filename, title, body, aliases) {
  const wikiRoot = path.join(cwd, "docs", "llm-wiki");
  const targetPath = path.join(wikiRoot, filename);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, frontmatter(title, body).replace("visibility: internal", `aliases:\n${aliases.map((alias) => `  - ${alias}`).join("\n")}\nvisibility: internal`), { encoding: "utf8" });
}

async function writeOkfWikiDoc(cwd, filename, title, okfType, body, aliases) {
  const wikiRoot = path.join(cwd, "docs", "llm-wiki");
  const targetPath = path.join(wikiRoot, filename);
  const aliasesBlock = aliases.length
    ? `aliases:\n${aliases.map((alias) => `  - ${alias}`).join("\n")}\n`
    : "";
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(
    targetPath,
    frontmatter(title, body).replace("doc_type: wiki_index", `doc_type: wiki_index\ntype: ${okfType}`).replace("visibility: internal", `${aliasesBlock}visibility: internal`),
    { encoding: "utf8" }
  );
}

async function writeVerifiedWikiDocMissingReview(cwd) {
  const wikiRoot = path.join(cwd, "docs", "llm-wiki");
  await mkdir(wikiRoot, { recursive: true });
  await writeFile(path.join(wikiRoot, "index.md"), `---
title: Verified Wiki
tags:
  - llm-wiki
status: verified
doc_type: wiki_index
project: fixture
last_updated: 2026-07-02
author: test
last_edited_by: node-test
wiki_block_version: v1
source_files:
  - package.json
related:
  - docs/llm-wiki/log.md
visibility: internal
contains_sensitive_info: false
---

# Verified Wiki

Existing verified wiki without review metadata.
`, { encoding: "utf8" });
}

function frontmatter(title, body, sourceFiles = ["package.json"]) {
  const renderedSourceFiles = sourceFiles.map((sourceFile) => `  - ${sourceFile}`).join("\n");
  return `---
title: ${title}
tags:
  - llm-wiki
status: needs_review
doc_type: wiki_index
project: fixture
last_updated: 2026-07-02
author: test
last_edited_by: node-test
wiki_block_version: v1
source_files:
${renderedSourceFiles}
related:
  - docs/llm-wiki/log.md
visibility: internal
contains_sensitive_info: false
---

# ${title}

${body}
`;
}

function evidenceBody(evidence) {
  return `Existing wiki entry.

## Evidence

${evidence.map((item) => `- ${item}`).join("\n")}
`;
}

