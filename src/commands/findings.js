// Finding registry, rule-toggle application, and report/summary formatters,
// extracted from commands.js on 2026-07-16 (behavior-preserving refactor,
// GATE_REVIEW stabilization). FINDING_EXPLANATIONS is the single registry of
// rule metadata (used by `explain` and by applyRuleConfig's toggle guard); the
// format* helpers and withText render the human-readable report sections. Self-
// contained: depends only on config.js (JSON_SCHEMA_VERSION) and report.js
// (renderTextReport); no back-dependency on commands.js.
import { JSON_SCHEMA_VERSION } from "../config.js";
import { renderTextReport } from "../report.js";
import { localizeFinding, normalizeLang } from "../i18n.js";

export const FINDING_EXPLANATIONS = {
  "structure.wiki_missing": findingExplanation("structure", "warning", "The project does not have docs/llm-wiki/index.md, so LLM-WIKI is not initialized.", "Agents and CI need a stable wiki entrypoint before they can follow the documentation contract.", ["Ask whether the project should be initialized now.", "Run init --dry-run first when you want to preview files.", "Run init --write when you are ready to create the missing wiki structure."], ["llm-wiki init --dry-run", "llm-wiki init --write", "llm-wiki status"], ["structure.required_doc"]),
  "structure.required_doc": findingExplanation("structure", "warning", "A required core, project-type, or profile document is missing.", "Missing required documents leave agents without expected project, domain, API, or profile context.", ["Review the path reported in the finding.", "Create the document with status needs_review.", "Use init --write to create missing standard templates when appropriate."], ["llm-wiki init --dry-run", "llm-wiki init --write", "llm-wiki validate"], ["structure.wiki_missing"]),
  "structure.output_gitignored": findingExplanation("structure", "warning", "The wiki output path (docs/llm-wiki) is ignored by git, so generated documents are created but never tracked.", "Untracked wiki docs are invisible to teammates, code review, and CI — the files exist locally but silently never reach the repository.", ["Check your .gitignore for a rule covering docs/ or docs/llm-wiki.", "Remove or narrow that rule, or force-add the wiki with git add -f docs/llm-wiki.", "Confirm the docs are tracked with git status."], ["llm-wiki doctor", "llm-wiki init --write"], ["structure.wiki_missing"]),
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
  "evidence.symbol_unverified": findingExplanation("evidence", "warning", "An evidence #symbol: reference names a symbol the referenced file does not mention. Conservative check: flagged only when the file mentions none of the referenced name(s).", "A symbol pointer that the file does not even mention is almost certainly stale or wrong, so the 'code-grounded' claim does not hold; format-only validation cannot catch this.", ["Fix the symbol name or the file path if the symbol moved or was renamed.", "Remove the locator (keep the bare file) if the symbol no longer exists.", "This is a textual presence floor, not an AST resolver — it never confirms the symbol is a real definition; escalate with --strict or via config rules.", "Run validate again."], ["llm-wiki validate", "llm-wiki validate --strict"], ["evidence.missing", "evidence.line_range", "evidence.shape"]),
  "evidence.section_unverified": findingExplanation("evidence", "warning", "An evidence #section: reference (on a Markdown source) names a heading the file does not contain.", "A section pointer with no matching heading is stale, so a reviewer cannot follow the evidence to the claimed passage.", ["Fix the section name or the file path if the heading was renamed or moved.", "Remove the locator (keep the bare file) if the section no longer exists.", "Section existence is checked for Markdown sources only; escalate with --strict or via config rules.", "Run validate again."], ["llm-wiki validate", "llm-wiki validate --strict"], ["evidence.missing", "evidence.shape"]),
  "evidence.ungrounded": findingExplanation("evidence", "warning", "A verified document has no source_files and no evidence, so it is 'verified' with no code grounding.", "Verified is meant to assert reviewed, source-backed knowledge; a verified document with zero grounding cannot be checked against the code and weakens trust in the verified status.", ["Add source_files and/or evidence pointing at the code the document describes.", "Downgrade the document to needs_review if it is not actually source-backed.", "This is intentional for some verified docs (e.g. narrative notes); turn it off per project by setting \"evidence.ungrounded\": \"off\" in llm-wiki.config.json rules.", "Run validate again."], ["llm-wiki validate", "llm-wiki audit"], ["evidence.missing", "frontmatter.verified_review"]),
  "changed.unavailable": findingExplanation("changed", "error", "The --changed scope could not read git history.", "validate --changed needs a git repository to diff against; without it the changed-file set is unknown.", ["Run inside a git repository from the repo root.", "Drop --changed to validate the whole wiki.", "For CI, ensure the checkout includes history and a base ref."], ["llm-wiki validate", "llm-wiki validate --changed --since <ref>"], []),
  "impact.source_changed": findingExplanation("impact", "warning", "A verified document depends on source files that changed in the current diff, while the document itself did not change.", "This is the diff-anchored, pre-merge complement to the date-anchored evidence.stale: it catches the case that matters most — code and its doc changing in separate places/PRs — so a verified document does not silently fall out of sync with the code it documents.", ["Re-read the changed source and update the verified document in the same change set.", "If the claims no longer hold, downgrade the document to needs_review (llm-wiki drift --downgrade).", "Refresh reviewed_by/reviewed_at after a new human review.", "This is a file-level heuristic based on the diff; ignore it when the change did not affect the documented claims.", "Enable CI failure with impact --strict, or set \"impact.source_changed\" in llm-wiki.config.json rules."], ["llm-wiki impact --since <ref>", "llm-wiki impact --strict", "llm-wiki drift --downgrade"], ["evidence.stale", "frontmatter.verified_review"]),
  "impact.unavailable": findingExplanation("impact", "error", "The impact check could not read git history.", "impact needs a git repository to compute the changed-file set to diff verified documents against; without it the reverse-impact check cannot run.", ["Run inside a git repository from the repo root.", "Use --since <ref> to compare against a PR base ref.", "For CI, ensure the checkout includes history and a base ref."], ["llm-wiki impact", "llm-wiki impact --since <ref>"], ["changed.unavailable"]),
  "run.doc_gap": findingExplanation("run", "warning", "A run manifest lists a changed source file that no touched wiki document references.", "The wiki-grounded skill workflow (Gate 21) expects a code change to be reflected in the docs; a changed source with no touched doc that cites it is the pipeline step most likely skipped.", ["Update the wiki document(s) that describe the changed source and add it to their source_files/evidence.", "Add the doc to the manifest's touchedDocs once updated.", "Downgrade the affected verified doc to needs_review if its claims changed.", "This is a file-level heuristic; ignore it when the change did not affect any documented claim."], ["llm-wiki check-run", "llm-wiki check-run --strict"], ["impact.source_changed", "evidence.stale"]),
  "run.log_missing": findingExplanation("run", "warning", "A run manifest reports that the append-only change log was not updated.", "docs/llm-wiki/log.md is the append-only record of what changed; skipping it loses the audit trail a skill run is supposed to leave.", ["Append an entry to docs/llm-wiki/log.md describing the change.", "Set logAppended to true in the manifest once done.", "Enable CI failure with check-run --strict."], ["llm-wiki check-run"], ["run.doc_gap"]),
  "run.unvalidated": findingExplanation("run", "warning", "A run manifest reports that validation did not run or did not pass.", "A skill run should leave the wiki in a validating state; an unvalidated run may have introduced findings that were never checked.", ["Run llm-wiki validate and fix any findings.", "Record the validation result in the manifest (validated: { ran: true, result: \"pass\" }).", "Enable CI failure with check-run --strict."], ["llm-wiki validate", "llm-wiki check-run"], ["run.doc_gap"]),
  "run.manifest_missing": findingExplanation("run", "warning", "check-run found no run manifest to check.", "Without a manifest there is nothing to verify; a skill run is expected to leave one under .llm-wiki/runs/.", ["Have the skill run write a manifest under .llm-wiki/runs/ (see the skill workflow).", "Pass --run <path> to check a specific manifest.", "This is a no-op when a project does not use the run-manifest workflow."], ["llm-wiki check-run", "llm-wiki check-run --run <path>"], ["run.doc_gap"]),
  "run.manifest_invalid": findingExplanation("run", "error", "A run manifest could not be parsed or is missing required fields.", "A malformed manifest cannot be checked and usually means the run did not complete its contract.", ["Ensure the manifest is valid JSON with task, changedSource, touchedDocs, logAppended, and validated fields.", "Regenerate the manifest from the skill workflow.", "Pass --run <path> to point at the intended manifest."], ["llm-wiki check-run --run <path>"], ["run.manifest_missing"]),
  "related.missing": findingExplanation("related", "warning", "A related frontmatter entry points to a local document that does not exist.", "Related links help agents and readers navigate between connected wiki documents, so broken entries weaken the wiki graph and erode trust in generated reports.", ["Fix the path if the related document moved or was renamed.", "Remove stale related entries that no longer apply.", "Create the related document when it should exist.", "Use an explicit external URL only when the reference is outside the repository."], ["llm-wiki audit", "llm-wiki validate"], ["markdown_link.missing", "source_files.missing"]),
  "markdown_link.missing": findingExplanation("markdown_link", "warning", "A local Markdown link target does not exist.", "Broken local links make the wiki harder to navigate and reduce trust in generated reports.", ["Check whether the target path was renamed or moved.", "Update the link or create the missing target document.", "External links, mailto links, and local anchors are intentionally skipped."], ["llm-wiki validate", "llm-wiki status"], ["wiki_link.missing"]),
  "wiki_link.missing": findingExplanation("wiki_link", "warning", "A [[wiki link]] target does not resolve to a file path, basename, title, or alias.", "Unresolved wiki links break concept navigation and weaken OKF-style knowledge graph output.", ["Create a document for the missing concept when it is real.", "Update the link text to match an existing title, basename, file path, or alias.", "Add a reviewed aliases entry to the intended target document when appropriate."], ["llm-wiki validate", "llm-wiki next", "llm-wiki audit --format markdown"], ["markdown_link.missing", "okf.array_shape"]),
  "okf.type_required": findingExplanation("okf", "error", "An OKF v0.1-profiled document is missing the required frontmatter type field.", "OKF requires explicit document type metadata and LLM-WIKI does not infer it from doc_type.", ["Add an explicit type field to the frontmatter.", "Use a reviewed OKF type such as concept, project, person, meeting_note, event, or api_reference.", "Keep doc_type when the document also needs the LLM-WIKI contract."], ["llm-wiki validate --profile okf-v0.1"], ["okf.type_shape", "okf.array_shape"]),
  "okf.type_shape": findingExplanation("okf", "error", "The OKF type field exists but is not a string.", "Tools need a stable scalar type value to classify OKF documents.", ["Change type to a single scalar string.", "Avoid list or object values for type.", "Run validate with the OKF profile again."], ["llm-wiki validate --profile okf-v0.1"], ["okf.type_required"]),
  "okf.array_shape": findingExplanation("okf", "error", "An OKF aliases or tags field is present but is not an array.", "OKF-compatible aliases and tags need stable array shapes for graph and search workflows.", ["Rewrite aliases or tags as YAML lists.", "Keep aliases reviewed and intentional.", "Run validate with the OKF profile again."], ["llm-wiki validate --profile okf-v0.1"], ["frontmatter.array"]),
  "content.thin_body": findingExplanation("content", "warning", "A wiki content document has very little body prose. Opt-in lint: off by default, enabled per project via config rules.", "A started-but-undeveloped stub passes structural validation yet carries little knowledge; teams that want to catch these can enable the rule for their project.", ["Enrich the document with source-backed content (summary, evidence, review notes).", "Run llm-wiki handoff to get an enrichment prompt.", "This rule is off by default; enable it by setting \"content.thin_body\" in llm-wiki.config.json rules (or omit it to keep it off)."], ["llm-wiki handoff --agent codex", "llm-wiki validate"], ["content.not_enriched"]),
  "content.not_enriched": findingExplanation("content", "warning", "A generated wiki document still contains placeholder guidance and has not been enriched with source-backed content.", "Empty scaffolds pass structural validation but hold no real knowledge, so the token-saving and handoff-replacement goals are not met until an agent or human fills them in from source evidence.", ["Read the document and the files listed in source_files, then replace the placeholder bullets with source-backed content.", "Run llm-wiki next to see, per document, which ## sections still hold generated placeholder text (the Enrichment Checklist).", "Run llm-wiki handoff --agent codex or --agent claude to get an enrichment prompt.", "Keep the document as needs_review until human review is complete."], ["llm-wiki next", "llm-wiki handoff --agent codex", "llm-wiki validate"], ["structure.required_doc", "source_files.missing"]),
  "adapter.missing": findingExplanation("adapter", "warning", "A selected agent adapter file is missing.", "Adapter files tell Codex or Claude Code where the wiki entrypoint is and how to follow the project contract.", ["Run init --write with the selected agent.", "Review generated adapter text before relying on it.", "Existing adapter files are never overwritten."], ["llm-wiki init --write --agent codex", "llm-wiki init --write --agent claude"], ["adapter.entrypoint"]),
  "adapter.entrypoint": findingExplanation("adapter", "warning", "An adapter exists but does not point to docs/llm-wiki/index.md.", "Agents need a reliable entrypoint to find project knowledge before editing code.", ["Open the reported adapter file.", "Add or correct the docs/llm-wiki/index.md reference.", "Run audit again with the selected agent."], ["llm-wiki audit --agent codex", "llm-wiki audit --agent claude"], ["adapter.missing"]),
  "encoding.bom": findingExplanation("encoding", "info", "A UTF-8 BOM was detected.", "BOMs are usually harmless, but they can create noisy diffs or surprise simple parsers.", ["Leave it alone if your team accepts BOMs.", "Remove the BOM with an editor that preserves UTF-8 when you want cleaner diffs.", "Run audit again."], ["llm-wiki audit"], ["encoding.mojibake"]),
  "encoding.mojibake": findingExplanation("encoding", "blocked", "Text that looks like mojibake was detected.", "Automatic rewrites are unsafe when text may already be corrupted.", ["Stop automated rewrite work on the reported file.", "Recover the file from a known-good UTF-8 source or manually repair the encoding.", "Run audit again after repair."], ["llm-wiki audit"], ["encoding.bom"]),
  "visibility.public_sensitive": findingExplanation("visibility", "warning", "A visibility: public document contains sensitive-looking content. Opt-in lint, enabled via config rules.", "Public documents may leave the organization, so they must not carry token/credential/secret-like values.", ["Remove or redact the sensitive value, or lower the document's visibility.", "This rule is off by default; enable it by setting \"visibility.public_sensitive\" in llm-wiki.config.json rules.", "The sensitive value is never shown in the finding; inspect the file locally."], ["llm-wiki audit", "llm-wiki explain visibility.public_sensitive"], ["sensitive.redacted", "visibility.declared_mismatch"]),
  "visibility.declared_mismatch": findingExplanation("visibility", "warning", "A document declares contains_sensitive_info: false but sensitive-looking content was found. Opt-in lint, enabled via config rules.", "The frontmatter declaration should match the content so tooling and reviewers can trust it.", ["Set contains_sensitive_info: true, or remove/redact the sensitive value.", "This rule is off by default; enable it by setting \"visibility.declared_mismatch\" in llm-wiki.config.json rules.", "The sensitive value is never shown in the finding."], ["llm-wiki audit", "llm-wiki explain visibility.declared_mismatch"], ["sensitive.redacted", "visibility.public_sensitive"]),
  "sensitive.redacted": findingExplanation("sensitive", "blocked", "Sensitive-looking content was detected and redacted from the finding message.", "Reports and generated docs must not leak tokens, credentials, or secret-like values.", ["Inspect the reported file and line locally.", "Remove or rotate the sensitive value if it is real.", "Replace examples with clearly fake placeholder values."], ["llm-wiki audit"], []),
  "project.review_item": findingExplanation("project", "warning", "Project detection found something a human should review.", "Detection is conservative; explicit review keeps generated templates aligned with the real project.", ["Read the finding message.", "Pass --type or --profile explicitly when auto-detection is too weak.", "Run status or audit again."], ["llm-wiki status --type frontend", "llm-wiki audit --profile library"], []),
  "handoff.unsupported_agent": findingExplanation("handoff", "blocked", "The selected handoff target is not supported yet.", "Unsupported adapter contracts should not be treated as safe handoff instructions.", ["Use a supported agent such as codex or claude.", "Keep Antigravity blocked until its adapter contract is confirmed.", "Run handoff again with a supported agent."], ["llm-wiki handoff --agent codex", "llm-wiki handoff --agent claude"], ["adapter.missing"]),
  "prompt.unsupported_task": findingExplanation("prompt", "blocked", "The requested task prompt preset is not supported.", "Prompt presets are intentionally narrow so task workflows stay predictable and reviewable.", ["Choose one of feature, fix, refactor, docs-sync, or okf-extract.", "Use help prompt to review supported task names.", "Add a new preset deliberately if the workflow becomes stable."], ["llm-wiki help prompt", "llm-wiki prompt --task feature"], []),
  "review.reviewer_unresolved": findingExplanation("review", "error", "review --approve could not resolve a reviewer name to stamp reviewed_by.", "Verified sign-off must record who approved the document; the tool refuses to write a blank or fabricated reviewer, so promotion is skipped until a name resolves.", ["Set your git identity with git config user.name \"Your Name\".", "Or add \"reviewer\": \"Your Name\" to llm-wiki.config.json.", "Or pass --reviewer \"Your Name\" to the command."], ["llm-wiki review --approve <path> --reviewer \"Your Name\""], ["frontmatter.verified_review"]),
  "review.confirmation_required": findingExplanation("review", "error", "review --approve-all needs an explicit --yes confirmation.", "Bulk promotion to verified is a broad human sign-off across many documents, so it must be confirmed explicitly rather than triggered by a single flag.", ["Re-run with review --approve-all --yes to confirm promoting every approvable needs_review document.", "Or approve specific documents by name with review --approve <path>."], ["llm-wiki review --approve-all --yes", "llm-wiki review --approve <path>"], [])
};

export function findingExplanation(category, defaultSeverity, meaning, whyItMatters, remediation, commands, relatedRules) {
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

export function normalizeExplainRule(rule) {
  return String(rule ?? "").trim();
}

export function formatFinding(finding) {
  return `[${finding.severity}] ${finding.rule} ${finding.path}: ${finding.message}`;
}

export function summarizeFindings(findings) {
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

export function findingCategory(rule) {
  if (!rule) return "unknown";
  return String(rule).split(".")[0] || "unknown";
}

// Finding categories that can NEVER be toggled by config `rules` — safety
// invariants (sensitive-info detection) stay on and at their severity regardless
// of any per-project override.
export const NON_TOGGLEABLE_CATEGORIES = new Set(["sensitive"]);

// Applies per-project rule toggles (options.rules, from llm-wiki.config.json) to a
// findings array: a rule set to "off" is dropped; any other value overrides that
// rule's severity. Only registry rules (FINDING_EXPLANATIONS) are toggleable, and
// safety categories above are never toggled; everything else passes through
// unchanged. Idempotent, so it is safe as findings compose across commands.
export function applyRuleConfig(findings, options) {
  const rules = options && options.rules;
  const hasRules = rules && typeof rules === "object" && Object.keys(rules).length > 0;
  // Gate 27 (P4): localize each finding's human-facing `message` to options.lang
  // here — the single seam every command routes findings through — so both the
  // text sections (built via formatFinding) and the JSON `findings` payload pick
  // up the localized message. The default `en` path never routes through the
  // catalog, so English output stays byte-identical.
  const localizing = normalizeLang(options && options.lang) !== "en";
  if (!hasRules && !localizing) return findings;
  const out = [];
  for (const finding of findings) {
    const localized = localizing ? localizeFinding(finding, options.lang) : finding;
    if (!hasRules) {
      out.push(localized);
      continue;
    }
    const action = rules[finding.rule];
    const toggleable = action !== undefined
      && Object.prototype.hasOwnProperty.call(FINDING_EXPLANATIONS, finding.rule)
      && !NON_TOGGLEABLE_CATEGORIES.has(findingCategory(finding.rule));
    if (!toggleable) {
      out.push(localized);
      continue;
    }
    if (action === "off") continue;
    out.push({ ...localized, severity: action });
  }
  return out;
}

export function formatFindingSummary(summary) {
  if (summary.total === 0) return [];

  return [
    `total: ${summary.total}`,
    `by_severity: ${formatCountMap(summary.bySeverity)}`,
    `by_category: ${formatCountMap(summary.byCategory)}`
  ];
}

export function formatWikiGraphSummary(wikiGraph) {
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

export function formatNextActions(actions) {
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

// P5: render the per-document enrichment checklist for `next`. Each entry is
// { path, items: [{ section, hint }] } — the placeholder sections still to fill.
export function formatEnrichmentChecklist(checklists) {
  if (!checklists || checklists.length === 0) {
    return ["No placeholder documents detected. Enrichment is complete or not yet started."];
  }
  const lines = [];
  for (const doc of checklists) {
    const items = doc.items ?? [];
    lines.push(`${doc.path} — fill ${items.length} section(s):`);
    for (const item of items) {
      lines.push(`  ${item.section} → ${item.hint}`);
    }
  }
  return lines;
}

export function formatCountMap(counts) {
  const entries = Object.entries(counts).sort(([left], [right]) => left.localeCompare(right));
  return entries.length
    ? entries.map(([key, count]) => `${key}=${count}`).join(", ")
    : "none";
}

export function formatStatusCounts(counts) {
  return Object.entries(counts).map(([status, count]) => `${status}: ${count}`);
}

export function withText(payload, title, sections) {
  // Every command result self-describes the JSON output contract with a
  // top-level `schemaVersion` (= config.js JSON_SCHEMA_VERSION), so programmatic
  // consumers can read it straight off the returned object without importing the
  // SCHEMA_VERSION constant. `text` is always the rendered human-readable text
  // report; the `--format` option only affects CLI/`run()` stdout and `--out`
  // files, never the shape of the returned object.
  return {
    schemaVersion: JSON_SCHEMA_VERSION,
    ...payload,
    text: renderTextReport(title, sections)
  };
}
