# Pull request scope gate

Before drafting, creating, or updating a pull request, load and follow [jira-pr-scope-check](skills/jira-pr-scope-check/SKILL.md). Check the complete proposed PR diff against the relevant Jira ticket requirements, not only the latest commit or edits from this chat. Block unrelated or unverified scope by default. Allow an explicit user override only after disclosing the specific exceptions, and clearly label those exceptions in the PR description. Recheck after changes; never remove work or alter Jira criteria to make the check pass without separate approval.

## Pull request validation gate

Before drafting, creating, updating, or marking a PR ready, also load and follow [pre-pr-validation](skills/pre-pr-validation/SKILL.md). Run actual lint, tests, and build/type-check for the confirmed proposed revision. Both gates must independently PASS or have explicit user-approved exceptions before drafting or publishing. A scope override does not override validation failures. Disclose validation overrides prominently in the PR body, invalidate stale results after changes, and require both gates before any Jira review transition.
