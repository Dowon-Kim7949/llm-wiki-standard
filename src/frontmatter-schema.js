export const FRONTMATTER_SCHEMA = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://llm-wiki-standard.local/schemas/frontmatter.schema.json",
  title: "LLM-WIKI Frontmatter",
  type: "object",
  additionalProperties: true,
  required: [
    "title",
    "tags",
    "status",
    "doc_type",
    "project",
    "last_updated",
    "author",
    "last_edited_by",
    "wiki_block_version",
    "source_files",
    "related",
    "visibility",
    "contains_sensitive_info"
  ],
  properties: {
    title: { type: "string", minLength: 1 },
    tags: { type: "array", items: { type: "string" } },
    status: { type: "string", enum: ["draft", "needs_review", "verified", "deprecated"] },
    doc_type: { type: "string", minLength: 1 },
    project: { type: "string", minLength: 1 },
    last_updated: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    author: { type: "string", minLength: 1 },
    last_edited_by: { type: "string", minLength: 1 },
    wiki_block_version: { type: "string", minLength: 1 },
    source_files: { type: "array", items: { type: "string" } },
    related: { type: "array", items: { type: "string" } },
    visibility: { type: "string", enum: ["internal", "public", "restricted"] },
    contains_sensitive_info: { type: "boolean" },
    reviewed_by: { type: "string", minLength: 1 },
    reviewed_at: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    aliases: { type: "array", items: { type: "string" } }
  },
  allOf: [
    {
      if: {
        properties: { status: { const: "verified" } },
        required: ["status"]
      },
      then: {
        required: ["reviewed_by", "reviewed_at"]
      }
    }
  ]
};

export function schemaEnumValues(fieldName) {
  return FRONTMATTER_SCHEMA.properties[fieldName]?.enum ?? [];
}

export function schemaRequiredFields() {
  return FRONTMATTER_SCHEMA.required;
}
