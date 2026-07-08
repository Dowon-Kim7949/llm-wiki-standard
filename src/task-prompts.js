export const SUPPORTED_TASK_PROMPTS = new Set(["feature", "fix", "refactor", "docs-sync", "okf-extract"]);

export function buildTaskPrompt({ task, cwd, projectType, profiles = [], agents = [] }) {
  if (!SUPPORTED_TASK_PROMPTS.has(task)) {
    return {
      task,
      result: "blocked",
      prompt: "",
      findings: [{
        severity: "blocked",
        rule: "prompt.unsupported_task",
        path: ".",
        message: `Unsupported prompt task: ${task ?? "missing"}. Supported tasks: ${[...SUPPORTED_TASK_PROMPTS].join(", ")}.`
      }]
    };
  }

  const context = {
    cwd,
    projectType: projectType ?? "unknown",
    profiles,
    agents: agents.length ? agents : ["codex", "claude"]
  };

  const prompt = task === "docs-sync"
    ? docsSyncPrompt(context)
    : task === "okf-extract"
      ? okfExtractPrompt(context)
      : implementationPrompt(task, context);

  return {
    task,
    result: "pass",
    projectType: context.projectType,
    profiles: context.profiles,
    agents: context.agents,
    prompt,
    findings: []
  };
}

export function apiServiceInventoryChecklist() {
  return [
    "- API service name.",
    "- Endpoint or client module.",
    "- HTTP method or call signature.",
    "- Request params or payload.",
    "- Response shape.",
    "- Auth, session, token, or cookie dependency.",
    "- Error handling.",
    "- Retry or timeout behavior.",
    "- Cache or state update behavior.",
    "- Related UI or domain workflow.",
    "- `source_files` evidence."
  ];
}

function implementationPrompt(task, context) {
  const taskTitle = {
    feature: "post-wiki feature development",
    fix: "post-wiki bug fix",
    refactor: "post-wiki refactor"
  }[task];

  return `You are a senior engineer working in an LLM-WIKI-enabled project.

Workspace:
${context.cwd}

Task:
Run a ${taskTitle} workflow. The project type is ${context.projectType}. Active profiles: ${formatList(context.profiles)}. Target agent context: ${formatList(context.agents)}.

Required workflow:
1. Read docs/llm-wiki/index.md first.
2. Locate related domain, API, component, architecture, workflow, and decision documents before editing.
3. Inspect actual source files before making claims or code changes.
4. Produce a short implementation plan.
5. Make the requested code change with the smallest safe scope.
6. Update every affected LLM-WIKI document in the same task.
7. Append docs/llm-wiki/log.md in append-only style with changed files, evidence, caveats, and review notes.
8. Keep CLI-created or agent-edited wiki documents as status: needs_review.
9. Do not promote any document to verified; verified is human-approved only.
10. Run relevant tests, or explain exactly why they were not run.

When a domain document mentions API usage, include this API Services inventory:
${apiServiceInventoryChecklist().join("\n")}

Expected final response:
- Changed files.
- Source evidence inspected.
- Tests run and results.
- Wiki docs updated.
- Remaining review items or caveats.`;
}

function docsSyncPrompt(context) {
  return `You are a senior documentation maintenance engineer working in an LLM-WIKI-enabled project.

Workspace:
${context.cwd}

Task:
Run a docs-sync workflow. The project type is ${context.projectType}. Active profiles: ${formatList(context.profiles)}. Target agent context: ${formatList(context.agents)}.

Required workflow:
1. Read docs/llm-wiki/index.md first.
2. Detect changed code and documentation context using git status, git diff, and relevant source files.
3. Locate affected domain, API, component, architecture, workflow, and decision documents.
4. Inspect actual source files before deciding a wiki document is stale.
5. Update stale LLM-WIKI documents only; avoid unrelated code edits.
6. Append docs/llm-wiki/log.md in append-only style with changed docs, source evidence, caveats, and review notes.
7. Keep CLI-created or agent-edited wiki documents as status: needs_review.
8. Do not promote any document to verified; verified is human-approved only.
9. Run relevant validation or explain exactly why it was not run.

When a domain document mentions API usage, include this API Services inventory:
${apiServiceInventoryChecklist().join("\n")}

Expected final response:
- Changed wiki docs.
- Source evidence inspected.
- Validation run and results.
- Remaining stale areas or review items.`;
}

function okfExtractPrompt(context) {
  return `You are an AI Knowledge Editor working in an LLM-WIKI-enabled project.

Workspace:
${context.cwd}

Task:
Run an OKF v0.1 extraction workflow as a prompt-assisted process, not automatic extraction. The project type is ${context.projectType}. Active profiles: ${formatList(context.profiles)}. Target agent context: ${formatList(context.agents)}.

Required workflow:
1. Read docs/llm-wiki/index.md first when storing results in an LLM-WIKI project.
2. Inspect the provided raw text or source files before extracting knowledge.
3. Convert durable concepts, projects, APIs, meeting notes, or events into Markdown documents with YAML frontmatter.
4. Use OKF v0.1 frontmatter: required type, optional aliases, and optional tags.
5. Use clear Markdown headings and bullet lists.
6. Connect related concepts in the body with wiki links such as [[Concept Name]].
7. Preserve source evidence in LLM-WIKI source_files when documents are stored under docs/llm-wiki.
8. Keep AI-extracted documents as status: needs_review when stored in an LLM-WIKI project.
9. Do not promote any extracted document to verified; verified is human-approved only.
10. List unresolved concepts, aliases to review, and extraction caveats.

Expected final response:
- Extracted document list.
- Source evidence inspected.
- Unresolved wiki links or ambiguous concepts.
- Review items before any human approval.`;
}

function formatList(values) {
  return values.length ? values.join(", ") : "none";
}
