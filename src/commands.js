import { mkdir, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CORE_REQUIRED_DOCS, CURRENT_WIKI_BLOCK_VERSION, PROFILE_DOCS, VALID_STATUSES } from "./config.js";
import { detectProject } from "./detector.js";
import { findMojibakeIndicators, hasUtf8Bom, readUtf8, writeUtf8 } from "./encoding.js";
import { listMarkdownFiles, pathExists, toPosix } from "./files.js";
import { hasRequiredField, parseFrontmatter, validateFrontmatter } from "./frontmatter.js";
import { schemaRequiredFields } from "./frontmatter-schema.js";
import { renderTextReport } from "./report.js";
import { scanSensitiveInfo } from "./sensitive-info.js";
import { renderWikiDocumentTemplate, todayIsoDate } from "./template-renderer.js";
import { apiServiceInventoryChecklist, buildTaskPrompt } from "./task-prompts.js";
import { buildReleaseNotes, collectCommits } from "./release-notes.js";
import { fileChangedSince, lineRangeChangedSince, changedFiles } from "./git.js";

const TEMPLATE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "templates");

const ADAPTER_TARGETS = {
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

const FINDING_EXPLANATIONS = {
  "structure.wiki_missing": findingExplanation("structure", "warning", "The project does not have docs/llm-wiki/index.md, so LLM-WIKI is not initialized.", "Agents and CI need a stable wiki entrypoint before they can follow the documentation contract.", ["Ask whether the project should be initialized now.", "Run init --dry-run first when you want to preview files.", "Run init --write when you are ready to create the missing wiki structure."], ["llm-wiki init --dry-run", "llm-wiki init --write", "llm-wiki status"], ["structure.required_doc"]),
  "structure.required_doc": findingExplanation("structure", "warning", "A required core, project-type, or profile document is missing.", "Missing required documents leave agents without expected project, domain, API, or profile context.", ["Review the path reported in the finding.", "Create the document with status needs_review.", "Use init --write to create missing standard templates when appropriate."], ["llm-wiki init --dry-run", "llm-wiki init --write", "llm-wiki validate"], ["structure.wiki_missing"]),
  "frontmatter.exists": findingExplanation("frontmatter", "error", "A markdown file does not start with YAML frontmatter fences.", "LLM-WIKI tools cannot validate status, source evidence, visibility, or review metadata without frontmatter.", ["Add a YAML frontmatter block at the top of the file.", "Include every required LLM-WIKI field.", "Run frontmatter validation again."], ["llm-wiki validate-frontmatter"], ["frontmatter.required", "frontmatter.parse"]),
  "frontmatter.required": findingExplanation("frontmatter", "error", "A markdown file is missing one of the required LLM-WIKI frontmatter fields.", "Required metadata keeps documents searchable, reviewable, and safe for automation.", ["Open the reported markdown file.", "Add the missing field shown in the finding.", "Keep AI-created or AI-edited documents at status needs_review until human review."], ["llm-wiki validate-frontmatter", "llm-wiki validate-frontmatter --strict"], ["frontmatter.exists", "frontmatter.array"]),
  "frontmatter.parse": findingExplanation("frontmatter", "error", "The frontmatter block could not be parsed by the supported LLM-WIKI subset.", "Malformed metadata prevents reliable validation and report generation.", ["Check the reported line for unsupported syntax.", "Use simple scalar values or list items in the supported YAML subset.", "Run validate-frontmatter again."], ["llm-wiki validate-frontmatter"], ["frontmatter.exists", "frontmatter.required"]),
  "frontmatter.array": findingExplanation("frontmatter", "error", "A field that must be a list was provided as a scalar value.", "Fields such as tags, source_files, related, and aliases need stable list shapes for tools and agents.", ["Rewrite the reported field as a YAML list.", "Use one item per line with a leading dash.", "Run validate-frontmatter again."], ["llm-wiki validate-frontmatter"], ["okf.array_shape"]),
  "frontmatter.status": findingExplanation("frontmatter", "error", "The document status is not one of the supported LLM-WIKI status values.", "Status values drive review workflow and prevent AI-generated content from being treated as verified too early.", ["Use a supported status such as needs_review, in_progress, verified, or deprecated.", "Use needs_review for generated or recently edited documents.", "Run validate-frontmatter again."], ["llm-wiki validate-frontmatter"], ["frontmatter.verified_review"]),
  "frontmatter.verified_review": findingExplanation("frontmatter", "warning", "A verified document is missing review metadata.", "Verified documents should identify who reviewed them and when, especially in strict CI.", ["Add reviewed_by and reviewed_at when the document has truly been reviewed.", "Downgrade status to needs_review if review has not happened.", "Use --strict when warnings should fail CI."], ["llm-wiki validate-frontmatter --strict", "llm-wiki validate --strict"], ["frontmatter.status"]),
  "source_files.missing": findingExplanation("source_files", "warning", "A source_files entry points to a local file that does not exist.", "LLM-WIKI claims should stay traceable to real source evidence or explicit external references.", ["Fix the path if the referenced source file moved.", "Remove stale entries that no longer support the document.", "Use an explicit external URL only when the source is outside the repository."], ["llm-wiki audit", "llm-wiki validate"], ["markdown_link.missing"]),
  "evidence.shape": findingExplanation("evidence", "error", "An evidence entry does not match the supported reference shape.", "Evidence references should stay small and machine-checkable so claims can point to a file, line range, symbol, section, or route.", ["Use file, file#L10, file#L10-L20, file#symbol:Name, file#section:Heading, or file#route:/path.", "Keep richer prose in the document body rather than the frontmatter entry.", "Run validate again."], ["llm-wiki validate", "llm-wiki explain evidence.shape"], ["source_files.missing"]),
  "evidence.missing": findingExplanation("evidence", "warning", "An evidence entry points to a local file that does not exist.", "Precise evidence is only useful when the base file can be found from the project root.", ["Fix the path if the referenced source file moved.", "Remove stale evidence entries that no longer support a claim.", "Use an explicit external URL only when the source is outside the repository."], ["llm-wiki audit", "llm-wiki validate"], ["source_files.missing", "evidence.shape"]),
  "evidence.line_range": findingExplanation("evidence", "warning", "An evidence line reference is outside the referenced file.", "Line references should remain close enough to the source to help reviewers verify a claim quickly.", ["Update the line number or range after source edits.", "Use symbol, route, or section evidence when line numbers churn too often.", "Run validate again."], ["llm-wiki validate"], ["evidence.missing"]),
  "evidence.section_missing": findingExplanation("evidence", "warning", "A document with frontmatter evidence does not include a body ## Evidence section.", "The body section gives reviewers a readable explanation of the precise evidence references stored in frontmatter.", ["Add a ## Evidence section to the document body.", "Mention each frontmatter evidence entry in a bullet.", "Keep detailed interpretation in prose after the reference."], ["llm-wiki validate", "llm-wiki explain evidence.section_missing"], ["evidence.shape"]),
  "evidence.section_empty": findingExplanation("evidence", "warning", "A body ## Evidence section exists but has no bullet entries.", "Evidence sections should be scan-friendly and consistent across generated and maintained wiki documents.", ["Add one or more bullet entries under ## Evidence.", "Use source references, commands, tests, or reviewed evidence notes.", "Remove the section only if it is not part of the document contract."], ["llm-wiki validate"], ["evidence.section_missing"]),
  "evidence.stale": findingExplanation("evidence", "warning", "A verified document references source files that changed in git after it was reviewed.", "Verified documents assert reviewed, source-backed knowledge; when the referenced code moves afterward, the document may no longer match the source and should be re-checked.", ["Re-read the changed source and update the document.", "If the claims no longer hold, downgrade the document to needs_review.", "Refresh reviewed_by/reviewed_at after a new human review.", "This is a file-level heuristic based on git history; ignore it when the change did not affect the documented claims."], ["llm-wiki next", "llm-wiki audit"], ["evidence.missing", "frontmatter.verified_review"]),
  "evidence.section_unlisted": findingExplanation("evidence", "warning", "A frontmatter evidence reference is not mentioned in the body ## Evidence section.", "Keeping frontmatter and body evidence aligned lets tools validate references while humans can still review context in the document body.", ["Add the missing reference to a bullet under ## Evidence.", "Remove stale frontmatter evidence if it no longer supports the document.", "Run validate again."], ["llm-wiki validate"], ["evidence.section_missing", "evidence.shape"]),
  "changed.unavailable": findingExplanation("changed", "error", "The --changed scope could not read git history.", "validate --changed needs a git repository to diff against; without it the changed-file set is unknown.", ["Run inside a git repository from the repo root.", "Drop --changed to validate the whole wiki.", "For CI, ensure the checkout includes history and a base ref."], ["llm-wiki validate", "llm-wiki validate --changed --since <ref>"], []),
  "related.missing": findingExplanation("related", "warning", "A related frontmatter entry points to a local document that does not exist.", "Related links help agents and readers navigate between connected wiki documents, so broken entries weaken the wiki graph and erode trust in generated reports.", ["Fix the path if the related document moved or was renamed.", "Remove stale related entries that no longer apply.", "Create the related document when it should exist.", "Use an explicit external URL only when the reference is outside the repository."], ["llm-wiki audit", "llm-wiki validate"], ["markdown_link.missing", "source_files.missing"]),
  "markdown_link.missing": findingExplanation("markdown_link", "warning", "A local Markdown link target does not exist.", "Broken local links make the wiki harder to navigate and reduce trust in generated reports.", ["Check whether the target path was renamed or moved.", "Update the link or create the missing target document.", "External links, mailto links, and local anchors are intentionally skipped."], ["llm-wiki validate", "llm-wiki status"], ["wiki_link.missing"]),
  "wiki_link.missing": findingExplanation("wiki_link", "warning", "A [[wiki link]] target does not resolve to a file path, basename, title, or alias.", "Unresolved wiki links break concept navigation and weaken OKF-style knowledge graph output.", ["Create a document for the missing concept when it is real.", "Update the link text to match an existing title, basename, file path, or alias.", "Add a reviewed aliases entry to the intended target document when appropriate."], ["llm-wiki validate", "llm-wiki next", "llm-wiki audit --format markdown"], ["markdown_link.missing", "okf.array_shape"]),
  "okf.type_required": findingExplanation("okf", "error", "An OKF v0.1-profiled document is missing the required frontmatter type field.", "OKF requires explicit document type metadata and LLM-WIKI does not infer it from doc_type.", ["Add an explicit type field to the frontmatter.", "Use a reviewed OKF type such as concept, project, person, meeting_note, event, or api_reference.", "Keep doc_type when the document also needs the LLM-WIKI contract."], ["llm-wiki validate --profile okf-v0.1"], ["okf.type_shape", "okf.array_shape"]),
  "okf.type_shape": findingExplanation("okf", "error", "The OKF type field exists but is not a string.", "Tools need a stable scalar type value to classify OKF documents.", ["Change type to a single scalar string.", "Avoid list or object values for type.", "Run validate with the OKF profile again."], ["llm-wiki validate --profile okf-v0.1"], ["okf.type_required"]),
  "okf.array_shape": findingExplanation("okf", "error", "An OKF aliases or tags field is present but is not an array.", "OKF-compatible aliases and tags need stable array shapes for graph and search workflows.", ["Rewrite aliases or tags as YAML lists.", "Keep aliases reviewed and intentional.", "Run validate with the OKF profile again."], ["llm-wiki validate --profile okf-v0.1"], ["frontmatter.array"]),
  "content.not_enriched": findingExplanation("content", "warning", "A generated wiki document still contains placeholder guidance and has not been enriched with source-backed content.", "Empty scaffolds pass structural validation but hold no real knowledge, so the token-saving and handoff-replacement goals are not met until an agent or human fills them in from source evidence.", ["Read the document and the files listed in source_files, then replace the placeholder bullets with source-backed content.", "Run llm-wiki handoff --agent codex or --agent claude to get an enrichment prompt.", "Keep the document as needs_review until human review is complete."], ["llm-wiki handoff --agent codex", "llm-wiki validate"], ["structure.required_doc", "source_files.missing"]),
  "adapter.missing": findingExplanation("adapter", "warning", "A selected agent adapter file is missing.", "Adapter files tell Codex or Claude Code where the wiki entrypoint is and how to follow the project contract.", ["Run init --write with the selected agent.", "Review generated adapter text before relying on it.", "Existing adapter files are never overwritten."], ["llm-wiki init --write --agent codex", "llm-wiki init --write --agent claude"], ["adapter.entrypoint"]),
  "adapter.entrypoint": findingExplanation("adapter", "warning", "An adapter exists but does not point to docs/llm-wiki/index.md.", "Agents need a reliable entrypoint to find project knowledge before editing code.", ["Open the reported adapter file.", "Add or correct the docs/llm-wiki/index.md reference.", "Run audit again with the selected agent."], ["llm-wiki audit --agent codex", "llm-wiki audit --agent claude"], ["adapter.missing"]),
  "encoding.bom": findingExplanation("encoding", "info", "A UTF-8 BOM was detected.", "BOMs are usually harmless, but they can create noisy diffs or surprise simple parsers.", ["Leave it alone if your team accepts BOMs.", "Remove the BOM with an editor that preserves UTF-8 when you want cleaner diffs.", "Run audit again."], ["llm-wiki audit"], ["encoding.mojibake"]),
  "encoding.mojibake": findingExplanation("encoding", "blocked", "Text that looks like mojibake was detected.", "Automatic rewrites are unsafe when text may already be corrupted.", ["Stop automated rewrite work on the reported file.", "Recover the file from a known-good UTF-8 source or manually repair the encoding.", "Run audit again after repair."], ["llm-wiki audit"], ["encoding.bom"]),
  "sensitive.redacted": findingExplanation("sensitive", "blocked", "Sensitive-looking content was detected and redacted from the finding message.", "Reports and generated docs must not leak tokens, credentials, or secret-like values.", ["Inspect the reported file and line locally.", "Remove or rotate the sensitive value if it is real.", "Replace examples with clearly fake placeholder values."], ["llm-wiki audit"], []),
  "project.review_item": findingExplanation("project", "warning", "Project detection found something a human should review.", "Detection is conservative; explicit review keeps generated templates aligned with the real project.", ["Read the finding message.", "Pass --type or --profile explicitly when auto-detection is too weak.", "Run status or audit again."], ["llm-wiki status --type frontend", "llm-wiki audit --profile library"], []),
  "handoff.unsupported_agent": findingExplanation("handoff", "blocked", "The selected handoff target is not supported yet.", "Unsupported adapter contracts should not be treated as safe handoff instructions.", ["Use a supported agent such as codex or claude.", "Keep Antigravity blocked until its adapter contract is confirmed.", "Run handoff again with a supported agent."], ["llm-wiki handoff --agent codex", "llm-wiki handoff --agent claude"], ["adapter.missing"]),
  "prompt.unsupported_task": findingExplanation("prompt", "blocked", "The requested task prompt preset is not supported.", "Prompt presets are intentionally narrow so task workflows stay predictable and reviewable.", ["Choose one of feature, fix, refactor, docs-sync, or okf-extract.", "Use help prompt to review supported task names.", "Add a new preset deliberately if the workflow becomes stable."], ["llm-wiki help prompt", "llm-wiki prompt --task feature"], [])
};

export async function doctor(options) {
  const cwd = options.cwd;
  const detection = await detectProject(cwd, options.type, options.profiles);
  const wikiExists = await pathExists(path.join(cwd, "docs", "llm-wiki", "index.md"));
  const configExists = await pathExists(path.join(cwd, "llm-wiki.config.json"));
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
    `llm_wiki_config: ${configExists ? "present" : "absent"}`,
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

export async function validateFrontmatterCommand(options) {
  const markdownFiles = await listTargetMarkdown(options.cwd);
  const findings = [];

  for (const file of markdownFiles) {
    const rel = toPosix(path.relative(options.cwd, file));
    const content = await readUtf8(file);
    const parsed = parseFrontmatter(content);

    for (const message of parsed.errors) {
      findings.push({ severity: "error", rule: "frontmatter.parse", path: rel, message });
    }
    for (const finding of validateFrontmatter(parsed.frontmatter, { strict: options.strict })) {
      findings.push({ ...finding, path: rel });
    }
  }

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
  const structureFindings = await findMissingDocs(options.cwd, detection.projectType, options.profiles);
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
  const findings = [
    ...detectionFindings,
    ...documentStatus.findings,
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
  ];
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
  const structureFindings = await findMissingDocs(options.cwd, detection.projectType, options.profiles);
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

  const findings = [
    ...detectionFindings,
    ...structureFindings,
    ...frontmatter.findings,
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
  ];

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
  const document = buildReleaseNotes({ version, date, project, commits, gitAvailable });

  return {
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
      planned.push(`${rel} would be created with status needs_review.`);
    }
  }

  const adapterPlan = await planAdapterSuggestions(options.cwd, agents);
  planned.push(...adapterPlan.planned);
  skipped.push(...adapterPlan.skipped);

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
async function listWikiContentDocs(cwd) {
  const wikiRoot = path.join(cwd, "docs", "llm-wiki");
  if (!(await pathExists(wikiRoot))) return [];
  return (await listMarkdownFiles(wikiRoot))
    .filter((file) => !toPosix(path.relative(cwd, file)).includes("/templates/"));
}

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

async function listTargetMarkdown(cwd) {
  const wikiRoot = path.join(cwd, "docs", "llm-wiki");
  if (await pathExists(wikiRoot)) {
    return listMarkdownFiles(wikiRoot);
  }
  const files = await listMarkdownFiles(cwd);
  return files.filter((file) => !toPosix(path.relative(cwd, file)).startsWith("templates/"));
}

async function findMissingDocs(cwd, projectType, profiles = []) {
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

  for (const rel of plannedDocs(projectType, false, profiles)) {
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

    const content = renderGeneratedWikiDoc(rel, detection, lastUpdated, domainContext);
    const sensitiveFindings = scanSensitiveInfo(content);
    if (sensitiveFindings.length > 0) {
      blocked.push(`${rel} was not written because generated content matched sensitive-info rules.`);
      continue;
    }

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, { encoding: "utf8" });
    if (exists) {
      overwritten.push(`${rel} overwritten with status needs_review by explicit --existing overwrite.`);
    } else {
      created.push(`${rel} created with status needs_review.`);
    }
  }

  const adapterWrites = await writeAdapterFiles(options.cwd, agents);
  created.push(...adapterWrites.created);
  skipped.push(...adapterWrites.skipped);
  blocked.push(...adapterWrites.blocked);

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

function extractMarkdownSection(markdown, title) {
  const lines = String(markdown ?? "").split(/\r?\n/);
  const headingPattern = new RegExp(`^##\\s+${escapeRegex(title)}\\s*$`, "i");
  const start = lines.findIndex((line) => headingPattern.test(line.trim()));
  if (start === -1) return null;

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^#{1,2}\s+\S/.test(lines[index].trim())) {
      end = index;
      break;
    }
  }

  const sectionLines = lines.slice(start + 1, end);
  const text = sectionLines.join("\n");
  const bullets = sectionLines.filter((line) => /^\s*[-*]\s+\S/.test(line));

  return { text, bullets };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseEvidenceReference(reference) {
  if (!reference) return null;
  if (isExternalSourceReference(reference)) return { source: reference, locator: null, external: true };

  const hashIndex = reference.indexOf("#");
  const source = (hashIndex === -1 ? reference : reference.slice(0, hashIndex)).trim();
  const locatorText = hashIndex === -1 ? null : reference.slice(hashIndex + 1).trim();

  if (!source || source.startsWith("#")) return null;
  if (locatorText === "") return null;
  if (locatorText === null) return { source, locator: null, external: false };

  const lineMatch = locatorText.match(/^L([1-9]\d*)(?:-(?:L)?([1-9]\d*))?$/i);
  if (lineMatch) {
    const start = Number(lineMatch[1]);
    const end = Number(lineMatch[2] ?? lineMatch[1]);
    if (end < start) return null;
    return { source, locator: { kind: "line", start, end }, external: false };
  }

  const typedMatch = locatorText.match(/^(symbol|section|route):(.+)$/);
  if (!typedMatch) return null;

  const kind = typedMatch[1];
  const value = typedMatch[2].trim();
  if (!value) return null;
  if (kind === "route" && !value.startsWith("/")) return null;

  return { source, locator: { kind, value }, external: false };
}

async function getLineCount(file, cache) {
  if (cache.has(file)) return cache.get(file);
  const content = await readUtf8(file);
  const lineCount = content.length === 0 ? 0 : content.split(/\r\n|\r|\n/).length;
  cache.set(file, lineCount);
  return lineCount;
}

function isExternalSourceReference(source) {
  return /^https?:\/\//i.test(source) || source.startsWith("#");
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

async function collectWikiGraph(cwd) {
  const wikiRoot = path.join(cwd, "docs", "llm-wiki");
  if (!(await pathExists(wikiRoot))) return emptyWikiGraph();

  const markdownFiles = await listMarkdownFiles(wikiRoot);
  const targetIndex = await buildWikiLinkTargetIndex(cwd, wikiRoot, markdownFiles);
  const docs = markdownFiles.map((file) => {
    const pathFromRoot = toPosix(path.relative(cwd, file));
    return {
      path: pathFromRoot,
      title: targetIndex.documentsByPath.get(pathFromRoot)?.title ?? null,
      aliases: targetIndex.documentsByPath.get(pathFromRoot)?.aliases ?? [],
      links: [],
      inboundCount: 0
    };
  });
  const docsByPath = new Map(docs.map((doc) => [doc.path, doc]));
  const findings = [];
  const links = [];
  const connectedPaths = new Set();
  const unresolvedByTarget = new Map();

  for (const file of markdownFiles) {
    const rel = toPosix(path.relative(cwd, file));
    const content = await readUtf8(file);
    const sourceDoc = docsByPath.get(rel);

    for (const rawTarget of extractWikiLinkTargets(content)) {
      const target = normalizeWikiLinkTarget(rawTarget);
      if (!target) continue;

      const key = normalizeWikiLinkKey(target);
      const targetDoc = targetIndex.targets.get(key);
      const link = {
        source: rel,
        target,
        resolved: Boolean(targetDoc),
        targetPath: targetDoc?.path ?? null
      };
      links.push(link);
      sourceDoc?.links.push(link);

      if (targetDoc) {
        const inboundDoc = docsByPath.get(targetDoc.path);
        if (inboundDoc && inboundDoc.path !== rel) {
          inboundDoc.inboundCount += 1;
          connectedPaths.add(inboundDoc.path);
        }
      } else {
        findings.push({
          severity: "warning",
          rule: "wiki_link.missing",
          path: rel,
          message: `Wiki link target does not exist: ${target}.`
        });
        const unresolved = unresolvedByTarget.get(target) ?? { target, sources: [] };
        unresolved.sources.push(rel);
        unresolvedByTarget.set(target, unresolved);
      }
    }

    // Related frontmatter and local Markdown links also connect documents,
    // so orphan detection reflects the full wiki graph, not only [[wiki links]].
    const parsed = parseFrontmatter(content);
    const relatedEntries = Array.isArray(parsed.frontmatter?.related) ? parsed.frontmatter.related : [];
    for (const relatedEntry of relatedEntries) {
      if (typeof relatedEntry !== "string") continue;
      const targetPath = toPosix(relatedEntry.trim().replace(/^\.\//, "").replace(/^\/+/, ""));
      if (targetPath && targetPath !== rel && docsByPath.has(targetPath)) connectedPaths.add(targetPath);
    }
    for (const rawLink of extractMarkdownLinkTargets(content)) {
      const link = normalizeMarkdownLinkTarget(rawLink);
      if (!link || isSkippedMarkdownLink(link)) continue;
      const targetPath = toPosix(path.relative(cwd, resolveMarkdownLinkTarget(cwd, file, link)));
      if (targetPath && targetPath !== rel && docsByPath.has(targetPath)) connectedPaths.add(targetPath);
    }
  }

  const aliasEntries = [...targetIndex.aliases].sort((left, right) => {
    const byAlias = left.alias.localeCompare(right.alias);
    return byAlias || left.path.localeCompare(right.path);
  });
  const orphanDocuments = docs
    .filter((doc) => doc.path !== "docs/llm-wiki/index.md" && !connectedPaths.has(doc.path))
    .map((doc) => doc.path)
    .sort();
  const unresolvedConcepts = [...unresolvedByTarget.values()].sort((left, right) => left.target.localeCompare(right.target));

  return {
    summary: {
      documents: docs.length,
      wikiLinks: links.length,
      resolvedWikiLinks: links.filter((link) => link.resolved).length,
      unresolvedWikiLinks: unresolvedConcepts.length,
      aliases: aliasEntries.length,
      orphanDocuments: orphanDocuments.length
    },
    documents: docs,
    links,
    unresolvedConcepts,
    aliases: aliasEntries,
    orphanDocuments,
    findings
  };
}

function extractMarkdownLinkTargets(markdown) {
  const targets = [];
  const inlineLinkPattern = /(^|[^!])\[[^\]\n]+\]\(([^)\n]+)\)/g;
  const referenceDefinitionPattern = /^\s*\[[^\]\n]+\]:\s*(\S+)(?:\s+.*)?$/gm;

  for (const match of markdown.matchAll(inlineLinkPattern)) {
    targets.push(match[2]);
  }
  for (const match of markdown.matchAll(referenceDefinitionPattern)) {
    targets.push(match[1]);
  }
  return targets;
}

function extractWikiLinkTargets(markdown) {
  const targets = [];
  const wikiLinkPattern = /\[\[([^\]\n]+)\]\]/g;

  for (const match of markdown.matchAll(wikiLinkPattern)) {
    targets.push(match[1]);
  }

  return targets;
}

function normalizeMarkdownLinkTarget(target) {
  const trimmed = target.trim();
  const withoutTitle = trimmed.startsWith("<")
    ? trimmed.match(/^<([^>]+)>/)?.[1] ?? trimmed
    : trimmed.split(/\s+/)[0];
  const withoutQuery = withoutTitle.split("?")[0];
  const withoutAnchor = withoutQuery.split("#")[0];

  try {
    return decodeURIComponent(withoutAnchor).replaceAll("\\", "/");
  } catch {
    return withoutAnchor.replaceAll("\\", "/");
  }
}

function isSkippedMarkdownLink(link) {
  return link === "" || link.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(link);
}

function resolveMarkdownLinkTarget(cwd, fromFile, link) {
  if (link.startsWith("/")) {
    return path.join(cwd, link.slice(1));
  }
  if (link.startsWith("docs/")) {
    return path.join(cwd, link);
  }
  return path.resolve(path.dirname(fromFile), link);
}

async function buildWikiLinkTargetIndex(cwd, wikiRoot, markdownFiles) {
  const targets = new Map();
  const aliases = [];
  const documentsByPath = new Map();

  for (const file of markdownFiles) {
    const wikiRel = toPosix(path.relative(wikiRoot, file));
    const cwdRel = toPosix(path.relative(cwd, file));
    const withoutExtension = wikiRel.replace(/\.md$/i, "");
    const basename = path.basename(file, ".md");
    const parsed = parseFrontmatter(await readUtf8(file));
    const document = {
      path: cwdRel,
      title: parsed.frontmatter?.title ?? null,
      aliases: Array.isArray(parsed.frontmatter?.aliases)
        ? parsed.frontmatter.aliases.filter((alias) => typeof alias === "string")
        : []
    };
    documentsByPath.set(cwdRel, document);

    addWikiLinkTarget(targets, wikiRel, document);
    addWikiLinkTarget(targets, withoutExtension, document);
    addWikiLinkTarget(targets, cwdRel, document);
    addWikiLinkTarget(targets, cwdRel.replace(/\.md$/i, ""), document);
    addWikiLinkTarget(targets, basename, document);

    addWikiLinkTarget(targets, document.title, document);
    for (const alias of document.aliases) {
      addWikiLinkTarget(targets, alias, document);
      aliases.push({ alias, path: cwdRel, title: document.title });
    }
  }

  return { targets, aliases, documentsByPath };
}

function addWikiLinkTarget(targetIndex, value, document) {
  const normalized = normalizeWikiLinkKey(value);
  if (normalized && !targetIndex.has(normalized)) targetIndex.set(normalized, document);
}

function normalizeWikiLinkTarget(rawTarget) {
  const withoutAlias = String(rawTarget).split("|")[0];
  const withoutAnchor = withoutAlias.split("#")[0];
  const trimmed = withoutAnchor.trim();
  if (!trimmed) return "";

  try {
    return decodeURIComponent(trimmed).replaceAll("\\", "/");
  } catch {
    return trimmed.replaceAll("\\", "/");
  }
}

function normalizeWikiLinkKey(value) {
  if (value === undefined || value === null) return "";
  const normalized = normalizeWikiLinkTarget(value)
    .replace(/^\/+/, "")
    .replace(/^docs\/llm-wiki\//i, "")
    .replace(/\.md$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return normalized;
}

function emptyWikiGraph() {
  return {
    summary: {
      documents: 0,
      wikiLinks: 0,
      resolvedWikiLinks: 0,
      unresolvedWikiLinks: 0,
      aliases: 0,
      orphanDocuments: 0
    },
    documents: [],
    links: [],
    unresolvedConcepts: [],
    aliases: [],
    orphanDocuments: [],
    findings: []
  };
}

async function scanAdapters(cwd, agents) {
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

async function planAdapterSuggestions(cwd, agents) {
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

async function writeAdapterFiles(cwd, agents) {
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

async function summarizeAdapterStatus(cwd, agents) {
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

function docMetadata(rel, detection, lastUpdated = todayIsoDate(), domainContext = emptyDomainContext()) {
  const fallbackTitle = titleFromPath(rel);
  const commonRelated = ["docs/llm-wiki/index.md", "docs/llm-wiki/log.md"].filter((item) => item !== rel);

  // A detected individual domain document: doc_type `domain`, source_files from
  // the detected directories, linked back to the overview and DOMAIN_FEATURES.
  const domainPlan = domainContext.plans.find((plan) => plan.rel === rel);
  if (domainPlan) {
    return {
      title: domainPlan.domainName,
      docType: "domain",
      sourceFiles: domainPlan.sourceFiles,
      related: ["docs/llm-wiki/domains/00_overview.md", "docs/llm-wiki/DOMAIN_FEATURES.md", ...domainContext.relatedExtras],
      body: domainDocBody(domainPlan)
    };
  }

  // Dynamic Domains section for the overview: markdown links to each detected
  // domain doc (which also makes those docs non-orphan), or a review prompt.
  const domainsSection = domainContext.plans.length > 0
    ? domainContext.plans.map((plan) => `- [${plan.domainName}](./${plan.rel.split("/").pop()})`).join("\n")
    : "- 자동 탐지된 domain이 없습니다. 프로젝트의 실제 업무 경계를 검토해 수동으로 추가하십시오.";

  const map = {
    "docs/llm-wiki/index.md": {
      title: "LLM-WIKI Index",
      docType: "wiki_index",
      related: ["docs/llm-wiki/README.md", "docs/llm-wiki/log.md"],
      body: `# LLM-WIKI Index

이 문서는 프로젝트 LLM-WIKI의 공식 진입점입니다.

## Status

- 현재 문서는 CLI가 생성한 초안이므로 \`needs_review\` 상태입니다.
- 사람 검토가 끝난 뒤에만 \`verified\`로 승격할 수 있습니다.

## Recommended Read Order

1. \`docs/llm-wiki/index.md\`
2. \`docs/llm-wiki/README.md\`
3. \`docs/llm-wiki/project-profile.md\`
4. 작업 대상 도메인 문서와 관련 source files
`
    },
    "docs/llm-wiki/README.md": {
      title: "LLM-WIKI README",
      docType: "wiki_readme",
      related: ["docs/llm-wiki/index.md", "docs/llm-wiki/project-profile.md"],
      body: `# LLM-WIKI README

이 디렉터리는 프로젝트 지식, 의사결정, 작업 규칙을 LLM과 개발자가 함께 참조하기 위한 문서 공간입니다.

## Operating Rules

- 모든 wiki 문서는 YAML frontmatter를 가집니다.
- CLI 또는 LLM이 생성/수정한 문서는 \`needs_review\` 상태를 유지합니다.
- 민감정보 raw value는 기록하지 않습니다.
- 변경 기록은 \`docs/llm-wiki/log.md\`에 append-only로 남깁니다.
`
    },
    "docs/llm-wiki/log.md": {
      title: "LLM-WIKI Change Log",
      docType: "change_log",
      related: ["docs/llm-wiki/index.md"],
      body: `# LLM-WIKI Change Log

이 문서는 append-only 변경 로그입니다. 기존 항목은 수정하지 말고 새 변경 사항을 위에 추가합니다.

## ${lastUpdated} - LLM-WIKI 초기 문서 생성

- status: needs_review
- actor: llm-wiki-cli
- scope: docs
- changed:
  - docs/llm-wiki/
- summary:
  - \`llm-wiki init --write\` 명령으로 초기 LLM-WIKI 문서 구조를 생성했다.
- evidence:
  - package.json
- caveats:
  - CLI 생성 초안이므로 사람 검토가 필요하다.
`
    },
    "docs/llm-wiki/DOMAIN_FEATURES.md": {
      title: "Domain Features",
      docType: "domain_overview",
      related: ["docs/llm-wiki/index.md", "docs/llm-wiki/domains/00_overview.md"],
      body: `# Domain Features

This document maps user-facing and business-domain features to source evidence.

## What To Inspect

- Domain modules, services, stores, controllers, routes, components, and workflows.
- Tests or fixtures that show expected behavior.
- API clients or service modules that move data across boundaries.

## API Services

Document each API service used by each domain. For every service, capture:

${apiServiceInventoryChecklist().join("\n")}

## Open Questions

- Keep uncertain claims here until source evidence or human review resolves them.

## Review Notes

- Keep this document as \`needs_review\` until human review is complete.
`
    },
    "docs/llm-wiki/domains/00_overview.md": {
      title: "Domain Overview",
      docType: "domain_overview",
      related: ["docs/llm-wiki/index.md", "docs/llm-wiki/DOMAIN_FEATURES.md"],
      body: `# Domain Overview

This document is the domain map for the project.

## Domains

${domainsSection}

## API Services

Document each API service used by the mapped domains. For every service, capture:

${apiServiceInventoryChecklist().join("\n")}

## Evidence

- Add source files, tests, routes, and client modules inspected while completing this map.
- Mention any optional frontmatter \`evidence\` entries here, such as \`src/routes.ts#route:/example\`, when a claim depends on a specific route.

## Review Notes

- Keep this document as \`needs_review\` until human review is complete.
`
    },
    "docs/llm-wiki/profiles/okf-v0.1.md": {
      title: "OKF v0.1 Profile",
      docType: "profile",
      related: ["docs/llm-wiki/index.md", "docs/llm-wiki/GLOSSARY.md"],
      body: `# OKF v0.1 Profile

This profile is for projects that want selected LLM-WIKI documents to double as an OKF v0.1 knowledge corpus.

## Validation Contract

- Add frontmatter \`type\` explicitly to every document validated with \`--profile okf-v0.1\`.
- Keep standard LLM-WIKI \`doc_type\`; do not assume \`doc_type\` automatically satisfies OKF \`type\`.
- Optional \`aliases\` must be an array when present.
- Optional \`tags\` must be an array when present.
- Body wiki links such as \`[[Concept Name]]\` must resolve to a wiki file path, basename, frontmatter \`title\`, or frontmatter \`aliases\` entry.

## OKF-Style Writing

- Start concept-style documents with a short summary section.
- Use concise headings and bullet lists.
- Prefer durable facts, stable relationships, and explicit source evidence.
- Use \`[[wiki links]]\` only when the linked concept is known or intentionally queued for review.

## Evidence

- Add source documents, source files, or extraction inputs inspected before making claims.
- Mention any optional frontmatter \`evidence\` entries here for precise file, line, symbol, section, or route references.

## Open Questions

- Track unresolved aliases, missing concepts, unclear entity boundaries, and extraction caveats.

## Review Notes

- Keep AI-extracted or AI-edited OKF-compatible documents as \`needs_review\` until human review is complete.
`
    },
    "docs/llm-wiki/templates/OKF_CONCEPT.template.md": okfTemplateMetadata({
      title: "OKF Concept Template",
      okfType: "concept",
      heading: "Concept Name",
      summary: "Define the concept in one or two concise, source-backed bullets.",
      sections: [
        ["Definition", ["State the durable meaning of this concept.", "Link related concepts with `[[Concept Name]]` where known."]],
        ["Relationships", ["List parent, child, adjacent, or contrasting concepts.", "Use bullets and avoid long prose."]]
      ]
    }),
    "docs/llm-wiki/templates/OKF_PROJECT.template.md": okfTemplateMetadata({
      title: "OKF Project Template",
      okfType: "project",
      heading: "Project Name",
      summary: "Summarize the project purpose, owner, and current state in concise bullets.",
      sections: [
        ["Scope", ["Describe the project boundary and notable exclusions.", "Link related systems, teams, or concepts with `[[Concept Name]]`."]],
        ["Status", ["Capture current state, milestones, blockers, and review caveats."]]
      ]
    }),
    "docs/llm-wiki/templates/OKF_API_REFERENCE.template.md": okfTemplateMetadata({
      title: "OKF API Reference Template",
      okfType: "api_reference",
      heading: "API Name",
      summary: "Summarize what the API does and which workflow or domain uses it.",
      sections: [
        ["Contract", ["Record endpoint or client module, method or call signature, request shape, and response shape.", "Capture auth/session/token/cookie dependency."]],
        ["Behavior", ["Capture error handling, retry or timeout behavior, cache or state updates, and related `[[Workflow]]`."]]
      ]
    }),
    "docs/llm-wiki/templates/OKF_MEETING_NOTE.template.md": okfTemplateMetadata({
      title: "OKF Meeting Note Template",
      okfType: "meeting_note",
      heading: "Meeting Title",
      summary: "Summarize the meeting purpose, date, and most important outcome.",
      sections: [
        ["Decisions", ["List decisions with owners or follow-up links.", "Use `[[Concept Name]]` links for projects, systems, or policies."]],
        ["Action Items", ["List owner, action, due date, and evidence or source note when available."]]
      ]
    }),
    "docs/llm-wiki/templates/OKF_EVENT.template.md": okfTemplateMetadata({
      title: "OKF Event Template",
      okfType: "event",
      heading: "Event Name",
      summary: "Summarize what happened, when it happened, and why it matters.",
      sections: [
        ["Timeline", ["List dated facts in chronological order.", "Link related incidents, releases, systems, or people with `[[Concept Name]]`."]],
        ["Impact", ["Describe affected users, systems, documents, or decisions."]]
      ]
    }),
    "docs/llm-wiki/OKF_CONVERSION_GUIDE.md": {
      title: "OKF Conversion Guide",
      docType: "conversion_guide",
      related: ["docs/llm-wiki/profiles/okf-v0.1.md", "docs/llm-wiki/templates/OKF_CONCEPT.template.md", "docs/llm-wiki/GLOSSARY.md"],
      body: `# OKF Conversion Guide

This guide explains how to convert selected LLM-WIKI documents into OKF v0.1-compatible knowledge documents without weakening the LLM-WIKI review model.

## Principle

- Conversion is review-assisted, not automatic.
- Do not assume LLM-WIKI \`doc_type\` automatically satisfies OKF \`type\`.
- Write OKF \`type\` explicitly after source inspection and human or agent review.
- Keep AI-converted documents as \`needs_review\` until human review is complete.

## Metadata Mapping

| LLM-WIKI field | OKF v0.1 field | Conversion guidance |
| --- | --- | --- |
| \`doc_type\` | \`type\` | Use as a candidate only. Review and write explicit OKF \`type\`. |
| \`tags\` | \`tags\` | Preserve useful tags as an array. Remove workflow-only tags if they do not help retrieval. |
| \`aliases\` | \`aliases\` | Preserve aliases as an array when present. Add reviewed synonyms only. |
| \`related\` | body \`[[wiki links]]\` | Convert durable related concepts into body wiki links where useful. |
| \`source_files\` | \`Evidence\` section | Preserve source evidence in an Evidence section or equivalent source-backed note. |
| \`status\` | review state | Keep converted documents as \`needs_review\`; \`verified\` remains human-approved only. |

## Conversion Workflow

1. Read the source LLM-WIKI document and related source files.
2. Choose the target OKF template: concept, project, api_reference, meeting_note, or event.
3. Write explicit OKF frontmatter with required \`type\` and optional \`aliases\` and \`tags\`.
4. Move durable relationships into body \`[[wiki links]]\`.
5. Preserve source evidence and unresolved questions.
6. Run \`llm-wiki validate --profile okf-v0.1\`.
7. Leave the result as \`needs_review\` until human review is complete.

## Open Questions

- Track uncertain type mappings, unresolved aliases, missing wiki links, and source gaps here before conversion.

## Review Notes

- This guide is a generated draft and should remain \`needs_review\` until the team approves the conversion policy.
`
    },
    "docs/llm-wiki/project-profile.md": {
      title: "Project Profile",
      docType: "project_profile",
      body: `# Project Profile

## Detected Project

- type: \`${detectionProjectTypePlaceholder}\`
- confidence: generated during init

## Review Notes

- 프로젝트명, 주요 런타임, 배포 환경, 소유 팀을 사람 검토 후 보강합니다.
`
    }
  };

  const meta = map[rel] ?? {
    title: fallbackTitle,
    docType: docTypeFromPath(rel),
    body: `# ${fallbackTitle}

이 문서는 \`llm-wiki init --write\`가 생성한 초안입니다.

## Purpose

- 이 프로젝트에서 해당 주제의 기준 정보를 정리합니다.
- 실제 구현 파일을 확인한 뒤 source evidence를 보강합니다.

## Review Notes

- 사람 검토 전까지 \`needs_review\` 상태를 유지합니다.
`
  };

  return {
    title: meta.title,
    docType: meta.docType,
    sourceFiles: meta.sourceFiles ?? [detection.primaryManifest ?? "package.json"],
    related: meta.related ?? commonRelated,
    body: generatedDocBody(rel, map[rel], fallbackTitle).replaceAll(detectionProjectTypePlaceholder, detection.projectType)
  };
}

const detectionProjectTypePlaceholder = "__PROJECT_TYPE__";

function generatedDocBody(rel, mappedMeta, fallbackTitle) {
  if (rel === "docs/llm-wiki/project-profile.md") return projectProfileBody();
  return mappedMeta?.body ?? defaultGeneratedDocBody(fallbackTitle, rel);
}

function projectProfileBody() {
  return `# Project Profile

## Detected Project

- type: \`${detectionProjectTypePlaceholder}\`
- confidence: generated during init

## Summary

- Concise summary: describe the project purpose, primary runtime, and ownership boundaries after inspecting source evidence.

## What To Inspect

- Package manifests, build configuration, runtime entrypoints, source directories, tests, and deployment files.
- Existing README, release notes, issue templates, or architecture docs.

## Evidence

- Add source files and commands inspected while completing the project profile.
- Mention any optional frontmatter \`evidence\` entries here for precise file, line, symbol, section, or route references.

## Open Questions

- Track unclear ownership, unsupported environments, incomplete setup steps, or release assumptions.

## Review Notes

- Keep this document as \`needs_review\` until human review is complete.
- Do not promote this document to \`verified\`; verified status is human-approved only.
`;
}

function okfTemplateMetadata({ title, okfType, heading, summary, sections }) {
  return {
    title,
    docType: "template",
    related: ["docs/llm-wiki/profiles/okf-v0.1.md", "docs/llm-wiki/GLOSSARY.md"],
    body: okfTemplateBody({ heading, okfType, summary, sections })
  };
}

function okfTemplateBody({ heading, okfType, summary, sections }) {
  const renderedSections = sections
    .map(([sectionTitle, bullets]) => `## ${sectionTitle}

${bullets.map((bullet) => `- ${bullet}`).join("\n")}`)
    .join("\n\n");

  return `# ${heading}

## OKF Frontmatter Example

\`\`\`yaml
---
type: ${okfType}
aliases:
  - ${heading} Alias
tags:
  - okf
  - needs-review
---
\`\`\`

## Summary

- ${summary}

${renderedSections}

## Evidence

- Add source documents, source files, transcripts, tickets, commits, or extraction inputs inspected before making claims.
- Mention any optional LLM-WIKI frontmatter \`evidence\` entries here for precise file, line, symbol, section, or route references.

## Open Questions

- Track unresolved aliases, missing source evidence, unclear boundaries, or concepts that need human review.

## Review Notes

- Keep AI-extracted or AI-edited OKF-compatible documents as \`needs_review\` when stored in an LLM-WIKI project.
- Do not promote this document to \`verified\`; verified status is human-approved only.
`;
}

function defaultGeneratedDocBody(title, rel) {
  return `# ${title}

## Summary

- Concise summary: describe the purpose of this document in one or two source-backed bullets.
- Status: this is a \`needs_review\` draft created by \`llm-wiki init --write\`.

## What To Inspect

- Source files listed in frontmatter \`source_files\`.
- Related wiki documents listed in frontmatter \`related\`.
- Tests, configuration, routes, APIs, workflows, or public interfaces connected to this topic.

## Evidence

- Add file paths, symbols, routes, commands, or test names inspected while completing this document.
- Mention any optional frontmatter \`evidence\` entries here, such as \`src/api.ts#symbol:getUser\`, \`src/routes.ts#route:/users\`, or \`README.md#section:Usage\`.
- Prefer source-backed statements over guesses.
${domainApiServicesSection(rel)}

## Open Questions

- Track unclear ownership, missing source evidence, stale assumptions, or decisions that need human review.

## Review Notes

- Keep this document as \`needs_review\` until human review is complete.
- Do not promote this document to \`verified\`; verified status is human-approved only.
`;
}

function domainApiServicesSection(rel) {
  if (!isDomainOrientedDoc(rel)) return "";

  return `
## API Services

Document each API service used by this domain. For every service, capture:

${apiServiceInventoryChecklist().join("\n")}
`;
}

// Body for a detected individual domain document. Directory-boundary detected;
// the actual responsibilities are left for human/source-backed enrichment — no
// invented business meaning.
function domainDocBody(plan) {
  const sources = plan.sourceFiles.map((sourceFile) => `- \`${sourceFile}\``).join("\n");
  return `# ${plan.domainName}

이 문서는 \`llm-wiki init --write\`가 디렉터리 경계로 탐지한 도메인 \`${plan.domainName}\`의 초안입니다. 실제 책임과 로직은 아래 source를 확인한 뒤 사람이 보강합니다.

## Responsibility

- 이 도메인이 담당하는 업무 경계와 핵심 워크플로를 source를 확인한 뒤 정리합니다.
- 추측하지 말고 실제 코드/테스트/라우트 근거로 기술합니다.

## Source Directories

${sources}
${domainApiServicesSection(plan.rel)}
## Evidence

- 위 source 디렉터리의 엔트리포인트, 서비스, 라우트, 모델, 테스트를 확인해 근거를 채웁니다.
- frontmatter \`evidence\`에 \`파일#L10\`, \`파일#symbol:Name\`, \`파일#route:/path\` 같은 정밀 참조를 추가할 수 있습니다.

## Open Questions

- 불확실한 소유·경계·의존성은 사람 검토 전까지 여기에 남깁니다.

## Review Notes

- 사람 검토 전까지 \`needs_review\` 상태를 유지합니다.
- 이 문서를 \`verified\`로 승격하지 않습니다. verified는 사람 승인 전용입니다.
`;
}

function isDomainOrientedDoc(rel) {
  const normalized = toPosix(rel);
  return normalized.includes("/domains/") || normalized.endsWith("/DOMAIN_FEATURES.md");
}

function titleFromPath(rel) {
  const base = path.basename(rel, ".md");
  return base
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function docTypeFromPath(rel) {
  if (rel.includes("/profiles/")) return "profile";
  if (rel.includes("/domains/")) {
    // Only the overview map is a domain_overview; individual domain docs are `domain`.
    return path.basename(rel, ".md") === "00_overview" ? "domain_overview" : "domain";
  }
  if (rel.includes("/templates/")) return "template";
  return path.basename(rel, ".md").toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function isAppendOnlyLog(rel) {
  return toPosix(rel) === "docs/llm-wiki/log.md";
}

function selectedAgents(options) {
  if (options.agents?.length) return options.agents;
  if (options.withAdapters) return Object.keys(ADAPTER_TARGETS);
  return [];
}

function plannedDocs(projectType, minimal, profiles = []) {
  if (minimal) return CORE_REQUIRED_DOCS;
  const profileDocs = profiles.flatMap((profile) => PROFILE_DOCS[profile] ?? []);
  return [...new Set([...CORE_REQUIRED_DOCS, ...(PROFILE_DOCS[projectType] ?? PROFILE_DOCS.unknown), ...profileDocs])];
}

// ---- backend/fullstack domain detection --------------------------------
// Detect business-domain (module/feature) directories so init can create a
// per-domain doc next to the domain overview. Directory-boundary based only —
// no class/file-name inference, no LLM, no invented business meaning. Detection
// I/O is best-effort; planning is pure and exported for unit tests.

// Parent directories whose immediate subdirectories are treated as domains.
const DOMAIN_PARENT_DIRS = [
  "src/domains", "src/domain", "src/modules", "src/features",
  "app/domains", "app/domain", "app/modules", "app/features",
  "internal/domain", "internal/domains", "internal/modules"
];

// Technical directories that are not business domains (compared lowercase).
const DOMAIN_EXCLUDE_NAMES = new Set([
  "common", "shared", "core", "config", "configs",
  "util", "utils", "middleware", "middlewares",
  "infrastructure", "test", "tests", "fixture", "fixtures"
]);

function emptyDomainContext() {
  return { plans: [], relatedExtras: [] };
}

// Split camelCase/PascalCase/snake/kebab/space into tokens; keep non-latin
// letters (e.g. Hangul) intact. Pure.
function domainNameTokens(name) {
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[\s._-]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

// Deterministic filename slug for a domain directory name. Pure.
export function normalizeDomainSlug(name) {
  const slug = domainNameTokens(name)
    .map((token) => token.toLowerCase())
    .join("_")
    .replace(/[^\p{L}\p{N}_]+/gu, "");
  return slug || "domain";
}

// Human-facing display name derived from a slug (Title Case for latin words;
// non-latin tokens kept as-is). Pure.
export function domainDisplayName(slug) {
  const tokens = domainNameTokens(slug);
  if (tokens.length === 0) return "Domain";
  return tokens
    .map((token) => (/[a-z]/i.test(token) ? token.charAt(0).toUpperCase() + token.slice(1).toLowerCase() : token))
    .join(" ");
}

// Best-effort: read the immediate subdirectories of each known parent as domain
// candidates. A missing/unreadable parent is skipped, never fatal. Returns
// { rawName, sourceFile } with posix sourceFile paths.
export async function detectDomainDirectories(cwd) {
  const found = [];
  for (const parent of DOMAIN_PARENT_DIRS) {
    const absParent = path.join(cwd, ...parent.split("/"));
    let entries;
    try {
      entries = await readdir(absParent, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      if (name.startsWith(".") || name.startsWith("__")) continue;
      if (DOMAIN_EXCLUDE_NAMES.has(name.toLowerCase())) continue;
      found.push({ rawName: name, sourceFile: `${parent}/${name}` });
    }
  }
  return found;
}

// Merge detected directories by normalized slug, sort deterministically by slug,
// and assign ordinal-numbered doc paths (01_, 02_, ...). Same domain found in
// several locations collapses to one doc whose source_files lists every path.
// Pure.
export function planDomainDocs(detected) {
  const bySlug = new Map();
  for (const item of detected) {
    const slug = normalizeDomainSlug(item.rawName);
    if (!bySlug.has(slug)) bySlug.set(slug, new Set());
    bySlug.get(slug).add(toPosix(item.sourceFile));
  }
  return [...bySlug.keys()]
    .sort((left, right) => left.localeCompare(right))
    .map((slug, index) => ({
      rel: `docs/llm-wiki/domains/${String(index + 1).padStart(2, "0")}_${slug}.md`,
      slug,
      domainName: domainDisplayName(slug),
      sourceFiles: [...bySlug.get(slug)].sort()
    }));
}

// Domain docs are generated only for backend/fullstack, non-minimal init.
// relatedExtras links the backend contract docs only when they are themselves
// part of this init's candidate set, so no broken links are introduced.
async function buildDomainContext(cwd, projectType, minimal, candidateSet) {
  if (minimal || (projectType !== "backend" && projectType !== "fullstack")) {
    return emptyDomainContext();
  }
  const plans = planDomainDocs(await detectDomainDirectories(cwd));
  const relatedExtras = ["docs/llm-wiki/API_CONTRACTS.md", "docs/llm-wiki/DATA_MODEL.md"]
    .filter((doc) => candidateSet.has(doc));
  return { plans, relatedExtras };
}

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

function findingExplanation(category, defaultSeverity, meaning, whyItMatters, remediation, commands, relatedRules) {
  return {
    category,
    defaultSeverity,
    meaning,
    whyItMatters,
    remediation,
    commands,
    relatedRules
  };
}

function normalizeExplainRule(rule) {
  return String(rule ?? "").trim();
}

function formatFinding(finding) {
  return `[${finding.severity}] ${finding.rule} ${finding.path}: ${finding.message}`;
}

function summarizeFindings(findings) {
  const summary = {
    total: findings.length,
    bySeverity: {},
    byCategory: {}
  };

  for (const finding of findings) {
    const severity = finding.severity ?? "unknown";
    const category = findingCategory(finding.rule);
    summary.bySeverity[severity] = (summary.bySeverity[severity] ?? 0) + 1;
    summary.byCategory[category] = (summary.byCategory[category] ?? 0) + 1;
  }

  return summary;
}

function findingCategory(rule) {
  if (!rule) return "unknown";
  return String(rule).split(".")[0] || "unknown";
}

function formatFindingSummary(summary) {
  if (summary.total === 0) return [];

  return [
    `total: ${summary.total}`,
    `by_severity: ${formatCountMap(summary.bySeverity)}`,
    `by_category: ${formatCountMap(summary.byCategory)}`
  ];
}

function formatWikiGraphSummary(wikiGraph) {
  if (!wikiGraph || wikiGraph.summary.documents === 0) return ["not available"];

  const summary = wikiGraph.summary;
  const lines = [
    `documents: ${summary.documents}`,
    `wiki_links: ${summary.wikiLinks}`,
    `resolved_wiki_links: ${summary.resolvedWikiLinks}`,
    `unresolved_concepts: ${summary.unresolvedWikiLinks}`,
    `aliases: ${summary.aliases}`,
    `orphan_documents: ${summary.orphanDocuments}`
  ];

  if (wikiGraph.unresolvedConcepts.length > 0) {
    lines.push(`unresolved: ${wikiGraph.unresolvedConcepts.map((item) => `${item.target} (${item.sources.join(", ")})`).join("; ")}`);
  }
  if (wikiGraph.aliases.length > 0) {
    lines.push(`alias_targets: ${wikiGraph.aliases.map((item) => `${item.alias} -> ${item.path}`).join("; ")}`);
  }
  if (wikiGraph.orphanDocuments.length > 0) {
    lines.push(`orphans: ${wikiGraph.orphanDocuments.join(", ")}`);
  }

  return lines;
}

function formatNextActions(actions) {
  if (actions.length === 0) return ["No next actions recommended. Run llm-wiki status or llm-wiki validate when the project changes."];

  return actions.map((action) => {
    const details = [
      `[${action.priority}] ${action.title}: ${action.reason}`,
      `command: ${action.command}`
    ];
    if (action.paths.length > 0) details.push(`paths: ${action.paths.join(", ")}`);
    if (action.targets.length > 0) details.push(`targets: ${action.targets.join(", ")}`);
    return details.join(" ");
  });
}

function formatCountMap(counts) {
  const entries = Object.entries(counts).sort(([left], [right]) => left.localeCompare(right));
  return entries.length
    ? entries.map(([key, count]) => `${key}=${count}`).join(", ")
    : "none";
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

function formatStatusCounts(counts) {
  return Object.entries(counts).map(([status, count]) => `${status}: ${count}`);
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

function withText(payload, title, sections) {
  return {
    ...payload,
    text: renderTextReport(title, sections)
  };
}
