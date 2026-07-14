import { CURRENT_WIKI_BLOCK_VERSION } from "./config.js";

export function renderTemplate(template, variables) {
  return template.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (_match, key) => {
    const value = getValue(variables, key);
    if (value === undefined || value === null) return "";
    if (Array.isArray(value)) return value.join("\n");
    return String(value);
  });
}

export function renderWikiDocumentTemplate({ title, docType, project, body, sourceFiles = [], evidence = [], related = [], lastUpdated }) {
  return renderTemplate(WIKI_DOCUMENT_TEMPLATE, {
    title,
    doc_type: docType,
    project,
    last_updated: lastUpdated ?? todayIsoDate(),
    wiki_block_version: CURRENT_WIKI_BLOCK_VERSION,
    source_files: sourceFiles.map((item) => `  - ${item}`),
    evidence: evidence.map((item) => `  - ${item}`),
    related: related.map((item) => `  - ${item}`),
    body
  });
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function getValue(source, dottedKey) {
  return dottedKey.split(".").reduce((current, key) => current?.[key], source);
}

const WIKI_DOCUMENT_TEMPLATE = `---
title: {{ title }}
tags:
  - llm-wiki
  - needs-review
status: needs_review
doc_type: {{ doc_type }}
project: {{ project }}
last_updated: {{ last_updated }}
author: cli-generated
last_edited_by: llm-wiki-cli
wiki_block_version: {{ wiki_block_version }}
source_files:
{{ source_files }}
evidence:
{{ evidence }}
related:
{{ related }}
visibility: internal
contains_sensitive_info: false
---

{{ body }}
`;
