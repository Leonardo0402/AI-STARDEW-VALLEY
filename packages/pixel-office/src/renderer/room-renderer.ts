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

const WALL_COLOR = 0x3d3530; // --warm-700
const SIGN_COLOR = 0x6b5f56; // --warm-500
const SIGN_BORDER_COLOR = 0x3d3530; // --warm-700
const SIGN_WIDTH = 150;
const SIGN_HEIGHT = 18;
const HIGHLIGHT_COLOR = 0xe6a85c;

export class RoomRenderer {
  private selectedIds = new Set<string>();

  constructor(
    private layer: Container,
    private assetLoader?: AssetLoader
  ) {}

  selectRoom(roomId: string): void {
    this.selectedIds.add(roomId);
  }

  clearSelection(): void {
    this.selectedIds.clear();
  }

  getSelectedIds(): Set<string> {
    return new Set(this.selectedIds);
  }

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

    if (this.selectedIds.has(room.roomId)) {
      g.rect(room.x - 2, room.y - 2, room.width + 4, room.height + 4)
        .stroke({ color: HIGHLIGHT_COLOR, width: 4 });
    }

    this.drawFloorPattern(g, room, patternColor, floorTexture ? 0.2 : 0.35);
    this.drawWalls(g, room, WALL_COLOR);
    this.drawSign(g, room, SIGN_COLOR);

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

  private drawWalls(g: Graphics, room: RoomLayoutEntry, color: number): void {
    g.moveTo(room.x, room.y)
      .lineTo(room.x + room.width, room.y)
      .stroke({ color, width: 2 });
    g.moveTo(room.x, room.y)
      .lineTo(room.x, room.y + room.height)
      .stroke({ color, width: 2 });
  }

  private drawSign(g: Graphics, room: RoomLayoutEntry, color: number): void {
    g.rect(room.x + 4, room.y + 2, SIGN_WIDTH, SIGN_HEIGHT)
      .fill({ color })
      .stroke({ color: SIGN_BORDER_COLOR, width: 1 });
  }

  private drawFloorPattern(
    g: Graphics,
    room: RoomLayoutEntry,
    color: number,
    alpha: number
  ): void {
    switch (room.floorType) {
      case "command":
        this.drawWoodPlanks(g, room, color, alpha);
        break;
      case "execution":
        this.drawConcreteTiles(g, room, color, alpha);
        break;
      case "review":
        this.drawRug(g, room, color, alpha);
        break;
      case "approval_delivery":
        this.drawPolishedWood(g, room, color, alpha);
        break;
      default:
        this.drawStripes(g, room, color, alpha);
    }
  }

  private drawWoodPlanks(g: Graphics, room: RoomLayoutEntry, color: number, alpha: number): void {
    const plankHeight = 20;
    for (let y = room.y + plankHeight; y < room.y + room.height; y += plankHeight) {
      g.moveTo(room.x + 4, y)
        .lineTo(room.x + room.width - 4, y)
        .stroke({ color, width: 1, alpha });
    }
    for (let x = room.x + 40; x < room.x + room.width; x += 60) {
      let offset = 0;
      for (let y = room.y + 4; y < room.y + room.height; y += plankHeight * 2) {
        offset = (offset + plankHeight) % (plankHeight * 2);
        const startY = y + offset;
        const endY = startY + plankHeight;
        if (startY < room.y + room.height - 4 && endY < room.y + room.height - 4) {
          g.moveTo(x, startY).lineTo(x, endY).stroke({ color, width: 1, alpha });
        }
      }
    }
  }

  private drawConcreteTiles(g: Graphics, room: RoomLayoutEntry, color: number, alpha: number): void {
    const tileSize = 40;
    for (let y = room.y + tileSize; y < room.y + room.height; y += tileSize) {
      g.moveTo(room.x + 4, y)
        .lineTo(room.x + room.width - 4, y)
        .stroke({ color, width: 1, alpha });
    }
    for (let x = room.x + tileSize; x < room.x + room.width; x += tileSize) {
      g.moveTo(x, room.y + 4)
        .lineTo(x, room.y + room.height - 4)
        .stroke({ color, width: 1, alpha });
    }
    // Deterministic scuff marks at grid intersections.
    const intersections: Array<[number, number]> = [];
    for (let x = room.x + tileSize; x < room.x + room.width; x += tileSize) {
      for (let y = room.y + tileSize; y < room.y + room.height; y += tileSize) {
        intersections.push([x, y]);
      }
    }
    for (let i = 0; i < intersections.length; i += 3) {
      const [cx, cy] = intersections[i];
      g.moveTo(cx - 4, cy - 2)
        .lineTo(cx + 2, cy + 4)
        .stroke({ color, width: 1, alpha: alpha * 0.7 });
    }
  }

  private drawRug(g: Graphics, room: RoomLayoutEntry, color: number, alpha: number): void {
    const border = 8;
    g.rect(room.x + border, room.y + border, room.width - border * 2, room.height - border * 2)
      .stroke({ color, width: 2, alpha });
    const cx = room.x + room.width / 2;
    const cy = room.y + room.height / 2;
    g.moveTo(room.x + border + 4, cy)
      .lineTo(room.x + room.width - border - 4, cy)
      .stroke({ color, width: 1, alpha: alpha * 0.8 });
    g.moveTo(cx, room.y + border + 4)
      .lineTo(cx, room.y + room.height - border - 4)
      .stroke({ color, width: 1, alpha: alpha * 0.8 });
  }

  private drawPolishedWood(g: Graphics, room: RoomLayoutEntry, color: number, alpha: number): void {
    const plankHeight = 16;
    for (let y = room.y + plankHeight; y < room.y + room.height; y += plankHeight) {
      g.moveTo(room.x + 4, y)
        .lineTo(room.x + room.width - 4, y)
        .stroke({ color, width: 1, alpha });
      const highlightY = y + Math.floor(plankHeight / 2);
      if (highlightY < room.y + room.height - 4) {
        g.moveTo(room.x + 4, highlightY)
          .lineTo(room.x + room.width - 4, highlightY)
          .stroke({ color: 0xa89788, width: 1, alpha: alpha * 0.6 });
      }
    }
  }

  private drawStripes(g: Graphics, room: RoomLayoutEntry, color: number, alpha: number): void {
    const step = 20;
    for (let y = room.y + step; y < room.y + room.height; y += step) {
      g.moveTo(room.x + 4, y)
        .lineTo(room.x + room.width - 4, y)
        .stroke({ color, width: 1, alpha });
    }
  }
}
