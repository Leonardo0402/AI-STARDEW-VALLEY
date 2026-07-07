# Task 2 Report: Truthful artifact and outcome states

## Status

DONE

## Commits

- `3bd7680` — feat(control-ui): distinct revision_required/rejected intents and artifact content states
- `ffa9ff4` — feat(pixel-office): rework cue for revision_required artifacts and blocked/failed posture truth

## Summary

Implemented the Task 2 requirements for Issue #25 (Refs #14):

- Added `revision_required` and `rejected` badge intents/colors and applied them to artifact and task badges.
- Reclassified artifact cards into explicit content states: `content-available`, `metadata-only`, `unavailable`, `loading`, `failed-open`, and `unsupported-open`.
- Kept `artifactId` out of the content area; URI is only shown when a real `uri` field is present.
- Tracked in-flight `ARTIFACT_OPEN` commands so the UI can show a loading state.
- Ensured blocked agents retain slumped posture, red pulse, and speech bubble; failed agents only render when `status === "failed"`.
- Added a red-flag clipboard + "rework" label cue for `revision_required` artifacts in the effect renderer.

## Verification

- `npm test` — 59 files, 642 tests, all green.
- `npm run build` — passed (Vite production build succeeded).

## Concerns

None. No protocol types, reducers, LifeSimEngine, RuntimeSession, or backend transport were changed.
