import { execFileSync } from "node:child_process";

export function runGit(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

// True when <file> has commits after the END of the given YYYY-MM-DD date.
// Anchoring to end-of-day means a document reviewed on date D "covers" every
// commit made on day D, so a same-day review reports no drift; only commits on a
// later day count. reviewed_at/last_updated are date-only, so this is the most
// precise boundary available without a review timestamp.
// Best-effort: throws only if git itself fails; callers treat that as "unknown".
export function fileChangedSince(cwd, file, sinceDate) {
  const out = runGit(cwd, ["log", `--since=${sinceDate} 23:59:59`, "--pretty=format:%h", "--", file]).trim();
  return out.length > 0;
}
