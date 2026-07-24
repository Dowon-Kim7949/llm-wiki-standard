> Language: [English](./CONTRIBUTING.md) | [한국어](./CONTRIBUTING.ko.md)

# Contributing to llm-wiki-governance

Thanks for your interest in improving `llm-wiki-governance` — a stable,
zero-dependency CLI that governs AI-written project docs (verify, catch drift,
keep them code-grounded; OKF-compatible). This guide covers
how to set up, make changes, and open a pull request.

By participating, you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Ways to contribute

- **Report a bug** — open a [bug report](https://github.com/Dowon-Kim7949/llm-wiki-governance/issues/new?template=bug_report.md).
- **Request a feature** — open a [feature request](https://github.com/Dowon-Kim7949/llm-wiki-governance/issues/new?template=feature_request.md). Check [ROADMAP.md](./ROADMAP.md) first to see if it is already planned.
- **Improve docs** — README/CHANGELOG/ROADMAP and the LLM-WIKI under `docs/llm-wiki/`.
- **Report a vulnerability** — do **not** open a public issue; follow the [Security Policy](./SECURITY.md).

## Prerequisites

- **Node.js `>=18.18.0`** (see `engines` in `package.json`).
- No third-party runtime dependencies — the CLI uses Node built-ins only. Please
  keep it that way unless there is a strong, discussed reason.

## Getting started

```bash
git clone https://github.com/Dowon-Kim7949/llm-wiki-governance.git
cd llm-wiki-governance
npm install
npm test             # node --test tests/*.test.js
```

Useful scripts:

| Command | What it does |
|---|---|
| `npm test` | Run the test suite (`node --test tests/*.test.js`) |
| `npm run verify` | Tests + `validate-frontmatter` (the release gate check) |
| `npm run doctor` | Environment / project diagnostics |
| `npm run audit` | Full LLM-WIKI audit of this repo |
| `npm run validate-frontmatter` | Validate wiki frontmatter contracts |
| `npm run lint` | Zero-dep syntax gate — `node --check` over every source file (no linter dependency) |
| `npm run test:coverage` | Tests with Node's built-in coverage (`node --test --experimental-test-coverage`, Node 20+) |
| `npm run sbom` | Generate a CycloneDX SBOM (`npm sbom`) for supply-chain review |

Run the CLI directly during development with `node bin/llm-wiki.js <command>`.

## Project conventions

This repository **dogfoods its own standard** — its knowledge base lives in
`docs/llm-wiki/`. Please read [`docs/llm-wiki/index.md`](./docs/llm-wiki/index.md)
before changing code or docs.

- **UTF-8 everywhere.** Read and write Markdown as UTF-8.
- **Cross-platform.** CI runs on Linux, Windows, and macOS across Node
  18.18/20/22/24. Avoid OS-specific path handling; use `node:path`.
- **No sensitive information** in docs, logs, reports, or prompts.
- **LLM-WIKI discipline:**
  - Docs created or edited by an LLM stay `needs_review`. Only a human reviewer
    sets `verified`.
  - If you change code or docs, update the related wiki docs and append an entry
    to [`docs/llm-wiki/log.md`](./docs/llm-wiki/log.md) (append-only).
- **Bilingual docs.** `README`, `CHANGELOG`, `ROADMAP`, and these community
  files are kept as English (`*.md`, canonical) + Korean (`*.ko.md`) pairs with a
  `> Language:` cross-link at the top. If you edit one side, update its pair.
- **Adding a new check?** Follow the existing pattern: add a `scan<Something>(cwd)`
  function, join its findings into `audit`, name the rule `category.subrule`, and
  register it in `FINDING_EXPLANATIONS` so `explain` can describe the fix. See
  [`docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md`](./docs/llm-wiki/ARCHITECTURE_CONVENTIONS.md).

## Tests

- Add or update tests under `tests/` for any behavior change.
- Keep tests deterministic and platform-independent.
- `npm test` (and `npm run verify`) must pass before you open a PR. CI runs the
  full matrix.

## Quality gates & dependencies

This project keeps **zero runtime AND zero dev dependencies** — a deliberate
identity, not an oversight. Two consequences for contributors:

- **Style is enforced by review, not by a linter dependency.** There is no
  ESLint/Prettier. `npm run lint` is a `node --check` syntax gate over the source
  (`scripts/lint-syntax.mjs`), and `.editorconfig` captures the whitespace rules.
  Match the surrounding code's style; reviewers flag deviations.
- **Coverage uses the Node built-in.** `npm run test:coverage`
  (`node --test --experimental-test-coverage`, Node 20+) — not `nyc`/`c8`. It is
  reported, not gated, so a coverage tool never becomes a dependency.

Please do **not** add a runtime or dev dependency (or a lockfile entry) without a
strong, discussed reason — it would break the advertised zero-dependency stance
the project is known for. Supply-chain review: `npm run sbom` emits a CycloneDX
SBOM, and a GitHub-native CodeQL workflow scans on push/PR.

## Commit & pull request flow

1. Fork and create a topic branch off `main`.
2. Make focused commits with clear messages.
3. Ensure `npm run verify` passes locally.
4. Open a PR against `main` and fill in the [pull request template](./.github/pull_request_template.md).
5. CI (tests, frontmatter validation, `doctor`, `npm pack --dry-run`, consumer
   install) must be green.

Keep PRs small and scoped. Unrelated changes are easier to review as separate PRs.

## Releases

Releases are handled by maintainers. Publishing is automated via a `v*` tag using
npm Trusted Publishing (`.github/workflows/publish.yml`). See
[`RELEASE_CHECKLIST.md`](./RELEASE_CHECKLIST.md) and [`GATE_REVIEW.md`](./GATE_REVIEW.md)
for the gate and decision record.

## Questions

Open an [issue](https://github.com/Dowon-Kim7949/llm-wiki-governance/issues) — but
please read the README and `docs/llm-wiki/` first; many answers are already there.
