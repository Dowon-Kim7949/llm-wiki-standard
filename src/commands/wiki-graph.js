// Wiki knowledge-graph construction and rendering, extracted from commands.js
// on 2026-07-16 (behavior-preserving refactor, GATE_REVIEW stabilization).
// collectWikiGraph walks the wiki and resolves [[wiki links]] / related /
// Markdown links into a document graph (with orphan and unresolved-concept
// detection); buildWikiLinkTargetIndex builds the title/alias/path lookup; the
// render* helpers emit Mermaid and DOT. Depends only on the Node stdlib,
// files.js, encoding.js, frontmatter.js, and references.js; no back-dependency
// on commands.js. The exported graph/stats COMMANDS stay in commands.js and
// import these helpers.
import path from "node:path";
import { listMarkdownFiles, pathExists, toPosix } from "../files.js";
import { readUtf8 } from "../encoding.js";
import { parseFrontmatter } from "../frontmatter.js";
import {
  addWikiLinkTarget,
  extractMarkdownLinkTargets,
  extractWikiLinkTargets,
  isExternalSourceReference,
  isSkippedMarkdownLink,
  normalizeMarkdownLinkTarget,
  normalizeWikiLinkKey,
  normalizeWikiLinkTarget,
  resolveMarkdownLinkTarget
} from "./references.js";

export async function collectWikiGraph(cwd) {
  const wikiRoot = path.join(cwd, "docs", "llm-wiki");
  if (!(await pathExists(wikiRoot))) return emptyWikiGraph();

  const markdownFiles = await listMarkdownFiles(wikiRoot);
  const targetIndex = await buildWikiLinkTargetIndex(cwd, wikiRoot, markdownFiles);
  const docs = markdownFiles.map((file) => {
    const pathFromRoot = toPosix(path.relative(cwd, file));
    return {
      path: pathFromRoot,
      title: targetIndex.documentsByPath.get(pathFromRoot)?.title ?? null,
      aliases: targetIndex.documentsByPath.get(pathFromRoot)?.aliases ?? [],
      links: [],
      inboundCount: 0
    };
  });
  const docsByPath = new Map(docs.map((doc) => [doc.path, doc]));
  const findings = [];
  const links = [];
  const edges = [];
  const edgeSeen = new Set();
  const addEdge = (source, target, kind) => {
    if (!target || source === target) return;
    const key = `${source}\u0000${target}`;
    if (edgeSeen.has(key)) return;
    edgeSeen.add(key);
    edges.push({ source, target, kind });
  };
  const connectedPaths = new Set();
  const unresolvedByTarget = new Map();

  for (const file of markdownFiles) {
    const rel = toPosix(path.relative(cwd, file));
    const content = await readUtf8(file);
    const sourceDoc = docsByPath.get(rel);

    for (const rawTarget of extractWikiLinkTargets(content)) {
      const target = normalizeWikiLinkTarget(rawTarget);
      if (!target) continue;
      // Cross-repo (repo:name/path) and URL wiki links are recognized as external
      // (1.11, Gate 16): not flagged missing, and never fetched/verified.
      if (isExternalSourceReference(target)) continue;

      const key = normalizeWikiLinkKey(target);
      const targetDoc = targetIndex.targets.get(key);
      const link = {
        source: rel,
        target,
        resolved: Boolean(targetDoc),
        targetPath: targetDoc?.path ?? null
      };
      links.push(link);
      sourceDoc?.links.push(link);

      if (targetDoc) {
        addEdge(rel, targetDoc.path, "wiki");
        const inboundDoc = docsByPath.get(targetDoc.path);
        if (inboundDoc && inboundDoc.path !== rel) {
          inboundDoc.inboundCount += 1;
          connectedPaths.add(inboundDoc.path);
        }
      } else {
        findings.push({
          severity: "warning",
          rule: "wiki_link.missing",
          path: rel,
          message: `Wiki link target does not exist: ${target}.`
        });
        const unresolved = unresolvedByTarget.get(target) ?? { target, sources: [] };
        unresolved.sources.push(rel);
        unresolvedByTarget.set(target, unresolved);
      }
    }

    // Related frontmatter and local Markdown links also connect documents,
    // so orphan detection reflects the full wiki graph, not only [[wiki links]].
    const parsed = parseFrontmatter(content);
    const relatedEntries = Array.isArray(parsed.frontmatter?.related) ? parsed.frontmatter.related : [];
    for (const relatedEntry of relatedEntries) {
      if (typeof relatedEntry !== "string") continue;
      const targetPath = toPosix(relatedEntry.trim().replace(/^\.\//, "").replace(/^\/+/, ""));
      if (targetPath && targetPath !== rel && docsByPath.has(targetPath)) {
        connectedPaths.add(targetPath);
        addEdge(rel, targetPath, "related");
      }
    }
    for (const rawLink of extractMarkdownLinkTargets(content)) {
      const link = normalizeMarkdownLinkTarget(rawLink);
      if (!link || isSkippedMarkdownLink(link)) continue;
      const targetPath = toPosix(path.relative(cwd, resolveMarkdownLinkTarget(cwd, file, link)));
      if (targetPath && targetPath !== rel && docsByPath.has(targetPath)) {
        connectedPaths.add(targetPath);
        addEdge(rel, targetPath, "markdown");
      }
    }
  }

  const aliasEntries = [...targetIndex.aliases].sort((left, right) => {
    const byAlias = left.alias.localeCompare(right.alias);
    return byAlias || left.path.localeCompare(right.path);
  });
  const orphanDocuments = docs
    .filter((doc) => doc.path !== "docs/llm-wiki/index.md" && !connectedPaths.has(doc.path))
    .map((doc) => doc.path)
    .sort();
  const unresolvedConcepts = [...unresolvedByTarget.values()].sort((left, right) => left.target.localeCompare(right.target));
  edges.sort((left, right) => left.source.localeCompare(right.source) || left.target.localeCompare(right.target));

  return {
    summary: {
      documents: docs.length,
      edges: edges.length,
      wikiLinks: links.length,
      resolvedWikiLinks: links.filter((link) => link.resolved).length,
      unresolvedWikiLinks: unresolvedConcepts.length,
      aliases: aliasEntries.length,
      orphanDocuments: orphanDocuments.length
    },
    documents: docs,
    links,
    edges,
    unresolvedConcepts,
    aliases: aliasEntries,
    orphanDocuments,
    findings
  };
}

export async function buildWikiLinkTargetIndex(cwd, wikiRoot, markdownFiles) {
  const targets = new Map();
  const aliases = [];
  const documentsByPath = new Map();

  for (const file of markdownFiles) {
    const wikiRel = toPosix(path.relative(wikiRoot, file));
    const cwdRel = toPosix(path.relative(cwd, file));
    const withoutExtension = wikiRel.replace(/\.md$/i, "");
    const basename = path.basename(file, ".md");
    const parsed = parseFrontmatter(await readUtf8(file));
    const document = {
      path: cwdRel,
      title: parsed.frontmatter?.title ?? null,
      aliases: Array.isArray(parsed.frontmatter?.aliases)
        ? parsed.frontmatter.aliases.filter((alias) => typeof alias === "string")
        : []
    };
    documentsByPath.set(cwdRel, document);

    addWikiLinkTarget(targets, wikiRel, document);
    addWikiLinkTarget(targets, withoutExtension, document);
    addWikiLinkTarget(targets, cwdRel, document);
    addWikiLinkTarget(targets, cwdRel.replace(/\.md$/i, ""), document);
    addWikiLinkTarget(targets, basename, document);

    addWikiLinkTarget(targets, document.title, document);
    for (const alias of document.aliases) {
      addWikiLinkTarget(targets, alias, document);
      aliases.push({ alias, path: cwdRel, title: document.title });
    }
  }

  return { targets, aliases, documentsByPath };
}

export function emptyWikiGraph() {
  return {
    summary: {
      documents: 0,
      edges: 0,
      wikiLinks: 0,
      resolvedWikiLinks: 0,
      unresolvedWikiLinks: 0,
      aliases: 0,
      orphanDocuments: 0
    },
    documents: [],
    links: [],
    edges: [],
    unresolvedConcepts: [],
    aliases: [],
    orphanDocuments: [],
    findings: []
  };
}

export function graphNodeLabel(doc) {
  const label = doc.title || doc.path.split("/").pop();
  return String(label).replace(/"/g, "'");
}

// Mermaid `graph TD`, fenced so it pastes straight into GitHub/Obsidian markdown.
export function renderGraphMermaid(graph) {
  const docs = [...graph.documents].sort((left, right) => left.path.localeCompare(right.path));
  const ids = new Map(docs.map((doc, index) => [doc.path, `n${index}`]));
  const lines = ["```mermaid", "graph TD"];
  for (const doc of docs) {
    lines.push(`  ${ids.get(doc.path)}["${graphNodeLabel(doc)}"]`);
  }
  for (const edge of graph.edges) {
    if (ids.has(edge.source) && ids.has(edge.target)) {
      lines.push(`  ${ids.get(edge.source)} --> ${ids.get(edge.target)}`);
    }
  }
  lines.push("```");
  return lines.join("\n");
}

// Graphviz DOT digraph.
export function renderGraphDot(graph) {
  const docs = [...graph.documents].sort((left, right) => left.path.localeCompare(right.path));
  const lines = ["digraph LLMWiki {", "  rankdir=LR;", "  node [shape=box];"];
  for (const doc of docs) {
    lines.push(`  "${doc.path}" [label="${graphNodeLabel(doc)}"];`);
  }
  for (const edge of graph.edges) {
    lines.push(`  "${edge.source}" -> "${edge.target}";`);
  }
  lines.push("}");
  return lines.join("\n");
}
