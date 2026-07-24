# Maintainers

| Role | Person | GitHub | Responsibilities |
| --- | --- | --- | --- |
| Maintainer / Release approver | Dowon-Kim | [@Dowon-Kim7949](https://github.com/Dowon-Kim7949) | Reviews and approves pull requests; cuts releases; is the human sign-off that promotes LLM-WIKI documents to `verified`. |

## Release approval

Releases are cut by the maintainer. Pushing a `v*` tag triggers npm Trusted
Publishing and the GitHub Release job (see `RELEASE_FLOW.md` and
`docs/llm-wiki/RELEASE_FLOW.md`). Nothing is published to npm without the
maintainer pushing the tag; the version in the tag must match `package.json`
(guarded by `publish.yml`).

## Review → `verified` sign-off

Agent- or CLI-generated/edited wiki documents stay `needs_review`. Only a human
maintainer promotes a document to `verified` — recorded as `reviewed_by` /
`reviewed_at` — via an explicit `llm-wiki review --approve` (see GATE_REVIEW.md,
"Review Workflow Scope Decision"). The tooling never auto-verifies, and no
command available over MCP can write or promote a document.
