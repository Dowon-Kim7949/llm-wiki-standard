import test from "node:test";
import assert from "node:assert/strict";
import { cp, mkdtemp, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { detectFrontendDomains } from "../src/commands/domains.js";
import { enrichmentChecklist } from "../src/commands/scans.js";
import { audit, checkRunCommand, detectDomainDirectories, doctor, domainDisplayName, driftCommand, driftTargets, evidenceTier, explainCommand, fixCommand, getDocCommand, getRelatedCommand, graphCommand, handoffCommand, impactCommand, initCommand, listDocsCommand, migrateCommand, nextCommand, normalizeDomainSlug, onboardCommand, planDomainDocs, prepareCommand, promptCommand, quickstartCommand, releaseNotesCommand, reviewCommand, searchDocsCommand, statsCommand, statusCommand, validateCommand, validateFrontmatterCommand } from "../src/commands.js";
import { parseArgs } from "../src/cli.js";
import { writeReport, renderHtmlDashboard, renderOutputFile, printResult } from "../src/report.js";
import * as api from "../src/index.js";
import { loadProjectConfig, mergeConfigIntoOptions } from "../src/config-file.js";
import { buildReleaseNotes, buildReleaseNotesBody, parseCommit } from "../src/release-notes.js";
import { fileChangedSince, lineRangeChangedSince } from "../src/git.js";
import { FINDING_EXPLANATIONS, applyRuleConfig } from "../src/commands/findings.js";
import { localizeFinding, localizeMessage, normalizeLang } from "../src/i18n.js";
import { buildTaskPrompt, initialEnrichmentWorkflow } from "../src/task-prompts.js";
import { SKILL_TASKS, selectedSkillFormats } from "../src/commands/skills.js";
import { selectSections, estimateTokens, clampText } from "../src/commands/retrieval.js";
import { selectTaskPath, classifyTaskRisk } from "../src/commands/task-path.js";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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

test("detectFrontendDomains finds SPA feature folders and excludes UI plumbing (P1)", async () => {
  const cwd = await makeProject("fe-folders-");
  for (const dir of [
    "src/pages/hazards", "src/pages/jobs", "src/views/transfers",
    "src/features/auth", "src/screens/profile",
    "src/pages/components", "src/pages/shared", "src/pages/layouts"
  ]) {
    await mkdir(path.join(cwd, ...dir.split("/")), { recursive: true });
  }
  const found = await detectFrontendDomains(cwd);
  const names = found.map((item) => item.rawName).sort();
  assert.deepEqual(names, ["auth", "hazards", "jobs", "profile", "transfers"]); // UI plumbing excluded
  const hazards = found.find((item) => item.rawName === "hazards");
  assert.equal(hazards.kind, "dir");
  assert.equal(hazards.sourceFile, "src/pages/hazards");
});

test("detectFrontendDomains parses route groups from vue-router and react-router files (P1)", async () => {
  const cwd = await makeProject("fe-routes-vue-");
  await mkdir(path.join(cwd, "src", "router"), { recursive: true });
  await writeFile(path.join(cwd, "src", "router", "routes.ts"),
    "export default [\n" +
    "  { path: '/hazards', component: H },\n" +
    "  { path: '/jobs/:id', component: J },\n" +
    "  { path: '/', component: Home },\n" +
    "  { path: '/:pathMatch(.*)*', component: NotFound },\n" +
    "  { path: '/shared', component: S },\n" +
    "]\n", { encoding: "utf8" });
  const vue = await detectFrontendDomains(cwd);
  assert.deepEqual(vue.map((item) => item.rawName).sort(), ["hazards", "jobs"]); // root/wildcard/'shared' dropped
  assert.equal(vue.find((item) => item.rawName === "hazards").kind, "route");

  const cwd2 = await makeProject("fe-routes-react-");
  await mkdir(path.join(cwd2, "src"), { recursive: true });
  await writeFile(path.join(cwd2, "src", "router.tsx"),
    '<Routes>\n  <Route path="/devices" element={<D/>} />\n  <Route path="/statistics" element={<S/>} />\n</Routes>\n',
    { encoding: "utf8" });
  const react = await detectFrontendDomains(cwd2);
  assert.deepEqual(react.map((item) => item.rawName).sort(), ["devices", "statistics"]);
});

test("detectDomainDirectories ignores SPA feature folders (backend detection unchanged)", async () => {
  const cwd = await makeProject("fe-not-backend-");
  for (const dir of ["src/pages/hazards", "src/views/jobs", "src/screens/profile"]) {
    await mkdir(path.join(cwd, ...dir.split("/")), { recursive: true });
  }
  // pages/views/screens are not backend domain parents → backend detector finds nothing.
  assert.deepEqual(await detectDomainDirectories(cwd), []);
});

test("init surfaces a no-domains notice for a domain-capable project, and --domains adds per-domain docs (P3)", async () => {
  const cwd = await makeProject("p3-domains-");
  await writeJson(path.join(cwd, "package.json"), { name: "p3", dependencies: { vue: "^3.0.0" } });

  // Frontend project with no domain folders → explicit notice, no per-domain docs (no silent no-op).
  const bare = await initCommand({ cwd, dryRun: true, minimal: false, withAdapters: false, type: "frontend" });
  assert.ok(bare.skipped.some((line) => line.includes("No per-domain docs")), "explicit no-domains notice shown");
  assert.ok(!bare.planned.some((line) => line.includes("domains/01_")), "no per-domain doc planned");

  // --domains names them explicitly → per-domain docs planned, notice cleared.
  const manual = await initCommand({ cwd, dryRun: true, minimal: false, withAdapters: false, type: "frontend", domains: ["hazards", "jobs"] });
  assert.ok(manual.planned.some((line) => line.includes("domains/01_hazards.md")));
  assert.ok(manual.planned.some((line) => line.includes("domains/02_jobs.md")));
  assert.ok(!manual.skipped.some((line) => line.includes("No per-domain docs")), "notice cleared when domains are named");
});

test("backend with routes only in a single file yields no per-domain docs", async () => {
  const cwd = await makeProject("domain-single-file-");
  await mkdir(path.join(cwd, "app"), { recursive: true });
  await writeFile(path.join(cwd, "app", "main.py"), "# all routes defined here\n", { encoding: "utf8" });

  assert.equal((await detectDomainDirectories(cwd)).length, 0);
});

test("planDomainDocs is a deterministic snapshot: sorted ordinals, slugs, merged sources (P7)", async () => {
  const cwd = await makeProject("domain-snapshot-");
  // Mixed tree exercising every deterministic rule at once: a dir domain, file
  // domains, a cross-kind duplicate (order), an excluded dir (shared), an excluded
  // file name (index), and camelCase slug normalization (userAccount).
  await mkdir(path.join(cwd, "src", "modules", "userAccount"), { recursive: true });
  await mkdir(path.join(cwd, "src", "modules", "order"), { recursive: true });
  await mkdir(path.join(cwd, "src", "modules", "shared"), { recursive: true });
  await mkdir(path.join(cwd, "app", "endpoints"), { recursive: true });
  for (const name of ["billing", "order", "index"]) {
    await writeFile(path.join(cwd, "app", "endpoints", `${name}.py`), "# x\n", { encoding: "utf8" });
  }

  const plans = planDomainDocs(await detectDomainDirectories(cwd));
  assert.deepEqual(
    plans.map((plan) => ({ rel: plan.rel, slug: plan.slug, domainName: plan.domainName, sourceFiles: plan.sourceFiles })),
    [
      { rel: "docs/llm-wiki/domains/01_billing.md", slug: "billing", domainName: "Billing", sourceFiles: ["app/endpoints/billing.py"] },
      { rel: "docs/llm-wiki/domains/02_order.md", slug: "order", domainName: "Order", sourceFiles: ["app/endpoints/order.py", "src/modules/order"] },
      { rel: "docs/llm-wiki/domains/03_user_account.md", slug: "user_account", domainName: "User Account", sourceFiles: ["src/modules/userAccount"] }
    ]
  );
});

test("detectDomainDirectories excludes aggregator/infra file names, keeps real resources (P7)", async () => {
  const cwd = await makeProject("domain-file-excl-");
  await mkdir(path.join(cwd, "app", "routers"), { recursive: true });
  for (const name of ["index", "main", "app", "base", "schemas", "models", "types", "constants", "settings", "invoice", "shipment"]) {
    await writeFile(path.join(cwd, "app", "routers", `${name}.ts`), "// x\n", { encoding: "utf8" });
  }
  const names = (await detectDomainDirectories(cwd)).map((item) => item.rawName).sort();
  assert.deepEqual(names, ["invoice", "shipment"]); // FILE_DOMAIN_EXCLUDE drops aggregators/infra
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

test("init --write wires domain docs into index and DOMAIN_FEATURES (P6)", async () => {
  const cwd = await makeProject("domain-wire-");
  await mkdir(path.join(cwd, "src", "modules", "user"), { recursive: true });
  await mkdir(path.join(cwd, "src", "modules", "order"), { recursive: true });

  await initCommand({ cwd, write: true, minimal: false, withAdapters: false, type: "backend", existing: "skip" });

  const wikiDir = path.join(cwd, "docs", "llm-wiki");
  // Index links the domain overview (read order + related) so the entry point
  // routes to the domain map, not only the domain docs' back-links.
  const index = await readFile(path.join(wikiDir, "index.md"), "utf8");
  assert.ok(index.includes("[Domain Overview](./domains/00_overview.md)"));
  assert.ok(index.includes("- docs/llm-wiki/domains/00_overview.md"));

  // DOMAIN_FEATURES lists each detected domain doc under a Domains section.
  const domainFeatures = await readFile(path.join(wikiDir, "DOMAIN_FEATURES.md"), "utf8");
  assert.ok(domainFeatures.includes("## Domains"));
  assert.ok(domainFeatures.includes("[Order](./domains/01_order.md)"));
  assert.ok(domainFeatures.includes("[User](./domains/02_user.md)"));
});

test("init --write leaves index/DOMAIN_FEATURES unwired when no domains (P6 byte-identical)", async () => {
  const cwd = await makeProject("domain-nowire-");

  await initCommand({ cwd, write: true, minimal: false, withAdapters: false, type: "backend", existing: "skip" });

  const wikiDir = path.join(cwd, "docs", "llm-wiki");
  const index = await readFile(path.join(wikiDir, "index.md"), "utf8");
  assert.ok(!index.includes("[Domain Overview]"));
  assert.ok(index.includes("The domain documents you will work in and their related source files"));
  assert.ok(!index.includes("- docs/llm-wiki/domains/00_overview.md"));

  const domainFeatures = await readFile(path.join(wikiDir, "DOMAIN_FEATURES.md"), "utf8");
  assert.ok(!domainFeatures.includes("## Domains"));
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
  assert.ok(overview.includes("No domains were auto-detected"));
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
  assert.ok(result.handoff.prompt.includes("Do not promote anything to verified"));
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
  assert.ok(content.includes("AGENTS.md and docs/llm-wiki/index.md"));
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
  assert.ok(log.includes(`## ${today} - LLM-WIKI initial documents created`));
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

test("detects React Native projects as mobile and plans the mobile doc set", async () => {
  const cwd = await makeProject("rn-");
  await writeJson(path.join(cwd, "package.json"), {
    name: "my-app",
    dependencies: { react: "^18.2.0", "react-native": "0.74.0" }
  });

  const result = await initCommand({ cwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });

  assert.equal(result.detection.projectType, "mobile");
  assert.ok(result.planned.some((line) => line.includes("docs/llm-wiki/profiles/mobile.md")));
  assert.ok(result.planned.some((line) => line.includes("docs/llm-wiki/PLATFORM_MATRIX.md")));
});

test("detects Flutter projects as mobile", async () => {
  const cwd = await makeProject("flutter-");
  await writeFile(path.join(cwd, "pubspec.yaml"), "name: my_app\ndependencies:\n  flutter:\n    sdk: flutter\nflutter:\n  uses-material-design: true\n", { encoding: "utf8" });

  const result = await initCommand({ cwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });

  assert.equal(result.detection.projectType, "mobile");
  assert.ok(result.planned.some((line) => line.includes("docs/llm-wiki/SCREENS.md")));
});

test("detects Android Gradle projects as mobile (fixes the JVM library misclassification)", async () => {
  const cwd = await makeProject("android-");
  await writeFile(path.join(cwd, "build.gradle"), "plugins {\n  id 'com.android.application'\n}\nandroid {\n  namespace 'com.example.app'\n}\n", { encoding: "utf8" });

  const result = await initCommand({ cwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });

  assert.equal(result.detection.projectType, "mobile");
});

test("detects iOS projects as mobile from a Podfile", async () => {
  const cwd = await makeProject("ios-");
  await writeFile(path.join(cwd, "Podfile"), "platform :ios, '15.0'\ntarget 'MyApp' do\n  use_frameworks!\nend\n", { encoding: "utf8" });

  const result = await initCommand({ cwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });

  assert.equal(result.detection.projectType, "mobile");
});

test("does not misclassify plain JVM/Dart projects as mobile", async () => {
  const springCwd = await makeProject("jvm-web-");
  await writeFile(path.join(springCwd, "build.gradle"), "plugins {\n  id 'org.springframework.boot' version '3.2.0'\n}\ndependencies {\n  implementation 'org.springframework.boot:spring-boot-starter-web'\n}\n", { encoding: "utf8" });
  const libCwd = await makeProject("jvm-lib-");
  await writeFile(path.join(libCwd, "build.gradle"), "plugins {\n  id 'java-library'\n}\n", { encoding: "utf8" });
  const dartCwd = await makeProject("dart-lib-");
  await writeFile(path.join(dartCwd, "pubspec.yaml"), "name: pure_dart\nenvironment:\n  sdk: '>=3.0.0 <4.0.0'\ndependencies:\n  meta: ^1.9.0\n", { encoding: "utf8" });

  const spring = await initCommand({ cwd: springCwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });
  const lib = await initCommand({ cwd: libCwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });
  const dart = await initCommand({ cwd: dartCwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });

  assert.equal(spring.detection.projectType, "backend");
  assert.equal(lib.detection.projectType, "library");
  assert.notEqual(dart.detection.projectType, "mobile");
});

test("init write on a Flutter project anchors source_files to pubspec.yaml and validates clean", async () => {
  const cwd = await makeProject("flutter-init-");
  await writeFile(path.join(cwd, "pubspec.yaml"), "name: my_app\ndependencies:\n  flutter:\n    sdk: flutter\nflutter:\n  uses-material-design: true\n", { encoding: "utf8" });

  await initCommand({ cwd, dryRun: false, write: true, minimal: true, withAdapters: false, type: null, profiles: [], agents: [], existing: "skip" });
  const index = await readFile(path.join(cwd, "docs", "llm-wiki", "index.md"), { encoding: "utf8" });

  const auditResult = await audit({ cwd, type: null, profiles: [], agents: [], format: "text", strict: false });

  assert.ok(index.includes("- pubspec.yaml"));
  assert.equal(index.includes("- package.json"), false);
  assert.equal(auditResult.findings.some((finding) => finding.rule === "source_files.missing"), false);
});

test("detects infrastructure projects (Terraform / Dockerfile / Helm / Kubernetes) as infra", async () => {
  const tfCwd = await makeProject("infra-tf-");
  await writeFile(path.join(tfCwd, "main.tf"), "terraform {\n  required_version = \">= 1.5\"\n}\nprovider \"aws\" {\n  region = \"us-east-1\"\n}\n", { encoding: "utf8" });
  const dockerCwd = await makeProject("infra-docker-");
  await writeFile(path.join(dockerCwd, "Dockerfile"), "FROM alpine:3.19\nCMD [\"sh\"]\n", { encoding: "utf8" });
  const helmCwd = await makeProject("infra-helm-");
  await writeFile(path.join(helmCwd, "Chart.yaml"), "apiVersion: v2\nname: my-chart\nversion: 0.1.0\n", { encoding: "utf8" });
  const k8sCwd = await makeProject("infra-k8s-");
  await writeFile(path.join(k8sCwd, "deployment.yaml"), "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: web\n", { encoding: "utf8" });

  const tf = await initCommand({ cwd: tfCwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });
  const docker = await initCommand({ cwd: dockerCwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });
  const helm = await initCommand({ cwd: helmCwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });
  const k8s = await initCommand({ cwd: k8sCwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });

  assert.equal(tf.detection.projectType, "infra");
  assert.equal(docker.detection.projectType, "infra");
  assert.equal(helm.detection.projectType, "infra");
  assert.equal(k8s.detection.projectType, "infra");
  assert.ok(tf.planned.some((line) => line.includes("docs/llm-wiki/DEPLOYMENT.md")));
  assert.ok(tf.planned.some((line) => line.includes("docs/llm-wiki/SERVICE_TOPOLOGY.md")));
});

test("does not classify a containerized app repo as infra (infra is a fallback)", async () => {
  const backendCwd = await makeProject("app-docker-");
  await writeJson(path.join(backendCwd, "package.json"), { dependencies: { express: "^4.18.0" } });
  await writeFile(path.join(backendCwd, "Dockerfile"), "FROM node:20\n", { encoding: "utf8" });
  const libCwd = await makeProject("lib-docker-");
  await writeFile(path.join(libCwd, "pyproject.toml"), "[project]\nname = \"widget\"\nversion = \"1.0.0\"\n", { encoding: "utf8" });
  await writeFile(path.join(libCwd, "Dockerfile"), "FROM python:3.12\n", { encoding: "utf8" });

  const backend = await initCommand({ cwd: backendCwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });
  const lib = await initCommand({ cwd: libCwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });

  assert.equal(backend.detection.projectType, "backend");
  assert.equal(lib.detection.projectType, "library");
});

test("init write on a Terraform project anchors source_files to a .tf file and validates clean", async () => {
  const cwd = await makeProject("infra-init-");
  await writeFile(path.join(cwd, "main.tf"), "terraform {\n  required_version = \">= 1.5\"\n}\n", { encoding: "utf8" });

  await initCommand({ cwd, dryRun: false, write: true, minimal: true, withAdapters: false, type: null, profiles: [], agents: [], existing: "skip" });
  const index = await readFile(path.join(cwd, "docs", "llm-wiki", "index.md"), { encoding: "utf8" });
  const auditResult = await audit({ cwd, type: null, profiles: [], agents: [], format: "text", strict: false });

  assert.ok(index.includes("- main.tf"));
  assert.equal(index.includes("- package.json"), false);
  assert.equal(auditResult.findings.some((finding) => finding.rule === "source_files.missing"), false);
});

test("detects Go net/http and Python stdlib HTTP servers as backend", async () => {
  const goCwd = await makeProject("go-stdlib-srv-");
  await writeFile(path.join(goCwd, "go.mod"), "module example.com/srv\n\ngo 1.22\n", { encoding: "utf8" });
  await writeFile(path.join(goCwd, "main.go"), "package main\n\nimport \"net/http\"\n\nfunc main() {\n  http.ListenAndServe(\":8080\", nil)\n}\n", { encoding: "utf8" });
  const pyCwd = await makeProject("py-stdlib-srv-");
  await writeFile(path.join(pyCwd, "pyproject.toml"), "[project]\nname = \"srv\"\nversion = \"0.1.0\"\n", { encoding: "utf8" });
  await writeFile(path.join(pyCwd, "server.py"), "from http.server import HTTPServer, BaseHTTPRequestHandler\n\nHTTPServer((\"\", 8000), BaseHTTPRequestHandler).serve_forever()\n", { encoding: "utf8" });

  const go = await initCommand({ cwd: goCwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });
  const py = await initCommand({ cwd: pyCwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });

  assert.equal(go.detection.projectType, "backend");
  assert.equal(py.detection.projectType, "backend");
});

test("does not upgrade a stdlib-importing client/library to backend without a server-start call", async () => {
  const goCwd = await makeProject("go-http-client-");
  await writeFile(path.join(goCwd, "go.mod"), "module example.com/lib\n\ngo 1.22\n", { encoding: "utf8" });
  await writeFile(path.join(goCwd, "client.go"), "package lib\n\nimport \"net/http\"\n\nfunc Fetch(u string) (*http.Response, error) {\n  return http.Get(u)\n}\n", { encoding: "utf8" });
  const pyCwd = await makeProject("py-http-client-");
  await writeFile(path.join(pyCwd, "pyproject.toml"), "[project]\nname = \"lib\"\nversion = \"0.1.0\"\n", { encoding: "utf8" });
  await writeFile(path.join(pyCwd, "client.py"), "import http.client\n\nconn = http.client.HTTPSConnection(\"example.com\")\n", { encoding: "utf8" });

  const go = await initCommand({ cwd: goCwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });
  const py = await initCommand({ cwd: pyCwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });

  assert.equal(go.detection.projectType, "library");
  assert.equal(py.detection.projectType, "library");
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
  // section_unlisted now fires only when the source PATH is not mentioned at all.
  await writeWikiDocWithEvidence(cwd, "unlisted.md", "Unlisted Evidence", "## Evidence\n\n- (source not itemized here)\n", ["package.json"], ["package.json#L1"]);
  // Locator-format difference (body `path:1` vs frontmatter `path#L1`) is tolerated (P2).
  await writeWikiDocWithEvidence(cwd, "format-ok.md", "Format Tolerant Evidence", "## Evidence\n\n- package.json:1\n", ["package.json"], ["package.json#L1"]);
  await writeWikiDoc(cwd, "empty-section.md", "Empty Evidence Section", "## Evidence\n\n## Review Notes\n\n- Nothing yet.");

  const auditResult = await audit({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false });
  const validateResult = await validateCommand({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false });

  assert.ok(auditResult.findings.some((finding) => finding.rule === "evidence.section_missing" && finding.path.includes("missing-section.md")));
  assert.ok(auditResult.findings.some((finding) => finding.rule === "evidence.section_unlisted" && finding.path.includes("unlisted.md")));
  assert.ok(auditResult.findings.some((finding) => finding.rule === "evidence.section_empty" && finding.path.includes("empty-section.md")));
  // The `path:1` body satisfies the `path#L1` frontmatter entry — no spurious warning.
  assert.ok(!auditResult.findings.some((finding) => finding.rule === "evidence.section_unlisted" && finding.path.includes("format-ok.md")));
  assert.equal(validateResult.findingSummary.byCategory.evidence, 3);
});

test("Gate 25: evidence symbol/section existence checks flag stale locators, not present ones", async () => {
  const cwd = await makeProject("evidence-symbol-");
  await writeJson(path.join(cwd, "package.json"), { name: "evidence-symbol" });
  await mkdir(path.join(cwd, "src"), { recursive: true });
  await writeFile(path.join(cwd, "src", "mod.js"), "export function realOne() {}\nexport function realTwo() {}\n", { encoding: "utf8" });
  const evidence = [
    "src/mod.js#symbol:realOne",                 // present -> no flag
    "src/mod.js#symbol:missingSym",              // absent -> symbol_unverified
    "src/mod.js#symbol:realTwo·alsoMissing",     // list, one present -> no flag (conservative)
    "docs/llm-wiki/index.md#section:Evidence",   // heading present -> no flag
    "docs/llm-wiki/index.md#section:Nope",       // heading absent -> section_unverified
    "src/mod.js#section:Nope"                     // non-.md source -> section check skipped
  ];
  await writeWikiDocWithEvidence(cwd, "index.md", "LLM-WIKI Index", evidenceBody(evidence), ["package.json"], evidence);

  const result = await audit({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false });
  const symbol = result.findings.filter((finding) => finding.rule === "evidence.symbol_unverified");
  const section = result.findings.filter((finding) => finding.rule === "evidence.section_unverified");
  assert.equal(symbol.length, 1);
  assert.ok(symbol[0].message.includes("missingSym"));
  assert.equal(symbol[0].severity, "warning");
  assert.equal(section.length, 1);
  assert.ok(section[0].message.includes("Nope"));
  // present symbol, list-with-one-present, present section, and non-.md section are all NOT flagged
  assert.equal(result.findings.some((finding) => finding.rule === "evidence.symbol_unverified" && finding.message.includes("realOne")), false);
  assert.equal(result.findings.some((finding) => finding.rule === "evidence.symbol_unverified" && finding.message.includes("alsoMissing")), false);

  // --strict escalates the *_unverified rules to errors (same as evidence.missing)
  const strict = await audit({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: true });
  assert.equal(strict.findings.find((finding) => finding.rule === "evidence.symbol_unverified")?.severity, "error");
  assert.equal(strict.findings.find((finding) => finding.rule === "evidence.section_unverified")?.severity, "error");
});

test("Gate 25: evidence.ungrounded flags verified docs with no grounding (warning, not --strict-escalated, config-togglable)", async () => {
  const cwd = await makeProject("evidence-ungrounded-");
  await writeJson(path.join(cwd, "package.json"), { name: "ung" });
  const wikiRoot = path.join(cwd, "docs", "llm-wiki");
  await mkdir(wikiRoot, { recursive: true });
  const doc = (status, sourceFilesLine) => `---
title: Doc
tags:
  - llm-wiki
status: ${status}
doc_type: reference
project: fixture
last_updated: 2026-07-02
author: test
last_edited_by: node-test
wiki_block_version: v1
reviewed_by: Tester
reviewed_at: 2026-07-02
source_files:${sourceFilesLine}
related:
  - docs/llm-wiki/log.md
visibility: internal
contains_sensitive_info: false
---

# Doc

Body prose.
`;
  await writeFile(path.join(wikiRoot, "index.md"), doc("verified", "\n  - package.json"), { encoding: "utf8" });
  await writeFile(path.join(wikiRoot, "ungrounded.md"), doc("verified", " []"), { encoding: "utf8" });
  await writeFile(path.join(wikiRoot, "grounded.md"), doc("verified", "\n  - package.json"), { encoding: "utf8" });
  await writeFile(path.join(wikiRoot, "draft.md"), doc("needs_review", " []"), { encoding: "utf8" });

  const std = await audit({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false });
  const ungrounded = std.findings.filter((finding) => finding.rule === "evidence.ungrounded");
  assert.equal(ungrounded.length, 1);
  assert.ok(ungrounded[0].path.includes("ungrounded.md"));
  assert.equal(ungrounded[0].severity, "warning");

  // --strict does NOT auto-escalate ungrounded (config-only escalation)
  const strict = await audit({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: true });
  assert.equal(strict.findings.find((finding) => finding.rule === "evidence.ungrounded")?.severity, "warning");

  // config rules can turn it off, or escalate it
  const off = await audit({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false, rules: { "evidence.ungrounded": "off" } });
  assert.equal(off.findings.some((finding) => finding.rule === "evidence.ungrounded"), false);
  const escalated = await audit({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false, rules: { "evidence.ungrounded": "error" } });
  assert.equal(escalated.findings.find((finding) => finding.rule === "evidence.ungrounded")?.severity, "error");
});

test("Gate 25: evidenceTier computes reference_checked and human_verified as independent axes", () => {
  assert.deepEqual(evidenceTier({ status: "verified", reviewedBy: true, reviewedAt: true, hasGrounding: true, hasUnresolvedRefs: false }), { referenceChecked: true, humanVerified: true });
  assert.deepEqual(evidenceTier({ status: "verified", reviewedBy: true, reviewedAt: true, hasGrounding: true, hasUnresolvedRefs: true }), { referenceChecked: false, humanVerified: true });
  assert.deepEqual(evidenceTier({ status: "needs_review", reviewedBy: false, reviewedAt: false, hasGrounding: true, hasUnresolvedRefs: false }), { referenceChecked: true, humanVerified: false });
  assert.deepEqual(evidenceTier({ status: "verified", reviewedBy: false, reviewedAt: false, hasGrounding: false, hasUnresolvedRefs: false }), { referenceChecked: false, humanVerified: false });
});

test("Gate 25: stats exposes computed evidence tiers", async () => {
  const cwd = await makeProject("stats-tiers-");
  await writeJson(path.join(cwd, "package.json"), { name: "stats-tiers" });
  await writeWikiDocWithEvidence(cwd, "index.md", "Idx", evidenceBody(["package.json"]), ["package.json"], ["package.json"]);
  const result = await statsCommand({ cwd, type: "unknown", profiles: [], agents: [], format: "text" });
  assert.ok(result.stats.evidenceTiers);
  assert.equal(typeof result.stats.evidenceTiers.referenceChecked, "number");
  assert.equal(typeof result.stats.evidenceTiers.humanVerified, "number");
  assert.equal(typeof result.stats.evidenceTiers.both, "number");
  assert.ok(result.stats.evidenceTiers.referenceChecked >= 1);
});

test("Gate 26: check-run reports no manifest as a warning (nothing to check)", async () => {
  const cwd = await makeProject("checkrun-none-");
  await writeJson(path.join(cwd, "package.json"), { name: "cr" });
  const result = await checkRunCommand({ cwd, format: "text", strict: false });
  assert.equal(result.command, "check-run");
  assert.equal(result.result, "warning");
  assert.ok(result.findings.some((finding) => finding.rule === "run.manifest_missing"));
});

test("Gate 26: check-run verifies a run manifest's pipeline (doc gap / log / validation)", async () => {
  const cwd = await makeProject("checkrun-verify-");
  await writeJson(path.join(cwd, "package.json"), { name: "cr" });
  await mkdir(path.join(cwd, "src"), { recursive: true });
  await writeFile(path.join(cwd, "src", "foo.js"), "export const foo = 1;\n", { encoding: "utf8" });
  await writeFile(path.join(cwd, "src", "bar.js"), "export const bar = 1;\n", { encoding: "utf8" });
  await writeWikiDocWithEvidence(cwd, "domains/00_overview.md", "Overview", evidenceBody(["src/foo.js"]), ["src/foo.js"], ["src/foo.js"]);
  const runsDir = path.join(cwd, ".llm-wiki", "runs");
  await mkdir(runsDir, { recursive: true });

  await writeFile(path.join(runsDir, "run-a.json"), JSON.stringify({
    task: "feature",
    changedSource: ["src/foo.js"],
    touchedDocs: ["docs/llm-wiki/domains/00_overview.md"],
    logAppended: true,
    validated: { ran: true, result: "pass" }
  }), { encoding: "utf8" });
  const clean = await checkRunCommand({ cwd, format: "text", strict: false });
  assert.equal(clean.result, "pass");
  assert.equal(clean.findings.length, 0);

  await writeFile(path.join(runsDir, "run-b.json"), JSON.stringify({
    task: "feature",
    changedSource: ["src/foo.js", "src/bar.js"],
    touchedDocs: ["docs/llm-wiki/domains/00_overview.md"],
    logAppended: false,
    validated: { ran: false }
  }), { encoding: "utf8" });
  const dirty = await checkRunCommand({ cwd, format: "text", strict: false });
  assert.ok(dirty.findings.some((finding) => finding.rule === "run.doc_gap" && finding.message.includes("src/bar.js")));
  assert.equal(dirty.findings.some((finding) => finding.rule === "run.doc_gap" && finding.message.includes("src/foo.js")), false);
  assert.ok(dirty.findings.some((finding) => finding.rule === "run.log_missing"));
  assert.ok(dirty.findings.some((finding) => finding.rule === "run.unvalidated"));
  assert.ok(dirty.findings.every((finding) => finding.severity === "warning"));

  // --run targets a specific manifest even though run-b sorts newest
  const targeted = await checkRunCommand({ cwd, format: "text", strict: false, run: ".llm-wiki/runs/run-a.json" });
  assert.equal(targeted.result, "pass");

  // config rules can escalate run.* to error (CI without --strict)
  const escalated = await checkRunCommand({ cwd, format: "text", strict: false, rules: { "run.doc_gap": "error" } });
  assert.equal(escalated.findings.find((finding) => finding.rule === "run.doc_gap")?.severity, "error");
});

test("Gate 26: check-run flags a malformed manifest as an error", async () => {
  const cwd = await makeProject("checkrun-bad-");
  await writeJson(path.join(cwd, "package.json"), { name: "cr" });
  const runsDir = path.join(cwd, ".llm-wiki", "runs");
  await mkdir(runsDir, { recursive: true });
  await writeFile(path.join(runsDir, "run.json"), "{ not valid json", { encoding: "utf8" });
  const result = await checkRunCommand({ cwd, format: "text", strict: false });
  assert.equal(result.result, "fail");
  assert.ok(result.findings.some((finding) => finding.rule === "run.manifest_invalid" && finding.severity === "error"));
});

test("finding registry: every rule has a well-formed explanation (guards new rules)", () => {
  const severities = new Set(["blocked", "error", "warning", "info"]);
  for (const [rule, explanation] of Object.entries(FINDING_EXPLANATIONS)) {
    const category = rule.split(".")[0];
    assert.equal(explanation.category, category, `${rule}: category matches key prefix`);
    assert.ok(severities.has(explanation.defaultSeverity), `${rule}: valid default severity`);
    assert.ok(typeof explanation.meaning === "string" && explanation.meaning.trim(), `${rule}: non-empty meaning`);
    assert.ok(typeof explanation.whyItMatters === "string" && explanation.whyItMatters.trim(), `${rule}: non-empty whyItMatters`);
    assert.ok(Array.isArray(explanation.remediation) && explanation.remediation.length > 0, `${rule}: non-empty remediation`);
    assert.ok(Array.isArray(explanation.commands), `${rule}: commands array`);
    assert.ok(Array.isArray(explanation.relatedRules), `${rule}: relatedRules array`);
  }
  for (const rule of [
    "evidence.symbol_unverified", "evidence.section_unverified", "evidence.ungrounded",
    "run.doc_gap", "run.log_missing", "run.unvalidated", "run.manifest_missing", "run.manifest_invalid",
    "review.reviewer_unresolved", "review.confirmation_required"
  ]) {
    assert.ok(FINDING_EXPLANATIONS[rule], `${rule} is registered`);
  }
});

test("Gate 20: review list mode risk-ranks needs_review docs and is read-only", async () => {
  const cwd = await makeProject("review-list-");
  await writeJson(path.join(cwd, "package.json"), { name: "rev" });
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "Entry point.");
  // log.md exists so the default `related: docs/llm-wiki/log.md` resolves for the clean doc.
  await writeWikiDoc(cwd, "log.md", "Change Log", "Change log.");
  await writeWikiDocWithSourceFiles(cwd, "clean.md", "Clean Doc", "Fully written, source-backed content.", ["package.json"]);
  // A broken related link produces a related.missing warning, raising this doc's risk.
  await writeWikiDocWithRelated(cwd, "risky.md", "Risky Doc", "Body.", ["docs/llm-wiki/does-not-exist.md"]);

  const before = await readFile(path.join(cwd, "docs", "llm-wiki", "clean.md"), { encoding: "utf8" });
  const options = api.normalizeOptions({ cwd, format: "text" });
  const result = await reviewCommand(options);

  assert.equal(result.command, "review");
  assert.equal(result.mode, "list");
  assert.equal(result.result, "pass");
  assert.ok(result.needsReview >= 3, "lists every needs_review content doc");
  const byPath = new Map(result.documents.map((doc) => [doc.path, doc]));
  const risky = byPath.get("docs/llm-wiki/risky.md");
  const clean = byPath.get("docs/llm-wiki/clean.md");
  assert.ok(risky && clean, "both docs are in the review list");
  assert.ok(risky.riskScore > clean.riskScore, "a doc with a broken-link finding outranks a clean, source-backed doc");
  const paths = result.documents.map((doc) => doc.path);
  assert.ok(paths.indexOf("docs/llm-wiki/risky.md") < paths.indexOf("docs/llm-wiki/clean.md"), "higher risk sorts first");
  assert.ok(result.documents.every((doc) => typeof doc.approvable === "boolean" && typeof doc.riskScore === "number"));
  // Read-only: list mode writes nothing.
  const after = await readFile(path.join(cwd, "docs", "llm-wiki", "clean.md"), { encoding: "utf8" });
  assert.equal(after, before, "review list mode never writes");
});

test("Gate 20: review --approve stamps verified + review metadata, preserving last_updated and body", async () => {
  const cwd = await makeProject("review-approve-");
  await writeJson(path.join(cwd, "package.json"), { name: "rev" });
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "Entry point.");
  await writeWikiDocWithSourceFiles(cwd, "approve-me.md", "Approve Me", "Real, source-backed content ready for sign-off.", ["package.json"]);

  const options = api.normalizeOptions({ cwd, approve: ["docs/llm-wiki/approve-me.md"], reviewer: "Test Reviewer" });
  const result = await reviewCommand(options);

  assert.equal(result.mode, "approve");
  assert.equal(result.result, "pass");
  assert.deepEqual(result.approved, ["docs/llm-wiki/approve-me.md"]);
  assert.equal(result.reviewer, "Test Reviewer");

  const after = await readFile(path.join(cwd, "docs", "llm-wiki", "approve-me.md"), { encoding: "utf8" });
  assert.match(after, /status: verified/, "status promoted to verified");
  assert.match(after, /reviewed_by: Test Reviewer/, "reviewed_by stamped from --reviewer");
  assert.match(after, /reviewed_at: \d{4}-\d{2}-\d{2}/, "reviewed_at stamped with today");
  assert.match(after, /last_updated: 2026-07-02/, "last_updated (content date) is preserved, not bumped");
  assert.ok(after.includes("Real, source-backed content ready for sign-off."), "body content is untouched");
});

test("Gate 20: review --approve refuses a doc with blocking findings and never auto-verifies", async () => {
  const cwd = await makeProject("review-blocked-");
  await writeJson(path.join(cwd, "package.json"), { name: "rev" });
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "Entry point.");
  // A missing required frontmatter field (project) yields a frontmatter.required error.
  await writeWikiDocAt(cwd, "blocked.md", "Blocked Doc", "Body.", (base) => base.replace(/project: fixture\n/, ""));

  const options = api.normalizeOptions({ cwd, approve: ["docs/llm-wiki/blocked.md"], reviewer: "R" });
  const result = await reviewCommand(options);

  assert.deepEqual(result.approved, []);
  assert.ok(result.refused.some((entry) => entry.path === "docs/llm-wiki/blocked.md" && /blocking findings/.test(entry.reason)));
  const after = await readFile(path.join(cwd, "docs", "llm-wiki", "blocked.md"), { encoding: "utf8" });
  assert.match(after, /status: needs_review/, "a doc with blocking findings is never promoted");
});

test("Gate 20: review --approve-all requires an explicit --yes confirmation", async () => {
  const cwd = await makeProject("review-all-");
  await writeJson(path.join(cwd, "package.json"), { name: "rev" });
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "Entry point.");
  await writeWikiDocWithSourceFiles(cwd, "a.md", "Doc A", "Content A.", ["package.json"]);
  await writeWikiDocWithSourceFiles(cwd, "b.md", "Doc B", "Content B.", ["package.json"]);

  // Without --yes: refuses and writes nothing.
  const noYes = await reviewCommand(api.normalizeOptions({ cwd, approveAll: true, reviewer: "R" }));
  assert.equal(noYes.result, "fail");
  assert.ok(noYes.findings.some((finding) => finding.rule === "review.confirmation_required"));
  assert.deepEqual(noYes.approved, []);
  assert.match(await readFile(path.join(cwd, "docs", "llm-wiki", "a.md"), { encoding: "utf8" }), /status: needs_review/);

  // With --yes: promotes every approvable needs_review doc.
  const yes = await reviewCommand(api.normalizeOptions({ cwd, approveAll: true, yes: true, reviewer: "R" }));
  assert.equal(yes.result, "pass");
  assert.ok(yes.approved.includes("docs/llm-wiki/a.md") && yes.approved.includes("docs/llm-wiki/b.md"));
  assert.match(await readFile(path.join(cwd, "docs", "llm-wiki", "a.md"), { encoding: "utf8" }), /status: verified/);
});

test("Gate 20: review --approve refuses an already-verified doc (idempotent)", async () => {
  const cwd = await makeProject("review-idem-");
  await writeJson(path.join(cwd, "package.json"), { name: "rev" });
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "Entry point.");
  await writeWikiDocWithSourceFiles(cwd, "doc.md", "Doc", "Content.", ["package.json"]);
  await reviewCommand(api.normalizeOptions({ cwd, approve: ["docs/llm-wiki/doc.md"], reviewer: "R" }));
  const second = await reviewCommand(api.normalizeOptions({ cwd, approve: ["docs/llm-wiki/doc.md"], reviewer: "R" }));
  assert.deepEqual(second.approved, []);
  assert.ok(second.refused.some((entry) => entry.path === "docs/llm-wiki/doc.md" && /already verified/.test(entry.reason)));
});

test("Gate 20: parseArgs wires review flags and rejects --approve + --approve-all together", () => {
  const approve = parseArgs(["review", "--approve", "docs/llm-wiki/a.md", "--approve", "b.md", "--reviewer", "Me"]);
  assert.equal(approve.command, "review");
  assert.deepEqual(approve.options.approve, ["docs/llm-wiki/a.md", "b.md"]);
  assert.equal(approve.options.reviewer, "Me");
  assert.equal(approve.errors.length, 0);

  const comma = parseArgs(["review", "--approve", "a.md,b.md"]);
  assert.deepEqual(comma.options.approve, ["a.md", "b.md"], "a comma-separated --approve value expands to multiple targets");

  const all = parseArgs(["review", "--approve-all", "--yes"]);
  assert.equal(all.options.approveAll, true);
  assert.equal(all.options.yes, true);
  assert.equal(all.errors.length, 0);

  const conflict = parseArgs(["review", "--approve", "a.md", "--approve-all"]);
  assert.ok(conflict.errors.some((error) => /cannot be used together/.test(error)));
});

test("Gate 26: check-run skips external changedSource and strips locators when matching", async () => {
  const cwd = await makeProject("checkrun-edge-");
  await writeJson(path.join(cwd, "package.json"), { name: "cr" });
  await mkdir(path.join(cwd, "src"), { recursive: true });
  await writeFile(path.join(cwd, "src", "foo.js"), "export const foo = 1;\n", { encoding: "utf8" });
  await writeWikiDocWithEvidence(cwd, "domains/00_overview.md", "Overview", evidenceBody(["src/foo.js"]), ["src/foo.js"], ["src/foo.js"]);
  const runsDir = path.join(cwd, ".llm-wiki", "runs");
  await mkdir(runsDir, { recursive: true });
  await writeFile(path.join(runsDir, "run.json"), JSON.stringify({
    task: "feature",
    changedSource: ["src/foo.js#symbol:foo", "https://example.com/x"],
    touchedDocs: ["docs/llm-wiki/domains/00_overview.md"],
    logAppended: true,
    validated: true
  }), { encoding: "utf8" });
  const result = await checkRunCommand({ cwd, format: "text", strict: false });
  // foo.js covered after stripping the #symbol locator; the external ref is skipped → no gap
  assert.equal(result.findings.some((finding) => finding.rule === "run.doc_gap"), false);
  assert.equal(result.result, "pass");
});

test("Gate 25: evidence.ungrounded is not flagged when evidence alone grounds a verified doc", async () => {
  const cwd = await makeProject("ungrounded-ev-");
  await writeJson(path.join(cwd, "package.json"), { name: "u" });
  const wikiRoot = path.join(cwd, "docs", "llm-wiki");
  await mkdir(wikiRoot, { recursive: true });
  await writeFile(path.join(wikiRoot, "index.md"), `---
title: Doc
tags:
  - llm-wiki
status: verified
doc_type: reference
project: fixture
last_updated: 2026-07-02
author: test
last_edited_by: node-test
wiki_block_version: v1
reviewed_by: Tester
reviewed_at: 2026-07-02
source_files: []
evidence:
  - package.json
related:
  - docs/llm-wiki/log.md
visibility: internal
contains_sensitive_info: false
---

# Doc

## Evidence

- package.json
`, { encoding: "utf8" });
  const result = await audit({ cwd, type: "unknown", profiles: [], agents: [], format: "text", strict: false });
  assert.equal(result.findings.some((finding) => finding.rule === "evidence.ungrounded"), false);
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

// ---- impact command (Gate 23 reverse-impact) ---------------------------
const IMPACT_BASE = { type: "unknown", profiles: [], agents: [], strict: false, format: "text" };
const onImpact = (rel) => (finding) => finding.rule === "impact.source_changed" && finding.path === rel;

async function makeImpactRepo(prefix) {
  const cwd = await makeProject(prefix);
  const git = gitAtDate(cwd, "2026-07-10T10:00:00");
  await writeFile(path.join(cwd, "package.json"), `${JSON.stringify({ name: "impact" }, null, 2)}\n`, { encoding: "utf8" });
  await writeFile(path.join(cwd, "a.ts"), "one\n", { encoding: "utf8" });
  await writeFile(path.join(cwd, "b.ts"), "one\n", { encoding: "utf8" });
  await writeVerifiedSourceDoc(cwd, "api.md", "a.ts", "2026-07-11");
  await writeVerifiedSourceDoc(cwd, "other.md", "b.ts", "2026-07-11");
  git(["init"]);
  git(["add", "-A"]);
  git(["-c", "commit.gpgsign=false", "commit", "-m", "init"]);
  return { cwd, git };
}

test("impact flags a verified doc whose source changed in the working tree, not one whose source is unchanged", async (t) => {
  let hasGit = true;
  try { execFileSync("git", ["--version"], { stdio: "ignore" }); } catch { hasGit = false; }
  if (!hasGit) { t.skip("git not available"); return; }

  const { cwd } = await makeImpactRepo("impact-wt-");
  await writeFile(path.join(cwd, "a.ts"), "one\ntwo\n", { encoding: "utf8" }); // uncommitted change

  const result = await impactCommand({ ...IMPACT_BASE, cwd });
  assert.equal(result.command, "impact");
  assert.equal(result.result, "warning");
  assert.ok(result.findings.some(onImpact("docs/llm-wiki/api.md")), "api.md flagged (a.ts changed)");
  assert.equal(result.findings.some(onImpact("docs/llm-wiki/other.md")), false, "other.md not flagged (b.ts unchanged)");
});

test("impact does not flag a verified doc that changed in the same diff", async (t) => {
  let hasGit = true;
  try { execFileSync("git", ["--version"], { stdio: "ignore" }); } catch { hasGit = false; }
  if (!hasGit) { t.skip("git not available"); return; }

  const { cwd } = await makeImpactRepo("impact-samediff-");
  await writeFile(path.join(cwd, "a.ts"), "one\ntwo\n", { encoding: "utf8" });
  await writeFile(path.join(cwd, "docs", "llm-wiki", "api.md"), "\nedited in the same diff\n", { encoding: "utf8", flag: "a" });

  const result = await impactCommand({ ...IMPACT_BASE, cwd });
  assert.equal(result.findings.some(onImpact("docs/llm-wiki/api.md")), false, "api.md not flagged: it changed in the same diff");
});

test("impact --since <ref> uses a PR/CI baseline", async (t) => {
  let hasGit = true;
  try { execFileSync("git", ["--version"], { stdio: "ignore" }); } catch { hasGit = false; }
  if (!hasGit) { t.skip("git not available"); return; }

  const { cwd, git } = await makeImpactRepo("impact-since-");
  await writeFile(path.join(cwd, "a.ts"), "one\ntwo\n", { encoding: "utf8" });
  git(["add", "a.ts"]);
  git(["-c", "commit.gpgsign=false", "commit", "-m", "edit a"]);

  const result = await impactCommand({ ...IMPACT_BASE, cwd, since: "HEAD~1" });
  assert.ok(result.changedFiles >= 1, "diff since HEAD~1 has at least one changed file");
  assert.ok(result.findings.some(onImpact("docs/llm-wiki/api.md")), "api.md flagged for a.ts changed since HEAD~1");
});

test("impact is a no-op pass on a clean tree", async (t) => {
  let hasGit = true;
  try { execFileSync("git", ["--version"], { stdio: "ignore" }); } catch { hasGit = false; }
  if (!hasGit) { t.skip("git not available"); return; }

  const { cwd } = await makeImpactRepo("impact-clean-");
  const result = await impactCommand({ ...IMPACT_BASE, cwd });
  assert.equal(result.result, "pass");
  assert.equal(result.findings.length, 0);
  assert.equal(result.changedFiles, 0);
});

test("impact.source_changed can be escalated to error via config rules", async (t) => {
  let hasGit = true;
  try { execFileSync("git", ["--version"], { stdio: "ignore" }); } catch { hasGit = false; }
  if (!hasGit) { t.skip("git not available"); return; }

  const { cwd } = await makeImpactRepo("impact-strict-");
  await writeFile(path.join(cwd, "a.ts"), "one\ntwo\n", { encoding: "utf8" });

  const result = await impactCommand({ ...IMPACT_BASE, cwd, rules: { "impact.source_changed": "error" } });
  assert.equal(result.result, "fail");
  assert.ok(result.findings.some((finding) => finding.rule === "impact.source_changed" && finding.severity === "error"));
});

test("impact reports impact.unavailable when not in a git repository", async () => {
  const cwd = await makeProject("impact-nogit-");
  await writeFile(path.join(cwd, "package.json"), `${JSON.stringify({ name: "impact" }, null, 2)}\n`, { encoding: "utf8" });
  await writeVerifiedSourceDoc(cwd, "api.md", "a.ts", "2026-07-11");

  const result = await impactCommand({ ...IMPACT_BASE, cwd });
  assert.equal(result.result, "fail");
  assert.ok(result.findings.some((finding) => finding.rule === "impact.unavailable" && finding.severity === "error"));
});

test("parseArgs accepts impact options and rejects unsupported ones", () => {
  const ok = parseArgs(["impact", "--since", "main", "--strict"]);
  assert.equal(ok.command, "impact");
  assert.equal(ok.errors.length, 0);
  assert.equal(ok.options.since, "main");
  assert.equal(ok.options.strict, true);
  const bad = parseArgs(["impact", "--downgrade"]);
  assert.ok(bad.errors.some((error) => error.includes("--downgrade")));
});

// ---- retrieval commands (Gate 24 read-only search/get) -----------------
const RETR_BASE = { status: null, visibility: null, docType: null, includeSensitive: false, query: null, docPath: null, limit: null, format: "text" };

async function makeRetrievalWiki(prefix) {
  const cwd = await makeProject(prefix);
  await writeFile(path.join(cwd, "package.json"), `${JSON.stringify({ name: "retr" }, null, 2)}\n`, { encoding: "utf8" });
  await writeVerifiedSourceDoc(cwd, "index.md", "package.json", "2026-07-11");
  await writeWikiDocWithRelated(cwd, "guide.md", "Guide", "The widget subsystem overview.", ["docs/llm-wiki/index.md"]);
  await writeWikiDoc(cwd, "notes.md", "Notes", "Some notes about gadgets.");
  await writeWikiDocAt(cwd, "secret.md", "Secret", "api_key = supersecretvalue12345\nwidget details here.", (base) =>
    base.replace("visibility: internal", "visibility: restricted").replace("contains_sensitive_info: false", "contains_sensitive_info: true"));
  return cwd;
}

test("retrieval: list-docs returns metadata and excludes restricted/sensitive docs unless included", async () => {
  const cwd = await makeRetrievalWiki("retr-list-");
  const base = await listDocsCommand({ ...RETR_BASE, cwd });
  assert.equal(base.command, "list-docs");
  assert.equal(base.result, "pass");
  const paths = base.documents.map((doc) => doc.path);
  assert.ok(paths.includes("docs/llm-wiki/guide.md"));
  assert.equal(paths.includes("docs/llm-wiki/secret.md"), false, "restricted+sensitive doc excluded by default");
  assert.ok(base.excludedSensitive >= 1);
  const guide = base.documents.find((doc) => doc.path === "docs/llm-wiki/guide.md");
  assert.equal(guide.title, "Guide");
  assert.equal(guide.body, undefined, "list returns metadata only, no bodies");

  const withSensitive = await listDocsCommand({ ...RETR_BASE, cwd, includeSensitive: true });
  assert.ok(withSensitive.documents.map((doc) => doc.path).includes("docs/llm-wiki/secret.md"));
  assert.equal(withSensitive.excludedSensitive, 0);
});

test("retrieval: list-docs filters by status", async () => {
  const cwd = await makeRetrievalWiki("retr-filter-");
  const verified = await listDocsCommand({ ...RETR_BASE, cwd, status: "verified" });
  assert.ok(verified.documents.length >= 1);
  assert.ok(verified.documents.every((doc) => doc.status === "verified"));
  assert.ok(verified.documents.map((doc) => doc.path).includes("docs/llm-wiki/index.md"));
});

test("retrieval: search-docs ranks keyword matches, excludes sensitive, and redacts snippets", async () => {
  const cwd = await makeRetrievalWiki("retr-search-");
  const res = await searchDocsCommand({ ...RETR_BASE, cwd, query: "widget" });
  assert.equal(res.command, "search-docs");
  const paths = res.matches.map((match) => match.path);
  assert.ok(paths.includes("docs/llm-wiki/guide.md"), "guide (contains widget) matched");
  assert.equal(paths.includes("docs/llm-wiki/secret.md"), false, "sensitive doc excluded from search by default");
  assert.ok(res.matches.every((match) => match.score > 0));
  // Ranking is deterministic: sorted by score desc then path asc.
  for (let i = 1; i < res.matches.length; i += 1) {
    const prev = res.matches[i - 1];
    const cur = res.matches[i];
    assert.ok(prev.score > cur.score || (prev.score === cur.score && prev.path <= cur.path));
  }

  const incl = await searchDocsCommand({ ...RETR_BASE, cwd, query: "widget", includeSensitive: true });
  const secret = incl.matches.find((match) => match.path === "docs/llm-wiki/secret.md");
  assert.ok(secret, "secret matched when included");
  assert.equal(secret.snippet.includes("supersecretvalue"), false, "snippet redacts the sensitive token");

  // AND semantics: a term absent from every doc yields no match.
  const none = await searchDocsCommand({ ...RETR_BASE, cwd, query: "widget nonexistentterm" });
  assert.equal(none.matchCount, 0);
});

test("retrieval: search-docs deprioritizes the change log below reference docs (log.md scorer fix)", async () => {
  const cwd = await makeProject("retr-logrank-");
  await writeFile(path.join(cwd, "package.json"), `${JSON.stringify({ name: "retr" }, null, 2)}\n`, { encoding: "utf8" });
  await writeVerifiedSourceDoc(cwd, "index.md", "package.json", "2026-07-11");
  // Reference doc: the term appears ONCE (low raw score).
  await writeWikiDoc(cwd, "guide.md", "Guide", "The subsystem uses a widget.");
  // Change log at docs/llm-wiki/log.md: the term accumulates MANY times (high raw score).
  await writeWikiDoc(cwd, "log.md", "Change Log", "widget widget widget widget widget widget widget widget widget widget");
  const res = await searchDocsCommand({ ...RETR_BASE, cwd, query: "widget" });
  const paths = res.matches.map((m) => m.path);
  assert.ok(paths.includes("docs/llm-wiki/log.md"), "change log still returned (demoted, not excluded)");
  assert.ok(paths.includes("docs/llm-wiki/guide.md"), "reference doc returned");
  const guide = res.matches.find((m) => m.path === "docs/llm-wiki/guide.md");
  const log = res.matches.find((m) => m.path === "docs/llm-wiki/log.md");
  assert.ok(log.score > guide.score, "change log has the higher raw occurrence score");
  assert.ok(paths.indexOf("docs/llm-wiki/guide.md") < paths.indexOf("docs/llm-wiki/log.md"),
    "reference doc ranks above the change log despite the log's higher raw score (deprioritized)");
  assert.equal("deprioritized" in log, false, "internal sort key is stripped from the output contract");
});

test("retrieval: get-doc returns content, redacts sensitive lines, and reports not_found", async () => {
  const cwd = await makeRetrievalWiki("retr-getdoc-");
  const doc = await getDocCommand({ ...RETR_BASE, cwd, docPath: "guide.md" });
  assert.equal(doc.result, "pass");
  assert.equal(doc.document.path, "docs/llm-wiki/guide.md");
  assert.ok(doc.document.body.includes("widget"));
  assert.equal(doc.document.redacted, false);

  // get-doc returns even restricted docs, but redacts raw sensitive values.
  const secret = await getDocCommand({ ...RETR_BASE, cwd, docPath: "secret.md" });
  assert.equal(secret.result, "pass");
  assert.equal(secret.document.redacted, true);
  assert.equal(secret.document.body.includes("supersecretvalue"), false, "raw sensitive value redacted");

  // Bare name resolves too.
  const byName = await getDocCommand({ ...RETR_BASE, cwd, docPath: "guide" });
  assert.equal(byName.result, "pass");

  const missing = await getDocCommand({ ...RETR_BASE, cwd, docPath: "nope.md" });
  assert.equal(missing.result, "fail");
  assert.ok(missing.findings.some((finding) => finding.rule === "retrieval.not_found"));
});

test("retrieval: get-doc --section returns only matching sections (focused read), falls back to full body", async () => {
  const cwd = await makeProject("retr-section-");
  await writeFile(path.join(cwd, "package.json"), `${JSON.stringify({ name: "retr" }, null, 2)}\n`, { encoding: "utf8" });
  await writeVerifiedSourceDoc(cwd, "index.md", "package.json", "2026-07-11");
  await writeWikiDoc(cwd, "big.md", "Big Doc",
    "## Alpha\nApples and oranges, padding for length.\n\n## Beta\nThe widget subsystem lives here and handles widget config.\n\n## Gamma\nGophers and gadgets, entirely unrelated.");

  // Default (no --section): full body, and no additive `section` field.
  const full = await getDocCommand({ ...RETR_BASE, cwd, docPath: "big.md" });
  assert.ok(full.document.body.includes("Apples") && full.document.body.includes("Gophers"), "full body has all sections");
  assert.equal("section" in full.document, false, "default get-doc output has no section field");

  // Focused read: only the matching section(s) + preamble.
  const focused = await getDocCommand({ ...RETR_BASE, cwd, docPath: "big.md", section: "widget" });
  assert.ok(focused.document.body.includes("widget"), "matching section returned");
  assert.equal(focused.document.body.includes("Gophers"), false, "unrelated Gamma section omitted");
  assert.equal(focused.document.body.includes("Apples"), false, "unrelated Alpha section omitted");
  assert.ok(focused.document.section && focused.document.section.returned >= 1 && focused.document.section.total >= 3,
    "section metadata reflects a focused subset");
  assert.ok(focused.document.body.length < full.document.body.length, "focused read is smaller than the full body");

  // Fallback: a term present in no section returns the full body (no section metadata).
  const miss = await getDocCommand({ ...RETR_BASE, cwd, docPath: "big.md", section: "zzznotpresent" });
  assert.ok(miss.document.body.includes("Gophers"), "no section match falls back to full body");
  assert.equal("section" in miss.document, false, "fallback output has no section field");
});

// ---- Token-efficiency: task-path selection (A) + retrieval token controls (C) ----

test("task-path selector picks the cheapest SAFE path (source_direct/wiki_first/hybrid)", () => {
  // source_direct: small, well-located edit/question with few candidates.
  const typo = selectTaskPath({ task: "fix a typo in the log message", candidateCount: 1, docStatuses: ["verified"] });
  assert.equal(typo.path, "source_direct");
  assert.equal(typo.mustReadSource, true, "a code change always reads source, even at verified");
  const route = selectTaskPath({ task: "add a route for hazards", candidateCount: 2, docStatuses: ["verified"] });
  assert.equal(route.path, "source_direct", "few candidates → straight to source (routing-style)");

  // wiki_first: understanding intent, or many candidates spanning layers.
  assert.equal(selectTaskPath({ task: "help me understand the auth architecture", candidateCount: 3 }).path, "wiki_first");
  assert.equal(selectTaskPath({ task: "add a big reporting feature", candidateCount: 6, docStatuses: ["verified"] }).path, "wiki_first");

  // hybrid: an ordinary feature with a moderate spread.
  assert.equal(selectTaskPath({ task: "add pagination to the orders list", candidateCount: 3, docStatuses: ["verified", "verified", "verified"] }).path, "hybrid");
});

test("task-path forces source reading on risk-sensitive work and never source_direct", () => {
  for (const task of ["change password hashing", "delete a user's personal data", "add a payment refund flow", "bump the public API version (breaking change)"]) {
    const r = selectTaskPath({ task, candidateCount: 1, docStatuses: ["verified"] });
    assert.ok(r.risk.length > 0, `risk flagged for: ${task}`);
    assert.notEqual(r.path, "source_direct", `risky task never source_direct: ${task}`);
    assert.equal(r.mustReadSource, true, `risky task must read source: ${task}`);
  }
  // A needs_review candidate forces source reading even for a read-only question.
  const stale = selectTaskPath({ task: "what does the retry helper do", candidateCount: 1, docStatuses: ["needs_review"], isCodeChange: false });
  assert.equal(stale.mustReadSource, true, "needs_review candidate → confirm against source");
  // classifyTaskRisk is bilingual and never uses filenames/symbols (inputs are task text only).
  assert.ok(classifyTaskRisk("인증 토큰 세션을 변경").includes("auth"), "KO risk keywords match");
});

test("retrieval: estimateTokens is a chars/4 proxy and clampText is an exact cap", () => {
  assert.equal(estimateTokens("abcdefgh"), 2);
  assert.equal(estimateTokens(""), 0);
  assert.equal(clampText("hello", 10).truncated, false);
  assert.equal(clampText("hello", 5).truncated, false, "length == maxChars is not truncated");
  const over = clampText("hello world", 5);
  assert.equal(over.truncated, true);
  assert.equal(over.text.length, 5, "never exceeds maxChars");
  assert.equal(over.chars, 5);
});

test("retrieval: selectSections strict mode withholds the full body; heading match ranks first", () => {
  const body = "## Alpha\nApples.\n\n## Beta\nThe widget subsystem.\n\n## Gamma\nGophers.";
  // Non-strict fallback keeps the full body (backward compatible).
  const lenient = selectSections(body, "zzznotpresent", 3);
  assert.equal(lenient.body.includes("Gophers"), true, "non-strict falls back to full body");
  assert.equal(lenient.noSectionMatch, false);
  // Strict: no match → empty body + noSectionMatch (the token guard).
  const strict = selectSections(body, "zzznotpresent", 3, { strict: true });
  assert.equal(strict.body, "", "strict withholds the full body");
  assert.equal(strict.noSectionMatch, true);
  assert.equal(strict.sectioned, false);
  // Heading match outranks a higher body-only frequency.
  const b2 = "## widget config\nsettings live here\n\n## other\nwidget widget widget mentioned thrice";
  assert.ok(selectSections(b2, "widget", 1).body.startsWith("## widget config"), "heading match wins over body frequency");
});

test("retrieval: get-doc token controls are opt-in and never leak secrets (default output unchanged)", async () => {
  const cwd = await makeProject("retr-tokens-");
  await writeFile(path.join(cwd, "package.json"), `${JSON.stringify({ name: "retr" }, null, 2)}\n`, { encoding: "utf8" });
  await writeVerifiedSourceDoc(cwd, "index.md", "package.json", "2026-07-11");
  await writeWikiDoc(cwd, "big.md", "Big Doc",
    "Preamble line.\n\n## Alpha\nApples and oranges.\n\n## Beta\nThe widget subsystem lives here.\n\n## Gamma\nGophers unrelated.");

  // Default: no diagnostic fields; full frontmatter present (byte-identical shape).
  const def = await getDocCommand({ ...RETR_BASE, cwd, docPath: "big.md" });
  assert.equal("chars" in def.document, false, "no diagnostic chars by default");
  assert.equal("estimatedTokens" in def.document, false);
  assert.ok("frontmatter" in def.document, "frontmatter present by default");

  // --strict-section: nothing matches → no full body, section.noSectionMatch true.
  const strict = await getDocCommand({ ...RETR_BASE, cwd, docPath: "big.md", section: "zzznotpresent", strictSection: true });
  assert.equal(strict.document.body.includes("Gophers"), false, "strict-section withholds full body");
  assert.equal(strict.document.section.noSectionMatch, true);
  assert.ok("estimatedTokens" in strict.document, "diagnostic present under a new option");

  // --max-chars: exact cap + truncated flag.
  const capped = await getDocCommand({ ...RETR_BASE, cwd, docPath: "big.md", maxChars: 20 });
  assert.ok(capped.document.body.length <= 20, "body clamped to max-chars");
  assert.equal(capped.document.truncated, true);
  assert.equal(capped.document.chars, capped.document.body.length);

  // --compact: frontmatter omitted, diagnostics present.
  const compact = await getDocCommand({ ...RETR_BASE, cwd, docPath: "big.md", compact: true });
  assert.equal("frontmatter" in compact.document, false, "compact omits the frontmatter echo");
  assert.ok("estimatedTokens" in compact.document);

  // Redaction still applies under the new paths.
  const secretCwd = await makeRetrievalWiki("retr-tokens-secret-");
  const sec = await getDocCommand({ ...RETR_BASE, cwd: secretCwd, docPath: "secret.md", compact: true, maxChars: 500 });
  assert.equal(sec.document.body.includes("supersecretvalue12345"), false, "secret redacted even under compact/max-chars");
});

test("parseArgs accepts get-doc/prepare token controls and rejects them elsewhere", () => {
  const g = parseArgs(["get-doc", "GLOSSARY.md", "--strict-section", "--compact", "--max-chars", "500"]);
  assert.deepEqual(g.errors, []);
  assert.equal(g.options.strictSection, true);
  assert.equal(g.options.compact, true);
  assert.equal(g.options.maxChars, 500);
  const p = parseArgs(["prepare", "--task", "x", "--compact", "--max-chars", "300"]);
  assert.deepEqual(p.errors, []);
  assert.equal(p.options.compact, true);
  assert.equal(p.options.maxChars, 300);
  // --max-chars must be a positive integer.
  assert.ok(parseArgs(["get-doc", "x.md", "--max-chars", "0"]).errors.some((e) => e.includes("--max-chars")));
  // These are NOT global options — rejected on an unrelated command.
  assert.ok(parseArgs(["validate", "--compact"]).errors.some((e) => e.includes("--compact")));
  assert.ok(parseArgs(["search-docs", "q", "--strict-section"]).errors.some((e) => e.includes("--strict-section")));
});

test("retrieval: get-related returns resolved graph neighbors and reports not_found", async () => {
  const cwd = await makeRetrievalWiki("retr-related-");
  const rel = await getRelatedCommand({ ...RETR_BASE, cwd, docPath: "index.md" });
  assert.equal(rel.result, "pass");
  assert.equal(rel.document, "docs/llm-wiki/index.md");
  assert.ok(rel.related.inbound.some((node) => node.path === "docs/llm-wiki/guide.md"), "guide links to index (inbound)");

  const guide = await getRelatedCommand({ ...RETR_BASE, cwd, docPath: "guide.md" });
  assert.ok(guide.related.outbound.some((node) => node.path === "docs/llm-wiki/index.md"), "guide -> index (outbound)");

  const missing = await getRelatedCommand({ ...RETR_BASE, cwd, docPath: "nope.md" });
  assert.equal(missing.result, "fail");
  assert.ok(missing.findings.some((finding) => finding.rule === "retrieval.not_found"));
});

test("parseArgs supports retrieval commands: positionals, filters, and required args", () => {
  const list = parseArgs(["list-docs", "--status", "verified", "--include-sensitive"]);
  assert.equal(list.command, "list-docs");
  assert.deepEqual(list.errors, []);
  assert.equal(list.options.status, "verified");
  assert.equal(list.options.includeSensitive, true);

  const search = parseArgs(["search-docs", "hello world", "--limit", "5"]);
  assert.equal(search.command, "search-docs");
  assert.deepEqual(search.errors, []);
  assert.equal(search.options.query, "hello world");
  assert.equal(search.options.limit, 5);

  const getDoc = parseArgs(["get-doc", "GLOSSARY.md"]);
  assert.deepEqual(getDoc.errors, []);
  assert.equal(getDoc.options.docPath, "GLOSSARY.md");

  assert.ok(parseArgs(["search-docs"]).errors.some((error) => error.includes("<query>")));
  assert.ok(parseArgs(["get-doc"]).errors.some((error) => error.includes("<path>")));
  assert.ok(parseArgs(["get-related"]).errors.some((error) => error.includes("<path>")));
  assert.ok(parseArgs(["get-doc", "x.md", "--status", "verified"]).errors.some((error) => error.includes("--status")));
  assert.ok(parseArgs(["search-docs", "q", "--limit", "0"]).errors.some((error) => error.includes("--limit")));
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
  await writeWikiDocWithEvidence(cwd, "unlisted.md", "Strict Unlisted Evidence", "## Evidence\n\n- (source not itemized here)\n", ["package.json"], ["package.json#L1"]);

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

test("enrichmentChecklist lists placeholder sections with hints (P5)", () => {
  const body = [
    "# Doc",
    "",
    "## Summary",
    "",
    "- Concise summary: describe the purpose of this document in one or two source-backed bullets.",
    "",
    "## Responsibility",
    "",
    "- The billing domain owns invoice creation via src/billing.ts.",
    "",
    "## Evidence",
    "",
    "- Add file paths, symbols, routes, commands, or test names inspected while completing this document.",
    ""
  ].join("\n");

  const items = enrichmentChecklist(body);
  // Only sections that still hold placeholder text are listed (Responsibility, which
  // has real content, is skipped), one item per section, in document order.
  assert.deepEqual(items.map((item) => item.section), ["Summary", "Evidence"]);
  assert.ok(items[0].hint.includes("Concise summary"));
  // A fully enriched body yields no checklist items.
  assert.equal(enrichmentChecklist("## Summary\n\n- Billing owns invoices via src/billing.ts.").length, 0);
});

test("next surfaces an enrich action and per-doc enrichment checklist (P5)", async () => {
  const cwd = await makeProject("next-enrich-");
  await mkdir(path.join(cwd, "src", "modules", "billing"), { recursive: true });
  await initCommand({ cwd, write: true, minimal: false, withAdapters: false, type: "backend", existing: "skip" });

  const result = await nextCommand({ cwd, type: "backend", profiles: [], agents: [], format: "text", strict: false });

  assert.ok(result.actions.some((action) => action.id === "enrich-placeholder-docs" && action.priority === "medium"));
  assert.ok(Array.isArray(result.enrichmentChecklist) && result.enrichmentChecklist.length > 0);
  const overview = result.enrichmentChecklist.find((doc) => doc.path === "docs/llm-wiki/domains/00_overview.md");
  assert.ok(overview && overview.items.some((item) => item.section === "Evidence"));
  assert.ok(result.text.includes("## Enrichment Checklist"));
  assert.ok(result.text.includes("documents_to_enrich:"));
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

  assert.equal(packageJson.name, "llm-wiki-governance");
  assert.equal(packageJson.version, "1.25.0");
  assert.equal(packageJson.private, false);
  assert.equal(packageJson.publishConfig, undefined);
  assert.equal(packageJson.repository.url, "git+https://github.com/Dowon-Kim7949/llm-wiki-governance.git");
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
    "doctor", "validate", "validate-frontmatter", "monorepo", "status", "next", "explain",
    "audit", "quickstart", "handoff", "prompt", "init", "migrate", "fix",
    "drift", "impact", "check-run", "review", "graph", "stats", "list-docs", "search-docs", "get-doc",
    "get-related", "onboard", "prepare", "release-notes"
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
  assert.equal(api.commands.monorepo, api.monorepoCommand);
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

test("config requiredDocs: loadProjectConfig validates the array shape (1.8)", async () => {
  const okCwd = await makeProject("reqdocs-ok-");
  await writeFile(path.join(okCwd, "llm-wiki.config.json"), JSON.stringify({ requiredDocs: ["docs/llm-wiki/RUNBOOK.md"] }), { encoding: "utf8" });
  const ok = await loadProjectConfig(okCwd);
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.config.requiredDocs, ["docs/llm-wiki/RUNBOOK.md"]);

  const bad = await makeProject("reqdocs-bad-");
  await writeFile(path.join(bad, "llm-wiki.config.json"), JSON.stringify({ requiredDocs: "docs/llm-wiki/RUNBOOK.md" }), { encoding: "utf8" });
  assert.ok((await loadProjectConfig(bad)).errors.length > 0);
});

test("custom document sets extend the structure.required_doc check (1.8)", async () => {
  const cwd = await makeProject("reqdocs-");
  await mkdir(path.join(cwd, "docs", "llm-wiki"), { recursive: true });
  await writeFile(path.join(cwd, "docs", "llm-wiki", "index.md"), "---\ntitle: I\nstatus: needs_review\ndoc_type: index\n---\n", { encoding: "utf8" });

  const missing = await audit({ ...api.normalizeOptions({ cwd }), requiredDocs: ["docs/llm-wiki/RUNBOOK.md"] });
  assert.ok(missing.findings.some((f) => f.rule === "structure.required_doc" && f.path === "docs/llm-wiki/RUNBOOK.md"), "custom required doc flagged when missing");

  await writeFile(path.join(cwd, "docs", "llm-wiki", "RUNBOOK.md"), "---\ntitle: R\nstatus: needs_review\ndoc_type: reference\n---\n\nbody\n", { encoding: "utf8" });
  const present = await audit({ ...api.normalizeOptions({ cwd }), requiredDocs: ["docs/llm-wiki/RUNBOOK.md"] });
  assert.ok(!present.findings.some((f) => f.rule === "structure.required_doc" && f.path === "docs/llm-wiki/RUNBOOK.md"), "satisfied once the custom doc exists");
});

test("config templates: loadProjectConfig validates the override map (1.8)", async () => {
  const okCwd = await makeProject("tmpl-ok-");
  await writeFile(path.join(okCwd, "llm-wiki.config.json"), JSON.stringify({ templates: { "docs/llm-wiki/GLOSSARY.md": "t.md" } }), { encoding: "utf8" });
  assert.deepEqual((await loadProjectConfig(okCwd)).config.templates, { "docs/llm-wiki/GLOSSARY.md": "t.md" });

  const bad = await makeProject("tmpl-bad-");
  await writeFile(path.join(bad, "llm-wiki.config.json"), JSON.stringify({ templates: { "docs/llm-wiki/GLOSSARY.md": 123 } }), { encoding: "utf8" });
  assert.ok((await loadProjectConfig(bad)).errors.length > 0);
});

test("template overrides render the override body but can NEVER set verified (1.8 guardrail)", async () => {
  const cwd = await makeProject("tmpl-override-");
  // An override whose frontmatter claims verified, with a distinctive body.
  await writeFile(path.join(cwd, "my-glossary.tmpl.md"), "---\nstatus: verified\n---\n\nOVERRIDE-BODY-MARKER\n", { encoding: "utf8" });
  await initCommand({ ...api.normalizeOptions({ cwd }), write: true, type: "library", agents: [], profiles: [], existing: "skip", templates: { "docs/llm-wiki/GLOSSARY.md": "my-glossary.tmpl.md" } });

  const generated = await readFile(path.join(cwd, "docs", "llm-wiki", "GLOSSARY.md"), { encoding: "utf8" });
  assert.ok(generated.includes("status: needs_review"), "guardrail forces needs_review");
  assert.ok(!/^status: verified/m.test(generated), "override cannot set status: verified");
  assert.ok(generated.includes("OVERRIDE-BODY-MARKER"), "override body is used");
});

test("template overrides: a missing override file falls back to the built-in template (1.8)", async () => {
  const cwd = await makeProject("tmpl-missing-");
  const result = await initCommand({ ...api.normalizeOptions({ cwd }), write: true, type: "library", agents: [], profiles: [], existing: "skip", templates: { "docs/llm-wiki/GLOSSARY.md": "nope.tmpl.md" } });
  assert.ok(result.skipped.some((line) => line.includes("nope.tmpl.md") && line.includes("not found")), "missing override is noted");
  const generated = await readFile(path.join(cwd, "docs", "llm-wiki", "GLOSSARY.md"), { encoding: "utf8" });
  assert.ok(generated.includes("status: needs_review"), "still created from the built-in template");
});

test("visibility.public_sensitive: opt-in, flags a public doc with sensitive content, never leaks the value (1.9)", async () => {
  const cwd = await makeProject("vis-public-");
  await mkdir(path.join(cwd, "docs", "llm-wiki"), { recursive: true });
  await writeFile(path.join(cwd, "docs", "llm-wiki", "index.md"), "---\ntitle: I\nstatus: needs_review\ndoc_type: index\n---\n", { encoding: "utf8" });
  const secret = "abcdefgh12345678";
  await writeFile(path.join(cwd, "docs", "llm-wiki", "pub.md"), `---\ntitle: P\nstatus: needs_review\ndoc_type: reference\nvisibility: public\ncontains_sensitive_info: true\n---\n\ntoken: ${secret}\n`, { encoding: "utf8" });

  const off = await audit(api.normalizeOptions({ cwd }));
  assert.ok(!off.findings.some((f) => f.rule === "visibility.public_sensitive"), "off by default");

  const on = await audit({ ...api.normalizeOptions({ cwd }), rules: { "visibility.public_sensitive": "warning" } });
  const hit = on.findings.find((f) => f.rule === "visibility.public_sensitive");
  assert.ok(hit, "opt-in flags the public + sensitive doc");
  assert.ok(!JSON.stringify(hit).includes(secret), "the finding must never contain the raw sensitive value");
});

test("visibility.declared_mismatch: flags contains_sensitive_info:false with sensitive content (1.9)", async () => {
  const cwd = await makeProject("vis-declared-");
  await mkdir(path.join(cwd, "docs", "llm-wiki"), { recursive: true });
  await writeFile(path.join(cwd, "docs", "llm-wiki", "index.md"), "---\ntitle: I\nstatus: needs_review\ndoc_type: index\n---\n", { encoding: "utf8" });
  await writeFile(path.join(cwd, "docs", "llm-wiki", "d.md"), "---\ntitle: D\nstatus: needs_review\ndoc_type: reference\ncontains_sensitive_info: false\n---\n\npassword = abcdefgh12345678\n", { encoding: "utf8" });

  const on = await audit({ ...api.normalizeOptions({ cwd }), rules: { "visibility.declared_mismatch": "warning" } });
  assert.ok(on.findings.some((f) => f.rule === "visibility.declared_mismatch"), "flags the declaration/content mismatch");
});

test("monorepo: detects npm/yarn workspaces and validates each wiki package (1.10)", async () => {
  const root = await makeProject("mono-");
  await writeJson(path.join(root, "package.json"), { name: "root", private: true, workspaces: ["packages/*"] });
  for (const name of ["alpha", "beta"]) {
    const wiki = path.join(root, "packages", name, "docs", "llm-wiki");
    await mkdir(wiki, { recursive: true });
    await writeFile(path.join(wiki, "index.md"), "---\ntitle: I\nstatus: needs_review\ndoc_type: index\n---\n", { encoding: "utf8" });
  }
  await mkdir(path.join(root, "packages", "gamma"), { recursive: true }); // no wiki -> skipped

  const result = await api.commands.monorepo(api.normalizeOptions({ cwd: root }));
  assert.equal(result.command, "monorepo");
  assert.deepEqual(result.packages.map((p) => p.path).sort(), ["packages/alpha", "packages/beta"]);
  assert.ok(result.skipped.some((s) => s.includes("packages/gamma")));
});

test("monorepo: single repo yields empty packages; pnpm workspaces reported unsupported (1.10)", async () => {
  const single = await makeProject("mono-single-");
  const r1 = await api.commands.monorepo(api.normalizeOptions({ cwd: single }));
  assert.deepEqual(r1.packages, []);
  assert.equal(r1.unsupported, null);

  const pnpm = await makeProject("mono-pnpm-");
  await writeFile(path.join(pnpm, "pnpm-workspace.yaml"), "packages:\n  - 'packages/*'\n", { encoding: "utf8" });
  const r2 = await api.commands.monorepo(api.normalizeOptions({ cwd: pnpm }));
  assert.deepEqual(r2.packages, []);
  assert.ok(r2.unsupported && r2.unsupported.includes("pnpm"));
});

test("monorepo: each package honors its own llm-wiki.config.json (1.10)", async () => {
  const root = await makeProject("mono-config-");
  await writeJson(path.join(root, "package.json"), { name: "root", private: true, workspaces: ["packages/*"] });
  const wiki = path.join(root, "packages", "alpha", "docs", "llm-wiki");
  await mkdir(wiki, { recursive: true });
  await writeFile(path.join(wiki, "index.md"), "---\ntitle: I\nstatus: needs_review\ndoc_type: index\n---\n", { encoding: "utf8" });
  await writeFile(path.join(root, "packages", "alpha", "llm-wiki.config.json"), JSON.stringify({ requiredDocs: ["docs/llm-wiki/RUNBOOK.md"] }), { encoding: "utf8" });

  const result = await api.commands.monorepo(api.normalizeOptions({ cwd: root }));
  assert.ok(result.findings.some((f) => f.rule === "structure.required_doc" && f.path.includes("packages/alpha") && f.path.includes("RUNBOOK")), "the package's own requiredDocs drove a per-package finding");
});

test("cross-repo references (repo:) and URLs are recognized, not flagged missing (1.11)", async () => {
  const cwd = await makeProject("crossrepo-");
  await mkdir(path.join(cwd, "docs", "llm-wiki"), { recursive: true });
  await writeFile(path.join(cwd, "docs", "llm-wiki", "index.md"), "---\ntitle: I\nstatus: needs_review\ndoc_type: index\n---\n", { encoding: "utf8" });
  await writeFile(path.join(cwd, "docs", "llm-wiki", "x.md"), "---\ntitle: X\nstatus: needs_review\ndoc_type: reference\nsource_files:\n  - repo:other-svc/src/api.py\nrelated:\n  - repo:other-svc/docs/llm-wiki/API.md\n---\n\nUpstream: [[repo:other-svc/docs/llm-wiki/API.md]] and [[http://example.com/x]].\n", { encoding: "utf8" });

  const result = await audit(api.normalizeOptions({ cwd }));
  const xFindings = result.findings.filter((f) => f.path.includes("x.md"));
  assert.ok(!xFindings.some((f) => f.rule === "wiki_link.missing"), "cross-repo/URL wiki links are not flagged");
  assert.ok(!xFindings.some((f) => f.rule === "source_files.missing"), "repo: source_files are not flagged");
  assert.ok(!xFindings.some((f) => f.rule === "related.missing"), "repo: related are not flagged");
});

test("a genuinely missing local wiki link is still flagged (1.11 local resolution unchanged)", async () => {
  const cwd = await makeProject("crossrepo-local-");
  await mkdir(path.join(cwd, "docs", "llm-wiki"), { recursive: true });
  await writeFile(path.join(cwd, "docs", "llm-wiki", "index.md"), "---\ntitle: I\nstatus: needs_review\ndoc_type: index\n---\n", { encoding: "utf8" });
  await writeFile(path.join(cwd, "docs", "llm-wiki", "y.md"), "---\ntitle: Y\nstatus: needs_review\ndoc_type: reference\n---\n\nSee [[nonexistent-local-doc]].\n", { encoding: "utf8" });

  const result = await audit(api.normalizeOptions({ cwd }));
  assert.ok(result.findings.some((f) => f.rule === "wiki_link.missing" && f.path.includes("y.md")), "a real missing local wiki link is still flagged");
});

// ---- cross-feature integration (stabilization) -------------------------------

test("integration: rules + requiredDocs + visibility + thin_body compose in one audit; sensitive safety holds", async () => {
  const cwd = await makeProject("integ-all-");
  await mkdir(path.join(cwd, "docs", "llm-wiki"), { recursive: true });
  await writeFile(path.join(cwd, "docs", "llm-wiki", "index.md"), "---\ntitle: I\nstatus: needs_review\ndoc_type: index\n---\n", { encoding: "utf8" });
  await writeFile(path.join(cwd, "docs", "llm-wiki", "svc.md"), "---\ntitle: S\nstatus: needs_review\ndoc_type: reference\nvisibility: public\ncontains_sensitive_info: true\nrelated:\n  - docs/llm-wiki/gone.md\n---\n\ntoken: abcdefgh12345678\n", { encoding: "utf8" });
  const result = await audit({
    ...api.normalizeOptions({ cwd }),
    rules: { "related.missing": "off", "sensitive.redacted": "off", "visibility.public_sensitive": "warning", "content.thin_body": "warning" },
    requiredDocs: ["docs/llm-wiki/RUNBOOK.md"]
  });
  const rules = new Set(result.findings.map((f) => f.rule));
  assert.ok(!rules.has("related.missing"), "related.missing toggled off");
  assert.ok(result.findings.some((f) => f.rule === "structure.required_doc" && f.path.includes("RUNBOOK")), "custom requiredDocs applied");
  assert.ok(rules.has("visibility.public_sensitive"), "visibility rule opted in");
  assert.ok(rules.has("content.thin_body"), "thin_body opted in");
  assert.ok(rules.has("sensitive.redacted"), "sensitive detection still fires even when its toggle-off is attempted (safety invariant)");
});

test("integration: monorepo applies each package's own config independently", async () => {
  const root = await makeProject("integ-mono-");
  await writeJson(path.join(root, "package.json"), { name: "root", private: true, workspaces: ["packages/*"] });
  for (const name of ["alpha", "beta"]) {
    await mkdir(path.join(root, "packages", name, "docs", "llm-wiki"), { recursive: true });
    await writeFile(path.join(root, "packages", name, "docs", "llm-wiki", "index.md"), "---\ntitle: I\nstatus: needs_review\ndoc_type: index\n---\n", { encoding: "utf8" });
  }
  await writeFile(path.join(root, "packages", "alpha", "llm-wiki.config.json"), JSON.stringify({ rules: { "structure.required_doc": "off" } }), { encoding: "utf8" });

  const result = await api.commands.monorepo(api.normalizeOptions({ cwd: root }));
  const alpha = result.findings.filter((f) => f.path.startsWith("packages/alpha"));
  const beta = result.findings.filter((f) => f.path.startsWith("packages/beta"));
  assert.ok(!alpha.some((f) => f.rule === "structure.required_doc"), "alpha's own toggle suppressed required_doc");
  assert.ok(beta.some((f) => f.rule === "structure.required_doc"), "beta (no toggle) still reports required_doc");
});

test("integration: cross-repo references are ignored while a visibility rule still fires", async () => {
  const cwd = await makeProject("integ-xrepo-vis-");
  await mkdir(path.join(cwd, "docs", "llm-wiki"), { recursive: true });
  await writeFile(path.join(cwd, "docs", "llm-wiki", "index.md"), "---\ntitle: I\nstatus: needs_review\ndoc_type: index\n---\n", { encoding: "utf8" });
  await writeFile(path.join(cwd, "docs", "llm-wiki", "svc.md"), "---\ntitle: S\nstatus: needs_review\ndoc_type: reference\nvisibility: public\ncontains_sensitive_info: true\nrelated:\n  - repo:other/docs/llm-wiki/API.md\n---\n\nUpstream [[repo:other/docs/llm-wiki/API.md]]. password = abcdefgh12345678\n", { encoding: "utf8" });
  const result = await audit({ ...api.normalizeOptions({ cwd }), rules: { "visibility.public_sensitive": "warning" } });
  const svc = result.findings.filter((f) => f.path.includes("svc.md"));
  assert.ok(!svc.some((f) => f.rule === "related.missing" || f.rule === "wiki_link.missing"), "cross-repo refs are not flagged");
  assert.ok(svc.some((f) => f.rule === "visibility.public_sensitive"), "visibility rule fires alongside cross-repo references");
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

// ---- P0/P1 exposure-test fixes ----------------------------------------

test("detects UTF-16/UTF-8-BOM manifests as backend, not mis-typed as library (P0 bug A)", async () => {
  // A framework manifest saved with a byte-order mark. Read as plain UTF-8 the
  // bytes become mojibake, the framework keyword is missed, and Python falls back
  // to `library`. The BOM-aware manifest reader decodes it correctly -> `backend`.
  const text = "fastapi==0.110.0\nuvicorn==0.29.0\n";

  // UTF-16LE + BOM (FF FE) — how Windows tools (e.g. PowerShell `>` redirection) save text.
  const leCwd = await makeProject("utf16le-manifest-");
  await writeFile(path.join(leCwd, "requirements.txt"), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]));

  // UTF-16BE + BOM (FE FF) — exercises the byte-swap decode path (swap16 turns the
  // LE bytes, BOM included, into their BE order).
  const beBuffer = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]);
  beBuffer.swap16();
  const beCwd = await makeProject("utf16be-manifest-");
  await writeFile(path.join(beCwd, "requirements.txt"), beBuffer);

  // UTF-8 + BOM (EF BB BF).
  const utf8BomCwd = await makeProject("utf8bom-manifest-");
  await writeFile(path.join(utf8BomCwd, "requirements.txt"), Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, "utf8")]));

  for (const cwd of [leCwd, beCwd, utf8BomCwd]) {
    const result = await initCommand({ cwd, dryRun: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });
    assert.equal(result.detection.projectType, "backend");
    assert.deepEqual(result.detection.ecosystems, ["python"]);
    assert.equal(result.detection.primaryManifest, "requirements.txt");
  }
});

test("quickstart handoff prompt never points at adapter files it did not create (P0 bug B)", async () => {
  // No --agent: quickstart --write creates no adapter files, so the handoff prompt
  // must not open by telling the receiving agent to read a non-existent AGENTS.md.
  const noAgentCwd = await makeProject("handoff-noagent-");
  await writeJson(path.join(noAgentCwd, "package.json"), { dependencies: { fastify: "^4.0.0" } });
  const noAgent = await quickstartCommand({ cwd: noAgentCwd, dryRun: false, write: true, minimal: true, withAdapters: false, type: "backend", profiles: [], agents: [], existing: "skip" });

  assert.equal(noAgent.result, "pass");
  assert.ok(noAgent.handoff.prompt.includes("docs/llm-wiki/index.md"), "the wiki index stays the reliable entrypoint");
  assert.ok(!noAgent.handoff.prompt.includes("AGENTS.md"), "does not reference an uncreated AGENTS.md");
  assert.ok(!noAgent.handoff.prompt.includes("CLAUDE.md"), "does not reference an uncreated CLAUDE.md");
  assert.equal(await fileExists(path.join(noAgentCwd, "AGENTS.md")), false, "AGENTS.md was indeed never created");

  // With an explicit --agent codex, init creates AGENTS.md, so naming it is correct.
  const codexCwd = await makeProject("handoff-codex-");
  await writeJson(path.join(codexCwd, "package.json"), { dependencies: { fastify: "^4.0.0" } });
  const codex = await quickstartCommand({ cwd: codexCwd, dryRun: false, write: true, minimal: true, withAdapters: false, type: "backend", profiles: [], agents: ["codex"], existing: "skip" });
  assert.ok(codex.handoff.prompt.includes("AGENTS.md"), "explicit --agent codex still names AGENTS.md");
  assert.equal(await fileExists(path.join(codexCwd, "AGENTS.md")), true, "and the file it names exists");
});

test("init and quickstart with no mode flag read as Ready, not Blocked (P1 rename)", async () => {
  const cwd = await makeProject("no-mode-flag-");

  const init = await initCommand({ cwd, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });
  assert.equal(init.result, "ready");
  assert.ok(!init.findings?.some((finding) => finding.severity === "blocked"), "no blocked finding");
  assert.ok(init.text.includes("Ready (needs --write)"), "title reframed as Ready");
  assert.ok(!/^#.*Blocked\s*$/m.test(init.text), "no 'Blocked' banner");
  assert.ok(init.text.includes("init --write"), "still tells the user how to proceed");

  const quickstart = await quickstartCommand({ cwd, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });
  assert.equal(quickstart.result, "ready");
  assert.ok(quickstart.text.includes("Ready (needs --write)"));
  assert.ok(quickstart.text.includes("quickstart --write"));

  // The genuine misuse (both modes requested at once) stays a hard Blocked error.
  const conflict = await quickstartCommand({ cwd, dryRun: true, write: true, minimal: false, withAdapters: false, type: null, profiles: [], agents: [] });
  assert.equal(conflict.result, "blocked");
});

test("quickstart Next Step explains the prompt is for the agent, and brownfield reads clearly (1.14.1 UX)", async () => {
  const cwd = await makeProject("quickstart-ux-");
  await writeJson(path.join(cwd, "package.json"), { dependencies: { fastify: "^4.0.0" } });

  // First write scaffolds the wiki.
  const first = await quickstartCommand({ cwd, dryRun: false, write: true, minimal: true, withAdapters: false, type: "backend", profiles: [], agents: [], existing: "skip" });
  assert.equal(first.result, "pass");
  // (가) The Next Step spells out that the Handoff Prompt goes to a coding agent, not the CLI.
  assert.ok(first.text.includes("실행 방법"), "Next Step carries a concrete run guide");
  assert.ok(first.text.includes("CLI가 실행하는 게 아니라"), "clarifies the CLI does not run the prompt");
  assert.ok(first.text.includes("붙여넣"), "tells the user to paste the prompt into their agent");
  // The short programmatic handoff.message is preserved (contract stable).
  assert.ok(first.handoff.message.includes("넘어가서 아래 프롬프트를 실행하세요"));

  // (나) A second run over the now-existing wiki: skipped is annotated and a brownfield note appears.
  const second = await quickstartCommand({ cwd, dryRun: true, write: false, minimal: true, withAdapters: false, type: "backend", profiles: [], agents: [], existing: "skip" });
  assert.match(second.text, /skipped: \d+ \(\d+ already exist, kept\)/, "skipped count is annotated with the reason");
  assert.ok(second.text.includes("LLM-WIKI가 이미 있어"), "brownfield note points to enrichment, not re-creation");
});

test("evidence accepts colon-line notation (file:10) equivalently to file#L10 (1.14.2)", async () => {
  const { parseEvidenceReference } = await import("../src/commands/references.js");
  assert.deepEqual(parseEvidenceReference("src/app.py:10"), { source: "src/app.py", locator: { kind: "line", start: 10, end: 10 }, external: false });
  assert.deepEqual(parseEvidenceReference("src/app.py:10-20"), { source: "src/app.py", locator: { kind: "line", start: 10, end: 20 }, external: false });
  // The hash form is unchanged, and a plain path still has no locator.
  assert.deepEqual(parseEvidenceReference("src/app.py#L10"), { source: "src/app.py", locator: { kind: "line", start: 10, end: 10 }, external: false });
  assert.deepEqual(parseEvidenceReference("src/app.py"), { source: "src/app.py", locator: null, external: false });
  // No colon-line misfire on a symbol locator or a plain trailing colon.
  assert.deepEqual(parseEvidenceReference("src/app.py#symbol:main"), { source: "src/app.py", locator: { kind: "symbol", value: "main" }, external: false });
});

test("colon-line evidence no longer produces a false evidence.missing (1.14.2)", async () => {
  const cwd = await makeProject("evidence-colon-");
  await mkdir(path.join(cwd, "docs", "llm-wiki"), { recursive: true });
  await writeFile(path.join(cwd, "src.py"), "a\nb\nc\n", { encoding: "utf8" });
  await writeFile(path.join(cwd, "docs", "llm-wiki", "index.md"),
    "---\ntitle: I\nstatus: needs_review\ndoc_type: index\nevidence:\n  - src.py:2\n---\n\n## Evidence\n\n- src.py:2\n", { encoding: "utf8" });
  const result = await audit(api.normalizeOptions({ cwd }));
  assert.ok(!result.findings.some((f) => f.rule === "evidence.missing"), "src.py:2 resolves to a real source, not missing");
});

test("orphan detection excludes generated templates/ scaffolds but still flags real orphans (1.14.2)", async () => {
  const { collectWikiGraph } = await import("../src/commands/wiki-graph.js");
  const cwd = await makeProject("orphan-tmpl-");
  await mkdir(path.join(cwd, "docs", "llm-wiki", "templates"), { recursive: true });
  await writeWikiDoc(cwd, "index.md", "Index", "Entry.");
  await writeFile(path.join(cwd, "docs", "llm-wiki", "templates", "FOO.template.md"),
    "---\ntitle: T\nstatus: needs_review\ndoc_type: template\n---\n\nbody\n", { encoding: "utf8" });
  await writeWikiDoc(cwd, "loose.md", "Loose", "Nothing links here.");

  const graph = await collectWikiGraph(cwd);
  assert.ok(!graph.orphanDocuments.some((p) => p.includes("/templates/")), "templates are not reported as orphans");
  assert.ok(graph.orphanDocuments.includes("docs/llm-wiki/loose.md"), "a genuinely unlinked doc is still an orphan");
});

test("init --write warns (not blocks) when the wiki output path is gitignored (1.14.2)", async () => {
  const cwd = await makeProject("gitignore-out-");
  const git = gitAtDate(cwd, "2026-07-20T12:00:00");
  git(["init"]);
  await writeFile(path.join(cwd, ".gitignore"), "docs/\n", { encoding: "utf8" });

  const result = await initCommand({ cwd, write: true, minimal: true, withAdapters: false, type: "library", profiles: [], agents: [], existing: "skip" });
  assert.ok(result.findings.some((f) => f.rule === "structure.output_gitignored"), "gitignored output is flagged");
  assert.equal(result.result, "warning", "it warns, never blocks");
  assert.ok(result.text.includes("gitignored"), "surfaced in the report text");
});

test("init --write prints a reassurance summary line (1.14.2)", async () => {
  const cwd = await makeProject("reassure-");
  const result = await initCommand({ cwd, write: true, minimal: true, withAdapters: false, type: "library", profiles: [], agents: [], existing: "skip" });
  assert.match(result.text, /\d+ created, \d+ overwritten, \d+ kept \(existing files preserved/, "summary reassures what was and wasn't touched");
});

test("help leads with a bilingual what/why/how orientation + version and @latest tip (1.14.3)", async () => {
  const { helpText, packageVersion } = await import("../src/cli.js");
  const text = helpText();
  assert.match(text, /llm-wiki v\d+\.\d+\.\d+/, "shows the package version so a stale npx cache is noticeable");
  assert.ok(text.includes("What it does / 무엇을 하나"), "bilingual what-it-does heading (EN-first)");
  assert.ok(text.includes("AI 에이전트가 읽는") && text.includes("your AI coding agent reads"), "KO+EN one-liner");
  assert.ok(text.includes("@latest"), "recommends @latest (the npx-cache caveat)");
  assert.ok(text.includes("Usage:"), "still lists usage below the orientation");
  // Generated-doc language is discoverable from --help, not only from init/quickstart
  // runtime output: overseas users get English by default and can switch via --doc-lang.
  assert.ok(/init --write[^\n]*\[--doc-lang en\|ko\]/.test(text), "init --write usage advertises --doc-lang");
  assert.ok(/quickstart --write[^\n]*\[--doc-lang en\|ko\]/.test(text), "quickstart --write usage advertises --doc-lang");
  const pkgVersion = JSON.parse(await readFile(path.join(process.cwd(), "package.json"), "utf8")).version;
  assert.equal(packageVersion(), pkgVersion, "version matches package.json");
});

test("quickstart output opens with a bilingual About orientation (1.14.3)", async () => {
  const cwd = await makeProject("quickstart-about-");
  await writeJson(path.join(cwd, "package.json"), { dependencies: { fastify: "^4.0.0" } });
  const result = await quickstartCommand({ cwd, dryRun: true, write: false, minimal: true, withAdapters: false, type: "backend", profiles: [], agents: [], existing: "skip" });
  assert.ok(result.text.includes("About · 소개"), "About section present for the quickstart-direct path");
  assert.ok(result.text.includes("코드-근거 지식베이스") && result.text.includes("code-grounded knowledge base"), "bilingual orientation");
});

test("domain detection skips virtualenvs and site-packages, not the project's own code (1.14.4)", async () => {
  const cwd = await makeProject("venv-domains-");
  // A version-suffixed virtualenv (name not in the skip list) with an installed
  // dependency whose handlers/ dir would otherwise be mistaken for domains.
  await mkdir(path.join(cwd, "venv3.10", "Lib", "site-packages", "passlib", "handlers"), { recursive: true });
  await writeFile(path.join(cwd, "venv3.10", "pyvenv.cfg"), "home = /usr\n", { encoding: "utf8" });
  await writeFile(path.join(cwd, "venv3.10", "Lib", "site-packages", "passlib", "handlers", "sha1_crypt.py"), "x = 1\n", { encoding: "utf8" });
  // A bare site-packages tree WITHOUT a venv marker (exercises the name skip directly).
  await mkdir(path.join(cwd, "thirdparty", "site-packages", "boto3", "resources"), { recursive: true });
  await writeFile(path.join(cwd, "thirdparty", "site-packages", "boto3", "resources", "collection.py"), "x = 1\n", { encoding: "utf8" });
  // The project's OWN backend handlers — must still be detected.
  await mkdir(path.join(cwd, "app", "handlers"), { recursive: true });
  await writeFile(path.join(cwd, "app", "handlers", "orders.py"), "y = 1\n", { encoding: "utf8" });

  const detected = await detectDomainDirectories(cwd);
  const sources = detected.map((d) => d.sourceFile);
  assert.ok(!sources.some((s) => s.includes("site-packages") || s.includes("venv3.10")), "no venv/site-packages domains leak in");
  assert.ok(sources.some((s) => s.endsWith("app/handlers/orders.py")), "the project's own handler is still detected");
});

test("skill generation: --skills emits Claude/Cursor/neutral artifacts with an injected domain map (1.15.0)", async () => {
  const cwd = await makeProject("skills-");
  await writeFile(path.join(cwd, "requirements.txt"), "fastapi==0.110.0\n", { encoding: "utf8" });
  await mkdir(path.join(cwd, "app", "api", "v2", "endpoints"), { recursive: true });
  await writeFile(path.join(cwd, "app", "api", "v2", "endpoints", "hazard.py"), "from fastapi import APIRouter\nrouter = APIRouter()\n", { encoding: "utf8" });

  const result = await initCommand({ cwd, write: true, minimal: false, withAdapters: false, skills: true, type: "backend", profiles: [], agents: [], existing: "skip" });
  assert.equal(result.result, "pass");
  // Three tasks x three formats.
  for (const rel of [".claude/skills/llm-wiki-feature/SKILL.md", ".cursor/rules/llm-wiki-fix.mdc", ".llm-wiki/prompts/llm-wiki-docs-sync.md"]) {
    assert.ok(await fileExists(path.join(cwd, rel)), `${rel} created`);
  }
  const skill = await readFile(path.join(cwd, ".claude", "skills", "llm-wiki-feature", "SKILL.md"), "utf8");
  assert.ok(skill.includes("name: llm-wiki-feature"), "skill frontmatter name");
  // Feature/fix/docs-sync now point at the LIVE wiki map at run time (compact
  // retrieval) instead of baking in a generation-time domain-map snapshot.
  assert.ok(/RUN TIME/.test(skill) && /llm-wiki prepare/.test(skill), "feature skill assembles the wiki map at run time");
  assert.equal(/docs\/llm-wiki\/domains\/\d+_hazard\.md/.test(skill), false, "no frozen domain-map snapshot in feature skill");
  assert.ok(skill.includes("needs_review"), "needs_review discipline embedded");
  // Portability/privacy: the generating machine's absolute path (and username) is not baked in.
  assert.ok(!skill.includes(cwd) && !/[A-Za-z]:\\Users\\/.test(skill), "no absolute machine path leaked into the artifact");
  // Terminal-only bits of the reused prompt are trimmed from the committed artifact.
  assert.ok(!skill.includes("Workspace:") && !skill.includes("Target agent context"), "ephemeral Workspace/agent-context lines are trimmed");
  // Gate 26: the completion contract (run manifest + check-run) is embedded in the skill body.
  assert.ok(skill.includes("llm-wiki check-run") && skill.includes("changedSource") && skill.includes(".llm-wiki/runs/"), "Gate 26 completion contract embedded");
});

test("skill generation: off unless requested, and never overwrites (1.15.0)", async () => {
  const cwd = await makeProject("skills-off-");
  await writeFile(path.join(cwd, "requirements.txt"), "fastapi==0.110.0\n", { encoding: "utf8" });
  // No --skills and no native-skill agent (claude/codex/cursor) -> nothing emitted.
  await initCommand({ cwd, write: true, minimal: true, withAdapters: false, type: "backend", profiles: [], agents: ["copilot"], existing: "skip" });
  assert.equal(await fileExists(path.join(cwd, ".claude", "skills", "llm-wiki-feature", "SKILL.md")), false, "no skills when not requested");

  // A pre-existing skill file is never overwritten.
  await mkdir(path.join(cwd, ".claude", "skills", "llm-wiki-feature"), { recursive: true });
  await writeFile(path.join(cwd, ".claude", "skills", "llm-wiki-feature", "SKILL.md"), "CUSTOM\n", { encoding: "utf8" });
  const result = await initCommand({ cwd, write: true, minimal: true, withAdapters: false, skills: true, type: "backend", profiles: [], agents: [], existing: "skip" });
  assert.equal(await readFile(path.join(cwd, ".claude", "skills", "llm-wiki-feature", "SKILL.md"), "utf8"), "CUSTOM\n", "existing skill preserved");
  assert.ok(result.skipped.some((l) => l.includes("llm-wiki-feature/SKILL.md") && l.includes("kept existing")), "skip is noted");
});

test("skill simplification: feature/fix/docs-sync drop the frozen snapshot but keep every safety contract; bootstrap keeps its snapshot", async () => {
  const cwd = await backendWikiFixture("skills-simplify-");
  await initCommand({ cwd, write: true, minimal: false, withAdapters: false, skills: true, type: "backend", profiles: [], agents: [], existing: "skip" });
  const read = (slug) => readFile(path.join(cwd, ".claude", "skills", slug, "SKILL.md"), "utf8");
  for (const slug of ["llm-wiki-feature", "llm-wiki-fix", "llm-wiki-docs-sync"]) {
    const body = await read(slug);
    assert.equal(/Project domain map \(read/.test(body), false, `${slug}: no frozen domain-map snapshot`);
    assert.ok(/RUN TIME/.test(body), `${slug}: assembles the wiki map at run time`);
    // Safety contracts must survive the simplification.
    assert.ok(body.includes("needs_review"), `${slug}: keeps needs_review discipline`);
    assert.ok(body.includes("check-run") && body.includes("changedSource"), `${slug}: keeps the Gate 26 completion contract`);
    assert.ok(/verified is human-approved only/.test(body), `${slug}: keeps the no-verified rule`);
    assert.match(body, /llm-wiki-generated v\S+ [0-9a-f]{16}/, `${slug}: carries a refresh marker`);
  }
  // Bootstrap keeps fuller guidance (its generation-time domain snapshot stays).
  assert.match(await read("llm-wiki-bootstrap"), /docs\/llm-wiki\/domains\/\d+_hazard\.md/, "bootstrap keeps its domain-map snapshot");
});

test("--refresh updates only managed, unmodified skills; user edits and custom skills are preserved", async () => {
  const { createHash } = await import("node:crypto");
  const markerRe = /\n<!-- llm-wiki-generated v\S+ [0-9a-f]{16} -->\n?$/;
  const cwd = await makeProject("skills-refresh-");
  await writeFile(path.join(cwd, "requirements.txt"), "fastapi==0.110.0\n", { encoding: "utf8" });
  await initCommand({ cwd, write: true, minimal: true, withAdapters: false, skills: true, type: "backend", profiles: [], agents: [], existing: "skip" });
  const featurePath = path.join(cwd, ".claude", "skills", "llm-wiki-feature", "SKILL.md");
  const original = await readFile(featurePath, "utf8");

  // Managed + unmodified + identical to the current template: --refresh leaves it byte-identical.
  const r1 = await initCommand({ cwd, write: true, minimal: true, withAdapters: false, skills: true, refresh: true, type: "backend", profiles: [], agents: [], existing: "skip" });
  assert.ok(r1.skipped.some((l) => l.includes("llm-wiki-feature/SKILL.md") && /up to date/.test(l)), "unchanged managed skill reported up to date");
  assert.equal(await readFile(featurePath, "utf8"), original, "up-to-date managed skill left byte-identical");

  // Managed + unmodified but STALE (valid marker over an older body): --refresh overwrites it.
  const olderBody = `${original.replace(markerRe, "")}\nAN OLDER GENERATED LINE\n`;
  const olderHash = createHash("sha256").update(olderBody, "utf8").digest("hex").slice(0, 16);
  await writeFile(featurePath, `${olderBody}\n<!-- llm-wiki-generated v1 ${olderHash} -->\n`, { encoding: "utf8" });
  const r2 = await initCommand({ cwd, write: true, minimal: true, withAdapters: false, skills: true, refresh: true, type: "backend", profiles: [], agents: [], existing: "skip" });
  assert.ok(r2.created.some((l) => l.includes("llm-wiki-feature/SKILL.md") && /refreshed/.test(l)), "stale managed skill refreshed");
  assert.equal((await readFile(featurePath, "utf8")).includes("AN OLDER GENERATED LINE"), false, "stale content replaced by the current template");

  // User-modified (no valid marker match): NEVER overwritten, even with --refresh.
  await writeFile(featurePath, "I EDITED THIS SKILL\n", { encoding: "utf8" });
  const r3 = await initCommand({ cwd, write: true, minimal: true, withAdapters: false, skills: true, refresh: true, type: "backend", profiles: [], agents: [], existing: "skip" });
  assert.equal(await readFile(featurePath, "utf8"), "I EDITED THIS SKILL\n", "user-modified skill never overwritten with --refresh");
  assert.ok(r3.skipped.some((l) => l.includes("llm-wiki-feature/SKILL.md") && /conflict/.test(l)), "user-modified skill reported as a conflict");

  // parseArgs accepts --refresh on init/quickstart, rejects it elsewhere.
  assert.equal(parseArgs(["init", "--write", "--skills", "--refresh"]).options.refresh, true);
  assert.ok(parseArgs(["validate", "--refresh"]).errors.some((e) => e.includes("--refresh")));
});


test("skill generation surfaces a restart-required note only when skills are created (1.15.x)", async () => {
  // With skills: the bilingual restart note appears and skillsCreated is set.
  const on = await makeProject("skill-note-on-");
  await writeJson(path.join(on, "package.json"), { dependencies: { fastify: "^4.0.0" } });
  const withSkills = await initCommand({ cwd: on, write: true, minimal: true, withAdapters: false, skills: true, type: "backend", profiles: [], agents: [], existing: "skip" });
  assert.ok(withSkills.skillsCreated > 0, "skillsCreated reflects generated skills");
  assert.ok(withSkills.text.includes("재시작") && withSkills.text.includes("restart your coding agent"), "bilingual restart note shown");
  assert.ok(withSkills.text.includes("session start"), "explains skills load at session start, not hot-reload");

  // Without skills: no note, skillsCreated falsy.
  const off = await makeProject("skill-note-off2-");
  await writeJson(path.join(off, "package.json"), { dependencies: { fastify: "^4.0.0" } });
  const noSkills = await initCommand({ cwd: off, write: true, minimal: true, withAdapters: false, type: "backend", profiles: [], agents: ["copilot"], existing: "skip" });
  assert.ok(!(noSkills.skillsCreated > 0), "no skills created without --skills / native-skill agent (claude|codex|cursor)");
  assert.ok(!noSkills.text.includes("restart your coding agent"), "no restart note when no skills were created");

  // quickstart surfaces it too (it runs init).
  const qs = await makeProject("skill-note-qs-");
  await writeJson(path.join(qs, "package.json"), { dependencies: { fastify: "^4.0.0" } });
  const quick = await quickstartCommand({ cwd: qs, dryRun: false, write: true, minimal: true, withAdapters: false, skills: true, type: "backend", profiles: [], agents: [], existing: "skip" });
  assert.ok(quick.text.includes("재시작") && quick.text.includes("session start"), "quickstart shows the restart note");
});

// --- Bootstrap skill + Codex native skill generation ---

const CODEX_SKILL_TASKS = ["llm-wiki-bootstrap", "llm-wiki-onboard", "llm-wiki-prepare", "llm-wiki-feature", "llm-wiki-fix", "llm-wiki-docs-sync"];

test("skill formats: --agent codex and --skills both select the codex native format", () => {
  assert.ok(selectedSkillFormats(["codex"], {}).has("codex"), "--agent codex selects codex skills");
  assert.ok(!selectedSkillFormats(["codex"], {}).has("claude"), "--agent codex does not select claude skills");
  const all = selectedSkillFormats([], { skills: true });
  for (const fmt of ["claude", "codex", "cursor", "neutral"]) assert.ok(all.has(fmt), `--skills selects ${fmt}`);
  assert.equal(selectedSkillFormats(["copilot"], {}).size, 0, "a non-native-skill agent selects nothing");
  // The registry carries the bootstrap task alongside feature/fix/docs-sync.
  assert.deepEqual(SKILL_TASKS.map((t) => t.slug), CODEX_SKILL_TASKS);
});

test("skill generation: --agent codex plans .agents/skills/<name>/SKILL.md for all four tasks (dry-run, deterministic)", async () => {
  const cwd = await makeProject("codex-plan-");
  await writeJson(path.join(cwd, "package.json"), { dependencies: { fastify: "^4.0.0" } });
  // Dry-run must be stable even though no wiki/domain files exist yet.
  const result = await initCommand({ cwd, dryRun: true, minimal: true, withAdapters: false, type: "backend", profiles: [], agents: ["codex"], existing: "skip" });
  for (const slug of CODEX_SKILL_TASKS) {
    const rel = `.agents/skills/${slug}/SKILL.md`;
    assert.ok(result.planned.some((line) => line.includes(rel)), `${rel} planned`);
  }
  // Codex native format is planned; Claude skill path is not (only --agent codex selected).
  assert.ok(!result.planned.some((line) => line.includes(".claude/skills/")), "no claude skill planned for --agent codex");
});

test("skill generation: init --write --agent codex writes four Codex skills with valid frontmatter and bootstrap body (2/3/4)", async () => {
  const cwd = await makeProject("codex-write-");
  await writeFile(path.join(cwd, "requirements.txt"), "fastapi==0.110.0\n", { encoding: "utf8" });
  await mkdir(path.join(cwd, "app", "api", "v2", "endpoints"), { recursive: true });
  await writeFile(path.join(cwd, "app", "api", "v2", "endpoints", "hazard.py"), "from fastapi import APIRouter\nrouter = APIRouter()\n", { encoding: "utf8" });

  const result = await initCommand({ cwd, write: true, minimal: false, withAdapters: false, type: "backend", profiles: [], agents: ["codex"], existing: "skip" });
  assert.equal(result.result, "pass");

  const descBySlug = Object.fromEntries(SKILL_TASKS.map((t) => [t.slug, t.description]));
  for (const slug of CODEX_SKILL_TASKS) {
    const abs = path.join(cwd, ".agents", "skills", slug, "SKILL.md");
    assert.ok(await fileExists(abs), `${slug} SKILL.md created`);
    const content = await readFile(abs, "utf8");
    // 4: valid name/description frontmatter.
    assert.ok(content.startsWith(`---\nname: ${slug}\ndescription: ${descBySlug[slug]}\n---\n`), `${slug} frontmatter`);
    // Portability/privacy: no machine-absolute path / username baked in.
    assert.ok(!content.includes(cwd) && !/[A-Za-z]:\\Users\\/.test(content), "no absolute machine path leaked");
  }

  // 5: the bootstrap body carries the required initial-enrichment contract.
  const bootstrap = await readFile(path.join(cwd, ".agents", "skills", "llm-wiki-bootstrap", "SKILL.md"), "utf8");
  assert.ok(bootstrap.includes("docs/llm-wiki/index.md"), "reads index.md first");
  assert.ok(/Investigate the actual code/.test(bootstrap), "investigates real source");
  assert.ok(bootstrap.includes("source_files") && bootstrap.includes("evidence"), "evidence/source_files");
  assert.ok(bootstrap.includes("needs_review"), "needs_review");
  assert.ok(bootstrap.includes("Do not promote anything to verified"), "no auto-verified promotion");
  assert.ok(bootstrap.includes("docs/llm-wiki/log.md") && bootstrap.includes("append-only"), "log.md append-only");
  assert.ok(/validate \/ audit \/ stats/.test(bootstrap), "runs validation");
  // Bootstrap injects the generated domain map, and states its preconditions.
  assert.match(bootstrap, /docs\/llm-wiki\/domains\/\d+_hazard\.md/, "injected domain map from the generated wiki");
  assert.ok(bootstrap.includes("Preconditions:"), "states preconditions (init has run)");
});

test("skill generation: existing Codex skill is never overwritten (6)", async () => {
  const cwd = await makeProject("codex-keep-");
  await writeJson(path.join(cwd, "package.json"), { dependencies: { fastify: "^4.0.0" } });
  await mkdir(path.join(cwd, ".agents", "skills", "llm-wiki-bootstrap"), { recursive: true });
  await writeFile(path.join(cwd, ".agents", "skills", "llm-wiki-bootstrap", "SKILL.md"), "CUSTOM CODEX\n", { encoding: "utf8" });
  const result = await initCommand({ cwd, write: true, minimal: true, withAdapters: false, type: "backend", profiles: [], agents: ["codex"], existing: "skip" });
  assert.equal(await readFile(path.join(cwd, ".agents", "skills", "llm-wiki-bootstrap", "SKILL.md"), "utf8"), "CUSTOM CODEX\n", "existing codex skill preserved");
  assert.ok(result.skipped.some((l) => l.includes(".agents/skills/llm-wiki-bootstrap/SKILL.md") && l.includes("kept existing")), "skip is noted");
});

test("skill generation: --skills emits all four native formats including codex + bootstrap (9/10)", async () => {
  const cwd = await makeProject("skills-all-");
  await writeJson(path.join(cwd, "package.json"), { dependencies: { fastify: "^4.0.0" } });
  const result = await initCommand({ cwd, write: true, minimal: true, withAdapters: false, skills: true, type: "backend", profiles: [], agents: [], existing: "skip" });
  assert.equal(result.result, "pass");
  // 9: Claude skill + Cursor rule still generated. 10: neutral prompt still generated.
  for (const rel of [
    ".claude/skills/llm-wiki-bootstrap/SKILL.md",
    ".agents/skills/llm-wiki-bootstrap/SKILL.md",
    ".cursor/rules/llm-wiki-bootstrap.mdc",
    ".llm-wiki/prompts/llm-wiki-bootstrap.md",
    ".claude/skills/llm-wiki-feature/SKILL.md",
    ".cursor/rules/llm-wiki-fix.mdc",
    ".llm-wiki/prompts/llm-wiki-docs-sync.md"
  ]) {
    assert.ok(await fileExists(path.join(cwd, rel)), `${rel} created`);
  }
});

test("skill generation: existing calls that do not request skills are unchanged (11)", async () => {
  const cwd = await makeProject("skills-none-");
  await writeJson(path.join(cwd, "package.json"), { dependencies: { fastify: "^4.0.0" } });
  // A non-native-skill agent, no --skills: no skill artifacts at all.
  const result = await initCommand({ cwd, write: true, minimal: true, withAdapters: false, type: "backend", profiles: [], agents: ["copilot"], existing: "skip" });
  assert.ok(!(result.skillsCreated > 0), "no skills created");
  for (const dir of [".agents", ".claude", ".cursor", ".llm-wiki"]) {
    assert.equal(await fileExists(path.join(cwd, dir, "skills")), false, `no ${dir}/skills`);
  }
  assert.equal(await fileExists(path.join(cwd, ".llm-wiki", "prompts")), false, "no neutral prompts");
});

test("handoff and the bootstrap skill share the core initial-enrichment rules (12)", async () => {
  const cwd = await makeProject("bootstrap-share-");
  await writeJson(path.join(cwd, "package.json"), { dependencies: { fastify: "^4.0.0" } });
  const handoff = await handoffCommand({ cwd, dryRun: false, write: false, minimal: false, withAdapters: false, type: "backend", profiles: [], agents: ["codex"], existing: "skip" });
  const bootstrap = buildTaskPrompt({ task: "bootstrap", cwd: ".", projectType: "backend", profiles: [], agents: [] });
  assert.equal(bootstrap.result, "pass");

  // Both surfaces carry the same canonical rule sentences (single source: initialEnrichmentWorkflow).
  const shared = [
    "When a domain document mentions API usage, include this API Services inventory:",
    "Keep every created or edited wiki document at status: needs_review.",
    "Do not promote anything to verified — verified is human-approved only.",
    "Append docs/llm-wiki/log.md in append-only style"
  ];
  for (const line of shared) {
    assert.ok(handoff.handoff.prompt.includes(line), `handoff includes: ${line}`);
    assert.ok(bootstrap.prompt.includes(line), `bootstrap includes: ${line}`);
  }
  // The shared backend workflow chunk (identical entrypoint) is a substring of both.
  const core = initialEnrichmentWorkflow({ projectType: "backend", entrypoints: "the nearest AGENTS.md (or your agent's instruction file) and docs/llm-wiki/index.md" });
  assert.ok(bootstrap.prompt.includes(core), "bootstrap embeds the shared workflow verbatim");
  assert.ok(handoff.handoff.prompt.includes("Backend evidence focus:"), "handoff carries the shared evidence focus");
});

test("bootstrap is accepted as a public prompt task on the CLI (13)", async () => {
  const parsed = parseArgs(["prompt", "--task", "bootstrap", "--type", "backend", "--agent", "codex"]);
  assert.equal(parsed.command, "prompt");
  assert.equal(parsed.options.task, "bootstrap");
  assert.deepEqual(parsed.errors, []);

  const cwd = await makeProject("bootstrap-prompt-");
  await writeJson(path.join(cwd, "package.json"), { dependencies: { fastify: "^4.0.0" } });
  const result = await promptCommand({ cwd, task: "bootstrap", type: "backend", profiles: [], agents: ["codex"] });
  assert.equal(result.taskPrompt.result, "pass");
  assert.equal(result.taskPrompt.task, "bootstrap");
  assert.ok(result.taskPrompt.prompt.includes("bootstrapping an LLM-WIKI"), "renders the bootstrap workflow");
});

// --- Guided onboarding + task preparation (onboard / prepare) ---

async function backendWikiFixture(prefix) {
  const cwd = await makeProject(prefix);
  await writeFile(path.join(cwd, "requirements.txt"), "fastapi==0.110.0\n", { encoding: "utf8" });
  await mkdir(path.join(cwd, "app", "api", "v2", "endpoints"), { recursive: true });
  await writeFile(path.join(cwd, "app", "api", "v2", "endpoints", "hazard.py"), "from fastapi import APIRouter\nrouter = APIRouter()\n", { encoding: "utf8" });
  await initCommand({ cwd, write: true, minimal: false, withAdapters: false, type: "backend", profiles: [], agents: [], existing: "skip" });
  return cwd;
}

test("onboard assembles a read-only learning path on an initialized wiki", async () => {
  const cwd = await backendWikiFixture("onboard-");
  const indexBefore = await readFile(path.join(cwd, "docs", "llm-wiki", "index.md"), "utf8");

  const result = await onboardCommand({ cwd, type: "backend", profiles: [] });
  assert.equal(result.command, "onboard");
  assert.equal(result.initialized, true);
  assert.ok(result.documents.length > 0, "documents to read");
  assert.ok(result.comprehensionChecks.length >= 3, "comprehension checks");
  assert.ok(Array.isArray(result.sourceEntrypoints), "source entrypoints array");
  assert.ok(result.text.includes("Documents to read") && result.text.includes("Next step"), "sections rendered");
  // Read-only: a known doc is byte-identical afterwards.
  assert.equal(await readFile(path.join(cwd, "docs", "llm-wiki", "index.md"), "utf8"), indexBefore, "onboard writes nothing");
});

test("onboard on an uninitialized project guides to quickstart/init", async () => {
  const cwd = await makeProject("onboard-empty-");
  const result = await onboardCommand({ cwd, type: null, profiles: [] });
  assert.equal(result.initialized, false);
  assert.match(result.text, /quickstart|init/, "points at setup");
});

test("onboard --domain selects a work area; an unknown domain lists the available ones", async () => {
  const cwd = await backendWikiFixture("onboard-domain-");
  const hit = await onboardCommand({ cwd, type: "backend", profiles: [], domain: "hazard" });
  assert.equal(hit.domainFound, true, "known domain matched");
  assert.ok(hit.availableDomains.some((d) => /hazard/i.test(d.name)), "hazard is an available domain");

  const miss = await onboardCommand({ cwd, type: "backend", profiles: [], domain: "nope-not-a-domain" });
  assert.equal(miss.domainFound, false, "unknown domain not matched");
  assert.equal(miss.domainRequested, "nope-not-a-domain");
  assert.ok(miss.availableDomains.length >= 1, "still lists available domains");
  assert.ok(miss.text.includes("Domain not found") || miss.text.includes("업무 영역 없음"), "explicit not-found notice, not silent");
});

test("onboard surfaces needs_review freshness warnings and honors --lang ko", async () => {
  const cwd = await backendWikiFixture("onboard-fresh-");
  const en = await onboardCommand({ cwd, type: "backend", profiles: [] });
  // init-generated docs are needs_review, so the read path carries at least one.
  assert.ok(en.freshnessWarnings.length >= 1, "needs_review warnings surfaced");
  const ko = await onboardCommand({ cwd, type: "backend", profiles: [], lang: "ko" });
  assert.ok(ko.text.includes("다음 단계") || ko.text.includes("읽을 문서"), "KO guidance prose");
});

test("prepare requires --task and scopes a change read-only, non-asserting", async () => {
  const missing = parseArgs(["prepare"]);
  assert.ok(missing.errors.some((e) => /Missing required option for prepare: --task/.test(e)));
  const ok = parseArgs(["prepare", "--task", "fix the report severity"]);
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.options.task, "fix the report severity");

  const cwd = await backendWikiFixture("prepare-");
  const overviewBefore = await readFile(path.join(cwd, "docs", "llm-wiki", "index.md"), "utf8");
  const result = await prepareCommand({ cwd, task: "add a hazard endpoint field", type: "backend", profiles: [] });
  assert.equal(result.command, "prepare");
  assert.equal(result.task, "add a hazard endpoint field");
  assert.ok(Array.isArray(result.relevantDocs), "relevant docs array");
  assert.ok(result.scopeChecklist.length >= 4, "scope checklist");
  // Non-asserting phrasing: candidates, not conclusions.
  assert.ok(/verify before editing|candidate|후보/i.test(result.text), "candidate phrasing present");
  assert.ok(!/you must edit|this is the cause|this change is safe/i.test(result.text), "no asserting phrasing");
  assert.equal(await readFile(path.join(cwd, "docs", "llm-wiki", "index.md"), "utf8"), overviewBefore, "prepare writes nothing");
});

test("prepare excludes restricted/sensitive docs from its candidates", async () => {
  const cwd = await backendWikiFixture("prepare-restricted-");
  const rel = path.join("docs", "llm-wiki", "restricted-area.md");
  await writeFile(path.join(cwd, rel), "---\ntitle: Restricted Area\nstatus: needs_review\ndoc_type: reference\nvisibility: restricted\ncontains_sensitive_info: false\nlast_updated: 2026-07-23\n---\n# Restricted Area\nzuniquekeyword internals live here.\n", { encoding: "utf8" });
  const result = await prepareCommand({ cwd, task: "zuniquekeyword", type: "backend", profiles: [] });
  const paths = [...result.relevantDocs, ...result.relatedDocs].map((d) => d.path);
  assert.ok(!paths.some((p) => p.includes("restricted-area.md")), "restricted doc excluded from candidates");
});

test("prepare --compact returns a bounded single-call bundle (default output unchanged)", async () => {
  const cwd = await backendWikiFixture("prepare-compact-");
  // Default (non-compact) prepare is unchanged.
  const full = await prepareCommand({ cwd, task: "add a hazard endpoint field", type: "backend", profiles: [] });
  assert.ok(Array.isArray(full.relevantDocs), "full output has relevantDocs");
  assert.equal("compact" in full, false, "full output is not marked compact");

  const compact = await prepareCommand({ cwd, task: "add a hazard endpoint field", type: "backend", profiles: [], compact: true });
  assert.equal(compact.compact, true);
  assert.ok(["source_direct", "wiki_first", "hybrid"].includes(compact.path), "a path was chosen");
  assert.ok(compact.documents.length <= 3, "at most 3 docs in the bundle");
  assert.equal(typeof compact.estimatedTokens, "number");
  assert.ok(compact.nextLookup.length >= 1, "how to expand is provided");
  assert.ok(compact.documents.every((d) => "freshness" in d && "freshnessReason" in d), "per-doc freshness + reason");
  // The compact bundle's textual payload is smaller than the full report.
  assert.ok(compact.text.length < full.text.length, "compact bundle is smaller than the full report");
});

test("prepare --compact forces source reading on risk work and respects --max-chars", async () => {
  const cwd = await backendWikiFixture("prepare-compact-risk-");
  const risky = await prepareCommand({ cwd, task: "change the login password hashing", type: "backend", profiles: [], compact: true });
  assert.equal(risky.mustReadSource, true, "risk work must read source");
  assert.ok(risky.risk.includes("auth") || risky.risk.includes("crypto"), "risk categories surfaced");
  assert.notEqual(risky.path, "source_direct", "risky task not source_direct");

  const capped = await prepareCommand({ cwd, task: "add a hazard endpoint field", type: "backend", profiles: [], compact: true, maxChars: 40 });
  if (capped.topSection && !capped.topSection.noSectionMatch) {
    assert.ok(capped.topSection.body.length <= 40, "compact section body clamped to max-chars");
  }
});

test("onboard/prepare are exposed on the programmatic API and MCP (read-only)", async () => {
  assert.equal(typeof api.commands.onboard, "function");
  assert.equal(typeof api.commands.prepare, "function");
});

test("onboard/prepare skills are read-only (no run-manifest contract in the body)", async () => {
  const cwd = await makeProject("guided-skills-");
  await writeJson(path.join(cwd, "package.json"), { dependencies: { fastify: "^4.0.0" } });
  await initCommand({ cwd, write: true, minimal: true, withAdapters: false, skills: true, type: "backend", profiles: [], agents: [], existing: "skip" });
  for (const slug of ["llm-wiki-onboard", "llm-wiki-prepare"]) {
    const body = await readFile(path.join(cwd, ".claude", "skills", slug, "SKILL.md"), "utf8");
    assert.ok(body.includes(`name: ${slug}`), `${slug} frontmatter`);
    assert.ok(body.includes("Read-only workflow"), `${slug} read-only note`);
    assert.ok(!body.includes("changedSource") && !body.includes(".llm-wiki/runs/"), `${slug} carries no run-manifest contract`);
  }
  // The change skills still carry the manifest contract.
  const feature = await readFile(path.join(cwd, ".claude", "skills", "llm-wiki-feature", "SKILL.md"), "utf8");
  assert.ok(feature.includes("changedSource"), "feature skill keeps its completion contract");
  assert.ok(feature.includes("llm-wiki prepare") || feature.includes("llm-wiki-prepare"), "feature skill references prepare");
});

// --- Gate 27 (P4): findings message + explain KO localization ---

test("parseArgs accepts --lang ko|en globally and rejects unsupported languages", () => {
  const ok = parseArgs(["validate", "--lang", "ko"]);
  assert.equal(ok.options.lang, "ko");
  assert.equal(ok.errors.length, 0);
  const en = parseArgs(["audit", "--lang", "en"]);
  assert.equal(en.options.lang, "en");
  assert.equal(en.errors.length, 0);
  const bad = parseArgs(["validate", "--lang", "fr"]);
  assert.ok(bad.errors.some((e) => /Unsupported language/.test(e)), "rejects unsupported language");
  assert.equal(parseArgs(["validate"]).options.lang, null, "default lang is null (resolves to en downstream)");
});

test("localizeMessage interpolates KO, falls back for unknown ids, and never localizes en", () => {
  assert.equal(localizeMessage("source_files.missing", { source: "a.js" }, "ko"), "source_files 항목이 존재하지 않습니다: a.js.");
  assert.equal(localizeMessage("source_files.missing", { source: "a.js" }, "en"), null, "en never routes through the catalog");
  assert.equal(localizeMessage("no.such.id", {}, "ko"), null, "unknown id → caller keeps English");
  assert.equal(normalizeLang("fr"), "en", "unsupported lang resolves to en");
});

test("localizeFinding localizes message by messageId/rule and keeps rule/severity English", () => {
  const f = { severity: "warning", rule: "related.missing", path: "x", message: "related entry does not exist: y.", params: { target: "y" } };
  const ko = localizeFinding(f, "ko");
  assert.equal(ko.message, "related 항목이 존재하지 않습니다: y.");
  assert.equal(ko.rule, "related.missing", "rule id stays English");
  assert.equal(ko.severity, "warning");
  assert.equal(localizeFinding(f, "en"), f, "en returns the same reference (byte-identical)");
  const strict = { rule: "frontmatter.verified_review", messageId: "frontmatter.verified_review.strict", message: "..." };
  assert.match(localizeFinding(strict, "ko").message, /strict 모드/, "explicit messageId selects the strict KO variant");
});

test("applyRuleConfig localizes finding messages under --lang ko and stays byte-identical for en", () => {
  const raw = [{ severity: "warning", rule: "markdown_link.missing", path: "d.md", message: "Markdown link target does not exist: z.md.", params: { link: "z.md" } }];
  assert.equal(applyRuleConfig(raw, { lang: "en", rules: {} }), raw, "en + no rules → same reference");
  const ko = applyRuleConfig(raw, { lang: "ko", rules: {} });
  assert.equal(ko[0].message, "Markdown 링크 대상이 존재하지 않습니다: z.md.");
  assert.equal(ko[0].rule, "markdown_link.missing");
  const toggled = applyRuleConfig(raw, { lang: "ko", rules: { "markdown_link.missing": "error" } });
  assert.equal(toggled[0].severity, "error", "localization composes with rule severity override");
  assert.match(toggled[0].message, /링크 대상이 존재하지/);
});

test("explainCommand localizes prose for ko while keeping rule/category/commands English", async () => {
  const en = await explainCommand({ findingRule: "evidence.ungrounded", lang: "en" });
  const ko = await explainCommand({ findingRule: "evidence.ungrounded", lang: "ko" });
  assert.notEqual(ko.explanation.meaning, en.explanation.meaning, "prose is localized");
  assert.match(ko.explanation.meaning, /verified 문서/);
  assert.deepEqual(ko.explanation.commands, en.explanation.commands, "CLI commands stay English");
  assert.equal(ko.explanation.category, en.explanation.category, "category stays English");
  assert.match(ko.text, /## Finding/, "section chrome stays English in v1");
});

test("config lang is honored via mergeConfigIntoOptions and the CLI flag wins", () => {
  assert.equal(mergeConfigIntoOptions({ lang: null }, { lang: "ko" }).lang, "ko", "config fills lang when unset");
  assert.equal(mergeConfigIntoOptions({ lang: "en" }, { lang: "ko" }).lang, "en", "explicit option wins over config");
  assert.equal(mergeConfigIntoOptions({ lang: null }, { lang: "fr" }).lang, null, "invalid config lang ignored");
});

// ---------------------------------------------------------------------------
// Documentation language (--doc-lang / config docLanguage): generated wiki
// content is English by default; Korean is opt-in. `--doc-lang` (generated docs)
// is independent from `--lang` (findings/CLI prose).
// ---------------------------------------------------------------------------

const HANGUL = /[가-힣]/;
const BIN_PATH = fileURLToPath(new URL("../bin/llm-wiki.js", import.meta.url));

async function listWikiMarkdown(cwd) {
  const root = path.join(cwd, "docs", "llm-wiki");
  const out = [];
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith(".md")) out.push({ rel: path.relative(cwd, full), content: await readFile(full, "utf8") });
    }
  }
  await walk(root);
  return out;
}

async function setupBackendProject(prefix) {
  const cwd = await makeProject(prefix);
  await writeJson(path.join(cwd, "package.json"), { name: "doc-lang-fixture", dependencies: { express: "^4.0.0" } });
  await mkdir(path.join(cwd, "src", "modules", "user"), { recursive: true });
  await mkdir(path.join(cwd, "src", "modules", "billing"), { recursive: true });
  return cwd;
}

test("doc-lang #1/#2: default init generates English wiki with no Hangul anywhere", async () => {
  const cwd = await setupBackendProject("doclang-default-");
  await initCommand({ cwd, write: true, minimal: false, withAdapters: false, type: "backend", agents: ["claude"], profiles: ["okf-v0.1"], existing: "skip" });

  const docs = await listWikiMarkdown(cwd);
  assert.ok(docs.length >= 10, "a broad doc set was generated");
  const index = docs.find((d) => d.rel.endsWith("index.md")).content;
  assert.ok(index.includes("This document is the official entry point"), "index is English by default");

  const leaks = docs.filter((d) => HANGUL.test(d.content)).map((d) => d.rel);
  assert.deepEqual(leaks, [], `default generated docs must contain no Hangul; leaks: ${leaks.join(", ")}`);
});

test("doc-lang #3: --doc-lang ko generates Korean wiki documents", async () => {
  const cwd = await setupBackendProject("doclang-ko-");
  await initCommand({ cwd, write: true, minimal: false, withAdapters: false, type: "backend", agents: ["claude"], existing: "skip", docLang: "ko" });

  const docs = await listWikiMarkdown(cwd);
  const index = docs.find((d) => d.rel.endsWith("index.md")).content;
  assert.ok(index.includes("프로젝트 LLM-WIKI의 공식 진입점"), "index prose is Korean");
  const korean = docs.filter((d) => HANGUL.test(d.content));
  assert.ok(korean.length >= 6, `most docs are Korean under --doc-lang ko (got ${korean.length})`);
  // Technical identifiers are never translated, even in Korean mode.
  assert.ok(index.includes("status: needs_review") || index.includes("`needs_review`"), "status identifiers stay English");
});

test("doc-lang #4: --lang ko --doc-lang en gives Korean findings but English docs", async () => {
  const cwd = await setupBackendProject("doclang-mix-a-");
  await initCommand({ cwd, write: true, minimal: false, withAdapters: false, type: "backend", existing: "skip", lang: "ko", docLang: "en" });

  const docs = await listWikiMarkdown(cwd);
  assert.deepEqual(docs.filter((d) => HANGUL.test(d.content)).map((d) => d.rel), [], "docs stay English when docLang=en");

  const auditResult = await audit({ cwd, lang: "ko" });
  assert.ok(auditResult.findings.some((f) => HANGUL.test(f.message)), "findings are localized to Korean when lang=ko");
});

test("doc-lang #5: --lang en --doc-lang ko gives English findings but Korean docs", async () => {
  const cwd = await setupBackendProject("doclang-mix-b-");
  await initCommand({ cwd, write: true, minimal: false, withAdapters: false, type: "backend", existing: "skip", lang: "en", docLang: "ko" });

  const docs = await listWikiMarkdown(cwd);
  assert.ok(docs.some((d) => HANGUL.test(d.content)), "docs are Korean when docLang=ko");

  const auditResult = await audit({ cwd, lang: "en" });
  assert.ok(!auditResult.findings.some((f) => HANGUL.test(f.message)), "findings stay English when lang=en");
});

test("doc-lang #6: config docLanguage is applied (and resolves through resolveOptions)", async () => {
  // Unit: loadProjectConfig collects docLanguage; mergeConfigIntoOptions fills it.
  const cwd = await setupBackendProject("doclang-config-");
  await writeJson(path.join(cwd, "llm-wiki.config.json"), { docLanguage: "ko" });
  const { config, errors } = await loadProjectConfig(cwd);
  assert.deepEqual(errors, []);
  assert.equal(config.docLanguage, "ko");
  assert.equal(mergeConfigIntoOptions({ docLang: null }, config).docLang, "ko");

  // Integration: resolveOptions merges the file, then init writes Korean docs.
  const { options } = await api.resolveOptions({ cwd, write: true, type: "backend", existing: "skip" });
  assert.equal(options.docLang, "ko", "resolveOptions merged config docLanguage");
  await initCommand(options);
  const index = await readFile(path.join(cwd, "docs", "llm-wiki", "index.md"), "utf8");
  assert.ok(HANGUL.test(index), "config docLanguage:ko produced Korean docs");
});

test("doc-lang #7: CLI --doc-lang overrides config docLanguage", async () => {
  // Unit: explicit option wins over config.
  assert.equal(mergeConfigIntoOptions({ docLang: "en" }, { docLanguage: "ko" }).docLang, "en");
  assert.equal(parseArgs(["init", "--write", "--doc-lang", "en"]).options.docLang, "en");

  // Integration: config says ko, CLI says en -> English docs.
  const cwd = await setupBackendProject("doclang-override-");
  await writeJson(path.join(cwd, "llm-wiki.config.json"), { docLanguage: "ko" });
  const { options } = await api.resolveOptions({ cwd, write: true, type: "backend", existing: "skip", docLang: "en" });
  assert.equal(options.docLang, "en", "CLI docLang wins over config");
  await initCommand(options);
  const index = await readFile(path.join(cwd, "docs", "llm-wiki", "index.md"), "utf8");
  assert.ok(!HANGUL.test(index), "CLI --doc-lang en produced English docs despite config ko");
});

test("doc-lang #8: an invalid --doc-lang value is a usage error (exit code 3)", () => {
  assert.ok(parseArgs(["init", "--doc-lang", "fr"]).errors.some((e) => /documentation language/i.test(e)), "parseArgs reports the invalid value");
  let status = 0;
  try {
    execFileSync(process.execPath, [BIN_PATH, "init", "--doc-lang", "fr"], { stdio: "pipe" });
  } catch (err) {
    status = err.status;
  }
  assert.equal(status, 3, "the CLI exits 3 on an invalid --doc-lang");
});

test("doc-lang #9: per-domain docs are generated in English and Korean", async () => {
  const en = await setupBackendProject("doclang-domain-en-");
  await initCommand({ cwd: en, write: true, minimal: false, withAdapters: false, type: "backend", existing: "skip" });
  const enDomain = await readFile(path.join(en, "docs", "llm-wiki", "domains", "01_billing.md"), "utf8");
  assert.ok(enDomain.includes("This is a draft for the domain"), "English domain doc");
  assert.ok(!HANGUL.test(enDomain), "English domain doc has no Hangul");

  const ko = await setupBackendProject("doclang-domain-ko-");
  await initCommand({ cwd: ko, write: true, minimal: false, withAdapters: false, type: "backend", existing: "skip", docLang: "ko" });
  const koDomain = await readFile(path.join(ko, "docs", "llm-wiki", "domains", "01_billing.md"), "utf8");
  assert.ok(koDomain.includes("디렉터리 경계로 탐지한 도메인"), "Korean domain doc");
  assert.ok(koDomain.includes("- `src/modules/billing`"), "source directory identifier stays verbatim in Korean mode");
});

test("doc-lang #10: bootstrap/handoff/skills state the selected documentation language", () => {
  for (const task of ["bootstrap", "feature", "fix", "docs-sync"]) {
    assert.ok(buildTaskPrompt({ task, docLang: "en" }).prompt.includes("Documentation language:"), `${task} names the doc language`);
    assert.ok(buildTaskPrompt({ task, docLang: "en" }).prompt.includes("in English"), `${task} defaults to English`);
    assert.ok(buildTaskPrompt({ task, docLang: "ko" }).prompt.includes("in Korean"), `${task} honors Korean`);
  }
  assert.ok(initialEnrichmentWorkflow({ docLang: "ko" }).includes("in Korean"), "handoff/bootstrap shared workflow honors Korean");
  assert.ok(initialEnrichmentWorkflow({ docLang: "en" }).includes("in English"), "shared workflow defaults to English");
});

test("doc-lang #10b: generated skill artifacts embed the doc-language directive", async () => {
  const cwd = await setupBackendProject("doclang-skill-");
  await initCommand({ cwd, write: true, minimal: false, withAdapters: false, type: "backend", agents: ["claude"], existing: "skip", docLang: "ko" });
  const skill = await readFile(path.join(cwd, ".claude", "skills", "llm-wiki-bootstrap", "SKILL.md"), "utf8");
  assert.ok(skill.includes("Documentation language:") && skill.includes("in Korean"), "skill body carries the Korean directive");
});

test("doc-lang #11: --doc-lang ko never overwrites existing English wiki or skills", async () => {
  const cwd = await setupBackendProject("doclang-nooverwrite-");
  await initCommand({ cwd, write: true, minimal: false, withAdapters: false, type: "backend", agents: ["claude"], existing: "skip" });
  const indexBefore = await readFile(path.join(cwd, "docs", "llm-wiki", "index.md"), "utf8");
  const skillBefore = await readFile(path.join(cwd, ".claude", "skills", "llm-wiki-bootstrap", "SKILL.md"), "utf8");

  // A second run in Korean with the default skip policy must not touch existing files.
  await initCommand({ cwd, write: true, minimal: false, withAdapters: false, type: "backend", agents: ["claude"], existing: "skip", docLang: "ko" });
  assert.equal(await readFile(path.join(cwd, "docs", "llm-wiki", "index.md"), "utf8"), indexBefore, "existing English index preserved");
  assert.equal(await readFile(path.join(cwd, ".claude", "skills", "llm-wiki-bootstrap", "SKILL.md"), "utf8"), skillBefore, "existing skill preserved");
});

test("doc-lang #12: a run that does not request skills is unchanged by the feature", async () => {
  const cwd = await setupBackendProject("doclang-noskill-");
  await initCommand({ cwd, write: true, minimal: false, withAdapters: false, type: "backend", existing: "skip" });
  // No --agent / --skills => no skill or adapter artifacts.
  assert.equal(await fileExists(path.join(cwd, ".claude")), false, "no .claude skills without --agent/--skills");
  assert.equal(await fileExists(path.join(cwd, ".agents")), false, "no .agents skills");
  const index = await readFile(path.join(cwd, "docs", "llm-wiki", "index.md"), "utf8");
  assert.ok(!HANGUL.test(index), "default remains English");
});

test("doc-lang #13: generated content never embeds an absolute path or the local username", async () => {
  const cwd = await setupBackendProject("doclang-nopath-");
  await initCommand({ cwd, write: true, minimal: false, withAdapters: false, type: "backend", agents: ["claude"], existing: "skip", docLang: "ko" });
  const files = await listWikiMarkdown(cwd);
  const skill = await readFile(path.join(cwd, ".claude", "skills", "llm-wiki-bootstrap", "SKILL.md"), "utf8");
  const username = path.basename(os.homedir());
  for (const { rel, content } of [...files, { rel: ".claude/skills/llm-wiki-bootstrap/SKILL.md", content: skill }]) {
    assert.ok(!content.includes(cwd), `${rel} must not embed the absolute project path`);
    assert.ok(!content.includes(os.tmpdir()), `${rel} must not embed the temp dir path`);
    if (username && username.length > 2) assert.ok(!content.includes(username), `${rel} must not embed the local username`);
  }
});

test("doc-lang #14: Korean documents round-trip as valid UTF-8 (Windows-safe paths)", async () => {
  const cwd = await setupBackendProject("doclang-utf8-");
  await initCommand({ cwd, write: true, minimal: false, withAdapters: false, type: "backend", existing: "skip", docLang: "ko" });
  const raw = await readFile(path.join(cwd, "docs", "llm-wiki", "README.md")); // Buffer
  const text = raw.toString("utf8");
  assert.ok(text.includes("모든 wiki 문서는 YAML frontmatter를 가집니다"), "Korean content decodes cleanly (no mojibake)");
  assert.ok(!text.includes("�"), "no U+FFFD replacement characters");
});
