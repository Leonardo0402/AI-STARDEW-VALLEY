/**
 * RoomLayout — 将 roomId 映射到位置、地板类型和道具列表。
 *
 * 这是 Stage 4 新增的纯数据结构，用于驱动 room 和 prop 渲染器。
 * 它只描述视觉布局，不保存 Runtime 真相状态。
 */
import type { RoomType } from "@agent-office/protocol";

export type PropType = "desk" | "workbench" | "chair" | "cabinet" | "signpost";

export interface RoomProp {
  propId: string;
  type: PropType;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoomLayoutEntry {
  roomId: string;
  name: string;
  floorType: RoomType;
  x: number;
  y: number;
  width: number;
  height: number;
  props: RoomProp[];
}

export interface RoomLayout {
  rooms: RoomLayoutEntry[];
}

export interface Position {
  x: number;
  y: number;
}

const ROOM_NAMES: Record<RoomType, string> = {
  command: "Command Center",
  execution: "Execution Bay",
  review: "Review Chamber",
  approval_delivery: "Approval Hall",
};

// TODO(Stage 7): 这些边界当前硬编码为 1280×720 画布下的四等分布局。
// 在响应式缩放阶段，应根据实际 canvas 尺寸推导边界，而不是使用固定坐标。
const DEFAULT_ROOM_BOUNDS: Record<RoomType, { x: number; y: number; width: number; height: number }> = {
  command: { x: 40, y: 40, width: 340, height: 240 },
  execution: { x: 420, y: 40, width: 340, height: 240 },
  review: { x: 40, y: 320, width: 340, height: 240 },
  approval_delivery: { x: 420, y: 320, width: 340, height: 240 },
};

function createPropsForRoom(type: RoomType, bx: number, by: number, bw: number, bh: number): RoomProp[] {
  const cx = bx + bw / 2;
  const cy = by + bh / 2;

  switch (type) {
    case "command":
      return [
        { propId: "command-desk", type: "desk", x: cx - 60, y: cy - 20, width: 120, height: 40 },
        { propId: "command-chair", type: "chair", x: cx - 10, y: cy + 25, width: 20, height: 20 },
      ];
    case "execution":
      return [
        { propId: "exec-bench-1", type: "workbench", x: bx + 20, y: cy - 30, width: 100, height: 30 },
        { propId: "exec-bench-2", type: "workbench", x: bx + bw - 120, y: cy - 30, width: 100, height: 30 },
        { propId: "exec-cabinet", type: "cabinet", x: cx - 25, y: by + bh - 50, width: 50, height: 40 },
      ];
    case "review":
      return [
        { propId: "review-table", type: "desk", x: cx - 70, y: cy - 25, width: 140, height: 50 },
        { propId: "review-chair-1", type: "chair", x: cx - 50, y: cy + 35, width: 20, height: 20 },
        { propId: "review-chair-2", type: "chair", x: cx + 30, y: cy + 35, width: 20, height: 20 },
      ];
    case "approval_delivery":
      return [
        { propId: "approval-signpost", type: "signpost", x: cx - 10, y: by + 20, width: 20, height: 60 },
        { propId: "approval-desk", type: "desk", x: cx - 50, y: by + bh - 60, width: 100, height: 40 },
      ];
  }
}

export function createDefaultLayout(): RoomLayout {
  const rooms: RoomLayoutEntry[] = (Object.keys(DEFAULT_ROOM_BOUNDS) as RoomType[]).map((type) => {
    const bounds = DEFAULT_ROOM_BOUNDS[type];
    return {
      roomId: type,
      name: ROOM_NAMES[type],
      floorType: type,
      ...bounds,
      props: createPropsForRoom(type, bounds.x, bounds.y, bounds.width, bounds.height),
    };
  });

  return { rooms };
}

/**
 * 根据投影中的房间边界创建 RoomLayout，确保 props 位置随边界同步重新计算。
 */
export function createLayoutFromRoomViews(
  rooms: Array<{
    roomId: string;
    name: string;
    type: RoomType;
    bounds: { x: number; y: number; width: number; height: number };
  }>
): RoomLayout {
  return {
    rooms: rooms.map((room) => ({
      roomId: room.roomId,
      name: room.name,
      floorType: room.type,
      x: room.bounds.x,
      y: room.bounds.y,
      width: room.bounds.width,
      height: room.bounds.height,
      props: createPropsForRoom(room.type, room.bounds.x, room.bounds.y, room.bounds.width, room.bounds.height),
    })),
  };
}

export function getAgentPositionByRoomId(layout: RoomLayout, roomId: string, seed = 0): Position {
  const room = layout.rooms.find((r) => r.roomId === roomId);
  if (!room) {
    return { x: 400, y: 300 };
  }

  const cx = room.x + room.width / 2;
  const cy = room.y + room.height / 2;

  if (seed === 0) {
    return { x: cx, y: cy };
  }

  // 基于 seed 的确定性偏移，让同一房间内的多个 agent 不会完全重叠
  const hash = Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1;
  const offsetX = (hash * 2 - 1) * (room.width * 0.25);
  const offsetY = (Math.abs(Math.cos(seed * 78.233)) * 2 - 1) * (room.height * 0.25);
  return { x: cx + offsetX, y: cy + offsetY };
}
