// Reference and link parsing helpers, extracted from commands.js on 2026-07-16
// (behavior-preserving refactor, GATE_REVIEW stabilization). These are the pure
// building blocks that recognize and normalize the different reference shapes the
// wiki understands: evidence references (file#L10, file#symbol:Name, ...),
// external/cross-repo references, Markdown links, and [[wiki links]]. Self-
// contained: depends only on the Node stdlib and encoding.js; no back-dependency
// on commands.js.
import path from "node:path";
import { readUtf8 } from "../encoding.js";

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractMarkdownSection(markdown, title) {
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

export function parseEvidenceReference(reference) {
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

export async function getLineCount(file, cache) {
  if (cache.has(file)) return cache.get(file);
  const content = await readUtf8(file);
  const lineCount = content.length === 0 ? 0 : content.split(/\r\n|\r|\n/).length;
  cache.set(file, lineCount);
  return lineCount;
}

// A reserved, NON-fetching cross-repo reference (1.11, GATE_REVIEW Gate 16):
// `repo:<name>/<path>`. It is recognized so cross-repo references are not flagged as
// missing targets, but it is NEVER fetched or verified (verification would need
// network/git and break the zero-dependency invariant) — recognition only.
export function isCrossRepoReference(reference) {
  return /^repo:\S/i.test(String(reference));
}

export function isExternalSourceReference(source) {
  return /^https?:\/\//i.test(source) || isCrossRepoReference(source) || source.startsWith("#");
}

export function extractMarkdownLinkTargets(markdown) {
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

export function extractWikiLinkTargets(markdown) {
  const targets = [];
  const wikiLinkPattern = /\[\[([^\]\n]+)\]\]/g;

  for (const match of markdown.matchAll(wikiLinkPattern)) {
    targets.push(match[1]);
  }

  return targets;
}

export function normalizeMarkdownLinkTarget(target) {
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

export function isSkippedMarkdownLink(link) {
  return link === "" || link.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(link);
}

export function resolveMarkdownLinkTarget(cwd, fromFile, link) {
  if (link.startsWith("/")) {
    return path.join(cwd, link.slice(1));
  }
  if (link.startsWith("docs/")) {
    return path.join(cwd, link);
  }
  return path.resolve(path.dirname(fromFile), link);
}

export function addWikiLinkTarget(targetIndex, value, document) {
  const normalized = normalizeWikiLinkKey(value);
  if (normalized && !targetIndex.has(normalized)) targetIndex.set(normalized, document);
}

export function normalizeWikiLinkTarget(rawTarget) {
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

export function normalizeWikiLinkKey(value) {
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
