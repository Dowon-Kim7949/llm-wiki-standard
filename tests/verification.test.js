import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { audit, detectDomainDirectories, doctor, domainDisplayName, driftCommand, driftTargets, explainCommand, fixCommand, graphCommand, handoffCommand, initCommand, migrateCommand, nextCommand, normalizeDomainSlug, planDomainDocs, promptCommand, quickstartCommand, releaseNotesCommand, statsCommand, statusCommand, validateCommand, validateFrontmatterCommand } from "../src/commands.js";
import { parseArgs } from "../src/cli.js";
import { writeReport, renderHtmlDashboard, renderOutputFile, printResult } from "../src/report.js";
import * as api from "../src/index.js";
import { loadProjectConfig, mergeConfigIntoOptions } from "../src/config-file.js";
import { buildReleaseNotes, buildReleaseNotesBody, parseCommit } from "../src/release-notes.js";
import { fileChangedSince, lineRangeChangedSince } from "../src/git.js";
import { execFileSync } from "node:child_process";

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

test("init write creates Windsurf and Gemini adapters but keeps JetBrains a candidate", async () => {
  const cwd = await makeProject("adapter-breadth-");
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "Existing wiki entry.");

  const result = await initCommand({
    cwd, write: true, minimal: false, withAdapters: false, type: "library",
    profiles: [], agents: ["windsurf", "gemini", "jetbrains"], existing: "skip"
  });

  assert.equal(result.result, "pass");
  assert.ok(result.created.some((line) => line.includes(".windsurf/rules/llm-wiki.md created")));
  assert.ok(result.created.some((line) => line.includes("GEMINI.md created")));
  // JetBrains is an info-only candidate: no file is written.
  assert.ok(result.skipped.some((line) => line.includes(".junie/guidelines.md") && line.includes("candidate")));
  assert.equal(await fileExists(path.join(cwd, ".junie", "guidelines.md")), false);

  // Written adapters point to the wiki entrypoint (no adapter.entrypoint finding).
  const windsurf = await readFile(path.join(cwd, ".windsurf", "rules", "llm-wiki.md"), "utf8");
  const gemini = await readFile(path.join(cwd, "GEMINI.md"), "utf8");
  assert.ok(windsurf.includes("docs/llm-wiki/index.md"));
  assert.ok(gemini.includes("docs/llm-wiki/index.md"));
});

test("parseArgs accepts new adapters and --agent all stays backward-compatible", () => {
  const parsed = parseArgs(["init", "--write", "--agent", "windsurf", "--agent", "gemini", "--agent", "jetbrains"]);
  assert.deepEqual(parsed.options.agents, ["windsurf", "gemini", "jetbrains"]);
  assert.deepEqual(parsed.errors, []);

  const all = parseArgs(["init", "--write", "--agent", "all"]);
  assert.deepEqual(all.options.agents, ["codex", "claude", "antigravity"]);
});

// ---- backend domain detection -----------------------------------------

test("normalizeDomainSlug handles camel/Pascal/kebab/snake/space/Hangul", () => {
  assert.equal(normalizeDomainSlug("auth"), "auth");
  assert.equal(normalizeDomainSlug("userProfile"), "user_profile");
  assert.equal(normalizeDomainSlug("UserProfile"), "user_profile");
  assert.equal(normalizeDomainSlug("user-profile"), "user_profile");
  assert.equal(normalizeDomainSlug("user profile"), "user_profile");
  assert.equal(normalizeDomainSlug("주문"), "주문");
  assert.equal(domainDisplayName("user_profile"), "User Profile");
});

test("planDomainDocs is deterministic and merges duplicate domains", () => {
  // Intentionally unsorted input, with `user` found in two locations.
  const plans = planDomainDocs([
    { rawName: "user", sourceFile: "src/modules/user" },
    { rawName: "Order", sourceFile: "src/modules/order" },
    { rawName: "user", sourceFile: "app/domains/user" }
  ]);

  assert.deepEqual(plans.map((plan) => plan.rel), [
    "docs/llm-wiki/domains/01_order.md",
    "docs/llm-wiki/domains/02_user.md"
  ]);
  const user = plans.find((plan) => plan.slug === "user");
  assert.deepEqual(user.sourceFiles, ["app/domains/user", "src/modules/user"]);
  assert.equal(user.domainName, "User");
});

test("detectDomainDirectories skips common technical directories", async () => {
  const cwd = await makeProject("domain-detect-");
  for (const dir of ["src/modules/user", "src/modules/common", "src/modules/shared", "src/modules/utils"]) {
    await mkdir(path.join(cwd, ...dir.split("/")), { recursive: true });
  }
  const detected = await detectDomainDirectories(cwd);
  const names = detected.map((item) => item.rawName);
  assert.ok(names.includes("user"));
  assert.ok(!names.includes("common"));
  assert.ok(!names.includes("shared"));
  assert.ok(!names.includes("utils"));
});

test("detectDomainDirectories finds file-based route/resource modules", async () => {
  const cwd = await makeProject("domain-files-");
  await mkdir(path.join(cwd, "app", "api", "api_v2", "endpoints"), { recursive: true });
  for (const name of ["__init__", "hazard", "job", "transfer", "customers", "deps", "router"]) {
    await writeFile(path.join(cwd, "app", "api", "api_v2", "endpoints", `${name}.py`), "# module\n", { encoding: "utf8" });
  }
  // __pycache__ artifacts must never be scanned.
  await mkdir(path.join(cwd, "app", "api", "api_v2", "endpoints", "__pycache__"), { recursive: true });
  await writeFile(path.join(cwd, "app", "api", "api_v2", "endpoints", "__pycache__", "hazard.cpython-311.pyc"), "x", { encoding: "utf8" });

  const found = await detectDomainDirectories(cwd);
  const names = found.map((item) => item.rawName).sort();
  // __init__ (dunder), deps + router (aggregator/infra) excluded.
  assert.deepEqual(names, ["customers", "hazard", "job", "transfer"]);
  const hazard = found.find((item) => item.rawName === "hazard");
  assert.equal(hazard.kind, "file");
  assert.equal(hazard.sourceFile, "app/api/api_v2/endpoints/hazard.py");
});

test("detectDomainDirectories skips vendored, virtualenv, and test trees", async () => {
  const cwd = await makeProject("domain-skip-trees-");
  await mkdir(path.join(cwd, "src", "modules", "user"), { recursive: true });
  await mkdir(path.join(cwd, "node_modules", "pkg", "src", "modules", "evil"), { recursive: true });
  await mkdir(path.join(cwd, ".venv", "lib", "routes"), { recursive: true });
  await writeFile(path.join(cwd, ".venv", "lib", "routes", "ghost.py"), "# x\n", { encoding: "utf8" });
  await mkdir(path.join(cwd, "tests", "routes"), { recursive: true });
  await writeFile(path.join(cwd, "tests", "routes", "phantom.py"), "# x\n", { encoding: "utf8" });

  const names = (await detectDomainDirectories(cwd)).map((item) => item.rawName).sort();
  assert.deepEqual(names, ["user"]);
});

test("detectDomainDirectories merges a folder and a file domain of the same name", async () => {
  const cwd = await makeProject("domain-merge-kinds-");
  await mkdir(path.join(cwd, "src", "modules", "customer"), { recursive: true });
  await mkdir(path.join(cwd, "app", "routes"), { recursive: true });
  await writeFile(path.join(cwd, "app", "routes", "customer.py"), "# x\n", { encoding: "utf8" });

  const plans = planDomainDocs(await detectDomainDirectories(cwd));
  const customer = plans.find((plan) => plan.slug === "customer");
  assert.ok(customer);
  assert.deepEqual(customer.sourceFiles, ["app/routes/customer.py", "src/modules/customer"]);
});

test("detectDomainDirectories prunes nested parents under a domain folder", async () => {
  const cwd = await makeProject("domain-prune-");
  await mkdir(path.join(cwd, "src", "modules", "user", "routes"), { recursive: true });
  await writeFile(path.join(cwd, "src", "modules", "user", "routes", "profile.py"), "# x\n", { encoding: "utf8" });

  const names = (await detectDomainDirectories(cwd)).map((item) => item.rawName).sort();
  assert.deepEqual(names, ["user"]); // 'profile' not split — modules/ subtree is pruned
});

test("backend with routes only in a single file yields no per-domain docs", async () => {
  const cwd = await makeProject("domain-single-file-");
  await mkdir(path.join(cwd, "app"), { recursive: true });
  await writeFile(path.join(cwd, "app", "main.py"), "# all routes defined here\n", { encoding: "utf8" });

  assert.equal((await detectDomainDirectories(cwd)).length, 0);
});

test("init --write on a FastAPI endpoints layout creates a doc per route module", async () => {
  const cwd = await makeProject("domain-fastapi-");
  await mkdir(path.join(cwd, "app", "api", "endpoints"), { recursive: true });
  for (const name of ["__init__", "hazard", "job", "transfer", "user"]) {
    await writeFile(path.join(cwd, "app", "api", "endpoints", `${name}.py`), "# module\n", { encoding: "utf8" });
  }

  await initCommand({ cwd, write: true, minimal: false, withAdapters: false, type: "backend", existing: "skip" });

  const domainsDir = path.join(cwd, "docs", "llm-wiki", "domains");
  assert.ok(await fileExists(path.join(domainsDir, "01_hazard.md")));
  assert.ok(await fileExists(path.join(domainsDir, "02_job.md")));
  assert.ok(await fileExists(path.join(domainsDir, "03_transfer.md")));
  assert.ok(await fileExists(path.join(domainsDir, "04_user.md")));
  const hazard = await readFile(path.join(domainsDir, "01_hazard.md"), "utf8");
  assert.ok(hazard.includes("doc_type: domain"));
  assert.ok(hazard.includes("- app/api/endpoints/hazard.py"));
});

test("init --dry-run --type backend plans individual domain docs", async () => {
  const cwd = await makeProject("domain-dry-");
  await mkdir(path.join(cwd, "src", "modules", "user"), { recursive: true });
  await mkdir(path.join(cwd, "src", "modules", "order"), { recursive: true });

  const result = await initCommand({ cwd, dryRun: true, minimal: false, withAdapters: false, type: "backend" });

  assert.ok(result.planned.some((line) => line.includes("docs/llm-wiki/domains/01_order.md")));
  assert.ok(result.planned.some((line) => line.includes("docs/llm-wiki/domains/02_user.md")));
});

test("init --write --type backend creates overview plus per-domain docs", async () => {
  const cwd = await makeProject("domain-write-");
  await mkdir(path.join(cwd, "src", "modules", "user"), { recursive: true });
  await mkdir(path.join(cwd, "src", "modules", "order"), { recursive: true });

  await initCommand({ cwd, write: true, minimal: false, withAdapters: false, type: "backend", existing: "skip" });

  const domainsDir = path.join(cwd, "docs", "llm-wiki", "domains");
  assert.ok(await fileExists(path.join(domainsDir, "00_overview.md")));
  assert.ok(await fileExists(path.join(domainsDir, "01_order.md")));
  assert.ok(await fileExists(path.join(domainsDir, "02_user.md")));

  // doc_type + source_files on an individual domain doc.
  const orderDoc = await readFile(path.join(domainsDir, "01_order.md"), "utf8");
  assert.ok(orderDoc.includes("status: needs_review"));
  assert.ok(orderDoc.includes("doc_type: domain"));
  assert.ok(orderDoc.includes("source_files:"));
  assert.ok(orderDoc.includes("- src/modules/order"));

  // Overview links each domain doc with a relative path (keeps them non-orphan).
  const overview = await readFile(path.join(domainsDir, "00_overview.md"), "utf8");
  assert.ok(overview.includes("[Order](./01_order.md)"));
  assert.ok(overview.includes("[User](./02_user.md)"));
});

test("init --write merges a duplicate domain across locations into one doc", async () => {
  const cwd = await makeProject("domain-merge-");
  await mkdir(path.join(cwd, "src", "modules", "user"), { recursive: true });
  await mkdir(path.join(cwd, "app", "domains", "user"), { recursive: true });

  await initCommand({ cwd, write: true, minimal: false, withAdapters: false, type: "backend", existing: "skip" });

  const domainsDir = path.join(cwd, "docs", "llm-wiki", "domains");
  assert.ok(await fileExists(path.join(domainsDir, "01_user.md")));
  assert.ok(!(await fileExists(path.join(domainsDir, "02_user.md"))));
  const userDoc = await readFile(path.join(domainsDir, "01_user.md"), "utf8");
  assert.ok(userDoc.includes("- app/domains/user"));
  assert.ok(userDoc.includes("- src/modules/user"));
});

test("init --type backend with no domain dirs creates only the overview with a review note", async () => {
  const cwd = await makeProject("domain-none-");
  const result = await initCommand({ cwd, write: true, minimal: false, withAdapters: false, type: "backend", existing: "skip" });

  const domainsDir = path.join(cwd, "docs", "llm-wiki", "domains");
  assert.ok(await fileExists(path.join(domainsDir, "00_overview.md")));
  assert.ok(!(await fileExists(path.join(domainsDir, "01_user.md"))));
  assert.equal(result.result, "pass");
  const overview = await readFile(path.join(domainsDir, "00_overview.md"), "utf8");
  assert.ok(overview.includes("자동 탐지된 domain이 없습니다"));
});

test("init --minimal does not create individual domain docs", async () => {
  const cwd = await makeProject("domain-minimal-");
  await mkdir(path.join(cwd, "src", "modules", "user"), { recursive: true });

  const result = await initCommand({ cwd, dryRun: true, minimal: true, withAdapters: false, type: "backend" });

  assert.ok(!result.planned.some((line) => line.includes("domains/01_")));
});

test("init --existing skip preserves an existing individual domain doc", async () => {
  const cwd = await makeProject("domain-skip-");
  await mkdir(path.join(cwd, "src", "modules", "user"), { recursive: true });
  const domainDoc = path.join(cwd, "docs", "llm-wiki", "domains", "01_user.md");
  await mkdir(path.dirname(domainDoc), { recursive: true });
  await writeFile(domainDoc, "PRESERVE ME", { encoding: "utf8" });

  await initCommand({ cwd, write: true, minimal: false, withAdapters: false, type: "backend", existing: "skip" });

  assert.equal(await readFile(domainDoc, "utf8"), "PRESERVE ME");
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

test("init dry-run detects library/CLI projects from bin field", async () => {
  const cwd = await makeProject("library-detect-");
  await writeJson(path.join(cwd, "package.json"), {
    name: "my-cli",
    bin: { "my-cli": "./bin/cli.js" }
  });

  const result = await initCommand({ cwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });

  assert.equal(result.detection.projectType, "library");
  assert.ok(result.planned.some((line) => line.includes("docs/llm-wiki/PUBLIC_API.md")));
});

test("library detection does not override frontend or backend signals", async () => {
  const cwd = await makeProject("library-vs-frontend-");
  await writeJson(path.join(cwd, "package.json"), {
    name: "app",
    bin: { app: "./bin/app.js" },
    dependencies: { react: "^18.0.0" }
  });

  const result = await initCommand({ cwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });

  assert.equal(result.detection.projectType, "frontend");
});

test("detects Python web projects as backend from requirements", async () => {
  const cwd = await makeProject("python-web-");
  await writeFile(path.join(cwd, "requirements.txt"), "fastapi==0.110.0\nuvicorn==0.29.0\n", { encoding: "utf8" });

  const result = await initCommand({ cwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });

  assert.equal(result.detection.projectType, "backend");
  assert.deepEqual(result.detection.ecosystems, ["python"]);
  assert.equal(result.detection.primaryManifest, "requirements.txt");
});

test("detects Python package and Go/Rust modules as library", async () => {
  const pyCwd = await makeProject("python-lib-");
  await writeFile(path.join(pyCwd, "pyproject.toml"), "[project]\nname = \"widget\"\nversion = \"1.0.0\"\n", { encoding: "utf8" });
  const goCwd = await makeProject("go-mod-");
  await writeFile(path.join(goCwd, "go.mod"), "module example.com/tool\n\ngo 1.22\n", { encoding: "utf8" });
  const rustCwd = await makeProject("rust-web-");
  await writeFile(path.join(rustCwd, "Cargo.toml"), "[package]\nname = \"svc\"\n\n[dependencies]\naxum = \"0.7\"\n", { encoding: "utf8" });

  const py = await initCommand({ cwd: pyCwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });
  const go = await initCommand({ cwd: goCwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });
  const rust = await initCommand({ cwd: rustCwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });

  assert.equal(py.detection.projectType, "library");
  assert.equal(go.detection.projectType, "library");
  assert.equal(rust.detection.projectType, "backend");
});

test("detects PHP/Ruby/.NET web frameworks as backend", async () => {
  const phpCwd = await makeProject("php-web-");
  await writeJson(path.join(phpCwd, "composer.json"), { require: { "laravel/framework": "^11.0" } });
  const rubyCwd = await makeProject("ruby-web-");
  await writeFile(path.join(rubyCwd, "Gemfile"), "source 'https://rubygems.org'\ngem 'rails', '~> 7.1'\n", { encoding: "utf8" });
  const netCwd = await makeProject("dotnet-web-");
  await mkdir(path.join(netCwd, "src", "Api"), { recursive: true });
  await writeFile(path.join(netCwd, "src", "Api", "Api.csproj"), "<Project Sdk=\"Microsoft.NET.Sdk.Web\">\n</Project>\n", { encoding: "utf8" });

  const php = await initCommand({ cwd: phpCwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });
  const ruby = await initCommand({ cwd: rubyCwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });
  const net = await initCommand({ cwd: netCwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });

  assert.equal(php.detection.projectType, "backend");
  assert.deepEqual(php.detection.ecosystems, ["php"]);
  assert.equal(php.detection.primaryManifest, "composer.json");
  assert.equal(ruby.detection.projectType, "backend");
  assert.deepEqual(ruby.detection.ecosystems, ["ruby"]);
  assert.equal(net.detection.projectType, "backend");
  assert.deepEqual(net.detection.ecosystems, ["dotnet"]);
  assert.equal(net.detection.primaryManifest, "src/Api/Api.csproj");
});

test("detects PHP/Ruby packages without web frameworks as library", async () => {
  const phpCwd = await makeProject("php-lib-");
  await writeJson(path.join(phpCwd, "composer.json"), { require: { "psr/log": "^3.0" } });
  const rubyCwd = await makeProject("ruby-lib-");
  await writeFile(path.join(rubyCwd, "Gemfile"), "source 'https://rubygems.org'\ngem 'rake'\n", { encoding: "utf8" });

  const php = await initCommand({ cwd: phpCwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });
  const ruby = await initCommand({ cwd: rubyCwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });

  assert.equal(php.detection.projectType, "library");
  assert.equal(ruby.detection.projectType, "library");
});

test("init write on a Python project anchors source_files to its manifest", async () => {
  const cwd = await makeProject("python-init-");
  await writeFile(path.join(cwd, "pyproject.toml"), "[project]\nname = \"svc\"\nversion = \"0.1.0\"\ndependencies = [\"fastapi\"]\n", { encoding: "utf8" });

  await initCommand({ cwd, dryRun: false, write: true, minimal: true, withAdapters: false, type: null, profiles: [], agents: [], existing: "skip" });
  const index = await readFile(path.join(cwd, "docs", "llm-wiki", "index.md"), { encoding: "utf8" });

  const auditResult = await audit({ cwd, type: null, profiles: [], agents: [], format: "text", strict: false });

  assert.ok(index.includes("- pyproject.toml"));
  assert.equal(index.includes("- package.json"), false);
  assert.equal(auditResult.findings.some((finding) => finding.rule === "source_files.missing"), false);
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

test("parseCommit classifies conventional and non-conventional subjects", () => {
  assert.deepEqual(parseCommit("abc123", "feat: add cursor adapter"), { type: "feat", description: "add cursor adapter", hash: "abc123" });
  assert.deepEqual(parseCommit("def456", "fix(core): correct date"), { type: "fix", description: "correct date", hash: "def456" });
  assert.deepEqual(parseCommit("ghi789", "just a note"), { type: "other", description: "just a note", hash: "ghi789" });
});

test("buildReleaseNotes groups commits by section and stays needs_review", () => {
  const doc = buildReleaseNotes({
    version: "1.2.3",
    date: "2026-07-10",
    project: "demo",
    gitAvailable: true,
    commits: [
      { type: "feat", description: "add cursor adapter", hash: "aaa111" },
      { type: "fix", description: "correct generated date", hash: "bbb222" },
      { type: "docs", description: "update readme", hash: "ccc333" },
      { type: "refactor", description: "simplify detector", hash: "ddd444" },
      { type: "chore", description: "bump dep", hash: "eee555" },
      { type: "release", description: "prepare 1.2.2", hash: "fff666" }
    ]
  });

  assert.ok(doc.includes("릴리스 노트 v1.2.3"));
  assert.ok(doc.includes("Release Notes v1.2.3"));
  assert.ok(doc.includes("status: needs_review"));
  assert.ok(doc.includes("## 추가 · Added\n\n- add cursor adapter (aaa111)"));
  assert.ok(doc.includes("## 수정 · Fixed\n\n- correct generated date (bbb222)"));
  assert.ok(doc.includes("## 변경 · Changed\n\n- simplify detector (ddd444)"));
  assert.ok(doc.includes("## 문서 · Documentation\n\n- update readme (ccc333)"));
  assert.equal(doc.includes("bump dep"), false);
  assert.equal(doc.includes("prepare 1.2.2"), false);
});

test("buildReleaseNotes notes when git history is unavailable", () => {
  const doc = buildReleaseNotes({ version: "1.0.0", date: "2026-07-10", project: "demo", commits: [], gitAvailable: false });

  assert.ok(doc.includes("Git history was not available"));
  assert.ok(doc.includes("git 이력을 사용할 수 없어"));
  assert.ok(doc.includes("릴리스 노트 v1.0.0 · Release Notes v1.0.0"));
});

test("release-notes command builds a document for the package version", async () => {
  const cwd = await makeProject("relnotes-");
  await writeJson(path.join(cwd, "package.json"), { name: "@scope/relnotes", version: "9.9.9" });

  const result = await releaseNotesCommand({ cwd, version: null, format: "text" });

  assert.equal(result.command, "release-notes");
  assert.equal(result.version, "9.9.9");
  assert.equal(result.project, "relnotes");
  assert.ok(result.document.includes("릴리스 노트 v9.9.9 · Release Notes v9.9.9"));
  assert.ok(result.document.includes("status: needs_review"));
  assert.equal(result.text, result.document);
});

test("release-notes command honors an explicit --version and writes via --out", async () => {
  const cwd = await makeProject("relnotes-out-");
  await writeJson(path.join(cwd, "package.json"), { name: "relnotes", version: "1.0.0" });
  const out = path.join(cwd, "docs", "llm-wiki", "releases", "v2.0.0.md");

  const result = await releaseNotesCommand({ cwd, version: "2.0.0", format: "markdown", out });
  await writeReport(out, result, { format: "markdown", out });
  const content = await readFile(out, { encoding: "utf8" });

  assert.equal(result.version, "2.0.0");
  assert.ok(content.startsWith("---"));
  assert.ok(content.includes("릴리스 노트 v2.0.0 · Release Notes v2.0.0"));
});

test("parseArgs accepts --since for release-notes and validate, and rejects it elsewhere", () => {
  const ok = parseArgs(["release-notes", "--version", "1.2.0", "--since", "v1.1.0"]);
  const okValidate = parseArgs(["validate", "--changed", "--since", "v1.1.0"]);
  const rejected = parseArgs(["status", "--since", "v1.1.0"]);

  assert.equal(ok.command, "release-notes");
  assert.equal(ok.options.version, "1.2.0");
  assert.equal(ok.options.since, "v1.1.0");
  assert.deepEqual(ok.errors, []);

  assert.equal(okValidate.options.changed, true);
  assert.equal(okValidate.options.since, "v1.1.0");
  assert.deepEqual(okValidate.errors, []);

  assert.deepEqual(rejected.errors, ["Option --since is not supported by status."]);
});

test("release-notes threads --since and stays usable without git history", async () => {
  const cwd = await makeProject("relnotes-since-");
  await writeJson(path.join(cwd, "package.json"), { name: "relnotes", version: "3.0.0" });

  const result = await releaseNotesCommand({ cwd, version: "3.0.0", since: "v2.0.0", format: "text" });

  assert.equal(result.since, "v2.0.0");
  assert.equal(result.gitAvailable, false);
  assert.ok(result.document.includes("릴리스 노트 v3.0.0 · Release Notes v3.0.0"));
});

test("buildReleaseNotesBody emits only grouped sections (no frontmatter/title/scaffold)", () => {
  const body = buildReleaseNotesBody({
    gitAvailable: true,
    commits: [
      { type: "feat", description: "add x", hash: "a1" },
      { type: "docs", description: "update y", hash: "b2" },
      { type: "chore", description: "bump dep", hash: "c3" }
    ]
  });

  assert.ok(body.startsWith("## 추가 · Added"));
  assert.ok(body.includes("- add x (a1)"));
  assert.ok(body.includes("## 문서 · Documentation"));
  assert.ok(!body.includes("---"));
  assert.ok(!body.includes("릴리스 노트"));
  assert.ok(!body.includes("status:"));
  assert.ok(!body.includes("bump dep")); // chore is excluded
});

test("parseArgs accepts --body-only for release-notes and rejects it elsewhere", () => {
  const ok = parseArgs(["release-notes", "--body-only"]);
  const rejected = parseArgs(["validate", "--body-only"]);

  assert.equal(ok.command, "release-notes");
  assert.equal(ok.options.bodyOnly, true);
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(rejected.errors, ["Option --body-only is not supported by validate."]);
});

test("release-notes --body-only emits only the change body", async (t) => {
  let hasGit = true;
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
  } catch {
    hasGit = false;
  }
  if (!hasGit) {
    t.skip("git not available");
    return;
  }

  const cwd = await makeProject("relnotes-body-");
  await writeJson(path.join(cwd, "package.json"), { name: "relnotes", version: "1.0.0" });
  const git = gitAtDate(cwd, "2026-07-15T12:00:00");
  git(["init"]);
  await writeFile(path.join(cwd, "f.txt"), "one\n", { encoding: "utf8" });
  git(["add", "."]);
  git(["-c", "commit.gpgsign=false", "commit", "-m", "feat: add a thing"]);

  const result = await releaseNotesCommand({ cwd, version: "1.0.0", bodyOnly: true, format: "text" });

  assert.equal(result.result, "pass");
  assert.equal(result.bodyOnly, true);
  assert.equal(result.text, result.document);
  assert.ok(result.document.includes("## 추가 · Added"));
  assert.ok(result.document.includes("add a thing"));
  assert.ok(!result.document.includes("---"));
  assert.ok(!result.document.includes("릴리스 노트"));
  assert.ok(!result.document.includes("status: needs_review"));
  assert.ok(!result.document.includes("게시 전 검토"));
});

test("release-notes --body-only blocks on a sensitive-looking commit subject", async (t) => {
  let hasGit = true;
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
  } catch {
    hasGit = false;
  }
  if (!hasGit) {
    t.skip("git not available");
    return;
  }

  const cwd = await makeProject("relnotes-secret-");
  await writeJson(path.join(cwd, "package.json"), { name: "relnotes", version: "1.0.0" });
  const git = gitAtDate(cwd, "2026-07-15T12:00:00");
  git(["init"]);
  await writeFile(path.join(cwd, "f.txt"), "one\n", { encoding: "utf8" });
  git(["add", "."]);
  git(["-c", "commit.gpgsign=false", "commit", "-m", "fix: rotate api_key=SUPERSECRETVALUE123"]);

  const result = await releaseNotesCommand({ cwd, version: "1.0.0", bodyOnly: true, format: "text" });

  assert.equal(result.result, "blocked");
  assert.equal(result.document, null);
  assert.ok(result.findings.some((finding) => finding.rule === "sensitive.release_body" && finding.severity === "blocked"));
  // The sensitive value is never echoed in the withheld message.
  assert.ok(!result.text.includes("SUPERSECRETVALUE123"));
});

test("migrate dry-run reports safe additions without writing files", async () => {
  const cwd = await makeProject("migrate-");
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "Existing wiki entry.");

  const result = await migrateCommand({ cwd, type: null, format: "text", strict: false, apply: false });

  assert.equal(result.dryRun, true);
  assert.ok(result.safeAdds.length > 0);
  assert.equal(result.text.includes("No files were written"), true);
});

test("migrate --apply upgrades a behind wiki_block_version to current", async () => {
  const cwd = await makeProject("migrate-apply-");
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "Current wiki entry.");
  await writeWikiDocAt(cwd, "old.md", "Old Doc", "Conforming doc at an older block version.", (text) =>
    text.replace("wiki_block_version: v1", "wiki_block_version: v0"));

  const result = await migrateCommand({ cwd, type: null, format: "text", strict: false, apply: true });

  assert.equal(result.apply, true);
  assert.equal(result.result, "pass");
  assert.ok(result.applied.some((line) => line.includes("old.md") && line.includes("upgrade wiki_block_version v0")));
  const upgraded = await readFile(path.join(cwd, "docs", "llm-wiki", "old.md"), "utf8");
  assert.ok(upgraded.includes("wiki_block_version: v1"));
  assert.ok(!upgraded.includes("wiki_block_version: v0"));
});

test("migrate --dry-run previews block-version upgrades without writing", async () => {
  const cwd = await makeProject("migrate-preview-");
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "Current wiki entry.");
  await writeWikiDocAt(cwd, "old.md", "Old Doc", "Behind doc.", (text) =>
    text.replace("wiki_block_version: v1", "wiki_block_version: v0"));

  const result = await migrateCommand({ cwd, type: null, format: "text", strict: false });

  assert.equal(result.dryRun, true);
  assert.ok(result.planned.some((line) => line.includes("old.md")));
  const untouched = await readFile(path.join(cwd, "docs", "llm-wiki", "old.md"), "utf8");
  assert.ok(untouched.includes("wiki_block_version: v0")); // preview did not write
});

test("migrate --apply never stamps or edits verified documents", async () => {
  const cwd = await makeProject("migrate-verified-");
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "Current wiki entry.");
  await writeWikiDocAt(cwd, "verified.md", "Verified Doc", "Behind but verified.", (text) =>
    text.replace("status: needs_review", "status: verified").replace("wiki_block_version: v1", "wiki_block_version: v0"));

  const result = await migrateCommand({ cwd, type: null, format: "text", strict: false, apply: true });

  const verified = await readFile(path.join(cwd, "docs", "llm-wiki", "verified.md"), "utf8");
  assert.ok(verified.includes("wiki_block_version: v0")); // verified doc never stamped
  assert.ok(result.skipped.some((line) => line.includes("verified.md") && line.includes("behind wiki_block_version v0")));
});

test("migrate --apply keeps a behind doc that still needs a Tier B field", async () => {
  const cwd = await makeProject("migrate-tierb-");
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "Current wiki entry.");
  await writeWikiDocAt(cwd, "old.md", "Old Doc", "Behind and missing a human field.", (text) =>
    text.replace("wiki_block_version: v1", "wiki_block_version: v0").replace(/^title:[^\n]*\n/m, ""));

  const result = await migrateCommand({ cwd, type: null, format: "text", strict: false, apply: true });

  const kept = await readFile(path.join(cwd, "docs", "llm-wiki", "old.md"), "utf8");
  assert.ok(kept.includes("wiki_block_version: v0")); // not upgraded while Tier B missing
  assert.ok(result.skipped.some((line) => line.includes("old.md") && line.includes("kept behind") && line.includes("title")));
});

test("migrate --apply is idempotent", async () => {
  const cwd = await makeProject("migrate-idem-");
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "Current wiki entry.");
  await writeWikiDocAt(cwd, "old.md", "Old Doc", "Behind doc.", (text) =>
    text.replace("wiki_block_version: v1", "wiki_block_version: v0"));

  const first = await migrateCommand({ cwd, type: null, format: "text", strict: false, apply: true });
  assert.ok(first.applied.length > 0);
  const second = await migrateCommand({ cwd, type: null, format: "text", strict: false, apply: true });
  assert.equal(second.applied.length, 0);
});

test("migrate dry-run reports the wiki_block_version upgrade gap", async () => {
  const cwd = await makeProject("migrate-report-");
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "Current-version wiki entry.");
  // A doc generated by an older block version (v0) → behind.
  await writeWikiDocAt(cwd, "old.md", "Old Doc", "Older block version.", (text) =>
    text.replace("wiki_block_version: v1", "wiki_block_version: v0"));
  // A doc missing the field entirely → unrecorded.
  await writeWikiDocAt(cwd, "legacy.md", "Legacy Doc", "No recorded block version.", (text) =>
    text.replace("wiki_block_version: v1\n", ""));
  // A doc from a newer CLI (v2) → ahead (reported, never downgraded).
  await writeWikiDocAt(cwd, "future.md", "Future Doc", "Newer block version.", (text) =>
    text.replace("wiki_block_version: v1", "wiki_block_version: v2"));

  const result = await migrateCommand({ cwd, type: null, format: "text", strict: false });

  assert.equal(result.upgradeReport.current, "v1");
  assert.equal(result.upgradeReport.counts.behind, 1);
  assert.equal(result.upgradeReport.counts.unrecorded, 1);
  assert.equal(result.upgradeReport.counts.ahead, 1);
  assert.ok(result.upgradeReport.counts.current >= 1); // index.md
  const gapPaths = result.upgradeReport.gapDocuments.map((doc) => doc.path);
  assert.ok(gapPaths.includes("docs/llm-wiki/old.md"));
  assert.ok(gapPaths.includes("docs/llm-wiki/legacy.md"));
  assert.ok(!gapPaths.includes("docs/llm-wiki/future.md")); // ahead is not a gap
  assert.ok(result.text.includes("Upgrade Report (wiki_block_version)"));
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

test("driftTargets selects files and baseline only for verified documents", () => {
  assert.equal(driftTargets({ status: "needs_review", last_updated: "2026-01-01", source_files: ["a.ts"] }), null);
  assert.equal(driftTargets({ status: "verified", source_files: ["a.ts"] }), null);

  const withReview = driftTargets({
    status: "verified",
    reviewed_at: "2026-06-01",
    last_updated: "2026-07-01",
    source_files: ["src/a.ts", "https://example.com/spec"],
    evidence: ["src/a.ts#L1-L2", "src/b.ts#symbol:foo"]
  });
  assert.equal(withReview.baseline, "2026-06-01");
  assert.deepEqual(withReview.files, ["src/a.ts", "src/b.ts"]);

  const withoutReview = driftTargets({ status: "verified", last_updated: "2026-07-01", source_files: ["src/a.ts"] });
  assert.equal(withoutReview.baseline, "2026-07-01");
});

test("evidence drift scan is best-effort and silent without git history", async () => {
  const cwd = await makeProject("drift-nogit-");
  await writeJson(path.join(cwd, "package.json"), { name: "drift" });
  await writeVerifiedWikiDocMissingReview(cwd);

  const result = await audit({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false });

  assert.equal(result.findings.some((finding) => finding.rule === "evidence.stale"), false);
});

test("fileChangedSince anchors the baseline to end-of-day so same-day commits are not drift", async (t) => {
  let hasGit = true;
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
  } catch {
    hasGit = false;
  }
  if (!hasGit) {
    t.skip("git not available");
    return;
  }

  const cwd = await makeProject("drift-git-");
  const commitDate = "2026-07-13T14:57:30";
  const git = (args) => execFileSync("git", args, {
    cwd,
    stdio: ["ignore", "ignore", "ignore"],
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: commitDate,
      GIT_COMMITTER_DATE: commitDate,
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "test@example.com"
    }
  });
  git(["init"]);
  await writeFile(path.join(cwd, "a.ts"), "one\n", { encoding: "utf8" });
  git(["add", "a.ts"]);
  git(["-c", "commit.gpgsign=false", "commit", "-m", "add a"]);

  // Reviewed the same day the file was committed → covered by the review, not drift.
  assert.equal(fileChangedSince(cwd, "a.ts", "2026-07-13"), false);
  // Reviewed the day before → the commit is genuinely after the review → drift.
  assert.equal(fileChangedSince(cwd, "a.ts", "2026-07-12"), true);
});

function gitAtDate(cwd, date) {
  return (args) => execFileSync("git", args, {
    cwd,
    stdio: ["ignore", "ignore", "ignore"],
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_DATE: date,
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "test@example.com"
    }
  });
}

test("lineRangeChangedSince narrows drift to the cited line range", async (t) => {
  let hasGit = true;
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
  } catch {
    hasGit = false;
  }
  if (!hasGit) {
    t.skip("git not available");
    return;
  }

  const cwd = await makeProject("drift-lines-");
  gitAtDate(cwd, "2026-07-10T10:00:00")(["init"]);
  await writeFile(path.join(cwd, "a.ts"), "one\ntwo\nthree\nfour\nfive\n", { encoding: "utf8" });
  gitAtDate(cwd, "2026-07-10T10:00:00")(["add", "a.ts"]);
  gitAtDate(cwd, "2026-07-10T10:00:00")(["-c", "commit.gpgsign=false", "commit", "-m", "init"]);
  // Change only line 2 on a later day.
  await writeFile(path.join(cwd, "a.ts"), "one\ntwo-changed\nthree\nfour\nfive\n", { encoding: "utf8" });
  gitAtDate(cwd, "2026-07-12T10:00:00")(["add", "a.ts"]);
  gitAtDate(cwd, "2026-07-12T10:00:00")(["-c", "commit.gpgsign=false", "commit", "-m", "edit line 2"]);

  // Baseline before the edit: the cited line 2 changed, but lines 4-5 did not.
  assert.equal(lineRangeChangedSince(cwd, "a.ts", 2, 2, "2026-07-11"), true);
  assert.equal(lineRangeChangedSince(cwd, "a.ts", 4, 5, "2026-07-11"), false);
  // Baseline on the edit day → covered by the review, not drift.
  assert.equal(lineRangeChangedSince(cwd, "a.ts", 2, 2, "2026-07-12"), false);
});

test("evidence drift narrows to cited lines for line-only evidence", async (t) => {
  let hasGit = true;
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
  } catch {
    hasGit = false;
  }
  if (!hasGit) {
    t.skip("git not available");
    return;
  }

  const cwd = await makeProject("drift-lineonly-");
  gitAtDate(cwd, "2026-07-10T10:00:00")(["init"]);
  await writeFile(path.join(cwd, "package.json"), `${JSON.stringify({ name: "drift" }, null, 2)}\n`, { encoding: "utf8" });
  await writeFile(path.join(cwd, "a.ts"), "one\ntwo\nthree\nfour\nfive\n", { encoding: "utf8" });
  gitAtDate(cwd, "2026-07-10T10:00:00")(["add", "."]);
  gitAtDate(cwd, "2026-07-10T10:00:00")(["-c", "commit.gpgsign=false", "commit", "-m", "init"]);
  await writeFile(path.join(cwd, "a.ts"), "one\ntwo-changed\nthree\nfour\nfive\n", { encoding: "utf8" });
  gitAtDate(cwd, "2026-07-12T10:00:00")(["add", "a.ts"]);
  gitAtDate(cwd, "2026-07-12T10:00:00")(["-c", "commit.gpgsign=false", "commit", "-m", "edit line 2"]);

  // Verified doc citing ONLY line 2 (no broad source_files) → changed line → drift.
  await writeVerifiedLineEvidenceDoc(cwd, "cites-line2.md", "a.ts#L2-L2", "2026-07-11");
  // Verified doc citing ONLY lines 4-5 → unrelated to the edit → no drift.
  await writeVerifiedLineEvidenceDoc(cwd, "cites-line4.md", "a.ts#L4-L5", "2026-07-11");

  const result = await audit({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false });
  const stale = result.findings.filter((finding) => finding.rule === "evidence.stale");

  assert.ok(stale.some((finding) => finding.path.includes("cites-line2.md")));
  assert.ok(!stale.some((finding) => finding.path.includes("cites-line4.md")));
});

test("drift --downgrade flips drifted verified docs to needs_review", async (t) => {
  let hasGit = true;
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
  } catch {
    hasGit = false;
  }
  if (!hasGit) {
    t.skip("git not available");
    return;
  }

  const cwd = await makeProject("drift-cmd-");
  gitAtDate(cwd, "2026-07-10T10:00:00")(["init"]);
  await writeFile(path.join(cwd, "a.ts"), "one\ntwo\n", { encoding: "utf8" });
  await writeFile(path.join(cwd, "package.json"), `${JSON.stringify({ name: "drift" }, null, 2)}\n`, { encoding: "utf8" });
  gitAtDate(cwd, "2026-07-10T10:00:00")(["add", "."]);
  gitAtDate(cwd, "2026-07-10T10:00:00")(["-c", "commit.gpgsign=false", "commit", "-m", "init"]);
  await writeFile(path.join(cwd, "a.ts"), "one\ntwo-changed\n", { encoding: "utf8" });
  gitAtDate(cwd, "2026-07-12T10:00:00")(["add", "a.ts"]);
  gitAtDate(cwd, "2026-07-12T10:00:00")(["-c", "commit.gpgsign=false", "commit", "-m", "edit"]);

  await writeVerifiedSourceDoc(cwd, "api.md", "a.ts", "2026-07-11");

  // Report mode: finds drift, writes nothing.
  const report = await driftCommand({ cwd, downgrade: false, format: "text" });
  assert.equal(report.dryRun, true);
  assert.ok(report.driftFindings.some((finding) => finding.path.includes("api.md")));
  assert.ok(report.planned.some((line) => line.includes("api.md")));
  const before = await readFile(path.join(cwd, "docs", "llm-wiki", "api.md"), "utf8");
  assert.ok(before.includes("status: verified"));

  // Downgrade mode: flips status to needs_review.
  const down = await driftCommand({ cwd, downgrade: true, format: "text" });
  assert.ok(down.applied.some((line) => line.includes("api.md")));
  const after = await readFile(path.join(cwd, "docs", "llm-wiki", "api.md"), "utf8");
  assert.ok(after.includes("status: needs_review"));
  assert.ok(!after.includes("status: verified"));

  // Idempotent: nothing left to downgrade.
  const again = await driftCommand({ cwd, downgrade: true, format: "text" });
  assert.equal(again.applied.length, 0);
});

test("drift on an uninitialized wiki passes with nothing to do", async () => {
  const cwd = await makeProject("drift-empty-");
  const result = await driftCommand({ cwd, downgrade: false, format: "text" });
  assert.equal(result.result, "pass");
  assert.equal(result.driftFindings.length, 0);
});

test("parseArgs supports drift downgrade and rejects dry-run+downgrade", () => {
  const ok = parseArgs(["drift", "--downgrade"]);
  assert.equal(ok.command, "drift");
  assert.equal(ok.options.downgrade, true);
  assert.deepEqual(ok.errors, []);

  const bad = parseArgs(["drift", "--dry-run", "--downgrade"]);
  assert.ok(bad.errors.some((message) => message.includes("cannot be used together")));
});

test("graph command emits the knowledge graph in text/json/mermaid/dot", async () => {
  const cwd = await makeProject("graph-");
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "Entry point.");
  await writeWikiDocWithRelated(cwd, "a.md", "Doc A", "Connected doc.", ["docs/llm-wiki/index.md"]);

  const text = await graphCommand({ cwd, format: "text" });
  assert.equal(text.command, "graph");
  assert.ok(text.graph.summary.documents >= 2);
  assert.ok(text.graph.edges.some((edge) => edge.source === "docs/llm-wiki/a.md" && edge.target === "docs/llm-wiki/index.md"));
  assert.ok(text.text.includes("documents:"));

  const json = await graphCommand({ cwd, format: "json" });
  assert.ok(Array.isArray(json.graph.documents) && Array.isArray(json.graph.edges));

  const mermaid = await graphCommand({ cwd, format: "mermaid" });
  assert.ok(mermaid.text.startsWith("```mermaid"));
  assert.ok(mermaid.text.includes("graph TD") && mermaid.text.includes("-->"));

  const dot = await graphCommand({ cwd, format: "dot" });
  assert.ok(dot.text.startsWith("digraph LLMWiki") && dot.text.includes("->"));
});

test("graph command on an uninitialized wiki reports zero documents", async () => {
  const cwd = await makeProject("graph-empty-");
  const result = await graphCommand({ cwd, format: "text" });
  assert.equal(result.graph.summary.documents, 0);
  assert.ok(result.text.includes("not initialized"));
});

test("parseArgs accepts graph mermaid/dot formats", () => {
  const mermaid = parseArgs(["graph", "--format", "mermaid"]);
  assert.equal(mermaid.command, "graph");
  assert.equal(mermaid.options.format, "mermaid");
  assert.deepEqual(mermaid.errors, []);
  assert.deepEqual(parseArgs(["graph", "--format", "dot"]).errors, []);
});

test("stats command reports a wiki health snapshot", async () => {
  const cwd = await makeProject("stats-");
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "Real content.");
  await writeWikiDocAt(cwd, "a.md", "Doc A", "Verified content.", (text) => text.replace("status: needs_review", "status: verified"));

  const result = await statsCommand({ cwd, type: null, profiles: [], agents: [], format: "text", strict: false });

  assert.equal(result.command, "stats");
  assert.equal(result.stats.documents, 2);
  assert.equal(result.stats.status.verified, 1);
  assert.equal(result.stats.status.needs_review, 1);
  assert.equal(result.stats.verifiedPct, 50);
  assert.equal(result.stats.evidenceBacked, 2);
  assert.ok(result.stats.healthScore >= 0 && result.stats.healthScore <= 100);
  assert.ok(result.text.includes("health_score:"));
});

test("stats on an uninitialized wiki reports zero documents", async () => {
  const cwd = await makeProject("stats-empty-");
  const result = await statsCommand({ cwd, type: null, profiles: [], agents: [], format: "text", strict: false });
  assert.equal(result.stats.documents, 0);
  assert.equal(result.stats.healthScore, 0);
  assert.ok(result.text.includes("not initialized"));
});

test("html dashboard includes a navigable Document Index", async () => {
  const cwd = await makeProject("dash-index-");
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "Entry point.");
  await writeWikiDocWithRelated(cwd, "a.md", "Doc A", "Connected doc.", ["docs/llm-wiki/index.md"]);

  const result = await audit({ cwd, type: null, profiles: [], agents: [], format: "html", strict: false });
  const html = renderHtmlDashboard(result);

  assert.ok(html.includes("Document Index"));
  assert.ok(html.includes("docs/llm-wiki/a.md"));
  assert.ok(html.includes(">Doc A<") || html.includes("Doc A"));
});

test("validate --changed reports findings only for changed documents", async (t) => {
  let hasGit = true;
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
  } catch {
    hasGit = false;
  }
  if (!hasGit) {
    t.skip("git not available");
    return;
  }

  const cwd = await makeProject("validate-changed-");
  const git = (args) => execFileSync("git", args, {
    cwd,
    stdio: ["ignore", "ignore", "ignore"],
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Test",
      GIT_AUTHOR_EMAIL: "test@example.com",
      GIT_COMMITTER_NAME: "Test",
      GIT_COMMITTER_EMAIL: "test@example.com"
    }
  });
  await writeJson(path.join(cwd, "package.json"), { name: "vc" });
  await writeWikiDoc(cwd, "index.md", "Index", "Body.");
  await writeWikiDoc(cwd, "log.md", "Log", "Body.");
  await writeWikiDocWithRelated(cwd, "A.md", "Doc A", "Body.", ["docs/llm-wiki/missing.md"]);
  git(["init"]);
  git(["add", "-A"]);
  git(["-c", "commit.gpgsign=false", "commit", "-m", "init"]);

  const base = { cwd, type: "unknown", profiles: [], agents: [], strict: false, format: "text" };
  const brokenOnA = (finding) => finding.rule === "related.missing" && finding.path === "docs/llm-wiki/A.md";

  const full = await validateCommand({ ...base });
  assert.ok(full.findings.some(brokenOnA), "full validate reports the broken related on A.md");

  // Change only index.md → A.md's finding is out of the changed scope.
  await writeFile(path.join(cwd, "docs", "llm-wiki", "index.md"), "extra\n", { encoding: "utf8", flag: "a" });
  const changedIndex = await validateCommand({ ...base, changed: true });
  assert.equal(changedIndex.findings.some(brokenOnA), false, "A.md finding is filtered out when only index.md changed");

  // Change A.md → its finding is back in scope.
  await writeFile(path.join(cwd, "docs", "llm-wiki", "A.md"), "extra\n", { encoding: "utf8", flag: "a" });
  const changedA = await validateCommand({ ...base, changed: true });
  assert.ok(changedA.findings.some(brokenOnA), "A.md finding is reported when A.md changed");
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

test("parseArgs accepts html format", () => {
  const parsed = parseArgs(["validate", "--format", "html", "--out", "reports/dashboard.html"]);

  assert.equal(parsed.command, "validate");
  assert.equal(parsed.options.format, "html");
  assert.deepEqual(parsed.errors, []);
});

test("validate renders a self-contained HTML dashboard report", async () => {
  const cwd = await makeProject("dashboard-");
  await writeJson(path.join(cwd, "package.json"), { name: "dashboard" });
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "Existing wiki entry.");
  const out = path.join(cwd, "reports", "dashboard.html");

  const result = await validateCommand({ cwd, type: "unknown", profiles: [], agents: [], format: "html" });
  await writeReport(out, result, { format: "html", out });
  const html = await readFile(out, { encoding: "utf8" });

  assert.ok(html.startsWith("<!doctype html>"));
  assert.ok(html.includes("<title>LLM-WIKI validate report</title>"));
  assert.ok(html.includes('class="tiles"'));
  assert.ok(html.includes("Wiki Graph"));
  assert.ok(html.includes("prefers-color-scheme: dark"));
});

test("renderHtmlDashboard escapes finding content and marks severity", () => {
  const html = renderHtmlDashboard({
    command: "audit",
    result: "warning",
    findings: [{ severity: "warning", rule: "related.missing", path: "docs/llm-wiki/x.md", message: "related entry does not exist: <script>alert(1)</script>." }],
    findingSummary: { total: 1, bySeverity: { warning: 1 }, byCategory: { related: 1 } }
  });

  assert.ok(html.includes("&lt;script&gt;"));
  assert.equal(html.includes("<script>alert(1)</script>"), false);
  assert.ok(html.includes("sev-warning"));
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

test("parseArgs accepts cursor and copilot agents", () => {
  const parsed = parseArgs(["init", "--write", "--agent", "cursor", "--agent", "copilot"]);

  assert.deepEqual(parsed.options.agents, ["cursor", "copilot"]);
  assert.deepEqual(parsed.errors, []);
});

test("agent all still expands to the original three adapters only", () => {
  const parsed = parseArgs(["validate", "--agent", "all"]);

  assert.deepEqual(parsed.options.agents, ["codex", "claude", "antigravity"]);
});

test("init write creates Cursor and Copilot adapter files pointing to the wiki entrypoint", async () => {
  const cwd = await makeProject("adapter-cursor-copilot-");
  await writeJson(path.join(cwd, "package.json"), { name: "adapters" });

  const result = await initCommand({
    cwd,
    dryRun: false,
    write: true,
    minimal: true,
    withAdapters: false,
    type: "unknown",
    profiles: [],
    agents: ["cursor", "copilot"],
    existing: "skip"
  });

  assert.ok(result.created.some((line) => line.includes(".cursor/rules/llm-wiki.mdc created")));
  assert.ok(result.created.some((line) => line.includes(".github/copilot-instructions.md created")));

  const cursor = await readFile(path.join(cwd, ".cursor", "rules", "llm-wiki.mdc"), { encoding: "utf8" });
  const copilot = await readFile(path.join(cwd, ".github", "copilot-instructions.md"), { encoding: "utf8" });
  assert.ok(cursor.includes("docs/llm-wiki/index.md"));
  assert.ok(copilot.includes("docs/llm-wiki/index.md"));
});

test("audit reports missing Cursor adapter only when the cursor agent is selected", async () => {
  const cwd = await makeProject("adapter-cursor-audit-");
  const result = await audit({ cwd, type: null, profiles: [], agents: ["cursor"], format: "text", strict: false });

  assert.ok(result.findings.some((finding) => finding.rule === "adapter.missing" && finding.path === ".cursor/rules/llm-wiki.mdc"));
  assert.equal(result.findings.some((finding) => finding.rule === "adapter.missing" && finding.path === ".github/copilot-instructions.md"), false);
});

test("handoff supports Cursor and Copilot with source-enrichment prompts", async () => {
  const cwd = await makeProject("handoff-cursor-");
  const cursor = await handoffCommand({
    cwd,
    dryRun: false,
    write: false,
    minimal: false,
    withAdapters: false,
    type: "backend",
    profiles: [],
    agents: ["cursor"],
    existing: "skip"
  });
  const copilot = await handoffCommand({
    cwd,
    dryRun: false,
    write: false,
    minimal: false,
    withAdapters: false,
    type: "backend",
    profiles: [],
    agents: ["copilot"],
    existing: "skip"
  });

  assert.equal(cursor.result, "pass");
  assert.equal(cursor.handoff.label, "Cursor");
  assert.ok(cursor.handoff.prompt.includes(".cursor/rules/llm-wiki.mdc"));
  assert.ok(cursor.text.includes("Cursor에게 넘어가서"));
  assert.equal(copilot.handoff.label, "GitHub Copilot");
  assert.ok(copilot.handoff.prompt.includes(".github/copilot-instructions.md"));
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
  const corpus = fixtureFiles.join("\n").replace(/\r\n/g, "\n");

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

test("loads and validates llm-wiki.config.json", async () => {
  const cwd = await makeProject("config-load-");
  await writeFile(path.join(cwd, "llm-wiki.config.json"), JSON.stringify({ type: "backend", profiles: ["okf-v0.1"], agents: ["codex"], strict: true }), { encoding: "utf8" });

  const { found, config, errors } = await loadProjectConfig(cwd);

  assert.equal(found, true);
  assert.deepEqual(errors, []);
  assert.equal(config.type, "backend");
  assert.deepEqual(config.profiles, ["okf-v0.1"]);
  assert.deepEqual(config.agents, ["codex"]);
  assert.equal(config.strict, true);
});

test("missing llm-wiki.config.json is a no-op", async () => {
  const cwd = await makeProject("config-none-");
  const { found, config, errors } = await loadProjectConfig(cwd);

  assert.equal(found, false);
  assert.equal(config, null);
  assert.deepEqual(errors, []);
});

test("reports invalid llm-wiki.config.json", async () => {
  const badJson = await makeProject("config-badjson-");
  await writeFile(path.join(badJson, "llm-wiki.config.json"), "{ not json", { encoding: "utf8" });
  const jsonResult = await loadProjectConfig(badJson);

  const badShape = await makeProject("config-badshape-");
  await writeFile(path.join(badShape, "llm-wiki.config.json"), JSON.stringify({ type: 123, profiles: "frontend" }), { encoding: "utf8" });
  const shapeResult = await loadProjectConfig(badShape);

  assert.ok(jsonResult.errors.some((error) => error.includes("valid JSON")));
  assert.ok(shapeResult.errors.some((error) => error.includes("type")));
  assert.ok(shapeResult.errors.some((error) => error.includes("profiles")));
});

test("mergeConfigIntoOptions fills unset options but lets CLI flags win", () => {
  const filled = mergeConfigIntoOptions(
    { type: null, profiles: [], agents: [], strict: false },
    { type: "library", profiles: ["okf-v0.1"], agents: ["claude"], strict: true }
  );
  assert.equal(filled.type, "library");
  assert.deepEqual(filled.profiles, ["okf-v0.1"]);
  assert.deepEqual(filled.agents, ["claude"]);
  assert.equal(filled.strict, true);

  const overridden = mergeConfigIntoOptions(
    { type: "backend", profiles: ["frontend"], agents: ["codex"], strict: false },
    { type: "library", profiles: ["okf-v0.1"], agents: ["claude"] }
  );
  assert.equal(overridden.type, "backend");
  assert.deepEqual(overridden.profiles, ["frontend"]);
  assert.deepEqual(overridden.agents, ["codex"]);
});

test("config type flows into detection when no --type is given", async () => {
  const cwd = await makeProject("config-detect-");
  await writeFile(path.join(cwd, "llm-wiki.config.json"), JSON.stringify({ type: "backend" }), { encoding: "utf8" });

  const { config } = await loadProjectConfig(cwd);
  const options = mergeConfigIntoOptions({ cwd, type: null, profiles: [], agents: [], format: "text", strict: false }, config);
  const result = await audit(options);

  assert.equal(result.detection.projectType, "backend");
});

test("doctor reports llm-wiki.config.json presence", async () => {
  const cwd = await makeProject("config-doctor-");
  const absent = await doctor({ cwd, type: null, profiles: [], format: "text" });
  await writeFile(path.join(cwd, "llm-wiki.config.json"), JSON.stringify({ type: "library" }), { encoding: "utf8" });
  const present = await doctor({ cwd, type: null, profiles: [], format: "text" });

  assert.ok(absent.checks.includes("llm_wiki_config: absent"));
  // doctor echoes the config's declared keys (EP2), so the merged config is observable.
  assert.ok(present.checks.some((c) => c.startsWith("llm_wiki_config: present")));
  assert.ok(present.checks.some((c) => c.includes("type=library")));
});

test("doctor echoes an invalid config as a present/invalid note", async () => {
  const cwd = await makeProject("doctor-config-bad-");
  await writeFile(path.join(cwd, "llm-wiki.config.json"), "{ not json", { encoding: "utf8" });
  const result = await doctor({ cwd, type: null, profiles: [], format: "text" });
  assert.ok(result.checks.some((c) => c.startsWith("llm_wiki_config: present (invalid")));
});

test("init --write scaffolds a starter llm-wiki.config.json (EP2)", async () => {
  const cwd = await makeProject("init-config-scaffold-");
  const result = await initCommand({ cwd, write: true, minimal: false, withAdapters: false, type: "backend", agents: [], profiles: [], existing: "skip" });
  const config = JSON.parse(await readFile(path.join(cwd, "llm-wiki.config.json"), { encoding: "utf8" }));
  assert.equal(config.type, "backend");
  assert.ok(result.created.some((line) => line.includes("llm-wiki.config.json created")));
});

test("init never overwrites an existing llm-wiki.config.json, even with --existing overwrite", async () => {
  const cwd = await makeProject("init-config-keep-");
  await writeFile(path.join(cwd, "llm-wiki.config.json"), JSON.stringify({ type: "frontend" }), { encoding: "utf8" });
  const result = await initCommand({ cwd, write: true, minimal: false, withAdapters: false, type: "backend", agents: [], profiles: [], existing: "overwrite" });
  const config = JSON.parse(await readFile(path.join(cwd, "llm-wiki.config.json"), { encoding: "utf8" }));
  assert.equal(config.type, "frontend"); // user config left untouched
  assert.ok(result.skipped.some((line) => line.includes("llm-wiki.config.json exists")));
});

test("init --dry-run previews the config scaffold without writing it", async () => {
  const cwd = await makeProject("init-config-preview-");
  const result = await initCommand({ cwd, dryRun: true, minimal: false, withAdapters: false, type: "backend", agents: [], profiles: [] });
  assert.ok(result.planned.some((line) => line.includes("llm-wiki.config.json would be created")));
  assert.equal(await fileExists(path.join(cwd, "llm-wiki.config.json")), false);
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
  assert.equal(packageJson.version, "1.8.0");
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

test("parseArgs supports fix and enforces its option scope", () => {
  const preview = parseArgs(["fix"]);
  const write = parseArgs(["fix", "--write"]);
  const explicitDryRun = parseArgs(["fix", "--dry-run"]);
  const conflict = parseArgs(["fix", "--dry-run", "--write"]);
  const unsupported = parseArgs(["fix", "--strict"]);

  assert.equal(preview.command, "fix");
  assert.equal(preview.options.write, false);
  assert.deepEqual(preview.errors, []);
  assert.equal(write.options.write, true);
  assert.deepEqual(write.errors, []);
  assert.equal(explicitDryRun.options.dryRun, true);
  assert.deepEqual(explicitDryRun.errors, []);
  assert.ok(conflict.errors.some((error) => error.includes("--dry-run and --write cannot be used together")));
  assert.ok(unsupported.errors.some((error) => error.includes("--strict is not supported by fix")));
});

test("fix reports nothing when the wiki is not initialized", async () => {
  const cwd = await makeProject("fix-empty-");
  const result = await fixCommand({ cwd, write: false });

  assert.equal(result.dryRun, true);
  assert.equal(result.result, "pass");
  assert.deepEqual(result.planned, []);
});

test("fix dry-run plans safe autofixes and writes nothing", async () => {
  const cwd = await makeProject("fix-plan-");
  await buildFixFixture(cwd);

  const result = await fixCommand({ cwd, write: false });

  assert.equal(result.dryRun, true);
  assert.ok(result.planned.some((line) => line.includes("missing-fields.md") && line.includes("insert visibility")));
  assert.ok(result.planned.some((line) => line.includes("evidence-doc.md") && line.includes("## Evidence")));
  assert.ok(result.planned.some((line) => line.includes("MISSING.md") && line.includes("create needs_review stub")));
  assert.ok(result.planned.some((line) => line.includes("BROKEN.md") && line.includes("create needs_review stub")));
  assert.ok(result.skipped.some((line) => line.includes("required field 'author'")));

  // Nothing was written in preview mode.
  assert.equal(await pathExistsTest(path.join(cwd, "docs", "llm-wiki", "MISSING.md")), false);
  const missingFields = await readFile(path.join(cwd, "docs", "llm-wiki", "missing-fields.md"), { encoding: "utf8" });
  assert.ok(!missingFields.includes("visibility: internal"));
});

test("fix --write applies the accepted scope and is idempotent", async () => {
  const cwd = await makeProject("fix-write-");
  await buildFixFixture(cwd);
  const today = new Date().toISOString().slice(0, 10);

  const result = await fixCommand({ cwd, write: true });
  assert.equal(result.write, true);
  assert.equal(result.result, "pass");

  // Tier A fields inserted, Tier B left to a human, last_updated refreshed.
  const missingFields = await readFile(path.join(cwd, "docs", "llm-wiki", "missing-fields.md"), { encoding: "utf8" });
  assert.ok(missingFields.includes("visibility: internal"));
  assert.ok(missingFields.includes("contains_sensitive_info: false"));
  assert.ok(missingFields.includes(`last_updated: ${today}`));
  assert.ok(!/^author:/m.test(missingFields));

  // Body ## Evidence section reconciled from frontmatter evidence.
  const evidenceDoc = await readFile(path.join(cwd, "docs", "llm-wiki", "evidence-doc.md"), { encoding: "utf8" });
  assert.ok(evidenceDoc.includes("## Evidence"));
  assert.ok(evidenceDoc.includes("- package.json#L1"));
  assert.ok(evidenceDoc.indexOf("## Evidence") < evidenceDoc.indexOf("## Open Questions"));

  // Broken related and markdown-link targets became needs_review stubs.
  const stub = await readFile(path.join(cwd, "docs", "llm-wiki", "MISSING.md"), { encoding: "utf8" });
  assert.ok(stub.startsWith("---\n"));
  assert.ok(stub.includes("status: needs_review"));
  assert.ok(await pathExistsTest(path.join(cwd, "docs", "llm-wiki", "BROKEN.md")));

  // The stub itself parses as valid frontmatter (no required-field errors).
  const stubValidation = await validateFrontmatterCommand({ cwd: path.join(cwd, "docs", "llm-wiki"), strict: false });
  assert.ok(!stubValidation.findings.some((finding) => finding.path === "MISSING.md" && finding.rule.startsWith("frontmatter")));

  // Running again changes nothing.
  const again = await fixCommand({ cwd, write: true });
  assert.deepEqual(again.applied, []);
});

test("fix leaves verified docs and out-of-scope values untouched", async () => {
  const cwd = await makeProject("fix-guard-");
  await mkdir(path.join(cwd, "docs", "llm-wiki"), { recursive: true });
  await writeFile(path.join(cwd, "docs", "llm-wiki", "index.md"), fixtureDoc({
    title: "Guard Index",
    extraFrontmatter: "related:\n  - docs/llm-wiki/log.md\n  - README.md",
    body: "# Guard Index"
  }), { encoding: "utf8" });
  await writeFile(path.join(cwd, "docs", "llm-wiki", "log.md"), fixtureDoc({ title: "Log", body: "# Log" }), { encoding: "utf8" });
  const verifiedRaw = `---
title: Verified Doc
tags:
  - llm-wiki
status: verified
doc_type: reference
project: fixture
last_updated: 2026-07-02
reviewed_by: human
reviewed_at: 2026-07-02
author: test
last_edited_by: node-test
wiki_block_version: v1
source_files:
  - package.json
evidence:
  - package.json#L1
related:
  - docs/llm-wiki/index.md
visibility: internal
contains_sensitive_info: false
---

# Verified Doc

No Evidence section here on purpose.
`;
  await writeFile(path.join(cwd, "docs", "llm-wiki", "verified-doc.md"), verifiedRaw, { encoding: "utf8" });

  const result = await fixCommand({ cwd, write: true });

  // Verified doc content is byte-for-byte unchanged.
  const verifiedAfter = await readFile(path.join(cwd, "docs", "llm-wiki", "verified-doc.md"), { encoding: "utf8" });
  assert.equal(verifiedAfter, verifiedRaw);
  assert.ok(result.skipped.some((line) => line.includes("verified-doc.md") && line.includes("verified document")));

  // A broken related target outside docs/llm-wiki is never created there.
  assert.equal(await pathExistsTest(path.join(cwd, "README.md")), false);
  assert.ok(result.skipped.some((line) => line.includes("README.md") && line.includes("outside stub scope")));
});

test("programmatic API exposes a frozen command map mirroring the CLI surface", () => {
  const expected = [
    "doctor", "validate", "validate-frontmatter", "status", "next", "explain",
    "audit", "quickstart", "handoff", "prompt", "init", "migrate", "fix",
    "drift", "graph", "stats", "release-notes"
  ];

  assert.ok(Object.isFrozen(api.commands));
  assert.deepEqual(Object.keys(api.commands).sort(), [...expected].sort());
  for (const name of expected) {
    assert.equal(typeof api.commands[name], "function", `${name} handler is a function`);
  }
  // The map mirrors the individually exported functions (same references).
  assert.equal(api.commands.audit, api.audit);
  assert.equal(api.commands.doctor, api.doctor);
  assert.equal(api.commands.fix, api.fixCommand);
  assert.equal(api.commands["release-notes"], api.releaseNotesCommand);
  assert.equal(typeof api.parseArgs, "function");
  assert.equal(typeof api.run, "function");
});

test("SCHEMA_VERSION is a number matching the JSON schemaVersion field", () => {
  assert.equal(typeof api.SCHEMA_VERSION, "number");
  assert.equal(api.SCHEMA_VERSION, 1);
});

test("normalizeOptions fills every default, resolves cwd, and returns fresh arrays", () => {
  const options = api.normalizeOptions({ cwd: ".", strict: true });
  assert.equal(options.format, "text");
  assert.equal(options.existing, "skip");
  assert.equal(options.strict, true);
  assert.equal(options.type, null);
  assert.ok(Array.isArray(options.profiles) && options.profiles.length === 0);
  assert.ok(Array.isArray(options.agents) && options.agents.length === 0);
  assert.ok(path.isAbsolute(options.cwd));
  // Fresh arrays per call so callers cannot alias shared state.
  assert.notEqual(api.normalizeOptions().profiles, api.normalizeOptions().profiles);
});

test("a command runs in-process via the map with normalized options", async () => {
  const cwd = await makeProject("api-run-");
  const result = await api.commands.doctor(api.normalizeOptions({ cwd }));
  assert.equal(result.command, "doctor");
  assert.ok(typeof result.text === "string");
});

test("resolveOptions merges llm-wiki.config.json like the CLI (config-aware API)", async () => {
  const cwd = await makeProject("api-config-");
  await writeJson(path.join(cwd, "llm-wiki.config.json"), { type: "backend", strict: true, agents: ["codex"] });
  const { options, errors } = await api.resolveOptions({ cwd });
  assert.deepEqual(errors, []);
  assert.equal(options.type, "backend");
  assert.equal(options.strict, true);
  assert.deepEqual(options.agents, ["codex"]);
  assert.ok(path.isAbsolute(options.cwd));
});

test("resolveOptions lets explicit overrides win while config still adds strict", async () => {
  const cwd = await makeProject("api-config-win-");
  await writeJson(path.join(cwd, "llm-wiki.config.json"), { type: "backend", strict: true });
  const { options } = await api.resolveOptions({ cwd, type: "frontend" });
  assert.equal(options.type, "frontend"); // explicit override wins over config
  assert.equal(options.strict, true);      // config can still turn strict on additively
});

test("resolveOptions with no config file is a clean no-op", async () => {
  const cwd = await makeProject("api-config-none-");
  const { options, errors } = await api.resolveOptions({ cwd });
  assert.deepEqual(errors, []);
  assert.equal(options.type, null);
});

test("resolveOptions surfaces malformed config as errors instead of throwing", async () => {
  const cwd = await makeProject("api-config-bad-");
  await writeFile(path.join(cwd, "llm-wiki.config.json"), "{ not json", { encoding: "utf8" });
  const { errors } = await api.resolveOptions({ cwd });
  assert.ok(errors.length > 0);
});

test("config rules: loadProjectConfig validates the toggle map (1.8)", async () => {
  const okCwd = await makeProject("rules-ok-");
  await writeFile(path.join(okCwd, "llm-wiki.config.json"), JSON.stringify({ rules: { "related.missing": "off", "evidence.stale": "error" } }), { encoding: "utf8" });
  const ok = await loadProjectConfig(okCwd);
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.config.rules, { "related.missing": "off", "evidence.stale": "error" });

  const badValue = await makeProject("rules-badval-");
  await writeFile(path.join(badValue, "llm-wiki.config.json"), JSON.stringify({ rules: { "related.missing": "nope" } }), { encoding: "utf8" });
  assert.ok((await loadProjectConfig(badValue)).errors.length > 0);

  const badShape = await makeProject("rules-badshape-");
  await writeFile(path.join(badShape, "llm-wiki.config.json"), JSON.stringify({ rules: ["related.missing"] }), { encoding: "utf8" });
  assert.ok((await loadProjectConfig(badShape)).errors.length > 0);
});

test("rule toggle: 'off' drops a finding and a severity override re-grades it (1.8)", async () => {
  const cwd = await makeProject("rules-toggle-");
  await mkdir(path.join(cwd, "docs", "llm-wiki"), { recursive: true });
  // Frontmatter present but missing required fields -> frontmatter.required (error).
  await writeFile(path.join(cwd, "docs", "llm-wiki", "thin.md"), "---\ntitle: Thin\n---\n\nbody\n", { encoding: "utf8" });

  const base = await validateFrontmatterCommand(api.normalizeOptions({ cwd }));
  assert.ok(base.findings.some((f) => f.rule === "frontmatter.required"), "baseline has the rule");

  const off = await validateFrontmatterCommand({ ...api.normalizeOptions({ cwd }), rules: { "frontmatter.required": "off" } });
  assert.ok(!off.findings.some((f) => f.rule === "frontmatter.required"), "'off' drops the rule's findings");

  const warn = await validateFrontmatterCommand({ ...api.normalizeOptions({ cwd }), rules: { "frontmatter.required": "warning" } });
  const overridden = warn.findings.filter((f) => f.rule === "frontmatter.required");
  assert.ok(overridden.length > 0 && overridden.every((f) => f.severity === "warning"), "override changes severity");
});

test("safety: sensitive-info findings are never toggleable (1.8)", async () => {
  const cwd = await makeProject("rules-safety-");
  await mkdir(path.join(cwd, "docs", "llm-wiki"), { recursive: true });
  await writeFile(path.join(cwd, "docs", "llm-wiki", "index.md"), "---\ntitle: I\nstatus: needs_review\ndoc_type: index\n---\n", { encoding: "utf8" });
  // A clearly-fake token-assignment value trips the sensitive-info scan.
  await writeFile(path.join(cwd, "docs", "llm-wiki", "leak.md"), "---\ntitle: L\nstatus: needs_review\ndoc_type: reference\n---\n\ntoken: abcdefgh12345678\n", { encoding: "utf8" });

  const off = await audit({ ...api.normalizeOptions({ cwd }), rules: { "sensitive.redacted": "off" } });
  assert.ok(off.findings.some((f) => f.rule === "sensitive.redacted"), "sensitive.redacted stays even when toggled off");
});

test("content.thin_body is off by default and opt-in via config rules (1.8)", async () => {
  const cwd = await makeProject("thin-body-");
  await mkdir(path.join(cwd, "docs", "llm-wiki"), { recursive: true });
  await writeFile(path.join(cwd, "docs", "llm-wiki", "stub.md"), "---\ntitle: Stub\nstatus: needs_review\ndoc_type: reference\n---\n\n# Stub\n\nTODO.\n", { encoding: "utf8" });

  const defaultRun = await audit(api.normalizeOptions({ cwd }));
  assert.ok(!defaultRun.findings.some((f) => f.rule === "content.thin_body"), "off by default");

  const optedIn = await audit({ ...api.normalizeOptions({ cwd }), rules: { "content.thin_body": "warning" } });
  assert.ok(optedIn.findings.some((f) => f.rule === "content.thin_body"), "opt-in produces the finding");
});

test("--format json output is stamped with schemaVersion without dropping fields", async () => {
  const result = { command: "audit", result: "pass", findings: [], text: "rendered" };
  let captured = "";
  const original = console.log;
  console.log = (line) => { captured = line; };
  try {
    await printResult(result, { format: "json" });
  } finally {
    console.log = original;
  }
  const parsed = JSON.parse(captured);
  assert.equal(parsed.schemaVersion, api.SCHEMA_VERSION);
  // Additive: existing consumers still find every field, including text on the console path.
  assert.equal(parsed.command, "audit");
  assert.equal(parsed.result, "pass");
  assert.deepEqual(parsed.findings, []);
  assert.equal(parsed.text, "rendered");
});

test("JSON report file carries schemaVersion, keeps command, and still strips text", async () => {
  const cwd = await makeProject("api-json-out-");
  const out = path.join(cwd, "reports", "audit.json");
  const result = await audit({ cwd, type: null, format: "json", strict: false });

  await writeReport(out, result, { format: "json", out });
  const content = JSON.parse(await readFile(out, { encoding: "utf8" }));

  assert.equal(content.schemaVersion, api.SCHEMA_VERSION);
  assert.equal(content.command, "audit"); // regression: existing JSON consumers unaffected
  assert.equal(content.text, undefined); // runtime text still redacted from files
});

test("non-JSON graph exports are not wrapped with schemaVersion", async () => {
  const cwd = await makeProject("api-graph-mermaid-");
  const graph = await graphCommand({ cwd, format: "mermaid" });
  const rendered = renderOutputFile(graph, { format: "mermaid" });
  assert.ok(rendered.startsWith("```mermaid"));
  assert.ok(!rendered.includes("schemaVersion"));
});

test("command results carry schemaVersion, and .text stays text regardless of format", async () => {
  const cwd = await makeProject("api-schemaversion-");
  const jsonResult = await audit(api.normalizeOptions({ cwd, format: "json" }));
  const textResult = await audit(api.normalizeOptions({ cwd, format: "text" }));

  assert.equal(jsonResult.schemaVersion, api.SCHEMA_VERSION);
  assert.equal(textResult.schemaVersion, api.SCHEMA_VERSION);
  // .text is always the rendered human text report; format only affects CLI/run() rendering.
  assert.ok(jsonResult.text.startsWith("# LLM-WIKI"));
  assert.equal(jsonResult.text, textResult.text);

  // Manual (non-withText) returns carry it too.
  const notes = await releaseNotesCommand(api.normalizeOptions({ cwd }));
  assert.equal(notes.schemaVersion, api.SCHEMA_VERSION);
});

test("normalizeOptions accepts a parseArgs result and its .options identically", () => {
  const parsed = api.parseArgs(["audit", "--cwd", "/proj", "--format", "json", "--strict"]);
  const fromWhole = api.normalizeOptions(parsed);
  const fromOptions = api.normalizeOptions(parsed.options);

  assert.equal(fromWhole.cwd, fromOptions.cwd);
  assert.equal(fromWhole.cwd, path.resolve("/proj"));
  assert.equal(fromWhole.format, "json");
  assert.equal(fromWhole.strict, true);
  // A plain partial (no nested .options) still works as before.
  assert.equal(api.normalizeOptions({ format: "markdown" }).format, "markdown");
});

test("run returns the numeric exit code for each outcome", async () => {
  const clean = await makeProject("api-run-pass-");
  const empty = await makeProject("api-run-warn-");

  assert.equal(await runCliSilently(["doctor", "--cwd", clean]), 0);       // pass
  assert.equal(await runCliSilently(["validate", "--strict", "--cwd", empty]), 1); // strict warning -> error
  assert.equal(await runCliSilently(["explain", "no.such.rule"]), 2);      // blocked finding
  assert.equal(await runCliSilently(["audit", "--not-an-option"]), 3);     // usage error
});

test("HTML dashboard links resolve from the --out directory, not the repo root", () => {
  const result = {
    command: "audit",
    result: "pass",
    findings: [],
    wikiGraph: {
      summary: { documents: 1, edges: 0, orphanDocuments: 0, unresolvedWikiLinks: 0, aliases: 0 },
      documents: [{ path: "docs/llm-wiki/x.md", title: "X", aliases: [], inboundCount: 0 }],
      orphanDocuments: [],
      unresolvedConcepts: [],
      aliases: []
    }
  };
  const base = path.join(os.tmpdir(), "dash-base");
  const out = path.join(base, "docs", "reports", "dash.html");

  const rebased = renderHtmlDashboard(result, { cwd: base, out });
  const expected = path.relative(path.dirname(out), path.join(base, "docs", "llm-wiki", "x.md")).split(path.sep).join("/");
  assert.match(rebased, new RegExp(`<a href="${expected.replace(/[.]/g, "\\.")}"`));

  // With no --out (stdout dashboard) the repo-root-relative path is unchanged.
  const plain = renderHtmlDashboard(result, {});
  assert.match(plain, /<a href="docs\/llm-wiki\/x\.md"/);
});

async function runCliSilently(argv) {
  const realLog = console.log;
  const realErr = console.error;
  console.log = () => {};
  console.error = () => {};
  try {
    return await api.run(argv);
  } finally {
    console.log = realLog;
    console.error = realErr;
    process.exitCode = 0;
  }
}

async function buildFixFixture(cwd) {
  const wikiRoot = path.join(cwd, "docs", "llm-wiki");
  await mkdir(wikiRoot, { recursive: true });

  await writeFile(path.join(wikiRoot, "index.md"), fixtureDoc({
    title: "Fixture Index",
    extraFrontmatter: "related:\n  - docs/llm-wiki/log.md\n  - docs/llm-wiki/MISSING.md",
    body: "# Fixture Index\n\nSee [broken](BROKEN.md) and [log](log.md)."
  }), { encoding: "utf8" });

  await writeFile(path.join(wikiRoot, "log.md"), fixtureDoc({ title: "Log", body: "# Log" }), { encoding: "utf8" });

  // Missing Tier A fields (visibility, contains_sensitive_info) and a Tier B field (author).
  await writeFile(path.join(wikiRoot, "missing-fields.md"), `---
title: Missing Fields Doc
tags:
  - llm-wiki
status: needs_review
doc_type: reference
project: fixture
last_updated: 2026-07-02
last_edited_by: node-test
wiki_block_version: v1
source_files:
  - package.json
related:
  - docs/llm-wiki/index.md
---

# Missing Fields Doc
`, { encoding: "utf8" });

  // Frontmatter evidence present, but no body ## Evidence section.
  await writeFile(path.join(wikiRoot, "evidence-doc.md"), `---
title: Evidence Doc
tags:
  - llm-wiki
status: needs_review
doc_type: reference
project: fixture
last_updated: 2026-07-02
author: test
last_edited_by: node-test
wiki_block_version: v1
source_files:
  - package.json
evidence:
  - package.json#L1
  - src/cli.js#symbol:main
related:
  - docs/llm-wiki/index.md
visibility: internal
contains_sensitive_info: false
---

# Evidence Doc

## Open Questions

- Anything?
`, { encoding: "utf8" });
}

function fixtureDoc({ title, body, extraFrontmatter }) {
  const related = extraFrontmatter ?? "related:\n  - docs/llm-wiki/log.md";
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
  - package.json
${related}
visibility: internal
contains_sensitive_info: false
---

${body}
`;
}

async function pathExistsTest(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

async function makeProject(prefix) {
  return mkdtemp(path.join(os.tmpdir(), `llm-wiki-${prefix}`));
}

async function fileExists(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8" });
}

async function writeWikiDoc(cwd, filename, title, body) {
  return writeWikiDocWithSourceFiles(cwd, filename, title, body, ["package.json"]);
}

async function writeWikiDocAt(cwd, filename, title, body, transform) {
  const wikiRoot = path.join(cwd, "docs", "llm-wiki");
  const targetPath = path.join(wikiRoot, filename);
  await mkdir(path.dirname(targetPath), { recursive: true });
  const base = frontmatter(title, body);
  await writeFile(targetPath, transform ? transform(base) : base, { encoding: "utf8" });
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

async function writeVerifiedSourceDoc(cwd, filename, sourceFile, reviewedAt) {
  const wikiRoot = path.join(cwd, "docs", "llm-wiki");
  const targetPath = path.join(wikiRoot, filename);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `---
title: Verified Source Doc
tags:
  - llm-wiki
status: verified
doc_type: wiki_index
project: fixture
last_updated: ${reviewedAt}
reviewed_at: ${reviewedAt}
author: test
last_edited_by: node-test
wiki_block_version: v1
source_files:
  - ${sourceFile}
related:
  - docs/llm-wiki/log.md
visibility: internal
contains_sensitive_info: false
---

# Verified Source Doc

Backed by ${sourceFile}.

## Evidence

- ${sourceFile}
`, { encoding: "utf8" });
}

async function writeVerifiedLineEvidenceDoc(cwd, filename, evidenceRef, reviewedAt) {
  const wikiRoot = path.join(cwd, "docs", "llm-wiki");
  const targetPath = path.join(wikiRoot, filename);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `---
title: Line Evidence Doc
tags:
  - llm-wiki
status: verified
doc_type: wiki_index
project: fixture
last_updated: ${reviewedAt}
reviewed_at: ${reviewedAt}
author: test
last_edited_by: node-test
wiki_block_version: v1
source_files:
evidence:
  - ${evidenceRef}
related:
  - docs/llm-wiki/log.md
visibility: internal
contains_sensitive_info: false
---

# Line Evidence Doc

Cites ${evidenceRef}.

## Evidence

- ${evidenceRef}
`, { encoding: "utf8" });
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

