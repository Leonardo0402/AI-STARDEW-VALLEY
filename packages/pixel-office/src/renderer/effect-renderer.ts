/**
 * EffectRenderer — 渲染阻塞标记、工作状态火花、审批服务铃等覆盖层效果。
 *
 * V1 效果规则：
 * - 每个 presentation state 为 blocked 的 agent 头顶绘制红色阻塞标记。
 * - 每个 presentation state 为 working 的 agent 肩膀上方绘制 sparkle。
 * - 当存在 pendingApprovals 时，在 approval_delivery / review 房间中心绘制服务铃。
 */
import { Container, Graphics, Text, TextStyle, Sprite, Texture } from "pixi.js";
import type { OfficeProjection, AgentView } from "@agent-office/protocol";
import { getAgentPositionByRoomId, type RoomLayout, type RoomLayoutEntry } from "../layout.js";
import type { AssetLoader } from "../asset-loader.js";
import { computeAgentPresentationState } from "../presentation-state.js";

interface EffectItem {
  graphics: Graphics;
  label: Text;
  sprite?: Sprite;
}

export class EffectRenderer {
  private blockedItems: EffectItem[] = [];
  private sparkleItems: EffectItem[] = [];
  private bellItems: EffectItem[] = [];
  private failedItems: EffectItem[] = [];
  private reduceMotion = false;
  private pulsePhase = 0;

  constructor(
    private layer: Container,
    private assetLoader?: AssetLoader,
    reduceMotion?: boolean
  ) {
    this.reduceMotion = reduceMotion ?? false;
  }

  setReduceMotion(value: boolean): void {
    this.reduceMotion = value;
  }

  render(projection: OfficeProjection, layout: RoomLayout, deltaMS = 16.67): void {
    this.pulsePhase += deltaMS;
    const pulse = this.reduceMotion ? 0.5 : (Math.sin(this.pulsePhase / 400) + 1) / 2;

    const failedAgents = projection.agents.filter((a) => a.status === "failed");
    const blockedAgents = projection.agents.filter(
      (a) => computeAgentPresentationState(a, projection) === "blocked" && a.status !== "failed"
    );
    const workingAgents = projection.agents.filter(
      (a) => computeAgentPresentationState(a, projection) === "working"
    );
    const bellRooms =
      projection.pendingApprovals.length > 0
        ? layout.rooms.filter(
            (r) => r.floorType === "approval_delivery" || r.floorType === "review"
          )
        : [];

    const failedCount = this.renderFailedMarkers(failedAgents, layout, pulse);
    this.hideExtras(this.failedItems, failedCount);

    const blockedCount = this.renderBlockedMarkers(blockedAgents, layout, pulse);
    this.hideExtras(this.blockedItems, blockedCount);

    const sparkleCount = this.renderWorkingSparkles(workingAgents, layout, pulse);
    this.hideExtras(this.sparkleItems, sparkleCount);

    const bellCount = this.renderServiceBells(bellRooms, pulse);
    this.hideExtras(this.bellItems, bellCount);
  }

  private renderBlockedMarkers(agents: AgentView[], layout: RoomLayout, pulse: number): number {
    const markerTexture = this.assetLoader?.getTexture("blocked-marker");
    let index = 0;
    for (const agent of agents) {
      const item = this.getItem(this.blockedItems, index++);
      const pos = getAgentPositionByRoomId(
        layout,
        agent.currentRoomId ?? "command",
        this.hashSeed(agent.agentId)
      );
      const x = pos.x;
      const y = pos.y - 18;
      const glowRadius = 18 + pulse * 4;
      const glowAlpha = 0.1 + pulse * 0.15;

      item.graphics.clear();
      item.graphics
        .circle(pos.x, pos.y, glowRadius)
        .fill({ color: 0xc96a5b, alpha: glowAlpha });
      item.graphics.visible = true;

      if (markerTexture) {
        this.ensureSprite(item, markerTexture);
        item.sprite!.x = x;
        item.sprite!.y = y;
        const scale = 0.9 + pulse * 0.2;
        item.sprite!.scale.set(scale, scale);
        item.sprite!.visible = true;
      } else {
        item.graphics.circle(x, y, 6).fill({ color: 0xc96a5b }).stroke({ color: 0x7a332a, width: 2 });
        if (item.sprite) item.sprite.visible = false;
      }

      // Speech-bubble exclamation marker
      const bubbleX = x + 12;
      const bubbleY = y - 10;
      item.graphics
        .circle(bubbleX, bubbleY, 6)
        .fill({ color: 0xc96a5b })
        .stroke({ color: 0x7a332a, width: 1 });
      item.graphics
        .moveTo(bubbleX - 3, bubbleY + 4)
        .lineTo(bubbleX - 6, bubbleY + 9)
        .lineTo(bubbleX, bubbleY + 5)
        .closePath()
        .fill({ color: 0xc96a5b });

      item.label.text = "!";
      item.label.style = new TextStyle({ fontSize: 10, fill: 0xf2f0eb, fontFamily: "Inter, system-ui, sans-serif" });
      item.label.anchor.set(0.5, 0.5);
      item.label.x = bubbleX;
      item.label.y = bubbleY;
      item.label.visible = true;
    }
    return index;
  }

  private renderWorkingSparkles(agents: AgentView[], layout: RoomLayout, pulse: number): number {
    const sparkleTexture = this.assetLoader?.getTexture("sparkle");
    let index = 0;
    for (const agent of agents) {
      const item = this.getItem(this.sparkleItems, index++);
      const pos = getAgentPositionByRoomId(
        layout,
        agent.currentRoomId ?? "command",
        this.hashSeed(agent.agentId)
      );
      const x = pos.x + 8;
      const y = pos.y - 14;

      if (sparkleTexture) {
        this.ensureSprite(item, sparkleTexture);
        item.sprite!.x = x;
        item.sprite!.y = y;
        const scale = 0.8 + pulse * 0.3;
        item.sprite!.scale.set(scale, scale);
        item.sprite!.visible = true;
        item.graphics.visible = false;
        item.label.visible = false;
        continue;
      }

      item.graphics.clear();
      this.drawStar(item.graphics, x, y, 5, 0xe6a85c);
      item.graphics.visible = true;

      item.label.text = "";
      item.label.visible = false;
      if (item.sprite) item.sprite.visible = false;
    }
    return index;
  }

  private renderServiceBells(rooms: RoomLayoutEntry[], pulse: number): number {
    const bellTexture = this.assetLoader?.getTexture("service-bell");
    let index = 0;
    for (const room of rooms) {
      const item = this.getItem(this.bellItems, index++);
      const x = room.x + room.width / 2;
      const y = room.y + 20;
      const glowRadius = 16 + pulse * 6;
      const glowAlpha = 0.15 + pulse * 0.25;

      item.graphics.clear();
      item.graphics
        .circle(x, y, glowRadius)
        .fill({ color: 0xe6a85c, alpha: glowAlpha });
      item.graphics.visible = true;

      if (bellTexture) {
        this.ensureSprite(item, bellTexture);
        item.sprite!.x = x;
        item.sprite!.y = y;
        const scale = 0.9 + pulse * 0.25;
        item.sprite!.scale.set(scale, scale);
        item.sprite!.visible = true;
      } else {
        item.graphics
          .circle(x, y, 10)
          .fill({ color: 0xe6a85c, alpha: 0.5 })
          .stroke({ color: 0xe6a85c, width: 2 });
        if (item.sprite) item.sprite.visible = false;
      }

      item.label.text = bellTexture ? "" : "B";
      item.label.style = new TextStyle({ fontSize: 10, fill: 0x0d0b0f, fontFamily: "Inter, system-ui, sans-serif" });
      item.label.anchor.set(0.5, 0.5);
      item.label.x = x;
      item.label.y = y;
      item.label.visible = !bellTexture;
    }
    return index;
  }

  private renderFailedMarkers(agents: AgentView[], layout: RoomLayout, pulse: number): number {
    let index = 0;
    for (const agent of agents) {
      const item = this.getItem(this.failedItems, index++);
      const pos = getAgentPositionByRoomId(
        layout,
        agent.currentRoomId ?? "command",
        this.hashSeed(agent.agentId)
      );
      const x = pos.x + 12;
      const y = pos.y - 24;
      const glowAlpha = 0.1 + pulse * 0.15;

      item.graphics.clear();
      item.graphics
        .rect(x - 2, y - 2, 12, 12)
        .fill({ color: 0xc96a5b, alpha: glowAlpha });
      item.graphics
        .rect(x, y, 8, 8)
        .fill({ color: 0xc96a5b })
        .stroke({ color: 0x7a332a, width: 1 });
      item.graphics.visible = true;

      item.label.text = "×";
      item.label.style = new TextStyle({ fontSize: 8, fill: 0xf2f0eb, fontFamily: "Inter, system-ui, sans-serif" });
      item.label.anchor.set(0.5, 0.5);
      item.label.x = x + 4;
      item.label.y = y + 4;
      item.label.visible = true;
      if (item.sprite) item.sprite.visible = false;
    }
    return index;
  }

  private getItem(pool: EffectItem[], index: number): EffectItem {
    if (index < pool.length) {
      return pool[index];
    }
    const graphics = new Graphics();
    const label = new Text({
      text: "",
      style: new TextStyle({ fontSize: 10, fill: 0xf2f0eb, fontFamily: "Inter, system-ui, sans-serif" }),
    });
    label.anchor.set(0.5, 0.5);
    this.layer.addChild(graphics);
    this.layer.addChild(label);
    const item: EffectItem = { graphics, label };
    pool.push(item);
    return item;
  }

  private ensureSprite(item: EffectItem, texture: Texture): void {
    if (!item.sprite) {
      item.sprite = new Sprite(texture);
      item.sprite.anchor.set(0.5, 0.5);
      this.layer.addChild(item.sprite);
    } else {
      item.sprite.texture = texture;
    }
  }

  private hideExtras(pool: EffectItem[], count: number): void {
    for (let i = count; i < pool.length; i++) {
      const item = pool[i];
      item.graphics.visible = false;
      item.label.visible = false;
      if (item.sprite) item.sprite.visible = false;
    }
  }

  private drawStar(g: Graphics, x: number, y: number, radius: number, color: number): void {
    // 简化的四芒星
    g.moveTo(x, y - radius)
      .lineTo(x + radius * 0.3, y - radius * 0.3)
      .lineTo(x + radius, y)
      .lineTo(x + radius * 0.3, y + radius * 0.3)
      .lineTo(x, y + radius)
      .lineTo(x - radius * 0.3, y + radius * 0.3)
      .lineTo(x - radius, y)
      .lineTo(x - radius * 0.3, y - radius * 0.3)
      .closePath()
      .fill({ color });
  }

  private hashSeed(agentId: string): number {
    return agentId.charCodeAt(agentId.length - 1);
  }
}
