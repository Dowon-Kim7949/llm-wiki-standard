// Domain detection and per-domain doc planning, extracted from commands.js on
// 2026-07-15 (behavior-preserving refactor, GATE_REVIEW stabilization). Self-
// contained: depends only on the Node stdlib and files.js; no back-dependency
// on commands.js.
import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { toPosix } from "../files.js";

// Directories whose immediate SUBDIRECTORIES are domains (folder-per-domain).
const DIR_DOMAIN_PARENTS = new Set(["domains", "domain", "modules", "features"]);

// Frontend/SPA feature-parent directories: in a typical Vue/React/RN layout their
// immediate SUBDIRECTORIES are feature domains (src/pages/hazards, src/views/jobs,
// src/features/auth, src/screens/profile, ...). Used only for frontend/mobile
// detection (backend/fullstack keep DIR_DOMAIN_PARENTS), so backend is unaffected.
const FRONTEND_DIR_DOMAIN_PARENTS = new Set(["pages", "views", "features", "modules", "screens"]);

// Router files whose route table names the top-level feature groups (vue-router /
// react-router). Matched by basename; files directly inside a router/ or routes/
// directory are also parsed. Parsed with regex only — no parser dependency.
const FRONTEND_ROUTE_FILE = /^(routes?|router)\.[jt]sx?$/i;

// Non-domain folders/segments common in SPAs (added to DOMAIN_EXCLUDE_NAMES for
// frontend detection only): UI plumbing, not business features.
const FRONTEND_EXCLUDE_NAMES = new Set([
  "components", "component", "layouts", "layout", "composables", "hooks",
  "assets", "styles", "style", "css", "directives", "plugins", "mixins",
  "helpers", "lib", "libs", "types", "constants", "boot", "router", "routes"
]);

// Directories whose immediate SOURCE FILES are domains (module-per-resource).
const FILE_DOMAIN_PARENTS = new Set(["endpoints", "routers", "routes", "resources", "controllers", "handlers"]);

// Technical directories that are not business domains (compared lowercase). Used
// both to reject domain candidates and to prune traversal.
const DOMAIN_EXCLUDE_NAMES = new Set([
  "common", "shared", "core", "config", "configs",
  "util", "utils", "middleware", "middlewares",
  "infrastructure", "test", "tests", "fixture", "fixtures"
]);

// Directories never descended into while searching for domain parents: vendored,
// generated, virtualenv, build, test, and docs trees. Hidden (`.`) and dunder
// (`__`) directories are also skipped. Keeps the scan bounded and FPs near zero.
const DOMAIN_TRAVERSAL_SKIP = new Set([
  "node_modules", "dist", "build", "out", "target", "bin", "obj",
  "venv", "env", "virtualenv", "site-packages", "dist-packages", "vendor", "coverage", "migrations",
  "spec", "docs", "doc", "examples", "example", "scripts"
]);

// Source-file extensions eligible to be a file-based domain.
const DOMAIN_FILE_EXTENSIONS = new Set([".py", ".js", ".ts", ".jsx", ".tsx", ".rb", ".go", ".java", ".kt", ".php", ".cs"]);

// File basenames (no extension, lowercased) that are aggregators/infrastructure
// rather than business resources — excluded from file-based domains.
const FILE_DOMAIN_EXCLUDE = new Set([
  "index", "main", "app", "application", "server",
  "base", "router", "route", "routes", "urls", "deps", "dependencies",
  "schemas", "schema", "models", "model", "types", "helpers", "constants", "settings"
]);

// How deep to search for domain-parent directories from the project root
// (reaches nested layouts like app/api/api_v2/endpoints and monorepo packages).
const DOMAIN_MAX_DEPTH = 8;

export function emptyDomainContext() {
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

// Best-effort: search the project tree for domain-parent directories and collect
// their domains (subdirectories or source files). A missing/unreadable directory
// is skipped, never fatal. Returns { rawName, sourceFile, kind } with posix
// sourceFile paths. Order is irrelevant — planDomainDocs sorts deterministically.
export async function detectDomainDirectories(cwd) {
  const found = [];
  await scanForDomainParents(cwd, cwd, 0, found);
  return found;
}

// Bounded DFS from the project root. When a directory's basename marks it a
// domain parent, collect its domains and PRUNE (do not descend further into that
// subtree, so a domain's internal folders never fragment into extra domains).
// Otherwise descend into non-skipped subdirectories.
async function scanForDomainParents(cwd, dir, depth, found) {
  if (depth > DOMAIN_MAX_DEPTH) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  // A directory containing pyvenv.cfg is a Python virtualenv; everything beneath it
  // (Lib/site-packages, ...) is installed third-party code, never a project domain.
  // This catches version-suffixed names (venv3.10, .venv-py39) the name list misses,
  // so a dependency's handlers/routers/... directory can't masquerade as a domain.
  if (entries.some((entry) => entry.isFile() && entry.name === "pyvenv.cfg")) return;
  const base = path.basename(dir).toLowerCase();

  if (DIR_DOMAIN_PARENTS.has(base)) {
    for (const entry of entries) {
      if (entry.isDirectory() && !isExcludedDomainDir(entry.name)) {
        found.push({ rawName: entry.name, sourceFile: toPosix(path.relative(cwd, path.join(dir, entry.name))), kind: "dir" });
      }
    }
    return;
  }

  if (FILE_DOMAIN_PARENTS.has(base)) {
    for (const entry of entries) {
      if (entry.isFile() && isDomainSourceFile(entry.name)) {
        found.push({ rawName: stripSourceExtension(entry.name), sourceFile: toPosix(path.relative(cwd, path.join(dir, entry.name))), kind: "file" });
      }
    }
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || isSkippedTraversalDir(entry.name)) continue;
    await scanForDomainParents(cwd, path.join(dir, entry.name), depth + 1, found);
  }
}

function isSkippedTraversalDir(name) {
  if (name.startsWith(".") || name.startsWith("__")) return true;
  const lower = name.toLowerCase();
  if (DOMAIN_TRAVERSAL_SKIP.has(lower) || DOMAIN_EXCLUDE_NAMES.has(lower)) return true;
  // Version/impl-suffixed virtualenv directories (venv3.10, venv-py39, env39) whose
  // contents are installed dependencies rather than project domains.
  return /^venv[\d._-]/i.test(name) || /^env\d/i.test(name);
}

function isExcludedDomainDir(name) {
  if (name.startsWith(".") || name.startsWith("__")) return true;
  return DOMAIN_EXCLUDE_NAMES.has(name.toLowerCase());
}

// Frontend detection excludes the backend technical set PLUS SPA UI plumbing.
function isExcludedFrontendDomain(name) {
  return isExcludedDomainDir(name) || FRONTEND_EXCLUDE_NAMES.has(name.toLowerCase());
}

function isDomainSourceFile(name) {
  if (name.startsWith(".") || name.startsWith("__")) return false;
  if (/\.d\.ts$/i.test(name) || /\.(test|spec)\.[jt]sx?$/i.test(name)) return false;
  if (!DOMAIN_FILE_EXTENSIONS.has(path.extname(name).toLowerCase())) return false;
  const base = stripSourceExtension(name).toLowerCase();
  return Boolean(base) && !FILE_DOMAIN_EXCLUDE.has(base) && !DOMAIN_EXCLUDE_NAMES.has(base);
}

function stripSourceExtension(name) {
  return name.replace(/\.[^.]+$/, "");
}

// Best-effort frontend/SPA domain detection (used for frontend/mobile only, so
// backend/fullstack detection is byte-identical). Two signals, both bounded and
// exclusion-guarded like the backend detector: (1) folder-per-feature — the
// 1-depth subdirectories of pages/views/features/modules/screens; (2) route
// groups — the top-level path segment of each route parsed (regex, no parser
// dependency) from router/routes files. Returns { rawName, sourceFile, kind }.
export async function detectFrontendDomains(cwd) {
  const found = [];
  await scanForFrontendDomains(cwd, cwd, 0, found);
  return found;
}

async function scanForFrontendDomains(cwd, dir, depth, found) {
  if (depth > DOMAIN_MAX_DEPTH) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  if (entries.some((entry) => entry.isFile() && entry.name === "pyvenv.cfg")) return;
  const base = path.basename(dir).toLowerCase();

  // Folder-per-feature: subdirectories of a feature-parent are domains; prune.
  if (FRONTEND_DIR_DOMAIN_PARENTS.has(base)) {
    for (const entry of entries) {
      if (entry.isDirectory() && !isExcludedFrontendDomain(entry.name)) {
        found.push({ rawName: entry.name, sourceFile: toPosix(path.relative(cwd, path.join(dir, entry.name))), kind: "dir" });
      }
    }
    return;
  }

  // Route tables: parse router/routes files (and any source file inside a
  // router/ or routes/ directory) for top-level route groups.
  const inRouteDir = base === "router" || base === "routes";
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (inRouteDir ? isFrontendSourceFile(entry.name) : FRONTEND_ROUTE_FILE.test(entry.name)) {
      found.push(...await parseRouteFile(path.join(dir, entry.name), cwd));
    }
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || isSkippedTraversalDir(entry.name)) continue;
    await scanForFrontendDomains(cwd, path.join(dir, entry.name), depth + 1, found);
  }
}

function isFrontendSourceFile(name) {
  if (name.startsWith(".") || name.startsWith("__")) return false;
  if (/\.d\.ts$/i.test(name) || /\.(test|spec)\.[jt]sx?$/i.test(name)) return false;
  return /\.[jt]sx?$/i.test(name);
}

// Extract top-level route-group segments from a router file. Handles object
// route configs (`path: "/hazards"`, vue-router & react-router) and JSX routes
// (`<Route path="/hazards">`). Dynamic (`:id`, `*`), empty, and excluded
// segments are dropped. Unreadable files yield []. Pure-ish (reads one file).
async function parseRouteFile(absPath, cwd) {
  let text;
  try {
    text = await readFile(absPath, "utf8");
  } catch {
    return [];
  }
  const sourceFile = toPosix(path.relative(cwd, absPath));
  const segments = new Set();
  const patterns = [/\bpath\s*:\s*['"]([^'"]*)['"]/g, /<Route\b[^>]*?\bpath\s*=\s*['"]([^'"]*)['"]/g];
  for (const re of patterns) {
    let match;
    while ((match = re.exec(text)) !== null) {
      const segment = firstRouteSegment(match[1]);
      if (segment && !isExcludedFrontendDomain(segment)) segments.add(segment);
    }
  }
  return [...segments].map((segment) => ({ rawName: segment, sourceFile, kind: "route" }));
}

function firstRouteSegment(routePath) {
  const first = String(routePath).replace(/^\/+/, "").split("/")[0] ?? "";
  // Reject dynamic params, wildcards, and empties; keep plain word segments.
  return /^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u.test(first) ? first : "";
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

// Domain docs are generated for non-minimal init. backend/fullstack use the
// directory/file detector (unchanged — byte-identical); frontend/mobile use the
// SPA detector (folders + route groups). Other types get none.
// relatedExtras links the backend contract docs only when they are themselves
// part of this init's candidate set, so no broken links are introduced.
export async function buildDomainContext(cwd, projectType, minimal, candidateSet) {
  if (minimal) return emptyDomainContext();
  let detected;
  if (projectType === "backend" || projectType === "fullstack") {
    detected = await detectDomainDirectories(cwd);
  } else if (projectType === "frontend" || projectType === "mobile") {
    detected = await detectFrontendDomains(cwd);
  } else {
    return emptyDomainContext();
  }
  const plans = planDomainDocs(detected);
  const relatedExtras = ["docs/llm-wiki/API_CONTRACTS.md", "docs/llm-wiki/DATA_MODEL.md"]
    .filter((doc) => candidateSet.has(doc));
  return { plans, relatedExtras };
}
