Closes #25
Refs #14

## Summary

This PR completes the Swarm Office V1.1 follow-up work that PR #24 deliberately left out:

- **Linked canvas / control-panel selection** — bidirectional, presentation-only selection between the pixel canvas and the React control surface. Selection survives Command ↔ Focus ↔ Debrief and Pixel ↔ List view switches, and clears only on explicit clear, Reset/adapter reset, or entity disappearance.
- **Truthful artifact/outcome states** — `revision_required`, `rejected`, `blocked`, and `failed` are now visually distinct. Artifact cards explicitly classify content into `content-available`, `metadata-only`, `unavailable`, `loading`, `failed-open`, and `unsupported-open`, and never treat `artifactId` as a URI.
- **Current-state visual QA** — the screenshot pipeline now captures 10 states across 1366×768, 1440×900, and 1920×1080, asserts dimensions and horizontal overflow, and skips states the mock adapter cannot truthfully produce.

## Verification

- `npm test -- --run`: **646 tests across 60 files, all green**
- `npm run build`: **passed**
- `node scripts/capture-demo-office-screenshots.mjs`: **passed** (10 states × 3 resolutions, dimension/overflow assertions)
- `node scripts/generate-annotated-comparisons.mjs`: **passed**
- Final whole-branch review: **approved with minor comments**

## Scope

- `apps/demo-office`
- `packages/pixel-office`
- `packages/control-ui`
- `scripts/`
- `docs/design/swarm-office-v1.1/`

No protocol types, reducers, LifeSimEngine, RuntimeSession, or backend transport changes.

## Notes

- #14 remains open; this PR only closes #25.
- States skipped from visual QA because the mock adapter cannot truthfully produce them: artifact `metadata-only` / `unavailable` / `unsupported-open`, `runtime-degraded`, `runtime-failed`. These UI states are implemented and tested; they are documented in `gap-audit.md`.
