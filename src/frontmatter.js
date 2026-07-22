import { schemaEnumValues, schemaRequiredFields } from "./frontmatter-schema.js";

export function parseFrontmatter(markdown) {
  const normalized = markdown.replace(/^\uFEFF/, "");
  if (!normalized.startsWith("---\n") && !normalized.startsWith("---\r\n")) {
    return { frontmatter: null, body: markdown, errors: ["missing frontmatter fence"] };
  }

  const match = normalized.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { frontmatter: null, body: markdown, errors: ["unterminated frontmatter fence"] };
  }

  const errors = [];
  const frontmatter = {};
  const lines = match[1].split(/\r?\n/);
  let currentArrayKey = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    const arrayItem = line.match(/^\s*-\s+(.*)$/);
    if (arrayItem && currentArrayKey) {
      frontmatter[currentArrayKey].push(coerceScalar(arrayItem[1]));
      continue;
    }

    const pair = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/);
    if (!pair) {
      errors.push(`unsupported frontmatter line: ${line.trim()}`);
      currentArrayKey = null;
      continue;
    }

    const [, key, rawValue = ""] = pair;
    if (rawValue === "") {
      frontmatter[key] = [];
      currentArrayKey = key;
      continue;
    }

    frontmatter[key] = coerceScalar(rawValue);
    currentArrayKey = null;
  }

  return {
    frontmatter,
    body: normalized.slice(match[0].length),
    errors
  };
}

// OKF alignment (additive, 1.3): a document may carry OKF `type` instead of or
// alongside `doc_type`. A non-empty scalar `type` satisfies the `doc_type`
// requirement, so OKF-style documents validate without duplicating the field.
// Nothing is removed or renamed — the breaking unification stays out of 1.x.
export function hasRequiredField(frontmatter, field) {
  if (field in frontmatter) return true;
  if (field === "doc_type" && typeof frontmatter.type === "string" && frontmatter.type.trim() !== "") return true;
  return false;
}

export function validateFrontmatter(frontmatter, options = {}) {
  const findings = [];

  if (!frontmatter) {
    return [{ severity: "error", rule: "frontmatter.exists", message: "YAML frontmatter is required." }];
  }

  for (const field of schemaRequiredFields()) {
    if (!hasRequiredField(frontmatter, field)) {
      findings.push({
        severity: "error",
        rule: "frontmatter.required",
        message: `Missing required field: ${field}.`,
        params: { field }
      });
    }
  }

  if ("status" in frontmatter && !schemaEnumValues("status").includes(frontmatter.status)) {
    findings.push({
      severity: "error",
      rule: "frontmatter.status",
      message: `Invalid status: ${frontmatter.status}.`,
      params: { status: frontmatter.status }
    });
  }

  if ("last_updated" in frontmatter && !/^\d{4}-\d{2}-\d{2}$/.test(String(frontmatter.last_updated))) {
    findings.push({
      severity: "error",
      rule: "frontmatter.last_updated",
      message: "last_updated must use YYYY-MM-DD."
    });
  }

  for (const arrayField of ["tags", "source_files", "related", "aliases", "evidence"]) {
    if (arrayField in frontmatter && !Array.isArray(frontmatter[arrayField])) {
      findings.push({
        severity: "error",
        rule: "frontmatter.array",
        message: `${arrayField} must be an array.`,
        params: { field: arrayField }
      });
    }
  }

  if ("visibility" in frontmatter && !schemaEnumValues("visibility").includes(frontmatter.visibility)) {
    findings.push({
      severity: "warning",
      rule: "frontmatter.visibility",
      message: `Unexpected visibility: ${frontmatter.visibility}.`,
      params: { visibility: frontmatter.visibility }
    });
  }

  if ("contains_sensitive_info" in frontmatter && typeof frontmatter.contains_sensitive_info !== "boolean") {
    findings.push({
      severity: "error",
      rule: "frontmatter.contains_sensitive_info",
      message: "contains_sensitive_info must be boolean."
    });
  }

  if (frontmatter.status === "verified" && (!frontmatter.reviewed_by || !frontmatter.reviewed_at)) {
    findings.push({
      severity: options.strict ? "error" : "warning",
      rule: "frontmatter.verified_review",
      messageId: options.strict ? "frontmatter.verified_review.strict" : "frontmatter.verified_review",
      message: options.strict
        ? "verified documents must include reviewed_by and reviewed_at in strict mode."
        : "verified documents should include reviewed_by and reviewed_at once the team adopts that policy."
    });
  }

  return findings;
}

function coerceScalar(value) {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
