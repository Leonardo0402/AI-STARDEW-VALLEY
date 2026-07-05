import { describe, it, expect } from "vitest";
import { createDefaultLayout, getAgentPositionByRoomId } from "../layout.js";

describe("createDefaultLayout", () => {
  it("places four rooms with distinct ids and floor types", () => {
    const layout = createDefaultLayout();
    expect(layout.rooms).toHaveLength(4);
    const ids = layout.rooms.map((r) => r.roomId);
    expect(ids).toEqual(["command", "execution", "review", "approval_delivery"]);

    const types = layout.rooms.map((r) => r.floorType);
    expect(new Set(types).size).toBe(4);
  });

  it("places command room at the top-left quadrant", () => {
    const layout = createDefaultLayout();
    const command = layout.rooms.find((r) => r.roomId === "command")!;
    expect(command.x).toBe(40);
    expect(command.y).toBe(40);
    expect(command.width).toBe(340);
    expect(command.height).toBe(240);
  });

  it("places execution room at the top-right quadrant", () => {
    const layout = createDefaultLayout();
    const execution = layout.rooms.find((r) => r.roomId === "execution")!;
    expect(execution.x).toBe(420);
    expect(execution.y).toBe(40);
    expect(execution.width).toBe(340);
    expect(execution.height).toBe(240);
  });

  it("places review room at the bottom-left quadrant", () => {
    const layout = createDefaultLayout();
    const review = layout.rooms.find((r) => r.roomId === "review")!;
    expect(review.x).toBe(40);
    expect(review.y).toBe(320);
    expect(review.width).toBe(340);
    expect(review.height).toBe(240);
  });

  it("places approval_delivery room at the bottom-right quadrant", () => {
    const layout = createDefaultLayout();
    const approval = layout.rooms.find((r) => r.roomId === "approval_delivery")!;
    expect(approval.x).toBe(420);
    expect(approval.y).toBe(320);
    expect(approval.width).toBe(340);
    expect(approval.height).toBe(240);
  });

  it("includes props for each room", () => {
    const layout = createDefaultLayout();
    for (const room of layout.rooms) {
      expect(room.props.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("getAgentPositionByRoomId", () => {
  const layout = createDefaultLayout();

  it("returns the room center when no seed is provided", () => {
    const pos = getAgentPositionByRoomId(layout, "command");
    expect(pos.x).toBe(40 + 340 / 2);
    expect(pos.y).toBe(40 + 240 / 2);
  });

  it("deterministically offsets position from the seed", () => {
    const posA = getAgentPositionByRoomId(layout, "execution", 0);
    const posB = getAgentPositionByRoomId(layout, "execution", 1);
    expect(posA.x).not.toBe(posB.x);
    expect(posA.y).not.toBe(posB.y);
  });

  it("returns a fallback position for unknown rooms", () => {
    const pos = getAgentPositionByRoomId(layout, "unknown-room");
    expect(pos.x).toBe(400);
    expect(pos.y).toBe(300);
  });
});
