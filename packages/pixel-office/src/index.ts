export { PixelOfficeScene, type PixelOfficeSceneOptions } from "./office-scene.js";
export {
  RoomRenderer,
  PropRenderer,
  AgentRenderer,
  EffectRenderer,
  resolveAgentTreatment,
  type AgentVisualTreatment,
} from "./renderer/index.js";
export {
  computeAgentPresentationState,
  type AgentPresentationState,
} from "./presentation-state.js";
export {
  createDefaultLayout,
  createLayoutFromRoomViews,
  getAgentPositionByRoomId,
  type RoomLayout,
  type RoomLayoutEntry,
  type RoomProp,
  type Position,
  type PropType,
} from "./layout.js";
