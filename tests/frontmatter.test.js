import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { scanSensitiveInfo } from "../src/sensitive-info.js";
import { parseFrontmatter, validateFrontmatter } from "../src/frontmatter.js";
import { FRONTMATTER_SCHEMA } from "../src/frontmatter-schema.js";
import { renderWikiDocumentTemplate } from "../src/template-renderer.js";

test("validates standard frontmatter subset", () => {
  const markdown = `---
title: Sample
tags:
  - llm-wiki
status: needs_review
doc_type: test
project: sample
last_updated: 2026-07-02
author: ai-generated
last_edited_by: Codex
wiki_block_version: v1
source_files:
  - package.json
related:
  - docs/llm-wiki/log.md
visibility: internal
contains_sensitive_info: false
---

# Sample
`;

  const parsed = parseFrontmatter(markdown);
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.frontmatter.status, "needs_review");
  assert.deepEqual(validateFrontmatter(parsed.frontmatter), []);
});

test("does not expose raw sensitive values", () => {
  const findings = scanSensitiveInfo("API_TOKEN=super-secret-token-value");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].type, "env_value");
  assert.equal(findings[0].message, "Sensitive-looking value omitted.");
  assert.equal(JSON.stringify(findings).includes("super-secret-token-value"), false);
});

test("renders needs_review wiki document templates", () => {
  const rendered = renderWikiDocumentTemplate({
    title: "Rendered Doc",
    docType: "test_doc",
    project: "fixture",
    sourceFiles: ["package.json"],
    related: ["docs/llm-wiki/log.md"],
    body: "# Rendered Doc\n"
  });
  const parsed = parseFrontmatter(rendered);

  assert.equal(parsed.frontmatter.status, "needs_review");
  assert.equal(parsed.frontmatter.doc_type, "test_doc");
  assert.deepEqual(validateFrontmatter(parsed.frontmatter), []);
});

test("verified documents require review metadata only as errors in strict mode", () => {
  const parsed = parseFrontmatter(`---
title: Verified Sample
tags:
  - llm-wiki
status: verified
doc_type: test
project: sample
last_updated: 2026-07-02
author: maintainer
last_edited_by: maintainer
wiki_block_version: v1
source_files:
  - package.json
related:
  - docs/llm-wiki/log.md
visibility: internal
contains_sensitive_info: false
---

# Verified Sample
`);

  const standardFindings = validateFrontmatter(parsed.frontmatter);
  const strictFindings = validateFrontmatter(parsed.frontmatter, { strict: true });

  assert.equal(standardFindings.find((finding) => finding.rule === "frontmatter.verified_review")?.severity, "warning");
  assert.equal(strictFindings.find((finding) => finding.rule === "frontmatter.verified_review")?.severity, "error");
});

test("published frontmatter JSON Schema matches runtime contract", async () => {
  const schemaPath = path.join(process.cwd(), "rules", "frontmatter.schema.json");
  const publishedSchema = JSON.parse(await readFile(schemaPath, { encoding: "utf8" }));

  assert.deepEqual(publishedSchema, FRONTMATTER_SCHEMA);
  assert.ok(publishedSchema.required.includes("status"));
  assert.deepEqual(publishedSchema.properties.status.enum, ["draft", "needs_review", "verified", "deprecated"]);
  assert.deepEqual(publishedSchema.properties.visibility.enum, ["internal", "public", "restricted"]);
  assert.deepEqual(publishedSchema.allOf[0].then.required, ["reviewed_by", "reviewed_at"]);
});

test("validates optional aliases as an array field", () => {
  const valid = parseFrontmatter(`---
title: Alias Sample
tags:
  - llm-wiki
status: needs_review
doc_type: concept
project: sample
last_updated: 2026-07-08
author: ai-generated
last_edited_by: Codex
wiki_block_version: v1
source_files:
  - package.json
related:
  - docs/llm-wiki/log.md
visibility: internal
contains_sensitive_info: false
aliases:
  - Sample Alias
---

# Alias Sample
`);
  const invalid = parseFrontmatter(`---
title: Alias Sample
tags:
  - llm-wiki
status: needs_review
doc_type: concept
project: sample
last_updated: 2026-07-08
author: ai-generated
last_edited_by: Codex
wiki_block_version: v1
source_files:
  - package.json
related:
  - docs/llm-wiki/log.md
visibility: internal
contains_sensitive_info: false
aliases: Sample Alias
---

# Alias Sample
`);

  assert.deepEqual(validateFrontmatter(valid.frontmatter), []);
  assert.equal(validateFrontmatter(invalid.frontmatter).find((finding) => finding.message === "aliases must be an array.")?.severity, "error");
});
