---
name: jira-pr-scope-check
description: 'Check the full PR diff against Jira requirements and block unrelated scope unless explicitly overridden. Move eligible Jira tickets from In Progress to In Review after verifying an open, non-draft PR. Use when asked to "make a pull request", "create a PR", "open a PR", "draft a PR", "write a PR description", "update this PR", "mark this PR ready for review", or check Jira scope before publishing. Run before drafting or publishing, including draft PRs. Do NOT use for ordinary implementation, general Git questions, or unrelated code review without a PR request.'
compatibility: 'Requires local Git, authenticated GitHub CLI (gh), and authenticated Atlassian MCP access to the relevant Jira tickets.'
metadata:
  capability: engineering-general
---

# Jira PR scope check

Run this gate before drafting, creating, or updating a PR. This skill checks scope and moves its confirmed Jira tickets to review only after the PR is open and ready for review. It does not replace code review, testing, or authorization to commit, push, or publish. Jira writes are limited to the status transition in section 6.

For PR drafting, publication, updates, or marking ready, also load and follow [pre-pr-validation](../pre-pr-validation/SKILL.md). Both gates must independently PASS or have their own explicit approved overrides before drafting or publishing. Keep validation exceptions separate from scope exceptions; a scope override does not waive validation.

## Required Tooling

- Use Git for repository identity, commit ranges, complete diffs, and worktree inspection.
- Use authenticated `gh` CLI for existing PR metadata, the target branch, and GitHub publishing only when requested.
- Use Atlassian MCP to discover the accessible Jira site, read ticket requirements/statuses and available transitions, and transition eligible tickets as specified in section 6. Discover tool schemas before using deferred tools. Do not edit descriptions, acceptance criteria, or other Jira fields.
- If required tooling, permissions, a base ref, or Jira content is unavailable, report the limitation and mark the gate UNVERIFIED. Do not invent requirements or treat branch names, PR descriptions, or cached recollections as authoritative ticket content.

## 1. Establish the exact PR boundary

1. Confirm the repository using `git rev-parse --show-toplevel`, `git remote -v`, and `git branch --show-current`. In a multi-root workspace, assess each repository separately. Do not confuse a sibling checkout, nested folder, or other window with the intended repository.
2. Read `git status --short`. Identify the actual target base and head. For an existing PR use `gh pr view` or `gh pr view NUMBER` with explicit repository selection where needed, requesting `url,baseRefName,headRefName,headRefOid`. For a new PR obtain the intended base from the user or verified repository workflow; do not assume main.
3. Ensure refs are available and current enough to assess the intended PR. Fetch the relevant remote refs when appropriate; do not pull, switch branches, or overwrite local work. For a remote PR whose head differs from local HEAD, inspect the remote PR head or ask which revision is intended.
4. Inspect the complete merge-base diff: `git diff --name-status BASE...HEAD`, `git diff --stat BASE...HEAD`, `git log --oneline BASE..HEAD`, and `git diff BASE...HEAD`. Substitute verified refs, not literal placeholders. Read changed code and enough surrounding context to understand every hunk, including additions, deletions, renames, generated files, dependency/lockfile updates, tests, docs, formatting, migrations, and configuration.
5. Distinguish committed PR changes from staged, unstaged, and untracked work. If the user intends to commit more work into the PR, inspect those exact proposed additions too, without staging them automatically. If that boundary is unclear, ask. Record the base/head SHAs and proposed local additions so the result identifies exactly what was assessed.
6. Handle large diffs with bounded reads until every changed hunk is covered. Never report PASS based on a summary, file count, latest commit, or only work performed in this conversation.

## 2. Establish authoritative Jira scope

1. Identify candidate ticket keys from the request, branch, commits, or existing PR. Ask the user to confirm the intended tickets if missing, ambiguous, or conflicting. A key appearing in a commit does not automatically authorize its changes.
2. Use Atlassian MCP to retrieve each confirmed ticket from the correct Jira site, including description, work-to-complete items, acceptance criteria, and explicitly referenced dependencies. Read linked material only when needed to resolve a specific requirement.
3. Extract the actual requirements as a short numbered list with ticket keys and links. Preserve their meaning; do not invent criteria, broaden scope from the title, or assume an entire epic is authorized.
4. If requirements are absent, contradictory, or too vague to assess a change, state the precise uncertainty and ask for clarification. Extra related tickets require explicit user confirmation before joining the PR scope.

## 3. Map every change to a requirement

Produce a compact evidence table grouped by logical change, not just file. Split files containing both in-scope and extra work into separate rows. Cite file locations and the specific requirement text or numbered requirement.

| Change and files | Jira requirement | Classification | Reason / evidence |
|---|---|---|---|
| Logical change | KEY / requirement | In scope, Necessary support, Out of scope, or Unverified | Concrete justification |

- **In scope:** directly implements a confirmed ticket requirement.
- **Necessary support:** a test, directly related documentation, or the smallest prerequisite needed to deliver or validate that requirement. Explain the causal dependency. Do not use this category to excuse unrelated refactors, cleanup, cosmetic reformatting, speculative features, or optional abstractions.
- **Out of scope:** behavior, cleanup, formatting churn, dependencies, migrations, seed changes, or other work not required by the confirmed ticket. A useful improvement is not automatically authorized.
- **Unverified:** insufficient evidence or ambiguous requirements; explain what is missing.

Also map each Jira acceptance criterion to implementation and available validation evidence. Flag missing or only partially satisfied criteria. Distinguish tests actually run from tests merely read or proposed. This scope check cannot prove correctness from static inspection alone.

## 4. Gate, clarify, or obtain an explicit override

Report one result before producing a PR draft or publishing:

- **PASS:** every change is justified, no required criterion is missing, and no scope uncertainty remains. Describe validation limits honestly.
- **BLOCKED:** extra changes or missing required criteria were found. List the exact exceptions and recommend splitting or excluding unrelated work.
- **UNVERIFIED:** the full diff, Jira requirements, or necessary evidence could not be obtained. Name the limitation.

For BLOCKED or UNVERIFIED, ask the user whether to split/fix the scope, clarify the requirements, cancel, or explicitly override the listed exceptions. Do not output the PR draft or create/update it before approval. A generic earlier "make a PR" request is not an override. A targeted instruction such as "include the seed cleanup despite it being outside KAN-90" can be an override only once that scope difference is clearly disclosed.

Record an override as **OVERRIDDEN**, never PASS. Repeat which changes are outside the ticket, which criteria remain missing, and which facts remain unverified. An override accepts these exceptions for this PR; it does not change Jira requirements, certify correctness, or waive other safety checks.

Do not silently remove, revert, stash, split commits, rewrite history, edit tickets, or create a new branch to resolve a finding. Propose the smallest correction and obtain the appropriate authorization.

## 5. Carry the result into the PR

Start every proposed and published PR body with the confirmed Jira ticket link(s) on the first non-empty line, before headings, summaries, validation, or exception sections. Use `Jira: [KEY](ticket-url)` for one ticket and list every confirmed in-scope ticket on that line for multiple tickets. Use the verified Jira site URLs, not guessed links. Preserve this placement when updating a PR, including draft PRs and approved overrides. Before publication and in the live PR read-back, verify that these top-of-body links match the assessed tickets; correct missing or misplaced links before claiming the PR workflow succeeded.

For PASS, include a short Jira scope section linking confirmed tickets and summarizing the requirement mapping and validation.

For an approved override, include this conspicuous section in both the proposed PR body and the published body:

```markdown
## Scope exception - outside Jira requirements

Jira ticket(s): [KEY](ticket-url)

The following changes are outside the referenced ticket requirements:
- Exact change, affected files, and why it is outside scope.

Other approved exceptions:
- Any missing criteria or unverified scope/evidence; say "None" if applicable.

The requesting user explicitly approved these listed exceptions in this conversation. This does not amend the Jira ticket or mean the scope check passed.
```

Never hide exceptions only in chat, a commit message, or a footnote. Keep the warning in draft PRs too. If no out-of-ticket change exists but unverified/missing scope was overridden, state that explicitly instead of inventing an extra change.

Before publishing or updating, verify the diff and relevant Jira requirements still match the assessment. Rerun affected checks after commits, rebases, added files, base-branch changes, ticket edits, or changed scope. New exceptions require new explicit approval. Publish only through the user's requested workflow and confirm the resulting PR URL.

## 6. Move Jira tickets to review after publication

1. After creating a PR, marking it ready, or updating an existing PR, confirm its live state using `gh pr view NUMBER --json url,state,isDraft,body,headRefOid` in the verified repository. Continue only when the PR is OPEN, `isDraft` is false, and its head and ticket links match the assessed scope. A description drafted in chat, a draft PR, failed creation, or a closed/merged PR must not trigger a Jira transition.
2. Require PASS or an explicit, recorded OVERRIDDEN result from each of the scope and pre-PR validation gates for the assessed revision. Transition only the confirmed Jira tickets whose implementation is ready for review in this PR. Do not transition epics, merely related tickets, or tickets covering unfinished work in another repository. If readiness is uncertain, ask rather than moving the whole ticket prematurely.
3. Use Atlassian MCP to reread each ticket's current status and obtain available workflow transitions for that ticket on the verified Jira site. If it is already In Review, report that and do nothing. Only automatically move a ticket currently In Progress to In Review; for any other status, leave it unchanged and explain why.
4. Select the available transition whose destination status is In Review (compare case-insensitively). Use the returned transition ID, never a hard-coded ID or an assumed transition name. If the destination is missing or ambiguous, or required transition fields are unavailable, leave the ticket unchanged and report the blocker; do not use intermediate statuses or invent field values.
5. Execute the transition through Atlassian MCP, then reread the issue and verify its status is In Review before claiming success. This workflow authorizes this automatic transition without another routine confirmation, unless the user explicitly opts out for this PR. It does not authorize any other Jira change.
6. If an API call fails or times out, reread the status before retrying so a successful but unacknowledged transition is not repeated. Report permission failures, workflow restrictions, and verification failures explicitly. Keep the created PR and its scope-exception disclosure intact; do not close it or claim the entire workflow succeeded to conceal a Jira failure.
7. In the final response, include the PR URL and each confirmed ticket's transition result: moved, already In Review, skipped with reason, or failed with reason. For multiple tickets, report each independently.

## Trigger and decision examples

- **"Create a PR for KAN-90."** Read the full branch diff and KAN-90 through Atlassian MCP. Carousel code and its tests can map to the ticket; unrelated seed consolidation blocks creation.
- **"Write a PR description for this branch."** Trigger even though publication is not requested. If the ticket is missing, ask for it before drafting. Do not infer the scope from the branch name alone.
- **"Include the seed cleanup anyway."** After disclosing that it is outside the confirmed ticket, record the explicit override and put the scope-exception section in the PR body. Do not relabel the cleanup as necessary support.
- **"Fix this button" / "What is a PR?"** Do not trigger this gate solely for ordinary implementation or an informational question.
- **"Create a ready-for-review PR for KAN-90."** After PASS or approved OVERRIDDEN scope, verify the published PR is open and non-draft, transition KAN-90 from In Progress to In Review using the available workflow transition, and verify the resulting status.
- **"Open a draft PR" / "Write a PR description."** Perform the scope check, but leave Jira unchanged. Move the ticket only in a later requested workflow that makes/verifies the PR ready for review.
