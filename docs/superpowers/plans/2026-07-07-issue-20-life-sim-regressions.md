# Issue #20: Fix LifeSim Phase 2 post-merge regressions and sequence rollback reliability

## Goal

Fix three regressions/reliability gaps discovered after merging PR #19 / Phase 2:

1. Default `demo-office` LifeSim URL is double-prefixed (`/life-sim/life-sim/default/...`).
2. `LifeSimSession` does not apply `world.time_advanced` / `world.day_ending` / `world.day_ended` to local projection, so Advance / Run to EOD / End Day leave the UI stale.
3. Failed persistence can still consume `lifeSimSequence` numbers, creating gaps on retry.

## Global Constraints

- Manual mode remains deterministic: no `Date.now`, `setTimeout`, or `Math.random` in reducer/projection logic.
- Browser-side code never owns canonical life-sim state or persistence.
- `LifeSimEngine` remains single-threaded per world.
- This is a focused follow-up to PR #19, not a new gameplay/visual phase.
- No new town buildings, farming, memory, or relationship systems.
- Every task ends with passing tests and a commit.

## Tasks

### Task 1: Fix default LifeSim URL double-prefix

**Problem:** `demo-office` defaults `lifeSimBaseUrl` to `/life-sim`, and `HttpLifeSimClient` also prefixes `/life-sim/${worldId}`, producing `/life-sim/life-sim/default/snapshot` while the Vite plugin mounts at `/life-sim/default`.

**Required changes:**
- Make `HttpLifeSimClient.baseUrl` an origin/root base; keep internal `/life-sim/${worldId}` prefix.
- Default `VITE_LIFE_SIM_BASE_URL` / `lifeSimBaseUrl` to `""` (same-origin root).
- Update `.env.example` and any tests that assume the old default.
- Add regression test for default config + `worldId="default"` URL construction.

**Verification:**
- `npm test -- packages/control-ui/src/life-sim/client.test.ts`
- `npm test -- apps/demo-office/src/integration-life-sim.test.ts`
- `npm run build`

### Task 2: Apply world clock events in LifeSimSession

**Problem:** `LifeSimSession.applyLifeSimEvent()` does not handle `world.time_advanced`, `world.day_ending`, or `world.day_ended`. After Advance / Run to EOD, local `worldClock` and capabilities stay stale; after End Day, `minuteOfDay` is reset to `0` instead of `startOfDayMinute`.

**Required changes:**
- Apply `world.time_advanced`: update `worldClock.minuteOfDay`, `phase`, `updatedAt`, fractional fields.
- Apply `world.day_ending`: set `status` to `"ending"`.
- Apply `world.day_ended`: reset `status` to `"not_started"`, `minuteOfDay` to `startOfDayMinute`, `phase` to computed phase, `updatedAt`.
- Use `startOfDayMinute` captured during bootstrap (already stored in Task 2 fix for Issue #18).
- Add session tests:
  - Advance 30 updates projection minute and capabilities.
  - Run to EOD enables End Day without rebootstrap.
  - End Day resets projection consistently with a fresh snapshot.

**Verification:**
- `npm test -- packages/control-ui/src/life-sim/session.test.ts`
- `npm test -- packages/control-ui/src/life-sim/projection.test.ts`
- `npm run build`

### Task 3: Roll back sequence allocation on persistence failure

**Problem:** `LifeSimEngine` passes `() => nextLifeSimSequence++` into reducers before `store.save()` succeeds. If save fails, sequence numbers are consumed but no events are durable.

**Required changes:**
- Stage sequence allocation locally per command/runtime input.
- Commit staged counter to `nextLifeSimSequence` only after `store.save()` succeeds.
- On save failure, leave `nextLifeSimSequence` unchanged.
- Cover both command and runtime-event paths.

**Regression tests:**
- `save` fails on `world.start_day` → retry same command → first durable event sequence is still `1`.
- `save` fails while applying a runtime event → retry/next durable runtime-caused event → no sequence gap.

**Verification:**
- `npm test -- packages/life-sim/src/engine.test.ts`
- `npm test`
- `npm run build`

### Task 4: Final whole-branch review and merge prep

- Run full suite: `npm test`, `npm run build`.
- Run integration test and a manual `npm run dev --workspace apps/demo-office` smoke check if feasible.
- Generate review package from `main` merge-base to `HEAD`.
- Dispatch final whole-branch review.
- Fix any Critical/Important findings.
- Create PR, link `Closes #20`.

## Acceptance Criteria

- `npm run dev --workspace apps/demo-office` boots in default mock mode without LifeSim startup 404.
- Default LifeSim client URL is `/life-sim/default/snapshot`, not `/life-sim/life-sim/default/snapshot`.
- Advance Time and Run to EOD update the LifeSim panel immediately through the event stream.
- End Day becomes enabled after Run to EOD without requiring a snapshot rebootstrap.
- Live post-End-Day projection matches a fresh server snapshot.
- Failed LifeSim persistence does not consume sequence numbers.
- `npm test` and `npm run build` pass.
