export const REQUIRED_FRONTMATTER_FIELDS = [
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
];

export const VALID_STATUSES = new Set(["draft", "needs_review", "verified", "deprecated"]);

export const VALID_VISIBILITIES = new Set(["internal", "public", "restricted"]);

export const CORE_REQUIRED_DOCS = [
  "docs/llm-wiki/index.md",
  "docs/llm-wiki/README.md",
  "docs/llm-wiki/project-profile.md",
  "docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md",
  "docs/llm-wiki/DOMAIN_FEATURES.md",
  "docs/llm-wiki/GLOSSARY.md",
  "docs/llm-wiki/log.md",
  "docs/llm-wiki/domains/00_overview.md",
  "docs/llm-wiki/templates/DECISION_LOG.template.md",
  "docs/llm-wiki/templates/TASK_PROMPT.template.md"
];

export const PROFILE_DOCS = {
  frontend: [
    "docs/llm-wiki/profiles/frontend.md",
    "docs/llm-wiki/COMPONENT_INVENTORY.md",
    "docs/llm-wiki/WCAG.md",
    "docs/llm-wiki/E2E_WORKFLOWS.md"
  ],
  backend: [
    "docs/llm-wiki/profiles/backend.md",
    "docs/llm-wiki/API_CONTRACTS.md",
    "docs/llm-wiki/DATA_MODEL.md",
    "docs/llm-wiki/SECURITY.md",
    "docs/llm-wiki/OPERATIONS.md"
  ],
  fullstack: [
    "docs/llm-wiki/profiles/frontend.md",
    "docs/llm-wiki/profiles/backend.md",
    "docs/llm-wiki/profiles/fullstack.md",
    "docs/llm-wiki/CONTRACT_BOUNDARIES.md",
    "docs/llm-wiki/API_CONTRACTS.md",
    "docs/llm-wiki/ENVIRONMENT_MATRIX.md",
    "docs/llm-wiki/E2E_WORKFLOWS.md",
    "docs/llm-wiki/RELEASE_FLOW.md"
  ],
  library: [
    "docs/llm-wiki/profiles/library.md",
    "docs/llm-wiki/PUBLIC_API.md",
    "docs/llm-wiki/VERSIONING.md",
    "docs/llm-wiki/EXAMPLES.md",
    "docs/llm-wiki/RELEASE_FLOW.md"
  ],
  "okf-v0.1": [
    "docs/llm-wiki/profiles/okf-v0.1.md",
    "docs/llm-wiki/templates/OKF_CONCEPT.template.md",
    "docs/llm-wiki/templates/OKF_PROJECT.template.md",
    "docs/llm-wiki/templates/OKF_API_REFERENCE.template.md",
    "docs/llm-wiki/templates/OKF_MEETING_NOTE.template.md",
    "docs/llm-wiki/templates/OKF_EVENT.template.md",
    "docs/llm-wiki/OKF_CONVERSION_GUIDE.md"
  ],
  mixed: ["docs/llm-wiki/project-profile.md"],
  unknown: ["docs/llm-wiki/project-profile.md"]
};
