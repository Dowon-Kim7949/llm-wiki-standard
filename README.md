> Language: [English](./README.md) | [한국어](./README.ko.md)

# LLM-WIKI Standard

`@dowonk-7949/llm-wiki-standard` is a zero-dependency CLI that builds and validates a standardized, source-backed knowledge base (`docs/llm-wiki/`) for AI coding agents — so an agent starts from one index instead of re-reading your whole codebase on every task.

```text
Without LLM-WIKI:  task -> re-scan the codebase -> re-derive structure & rules -> work
With LLM-WIKI:     task -> read index.md -> read the relevant wiki docs -> inspect only the needed source -> work
```

The CLI creates the safe structure and guardrails; an agent (Codex, Claude Code, …) enriches the docs from real code; a human reviews and approves `verified`; CI keeps it honest. Useful for legacy maintenance, feature work, incident response, onboarding, handovers, and sharing project knowledge across agents.

## Supported environments

| | |
| --- | --- |
| **Runtime** | Node.js ≥ 18.18.0 · Windows, macOS, Linux |
| **Dependencies** | none — no runtime third-party dependencies |
| **Detects** | Node · Python · Go · Rust · JVM · PHP · Ruby · .NET · mobile (Android / Flutter / iOS / React Native) · infra (Docker / Compose / Kubernetes / Helm / Terraform) |
| **Agents / editors** | Codex (`AGENTS.md`), Claude Code (`CLAUDE.md`), Cursor, GitHub Copilot, Windsurf, Gemini CLI — plus any MCP client via `llm-wiki mcp` |
| **Standalone** | the CLI (init / validate / audit / graph / stats / CI) works fully **without any agent** |

## Quick start

```bash
npm install -D @dowonk-7949/llm-wiki-standard
npx llm-wiki quickstart --write --type frontend --agent claude   # or --agent codex
```

`quickstart --write` detects the project, creates the wiki + adapter files, and prints a handoff prompt. Paste that prompt into your agent: it reads `docs/llm-wiki/index.md`, enriches the docs from real source files, and leaves everything `needs_review` for you to approve. Preview first with `quickstart --dry-run`.

Add `--skills` (or `--agent claude|cursor`) to also generate invocable, wiki-grounded automation prompts — a Claude skill (`/llm-wiki-feature`), a Cursor rule, and an agent-neutral prompt — for ongoing feature/fix/docs-sync work, each carrying a snapshot of your project's domain map.

## Recommended agent & model

The CLI needs no model. Only the **enrichment** step — an agent reading code and writing accurate, source-backed docs — does, and that is where model quality matters most.

| Task | Model tier |
| --- | --- |
| **Wiki enrichment** (write/refresh docs from code) | Your agent's **strongest reasoning/coding model** (e.g. a Claude Opus-class model, a high-reasoning GPT-5-class model, or each tool's top coding model). Accuracy and low hallucination matter here. |
| **Routine upkeep** (`docs-sync` of small changes, running `validate`/`status`) | A mid-tier or economical model is fine. |
| **The CLI itself** (`init`, `validate`, `audit`, `graph`, `stats`, `mcp` server) | No model — pure Node, runs anywhere and in CI. |

The `llm-wiki mcp` server is deterministic (no model); the agent *calling* its tools can be any model, following the same enrichment guidance.

## Core commands

| Command | What it does |
| --- | --- |
| `quickstart --write` | Set up the wiki + adapter and print the agent handoff prompt. |
| `validate` | Structure & safety validation for local checks / CI (`--strict`, `--changed`). |
| `audit` · `status` | Full findings report · current wiki state. |
| `graph` · `stats` | Knowledge graph (text/JSON/Mermaid/DOT) · health snapshot. |
| `fix` · `migrate` · `drift` | Scoped safe autofix · contract upgrade · drift downgrade (all preview-first). |
| `handoff` · `prompt` | Agent handoff prompt · repeatable task prompts (feature/fix/refactor/docs-sync/okf-extract). |
| `mcp` | Run the read-only MCP server (see below). |

Full command, option, exit-code, and programmatic-API reference: run `npx llm-wiki help <command>` (offline), or see [PUBLIC_API.md](https://github.com/Dowon-Kim7949/llm-wiki-standard/blob/main/docs/llm-wiki/PUBLIC_API.md).

## Getting the most out of it

- **Keep it current.** Update the wiki in the same change as the code (`prompt --task docs-sync`), and run `validate --changed` in pre-commit / CI so drift is caught early.
- **Trust, but verify.** Agent-written docs stay `needs_review`; a human promotes to `verified`. Use `drift` to catch verified docs whose sources moved.
- **Let agents self-serve.** Point your agent at the `mcp` server so it queries the wiki as tools instead of re-scanning the code.
- **Make it readable.** `graph --format mermaid`, `stats`, and `audit --format html` help humans see the corpus; it renders natively on GitHub/GitLab, Obsidian, or MkDocs (it stays Markdown-in-git, not a static-site generator).
- **Wire up CI.** Copy [`templates/github-actions/llm-wiki-validate.yml`](https://github.com/Dowon-Kim7949/llm-wiki-standard/blob/main/templates/github-actions/llm-wiki-validate.yml) to run `validate` on every PR, or reference the composite action in one step — `uses: Dowon-Kim7949/llm-wiki-standard/.github/actions/validate@v1.7.0` (pin an exact tag).

## Agent-native (MCP)

`llm-wiki mcp` runs a [Model Context Protocol](https://modelcontextprotocol.io) server over stdio (newline-delimited JSON-RPC 2.0, Node built-ins only — no third-party SDK). Register it in an MCP client:

```json
{ "mcpServers": { "llm-wiki": { "command": "npx", "args": ["-y", "@dowonk-7949/llm-wiki-standard", "mcp"] } } }
```

It exposes **read-only** tools — `validate`, `audit`, `next`, `status`, `doctor`, `stats`, `graph`, `explain`, `handoff`, `prompt` — so an agent can inspect the wiki but never write it. Details: [PUBLIC_API.md](https://github.com/Dowon-Kim7949/llm-wiki-standard/blob/main/docs/llm-wiki/PUBLIC_API.md) · [GATE_REVIEW.md](./GATE_REVIEW.md) (Gate 11).

## Use it from code

Import the package instead of shelling out — handy for CI wrappers, editor integrations, and tests:

```js
import { commands, normalizeOptions, run } from "@dowonk-7949/llm-wiki-standard";

const r = await commands.audit(normalizeOptions({ cwd: process.cwd() }));
// r.command, r.result, r.findings, r.schemaVersion

const code = await run(["validate", "--strict"]); // 0 pass / 1 error / 2 blocked / 3 usage
```

`--format json` output carries a top-level `schemaVersion` so wrappers can pin the contract. Full API in [PUBLIC_API.md](https://github.com/Dowon-Kim7949/llm-wiki-standard/blob/main/docs/llm-wiki/PUBLIC_API.md).

## Safety at a glance

Preview-first everywhere (writes only with `--write` / `--apply`); `verified` is human-only in every command; `docs/llm-wiki/log.md` and existing adapter files are never overwritten; sensitive-looking values are never printed or written; no runtime third-party dependencies. Full scope decisions: [GATE_REVIEW.md](./GATE_REVIEW.md).

## Learn more

- [PUBLIC_API.md](https://github.com/Dowon-Kim7949/llm-wiki-standard/blob/main/docs/llm-wiki/PUBLIC_API.md) — full command / option / exit-code / configuration / programmatic-API / MCP reference.
- [GATE_REVIEW.md](./GATE_REVIEW.md) — accepted safety scopes (fix / migrate / drift / MCP) and release gates.
- [ROADMAP.md](./ROADMAP.md) — direction and shipped history.
- [EXAMPLES.md](https://github.com/Dowon-Kim7949/llm-wiki-standard/blob/main/docs/llm-wiki/EXAMPLES.md) — worked examples · [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) — maintainer release steps.
- Community: [CONTRIBUTING.md](./CONTRIBUTING.md) · [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) · [SECURITY.md](./SECURITY.md).
