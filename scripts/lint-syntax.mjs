#!/usr/bin/env node
// Zero-dependency syntax gate. There is no built-in JavaScript linter, and the
// project deliberately ships zero dependencies AND zero devDependencies, so the
// deliberate stance (see CONTRIBUTING.md) is: style is enforced by human review,
// and correctness is enforced by (a) this `node --check` parse gate over every
// JS file and (b) the test suite. Exits non-zero if any file fails to parse.
import { readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { execFileSync } from "node:child_process";

const ROOTS = ["bin", "src", "tests", "bench", "scripts"];
const SKIP_DIRS = new Set(["node_modules", ".git"]);
const JS_EXT = new Set([".js", ".mjs", ".cjs"]);

function collect(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return; // a root may be absent (e.g. bench in a stripped checkout)
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) collect(full, out);
    else if (st.isFile() && JS_EXT.has(extname(name))) out.push(full);
  }
}

const files = [];
for (const root of ROOTS) collect(root, files);

let failed = 0;
for (const file of files) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: ["ignore", "ignore", "pipe"] });
  } catch (err) {
    failed += 1;
    const detail = err && err.stderr ? err.stderr.toString() : (err && err.message) || "unknown error";
    process.stderr.write(`SYNTAX ERROR: ${file}\n${detail}\n`);
  }
}

if (failed > 0) {
  process.stderr.write(`\nlint-syntax: ${failed} file(s) failed node --check.\n`);
  process.exit(1);
}
process.stdout.write(`lint-syntax: OK (${files.length} files parsed clean).\n`);
