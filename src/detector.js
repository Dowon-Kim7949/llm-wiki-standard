import path from "node:path";
import { readdir } from "node:fs/promises";
import { pathExists } from "./files.js";
import { readUtf8 } from "./encoding.js";

const KNOWN_PROFILES = new Set(["frontend", "backend", "fullstack", "library", "mobile", "infra", "mixed", "unknown", "okf-v0.1"]);

// Detects npm/yarn workspace packages from the root package.json `workspaces`
// field (an array, or { packages: [] }). Expands a trailing `/*` glob to the
// immediate subdirectories and accepts literal paths; deeper globs and pnpm/YAML
// workspaces are not parsed (that would need a YAML/glob dependency), so they are
// reported via `unsupported` rather than guessed. Returns a deterministic, deduped
// list of workspace package paths (repo-relative, POSIX) plus an optional
// `unsupported` note. Read-only.
export async function detectWorkspaces(cwd) {
  const packagePath = path.join(cwd, "package.json");
  let patterns = null;
  if (await pathExists(packagePath)) {
    try {
      const pkg = JSON.parse(await readUtf8(packagePath));
      if (Array.isArray(pkg.workspaces)) patterns = pkg.workspaces;
      else if (pkg.workspaces && Array.isArray(pkg.workspaces.packages)) patterns = pkg.workspaces.packages;
    } catch {
      patterns = null;
    }
  }
  if (!patterns) {
    if (await pathExists(path.join(cwd, "pnpm-workspace.yaml"))) {
      return { packages: [], unsupported: "pnpm-workspace.yaml — YAML workspaces are not parsed (zero-dependency). List packages via npm/yarn workspaces to use monorepo mode." };
    }
    return { packages: [], unsupported: null };
  }
  const dirs = new Set();
  for (const pattern of patterns) {
    if (typeof pattern !== "string") continue;
    for (const dir of await expandWorkspacePattern(cwd, pattern)) dirs.add(dir);
  }
  return { packages: [...dirs].sort(), unsupported: null };
}

async function expandWorkspacePattern(cwd, pattern) {
  const normalized = pattern.replace(/\\/g, "/").replace(/\/+$/, "");
  if (normalized.endsWith("/*")) {
    const base = normalized.slice(0, -2);
    const baseDir = path.join(cwd, base);
    if (!(await pathExists(baseDir))) return [];
    let entries;
    try {
      entries = await readdir(baseDir, { withFileTypes: true });
    } catch {
      return [];
    }
    return entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => (base ? `${base}/${entry.name}` : entry.name));
  }
  // Deeper globs are not expanded; a literal directory path is used as-is.
  if (normalized.includes("*")) return [];
  if (await pathExists(path.join(cwd, normalized))) return [normalized];
  return [];
}

export async function detectProject(cwd, explicitType, explicitProfiles = []) {
  const signals = [];
  const packagePath = path.join(cwd, "package.json");
  let packageJson = null;

  if (await pathExists(packagePath)) {
    try {
      packageJson = JSON.parse(await readUtf8(packagePath));
      signals.push({ path: "package.json", reason: "package manifest detected" });
    } catch {
      signals.push({ path: "package.json", reason: "package manifest exists but could not be parsed" });
    }
  }

  const deps = {
    ...packageJson?.dependencies,
    ...packageJson?.devDependencies
  };

  const frontendSignals = ["vue", "react", "svelte", "angular", "next", "nuxt", "vite"].filter((name) => deps[name]);
  const backendSignals = ["express", "fastify", "nestjs", "@nestjs/core", "django", "fastapi"].filter((name) => deps[name]);

  if (frontendSignals.length) {
    signals.push({ path: "package.json", reason: `frontend dependencies detected: ${frontendSignals.join(", ")}` });
  }
  if (backendSignals.length) {
    signals.push({ path: "package.json", reason: `backend dependencies detected: ${backendSignals.join(", ")}` });
  }
  if (await pathExists(path.join(cwd, "src", "components"))) {
    signals.push({ path: "src/components", reason: "UI component tree detected" });
  }
  if (await pathExists(path.join(cwd, "docs", "llm-wiki", "index.md"))) {
    signals.push({ path: "docs/llm-wiki/index.md", reason: "existing LLM-WIKI entry point detected" });
  }

  const librarySignals = [];
  if (packageJson?.bin) librarySignals.push("bin");
  if (packageJson?.exports) librarySignals.push("exports");
  if (librarySignals.length) {
    signals.push({ path: "package.json", reason: `library/CLI signals detected: ${librarySignals.join(", ")}` });
  }

  const ecosystems = [];
  let primaryManifest = packageJson ? "package.json" : null;
  if (packageJson) ecosystems.push("node");
  for (const eco of await detectNonNodeEcosystems(cwd)) {
    ecosystems.push(eco.ecosystem);
    signals.push({ path: eco.path, reason: eco.reason });
    if (!primaryManifest) primaryManifest = eco.path;
    if (eco.role === "backend") backendSignals.push(`${eco.ecosystem}:web`);
    else if (eco.role === "library") librarySignals.push(`${eco.ecosystem}:package`);
  }

  const mobile = await detectMobile(cwd, deps);
  if (mobile) {
    for (const mobileSignal of mobile.signals) signals.push(mobileSignal);
    if (!primaryManifest && mobile.manifest) primaryManifest = mobile.manifest;
  }

  // Infra is a FALLBACK type: it wins only when no app signal (frontend/backend/
  // library/mobile) is present, so a containerized app repo keeps its app type.
  // Its signals are surfaced only when `infra` is actually chosen, so app repos
  // (which merely happen to have a Dockerfile) stay byte-identical.
  const infra = await detectInfra(cwd);

  const detectedType = decideType(frontendSignals, backendSignals, librarySignals, signals, Boolean(mobile), Boolean(infra));
  if (detectedType.projectType === "infra" && infra) {
    for (const infraSignal of infra.signals) signals.push(infraSignal);
    if (!primaryManifest && infra.manifest) primaryManifest = infra.manifest;
  }
  const projectType = explicitType ?? detectedType.projectType;
  const baseProfiles = projectType === "fullstack"
    ? ["core", "frontend", "backend", "fullstack"]
    : projectType === "mixed" || projectType === "unknown"
      ? ["core"]
      : ["core", projectType];
  const activeProfiles = [...new Set([...baseProfiles, ...explicitProfiles.filter((profile) => profile !== "core")])];
  const profileReviewItems = explicitProfiles
    .filter((profile) => !KNOWN_PROFILES.has(profile))
    .map((profile) => `Explicit profile '${profile}' is not a known profile.`);
  const typeReviewItems = explicitType && explicitType !== detectedType.projectType
    ? [`Explicit type '${explicitType}' differs from detected '${detectedType.projectType}'.`]
    : [];

  return {
    projectType,
    projectName: normalizeProjectName(packageJson?.name, cwd),
    ecosystems,
    primaryManifest: primaryManifest ?? "package.json",
    confidence: explicitType ? "explicit" : detectedType.confidence,
    activeProfiles,
    signals,
    reviewItems: [...typeReviewItems, ...profileReviewItems]
  };
}

async function detectNonNodeEcosystems(cwd) {
  const found = [];

  const python = await readFirstManifest(cwd, ["pyproject.toml", "requirements.txt", "setup.py", "setup.cfg", "Pipfile"]);
  if (python) {
    const role = /\b(django|fastapi|flask|starlette|aiohttp|sanic|tornado|quart)\b/i.test(python.content) ? "backend" : "library";
    found.push({ ecosystem: "python", path: python.name, reason: `Python manifest detected (${python.name})`, role });
  }

  const go = await readFirstManifest(cwd, ["go.mod"]);
  if (go) {
    const role = /(gin-gonic\/gin|labstack\/echo|gofiber\/fiber|go-chi\/chi|gorilla\/mux|beego|revel)/i.test(go.content) ? "backend" : "library";
    found.push({ ecosystem: "go", path: "go.mod", reason: "Go module detected (go.mod)", role });
  }

  const rust = await readFirstManifest(cwd, ["Cargo.toml"]);
  if (rust) {
    const role = /\b(actix-web|axum|rocket|warp|tide|poem|salvo)\b/i.test(rust.content) ? "backend" : "library";
    found.push({ ecosystem: "rust", path: "Cargo.toml", reason: "Rust crate detected (Cargo.toml)", role });
  }

  const jvm = await readFirstManifest(cwd, ["pom.xml", "build.gradle", "build.gradle.kts"]);
  if (jvm) {
    const role = /(spring-boot|spring-web|javax\.servlet|jakarta\.servlet|micronaut|quarkus|dropwizard)/i.test(jvm.content) ? "backend" : "library";
    found.push({ ecosystem: "jvm", path: jvm.name, reason: `JVM build file detected (${jvm.name})`, role });
  }

  const php = await readFirstManifest(cwd, ["composer.json"]);
  if (php) {
    const role = /(laravel\/framework|laravel\/lumen|symfony\/(?:framework-bundle|http-foundation|http-kernel)|slim\/slim|laminas\/|cakephp\/|yiisoft\/|codeigniter4\/)/i.test(php.content) ? "backend" : "library";
    found.push({ ecosystem: "php", path: "composer.json", reason: "PHP manifest detected (composer.json)", role });
  }

  const ruby = await readFirstManifest(cwd, ["Gemfile", "gems.rb"]);
  if (ruby) {
    const role = /\bgem\s+["'](rails|sinatra|rack|hanami|roda|grape|padrino)["']/i.test(ruby.content) ? "backend" : "library";
    found.push({ ecosystem: "ruby", path: ruby.name, reason: `Ruby manifest detected (${ruby.name})`, role });
  }

  const dotnet = await findProjectByExtension(cwd, [".csproj", ".fsproj"]);
  if (dotnet) {
    const role = /(Sdk\s*=\s*"Microsoft\.NET\.Sdk\.Web"|Microsoft\.AspNetCore)/i.test(dotnet.content) ? "backend" : "library";
    found.push({ ecosystem: "dotnet", path: dotnet.name, reason: `.NET project detected (${dotnet.name})`, role });
  }

  return found;
}

const MOBILE_SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".dart_tool", "Pods", ".gradle", "vendor", ".idea", "DerivedData"]);

// Bounded, best-effort DFS: does any entry within `maxDepth` satisfy `match(name,
// isDir)`? Skips heavy/vendored dirs and unreadable directories. Deterministic
// (each level sorted). Used to spot nested mobile signals (AndroidManifest.xml,
// *.xcodeproj) without scanning the whole tree.
async function existsMatching(cwd, match, maxDepth) {
  const walk = async (dir, depth) => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return false;
    }
    const sorted = [...entries].sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of sorted) {
      if (match(entry.name, entry.isDirectory())) return true;
    }
    if (depth >= maxDepth) return false;
    for (const entry of sorted) {
      if (entry.isDirectory() && !entry.name.startsWith(".") && !MOBILE_SKIP_DIRS.has(entry.name)) {
        if (await walk(path.join(dir, entry.name), depth + 1)) return true;
      }
    }
    return false;
  };
  return walk(cwd, 0);
}

// Detects a mobile app project from manifest/file signals for Android, Flutter,
// Apple/iOS, and React Native. Recognition only: no build tool (Gradle/Xcode/
// CocoaPods) is invoked and no dependency graph is parsed (zero-dependency).
// Returns { platforms, signals, manifest } or null when no mobile signal is
// found. `manifest` is a representative existing file used as a source_files
// anchor when no other manifest was detected (e.g. a Flutter-only repo).
async function detectMobile(cwd, deps) {
  const platforms = [];
  const signals = [];
  let manifest = null;
  const setManifest = (candidate) => {
    if (!manifest && candidate) manifest = candidate;
  };

  // React Native — a direct dependency (always sourced from package.json, so a
  // package.json manifest already exists; no manifest hint needed here).
  if (deps["react-native"]) {
    platforms.push("react-native");
    signals.push({ path: "package.json", reason: "React Native app detected (react-native dependency)" });
  }

  // Flutter — a pubspec with a flutter section / SDK (a Dart-only pubspec stays library).
  const pub = await readFirstManifest(cwd, ["pubspec.yaml", "pubspec.yml"]);
  if (pub && (/(^|\n)flutter\s*:/.test(pub.content) || /\bsdk:\s*flutter\b/.test(pub.content))) {
    platforms.push("flutter");
    signals.push({ path: pub.name, reason: `Flutter app detected (${pub.name} flutter section)` });
    setManifest(pub.name);
  }

  // Android — a Gradle file applying the Android plugin / AndroidX, or an AndroidManifest.xml.
  const gradle = await readFirstManifest(cwd, [
    "build.gradle",
    "build.gradle.kts",
    "settings.gradle",
    "settings.gradle.kts",
    "app/build.gradle",
    "app/build.gradle.kts"
  ]);
  const androidByGradle = gradle && /com\.android\.(application|library)|androidx\.|com\.android\.tools\.build/i.test(gradle.content);
  const androidByManifest = await existsMatching(cwd, (name, isDir) => !isDir && name === "AndroidManifest.xml", 4);
  if (androidByGradle || androidByManifest) {
    platforms.push("android");
    signals.push({ path: gradle?.name ?? "AndroidManifest.xml", reason: "Android app detected (Android Gradle plugin / AndroidManifest.xml)" });
    setManifest(gradle?.name ?? null);
  }

  // Apple/iOS — a Podfile, an Apple-platform Package.swift, or an Xcode project/workspace.
  const hasPodfile = await pathExists(path.join(cwd, "Podfile"));
  const swiftPkg = await readFirstManifest(cwd, ["Package.swift"]);
  const appleSwift = swiftPkg && /\.(iOS|tvOS|watchOS|macOS)\s*\(/.test(swiftPkg.content);
  const hasXcode = await existsMatching(cwd, (name, isDir) => isDir && (name.endsWith(".xcodeproj") || name.endsWith(".xcworkspace")), 3);
  if (hasPodfile || appleSwift || hasXcode) {
    platforms.push("ios");
    signals.push({ path: hasPodfile ? "Podfile" : appleSwift ? "Package.swift" : "*.xcodeproj", reason: "Apple/iOS app detected (Podfile / .xcodeproj / Apple-platform Package.swift)" });
    setManifest(hasPodfile ? "Podfile" : appleSwift ? "Package.swift" : null);
  }

  if (!platforms.length) return null;
  return { platforms, signals, manifest };
}

const K8S_DIRS = ["k8s", "kubernetes", "manifests", "deploy", "deployment"];

// Bounded, best-effort scan for a Kubernetes manifest: a top-level (or
// conventional-directory) `*.yaml`/`*.yml` whose content carries both
// `apiVersion:` and `kind:`. Returns a repo-relative path or null. Read-only,
// zero-dep. Docker Compose (no apiVersion/kind) and Helm `Chart.yaml` (no kind)
// do not match, so they are not mistaken for raw manifests.
async function findKubernetesManifest(cwd) {
  const looksK8s = (text) => /(^|\n)apiVersion\s*:/.test(text) && /(^|\n)kind\s*:/.test(text);
  const scanDir = async (relDir) => {
    const absDir = relDir ? path.join(cwd, relDir) : cwd;
    let entries;
    try {
      entries = await readdir(absDir, { withFileTypes: true });
    } catch {
      return null;
    }
    const sorted = [...entries].sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of sorted) {
      if (!entry.isFile() || !/\.ya?ml$/i.test(entry.name)) continue;
      try {
        if (looksK8s(await readUtf8(path.join(absDir, entry.name)))) {
          return relDir ? `${relDir}/${entry.name}` : entry.name;
        }
      } catch {
        // unreadable — skip
      }
    }
    return null;
  };
  const top = await scanDir("");
  if (top) return top;
  for (const dir of K8S_DIRS) {
    const hit = await scanDir(dir);
    if (hit) return hit;
  }
  return null;
}

// Detects an infrastructure/DevOps project from IaC signal files: Docker, Docker
// Compose, Helm, Kubernetes, Terraform. Recognition only — nothing is deployed,
// fetched, or contacted (no cluster/registry access, zero-dep). Returns
// { kinds, signals, manifest } or null. `infra` is a FALLBACK type (see
// decideType), so these signals affect typing only when no app signal is present;
// `manifest` is a real existing file used as a source_files anchor for an
// infra-only repo.
async function detectInfra(cwd) {
  const kinds = [];
  const signals = [];
  let manifest = null;
  const setManifest = (candidate) => {
    if (!manifest && candidate) manifest = candidate;
  };

  if (await pathExists(path.join(cwd, "Dockerfile"))) {
    kinds.push("docker");
    signals.push({ path: "Dockerfile", reason: "Docker image build detected (Dockerfile)" });
    setManifest("Dockerfile");
  }

  const compose = await readFirstManifest(cwd, ["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"]);
  if (compose) {
    kinds.push("compose");
    signals.push({ path: compose.name, reason: `Docker Compose detected (${compose.name})` });
    setManifest(compose.name);
  }

  const helm = await readFirstManifest(cwd, ["Chart.yaml", "Chart.yml"]);
  if (helm && /(^|\n)apiVersion\s*:/.test(helm.content) && /(^|\n)name\s*:/.test(helm.content)) {
    kinds.push("helm");
    signals.push({ path: helm.name, reason: "Helm chart detected (Chart.yaml)" });
    setManifest(helm.name);
  }

  const k8s = await findKubernetesManifest(cwd);
  if (k8s) {
    kinds.push("kubernetes");
    signals.push({ path: k8s, reason: `Kubernetes manifest detected (${k8s})` });
    setManifest(k8s);
  }

  const terraform = await findProjectByExtension(cwd, [".tf"]);
  if (terraform) {
    kinds.push("terraform");
    signals.push({ path: terraform.name, reason: `Terraform configuration detected (${terraform.name})` });
    setManifest(terraform.name);
  }

  if (!kinds.length) return null;
  return { kinds, signals, manifest };
}

// Find the first *.csproj / *.fsproj since .NET project files carry arbitrary
// names and commonly sit under src/<Name>/. Bounded, deterministic (files
// before subdirs, each sorted), depth-limited DFS skipping heavy dirs.
// Best-effort: unreadable directories are skipped.
const DOTNET_SKIP_DIRS = new Set(["node_modules", ".git", "dist", "bin", "obj", "packages", ".vs"]);

async function findProjectByExtension(cwd, extensions, maxDepth = 3) {
  const search = async (dir, depth) => {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    const sorted = [...entries].sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of sorted) {
      if (entry.isFile() && extensions.some((ext) => entry.name.toLowerCase().endsWith(ext))) {
        return path.join(dir, entry.name);
      }
    }
    if (depth >= maxDepth) return null;
    for (const entry of sorted) {
      if (entry.isDirectory() && !entry.name.startsWith(".") && !DOTNET_SKIP_DIRS.has(entry.name)) {
        const hit = await search(path.join(dir, entry.name), depth + 1);
        if (hit) return hit;
      }
    }
    return null;
  };

  const absHit = await search(cwd, 0);
  if (!absHit) return null;
  const relName = path.relative(cwd, absHit).split(path.sep).join("/");
  try {
    return { name: relName, content: await readUtf8(absHit) };
  } catch {
    return { name: relName, content: "" };
  }
}

async function readFirstManifest(cwd, names) {
  for (const name of names) {
    const filePath = path.join(cwd, name);
    if (await pathExists(filePath)) {
      try {
        return { name, content: await readUtf8(filePath) };
      } catch {
        return { name, content: "" };
      }
    }
  }
  return null;
}

function normalizeProjectName(name, cwd) {
  if (typeof name === "string" && name.trim()) {
    return name.trim().replace(/^@[^/]+\//, "");
  }
  return path.basename(cwd) || "project";
}

function decideType(frontendSignals, backendSignals, librarySignals, signals, hasMobile = false, hasInfra = false) {
  const hasFrontend = frontendSignals.length > 0 || signals.some((signal) => signal.path === "src/components");
  const hasBackend = backendSignals.length > 0;
  const hasLibrary = librarySignals.length > 0;

  // Mobile signals are specific (Android Gradle plugin, Flutter section, Xcode
  // project, react-native dep) so they take precedence — this is also what
  // reclassifies an Android `build.gradle` away from the JVM `library` default.
  if (hasMobile) return { projectType: "mobile", confidence: "high" };
  if (hasFrontend && hasBackend) return { projectType: "fullstack", confidence: "medium" };
  if (hasFrontend) return { projectType: "frontend", confidence: "high" };
  if (hasBackend) return { projectType: "backend", confidence: "medium" };
  if (hasLibrary) return { projectType: "library", confidence: "medium" };
  // Infra is a FALLBACK: chosen only when there is no app signal above, so a
  // containerized app repo (a backend with a Dockerfile) stays its app type and
  // only genuine IaC-first repos (previously `unknown`) become `infra`.
  if (hasInfra) return { projectType: "infra", confidence: "medium" };
  return { projectType: "unknown", confidence: "low" };
}
