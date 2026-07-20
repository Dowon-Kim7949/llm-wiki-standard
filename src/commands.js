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
import { isAppendOnlyLog, listTargetMarkdown } from "./commands/wiki-files.js";
import {
  ADAPTER_TARGETS,
  planAdapterSuggestions,
  scanAdapters,
  selectedAgents,
  summarizeAdapterStatus,
  writeAdapterFiles
} from "./commands/adapters.js";
import {
  scanEncoding,
  scanEnrichment,
  scanEvidenceDrift,
  scanEvidenceReferences,
  scanEvidenceSections,
  scanMarkdownLinks,
  scanOkfProfile,
  scanRelatedReferences,
  scanSensitive,
  scanSourceFiles,
  scanThinBody,
  scanVisibilityConsistency
} from "./commands/scans.js";
import {
  analyzeBlockVersions,
  blockVersionGapDocs,
  blockedApply,
  buildUpgradeReport,
  needsWriteFlag,
  runMechanicalRemediation
} from "./commands/fix-migrate.js";
export { detectDomainDirectories, domainDisplayName, normalizeDomainSlug, planDomainDocs } from "./commands/domains.js";
export { driftTargets } from "./commands/scans.js";
export { driftCommand, fixCommand } from "./commands/fix-migrate.js";

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

// migrateCommand stays in commands.js (not fix-migrate.js) because it calls the
// audit() pipeline; keeping it beside audit avoids a commands.js<->fix-migrate.js
// import cycle. Its block-version and remediation helpers live in fix-migrate.js.
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
    return needsWriteFlag("quickstart", "Preview the setup with quickstart --dry-run, or run quickstart --write to create the missing LLM-WIKI files and print the Codex/Claude Code handoff prompt.");
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
    { title: "Next Step", body: handoffNextStep(handoff) },
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
    { title: "Next Step", body: handoffNextStep(handoff) },
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

  return needsWriteFlag("init", "Preview the changes with init --dry-run, or run init --write to create the missing LLM-WIKI files. Existing wiki docs are kept (--existing skip by default).");
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
  // Annotate the skipped count with the dominant reason ("already exist") so a
  // brownfield run that skips everything doesn't read as "the tool did nothing".
  if (initResult.skipped?.length) {
    const existing = initResult.skipped.filter((line) => /\bexists\b/i.test(line)).length;
    lines.push(`skipped: ${initResult.skipped.length}${existing ? ` (${existing} already exist, kept)` : ""}`);
  }
  if (initResult.blocked?.length) lines.push(`blocked: ${initResult.blocked.length}`);
  // Brownfield hint: when nothing new is created or planned but docs already exist,
  // the value comes from enriching the existing docs (handoff prompt), not re-running init.
  const newDocs = (initResult.created?.length ?? 0)
    + (initResult.planned?.filter((line) => line.includes("would be created")).length ?? 0);
  const existingSkips = initResult.skipped?.filter((line) => /\bexists\b/i.test(line)).length ?? 0;
  if (newDocs === 0 && existingSkips > 0) {
    lines.push("note: LLM-WIKI가 이미 있어 새로 만들 문서가 없습니다 — 아래 handoff 프롬프트로 기존 문서를 코드 근거로 보강하세요(스캐폴드를 다시 만들려면 --existing overwrite).");
  }
  return lines;
}

// The "Next Step" body: the short handoff message plus a concrete, self-contained
// run guide. The exposure test showed users don't realize the "Handoff Prompt" is
// meant to be pasted into their coding agent (not "run" by the CLI) — this spells
// that out. Only added when a real prompt exists (a supported agent); the
// unsupported-agent case keeps just the message.
function handoffNextStep(handoff) {
  if (!handoff.supportedAgents?.length) return [handoff.message];
  return [
    handoff.message,
    "실행 방법 — 아래 'Handoff Prompt'는 CLI가 실행하는 게 아니라 코딩 에이전트에게 넘기는 지시문입니다:",
    "1) 이 저장소를 연 Claude Code 또는 Codex 세션에 아래 프롬프트를 그대로 붙여넣으세요. 이미 이 저장소의 Claude Code 안이라면 여기에 바로 붙여넣으면 됩니다.",
    "2) 에이전트가 실제 코드를 읽고 docs/llm-wiki 문서를 근거와 함께 채웁니다. backend/fullstack은 도메인별 domains/*.md도 함께 보강됩니다.",
    "3) 결과를 사람이 검토해 정확하면 status를 verified로 올리세요(구조 점검은 llm-wiki validate)."
  ];
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
  // Only name adapter files for agents the caller explicitly selected. Without an
  // explicit --agent, init/quickstart create no adapter files, so defaulting the
  // entrypoint to codex+claude would tell the receiving agent to first read an
  // AGENTS.md/CLAUDE.md that was never created. The wiki index always exists after
  // setup, so it stays the reliable anchor. An explicit --agent still names that
  // agent's adapter file (the caller committed to that tool's convention).
  const entrypointAgents = agents.length > 0 ? supportedAgents : [];
  const entrypoints = handoffEntrypoints(entrypointAgents);
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
