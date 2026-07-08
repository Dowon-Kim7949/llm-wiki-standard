import path from "node:path";
import { pathExists } from "./files.js";
import { readUtf8 } from "./encoding.js";

const KNOWN_PROFILES = new Set(["frontend", "backend", "fullstack", "library", "mixed", "unknown", "okf-v0.1"]);

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

  const detectedType = decideType(frontendSignals, backendSignals, signals);
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
    confidence: explicitType ? "explicit" : detectedType.confidence,
    activeProfiles,
    signals,
    reviewItems: [...typeReviewItems, ...profileReviewItems]
  };
}

function decideType(frontendSignals, backendSignals, signals) {
  const hasFrontend = frontendSignals.length > 0 || signals.some((signal) => signal.path === "src/components");
  const hasBackend = backendSignals.length > 0;

  if (hasFrontend && hasBackend) return { projectType: "fullstack", confidence: "medium" };
  if (hasFrontend) return { projectType: "frontend", confidence: "high" };
  if (hasBackend) return { projectType: "backend", confidence: "medium" };
  return { projectType: "unknown", confidence: "low" };
}
