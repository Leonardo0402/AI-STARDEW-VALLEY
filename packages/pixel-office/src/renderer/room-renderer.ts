/**
 * RoomRenderer — 渲染房间地板、边框和木质标牌。
 */
import { Container, Graphics, Text, TextStyle, Sprite } from "pixi.js";
import type { RoomLayout, RoomLayoutEntry } from "../layout.js";
import type { AssetLoader } from "../asset-loader.js";
import { ROOM_COLORS as FLOOR_COLORS } from "../design-tokens.js";

const FLOOR_PATTERN_COLORS: Record<string, number> = {
  command: 0x4d4540,
  execution: 0x5a6a5a,
  review: 0x7b6f66,
  approval_delivery: 0x6a4a4a,
};

const FLOOR_TEXTURE_NAMES: Record<string, string> = {
  command: "floor-command",
  execution: "floor-execution",
  review: "floor-review",
  approval_delivery: "floor-approval",
};

export class RoomRenderer {
  constructor(
    private layer: Container,
    private assetLoader?: AssetLoader
  ) {}

  render(layout: RoomLayout): void {
    this.layer.removeChildren();

    for (const room of layout.rooms) {
      this.drawRoom(room);
    }
  }

  private drawRoom(room: RoomLayoutEntry): void {
    const baseColor = FLOOR_COLORS[room.floorType] ?? 0x25222a; // --base-700 fallback
    const patternColor = FLOOR_PATTERN_COLORS[room.floorType] ?? 0x35323a;
    const floorTextureName = FLOOR_TEXTURE_NAMES[room.floorType];
    const floorTexture = floorTextureName ? this.assetLoader?.getTexture(floorTextureName) : null;

    if (floorTexture) {
      const floor = new Sprite(floorTexture);
      floor.x = room.x;
      floor.y = room.y;
      floor.width = room.width;
      floor.height = room.height;
      this.layer.addChild(floor);
    }

    const g = new Graphics();
    g.rect(room.x, room.y, room.width, room.height)
      .fill({ color: baseColor, alpha: floorTexture ? 0.15 : 0.4 })
      .stroke({ color: baseColor, width: 3 });

    if (!floorTexture) {
      this.drawFloorPattern(g, room, patternColor);
    }

    const label = new Text({
      text: room.name,
      style: new TextStyle({
        fontSize: 10,
        fill: 0xf2f0eb,
        fontFamily: '"Press Start 2P", monospace',
        fontWeight: "bold",
      }),
    });
    label.x = room.x + 8;
    label.y = room.y + 4;

    this.layer.addChild(g);
    this.layer.addChild(label);
  }

  private drawFloorPattern(g: Graphics, room: RoomLayoutEntry, color: number): void {
    const step = 20;
    for (let y = room.y + step; y < room.y + room.height; y += step) {
      g.moveTo(room.x + 4, y)
        .lineTo(room.x + room.width - 4, y)
        .stroke({ color, width: 1, alpha: 0.3 });
    }
  }
}
