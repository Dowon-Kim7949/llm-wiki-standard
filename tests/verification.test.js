import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { audit, doctor, initCommand, migrateCommand, validateCommand, validateFrontmatterCommand } from "../src/commands.js";
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

test("parseArgs rejects unsupported existing policy", () => {
  const parsed = parseArgs(["init", "--write", "--existing", "merge"]);

  assert.deepEqual(parsed.errors, ["Unsupported existing policy: merge"]);
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
  const agents = await readFile(path.join(cwd, "AGENTS.md"), { encoding: "utf8" });

  assert.ok(index.includes("status: needs_review"));
  assert.ok(index.includes("# LLM-WIKI Index"));
  assert.ok(agents.includes("docs/llm-wiki/index.md"));
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

  const result = await audit({ cwd, type: null, format: "text", strict: false });

  assert.equal(result.detection.projectType, "backend");
  assert.ok(result.findings.some((finding) => finding.path === "docs/llm-wiki/API_CONTRACTS.md"));
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

test("migrate dry-run reports safe additions without writing files", async () => {
  const cwd = await makeProject("migrate-");
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "Existing wiki entry.");

  const result = await migrateCommand({ cwd, type: null, format: "text", strict: false, apply: false });

  assert.equal(result.dryRun, true);
  assert.ok(result.safeAdds.length > 0);
  assert.equal(result.text.includes("No files were written"), true);
});

test("migrate apply is blocked pending Gate 4", async () => {
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
});

test("sensitive findings omit raw values", async () => {
  const cwd = await makeProject("sensitive-");
  await writeWikiDoc(cwd, "index.md", "LLM-WIKI Index", "API_TOKEN=very-secret-token-value");

  const result = await audit({ cwd, type: null, format: "text", strict: false });
  const serialized = JSON.stringify(result);

  assert.ok(result.findings.some((finding) => finding.rule === "sensitive.redacted"));
  assert.equal(serialized.includes("very-secret-token-value"), false);
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

test("doctor reports package prerelease readiness for package roots", async () => {
  const cwd = await makeProject("doctor-package-");
  await writeJson(path.join(cwd, "package.json"), {
    name: "@company/llm-wiki-standard",
    version: "0.0.0-needs-review",
    private: true,
    bin: { "llm-wiki": "./bin/llm-wiki.js" }
  });
  await writeFile(path.join(cwd, "PRERELEASE_CHECKLIST.md"), "# Checklist\n", { encoding: "utf8" });

  const result = await doctor({ cwd, type: null, profiles: [], format: "text" });

  assert.ok(result.packageReadiness.some((line) => line.includes("package_name: @company/llm-wiki-standard")));
  assert.ok(result.text.includes("Package Prerelease Readiness"));
});

test("package metadata targets npmjs public publish without committed tokens", async () => {
  const packageJson = JSON.parse(await readFile(path.join(process.cwd(), "package.json"), { encoding: "utf8" }));

  assert.equal(packageJson.name, "@dowonk-7949/llm-wiki-standard");
  assert.equal(packageJson.version, "0.0.1-internal.4");
  assert.equal(packageJson.private, false);
  assert.equal(packageJson.publishConfig, undefined);
  assert.equal(packageJson.repository.url, "git+https://github.com/Dowon-Kim7949/llm-wiki-standard.git");
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
  const wikiRoot = path.join(cwd, "docs", "llm-wiki");
  await mkdir(wikiRoot, { recursive: true });
  await writeFile(path.join(wikiRoot, filename), frontmatter(title, body), { encoding: "utf8" });
}

function frontmatter(title, body) {
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
related:
  - docs/llm-wiki/log.md
visibility: internal
contains_sensitive_info: false
---

# ${title}

${body}
`;
}

