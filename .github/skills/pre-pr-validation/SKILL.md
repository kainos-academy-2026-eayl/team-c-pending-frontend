---
name: pre-pr-validation
description: 'Verify actual lint, test, and build/type-check results before drafting, creating, updating, or marking a PR ready. Use when asked to "make a pull request", "create a PR", "open a PR", "draft a PR", "write a PR description", "update this PR", "mark this PR ready for review", or run pre-PR checks. Block failed or unverified validation unless the user explicitly approves disclosed exceptions. Do NOT use for ordinary implementation, general testing questions, or Jira scope assessment alone.'
compatibility: 'Requires Git, Node.js, npm, and repository-defined validation scripts. Authenticated gh is optional for existing PR metadata. No MCP server is required by this validation gate.'
metadata:
  capability: engineering-testing
---

# Pre-PR validation gate

Run alongside [jira-pr-scope-check](../jira-pr-scope-check/SKILL.md), not instead of it. Before drafting or publishing a PR, report validation for the exact proposed changes. This skill does not authorize commits, pushes, publication, unrelated fixes, or Jira writes. Instructions guide AI behavior; they are not a GitHub branch protection rule.

## Required Tooling

- Use Git to establish repository identity, base/head SHAs, and staged, unstaged, and untracked changes.
- Use existing repository npm scripts and their configured lint, test, and build/type-check tools. Do not add a new runner just for this gate.
- Optionally use authenticated `gh pr view` for an existing PR's base/head and live revision. Use it only when needed; missing gh is not a blocker when Git and the confirmed PR boundary suffice.
- No MCP server is required for validation. Leave Jira scope and status decisions to the companion skill.

## 1. Identify the revision and commands

1. Confirm the repository with `git rev-parse --show-toplevel`, `git remote -v`, `git branch --show-current`, `git rev-parse HEAD`, and `git status --short`. Assess each repository separately in a multi-root workspace.
2. Reuse the companion gate's confirmed base/head and exact proposed local additions. If invoked alone, confirm those boundaries; never assume all dirty files belong in the PR. Record both SHAs and the assessed local diff/untracked content. Do not stash, revert, stage, or switch branches automatically.
3. Checks against a dirty worktree containing excluded changes do not validate the exact PR revision. Ask for authorization to use an isolated checkout with only the proposed changes, or report UNVERIFIED. Never overwrite shared work or include unrelated files just to obtain a pass.
4. Read `package.json`, lockfile, CI workflow, validation configuration, and directly relevant documentation to identify the actual commands, environment prerequisites, and tested coverage. Inspect delegated scripts where needed. Do not assume a script named lint performs linting.
5. Require lint, tests, and production build/type-check. In these repositories the default commands are `npm run lint`, `npm test`, and `npm run build`; confirm the current scripts before using them. Build currently includes type-check, so do not run type-check twice. If build does not include it, also run the configured type-check command. Missing required commands or tooling make the gate UNVERIFIED, not PASS.

## 2. Execute and inspect evidence

1. Run non-watch, non-fixing commands in the assessed repository. Use the existing smallest selectors that cover the proposed changes and required output contracts, plus all checks required by the repository's PR CI. When CI runs the full test suite or repository-wide lint, a focused run alone does not satisfy that requirement. Build/type-check must cover the production application.
2. Record each command, working directory, revision/local inputs, exit code, and meaningful output, including executed test counts and coverage scope. Wait for completion; a started, interrupted, or timed-out run is not a pass. Parallelize independent checks only when they do not race on generated files or other shared state.
3. Inspect whether lint actually checked files and tests actually executed applicable cases. A no-op linter, zero tests, skipped required suites, missing services, or swallowed errors is UNVERIFIED even if the shell exits zero. Build failure is BLOCKED even if its type-check phase passed.
4. Restore dependencies only after a chosen command fails due to missing dependencies, or after an authorized dependency-manifest change. Use the existing lockfile/package manager and inspect install hooks. Do not install new tooling or change dependencies merely to make the gate pass.
5. Report failures with command and actionable evidence. Distinguish pre-existing failures only when supported by baseline evidence; do not claim that distinction from recollection. Do not weaken checks, suppress diagnostics, rewrite snapshots blindly, seed/reset databases, or fix unrelated code. Obtain approval for out-of-scope remediation or service/data changes.
6. After in-scope fixes, rerun affected checks. Invalidate affected evidence after source, tests, config, dependencies, generated inputs, or base/head changes. A commit with demonstrably identical assessed inputs may retain results, but record the new SHA and verify that equivalence. Before publication verify the proposed revision still matches; a CI badge or old run for another SHA is not current evidence.

## 3. Report and gate

Report scope and validation independently. Use this compact table:

| Check | Command / coverage | Revision | Result | Evidence |
|---|---|---|---|---|
| Lint | Actual command and checked paths | SHA + local inputs | PASS / FAILED / UNVERIFIED | Files checked or diagnostic |
| Tests | Actual command and suite selection | SHA + local inputs | PASS / FAILED / UNVERIFIED | Executed counts or failure |
| Build/type-check | Actual commands | SHA + local inputs | PASS / FAILED / UNVERIFIED | Completed phases or failure |

- **PASS:** all required checks actually ran successfully for the assessed revision and coverage, with no missing or stale evidence. State validation limits; this is not proof of all behavior.
- **BLOCKED:** a required check failed. List each failure, including pre-existing failures; they are not automatic exemptions.
- **UNVERIFIED:** a required check, exact revision, or adequate coverage could not be established. Name every limitation.
- **OVERRIDDEN:** the user explicitly approved the specific failed or unverified checks after disclosure. Never relabel the result PASS.

For BLOCKED or UNVERIFIED, present the choices in this order, with the first choice selected by default:

1. **Fix the reported errors or restore prerequisites** - select this by default. Fix within the approved scope and rerun affected checks before resuming. For unrelated application fixes, dependency changes, or other out-of-ticket remediation, obtain separate authorization and keep them out of the PR unless an explicit scope exception is approved.
2. **Stop without committing or publishing** - leave the changes untouched so the user can address the reported issues before committing. End the PR workflow; do not automatically fix, stage, commit, push, publish, or transition Jira.
3. **Explicitly override the listed validation exceptions** - require approval of the exact failed or unverified checks and disclose them in the PR body. Never preselect or recommend this shortcut.

Use this same ordering in combined multi-repository choices; put fixing first, stopping second, and overrides last. Default selection is not authorization to expand scope. Do not commit PR changes, draft, or publish until the checks are resolved or explicitly overridden. A generic "make a PR", an earlier scope override, or this skill's installation is not a validation override.

Present findings, diagnostics, file links, validation tables, and recommendations in normal chat before opening the question form. Keep the form message to the actual short question, such as "How should we address these checks?", with concise choice labels. Do not put the explanatory report inside the question block.

## 4. Carry evidence into the PR

Include a short validation section with actual commands, results, revision, and coverage limits. For an approved override, include this conspicuous section in both the draft and published body, separately from any Jira scope exception:

```markdown
## Validation exception - checks failed or unverified

- Exact failed, missing, or stale check, command, assessed revision, and diagnostic/limitation.

The requesting user explicitly approved these listed validation exceptions in this conversation. Validation is OVERRIDDEN, not PASS.
```

Recheck inputs and affected evidence before creating, updating, or marking a PR ready. New failures or limitations require new approval. Both this gate and the Jira scope gate must independently PASS or have their own approved overrides before publication or the companion skill's Jira review transition. Draft PRs still require the checks or a disclosed override, but never trigger Jira transitions.

## Trigger examples

- **"Create a PR for KAN-90."** Run both gates on the confirmed proposed revision. Report actual lint/tests/build results; block publication for a failed build even when tests pass.
- **"Write a PR description for this branch."** Run both gates before drafting. If lint is a no-op, report UNVERIFIED and ask for remediation or a specific override; do not claim lint passed.
- **"Open a draft PR despite this disclosed build failure."** Record the explicit validation override for that failure, keep other required checks, and include the warning in the draft PR body. Leave Jira unchanged.
- **"What does npm test do?"** Do not trigger this workflow for an informational question.
