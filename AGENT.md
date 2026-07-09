# AI-STARDEW-VALLEY Agent Instructions

## Project Identity

This repository implements AI-像素 / Agent Office / AI Stardew Office.

It is not a traditional pixel game. It is an event-driven Agent Runtime control plane with a spatial pixel office interface.

The pixel layer is a presentation layer. Runtime truth must come from Runtime events, snapshots, LifeSim state, command results, or documented adapter evidence.

## Core Truth Boundary

The spatial office must not lie.

Meaningful task, approval, artifact, agent status, failure, review, or command state must be backed by real Runtime / LifeSim / command evidence.

Presentation state may decorate or explain truth, but must not fabricate business truth.

## Current Milestone

Foundation Milestone 1 is complete.

Completed tracks:

- Swarm Office V1.1 visual / UX closure
- LifeSim Foundation closure
- PR #32 merged
- Issues #31 and #15 closed

Current next phase:

- Phase 2 — Command Agent Work Integration

## Current Priority

Do not start another visual polish pass.

The next phase should focus on:

GitHub Issue / PR
→ Runtime Event
→ Agent Office Snapshot
→ Command Gateway
→ Policy Validation
→ Adapter Action
→ Result Event
→ Office Update

## Review Protocol

Use the local project skill:

```text
skills/project-reviewer-gate/SKILL.md
```

All PR reviews must check:

- The issue being closed or referenced.
- PR body claims.
- Changed files.
- Tests and build evidence.
- Whether any acceptance criterion is unresolved.
- Whether the PR should use `Closes #X` or `Refs #X`.

Never approve a PR that closes an issue while any acceptance criterion remains partial.

## Scope Discipline

For docs / audit PRs:

- Do not hide production code changes.
- Do not modify engine / reducer / store / session logic unless the issue explicitly allows it.
- Do not turn closure audits into feature work.

For visual work:

- Do not let screenshots fabricate Runtime truth.
- Any meaningful visual state must map to Runtime / LifeSim / command evidence.

For Phase 2:

- Prefer real adapter integration over more art polish.
- Start with GitHub Runtime Adapter v0.
