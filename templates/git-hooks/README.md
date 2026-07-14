# Git hook templates

`pre-commit` runs `llm-wiki validate --changed`, which validates only the wiki
documents changed in the commit — fast enough for an every-commit hook.

Install one of:

- Copy it:
  `cp templates/git-hooks/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit`
- Point git at this directory:
  `git config core.hooksPath templates/git-hooks`

The hook uses `npx --no-install`, so add `@dowonk-7949/llm-wiki-standard` as a
devDependency in the consuming project. Errors block the commit; warnings do
not — add `--strict` to the hook command to block on warnings too.

Run the hook from the repository root (the `--changed` diff paths are resolved
relative to the git root).
