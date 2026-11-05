---
name: jira-pr-scope-check
description: Check PR scope against Jira requirements before publishing; transition tickets to In Review after publication
---

# Jira PR Scope Check Skill

This skill gates PR creation, updates, and readiness checks by ensuring all changes map to confirmed Jira ticket requirements and detecting out-of-scope work.

## When to invoke

- **"Create a PR for KAN-90"** — Read full branch diff and Jira ticket; check scope
- **"Make a pull request for [TICKET]"** — Run scope gate before publishing
- **"Write a PR description"** — Perform scope check before drafting
- **"Mark this PR ready for review"** — Verify live PR matches assessed scope; transition Jira ticket
- **"Update this PR"** — Re-check scope for new commits or changes
- **"Draft a PR"** — Perform scope check on draft; don't transition Jira yet

## Process

1. **Establish exact PR boundary:** Identify base/head refs, committed changes, and proposed uncommitted additions
2. **Establish Jira scope:** Fetch confirmed ticket(s) from Jira; extract actual requirements
3. **Map every change to requirements:** Classify as In Scope, Necessary Support, Out of Scope, or Unverified
4. **Gate:** Report PASS, BLOCKED, or UNVERIFIED; ask for user action before proceeding
5. **Create/update PR:** Draft PR body with Jira ticket links at top and scope sections
6. **Transition Jira ticket:** After PR publication is verified, move ticket to In Review (only if both scope and validation gates pass)

## Critical checklist

- ✅ Jira ticket links on first non-empty line of PR body: `Jira: [KEY](url)`
- ✅ Scope exception section included for OVERRIDDEN results (never omit)
- ✅ **PR URL displayed at end of final response** (both inline and in summary)
- ✅ Both scope and validation gates pass (or have recorded overrides) before Jira transition
- ✅ Ticket moved to In Review only after PR is OPEN and non-draft
- ✅ PR URL shared prominently in final summary

## Output requirements

The final response MUST include the PR link at the end in this format:

```markdown
**Pull Request:** [#NUMBER](PR_URL)
```

This must appear:
1. In the PR body (already done via `gh pr create`)
2. **At the end of the chat response** as a prominent link

Always display the full PR URL clearly, even if included earlier in the response.

## Related skills

- [pre-pr-validation](../pre-pr-validation/SKILL.md) — Validate lint, tests, build before PR
- Jira integration via Atlassian MCP
