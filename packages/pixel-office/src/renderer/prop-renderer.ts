/**
 * PropRenderer — 渲染房间内的道具（桌子、工作台、椅子、柜子、指示牌）。
 */
import { Container, Graphics, Text, TextStyle, Sprite } from "pixi.js";
import type { RoomLayout, RoomProp, RoomLayoutEntry } from "../layout.js";
import type { AssetLoader } from "../asset-loader.js";

const PROP_COLORS: Record<string, number> = {
  desk: 0x8b5a2b,     // warm wood
  workbench: 0x5a6a6a, // muted teal-gray
  chair: 0x3a2a1a,    // dark wood
  cabinet: 0x5a4a3a,  // medium wood
  signpost: 0xa07040, // warm tan
};

const PROP_TEXTURE_NAMES: Record<string, string | null> = {
  desk: "desk-shared",
  workbench: "workbench",
  chair: null,
  cabinet: null,
  signpost: null,
};

export class PropRenderer {
  constructor(
    private layer: Container,
    private assetLoader?: AssetLoader
  ) {}

  render(layout: RoomLayout): void {
    this.layer.removeChildren();

    for (const room of layout.rooms) {
      for (const prop of room.props) {
        this.drawProp(prop, room);
      }
    }
  }

  private drawProp(prop: RoomProp, room: RoomLayoutEntry): void {
    const textureName = this.resolvePropTextureName(prop, room);
    const texture = textureName ? this.assetLoader?.getTexture(textureName) : null;

    if (texture) {
      const sprite = new Sprite(texture);
      sprite.x = prop.x;
      sprite.y = prop.y;
      sprite.width = prop.width;
      sprite.height = prop.height;
      this.layer.addChild(sprite);
      return;
    }

    const color = PROP_COLORS[prop.type] ?? 0x7d7682; // --base-400 fallback
    const g = new Graphics();

    g.rect(prop.x, prop.y, prop.width, prop.height)
      .fill({ color, alpha: 0.8 })
      .stroke({ color: 0x1a181c, width: 1 });

    // 工作台增加一条顶边高光，模拟台面
    if (prop.type === "workbench") {
      g.moveTo(prop.x, prop.y + 4)
        .lineTo(prop.x + prop.width, prop.y + 4)
        .stroke({ color: 0x7ec0c8, width: 2, alpha: 0.4 });
    }

    // 指示牌增加小标牌
    if (prop.type === "signpost") {
      g.rect(prop.x - 8, prop.y + 8, prop.width + 16, 12)
        .fill({ color: 0xf2f0eb, alpha: 0.9 })
        .stroke({ color: 0x1a181c, width: 1 });

      const label = new Text({
        text: "APPROVAL",
        style: new TextStyle({ fontSize: 7, fill: 0x1a181c, fontFamily: "Inter, system-ui, sans-serif" }),
      });
      label.x = prop.x + prop.width / 2;
      label.y = prop.y + 13;
      label.anchor.set(0.5, 0.5);
      this.layer.addChild(label);
    }

    this.layer.addChild(g);
  }

  private resolvePropTextureName(prop: RoomProp, room: RoomLayoutEntry): string | null {
    if (prop.type === "desk") {
      if (room.floorType === "review") return "review-table";
      if (room.floorType === "approval_delivery") return "approval-counter";
      return "desk-shared";
    }
    return PROP_TEXTURE_NAMES[prop.type] ?? null;
  }
}
