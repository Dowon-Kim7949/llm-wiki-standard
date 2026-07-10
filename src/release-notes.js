import { execFileSync } from "node:child_process";

const UNIT_SEPARATOR = "\x1f";

const SECTION_ORDER = ["Added", "Changed", "Fixed", "Documentation", "Other"];
const TYPE_TO_SECTION = {
  feat: "Added",
  fix: "Fixed",
  perf: "Changed",
  refactor: "Changed",
  docs: "Documentation"
};

// Korean-first bilingual labels for the generated scaffolding.
const SECTION_LABELS = {
  Added: "추가 · Added",
  Changed: "변경 · Changed",
  Fixed: "수정 · Fixed",
  Documentation: "문서 · Documentation",
  Other: "기타 · Other"
};

export function parseCommit(hash, subject) {
  const match = String(subject).match(/^(\w+)(?:\([^)]*\))?!?:\s*(.+)$/);
  if (match) {
    return { type: match[1].toLowerCase(), description: match[2].trim(), hash };
  }
  return { type: "other", description: String(subject).trim(), hash };
}

// Best-effort git history since the last v* tag. Returns { commits, gitAvailable }.
export function collectCommitsSinceLastTag(cwd) {
  try {
    let range = null;
    try {
      const tag = runGit(cwd, ["describe", "--tags", "--abbrev=0", "--match", "v*"]).trim();
      if (tag) range = `${tag}..HEAD`;
    } catch {
      range = null;
    }

    const args = ["log", "--no-merges", "--pretty=format:%h%x1f%s"];
    if (range) args.push(range);
    else args.push("--max-count=50");

    const out = runGit(cwd, args).trim();
    if (!out) return { commits: [], gitAvailable: true };

    const commits = out.split("\n").filter(Boolean).map((line) => {
      const sep = line.indexOf(UNIT_SEPARATOR);
      const hash = sep === -1 ? line : line.slice(0, sep);
      const subject = sep === -1 ? "" : line.slice(sep + 1);
      return parseCommit(hash, subject);
    });
    return { commits, gitAvailable: true };
  } catch {
    return { commits: [], gitAvailable: false };
  }
}

// Pure renderer: given a version, date, and parsed commits, produce a
// needs_review release-notes document with LLM-WIKI frontmatter.
export function buildReleaseNotes({ version, date, project = "project", commits = [], gitAvailable = true }) {
  const grouped = new Map(SECTION_ORDER.map((section) => [section, []]));
  for (const commit of commits) {
    if (commit.type === "release" || commit.type === "chore") continue;
    const section = TYPE_TO_SECTION[commit.type] ?? "Other";
    grouped.get(section).push(commit);
  }

  const bodySections = SECTION_ORDER
    .filter((section) => grouped.get(section).length > 0)
    .map((section) => `## ${SECTION_LABELS[section]}\n\n${grouped.get(section).map((commit) => `- ${commit.description} (${commit.hash})`).join("\n")}`);

  const body = bodySections.length > 0
    ? bodySections.join("\n\n")
    : `## 변경 사항 · Changes\n\n- ${gitAvailable
        ? "마지막 릴리스 태그 이후 기록된 주요 변경이 없습니다. · No notable changes were recorded since the last release tag."
        : "git 이력을 사용할 수 없어 변경 사항을 수동으로 작성해야 합니다. · Git history was not available; fill in the changes manually."}`;

  return `---
title: 릴리스 노트 v${version} · Release Notes v${version}
tags:
  - llm-wiki
  - release-notes
  - needs-review
status: needs_review
doc_type: release_notes
project: ${project}
last_updated: ${date}
author: cli-generated
last_edited_by: llm-wiki-cli
wiki_block_version: v1
source_files:
  - package.json
related:
  - docs/llm-wiki/log.md
visibility: internal
contains_sensitive_info: false
---

# 릴리스 노트 v${version} · Release Notes v${version}

_생성일 ${date}. 게시 전 검토·수정하고, 승인 전까지 status는 \`needs_review\`로 유지하세요. · Generated ${date}; review before publishing and keep status \`needs_review\` until approved._

${body}
`;
}

function runGit(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}
