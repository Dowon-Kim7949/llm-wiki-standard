> Language: [English](./README.md) | [한국어](./README.ko.md)

# LLM-WIKI Governance

**Governance for AI-written project docs.** `llm-wiki-governance` is a zero-dependency CLI that keeps an AI coding agent's project knowledge (`docs/llm-wiki/`) **trustworthy and current**: it ties every claim to real code, flags docs when that code moves on, keeps AI-written content behind human review, and enforces all of it in CI. Works on any stack, with any agent, and is **OKF-compatible**.

## Why a governance layer?

An *LLM wiki* — a distilled, interlinked knowledge base an agent reads instead of re-deriving your codebase on every task — is a proven pattern (popularized in 2026, and formalized by Google's Open Knowledge Format). The hard part was never *making* one. It's keeping it honest.

| Approach | How the agent gets context | The catch |
| --- | --- | --- |
| **RAG** | Re-retrieves and re-derives from source on every query | Repetitive, costly, no shared source of truth |
| **Plain LLM wiki** (a Markdown folder, e.g. an OKF project) | Reads a hand-written knowledge base | Goes stale silently → a doc that *lies* |
| **Governed LLM wiki** (this tool) | Reads the same wiki — but **verified, drift-checked, CI-enforced** | — |

**What "governed" means here:**

- **Trust states** — AI-written docs stay `needs_review`; only a human promotes to `verified`. The CLI can *never* self-approve.
- **Evidence + drift** — each claim links to a real file/line/symbol; when that source changes, `evidence.stale` / `drift` flags the doc for re-review.
- **CI-enforced** — `validate` runs in pre-commit / GitHub Actions, so an unreviewed or drifted wiki fails the build instead of rotting quietly.
- **Agent-queryable** — a read-only MCP server lets agents *ask* the wiki instead of re-scanning the code.
- **Safe by construction** — preview-first writes, append-only change log, sensitive-value redaction, and **zero runtime dependencies**.

```text
Without:  task -> re-scan the codebase -> re-derive structure & rules -> work
With:     task -> read index.md -> read the relevant (verified) wiki docs -> inspect only the source you need -> work
```

The CLI builds the structure and guardrails; an agent enriches the docs from real code; a human approves `verified`; CI keeps it honest. Useful for legacy maintenance, feature work, incident response, onboarding, handovers, and sharing project knowledge across agents.

## Supported environments

| | |
| --- | --- |
| **Runtime** | Node.js ≥ 18.18.0 · Windows, macOS, Linux |
| **Dependencies** | none — no runtime third-party dependencies |
| **Detects** | Node · Python · Go · Rust · JVM · PHP · Ruby · .NET · mobile (Android / Flutter / iOS / React Native) · infra (Docker / Compose / Kubernetes / Helm / Terraform) |
| **Standards** | **OKF-compatible** — `--profile okf-v0.1` validates Open Knowledge Format `type`/`aliases`/`tags`; the core validator accepts OKF `type` as an alias for `doc_type` |
| **Agents / editors** | Codex (`AGENTS.md`), Claude Code (`CLAUDE.md`), Cursor, GitHub Copilot, Windsurf, Gemini CLI — plus any MCP client via `llm-wiki mcp` |
| **Standalone** | the CLI (init / validate / audit / graph / stats / CI) works fully **without any agent** |

## Quick start

```bash
npm install -D llm-wiki-governance
npx llm-wiki quickstart --write --type frontend --agent claude   # or --agent codex
```

`quickstart --write` detects the project, creates the wiki + adapter files, and prints a handoff prompt. Paste that prompt into your agent: it reads `docs/llm-wiki/index.md`, enriches the docs from real source files, and leaves everything `needs_review` for you to approve. Preview first with `quickstart --dry-run`.

Add `--skills` (or `--agent claude|codex|cursor`) to also generate invocable, wiki-grounded automation prompts — a Claude skill (`.claude/skills/`, e.g. `/llm-wiki-feature`), a Codex skill (`.agents/skills/`), a Cursor rule, and an agent-neutral prompt — each carrying a snapshot of your project's domain map. They cover `bootstrap` (first-time enrichment of the init-generated skeleton, sharing its rules with `handoff`) plus ongoing `feature`/`fix`/`docs-sync` work. `--skills` emits every native format; a specific `--agent` emits that agent's format.

**Already have an OKF (or plain Markdown) knowledge folder?** Point the CLI at it to add verification, drift detection, and CI *without changing the format* — `--profile okf-v0.1` treats it as first-class.

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
| `quickstart --write` | Set up the wiki + adapter, print the agent handoff prompt (`--skills` also generates automation skills). |
| `validate` | Structure & safety validation for local checks / CI (`--strict`, `--changed`). |
| `audit` · `status` | Full findings report · current wiki state. |
| `graph` · `stats` | Knowledge graph (text/JSON/Mermaid/DOT) · health snapshot (verified % / enrichment % / evidence coverage). |
| `drift` · `fix` · `migrate` | Drift detection & downgrade · scoped safe autofix · contract upgrade (all preview-first). |
| `handoff` · `prompt` | Agent handoff prompt · repeatable task prompts (bootstrap/feature/fix/refactor/docs-sync/okf-extract). |
| `onboard` · `prepare` | Guided, read-only: learn a work area from real code evidence (`onboard [--domain]`) · scope a change before implementing (`prepare --task`). Assembled from the wiki; the CLI invents no explanation. |
| `mcp` | Run the read-only MCP server (see below). |

Add `--lang ko` (or set `lang` in `llm-wiki.config.json`) to see findings messages and `explain` output in Korean; rule IDs, the `--format json` shape, and default English output are unchanged.

Generated wiki documents are English by default. Add `--doc-lang ko` (or set `docLanguage` in `llm-wiki.config.json`) to generate the wiki content — and the agent doc-writing instructions in the handoff/skill prompts — in Korean instead. `--doc-lang` is independent of `--lang`, and technical identifiers (paths, code symbols, JSON keys, frontmatter fields, status values, evidence locators) are never translated.

Retrieval has opt-in token controls (default output unchanged): `get-doc --strict-section` withholds the full body when nothing matches (instead of falling back to a whole-doc read), `--max-chars <n>` caps the returned body exactly, `--compact` drops the frontmatter echo; and `prepare --compact` returns one bounded context bundle — a chosen path, at most three candidate docs, only the top doc's most-relevant section, and how to expand. These surface a diagnostic `estimatedTokens` (a `chars/4` proxy, not a measured token count).

Full command, option, exit-code, and programmatic-API reference: run `npx llm-wiki help <command>` (offline), or see [PUBLIC_API.md](https://github.com/Dowon-Kim7949/llm-wiki-governance/blob/main/docs/llm-wiki/PUBLIC_API.md).

## Governance in practice

- **Verify deliberately.** Agent-written docs stay `needs_review`; a human promotes to `verified` after reading them. Nothing the CLI does can bypass that.
- **Catch drift early.** Every doc cites `source_files` / precise `evidence`; when those change, `evidence.stale` and `drift` flag the doc. Run `drift --downgrade` to flip stale `verified` docs back to `needs_review`.
- **Keep it current in the same change.** Update the wiki alongside the code (`prompt --task docs-sync`, or the `docs-sync` skill), and run `validate --changed` in pre-commit / CI.
- **Let agents self-serve.** Point your agent at the `mcp` server so it queries the wiki as tools instead of re-scanning the code.
- **Wire up CI.** Copy [`templates/github-actions/llm-wiki-validate.yml`](https://github.com/Dowon-Kim7949/llm-wiki-governance/blob/main/templates/github-actions/llm-wiki-validate.yml) to run `validate` on every PR, or reference the composite action in one step — `uses: Dowon-Kim7949/llm-wiki-governance/.github/actions/validate@v1.7.0` (pin an exact tag).
- **Make it readable.** `graph --format mermaid`, `stats`, and `audit --format html` help humans see the corpus; it stays Markdown-in-git (renders on GitHub/GitLab, Obsidian, MkDocs — not a static-site generator).

## Does it actually help?

In an N=3 benchmark on an external Vue/Quasar app (Claude Opus 4.8; 6 code-comprehension tasks), an agent querying a **current** wiki answered at **equal correctness while reading no source code**, using ~10% fewer tokens — task-dependent (larger when the answer spans many files, negligible or worse when it's one small file). A **stale** wiki instead produced a confidently wrong answer, so the real payoff is **correctness that depends on freshness** — exactly what `verified` review, drift / `impact`, and `validate --changed` protect. This is a scoped result (one agent, one repo, total-token proxy), not a universal speed claim. Honest method + full numbers: [BENCHMARK.md](https://github.com/Dowon-Kim7949/llm-wiki-governance/blob/main/docs/llm-wiki/BENCHMARK.md).

## Agent-native (MCP)

`llm-wiki mcp` runs a [Model Context Protocol](https://modelcontextprotocol.io) server over stdio (newline-delimited JSON-RPC 2.0, Node built-ins only — no third-party SDK). Register it in an MCP client:

```json
{ "mcpServers": { "llm-wiki": { "command": "npx", "args": ["-y", "llm-wiki-governance", "mcp"] } } }
```

It exposes **read-only** tools — `validate`, `audit`, `next`, `status`, `doctor`, `stats`, `graph`, `explain`, `handoff`, `prompt` — so an agent can inspect the wiki but never write it. Details: [PUBLIC_API.md](https://github.com/Dowon-Kim7949/llm-wiki-governance/blob/main/docs/llm-wiki/PUBLIC_API.md) · [GATE_REVIEW.md](./GATE_REVIEW.md) (Gate 11).

## Use it from code

Import the package instead of shelling out — handy for CI wrappers, editor integrations, and tests:

```js
import { commands, normalizeOptions, run } from "llm-wiki-governance";

const r = await commands.audit(normalizeOptions({ cwd: process.cwd() }));
// r.command, r.result, r.findings, r.schemaVersion

const code = await run(["validate", "--strict"]); // 0 pass / 1 error / 2 blocked / 3 usage
```

`--format json` output carries a top-level `schemaVersion` so wrappers can pin the contract. Full API in [PUBLIC_API.md](https://github.com/Dowon-Kim7949/llm-wiki-governance/blob/main/docs/llm-wiki/PUBLIC_API.md).

## Safety at a glance

Preview-first everywhere (writes only with `--write` / `--apply`); `verified` is human-only in every command; `docs/llm-wiki/log.md` and existing adapter files are never overwritten; sensitive-looking values are never printed or written; no runtime third-party dependencies. Full scope decisions: [GATE_REVIEW.md](./GATE_REVIEW.md).

## Learn more

- [PUBLIC_API.md](https://github.com/Dowon-Kim7949/llm-wiki-governance/blob/main/docs/llm-wiki/PUBLIC_API.md) — full command / option / exit-code / configuration / programmatic-API / MCP reference.
- [GATE_REVIEW.md](./GATE_REVIEW.md) — accepted safety scopes (fix / migrate / drift / MCP / skills) and release gates.
- [ROADMAP.md](./ROADMAP.md) — direction and shipped history.
- [EXAMPLES.md](https://github.com/Dowon-Kim7949/llm-wiki-governance/blob/main/docs/llm-wiki/EXAMPLES.md) — worked examples · [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) — maintainer release steps.
- Community: [CONTRIBUTING.md](./CONTRIBUTING.md) · [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) · [SECURITY.md](./SECURITY.md).
