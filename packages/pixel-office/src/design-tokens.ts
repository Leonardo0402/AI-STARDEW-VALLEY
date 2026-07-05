/**
 * Design tokens for PixiJS renderers.
 *
 * These are the hex equivalents of the CSS custom properties in
 * apps/demo-office/src/theme.css. Pixi cannot read CSS variables at runtime,
 * so we keep a TypeScript mirror for canvas rendering.
 */

export const ROLE_COLORS: Record<string, number> = {
  orchestrator: 0x7ec0c8, // --info
  worker: 0xe6a85c,       // --urgency
  reviewer: 0xb8a8d8,     // reviewer purple
};

export const STATUS_COLORS: Record<string, number> = {
  idle: 0x7d7682,      // --base-400
  planning: 0x7ec0c8,  // --info
  working: 0x7db68a,   // --success
  waiting: 0xe6a85c,   // --urgency
  reviewing: 0xe6a85c, // --urgency (approval context)
  blocked: 0xc96a5b,   // --failure
  paused: 0x7a9cc6,    // --paused
  failed: 0xc96a5b,    // --failure
  offline: 0x4a444e,   // --base-500
};

export const ROOM_COLORS: Record<string, number> = {
  command: 0x3d3530,       // --warm-700 (dark wood planks)
  execution: 0x4a5a4a,     // muted green concrete
  review: 0x6b5f56,        // --warm-500 (warm cork)
  approval_delivery: 0x5a3a3a, // warm red carpet
};
