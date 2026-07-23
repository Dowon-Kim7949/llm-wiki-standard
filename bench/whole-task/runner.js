// Whole-task experiment runner — SCAFFOLD (dry-run planner only).
//
// Separate from the retrieval bench (bench/run.js, bench/real/). This runner does
// NOT call models, make paid calls, or produce scores. It loads a task set,
// validates the rubric shape, and prints the plan (2 questions x 3 arms x tasks)
// so a human can drive the arms manually and grade against the rubric. A real run
// needs a driver + human/labeled-judge grading (see METHODOLOGY.md); this scaffold
// refuses to emit a result and never fabricates a number. Zero-dependency (Node
// stdlib only); lives under bench/ (outside the npm files allowlist).
//
// Usage:
//   node bench/whole-task/runner.js --dry [--tasks bench/whole-task/tasks.sample.json]
import { readFileSync } from "node:fs";
import path from "node:path";

const ARMS = ["source-only", "wiki-retrieval", "guided", "guided-compact"];

function parseArgs(argv) {
  const opts = { dry: false, tasks: "bench/whole-task/tasks.sample.json" };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--dry") opts.dry = true;
    else if (argv[i] === "--tasks") opts.tasks = argv[++i];
  }
  return opts;
}

function validateTask(task, index) {
  const errs = [];
  if (!task.id) errs.push(`task[${index}]: missing id`);
  if (!["onboard", "prepare-fix", "prepare-feature"].includes(task.kind)) errs.push(`task[${index}]: bad kind`);
  if (!task.rubric || typeof task.rubric !== "object") errs.push(`task[${index}]: missing rubric`);
  else if (!Array.isArray(task.rubric.evidencePoints) || task.rubric.evidencePoints.length === 0) {
    errs.push(`task[${index}] (${task.id}): rubric.evidencePoints must be a non-empty array of checkable facts`);
  }
  return errs;
}

function armGuidance(kind, task) {
  const t = task.task ? `"${task.task}"` : "(the selected domain/area)";
  return {
    "source-only": `Work from SOURCE only (no wiki). ${kind === "onboard" ? "Explain the area." : `Scope: ${t}.`}`,
    "wiki-retrieval": `You may query the wiki (search-docs/get-doc/get-related) but not the guided skills. ${kind === "onboard" ? "Explain the area." : `Scope: ${t}.`}`,
    guided: kind === "onboard"
      ? "Run the /llm-wiki-onboard skill (or `llm-wiki onboard`), then explain from evidence."
      : `Run the /llm-wiki-prepare skill (or \`llm-wiki prepare --task ${t}\`), then hand off to /llm-wiki-${kind === "prepare-fix" ? "fix" : "feature"}.`,
    // Proposed compact/adaptive arm: the token-controlled retrieval path — the
    // chosen path decides how much wiki to pull, and reads stay section-scoped.
    "guided-compact": kind === "onboard"
      ? "Run `llm-wiki onboard`, then read only the section-scoped docs it points to (`get-doc --section <terms> --strict-section`). Explain from evidence."
      : `Run \`llm-wiki prepare --task ${t} --compact\` (one bounded bundle: chosen path + top docs' relevant sections), expand only as needed with \`get-doc --section --strict-section\`, then hand off to /llm-wiki-${kind === "prepare-fix" ? "fix" : "feature"}.`
  };
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const abs = path.resolve(opts.tasks);
  let tasks;
  try {
    tasks = JSON.parse(readFileSync(abs, "utf8"));
  } catch (e) {
    console.error(`Cannot read task set ${opts.tasks}: ${e.message}`);
    process.exitCode = 1;
    return;
  }
  const errors = tasks.flatMap(validateTask);
  if (errors.length) {
    errors.forEach((e) => console.error(e));
    process.exitCode = 1;
    return;
  }

  if (!opts.dry) {
    console.error("No driver is wired: this scaffold does not execute models, make paid calls, or grade answers.");
    console.error("Re-run with --dry to print the plan, then drive the arms manually and grade against the rubric (see METHODOLOGY.md). Results are never fabricated.");
    process.exitCode = 2;
    return;
  }

  console.log(`Whole-task experiment — DRY PLAN (${tasks.length} tasks x ${ARMS.length} arms)`);
  console.log("Separate from the retrieval bench. No models called; no scores produced.\n");
  for (const task of tasks) {
    console.log(`# ${task.id}  [${task.kind}]${task.domain ? `  domain=${task.domain}` : ""}`);
    const guidance = armGuidance(task.kind, task);
    for (const arm of ARMS) console.log(`  - ${arm}: ${guidance[arm]}`);
    console.log(`  rubric: ${task.rubric.evidencePoints.length} evidence points, ${(task.rubric.mustNotClaim || []).length} must-not-claim, ${(task.rubric.passCriteria || []).length} pass criteria`);
    console.log("");
  }
  console.log("Next: drive each arm in a fresh session, grade against the rubric, and record a whole-task-<agent>-<date>.md per RESULT_TEMPLATE.md.");
}

main();
