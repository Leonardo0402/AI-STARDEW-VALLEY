# Swarm Office — Visual QA Report (Task 8)

> Generated: 2026-07-05
> Comparison target: `high-fidelity-designs-preview.png` + `design-system.md`
> Screenshot source: `scripts/capture-baseline-screenshots.mjs`
> Resolutions verified: 1366×768, 1440×900, 1920×1080

## Screenshot manifest

| # | File | States captured | Resolutions |
|---|------|-----------------|-------------|
| 01 | `01-command-mode.png` | Connected, no active task, pixel view | 1366×768, 1440×900, 1920×1080 |
| 02 | `02-focus-mode.png` | Focus tab active, ambient indicator | 1366×768, 1440×900, 1920×1080 |
| 03 | `03-debrief-mode.png` | Debrief tab active, timeline view | 1366×768, 1440×900, 1920×1080 |
| 04 | `04-idle-state.png` | Connected, no active task | 1366×768, 1440×900, 1920×1080 |
| 05 | `05-working-state.png` | One running task | 1366×768, 1440×900, 1920×1080 |
| 06 | `06-approval-state.png` | Pending approval visible | 1366×768, 1440×900, 1920×1080 |
| 07 | `07-blocked-state.png` | Pending approval rejected → blocked | 1366×768, 1440×900, 1920×1080 |
| 08 | `08-error-state.png` | Session error, recovery action visible | 1366×768, 1440×900, 1920×1080 |

Output directory: `docs/design/swarm-office/baseline-screenshots/{width}x{height}/`

## Method

1. Started `node scripts/dev-remote-demo.mjs` (Vite + QClaw runtime on ports 5173/3456).
2. Ran `node scripts/capture-baseline-screenshots.mjs` for all three target resolutions.
3. Used `scripts/measure-layout.mjs` to verify stage/panel dimensions.
4. Compared generated screenshots against `design-system.md` tokens and the approved high-fidelity preview.

## Findings and fixes

### 1. Focus mode indicator used wrong color for pending approvals

**Finding:** In `apps/demo-office/src/App.tsx`, the Focus overlay rendered the pending-approval count with the success color (`focus-indicator__num--success`). The design system maps pending approvals to `--urgency`.

**Fix:** Changed the pending count class to `focus-indicator__num--urgency` and added the corresponding CSS rule in `apps/demo-office/src/theme.css`.

### 2. List view used hardcoded colors outside the design system

**Finding:** `apps/demo-office/src/ListView.tsx` used legacy hex values (`#111122`, `#88ccff`, `#ffcc00`, `#ff6666`, etc.) that do not match the approved tokens.

**Fix:** Updated all inline styles and status-color helpers to use the exact hex equivalents of the design tokens:
- Backgrounds: `--base-850` (#161418), `--base-800` (#1a181c)
- Text: `--base-100` (#f2f0eb), `--base-300` (#b8b0bc), `--base-400` (#7d7682)
- Borders: `--base-500` (#4a444e)
- Status colors: `--info` (#7ec0c8), `--urgency` (#e6a85c), `--success` (#7db68a), `--failure` (#c96a5b)
- Replaced Chinese-only summary labels with bilingual "Pending" / "Blocked" labels consistent with the rest of the panel.

### 3. Canvas background color did not match the app shell

**Finding:** The PixiJS renderer background was `#1a1a2e`, while the surrounding `.app-stage` and `.app-canvas` CSS use `--base-850` (#161418). This created a visible seam when the canvas did not perfectly fill the stage.

**Fix:** Set Pixi `backgroundColor` to `0x161418` in `packages/pixel-office/src/office-scene.ts`.

### 4. Canvas text did not follow the design-system font/size rules

**Finding:** Room labels and overlays used `fontFamily: "monospace"` and agent status text was 8 px, below the operational readability threshold and inconsistent with the design system's `--font-pixel` / `--font-ui` guidance.

**Fix:**
- Room labels: 10 px `"Press Start 2P", monospace`, fill `--base-300` (#b8b0bc).
- Agent name/status: 10 px `Inter, system-ui, sans-serif`, fills `--base-100` / `--base-300`.
- Approval/blocked overlays: updated to `--urgency` / `--failure` token colors and readable fonts.

### 5. Debrief timeline showed chronology without outcomes

**Finding:** `apps/demo-office/src/DebriefTimeline.tsx` displayed only time, sequence, and event type. The design brief requires Debrief mode to surface "chronology and outcomes".

**Fix:** Added outcome badges for terminal event types (`task.completed`, `task.blocked`, `task.failed`, `approval.approved`, `approval.rejected`, `artifact.delivered`, `artifact.rejected`). Badges use the existing badge color semantics (success / failure / info) and are styled in `theme.css`.

### 6. Unit test regression after responsive scaling change

**Finding:** `packages/pixel-office/src/__tests__/office-scene.test.ts` expected the room layer to be `app.stage.children[0]`. After adding the responsive `contentRoot` wrapper, that assertion returned the wrapper container and failed.

**Fix:** Updated the test to access `scene.contentRoot.children[0]` (the actual `roomLayer`). Also removed the now-unused `MockApplication` import.

### 7. Layered sprite renderer colors were not token-aligned

**Finding:** The Stage 4/5 layered renderers (`agent-renderer.ts`, `room-renderer.ts`, `effect-renderer.ts`, `prop-renderer.ts`) used cold/high-saturation hardcoded colors and `monospace` fonts, diverging from `design-system.md`.

**Fix:**
- Created `packages/pixel-office/src/design-tokens.ts` as a single source of truth for Pixi hex mirrors.
- Aligned role colors: Orchestrator=`--info`, Worker=`--urgency`, Reviewer=`#b8a8d8`.
- Aligned status colors to the same mapping used by the legacy renderer.
- Shifted room floor colors to the warm palette (`--warm-700`, `--warm-500`, warm red/green).
- Updated effect colors (blocked marker=`--failure`, sparkle/bell=`--urgency`).
- Switched renderer labels to `Inter` / `"Press Start 2P"` at design-system sizes.

### 8. Legacy renderer drew agent body by status instead of role

**Finding:** In `office-scene.ts` the procedural agent square was filled with the status color, while the design system specifies role-based body color with status as an indicator/accent.

**Fix:** Agent square now fills with `ROLE_COLORS[role]` and strokes with `STATUS_COLORS[status]`.

### 9. Effect layer only refreshed when approvals were pending

**Finding:** `office-scene.ts` called `effectRenderer.render()` only when `pendingApprovals.length > 0`, which meant blocked-marker pulses and working sparkles froze when no approval was active.

**Fix:** `effectRenderer.render()` is now called on every update tick when the sprite renderer is active; `reduceMotion` is respected internally.

### 10. Startup / error splash used legacy palette

**Finding:** `apps/demo-office/src/main.tsx` hardcoded `#1a1a2e`, `#88ccff`, `#ff6666`, and `#888` for the connecting and error screens.

**Fix:** Replaced with `--base-900`, `--info`, `--failure`, and `--base-400` CSS custom properties.

### 11. Screenshot script error-state comment was inaccurate

**Finding:** The comment for scenario 08 claimed the forced session error moved the session to `"failed" or "degraded"` and surfaced Retry/Reload.

**Fix:** Comment now correctly describes the runtime behavior: injected `runtime_mismatch` → `degraded` → Resynchronize.

## Layout verification

Measured via `scripts/measure-layout.mjs`:

| Resolution | Stage (px) | Panel (px) | Notes |
|------------|------------|------------|-------|
| 1366×768 | 986×696 | 380×696 | Panel shrinks to 380 px as designed |
| 1440×900 | 1020×828 | 420×828 | Standard 420 px panel |
| 1920×1080 | 1500×1008 | 420×1008 | Standard 420 px panel |

Canvas fills the stage at all three resolutions; no stretching or misalignment detected.

## Remaining known limitations (accepted)

The following are within the agreed V1 scope and are not treated as regressions:

- **Procedural renderer:** Rooms are still flat colored rectangles; the sprite renderer exists but is disabled by default per the V1 asset minimization constraint.
- **Agent silhouettes:** Agents are still 32×32 squares with role conveyed by text label; full role sprites are out of V1 scope.
- **List view density:** The list view remains a dense dashboard; only its color system was aligned.

## Acceptance criteria status

- [x] All 8 new screenshots generated at 1920×1080.
- [x] Screenshots also generated at 1366×768 and 1440×900.
- [x] Screenshot script runs successfully.
- [x] Visual discrepancies documented and fixed.
- [x] Existing remote golden-flow tests pass.
- [x] All unit tests pass (399 / 399).
- [x] `npm run build` succeeds.

## Commands run

```bash
node scripts/dev-remote-demo.mjs        # in background
node scripts/capture-baseline-screenshots.mjs
node scripts/measure-layout.mjs
npm test
npm run build
```
