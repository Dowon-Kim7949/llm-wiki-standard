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

// True when the given line range of <file> has commits after the END of
// sinceDate. Uses `git log -L<start>,<end>:<file> -s` so only edits touching
// those specific lines count — a narrower signal than fileChangedSince for
// evidence that cites exact line ranges. `-s` suppresses the patch, leaving just
// commit hashes to test for presence.
// Best-effort: throws only if git itself fails (e.g. an out-of-range line);
// callers treat that as "unknown" and fall back to the file-level check.
export function lineRangeChangedSince(cwd, file, start, end, sinceDate) {
  const out = runGit(cwd, [
    "log",
    `--since=${sinceDate} 23:59:59`,
    "--pretty=format:%h",
    "-s",
    `-L${start},${end}:${file}`
  ]).trim();
  return out.length > 0;
}

// True when <relPath> is ignored by git (via `git check-ignore`). Catches the
// silent failure where the wiki output path is gitignored, so generated docs are
// created but never tracked. Best-effort: returns false when the path is not
// ignored, git is unavailable, or cwd is not a repository (check-ignore exits
// non-zero in every one of those cases, which execFileSync surfaces as a throw).
export function isPathIgnored(cwd, relPath) {
  try {
    runGit(cwd, ["check-ignore", "-q", relPath]);
    return true;
  } catch {
    return false;
  }
}

// Best-effort git identity of the person running the command: `git config
// user.name`. Used by `review --approve` (Gate 20) to source reviewed_by when no
// explicit --reviewer / config reviewer is given. Returns the trimmed name, or
// null when git is unavailable or user.name is unset (callers then refuse to
// stamp a blank/fabricated reviewer rather than guessing).
export function gitUserName(cwd) {
  try {
    const name = runGit(cwd, ["config", "user.name"]).trim();
    return name || null;
  } catch {
    return null;
  }
}

// Repo-relative paths (posix, relative to the git root) that differ from the
// baseline. With <sinceRef>, every change from that ref to the working tree;
// without it, uncommitted tracked changes plus untracked files (the pre-commit
// view). Paths align with finding paths when the CLI runs from the repo root.
// Best-effort: throws only if git itself fails; callers treat that as "unknown".
export function changedFiles(cwd, sinceRef) {
  const toLines = (out) => out.split("\n").map((line) => line.trim()).filter(Boolean);
  const changed = sinceRef
    ? toLines(runGit(cwd, ["diff", "--name-only", sinceRef]))
    : [
        ...toLines(runGit(cwd, ["diff", "--name-only", "HEAD"])),
        ...toLines(runGit(cwd, ["ls-files", "--others", "--exclude-standard"]))
      ];
  return [...new Set(changed)];
}
