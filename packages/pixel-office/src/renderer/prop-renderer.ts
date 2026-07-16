/**
 * PropRenderer — 渲染房间内的道具（桌子、工作台、椅子、柜子、指示牌）。
 */
import { Container, Graphics, Text, TextStyle, Sprite } from "pixi.js";
import type { IntegrationProjection } from "@agent-office/control-ui/integration";
import { createDefaultLayout } from "../layout.js";
import type { RoomLayout, RoomProp, RoomLayoutEntry } from "../layout.js";
import type { AssetLoader } from "../asset-loader.js";

const PROP_COLORS: Record<string, number> = {
  desk: 0x8b5a2b,     // warm wood
  workbench: 0x5a6a6a, // muted teal-gray
  chair: 0x3a2a1a,    // dark wood
  cabinet: 0x5a4a3a,  // medium wood
  signpost: 0xa07040, // warm tan
};

const APPROVAL_PROP_COLORS = {
  counter: 0x8b5a2b,      // warm wood
  bell: 0xe6a85c,         // --urgency
  packageSlot: 0x3d3530,  // --warm-700
  sconce: 0xa07040,       // warm tan
  sconceGlow: 0xe6a85c,   // --urgency
};

const PROP_TEXTURE_NAMES: Record<string, string | null> = {
  desk: "desk-shared",
  workbench: "workbench",
  chair: null,
  cabinet: null,
  signpost: null,
};

export class PropRenderer {
  private currentLayout?: RoomLayout;
  private integrationSprites: Record<string, Sprite> = {};

  constructor(
    private layer: Container,
    private assetLoader?: AssetLoader
  ) {}

  render(layout: RoomLayout, pendingApprovalsCount = 0): void {
    this.currentLayout = layout;
    this.integrationSprites = {};
    this.layer.removeChildren();

    for (const room of layout.rooms) {
      for (const prop of room.props) {
        this.drawProp(prop, room);
      }
      if (room.floorType === "approval_delivery" && pendingApprovalsCount > 0) {
        this.drawApprovalRoomProps(room);
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

  private drawApprovalRoomProps(room: RoomLayoutEntry): void {
    const g = new Graphics();
    const cx = room.x + room.width / 2;
    const counterY = room.y + room.height - 52;

    // Service bell on the counter
    const bellX = cx;
    const bellY = counterY + 4;
    g.circle(bellX, bellY, 6)
      .fill({ color: APPROVAL_PROP_COLORS.bell, alpha: 0.9 })
      .stroke({ color: 0x1a181c, width: 1 });
    g.rect(bellX - 2, bellY - 4, 4, 3).fill({ color: 0xf2f0eb, alpha: 0.8 });

    // Package slot on the right wall
    const slotW = 10;
    const slotH = 28;
    const slotX = room.x + room.width - slotW - 18;
    const slotY = room.y + 56;
    g.rect(slotX, slotY, slotW, slotH)
      .fill({ color: APPROVAL_PROP_COLORS.packageSlot })
      .stroke({ color: 0x6b5f56, width: 1 });
    g.rect(slotX + 2, slotY + 4, slotW - 4, 4).fill({ color: 0x1a181c });

    // Wall sconce on the left wall
    const sconceX = room.x + 20;
    const sconceY = room.y + 36;
    g.rect(sconceX, sconceY, 14, 8)
      .fill({ color: APPROVAL_PROP_COLORS.sconce })
      .stroke({ color: 0x1a181c, width: 1 });
    g.circle(sconceX + 7, sconceY + 4, 3)
      .fill({ color: APPROVAL_PROP_COLORS.sconceGlow, alpha: 0.7 })
      .stroke({ color: 0xe6a85c, width: 1 });

    this.layer.addChild(g);
  }

  updateIntegration(integration: IntegrationProjection): void {
    const layout = this.currentLayout ?? createDefaultLayout();

    const commandRoom = layout.rooms.find((r) => r.floorType === "command");
    const reviewRoom = layout.rooms.find((r) => r.floorType === "review");

    const hasQueue =
      (integration.github?.issues.length ?? 0) + (integration.github?.pulls.length ?? 0) > 0;
    if (commandRoom) {
      this.ensureProp("mission-board", hasQueue, commandRoom.x + 80, commandRoom.y + 20);
    }

    const assignedCount = integration.reviews?.assigned.length ?? 0;
    if (reviewRoom) {
      this.ensureProp("review-desk", assignedCount > 0, reviewRoom.x + 48, reviewRoom.y + 24);
    }

    const hasEvidence = (integration.github?.auditNotes.length ?? 0) > 0;
    if (commandRoom) {
      this.ensureProp("filing-cabinet", hasEvidence, commandRoom.x + 16, commandRoom.y + 40);
    }

    const hasTimeline = integration.reviews !== null || integration.github !== null;
    this.ensureProp("wall-scroll", hasTimeline, 48, 16);
  }

  private ensureProp(name: string, visible: boolean, x: number, y: number): void {
    if (!this.assetLoader) return;

    if (visible && !this.integrationSprites[name]) {
      const texture = this.assetLoader.getTexture(name);
      if (!texture) return;

      const sprite = new Sprite(texture);
      sprite.x = x;
      sprite.y = y;
      this.layer.addChild(sprite);
      this.integrationSprites[name] = sprite;
    } else if (!visible && this.integrationSprites[name]) {
      this.layer.removeChild(this.integrationSprites[name]);
      delete this.integrationSprites[name];
    }
  }

  getPropCount(): number {
    return this.layer.children.length;
  }

  getIntegrationSpriteNames(): string[] {
    return Object.keys(this.integrationSprites);
  }
}
