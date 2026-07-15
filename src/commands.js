import { mkdir, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CORE_REQUIRED_DOCS, CURRENT_WIKI_BLOCK_VERSION, JSON_SCHEMA_VERSION, PROFILE_DOCS, VALID_STATUSES } from "./config.js";
import { detectProject, detectWorkspaces } from "./detector.js";
import { findMojibakeIndicators, hasUtf8Bom, readUtf8, writeUtf8 } from "./encoding.js";
import { listMarkdownFiles, pathExists, toPosix } from "./files.js";
import { CONFIG_FILENAME, loadProjectConfig, mergeConfigIntoOptions } from "./config-file.js";
import { hasRequiredField, parseFrontmatter, validateFrontmatter } from "./frontmatter.js";
import { schemaRequiredFields } from "./frontmatter-schema.js";
import { renderTextReport } from "./report.js";
import { scanSensitiveInfo } from "./sensitive-info.js";
import { renderTemplate, renderWikiDocumentTemplate, todayIsoDate } from "./template-renderer.js";
import { apiServiceInventoryChecklist, buildTaskPrompt } from "./task-prompts.js";
import { buildReleaseNotes, buildReleaseNotesBody, collectCommits } from "./release-notes.js";
import { fileChangedSince, lineRangeChangedSince, changedFiles } from "./git.js";
import { buildDomainContext, emptyDomainContext } from "./commands/domains.js";
import { docMetadata } from "./commands/doc-templates.js";
import {
  addWikiLinkTarget,
  escapeRegex,
  extractMarkdownLinkTargets,
  extractMarkdownSection,
  extractWikiLinkTargets,
  getLineCount,
  isExternalSourceReference,
  isSkippedMarkdownLink,
  normalizeMarkdownLinkTarget,
  normalizeWikiLinkKey,
  normalizeWikiLinkTarget,
  parseEvidenceReference,
  resolveMarkdownLinkTarget
} from "./commands/references.js";
import {
  applyRuleConfig,
  FINDING_EXPLANATIONS,
  findingCategory,
  formatFinding,
  formatFindingSummary,
  formatNextActions,
  formatStatusCounts,
  formatWikiGraphSummary,
  normalizeExplainRule,
  summarizeFindings,
  withText
} from "./commands/findings.js";
import {
  collectWikiGraph,
  emptyWikiGraph,
  renderGraphDot,
  renderGraphMermaid
} from "./commands/wiki-graph.js";
import { isAppendOnlyLog, listTargetMarkdown, listWikiContentDocs } from "./commands/wiki-files.js";
import {
  ADAPTER_TARGETS,
  planAdapterSuggestions,
  scanAdapters,
  selectedAgents,
  summarizeAdapterStatus,
  writeAdapterFiles
} from "./commands/adapters.js";
export { detectDomainDirectories, domainDisplayName, normalizeDomainSlug, planDomainDocs } from "./commands/domains.js";

export async function doctor(options) {
  const cwd = options.cwd;
  const detection = await detectProject(cwd, options.type, options.profiles);
  const wikiExists = await pathExists(path.join(cwd, "docs", "llm-wiki", "index.md"));
  const configState = await describeEffectiveConfig(cwd);
  const packageManager = await detectPackageManager(cwd);
  const packageReadiness = await inspectPackageReadiness(cwd);
  const blockVersions = wikiExists ? await analyzeBlockVersions(cwd) : null;

  const checks = [
    `node: ${process.version}`,
    `platform: ${os.platform()} ${os.release()}`,
    `cwd: ${cwd}`,
    `package_manager: ${packageManager ?? "not detected"}`,
    `wiki_entry: ${wikiExists ? "present" : "missing"}`,
    blockVersions
      ? `wiki_block_version: current=${blockVersions.current}, gap=${blockVersionGapDocs(blockVersions).length}/${blockVersions.docs.length} docs${blockVersionGapDocs(blockVersions).length ? " (run migrate --dry-run)" : ""}`
      : `wiki_block_version: current=${CURRENT_WIKI_BLOCK_VERSION}`,
    `llm_wiki_config: ${configState}`,
    `project_type: ${detection.projectType} (${detection.confidence})`,
    "utf8_policy: explicit read/write helpers enabled",
    "migration_apply: enabled (GATE_REVIEW Gate 8; preview-first, verified-preserving)"
  ];

  const sections = [{ title: "Checks", body: checks }];
  if (packageReadiness.length > 0) {
    sections.push({ title: "Package Release Readiness", body: packageReadiness });
  }

  return withText({
    command: "doctor",
    checks,
    detection,
    packageReadiness
  }, "LLM-WIKI Doctor", sections);
}

// Echoes the effective project config (llm-wiki.config.json) for doctor so the
// config the CLI/programmatic-API/MCP surfaces merge is observable: "absent",
// "present (type=..., profiles=..., agents=..., strict=on)", or a "present
// (invalid: N error(s))" note when the file is malformed.
async function describeEffectiveConfig(cwd) {
  const { found, config, errors } = await loadProjectConfig(cwd);
  if (!found) return "absent";
  if (errors.length > 0) return `present (invalid: ${errors.length} error${errors.length === 1 ? "" : "s"})`;
  const parts = [];
  if (config.type != null) parts.push(`type=${config.type}`);
  if (Array.isArray(config.profiles) && config.profiles.length > 0) parts.push(`profiles=${config.profiles.join("+")}`);
  if (Array.isArray(config.agents) && config.agents.length > 0) parts.push(`agents=${config.agents.join("+")}`);
  if (config.strict) parts.push("strict=on");
  if (config.rules && typeof config.rules === "object" && Object.keys(config.rules).length > 0) {
    parts.push(`rules=${Object.keys(config.rules).length}`);
  }
  if (Array.isArray(config.requiredDocs) && config.requiredDocs.length > 0) {
    parts.push(`requiredDocs=${config.requiredDocs.length}`);
  }
  if (config.templates && typeof config.templates === "object" && Object.keys(config.templates).length > 0) {
    parts.push(`templates=${Object.keys(config.templates).length}`);
  }
  return parts.length > 0 ? `present (${parts.join(", ")})` : "present (no keys set)";
}

export async function validateFrontmatterCommand(options) {
  const markdownFiles = await listTargetMarkdown(options.cwd);
  const raw = [];

  for (const file of markdownFiles) {
    const rel = toPosix(path.relative(options.cwd, file));
    const content = await readUtf8(file);
    const parsed = parseFrontmatter(content);

    for (const message of parsed.errors) {
      raw.push({ severity: "error", rule: "frontmatter.parse", path: rel, message });
    }
    for (const finding of validateFrontmatter(parsed.frontmatter, { strict: options.strict })) {
      raw.push({ ...finding, path: rel });
    }
  }

  const findings = applyRuleConfig(raw, options);
  const summary = [
    `files_checked: ${markdownFiles.length}`,
    `findings: ${findings.length}`,
    `result: ${findings.some((finding) => finding.severity === "error") ? "fail" : "pass"}`
  ];
  const findingSummary = summarizeFindings(findings);

  return withText({
    command: "validate-frontmatter",
    summary,
    findingSummary,
    findings
  }, "LLM-WIKI Frontmatter Validation", [
    { title: "Summary", body: summary },
    { title: "Finding Summary", body: formatFindingSummary(findingSummary) },
    { title: "Findings", body: findings.map(formatFinding) }
  ]);
}

export async function statusCommand(options) {
  const detection = await detectProject(options.cwd, options.type, options.profiles);
  const agents = selectedAgents(options);
  const wikiEntry = path.join(options.cwd, "docs", "llm-wiki", "index.md");
  const initialized = await pathExists(wikiEntry);
  const markdownFiles = initialized
    ? await listMarkdownFiles(path.join(options.cwd, "docs", "llm-wiki"))
    : [];
  const documentStatus = await summarizeDocumentStatuses(options.cwd, markdownFiles);
  const detectionFindings = detection.reviewItems.map((message) => ({
    severity: "warning",
    rule: "project.review_item",
    path: ".",
    message
  }));
  const structureFindings = await findMissingDocs(options.cwd, detection.projectType, options.profiles, options.requiredDocs);
  const sourceFileFindings = await scanSourceFiles(options.cwd);
  const relatedFindings = await scanRelatedReferences(options.cwd);
  const enrichmentFindings = await scanEnrichment(options.cwd);
  const evidenceFindings = await scanEvidenceReferences(options.cwd, { strict: options.strict });
  const evidenceSectionFindings = await scanEvidenceSections(options.cwd, { strict: options.strict });
  const driftFindings = await scanEvidenceDrift(options.cwd);
  const okfFindings = await scanOkfProfile(options.cwd, detection.activeProfiles);
  const wikiGraph = await collectWikiGraph(options.cwd);
  const linkFindings = [
    ...(await scanMarkdownLinks(options.cwd)),
    ...wikiGraph.findings
  ];
  const adapterFindings = await scanAdapters(options.cwd, agents);
  const thinBodyFindings = await scanThinBody(options.cwd, options);
  const visibilityFindings = await scanVisibilityConsistency(options.cwd, options);
  const findings = applyRuleConfig([
    ...detectionFindings,
    ...documentStatus.findings,
    ...thinBodyFindings,
    ...visibilityFindings,
    ...structureFindings,
    ...sourceFileFindings,
    ...relatedFindings,
    ...enrichmentFindings,
    ...evidenceFindings,
    ...evidenceSectionFindings,
    ...driftFindings,
    ...okfFindings,
    ...linkFindings,
    ...adapterFindings
  ], options);
  const result = findings.some((finding) => finding.severity === "blocked")
    ? "blocked"
    : findings.some((finding) => finding.severity === "error")
      ? "fail"
      : findings.some((finding) => finding.severity === "warning")
        ? "warning"
        : "pass";
  const adapterStatus = await summarizeAdapterStatus(options.cwd, agents);
  const summary = [
    `result: ${result}`,
    `initialized: ${initialized ? "yes" : "no"}`,
    `project_type: ${detection.projectType}`,
    `confidence: ${detection.confidence}`,
    `active_profiles: ${detection.activeProfiles.join(", ")}`,
    `selected_agents: ${agents.length ? agents.join(", ") : "none"}`,
    `wiki_docs: ${markdownFiles.length}`,
    `missing_required_docs: ${structureFindings.filter((finding) => finding.rule === "structure.required_doc").length}`,
    `findings: ${findings.length}`
  ];
  const findingSummary = summarizeFindings(findings);

  return withText({
    command: "status",
    result,
    initialized,
    detection,
    documentStatus,
    adapterStatus,
    wikiGraph,
    findingSummary,
    findings
  }, "LLM-WIKI Status", [
    { title: "Summary", body: summary },
    { title: "Document Statuses", body: formatStatusCounts(documentStatus.counts) },
    { title: "Adapters", body: adapterStatus.length ? adapterStatus : ["none selected"] },
    { title: "Wiki Graph", body: formatWikiGraphSummary(wikiGraph) },
    { title: "Finding Summary", body: formatFindingSummary(findingSummary) },
    { title: "Findings", body: findings.map(formatFinding) },
    { title: "Next Steps", body: statusNextSteps(initialized, documentStatus.counts, findings, agents) }
  ]);
}

export async function nextCommand(options) {
  const auditResult = await audit(options);
  const actions = buildNextActions(auditResult, options);
  const result = actions.some((action) => action.priority === "blocked")
    ? "blocked"
    : actions.some((action) => action.priority === "high")
      ? "action_required"
      : actions.length > 0
        ? "ready"
        : "pass";
  const summary = [
    `result: ${result}`,
    `project_type: ${auditResult.detection.projectType}`,
    `confidence: ${auditResult.detection.confidence}`,
    `active_profiles: ${auditResult.detection.activeProfiles.join(", ")}`,
    `selected_agents: ${selectedAgents(options).join(", ") || "none"}`,
    `audit_findings: ${auditResult.findings.length}`,
    `recommended_actions: ${actions.length}`
  ];

  return withText({
    command: "next",
    result,
    detection: auditResult.detection,
    wikiGraph: auditResult.wikiGraph,
    auditFindingSummary: auditResult.findingSummary,
    auditFindings: auditResult.findings,
    actions,
    findings: []
  }, "LLM-WIKI Next Actions", [
    { title: "Summary", body: summary },
    { title: "Recommended Actions", body: formatNextActions(actions) },
    { title: "Wiki Graph", body: formatWikiGraphSummary(auditResult.wikiGraph) },
    { title: "Caveats", body: ["This command is advisory and does not write files. Run validate or audit when you need pass/fail validation."] }
  ]);
}

export async function explainCommand(options) {
  const rule = normalizeExplainRule(options.findingRule);
  const explanation = FINDING_EXPLANATIONS[rule];

  if (!explanation) {
    const knownRules = Object.keys(FINDING_EXPLANATIONS).sort();
    return withText({
      command: "explain",
      result: "blocked",
      findingRule: rule,
      knownRules,
      findings: [{
        severity: "blocked",
        rule: "explain.unknown_rule",
        path: ".",
        message: `No explanation is registered for finding rule: ${rule}.`
      }]
    }, "LLM-WIKI Finding Explanation", [
      { title: "Blocked", body: [`No explanation is registered for finding rule: ${rule}.`] },
      { title: "Known Rules", body: knownRules }
    ]);
  }

  const sections = [
    { title: "Finding", body: [`rule: ${rule}`, `category: ${explanation.category}`, `default_severity: ${explanation.defaultSeverity}`] },
    { title: "Meaning", body: [explanation.meaning] },
    { title: "Why It Matters", body: [explanation.whyItMatters] },
    { title: "Remediation", body: explanation.remediation },
    { title: "Useful Commands", body: explanation.commands },
    { title: "Related Rules", body: explanation.relatedRules.length ? explanation.relatedRules : ["none"] }
  ];

  return withText({
    command: "explain",
    result: "pass",
    findingRule: rule,
    explanation,
    findings: []
  }, "LLM-WIKI Finding Explanation", sections);
}

export async function audit(options) {
  const detection = await detectProject(options.cwd, options.type, options.profiles);
  const agents = selectedAgents(options);
  const frontmatter = await validateFrontmatterCommand(options);
  const detectionFindings = detection.reviewItems.map((message) => ({
    severity: "warning",
    rule: "project.review_item",
    path: ".",
    message
  }));
  const structureFindings = await findMissingDocs(options.cwd, detection.projectType, options.profiles, options.requiredDocs);
  const encodingFindings = await scanEncoding(options.cwd);
  const sensitiveFindings = await scanSensitive(options.cwd);
  const sourceFileFindings = await scanSourceFiles(options.cwd);
  const relatedFindings = await scanRelatedReferences(options.cwd);
  const enrichmentFindings = await scanEnrichment(options.cwd);
  const evidenceFindings = await scanEvidenceReferences(options.cwd, { strict: options.strict });
  const evidenceSectionFindings = await scanEvidenceSections(options.cwd, { strict: options.strict });
  const driftFindings = await scanEvidenceDrift(options.cwd);
  const okfFindings = await scanOkfProfile(options.cwd, detection.activeProfiles);
  const wikiGraph = await collectWikiGraph(options.cwd);
  const linkFindings = [
    ...(await scanMarkdownLinks(options.cwd)),
    ...wikiGraph.findings
  ];
  const adapterFindings = await scanAdapters(options.cwd, agents);
  const thinBodyFindings = await scanThinBody(options.cwd, options);
  const visibilityFindings = await scanVisibilityConsistency(options.cwd, options);

  const findings = applyRuleConfig([
    ...detectionFindings,
    ...structureFindings,
    ...frontmatter.findings,
    ...thinBodyFindings,
    ...visibilityFindings,
    ...encodingFindings,
    ...sensitiveFindings,
    ...sourceFileFindings,
    ...relatedFindings,
    ...enrichmentFindings,
    ...evidenceFindings,
    ...evidenceSectionFindings,
    ...driftFindings,
    ...okfFindings,
    ...linkFindings,
    ...adapterFindings
  ], options);

  const result = findings.some((finding) => finding.severity === "blocked")
    ? "blocked"
    : findings.some((finding) => finding.severity === "error")
      ? "fail"
      : findings.some((finding) => finding.severity === "warning")
        ? "warning"
        : "pass";

  const summary = [
    `result: ${result}`,
    `project_type: ${detection.projectType}`,
    `confidence: ${detection.confidence}`,
    `active_profiles: ${detection.activeProfiles.join(", ")}`,
    `selected_agents: ${agents.length ? agents.join(", ") : "none"}`,
    `findings: ${findings.length}`
  ];
  const findingSummary = summarizeFindings(findings);

  return withText({
    command: "audit",
    result,
    detection,
    wikiGraph,
    findingSummary,
    findings
  }, "LLM-WIKI Audit", [
    { title: "Summary", body: summary },
    { title: "Wiki Graph", body: formatWikiGraphSummary(wikiGraph) },
    { title: "Finding Summary", body: formatFindingSummary(findingSummary) },
    { title: "Findings", body: findings.map(formatFinding) },
    { title: "Caveats", body: ["Stable validation is warning-friendly by default; use --strict when warnings should fail CI."] }
  ]);
}

// Monorepo profile (1.10, GATE_REVIEW Gate 15): opt-in per-package validation.
// Detects npm/yarn workspace packages, runs the cwd-parameterized validate over
// each package that has docs/llm-wiki/, and aggregates. Each package honors its
// own llm-wiki.config.json (loaded per package). Read-only. The additive
// `packages[]` (per-package roll-up) and flattened, package-prefixed `findings`
// appear only in this command, so single-repo command output is unchanged.
export async function monorepoCommand(options) {
  const { packages, unsupported } = await detectWorkspaces(options.cwd);
  const packageResults = [];
  const skipped = [];
  const findings = [];
  for (const pkgRel of packages) {
    const pkgPosix = toPosix(pkgRel);
    const pkgCwd = path.join(options.cwd, pkgRel);
    if (!(await pathExists(path.join(pkgCwd, "docs", "llm-wiki")))) {
      skipped.push(`${pkgPosix}: no docs/llm-wiki`);
      continue;
    }
    const pkgOptions = { ...options, cwd: pkgCwd, type: null, profiles: [], rules: {}, requiredDocs: [], templates: {} };
    const { config, errors: configErrors } = await loadProjectConfig(pkgCwd);
    if (configErrors.length === 0) mergeConfigIntoOptions(pkgOptions, config);
    const validateResult = await validateCommand(pkgOptions);
    const pkgFindings = (validateResult.findings ?? []).map((finding) => ({ ...finding, path: `${pkgPosix}::${finding.path}` }));
    findings.push(...pkgFindings);
    packageResults.push({
      path: pkgPosix,
      result: validateResult.result ?? "pass",
      findings: pkgFindings.length,
      configError: configErrors.length > 0
    });
  }
  const result = findings.some((finding) => finding.severity === "blocked")
    ? "blocked"
    : findings.some((finding) => finding.severity === "error")
      ? "fail"
      : findings.some((finding) => finding.severity === "warning")
        ? "warning"
        : "pass";
  const summary = [
    `result: ${result}`,
    `workspaces_detected: ${packages.length}`,
    `wiki_packages: ${packageResults.length}`,
    `skipped: ${skipped.length}`,
    `findings: ${findings.length}`
  ];
  if (unsupported) summary.push(`unsupported: ${unsupported}`);

  return withText({
    command: "monorepo",
    result,
    packages: packageResults,
    skipped,
    unsupported: unsupported ?? null,
    findings
  }, "LLM-WIKI Monorepo", [
    { title: "Summary", body: summary },
    { title: "Packages", body: packageResults.length ? packageResults.map((pkg) => `${pkg.path}: ${pkg.result} (${pkg.findings} findings${pkg.configError ? "; config error" : ""})`) : ["no workspace packages with docs/llm-wiki"] },
    { title: "Skipped", body: skipped.length ? skipped : ["none"] },
    { title: "Caveats", body: ["Per-package validate; each package honors its own llm-wiki.config.json. npm/yarn workspaces only (pnpm/YAML deferred — see unsupported). Read-only aggregation."] }
  ]);
}

export async function validateCommand(options) {
  const auditResult = await audit(options);
  let findings = auditResult.findings ?? [];
  let changedScope = null;

  if (options.changed) {
    let changed = null;
    try {
      changed = changedFiles(options.cwd, options.since);
    } catch {
      changed = null;
    }
    if (!changed) {
      findings = [{
        severity: "error",
        rule: "changed.unavailable",
        path: ".",
        message: "--changed requires a git repository; could not determine changed files."
      }];
      changedScope = "unavailable";
    } else {
      const changedSet = new Set(changed);
      findings = findings.filter((finding) => changedSet.has(finding.path));
      changedScope = `${changed.length} changed file(s)`;
    }
  }

  const result = findings.some((finding) => finding.severity === "blocked")
    ? "blocked"
    : findings.some((finding) => finding.severity === "error")
      ? "fail"
      : findings.some((finding) => finding.severity === "warning")
        ? "warning"
        : "pass";
  const summary = [
    `result: ${result}`,
    `mode: ${options.strict ? "strict" : "standard"}`,
    ...(options.changed ? [`scope: changed${options.since ? ` since ${options.since}` : ""} (${changedScope})`] : []),
    `project_type: ${auditResult.detection.projectType}`,
    `confidence: ${auditResult.detection.confidence}`,
    `active_profiles: ${auditResult.detection.activeProfiles.join(", ")}`,
    `selected_agents: ${selectedAgents(options).join(", ") || "none"}`,
    `findings: ${findings.length}`
  ];
  const findingSummary = summarizeFindings(findings);

  return withText({
    command: "validate",
    result,
    scopedToChanged: options.changed ? true : undefined,
    detection: auditResult.detection,
    wikiGraph: auditResult.wikiGraph,
    findingSummary,
    findings
  }, "LLM-WIKI Validation", [
    { title: "Summary", body: summary },
    { title: "Wiki Graph", body: formatWikiGraphSummary(auditResult.wikiGraph) },
    { title: "Finding Summary", body: formatFindingSummary(findingSummary) },
    { title: "Findings", body: findings.map(formatFinding) },
    { title: "Caveats", body: [
      "Validation reuses audit coverage for core, profile, selected-agent adapter, encoding, and sensitive-information checks.",
      ...(options.changed ? ["--changed reports only findings on files changed vs the baseline; cross-document checks still run over the whole wiki. Run it from the repo root."] : [])
    ] }
  ]);
}

export async function quickstartCommand(options) {
  if (options.dryRun && options.write) {
    return blockedApply("quickstart", "Choose either quickstart --dry-run or quickstart --write. The two modes cannot be used together.");
  }

  if (!options.dryRun && !options.write) {
    return blockedApply("quickstart", "Use quickstart --dry-run to preview setup or quickstart --write to create missing LLM-WIKI files and print the Codex/Claude Code handoff prompt.");
  }

  const doctorResult = await doctor(options);
  const initResult = await initCommand(options);
  const frontmatterResult = options.write
    ? await validateFrontmatterCommand(options)
    : null;
  const handoff = buildHandoff(options, doctorResult.detection);
  const findings = [
    ...(initResult.findings ?? []),
    ...(frontmatterResult?.findings ?? []),
    ...handoff.findings
  ];
  const result = findings.some((finding) => finding.severity === "blocked")
    ? "blocked"
    : findings.some((finding) => finding.severity === "error")
      ? "fail"
      : findings.some((finding) => finding.severity === "warning")
        ? "warning"
        : "pass";
  const completedSteps = [
    "doctor completed.",
    options.write ? "init --write completed." : "init --dry-run completed.",
    options.write ? "validate-frontmatter completed." : "validate-frontmatter skipped because no files were written.",
    "handoff prompt prepared."
  ];

  return withText({
    command: "quickstart",
    dryRun: options.dryRun,
    write: options.write,
    result,
    doctor: {
      checks: doctorResult.checks,
      detection: doctorResult.detection,
      packageReadiness: doctorResult.packageReadiness
    },
    init: initResult,
    frontmatter: frontmatterResult,
    handoff,
    findings
  }, "LLM-WIKI Quickstart", [
    { title: "Completed Steps", body: completedSteps },
    { title: "Init Summary", body: quickstartInitSummary(initResult) },
    { title: "Frontmatter Summary", body: frontmatterResult?.summary ?? ["not run"] },
    { title: "Next Step", body: [handoff.message] },
    { title: "Handoff Prompt", body: `\`\`\`text\n${handoff.prompt}\n\`\`\`` },
    { title: "Caveats", body: ["CLI-created or CLI-edited wiki documents remain needs_review until human review. Run llm-wiki validate separately for structure or CI validation."] }
  ]);
}

export async function handoffCommand(options) {
  const detection = await detectProject(options.cwd, options.type, options.profiles);
  const handoff = buildHandoff(options, detection);
  const result = handoff.findings.some((finding) => finding.severity === "blocked") ? "blocked" : "pass";

  return withText({
    command: "handoff",
    result,
    detection,
    handoff,
    findings: handoff.findings
  }, "LLM-WIKI Handoff", [
    { title: "Next Step", body: [handoff.message] },
    { title: "Handoff Prompt", body: `\`\`\`text\n${handoff.prompt}\n\`\`\`` },
    { title: "Caveats", body: ["Run this prompt in the selected agent after CLI setup. Keep generated or edited documents as needs_review until human review."] }
  ]);
}

export async function promptCommand(options) {
  const detection = await detectProject(options.cwd, options.type, options.profiles);
  const taskPrompt = buildTaskPrompt({
    task: options.task,
    cwd: options.cwd,
    projectType: detection.projectType,
    profiles: detection.activeProfiles,
    agents: selectedAgents(options)
  });

  if (taskPrompt.result === "blocked") {
    return withText({
      command: "prompt",
      result: "blocked",
      detection,
      taskPrompt,
      findings: taskPrompt.findings
    }, "LLM-WIKI Task Prompt Blocked", [
      { title: "Blocked", body: taskPrompt.findings.map(formatFinding) }
    ]);
  }

  return withText({
    command: "prompt",
    result: "pass",
    detection,
    taskPrompt,
    findings: taskPrompt.findings
  }, "LLM-WIKI Task Prompt", [
    { title: "Task", body: [`task: ${taskPrompt.task}`, `project_type: ${taskPrompt.projectType}`, `active_profiles: ${taskPrompt.profiles.join(", ") || "none"}`, `selected_agents: ${taskPrompt.agents.join(", ")}`] },
    { title: "Prompt", body: `\`\`\`text\n${taskPrompt.prompt}\n\`\`\`` },
    { title: "Caveats", body: ["Run this prompt in the selected agent after the initial LLM-WIKI is created and enriched. AI-edited wiki documents remain needs_review until human review."] }
  ]);
}

export async function releaseNotesCommand(options) {
  let packageJson = {};
  try {
    packageJson = JSON.parse(await readUtf8(path.join(options.cwd, "package.json")));
  } catch {
    packageJson = {};
  }

  const version = options.version ?? packageJson.version ?? "0.0.0";
  const project = String(packageJson.name ?? path.basename(options.cwd) ?? "project").replace(/^@[^/]+\//, "");
  const date = todayIsoDate();
  const { commits, gitAvailable } = collectCommits(options.cwd, { since: options.since });

  // --body-only emits just the change-section body (no frontmatter/title/scaffold),
  // for use as a GitHub Release body. Because commit subjects flow verbatim into the
  // body, scan it for sensitive-looking values and BLOCK rather than leak one into a
  // public release (Gate 12). On stdout the blocked result never prints the body.
  if (options.bodyOnly) {
    const body = buildReleaseNotesBody({ commits, gitAvailable });
    const sensitive = scanSensitiveInfo(body);
    const base = {
      schemaVersion: JSON_SCHEMA_VERSION,
      command: "release-notes",
      version,
      project,
      since: options.since ?? null,
      commitCount: commits.length,
      gitAvailable,
      bodyOnly: true
    };
    if (sensitive.length > 0) {
      return {
        ...base,
        result: "blocked",
        document: null,
        text: `Refusing to emit release body: ${sensitive.length} sensitive-looking value(s) detected in the generated notes. Rewrite the offending commit subject(s) and retry.`,
        findings: sensitive.map((finding) => ({
          severity: "blocked",
          rule: "sensitive.release_body",
          path: `release-body:${finding.line}`,
          message: finding.message
        }))
      };
    }
    return { ...base, result: "pass", document: body, text: body, findings: [] };
  }

  const document = buildReleaseNotes({ version, date, project, commits, gitAvailable });

  return {
    schemaVersion: JSON_SCHEMA_VERSION,
    command: "release-notes",
    result: "pass",
    version,
    project,
    since: options.since ?? null,
    commitCount: commits.length,
    gitAvailable,
    document,
    text: document,
    findings: []
  };
}

// Scaffolds a minimal starter llm-wiki.config.json at the project root for
// init/quickstart. Additive and preview-first, and NEVER overwrites an existing
// file (a project's config is user-owned, like the append-only log) — so it is
// skipped even under --existing overwrite. Seeds the detected type and selected
// agents so the file is useful immediately; unknown/empty fields are left out.
// Returns { planned, created, skipped } message arrays for the init report.
async function scaffoldProjectConfig(cwd, detection, agents, { write }) {
  if (await pathExists(path.join(cwd, CONFIG_FILENAME))) {
    return { planned: [], created: [], skipped: [`${CONFIG_FILENAME} exists; kept existing config (never overwritten).`] };
  }
  const config = {};
  if (detection.projectType && detection.projectType !== "unknown") config.type = detection.projectType;
  if (Array.isArray(agents) && agents.length > 0) config.agents = [...agents];
  const summary = describeScaffoldConfig(config);
  if (!write) {
    return { planned: [`${CONFIG_FILENAME} would be created (${summary}).`], created: [], skipped: [] };
  }
  await writeFile(path.join(cwd, CONFIG_FILENAME), `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8" });
  return { planned: [], created: [`${CONFIG_FILENAME} created (${summary}).`], skipped: [] };
}

function describeScaffoldConfig(config) {
  const parts = [];
  if (config.type) parts.push(`type=${config.type}`);
  if (config.agents && config.agents.length > 0) parts.push(`agents=${config.agents.join("+")}`);
  return parts.length > 0 ? parts.join(", ") : "empty starter; add type/profiles/agents/strict";
}

export async function initCommand(options) {
  const detection = await detectProject(options.cwd, options.type, options.profiles);
  const agents = selectedAgents(options);
  const baseDocs = plannedDocs(detection.projectType, options.minimal, options.profiles);
  const candidateSet = new Set(baseDocs);
  const domainContext = await buildDomainContext(options.cwd, detection.projectType, options.minimal, candidateSet);
  const candidates = [...baseDocs, ...domainContext.plans.map((plan) => plan.rel)];

  if (options.dryRun) {
    return initDryRun(options, detection, agents, candidates);
  }

  if (options.write) {
    return initWrite(options, detection, agents, candidates, domainContext);
  }

  return blockedApply("init", "Use init --dry-run to preview changes or init --write to create missing LLM-WIKI files. Existing wiki docs default to --existing skip.");
}

async function initDryRun(options, detection, agents, candidates) {
  const planned = [];
  const skipped = [];

  for (const rel of candidates) {
    if (await pathExists(path.join(options.cwd, rel))) {
      skipped.push(`${rel} exists; would not overwrite.`);
    } else {
      const overridePath = options.templates && options.templates[rel];
      planned.push(`${rel} would be created with status needs_review${overridePath ? ` (via template override ${overridePath})` : ""}.`);
    }
  }

  const adapterPlan = await planAdapterSuggestions(options.cwd, agents);
  planned.push(...adapterPlan.planned);
  skipped.push(...adapterPlan.skipped);

  const configScaffold = await scaffoldProjectConfig(options.cwd, detection, agents, { write: false });
  planned.push(...configScaffold.planned);
  skipped.push(...configScaffold.skipped);

  if (options.withAdapters && agents.length > 0) {
    skipped.push("--with-adapters is treated as legacy shorthand for --agent all.");
  }

  return withText({
    command: "init",
    dryRun: true,
    detection,
    agents,
    planned,
    skipped
  }, "LLM-WIKI Init Dry Run", [
    { title: "Detected Project", body: [`type: ${detection.projectType}`, `confidence: ${detection.confidence}`] },
    { title: "Selected Agents", body: [agents.length ? agents.join(", ") : "none"] },
    { title: "Planned Creates", body: planned },
    { title: "Skipped Existing", body: skipped },
    { title: "Caveats", body: ["No files were written. Existing adapter files are not overwritten."] }
  ]);
}

export async function migrateCommand(options) {
  // --apply writes; the default (and --dry-run) previews. Unblocked for the 1.2
  // line under GATE_REVIEW Gate 8: reuses the fix engine plus wiki_block_version
  // stamping, preview-first and verified-preserving.
  const write = options.apply === true;
  const cwd = options.cwd;
  const wikiRoot = path.join(cwd, "docs", "llm-wiki");
  const emptyReport = {
    current: CURRENT_WIKI_BLOCK_VERSION,
    counts: { current: 0, behind: 0, ahead: 0, unrecorded: 0, unknown: 0 },
    gapDocuments: [],
    aheadDocuments: []
  };

  if (!(await pathExists(wikiRoot))) {
    return withText({
      command: "migrate",
      apply: write,
      dryRun: !write,
      result: "pass",
      upgradeReport: emptyReport,
      safeAdds: [],
      reviewItems: [],
      blockedItems: [],
      applied: [],
      planned: [],
      skipped: [],
      findings: []
    }, write ? "LLM-WIKI Migration Apply" : "LLM-WIKI Migration Dry Run", [
      { title: "Summary", body: [`mode: ${write ? "apply" : "dry-run"}`, "wiki: not initialized"] },
      { title: "Caveats", body: ["docs/llm-wiki is not initialized; run init --write first. Nothing to migrate."] }
    ]);
  }

  const analysis = await analyzeBlockVersions(cwd);
  const upgrade = buildUpgradeReport(analysis);
  const engine = await runMechanicalRemediation(cwd, { write, upgradeBlockVersion: true });

  const auditResult = await audit({ ...options, dryRun: true });
  const safeAdds = auditResult.findings
    .filter((finding) => finding.rule === "structure.required_doc")
    .map((finding) => `${finding.path} could be added as needs_review template.`);
  const blockedItems = auditResult.findings
    .filter((finding) => finding.severity === "blocked")
    .map(formatFinding);
  const reviewItems = auditResult.findings
    .filter((finding) => finding.severity === "warning" || finding.severity === "error")
    .map(formatFinding);

  const result = engine.blockedFindings.some((finding) => finding.severity === "blocked") ? "blocked" : "pass";
  const summary = [
    `mode: ${write ? "apply" : "dry-run"}`,
    `cli_block_version: ${analysis.current}`,
    `${write ? "applied" : "planned"}: ${engine.changeList.length}`,
    `skipped: ${engine.skipped.length}`,
    `blocked: ${engine.blockedFindings.length}`
  ];

  return withText({
    command: "migrate",
    apply: write,
    dryRun: !write,
    result,
    upgradeReport: {
      current: analysis.current,
      counts: upgrade.counts,
      gapDocuments: upgrade.gapDocs.map((doc) => ({
        path: doc.rel,
        state: doc.state,
        recorded: doc.recorded,
        status: doc.status
      })),
      aheadDocuments: upgrade.aheadDocs.map((doc) => ({ path: doc.rel, recorded: doc.recorded }))
    },
    safeAdds,
    reviewItems,
    blockedItems,
    applied: engine.applied,
    planned: engine.planned,
    skipped: engine.skipped,
    findings: engine.blockedFindings
  }, write ? "LLM-WIKI Migration Apply" : "LLM-WIKI Migration Dry Run", [
    { title: "Summary", body: summary },
    { title: "Upgrade Report (wiki_block_version)", body: upgrade.lines },
    { title: "Documents to Upgrade", body: upgrade.detail },
    { title: write ? "Applied Changes" : "Planned Changes", body: engine.changeList },
    { title: "Skipped", body: engine.skipped },
    { title: "Blocked", body: [...engine.blockedFindings.map(formatFinding), ...blockedItems] },
    { title: "Missing Documents (scaffold with init --write)", body: safeAdds },
    { title: "Human Review Required", body: reviewItems },
    { title: "Caveats", body: [
      write
        ? "Applied under GATE_REVIEW Gate 8 scope: only docs/llm-wiki content, never verified documents, source_files/evidence values, Tier B fields, or document status. All writes remain needs_review."
        : "No files were written. Verified documents are not modified. Raw sensitive values are omitted. Run migrate --apply to apply the planned changes."
    ] }
  ]);
}

function blockedApply(command, message) {
  return withText({
    command,
    result: "blocked",
    findings: [{ severity: "blocked", rule: `${command}.apply_blocked`, path: ".", message }]
  }, `LLM-WIKI ${command} Blocked`, [{ title: "Blocked", body: [message] }]);
}

// ---- wiki_block_version upgrade analysis --------------------------------
// The migration engine compares each document's recorded wiki_block_version
// against CURRENT_WIKI_BLOCK_VERSION to report the contract gap (read-only) and,
// under migrate --apply (GATE_REVIEW Gate 8), to stamp conforming documents.

function parseBlockVersion(value) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^v(\d+)$/i);
  return match ? Number(match[1]) : null;
}

// Documents the migration / fix engines operate on: wiki markdown excluding the
// intentional templates/ scaffolds.
// Classify every wiki content document by its recorded block version relative
// to the current CLI contract. Read-only.
async function analyzeBlockVersions(cwd) {
  const currentNumber = parseBlockVersion(CURRENT_WIKI_BLOCK_VERSION);
  const docs = [];
  for (const file of await listWikiContentDocs(cwd)) {
    const rel = toPosix(path.relative(cwd, file));
    const parsed = parseFrontmatter(await readUtf8(file));
    const hasField = Boolean(parsed.frontmatter) && "wiki_block_version" in parsed.frontmatter;
    const raw = hasField ? parsed.frontmatter.wiki_block_version : undefined;
    const version = parseBlockVersion(raw);
    let state;
    if (!hasField || raw === null || String(raw).trim() === "") state = "unrecorded";
    else if (version === null) state = "unknown";
    else if (version < currentNumber) state = "behind";
    else if (version > currentNumber) state = "ahead";
    else state = "current";
    docs.push({
      rel,
      recorded: hasField ? raw : null,
      version,
      state,
      status: parsed.frontmatter?.status ?? null
    });
  }
  return { current: CURRENT_WIKI_BLOCK_VERSION, currentNumber, docs };
}

function summarizeBlockVersions(analysis) {
  const counts = { current: 0, behind: 0, ahead: 0, unrecorded: 0, unknown: 0 };
  for (const doc of analysis.docs) counts[doc.state] += 1;
  return counts;
}

// Documents whose recorded block version trails or is missing relative to the
// current contract — the upgrade candidates migrate would bring forward.
function blockVersionGapDocs(analysis) {
  return analysis.docs.filter(
    (doc) => doc.state === "behind" || doc.state === "unrecorded" || doc.state === "unknown"
  );
}

// Human-readable upgrade report for the migrate dry run.
function buildUpgradeReport(analysis) {
  const counts = summarizeBlockVersions(analysis);
  const gapDocs = blockVersionGapDocs(analysis);
  const lines = [
    `cli_block_version: ${analysis.current}`,
    `documents: ${analysis.docs.length}`,
    `at_current: ${counts.current}`,
    `behind: ${counts.behind}`,
    `unrecorded: ${counts.unrecorded}`,
    `unknown: ${counts.unknown}`,
    `ahead: ${counts.ahead}`
  ];
  const detail = gapDocs.length
    ? gapDocs.map((doc) => `${doc.rel}: ${doc.state}${doc.recorded ? ` (${doc.recorded})` : ""} → ${analysis.current}`)
    : ["All documents are at the current block version."];
  const aheadDocs = analysis.docs.filter((doc) => doc.state === "ahead");
  return { counts, gapDocs, aheadDocs, lines, detail };
}

// ---- fix command (scoped autofix) --------------------------------------
// The accepted scope is recorded in GATE_REVIEW.md ("Autofix (--fix) Scope
// Decision"). fix applies only safe, mechanically decidable remediations under
// docs/llm-wiki/, never edits verified documents' content, never writes outside
// docs/llm-wiki/, and never invents meaning-bearing values.

// Tier A required fields: safe to auto-insert with a mechanical default.
const FIX_TIER_A_SCALAR_DEFAULTS = {
  status: "needs_review",
  visibility: "internal",
  contains_sensitive_info: "false",
  wiki_block_version: CURRENT_WIKI_BLOCK_VERSION,
  last_edited_by: "llm-wiki-cli"
};
const FIX_TIER_A_ARRAY_FIELDS = ["tags", "source_files", "related"];
// Tier B required fields carry meaning a tool cannot honestly invent.
const FIX_TIER_B_FIELDS = new Set(["title", "doc_type", "project", "author"]);
const EVIDENCE_PLACEHOLDER_BULLET =
  "- _No evidence recorded yet; add source references such as file, file#L10, or file#symbol:Name._";

// Shared mechanical remediation engine used by `fix` (GATE_REVIEW Gate 6) and
// `migrate --apply` (GATE_REVIEW Gate 8). It applies only the accepted safe
// remediations under docs/llm-wiki/, never edits verified documents' content,
// never writes outside docs/llm-wiki/, and never invents meaning-bearing values.
// With upgradeBlockVersion, it additionally upgrades an existing behind
// wiki_block_version to current — but only once the document otherwise conforms
// (no Tier B required field left for a human). A missing wiki_block_version is
// backfilled to current by the Tier A insertion, matching fix.
async function runMechanicalRemediation(cwd, { write, upgradeBlockVersion = false }) {
  const applied = [];
  const planned = [];
  const skipped = [];
  const blockedFindings = [];
  const changeList = write ? applied : planned;
  const stubTargets = new Map(); // relPosix target -> Set of referencing docs
  const label = upgradeBlockVersion ? "migrate" : "fix";
  const currentNumber = parseBlockVersion(CURRENT_WIKI_BLOCK_VERSION);

  const files = await listWikiContentDocs(cwd);

  for (const file of files) {
    const rel = toPosix(path.relative(cwd, file));
    const original = await readUtf8(file);

    if (findMojibakeIndicators(original).length > 0) {
      skipped.push(`${rel}: possible mojibake; automatic rewrite skipped.`);
      continue;
    }

    const parsed = parseFrontmatter(original);

    // Broken related / markdown-link targets become needs_review stubs. Creating
    // a stub is a new-file write that never edits this document, so it is
    // collected even for verified documents.
    await collectBrokenLinkTargets(cwd, file, rel, parsed, original, stubTargets, skipped);

    if (!parsed.frontmatter) {
      skipped.push(`${rel}: no YAML frontmatter; ${label} does not synthesize a full frontmatter block.`);
      continue;
    }

    if (parsed.frontmatter.status === "verified") {
      const reasons = [];
      const missing = schemaRequiredFields().filter((field) => !hasRequiredField(parsed.frontmatter, field));
      if (missing.length > 0) reasons.push(`missing ${missing.join(", ")}`);
      const verifiedEvidence = Array.isArray(parsed.frontmatter.evidence)
        ? parsed.frontmatter.evidence.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
        : [];
      if (reconcileEvidenceSection(parsed.body, verifiedEvidence, "\n")) reasons.push("## Evidence section could be reconciled");
      if (upgradeBlockVersion) {
        const recorded = parseBlockVersion(parsed.frontmatter.wiki_block_version);
        if (recorded !== null && recorded < currentNumber) {
          reasons.push(`behind wiki_block_version ${parsed.frontmatter.wiki_block_version}`);
        }
      }
      if (reasons.length > 0) {
        skipped.push(`${rel}: verified document (${reasons.join("; ")}); left untouched (review manually).`);
      }
      continue;
    }

    const split = splitFrontmatter(original);
    if (!split) {
      skipped.push(`${rel}: could not locate frontmatter block; skipped.`);
      continue;
    }

    const eol = split.eol;
    const docChanges = [];
    let inner = split.inner;
    let body = split.body;

    // 1) Missing Tier A required frontmatter fields.
    const missingRequired = schemaRequiredFields().filter((field) => !hasRequiredField(parsed.frontmatter, field));
    const tierBMissing = missingRequired.filter((field) => FIX_TIER_B_FIELDS.has(field));
    const tierAMissing = missingRequired.filter((field) => !FIX_TIER_B_FIELDS.has(field));

    for (const field of tierBMissing) {
      skipped.push(`${rel}: required field '${field}' needs a human value (Tier B; not auto-filled).`);
    }

    const insertLines = [];
    for (const field of tierAMissing) {
      if (field === "last_updated") {
        insertLines.push(`last_updated: ${todayIsoDate()}`);
        docChanges.push("insert last_updated");
      } else if (FIX_TIER_A_ARRAY_FIELDS.includes(field)) {
        insertLines.push(`${field}:`);
        docChanges.push(`insert ${field} (empty list)`);
      } else if (field in FIX_TIER_A_SCALAR_DEFAULTS) {
        insertLines.push(`${field}: ${FIX_TIER_A_SCALAR_DEFAULTS[field]}`);
        docChanges.push(`insert ${field}`);
      }
    }
    if (insertLines.length > 0) {
      inner = `${inner}${eol}${insertLines.join(eol)}`;
    }

    // 2) Reconcile the body ## Evidence section with frontmatter evidence.
    const frontmatterEvidence = Array.isArray(parsed.frontmatter.evidence)
      ? parsed.frontmatter.evidence.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
      : [];
    const evidenceResult = reconcileEvidenceSection(body, frontmatterEvidence, eol);
    if (evidenceResult) {
      body = evidenceResult.body;
      docChanges.push(evidenceResult.change);
    }

    // 3) (migrate only) Upgrade an existing behind wiki_block_version to current,
    // only once the document conforms (no Tier B field left for a human).
    if (upgradeBlockVersion && "wiki_block_version" in parsed.frontmatter) {
      const recorded = parseBlockVersion(parsed.frontmatter.wiki_block_version);
      if (recorded !== null && recorded < currentNumber) {
        if (tierBMissing.length === 0) {
          const stamped = replaceFrontmatterScalar(inner, "wiki_block_version", CURRENT_WIKI_BLOCK_VERSION);
          if (stamped && stamped !== inner) {
            inner = stamped;
            docChanges.push(`upgrade wiki_block_version ${parsed.frontmatter.wiki_block_version} → ${CURRENT_WIKI_BLOCK_VERSION}`);
          }
        } else {
          skipped.push(`${rel}: wiki_block_version ${parsed.frontmatter.wiki_block_version} kept behind ${CURRENT_WIKI_BLOCK_VERSION}; resolve Tier B field(s) ${tierBMissing.join(", ")} first.`);
        }
      }
    }

    if (docChanges.length === 0) continue;

    // 4) Refresh last_updated on documents this run actually modifies (unless we
    // just inserted it as today).
    if (!tierAMissing.includes("last_updated") && "last_updated" in parsed.frontmatter) {
      const refreshed = replaceFrontmatterScalar(inner, "last_updated", todayIsoDate());
      if (refreshed && refreshed !== inner) {
        inner = refreshed;
        docChanges.push("refresh last_updated");
      }
    }

    const newContent = `${split.bom}${split.open}${inner}${split.close}${body}`;
    if (newContent === original) continue;

    if (scanSensitiveInfo(newContent).length > 0) {
      blockedFindings.push({
        severity: "blocked",
        rule: "sensitive.redacted",
        path: rel,
        message: `${upgradeBlockVersion ? "Migration" : "Fix"} skipped: resulting content matched sensitive-info rules.`
      });
      continue;
    }

    if (write) {
      await writeUtf8(file, newContent);
    }
    changeList.push(`${rel}: ${docChanges.join("; ")}.`);
  }

  // Create needs_review stubs for eligible broken link/related targets.
  for (const [relTarget, refs] of stubTargets) {
    const abs = path.join(cwd, relTarget);
    if (await pathExists(abs)) continue;
    const content = renderStubDocument(relTarget, cwd);
    if (scanSensitiveInfo(content).length > 0) {
      blockedFindings.push({
        severity: "blocked",
        rule: "sensitive.redacted",
        path: relTarget,
        message: "Stub not created: generated content matched sensitive-info rules."
      });
      continue;
    }
    if (write) {
      await mkdir(path.dirname(abs), { recursive: true });
      await writeUtf8(abs, content);
    }
    changeList.push(`${relTarget}: create needs_review stub (referenced by ${[...refs].join(", ")}).`);
  }

  return { applied, planned, skipped, blockedFindings, changeList };
}

export async function fixCommand(options) {
  const write = options.write === true;
  const cwd = options.cwd;
  const wikiRoot = path.join(cwd, "docs", "llm-wiki");

  if (!(await pathExists(wikiRoot))) {
    return withText({
      command: "fix",
      write,
      dryRun: !write,
      result: "pass",
      applied: [],
      planned: [],
      skipped: [],
      findings: []
    }, "LLM-WIKI Fix", [
      { title: "Summary", body: [`mode: ${write ? "write" : "dry-run"}`, "wiki: not initialized"] },
      { title: "Caveats", body: ["docs/llm-wiki is not initialized; run init --write first. Nothing to fix."] }
    ]);
  }

  const { applied, planned, skipped, blockedFindings, changeList } =
    await runMechanicalRemediation(cwd, { write, upgradeBlockVersion: false });

  const findings = blockedFindings;
  const result = findings.some((finding) => finding.severity === "blocked") ? "blocked" : "pass";
  const summary = [
    `mode: ${write ? "write" : "dry-run"}`,
    `${write ? "applied" : "planned"}: ${changeList.length}`,
    `skipped: ${skipped.length}`,
    `blocked: ${blockedFindings.length}`
  ];

  return withText({
    command: "fix",
    write,
    dryRun: !write,
    result,
    applied,
    planned,
    skipped,
    findings
  }, "LLM-WIKI Fix", [
    { title: "Summary", body: summary },
    { title: write ? "Applied Fixes" : "Planned Fixes", body: changeList },
    { title: "Skipped", body: skipped },
    { title: "Blocked", body: blockedFindings.map(formatFinding) },
    { title: "Caveats", body: [
      write
        ? "Only docs/llm-wiki content was changed. Verified documents, source_files/evidence values, and enrichment were left for human review. All writes stay needs_review."
        : "Preview only; no files were written. Run fix --write to apply."
    ] }
  ]);
}

// ---- drift command (opt-in verified -> needs_review downgrade) ---------
// The accepted scope is recorded in GATE_REVIEW.md ("Drift Downgrade Scope
// Decision", Gate 9). drift reports evidence.stale drift on verified documents
// and, with --downgrade, flips only those documents to needs_review (status +
// last_updated). It never promotes to verified and never edits other content.
export async function driftCommand(options) {
  const downgrade = options.downgrade === true;
  const cwd = options.cwd;
  const wikiRoot = path.join(cwd, "docs", "llm-wiki");

  if (!(await pathExists(wikiRoot))) {
    return withText({
      command: "drift",
      downgrade,
      dryRun: !downgrade,
      result: "pass",
      driftFindings: [],
      applied: [],
      planned: [],
      skipped: [],
      findings: []
    }, "LLM-WIKI Drift", [
      { title: "Summary", body: [`mode: ${downgrade ? "downgrade" : "report"}`, "wiki: not initialized"] },
      { title: "Caveats", body: ["docs/llm-wiki is not initialized; run init --write first. Nothing to check."] }
    ]);
  }

  const driftFindings = await scanEvidenceDrift(cwd);
  const driftedDocs = [];
  const seen = new Set();
  for (const finding of driftFindings) {
    if (finding.rule !== "evidence.stale" || seen.has(finding.path)) continue;
    seen.add(finding.path);
    driftedDocs.push(finding.path);
  }

  const applied = [];
  const planned = [];
  const skipped = [];
  const blockedFindings = [];
  const changeList = downgrade ? applied : planned;

  for (const rel of driftedDocs) {
    const abs = path.join(cwd, rel);
    const original = await readUtf8(abs);

    if (findMojibakeIndicators(original).length > 0) {
      skipped.push(`${rel}: possible mojibake; downgrade skipped.`);
      continue;
    }

    const split = splitFrontmatter(original);
    if (!split) {
      skipped.push(`${rel}: could not locate frontmatter block; skipped.`);
      continue;
    }

    let inner = replaceFrontmatterScalar(split.inner, "status", "needs_review");
    if (!inner || inner === split.inner) {
      skipped.push(`${rel}: could not rewrite status to needs_review; skipped.`);
      continue;
    }
    const refreshed = replaceFrontmatterScalar(inner, "last_updated", todayIsoDate());
    if (refreshed) inner = refreshed;

    const newContent = `${split.bom}${split.open}${inner}${split.close}${split.body}`;
    if (newContent === original) continue;

    if (scanSensitiveInfo(newContent).length > 0) {
      blockedFindings.push({
        severity: "blocked",
        rule: "sensitive.redacted",
        path: rel,
        message: "Downgrade skipped: resulting content matched sensitive-info rules."
      });
      continue;
    }

    if (downgrade) {
      await writeUtf8(abs, newContent);
    }
    changeList.push(`${rel}: downgrade verified → needs_review; refresh last_updated.`);
  }

  const result = blockedFindings.some((finding) => finding.severity === "blocked") ? "blocked" : "pass";
  const summary = [
    `mode: ${downgrade ? "downgrade" : "report"}`,
    `drifted_verified_docs: ${driftedDocs.length}`,
    `${downgrade ? "downgraded" : "would_downgrade"}: ${changeList.length}`,
    `skipped: ${skipped.length}`,
    `blocked: ${blockedFindings.length}`
  ];

  return withText({
    command: "drift",
    downgrade,
    dryRun: !downgrade,
    result,
    driftFindings,
    applied,
    planned,
    skipped,
    findings: blockedFindings
  }, "LLM-WIKI Drift", [
    { title: "Summary", body: summary },
    { title: "Drift (evidence.stale)", body: driftFindings.map(formatFinding) },
    { title: downgrade ? "Downgraded" : "Would Downgrade", body: changeList },
    { title: "Skipped", body: skipped },
    { title: "Blocked", body: blockedFindings.map(formatFinding) },
    { title: "Caveats", body: [
      downgrade
        ? "Downgraded drifted verified documents to needs_review (status + last_updated only). Re-review and re-verify after updating; nothing else was changed."
        : "Report only; no files were written. Run drift --downgrade to flip drifted verified documents to needs_review."
    ] }
  ]);
}

function splitFrontmatter(content) {
  const bom = content.charCodeAt(0) === 0xfeff ? content[0] : "";
  const rest = content.slice(bom.length);
  const match = rest.match(/^(---\r?\n)([\s\S]*?)(\r?\n---\r?\n?)/);
  if (!match) return null;
  const eol = match[1].endsWith("\r\n") ? "\r\n" : "\n";
  return {
    bom,
    open: match[1],
    inner: match[2],
    close: match[3],
    body: rest.slice(match[0].length),
    eol
  };
}

function replaceFrontmatterScalar(inner, key, value) {
  const pattern = new RegExp(`^(\\s*${escapeRegex(key)}:)[^\\r\\n]*$`, "m");
  if (!pattern.test(inner)) return null;
  return inner.replace(pattern, `$1 ${value}`);
}

function reconcileEvidenceSection(body, frontmatterEvidence, eol) {
  const section = extractMarkdownSection(body, "Evidence");

  if (!section) {
    if (frontmatterEvidence.length === 0) return null;
    const bullets = frontmatterEvidence.map((item) => `- ${item}`);
    return {
      body: appendEvidenceSection(body, bullets, eol),
      change: `add ## Evidence section (${bullets.length} bullet${bullets.length === 1 ? "" : "s"})`
    };
  }

  if (section.bullets.length === 0) {
    const bullets = frontmatterEvidence.length ? frontmatterEvidence.map((item) => `- ${item}`) : [EVIDENCE_PLACEHOLDER_BULLET];
    const newBody = addBulletsUnderEvidence(body, bullets, eol);
    if (!newBody) return null;
    return { body: newBody, change: `fill empty ## Evidence section (${bullets.length} bullet${bullets.length === 1 ? "" : "s"})` };
  }

  const missing = frontmatterEvidence.filter((item) => !section.text.includes(item));
  if (missing.length === 0) return null;
  const bullets = missing.map((item) => `- ${item}`);
  const newBody = addBulletsUnderEvidence(body, bullets, eol);
  if (!newBody) return null;
  return { body: newBody, change: `add ${bullets.length} missing ## Evidence bullet${bullets.length === 1 ? "" : "s"}` };
}

function appendEvidenceSection(body, bullets, eol) {
  const lines = String(body).split(/\r?\n/);
  const tailPattern = /^##\s+(Open Questions|Review Notes)\s*$/i;
  const idx = lines.findIndex((line) => tailPattern.test(line.trim()));
  const sectionBlock = ["## Evidence", "", ...bullets, ""];
  if (idx === -1) {
    const trimmed = [...lines];
    while (trimmed.length > 0 && trimmed[trimmed.length - 1].trim() === "") trimmed.pop();
    return [...trimmed, "", ...sectionBlock].join(eol);
  }
  return [...lines.slice(0, idx), ...sectionBlock, ...lines.slice(idx)].join(eol);
}

function addBulletsUnderEvidence(body, bullets, eol) {
  const lines = String(body).split(/\r?\n/);
  const headingPattern = /^##\s+Evidence\s*$/i;
  const start = lines.findIndex((line) => headingPattern.test(line.trim()));
  if (start === -1) return null;

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^#{1,2}\s+\S/.test(lines[index].trim())) {
      end = index;
      break;
    }
  }

  let insertAt = start + 1;
  for (let index = start + 1; index < end; index += 1) {
    if (lines[index].trim() !== "") insertAt = index + 1;
  }

  return [...lines.slice(0, insertAt), ...bullets, ...lines.slice(insertAt)].join(eol);
}

async function collectBrokenLinkTargets(cwd, file, rel, parsed, original, stubTargets, skipped) {
  const seen = new Set();

  const addTarget = (abs) => {
    const relTarget = toPosix(path.relative(cwd, abs));
    if (
      relTarget.startsWith("..") ||
      !relTarget.startsWith("docs/llm-wiki/") ||
      !relTarget.endsWith(".md") ||
      isAppendOnlyLog(relTarget)
    ) {
      skipped.push(`${rel}: broken reference ${relTarget} is outside stub scope (docs/llm-wiki/*.md); left for human review.`);
      return;
    }
    if (!stubTargets.has(relTarget)) stubTargets.set(relTarget, new Set());
    stubTargets.get(relTarget).add(rel);
  };

  const related = parsed.frontmatter?.related;
  if (Array.isArray(related)) {
    for (const entry of related) {
      if (typeof entry !== "string") continue;
      const target = entry.trim();
      if (!target || isExternalSourceReference(target)) continue;
      const abs = path.join(cwd, target);
      const key = `related:${abs}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!(await pathExists(abs))) addTarget(abs);
    }
  }

  for (const target of extractMarkdownLinkTargets(original)) {
    const link = normalizeMarkdownLinkTarget(target);
    if (!link || isSkippedMarkdownLink(link)) continue;
    const abs = resolveMarkdownLinkTarget(cwd, file, link);
    const key = `link:${abs}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!(await pathExists(abs))) addTarget(abs);
  }
}

function renderStubDocument(relTarget, cwd) {
  const base = relTarget.split("/").pop().replace(/\.md$/i, "");
  const title = base.replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()).trim() || base;
  const project = path.basename(cwd);
  const body = [
    `# ${title}`,
    "",
    "> Auto-created `needs_review` stub to resolve a broken reference. Replace this with source-backed content and keep it `needs_review` until human review.",
    "",
    "## Open Questions",
    "",
    "- What content belongs in this document?",
    "",
    "## Review Notes",
    "",
    "- Human review required before this document is trusted.",
    ""
  ].join("\n");
  return renderWikiDocumentTemplate({ title, docType: "reference", project, body, sourceFiles: [], evidence: [], related: [] });
}

async function findMissingDocs(cwd, projectType, profiles = [], customDocs = []) {
  const findings = [];
  const wikiEntry = path.join(cwd, "docs", "llm-wiki", "index.md");
  if (!(await pathExists(wikiEntry))) {
    findings.push({
      severity: "warning",
      rule: "structure.wiki_missing",
      path: "docs/llm-wiki/index.md",
      message: "LLM-WIKI is not initialized; ask the user whether to proceed as-is or run init --write first."
    });
    return findings;
  }

  const required = [...new Set([...plannedDocs(projectType, false, profiles), ...customDocs])];
  for (const rel of required) {
    if (!(await pathExists(path.join(cwd, rel)))) {
      findings.push({
        severity: "warning",
        rule: "structure.required_doc",
        path: rel,
        message: "Required or profile-recommended LLM-WIKI document is missing."
      });
    }
  }
  return findings;
}

async function initWrite(options, detection, agents, candidates, domainContext = emptyDomainContext()) {
  const created = [];
  const overwritten = [];
  const skipped = [];
  const blocked = [];
  const lastUpdated = todayIsoDate();

  for (const rel of candidates) {
    const absolutePath = path.join(options.cwd, rel);
    const exists = await pathExists(absolutePath);
    if (exists && isAppendOnlyLog(rel)) {
      skipped.push(`${rel} exists; kept append-only log even with --existing overwrite.`);
      continue;
    }
    if (exists && options.existing !== "overwrite") {
      skipped.push(`${rel} exists; kept existing file because --existing skip is active.`);
      continue;
    }

    const overridePath = options.templates && options.templates[rel];
    let content;
    let viaOverride = "";
    if (overridePath) {
      const override = await renderOverriddenDoc(options.cwd, rel, overridePath, detection, lastUpdated, domainContext);
      if (override.missing) {
        content = renderGeneratedWikiDoc(rel, detection, lastUpdated, domainContext);
        skipped.push(`${rel}: template override ${overridePath} not found; used the built-in template.`);
      } else {
        content = override.content;
        viaOverride = ` (via template override ${overridePath})`;
      }
    } else {
      content = renderGeneratedWikiDoc(rel, detection, lastUpdated, domainContext);
    }
    const sensitiveFindings = scanSensitiveInfo(content);
    if (sensitiveFindings.length > 0) {
      blocked.push(`${rel} was not written because generated content matched sensitive-info rules.`);
      continue;
    }

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, { encoding: "utf8" });
    if (exists) {
      overwritten.push(`${rel} overwritten with status needs_review by explicit --existing overwrite${viaOverride}.`);
    } else {
      created.push(`${rel} created with status needs_review${viaOverride}.`);
    }
  }

  const adapterWrites = await writeAdapterFiles(options.cwd, agents);
  created.push(...adapterWrites.created);
  skipped.push(...adapterWrites.skipped);
  blocked.push(...adapterWrites.blocked);

  const configScaffold = await scaffoldProjectConfig(options.cwd, detection, agents, { write: true });
  created.push(...configScaffold.created);
  skipped.push(...configScaffold.skipped);

  if (options.withAdapters && agents.length > 0) {
    skipped.push("--with-adapters is treated as legacy shorthand for --agent all.");
  }

  const findings = blocked.map((message) => ({
    severity: "blocked",
    rule: "init.write_blocked",
    path: ".",
    message
  }));
  const result = findings.length > 0 ? "blocked" : "pass";

  return withText({
    command: "init",
    dryRun: false,
    write: true,
    existing: options.existing,
    result,
    detection,
    agents,
    created,
    overwritten,
    skipped,
    findings
  }, "LLM-WIKI Init Write", [
    { title: "Detected Project", body: [`type: ${detection.projectType}`, `confidence: ${detection.confidence}`] },
    { title: "Selected Agents", body: [agents.length ? agents.join(", ") : "none"] },
    { title: "Created", body: created },
    { title: "Overwritten", body: overwritten },
    { title: "Skipped Existing", body: skipped },
    { title: "Blocked", body: blocked },
    { title: "Caveats", body: ["Existing wiki docs are kept unless --existing overwrite is explicit. docs/llm-wiki/log.md and existing adapter files are never overwritten. ANTIGRAVITY.md is not created until the tool contract is confirmed."] }
  ]);
}

async function scanEncoding(cwd) {
  const findings = [];
  for (const file of await listTargetMarkdown(cwd)) {
    const rel = toPosix(path.relative(cwd, file));
    const content = await readUtf8(file);
    const mojibake = findMojibakeIndicators(content);
    if (hasUtf8Bom(content)) {
      findings.push({ severity: "info", rule: "encoding.bom", path: rel, message: "UTF-8 BOM detected." });
    }
    if (mojibake.length) {
      findings.push({ severity: "blocked", rule: "encoding.mojibake", path: rel, message: "Mojibake indicators detected; automatic rewrite skipped." });
    }
  }
  return findings;
}

async function scanSensitive(cwd) {
  const findings = [];
  const markdownFiles = await listTargetMarkdown(cwd);
  const adapterFiles = [];
  for (const target of Object.values(ADAPTER_TARGETS)) {
    const file = path.join(cwd, target.path);
    if (await pathExists(file)) adapterFiles.push(file);
  }

  for (const file of [...markdownFiles, ...adapterFiles]) {
    if (!(await pathExists(file))) continue;
    const rel = toPosix(path.relative(cwd, file));
    const content = await readUtf8(file);
    for (const finding of scanSensitiveInfo(content)) {
      findings.push({
        severity: "blocked",
        rule: "sensitive.redacted",
        path: `${rel}:${finding.line}`,
        message: `${finding.type}: ${finding.message}`
      });
    }
  }
  return findings;
}

async function scanSourceFiles(cwd) {
  const findings = [];
  for (const file of await listTargetMarkdown(cwd)) {
    const rel = toPosix(path.relative(cwd, file));
    const content = await readUtf8(file);
    const parsed = parseFrontmatter(content);
    const sourceFiles = parsed.frontmatter?.source_files;

    if (!Array.isArray(sourceFiles)) continue;

    for (const sourceFile of sourceFiles) {
      if (typeof sourceFile !== "string") continue;

      const source = sourceFile.trim();
      if (!source || isExternalSourceReference(source)) continue;

      if (!(await pathExists(path.join(cwd, source)))) {
        findings.push({
          severity: "warning",
          rule: "source_files.missing",
          path: rel,
          message: `source_files entry does not exist: ${source}.`
        });
      }
    }
  }
  return findings;
}

async function scanRelatedReferences(cwd) {
  const findings = [];
  for (const file of await listTargetMarkdown(cwd)) {
    const rel = toPosix(path.relative(cwd, file));
    const content = await readUtf8(file);
    const parsed = parseFrontmatter(content);
    const related = parsed.frontmatter?.related;

    if (!Array.isArray(related)) continue;

    for (const relatedEntry of related) {
      if (typeof relatedEntry !== "string") continue;

      const target = relatedEntry.trim();
      if (!target || isExternalSourceReference(target)) continue;

      if (!(await pathExists(path.join(cwd, target)))) {
        findings.push({
          severity: "warning",
          rule: "related.missing",
          path: rel,
          message: `related entry does not exist: ${target}.`
        });
      }
    }
  }
  return findings;
}

const ENRICHMENT_PLACEHOLDER_SENTINELS = [
  "Concise summary: describe",
  "Add file paths, symbols, routes, commands, or test names inspected",
  "Add source files and commands inspected while completing",
  "Add source files, tests, routes, and client modules inspected",
  "Track unclear ownership",
  "Keep uncertain claims here until source evidence",
  "List each domain, owner area",
  "이 프로젝트에서 해당 주제의 기준 정보를 정리합니다.",
  "이 문서는 `llm-wiki init --write`가 생성한 초안입니다."
];

async function scanEnrichment(cwd) {
  const findings = [];
  for (const file of await listTargetMarkdown(cwd)) {
    const rel = toPosix(path.relative(cwd, file));
    if (rel.includes("/templates/")) continue;

    const content = await readUtf8(file);
    const parsed = parseFrontmatter(content);
    const body = parsed.frontmatter ? parsed.body : content;

    if (ENRICHMENT_PLACEHOLDER_SENTINELS.some((sentinel) => body.includes(sentinel))) {
      findings.push({
        severity: "warning",
        rule: "content.not_enriched",
        path: rel,
        message: "Document still contains generated placeholder guidance and has not been enriched with source-backed content yet."
      });
    }
  }
  return findings;
}

const THIN_BODY_MIN_WORDS = 25;

// Opt-in enrichment lint (content.thin_body): flags wiki content documents whose
// body has very little prose — stubs that were started but never developed. It is
// registered in FINDING_EXPLANATIONS but INERT by default; it only produces
// findings when a project enables it via config `rules` (e.g.
// "content.thin_body": "warning"). This is the canonical rule that dogfoods the
// rule-toggle machinery. Placeholder docs are left to content.not_enriched.
async function scanThinBody(cwd, options) {
  const setting = options && options.rules && options.rules["content.thin_body"];
  if (!setting || setting === "off") return [];
  const findings = [];
  for (const file of await listWikiContentDocs(cwd)) {
    const rel = toPosix(path.relative(cwd, file));
    if (isAppendOnlyLog(rel)) continue;
    const content = await readUtf8(file);
    const parsed = parseFrontmatter(content);
    const body = parsed.frontmatter ? parsed.body : content;
    if (ENRICHMENT_PLACEHOLDER_SENTINELS.some((sentinel) => body.includes(sentinel))) continue;
    const words = bodyProseWordCount(body);
    if (words < THIN_BODY_MIN_WORDS) {
      findings.push({
        severity: "warning",
        rule: "content.thin_body",
        path: rel,
        message: `Document body has only ${words} word${words === 1 ? "" : "s"} of prose (min ${THIN_BODY_MIN_WORDS}); enrich it with source-backed content.`
      });
    }
  }
  return findings;
}

// Rough "is this a real document yet" word count: body prose only, ignoring
// markdown headings, blank lines, and horizontal rules (frontmatter is already
// stripped by the caller).
function bodyProseWordCount(body) {
  return String(body)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line !== "---")
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
}

// Opt-in visibility-consistency lints (1.9, GATE_REVIEW Gate 14) that reuse the
// sensitive-info scan. Both are registered in FINDING_EXPLANATIONS but INERT by
// default; each runs only when enabled via config `rules`:
//   visibility.public_sensitive  — a `visibility: public` doc with sensitive content.
//   visibility.declared_mismatch — a `contains_sensitive_info: false` doc with it.
// Read-only and warning-level; the sensitive value is NEVER included in the finding
// (only a redacted count). Access control is out of scope — value-vs-content only.
async function scanVisibilityConsistency(cwd, options) {
  const rules = (options && options.rules) || {};
  const wantPublic = Boolean(rules["visibility.public_sensitive"]) && rules["visibility.public_sensitive"] !== "off";
  const wantDeclared = Boolean(rules["visibility.declared_mismatch"]) && rules["visibility.declared_mismatch"] !== "off";
  if (!wantPublic && !wantDeclared) return [];
  const findings = [];
  for (const file of await listWikiContentDocs(cwd)) {
    const rel = toPosix(path.relative(cwd, file));
    if (isAppendOnlyLog(rel)) continue;
    const content = await readUtf8(file);
    const sensitive = scanSensitiveInfo(content);
    if (sensitive.length === 0) continue;
    const frontmatter = parseFrontmatter(content).frontmatter || {};
    const at = `${rel}:${sensitive[0].line}`;
    if (wantPublic && frontmatter.visibility === "public") {
      findings.push({
        severity: "warning",
        rule: "visibility.public_sensitive",
        path: at,
        message: `Public document has ${sensitive.length} sensitive-looking value(s); values omitted. Redact them or lower visibility.`
      });
    }
    if (wantDeclared && frontmatter.contains_sensitive_info === false) {
      findings.push({
        severity: "warning",
        rule: "visibility.declared_mismatch",
        path: at,
        message: `Document declares contains_sensitive_info: false but ${sensitive.length} sensitive-looking value(s) were found; values omitted.`
      });
    }
  }
  return findings;
}

async function scanEvidenceReferences(cwd, options = {}) {
  const findings = [];
  const lineCountByPath = new Map();
  const strictSeverity = evidenceStrictSeverity(options);

  for (const file of await listTargetMarkdown(cwd)) {
    const rel = toPosix(path.relative(cwd, file));
    const content = await readUtf8(file);
    const parsed = parseFrontmatter(content);
    const evidence = parsed.frontmatter?.evidence;

    if (!Array.isArray(evidence)) continue;

    for (const item of evidence) {
      if (typeof item !== "string") continue;

      const reference = item.trim();
      const evidenceReference = parseEvidenceReference(reference);
      if (!evidenceReference) {
        findings.push({
          severity: "error",
          rule: "evidence.shape",
          path: rel,
          message: `Invalid evidence reference: ${reference || "(empty)"}.`
        });
        continue;
      }

      if (evidenceReference.external) continue;

      const absoluteSourcePath = path.join(cwd, evidenceReference.source);
      if (!(await pathExists(absoluteSourcePath))) {
        findings.push({
          severity: strictSeverity,
          rule: "evidence.missing",
          path: rel,
          message: `Evidence source does not exist: ${evidenceReference.source}.`
        });
        continue;
      }

      if (evidenceReference.locator?.kind === "line") {
        const lineCount = await getLineCount(absoluteSourcePath, lineCountByPath);
        if (evidenceReference.locator.end > lineCount) {
          findings.push({
            severity: strictSeverity,
            rule: "evidence.line_range",
            path: rel,
            message: `Evidence line range is outside ${evidenceReference.source}: ${evidenceReference.locator.start}-${evidenceReference.locator.end} (file has ${lineCount} line${lineCount === 1 ? "" : "s"}).`
          });
        }
      }
    }
  }

  return findings;
}

async function scanEvidenceSections(cwd, options = {}) {
  const findings = [];
  const strictSeverity = evidenceStrictSeverity(options);

  for (const file of await listTargetMarkdown(cwd)) {
    const rel = toPosix(path.relative(cwd, file));
    const content = await readUtf8(file);
    const parsed = parseFrontmatter(content);
    const section = extractMarkdownSection(parsed.body, "Evidence");
    const frontmatterEvidence = Array.isArray(parsed.frontmatter?.evidence)
      ? parsed.frontmatter.evidence.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
      : [];

    if (!section && frontmatterEvidence.length === 0) continue;

    if (!section) {
      findings.push({
        severity: strictSeverity,
        rule: "evidence.section_missing",
        path: rel,
        message: "Document has frontmatter evidence entries but no body ## Evidence section."
      });
      continue;
    }

    if (section.bullets.length === 0) {
      findings.push({
        severity: strictSeverity,
        rule: "evidence.section_empty",
        path: rel,
        message: "Body ## Evidence section should contain at least one bullet entry."
      });
    }

    for (const reference of frontmatterEvidence) {
      if (!section.text.includes(reference)) {
        findings.push({
          severity: strictSeverity,
          rule: "evidence.section_unlisted",
          path: rel,
          message: `Frontmatter evidence entry is not mentioned in body ## Evidence: ${reference}.`
        });
      }
    }
  }

  return findings;
}

function evidenceStrictSeverity(options) {
  return options.strict ? "error" : "warning";
}

// Which local files a verified document's freshness depends on, and the
// review baseline to compare against. Pure so it can be tested without git.
export function driftTargets(frontmatter) {
  if (frontmatter?.status !== "verified") return null;

  const reviewedAt = typeof frontmatter.reviewed_at === "string" && /^\d{4}-\d{2}-\d{2}$/.test(frontmatter.reviewed_at)
    ? frontmatter.reviewed_at
    : null;
  const lastUpdated = typeof frontmatter.last_updated === "string" && /^\d{4}-\d{2}-\d{2}$/.test(frontmatter.last_updated)
    ? frontmatter.last_updated
    : null;
  const baseline = reviewedAt ?? lastUpdated;
  if (!baseline) return null;

  // source_files are broad anchors (the whole file backs the document).
  const sources = [];
  for (const entry of Array.isArray(frontmatter.source_files) ? frontmatter.source_files : []) {
    if (typeof entry !== "string") continue;
    const base = entry.split("#")[0].trim();
    if (!base || isExternalSourceReference(base)) continue;
    if (!sources.includes(base)) sources.push(base);
  }

  // evidence entries carry a locator (line/symbol/section/route) that can refine
  // the drift check to a specific line range when it is a line locator.
  const evidenceRefs = [];
  for (const entry of Array.isArray(frontmatter.evidence) ? frontmatter.evidence : []) {
    if (typeof entry !== "string") continue;
    const parsedRef = parseEvidenceReference(entry.trim());
    if (!parsedRef || parsedRef.external) continue;
    const base = parsedRef.source;
    if (!base || isExternalSourceReference(base)) continue;
    evidenceRefs.push({ base, locator: parsedRef.locator });
  }

  const files = [];
  for (const base of [...sources, ...evidenceRefs.map((ref) => ref.base)]) {
    if (!files.includes(base)) files.push(base);
  }

  return { baseline, files, sources, evidenceRefs };
}

// Flags verified documents whose referenced files changed in git after the
// review baseline. When a file is cited ONLY by exact line ranges in evidence
// (no broad source_files/symbol/section/route anchor), the check narrows to
// those line ranges so unrelated edits elsewhere in the file are not drift.
// Best-effort: silently skips when git is unavailable, and falls back to the
// file-level check if a line-range query fails (e.g. an out-of-range line).
async function scanEvidenceDrift(cwd) {
  const findings = [];
  for (const file of await listTargetMarkdown(cwd)) {
    const rel = toPosix(path.relative(cwd, file));
    const parsed = parseFrontmatter(await readUtf8(file));
    const targets = driftTargets(parsed.frontmatter);
    if (!targets) continue;

    // Split references into broad (whole-file) and line-range-only per file.
    const broadFiles = new Set(targets.sources);
    const lineRangesByFile = new Map();
    for (const ref of targets.evidenceRefs) {
      if (ref.locator && ref.locator.kind === "line") {
        if (!lineRangesByFile.has(ref.base)) lineRangesByFile.set(ref.base, []);
        lineRangesByFile.get(ref.base).push({ start: ref.locator.start, end: ref.locator.end });
      } else {
        broadFiles.add(ref.base); // bare file, symbol, section, or route → whole-file
      }
    }

    for (const base of targets.files) {
      if (!(await pathExists(path.join(cwd, base)))) continue;
      const ranges = lineRangesByFile.get(base);
      const lineOnly = !broadFiles.has(base) && Array.isArray(ranges) && ranges.length > 0;

      if (lineOnly) {
        let staleRange = null;
        let fallbackFileLevel = false;
        for (const range of ranges) {
          try {
            if (lineRangeChangedSince(cwd, base, range.start, range.end, targets.baseline)) {
              staleRange = range;
              break;
            }
          } catch {
            fallbackFileLevel = true;
            break;
          }
        }
        if (fallbackFileLevel) {
          if (fileChangedSinceSafe(cwd, base, targets.baseline)) {
            findings.push(driftFinding(rel, `${base}`, targets.baseline));
          }
        } else if (staleRange) {
          findings.push(driftFinding(rel, `${base}#L${staleRange.start}-L${staleRange.end}`, targets.baseline));
        }
      } else if (fileChangedSinceSafe(cwd, base, targets.baseline)) {
        findings.push(driftFinding(rel, `${base}`, targets.baseline));
      }
    }
  }
  return findings;
}

function fileChangedSinceSafe(cwd, base, baseline) {
  try {
    return fileChangedSince(cwd, base, baseline);
  } catch {
    return false;
  }
}

function driftFinding(rel, reference, baseline) {
  return {
    severity: "warning",
    rule: "evidence.stale",
    path: rel,
    message: `Verified document references ${reference}, which changed after ${baseline}; re-review and update it or downgrade to needs_review.`
  };
}

async function scanOkfProfile(cwd, activeProfiles = []) {
  if (!activeProfiles.includes("okf-v0.1")) return [];

  const wikiRoot = path.join(cwd, "docs", "llm-wiki");
  const markdownFiles = await listTargetMarkdown(cwd);
  const targetFiles = (await pathExists(wikiRoot))
    ? markdownFiles.filter((file) => toPosix(path.relative(cwd, file)).startsWith("docs/llm-wiki/"))
    : markdownFiles;
  const findings = [];

  for (const file of targetFiles) {
    const rel = toPosix(path.relative(cwd, file));
    const content = await readUtf8(file);
    const parsed = parseFrontmatter(content);
    if (!parsed.frontmatter) continue;

    if (!parsed.frontmatter.type) {
      findings.push({
        severity: "error",
        rule: "okf.type_required",
        path: rel,
        message: "OKF v0.1 profile requires frontmatter field: type."
      });
    } else if (typeof parsed.frontmatter.type !== "string") {
      findings.push({
        severity: "error",
        rule: "okf.type_shape",
        path: rel,
        message: "OKF v0.1 frontmatter field type must be a string."
      });
    }

    for (const arrayField of ["aliases", "tags"]) {
      if (arrayField in parsed.frontmatter && !Array.isArray(parsed.frontmatter[arrayField])) {
        findings.push({
          severity: "error",
          rule: "okf.array_shape",
          path: rel,
          message: `OKF v0.1 frontmatter field ${arrayField} must be an array when present.`
        });
      }
    }
  }

  return findings;
}

async function scanMarkdownLinks(cwd) {
  const wikiRoot = path.join(cwd, "docs", "llm-wiki");
  if (!(await pathExists(wikiRoot))) return [];

  const findings = [];
  for (const file of await listMarkdownFiles(wikiRoot)) {
    const rel = toPosix(path.relative(cwd, file));
    const content = await readUtf8(file);

    for (const target of extractMarkdownLinkTargets(content)) {
      const link = normalizeMarkdownLinkTarget(target);
      if (!link || isSkippedMarkdownLink(link)) continue;

      const absoluteTarget = resolveMarkdownLinkTarget(cwd, file, link);
      if (!(await pathExists(absoluteTarget))) {
        findings.push({
          severity: "warning",
          rule: "markdown_link.missing",
          path: rel,
          message: `Markdown link target does not exist: ${link}.`
        });
      }
    }
  }
  return findings;
}

async function scanWikiLinks(cwd) {
  return (await collectWikiGraph(cwd)).findings;
}

// ---- graph command (knowledge graph as text/json/mermaid/dot) -----------
// Read-only. Emits the wiki knowledge graph (documents + resolved doc→doc edges
// from wiki/related/markdown links) built by collectWikiGraph. `--format` for
// graph accepts text|json|mermaid|dot (mermaid/dot are graph-only tokens).
export async function graphCommand(options) {
  const graph = await collectWikiGraph(options.cwd);
  const format = options.format;

  const summaryLines = [
    `documents: ${graph.summary.documents}`,
    `edges: ${graph.summary.edges}`,
    `orphan_documents: ${graph.summary.orphanDocuments}`,
    `unresolved_wiki_links: ${graph.summary.unresolvedWikiLinks}`,
    `aliases: ${graph.summary.aliases}`
  ];
  if (graph.summary.documents === 0) summaryLines.push("wiki: not initialized (run init --write first)");

  const structured = {
    summary: graph.summary,
    documents: graph.documents.map((doc) => ({ path: doc.path, title: doc.title, aliases: doc.aliases, inboundCount: doc.inboundCount })),
    edges: graph.edges,
    orphanDocuments: graph.orphanDocuments,
    unresolvedConcepts: graph.unresolvedConcepts,
    aliases: graph.aliases
  };

  const result = withText({
    command: "graph",
    format,
    graph: structured,
    findings: []
  }, "LLM-WIKI Graph", [
    { title: "Summary", body: summaryLines },
    { title: "Orphan Documents", body: graph.orphanDocuments },
    { title: "Unresolved Wiki Links", body: graph.unresolvedConcepts.map((concept) => `${concept.target} ← ${concept.sources.join(", ")}`) }
  ]);

  if (format === "mermaid") result.text = renderGraphMermaid(graph);
  else if (format === "dot") result.text = renderGraphDot(graph);

  return result;
}

// ---- stats command (wiki health score) ---------------------------------
// Read-only. Aggregates a health snapshot: document status mix, verified %,
// enrichment %, evidence coverage %, staleness, and orphans. Reuses the audit
// findings (content.not_enriched, evidence.stale) and the wiki graph.
export async function statsCommand(options) {
  const cwd = options.cwd;
  const files = await listTargetMarkdown(cwd);
  const total = files.length;

  const statusCounts = {};
  let evidenceBacked = 0;
  for (const file of files) {
    const parsed = parseFrontmatter(await readUtf8(file));
    const status = typeof parsed.frontmatter?.status === "string" ? parsed.frontmatter.status : "unknown";
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
    const evidence = Array.isArray(parsed.frontmatter?.evidence) ? parsed.frontmatter.evidence.filter((item) => typeof item === "string" && item.trim()) : [];
    const sourceFiles = Array.isArray(parsed.frontmatter?.source_files) ? parsed.frontmatter.source_files.filter((item) => typeof item === "string" && item.trim()) : [];
    if (evidence.length > 0 || sourceFiles.length > 0) evidenceBacked += 1;
  }

  const auditResult = await audit(options);
  const findings = auditResult.findings ?? [];
  const uniquePathsFor = (rule) => new Set(findings.filter((finding) => finding.rule === rule).map((finding) => finding.path)).size;
  const notEnriched = uniquePathsFor("content.not_enriched");
  const staleVerified = uniquePathsFor("evidence.stale");
  const orphanDocuments = auditResult.wikiGraph?.summary?.orphanDocuments ?? 0;

  const verified = statusCounts.verified ?? 0;
  const enriched = Math.max(0, total - notEnriched);
  const pct = (value) => (total === 0 ? 0 : Math.round((value / total) * 100));
  const verifiedPct = pct(verified);
  const enrichedPct = pct(enriched);
  const evidencePct = pct(evidenceBacked);
  const healthScore = total === 0 ? 0 : Math.round((verifiedPct + enrichedPct + evidencePct) / 3);

  const summaryLines = [
    `documents: ${total}`,
    `health_score: ${healthScore}/100`,
    `verified: ${verified} (${verifiedPct}%)`,
    `enriched: ${enriched} (${enrichedPct}%)`,
    `evidence_coverage: ${evidenceBacked} (${evidencePct}%)`,
    `stale_verified: ${staleVerified}`,
    `orphan_documents: ${orphanDocuments}`
  ];
  if (total === 0) summaryLines.push("wiki: not initialized (run init --write first)");
  const statusLines = Object.keys(statusCounts).sort().map((status) => `${status}: ${statusCounts[status]}`);

  return withText({
    command: "stats",
    result: "pass",
    stats: {
      documents: total,
      healthScore,
      status: statusCounts,
      verified,
      verifiedPct,
      enriched,
      enrichedPct,
      notEnriched,
      evidenceBacked,
      evidencePct,
      staleVerified,
      orphanDocuments
    },
    findings: []
  }, "LLM-WIKI Stats", [
    { title: "Summary", body: summaryLines },
    { title: "Document Status", body: statusLines.length ? statusLines : ["none"] },
    { title: "Caveats", body: ["Read-only health snapshot. enriched% counts documents without a content.not_enriched flag; evidence_coverage counts documents citing source_files or evidence. Health score is the mean of verified%, enriched%, and evidence_coverage%."] }
  ]);
}

function renderGeneratedWikiDoc(rel, detection, lastUpdated = todayIsoDate(), domainContext = emptyDomainContext()) {
  const meta = docMetadata(rel, detection, lastUpdated, domainContext);
  const project = detection.projectName ?? "project";

  return renderWikiDocumentTemplate({
    title: meta.title,
    docType: meta.docType,
    project,
    lastUpdated,
    sourceFiles: meta.sourceFiles,
    related: meta.related,
    body: meta.body
  });
}

// Renders a wiki document from a project-local override template (config
// `templates`). GUARDRAIL: only the override's BODY is used — the standard CLI
// frontmatter (status: needs_review) always wraps it via
// renderWikiDocumentTemplate, so an override can NEVER produce status: verified
// (any frontmatter in the override file is parsed off and discarded). Returns
// { content, missing }; missing is true when the override file is absent.
async function renderOverriddenDoc(cwd, rel, overridePath, detection, lastUpdated, domainContext) {
  const abs = path.join(cwd, overridePath);
  if (!(await pathExists(abs))) return { content: null, missing: true };
  const meta = docMetadata(rel, detection, lastUpdated, domainContext);
  const project = detection.projectName ?? "project";
  const rendered = renderTemplate(await readUtf8(abs), {
    title: meta.title,
    doc_type: meta.docType,
    project,
    last_updated: lastUpdated
  });
  const parsed = parseFrontmatter(rendered);
  const body = parsed.frontmatter ? parsed.body : rendered;
  const content = renderWikiDocumentTemplate({
    title: meta.title,
    docType: meta.docType,
    project,
    lastUpdated,
    sourceFiles: meta.sourceFiles,
    related: meta.related,
    body
  });
  return { content, missing: false };
}

function plannedDocs(projectType, minimal, profiles = []) {
  if (minimal) return CORE_REQUIRED_DOCS;
  const profileDocs = profiles.flatMap((profile) => PROFILE_DOCS[profile] ?? []);
  return [...new Set([...CORE_REQUIRED_DOCS, ...(PROFILE_DOCS[projectType] ?? PROFILE_DOCS.unknown), ...profileDocs])];
}

// ---- backend/fullstack domain detection --------------------------------
// Detect business domains so init can create a per-domain doc next to the
// overview. Two conventions, boundary-based only (no class/name inference, no
// LLM, no invented business meaning; GATE_REVIEW "Domain Detection Scope",
// Gate 10):
//   - directory domains: a folder per domain under domains/domain/modules/features
//   - file domains: a route/resource module file per domain under
//     endpoints/routers/routes/resources/controllers/handlers (e.g. FastAPI
//     app/api/api_v2/endpoints/hazard.py)
// The search is bounded to the project tree, skips vendored/generated/test dirs,
// and applies aggregator/infra exclusions to keep false positives near zero.
// Detection I/O is best-effort; planning is pure and exported for unit tests.

async function detectPackageManager(cwd) {
  if (await pathExists(path.join(cwd, "yarn.lock"))) return "yarn";
  if (await pathExists(path.join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (await pathExists(path.join(cwd, "package-lock.json"))) return "npm";
  return null;
}

async function inspectPackageReadiness(cwd) {
  const packagePath = path.join(cwd, "package.json");
  if (!(await pathExists(packagePath))) return [];

  let packageJson = null;
  try {
    packageJson = JSON.parse(await readUtf8(packagePath));
  } catch {
    return ["package_json: unreadable"];
  }

  if (!packageJson?.bin?.["llm-wiki"]) return [];

  const checklistExists = await pathExists(path.join(cwd, "RELEASE_CHECKLIST.md"));
  return [
    `package_name: ${packageJson.name ?? "missing"}`,
    `version: ${packageJson.version ?? "missing"}`,
    `private: ${packageJson.private === true ? "true" : "false"}`,
    `bin.llm-wiki: ${packageJson.bin["llm-wiki"]}`,
    `release_checklist: ${checklistExists ? "present" : "missing"}`,
    "recommended_release_level: stable",
    "migrate_apply: keep blocked",
    "external_shells: verify in release CI before publish"
  ];
}

function buildNextActions(auditResult, options) {
  const actions = [];
  const seen = new Set();
  const findings = auditResult.findings ?? [];
  const wikiGraph = auditResult.wikiGraph ?? emptyWikiGraph();

  const add = (action) => {
    if (seen.has(action.id)) return;
    seen.add(action.id);
    actions.push(action);
  };

  if (findings.some((finding) => finding.severity === "blocked")) {
    add(nextAction({
      id: "blocked-sensitive",
      priority: "blocked",
      title: "Remove blocked safety findings",
      reason: "Blocked findings must be resolved before generated reports or release checks are safe.",
      command: "llm-wiki audit",
      findings: findings.filter((finding) => finding.severity === "blocked")
    }));
  }

  if (findings.some((finding) => finding.rule === "structure.wiki_missing")) {
    add(nextAction({
      id: "initialize-wiki",
      priority: "high",
      title: "Initialize the LLM-WIKI structure",
      reason: "The project does not have docs/llm-wiki/index.md yet.",
      command: "llm-wiki init --write",
      findings: findings.filter((finding) => finding.rule === "structure.wiki_missing")
    }));
  }

  if (findings.some((finding) => finding.rule === "structure.required_doc")) {
    add(nextAction({
      id: "create-required-docs",
      priority: "high",
      title: "Create missing required or profile documents",
      reason: "Required LLM-WIKI documents are missing for the active project type or profiles.",
      command: "llm-wiki init --write",
      findings: findings.filter((finding) => finding.rule === "structure.required_doc")
    }));
  }

  if (findings.some((finding) => finding.rule?.startsWith("frontmatter."))) {
    add(nextAction({
      id: "repair-frontmatter",
      priority: "high",
      title: "Repair frontmatter contract violations",
      reason: "Frontmatter errors can block reliable validation, reports, and downstream agents.",
      command: options.strict ? "llm-wiki validate-frontmatter --strict" : "llm-wiki validate-frontmatter",
      findings: findings.filter((finding) => finding.rule?.startsWith("frontmatter."))
    }));
  }

  if (findings.some((finding) => finding.rule?.startsWith("okf."))) {
    add(nextAction({
      id: "repair-okf-profile",
      priority: "high",
      title: "Repair OKF v0.1 metadata",
      reason: "OKF profile documents need explicit type fields and valid aliases/tags arrays.",
      command: "llm-wiki validate --profile okf-v0.1",
      findings: findings.filter((finding) => finding.rule?.startsWith("okf."))
    }));
  }

  if (findings.some((finding) => finding.rule === "source_files.missing")) {
    add(nextAction({
      id: "repair-source-files",
      priority: "medium",
      title: "Fix missing source evidence references",
      reason: "source_files entries should point to existing local files or explicit external references.",
      command: "llm-wiki audit",
      findings: findings.filter((finding) => finding.rule === "source_files.missing")
    }));
  }

  if (findings.some((finding) => finding.rule?.startsWith("evidence."))) {
    add(nextAction({
      id: "repair-evidence-references",
      priority: findings.some((finding) => finding.rule === "evidence.shape") ? "high" : "medium",
      title: "Fix precise evidence references",
      reason: "evidence entries should use supported file, line, symbol, section, or route references that can be checked from the project root.",
      command: "llm-wiki validate",
      findings: findings.filter((finding) => finding.rule?.startsWith("evidence."))
    }));
  }

  if (findings.some((finding) => finding.rule === "markdown_link.missing")) {
    add(nextAction({
      id: "repair-markdown-links",
      priority: "medium",
      title: "Fix missing Markdown links",
      reason: "Broken local Markdown links make wiki navigation unreliable.",
      command: "llm-wiki validate",
      findings: findings.filter((finding) => finding.rule === "markdown_link.missing")
    }));
  }

  if (findings.some((finding) => finding.rule === "wiki_link.missing")) {
    add(nextAction({
      id: "repair-wiki-links",
      priority: "medium",
      title: "Resolve missing wiki link targets",
      reason: "Unresolved [[wiki links]] should point to a file path, basename, title, or alias.",
      command: "llm-wiki validate",
      findings: findings.filter((finding) => finding.rule === "wiki_link.missing")
    }));
  }

  if (wikiGraph.unresolvedConcepts.length > 0) {
    add({
      id: "review-unresolved-concepts",
      priority: "medium",
      category: "wiki_graph",
      title: "Review unresolved concepts",
      reason: `${wikiGraph.unresolvedConcepts.length} wiki-link target(s) are unresolved in wikiGraph.`,
      command: "llm-wiki audit --format markdown",
      paths: unique(wikiGraph.unresolvedConcepts.flatMap((item) => item.sources)),
      targets: wikiGraph.unresolvedConcepts.map((item) => item.target)
    });
  }

  if (findings.some((finding) => finding.rule === "adapter.missing")) {
    const agents = selectedAgents(options);
    add(nextAction({
      id: "create-selected-adapters",
      priority: "medium",
      title: "Create selected adapter entrypoints",
      reason: "Selected agents need their adapter files before handoff workflows are smooth.",
      command: agents.length ? `llm-wiki init --write ${agents.map((agent) => `--agent ${agent}`).join(" ")}` : "llm-wiki init --write --agent codex",
      findings: findings.filter((finding) => finding.rule === "adapter.missing")
    }));
  }

  if (findings.some((finding) => finding.rule?.startsWith("encoding."))) {
    add(nextAction({
      id: "review-encoding",
      priority: "low",
      title: "Review encoding findings",
      reason: "Encoding issues such as BOM or mojibake can make generated docs harder to diff and review.",
      command: "llm-wiki audit",
      findings: findings.filter((finding) => finding.rule?.startsWith("encoding."))
    }));
  }

  if (wikiGraph.orphanDocuments.length > 0) {
    add({
      id: "connect-orphan-documents",
      priority: "low",
      category: "wiki_graph",
      title: "Connect orphan wiki documents",
      reason: `${wikiGraph.orphanDocuments.length} document(s) have no inbound wiki links.`,
      command: "llm-wiki status",
      paths: wikiGraph.orphanDocuments,
      targets: []
    });
  }

  return actions.sort(compareNextActions);
}

function nextAction({ id, priority, title, reason, command, findings }) {
  return {
    id,
    priority,
    category: findingCategory(findings[0]?.rule),
    title,
    reason,
    command,
    paths: unique(findings.map((finding) => finding.path).filter(Boolean)),
    targets: []
  };
}

function compareNextActions(left, right) {
  const priorityOrder = { blocked: 0, high: 1, medium: 2, low: 3 };
  const leftPriority = priorityOrder[left.priority] ?? 9;
  const rightPriority = priorityOrder[right.priority] ?? 9;
  return leftPriority - rightPriority || left.title.localeCompare(right.title);
}

function unique(values) {
  return [...new Set(values)];
}

async function summarizeDocumentStatuses(cwd, markdownFiles) {
  const counts = Object.fromEntries([...VALID_STATUSES].map((status) => [status, 0]));
  counts.unknown = 0;
  const findings = [];

  for (const file of markdownFiles) {
    const rel = toPosix(path.relative(cwd, file));
    const content = await readUtf8(file);
    const parsed = parseFrontmatter(content);

    for (const message of parsed.errors) {
      findings.push({ severity: "error", rule: "frontmatter.parse", path: rel, message });
    }
    for (const finding of validateFrontmatter(parsed.frontmatter)) {
      findings.push({ ...finding, path: rel });
    }

    const status = parsed.frontmatter?.status;
    if (status && VALID_STATUSES.has(status)) {
      counts[status] += 1;
    } else {
      counts.unknown += 1;
    }
  }

  return {
    filesChecked: markdownFiles.length,
    counts,
    findings
  };
}

function statusNextSteps(initialized, counts, findings, agents) {
  const steps = [];
  if (!initialized) {
    steps.push("Run llm-wiki quickstart --write with the appropriate --type and --agent.");
  }
  if ((counts.needs_review ?? 0) > 0) {
    steps.push("Run llm-wiki handoff --agent codex or --agent claude, then ask the agent to enrich needs_review docs from source evidence.");
  }
  if (findings.some((finding) => finding.rule === "structure.required_doc")) {
    steps.push("Run llm-wiki init --write to create missing recommended docs, or review whether the selected profile is correct.");
  }
  if (agents.length === 0) {
    steps.push("Pass --agent codex or --agent claude when you want adapter status and handoff guidance.");
  }
  if (steps.length === 0) {
    steps.push("Run llm-wiki validate before CI or release.");
  }
  return steps;
}

function quickstartInitSummary(initResult) {
  const lines = [];
  if (initResult.result) lines.push(`result: ${initResult.result}`);
  if (initResult.detection) {
    lines.push(`project_type: ${initResult.detection.projectType}`);
    lines.push(`confidence: ${initResult.detection.confidence}`);
  }
  if (initResult.created?.length) lines.push(`created: ${initResult.created.length}`);
  if (initResult.overwritten?.length) lines.push(`overwritten: ${initResult.overwritten.length}`);
  if (initResult.planned?.length) lines.push(`planned: ${initResult.planned.length}`);
  if (initResult.skipped?.length) lines.push(`skipped: ${initResult.skipped.length}`);
  if (initResult.blocked?.length) lines.push(`blocked: ${initResult.blocked.length}`);
  return lines;
}

function buildHandoff(options, detection = null) {
  const agents = selectedAgents(options);
  const supportedAgents = agents.length === 0
    ? ["codex", "claude"]
    : agents.filter((agent) => ADAPTER_TARGETS[agent]?.handoffLabel);
  const unsupportedAgents = agents.filter((agent) => ADAPTER_TARGETS[agent] && !ADAPTER_TARGETS[agent].handoffLabel);
  const projectType = detection?.projectType ?? options.type ?? "unknown";
  const evidenceGuidance = handoffEvidenceGuidance(projectType);
  const completionPrefix = options.dryRun && !options.write
    ? "CLI 미리보기가 완료되었습니다. 실제 파일 생성 후"
    : "CLI 작업이 완료되었습니다.";
  const findings = unsupportedAgents.map((agent) => ({
    severity: supportedAgents.length > 0 ? "warning" : "blocked",
    rule: "handoff.unsupported_agent",
    path: ".",
    message: `${agent} handoff is not available because the adapter contract is unconfirmed.`
  }));
  const label = handoffLabel(supportedAgents);
  const entrypoints = handoffEntrypoints(supportedAgents);
  const unsupportedNote = unsupportedAgents.length > 0
    ? ` ${unsupportedAgents.join(", ")} handoff는 adapter contract가 확정되지 않아 아직 지원하지 않습니다.`
    : "";

  if (supportedAgents.length === 0) {
    return {
      agents,
      supportedAgents,
      unsupportedAgents,
      projectType,
      evidenceGuidance,
      label: unsupportedAgents.join(", "),
      entrypoints: "docs/llm-wiki/index.md",
      message: `${completionPrefix} ${unsupportedNote.trim()}`,
      prompt: "No Codex or Claude Code handoff prompt is available for the selected agent. Select --agent codex or --agent claude, or run the next documentation work manually after reviewing docs/llm-wiki/index.md.",
      findings
    };
  }

  const message = `${completionPrefix} ${label}에게 넘어가서 아래 프롬프트를 실행하세요.`;
  const prompt = `${entrypoints} 먼저 읽어주세요.
그 다음 실제 코드, 설정 파일, 라우팅, API, 데이터 모델, 주요 워크플로우를 근거로 docs/llm-wiki 문서를 보강해주세요.
${evidenceGuidance.join("\n")}
When a domain document mentions API usage, include this API Services inventory:
${apiServiceInventoryChecklist().join("\n")}
CLI가 생성한 초안과 에이전트가 수정한 문서는 needs_review 상태로 유지해주세요.
verified 승인은 하지 말고, 사람이 검토해야 할 항목과 근거 부족 항목을 docs/llm-wiki/log.md에 append-only로 남겨주세요.
민감정보 raw value는 문서나 리포트에 기록하지 말고, 필요한 경우 redacted 형태로만 설명해주세요.
작업이 끝나면 변경한 파일 목록, 확인한 source file, 남은 review item을 요약해주세요.`;

  return {
    agents,
    supportedAgents,
    unsupportedAgents,
    projectType,
    evidenceGuidance,
    label,
    entrypoints,
    message: `${message}${unsupportedNote}`,
    prompt,
    findings
  };
}

function handoffLabel(agents) {
  const labels = agents.map((agent) => ADAPTER_TARGETS[agent]?.handoffLabel).filter(Boolean);
  return labels.join(" 또는 ") || "Codex 또는 Claude Code";
}

function handoffEvidenceGuidance(projectType) {
  const guidance = {
    frontend: [
      "Frontend evidence focus:",
      "- Inspect routes, pages, components, state management, API clients, accessibility behavior, and end-to-end user workflows."
    ],
    backend: [
      "Backend evidence focus:",
      "- Inspect API routes, controllers, services, data models, persistence, auth/security boundaries, jobs, and operational configuration."
    ],
    fullstack: [
      "Fullstack evidence focus:",
      "- Inspect UI flows, API contracts, client/server boundaries, shared schemas, environment configuration, data model changes, and release flow."
    ],
    library: [
      "Library evidence focus:",
      "- Inspect public exports, package entrypoints, type declarations, examples, versioning policy, compatibility guarantees, and release flow."
    ]
  };

  return guidance[projectType] ?? [
    "General evidence focus:",
    "- Inspect the files referenced by source_files first, then map architecture, workflows, configuration, tests, and open review questions from real code evidence."
  ];
}

function handoffEntrypoints(agents) {
  const adapterPaths = agents.map((agent) => ADAPTER_TARGETS[agent]?.path).filter(Boolean);
  const files = [...adapterPaths, "docs/llm-wiki/index.md"];
  return `${files.join("와 ")}를`;
}
