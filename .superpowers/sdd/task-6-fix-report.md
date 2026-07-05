# Task 6 Fix Report

This report documents the fixes applied to resolve the Critical and Important issues identified in the Task 6 review, using `docs/life-sim/day-cycle-contract.md` as the authoritative source.

## Issues fixed

### Critical

1. **Event payloads now match the contract**
   - `world.day_ended` now emits `{ day, summaryId }` instead of `{ day, endedAtWorldMinute }`.
   - `day.summary_recorded` now emits `{ summaryId, day, summary: DaySummary }` instead of `{ day, summary }`.
   - A deterministic `summaryId` of `summary-${day}` is generated in `reducer-world.ts` and included in both payloads.

### Important

2. **Restored the `"ending"` state transition**
   - `world.end_day` first moves `worldClock.status` to `"ending"`.
   - It then ends remaining overlays, emits `world.day_ending`, computes the summary, emits `day.summary_recorded`, and emits `world.day_ended` while still in `"ending"` status.
   - Finally it resets the clock to `"not_started"`, `minuteOfDay = config.startOfDayMinute`, recomputed `phase`, `fractionalMinute = 0`, and `updatedAt = now`.

3. **Reset `fractionalMinute` to `0`**
   - The final end-of-day reset snapshot now explicitly sets `fractionalMinute: 0`.

4. **Restored `world.end_day` idempotency**
   - If `world.end_day` is called for a day that already exists in `completedDaySummaries`, the reducer returns an accepted no-op with `lifeSimSequence: null` and `events: []`.
   - This check is performed before the running/paused and end-of-day-minute guards, because the clock is `"not_started"` after the first successful `end_day`.

5. **Clean up active overlays and activities at end-of-day**
   - All remaining `activeOverlays` are ended with reason `"day_ending"`, emitting a `schedule.overlay_ended` event for each.
   - The final reset snapshot clears both `activeOverlays` and `activeActivities`.

6. **Updated tests**
   - `engine-world.test.ts` assertions now verify:
     - `world.day_ending`, `day.summary_recorded`, and `world.day_ended` payloads.
     - `status === "not_started"`, `minuteOfDay === config.startOfDayMinute`, and `fractionalMinute === 0` after `end_day`.
     - `completedDaySummaries` has one entry for the correct day.
     - Repeated `world.end_day` for the same day returns an accepted no-op.
     - `start_day { day: 2 }` is accepted after `world.end_day`.

## Files changed

- `packages/life-sim/src/reducer-world.ts`
- `packages/life-sim/src/engine-world.test.ts`
- `.superpowers/sdd/task-6-fix-report.md`

## Test results

### Focused test run

```bash
npm test -- packages/life-sim/src/engine-world.test.ts
```

```
✓ packages/life-sim/src/engine-world.test.ts (14 tests) 18ms
Test Files  1 passed (1)
Tests       14 passed (14)
```

```bash
npm test -- packages/life-sim/src/engine-truncation.test.ts
```

```
✓ packages/life-sim/src/engine-truncation.test.ts (1 test) 12ms
Test Files  1 passed (1)
Tests       1 passed (1)
```

### Full life-sim test suite

```bash
npm test -- packages/life-sim
```

```
✓ packages/life-sim/src/types.test.ts (1 test)
✓ packages/life-sim/src/store.test.ts (4 tests)
✓ packages/life-sim/src/engine-truncation.test.ts (1 test)
✓ packages/life-sim/src/engine-world.test.ts (14 tests)
✓ packages/life-sim/src/engine-schedule.test.ts (11 tests)
✓ packages/life-sim/src/engine-runtime.test.ts (6 tests)

Test Files  6 passed (6)
Tests       37 passed (37)
```

### Full repository test suite

```bash
npm test
```

```
Test Files  44 passed (44)
Tests       444 passed (444)
```

### Type check

```bash
npm run build -w packages/life-sim
```

```
> @agent-office/life-sim@1.0.0 build
> tsc --noEmit
```

No errors.
