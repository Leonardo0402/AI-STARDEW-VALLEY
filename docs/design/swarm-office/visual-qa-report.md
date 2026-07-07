# Swarm Office — Visual QA Report (PR #13 P0/P1 fixes)

> Generated: 2026-07-05
> Comparison target: `high-fidelity-designs-preview.png` + `design-system.md`
> Screenshot source: `scripts/capture-baseline-screenshots.mjs`
> Resolutions verified: 1366×768, 1440×900, 1920×1080
> Renderer: layered sprite renderer (default)

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
2. Confirmed the layered sprite renderer is the default presentation path (`PixelOfficeScene` defaults `useSpriteRenderer` to `true`).
3. Ran `node scripts/capture-baseline-screenshots.mjs` for all three target resolutions.
4. Used `scripts/measure-layout.mjs` to verify stage/panel dimensions.
5. Compared generated screenshots against `design-system.md` tokens and the approved high-fidelity preview.

## P0/P1 fixes verified

### 1. Layered sprite renderer is now the default application path

`PixelOfficeScene` defaults `useSpriteRenderer` to `true`. The demo-office `dev` and `build` scripts run `copy-pixel-assets` first, so the V1 room, prop, agent, and effect sprites are copied to `public/assets` and served in both dev and production preview. The legacy procedural renderer remains available when `useSpriteRenderer: false` is passed explicitly.

### 2. Approval presentation state derives from `RoomView.type`

`computeAgentPresentationState()` now resolves the agent's current room through `projection.rooms.find(room => room.roomId === agent.currentRoomId)` and compares `room.type === "review" || room.type === "approval_delivery"`. Tests cover room IDs that differ from the room type.

### 3. React root is created only once

`bootstrap()` creates the React root once and passes it to `renderStartupError()` and `renderAppComposition()`. Retry and initial configuration-failure paths reuse the same root, eliminating duplicate-root warnings.

### 4. Toggling reduced motion no longer rebuilds the Pixi scene

The scene-creation effect in `App.tsx` depends only on `view`; `reduceMotion` updates are applied through `scene.setReduceMotion()`. Tests assert that toggling Motion on/off does not call `scene.destroy()` or re-instantiate `PixelOfficeScene`.

### 5. Artifact cards no longer show fabricated URIs

`ControlPanel.tsx` now distinguishes:

- real content → renders the content preview;
- real URI → renders the URI;
- `uri === null` → renders "Content unavailable";
- no content/URI → renders "Metadata only — content not loaded." and disables View;
- open failure → shows the error near the View button.

The View button is disabled when the adapter does not report `ARTIFACT_OPEN` in `supportedCommands`.

## Findings and fixes (previous visual QA)

### 6. Focus mode indicator used wrong color for pending approvals

Fixed in `App.tsx`/`theme.css`: pending count now uses `--urgency`.

### 7. List view used hardcoded colors outside the design system

Updated `ListView.tsx` to use design-token hex equivalents.

### 8. Canvas background color did not match the app shell

Pixi `backgroundColor` set to `0x161418` (`--base-850`, documented in design-system.md).

### 9. Canvas text did not follow the design-system font/size rules

Room labels use 10 px `"Press Start 2P"`; agent name/status use 10 px `Inter` with token fills.

### 10. Debrief timeline showed chronology without outcomes

Added outcome badges for terminal event types.

### 11. Unit test regression after responsive scaling change

`office-scene.test.ts` updated to access `scene.contentRoot.children[0]` as the `roomLayer`.

### 12. Layered sprite renderer colors were not token-aligned

Created `design-tokens.ts` and aligned role/status/room/effect colors and fonts.

### 13. Legacy renderer drew agent body by status instead of role

Agent square now fills with `ROLE_COLORS[role]` and strokes with `STATUS_COLORS[status]`.

### 14. Effect layer only refreshed when approvals were pending

`effectRenderer.render()` is now called every tick when the sprite renderer is active; `reduceMotion` is respected internally.

### 15. Startup / error splash used legacy palette

Replaced hardcoded colors with CSS custom properties.

## Layout verification

Measured via `scripts/measure-layout.mjs`:

| Resolution | Stage (px) | Panel (px) | Notes |
|------------|------------|------------|-------|
| 1366×768 | 986×696 | 380×696 | Panel shrinks to 380 px as designed |
| 1440×900 | 1020×828 | 420×828 | Standard 420 px panel |
| 1920×1080 | 1500×1008 | 420×1008 | Standard 420 px panel |

Canvas fills the stage at all three resolutions; no stretching or misalignment detected.

## Remaining known limitations (accepted for V1 / PR #13)

- **V1 pixel art is intentionally placeholder quality.** The sprites are distinguishable by role and state, but they are not final Cozy Pixel illustrations.
- **Room label overlap.** Long room names can overlap adjacent rooms at 1366×768; this is acceptable for V1 and will be addressed in the V1.1 spacing/layout pass.
- **Agent animation set is minimal.** V1 ships with idle/working/walk/blocked frames; approval and paused use the working/blocked frames respectively. Full state-specific frames are V1.1 scope.
- **Scene composition.** Rooms are arranged as a connected 2×2 office, but doors, roads, lighting layers, and depth sorting improvements are reserved for V1.1.
- **List view density.** The list view remains a dense dashboard; only its color system and structure were aligned in V1.

## Acceptance criteria status

- [x] Layered sprite renderer is the default presentation path.
- [x] Approval state derives from `RoomView.type`, not room ID string.
- [x] React root created once; no duplicate-root warnings on startup or retry.
- [x] Reduced-motion toggle updates the existing Pixi scene without rebuild.
- [x] Artifact cards display truthful content states; no fabricated URI.
- [x] All 8 screenshots regenerated with the sprite renderer at 1920×1080.
- [x] Screenshots also regenerated at 1366×768 and 1440×900.
- [x] Screenshot and layout scripts run successfully.
- [x] Visual discrepancies documented and fixes applied.
- [x] Existing remote golden-flow tests pass.
- [x] All unit tests pass (407 / 407).
- [x] `npm run build` succeeds.

## Commands run

```bash
node scripts/dev-remote-demo.mjs        # in background
node scripts/capture-baseline-screenshots.mjs
node scripts/measure-layout.mjs
npm test
npm run build
```
