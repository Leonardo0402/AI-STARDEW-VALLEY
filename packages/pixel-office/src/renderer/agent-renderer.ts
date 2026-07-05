/**
 * AgentRenderer — 根据 agent 的 currentRoomId 渲染角色。
 *
 * AgentSprite 抽象将 agentId + role + 展示状态映射到视觉处理。
 * Stage 4 使用程序化色块/形状；Stage 5 接入精灵纹理并支持行走动画。
 */
import { Container, Graphics, Text, TextStyle, Sprite, Texture } from "pixi.js";
import type { AgentView, OfficeProjection } from "@agent-office/protocol";
import { getAgentPositionByRoomId, type RoomLayout } from "../layout.js";
import type { AssetLoader } from "../asset-loader.js";
import { computeAgentPresentationState, type AgentPresentationState } from "../presentation-state.js";
import { ROLE_COLORS, STATUS_COLORS } from "../design-tokens.js";

export interface AgentSprite {
  container: Container;
  nameText: Text;
  statusText: Text;
  agentId: string;
  role: string;
  treatment: AgentVisualTreatment;
  currentState: AgentPresentationState;
  currentTexture: Texture | null;
  walkFrames: Texture[] | null;
  walkFrameIndex: number;
  walkTimer: number;
  lastRoomId: string | null;
  lastStatus: AgentView["status"];
  targetX: number;
  targetY: number;
  currentX: number;
  currentY: number;
  isPositionInitialized: boolean;
}

export interface AgentVisualTreatment {
  bodyColor: number;
  accentColor: number;
  shape: "square" | "circle" | "diamond";
}

export function resolveAgentTreatment(agent: AgentView): AgentVisualTreatment {
  return {
    bodyColor: ROLE_COLORS[agent.role] ?? 0xb8b0bc, // --base-300 fallback
    accentColor: STATUS_COLORS[agent.status] ?? 0x7d7682, // --base-400 fallback
    shape: agent.role === "orchestrator" ? "diamond" : agent.role === "reviewer" ? "circle" : "square",
  };
}

export class AgentRenderer {
  private sprites = new Map<string, AgentSprite>();
  private lastProjection: OfficeProjection | null = null;
  private reduceMotion = false;

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

  render(agents: AgentView[], layout: RoomLayout, projection: OfficeProjection): void {
    this.lastProjection = projection;
    // 移除不存在的 agent
    for (const [id, sprite] of this.sprites) {
      if (!agents.find((a) => a.agentId === id)) {
        this.layer.removeChild(sprite.container);
        this.sprites.delete(id);
      }
    }

    for (const agent of agents) {
      let sprite = this.sprites.get(agent.agentId);
      if (!sprite) {
        sprite = this.createAgentSprite(agent);
        this.sprites.set(agent.agentId, sprite);
        this.layer.addChild(sprite.container);
      }
      this.updateAgentSprite(sprite, agent, layout);
    }
  }

  private createAgentSprite(agent: AgentView): AgentSprite {
    const container = new Container();
    const treatment = resolveAgentTreatment(agent);

    const body = new Graphics();
    this.drawBodyShape(body, treatment);

    const nameText = new Text({
      text: agent.name,
      style: new TextStyle({ fontSize: 10, fill: 0xf2f0eb, fontFamily: "Inter, system-ui, sans-serif" }),
    });
    nameText.anchor.set(0.5, 0);
    nameText.y = 18;

    const statusText = new Text({
      text: agent.status,
      style: new TextStyle({ fontSize: 10, fill: 0xb8b0bc, fontFamily: "Inter, system-ui, sans-serif" }),
    });
    statusText.anchor.set(0.5, 0);
    statusText.y = 30;

    container.addChild(body);
    container.addChild(nameText);
    container.addChild(statusText);

    return {
      container,
      nameText,
      statusText,
      agentId: agent.agentId,
      role: agent.role,
      treatment,
      currentState: "idle",
      currentTexture: null,
      walkFrames: null,
      walkFrameIndex: 0,
      walkTimer: 0,
      lastRoomId: agent.currentRoomId,
      lastStatus: agent.status,
      targetX: 0,
      targetY: 0,
      currentX: 0,
      currentY: 0,
      isPositionInitialized: false,
    };
  }

  private updateAgentSprite(sprite: AgentSprite, agent: AgentView, layout: RoomLayout): void {
    sprite.statusText.text = agent.blockedReason ? `blocked: ${agent.blockedReason.slice(0, 20)}` : agent.status;

    const treatment = resolveAgentTreatment(agent);
    if (
      sprite.role !== agent.role ||
      sprite.treatment.bodyColor !== treatment.bodyColor ||
      sprite.treatment.accentColor !== treatment.accentColor ||
      sprite.treatment.shape !== treatment.shape
    ) {
      sprite.role = agent.role;
      sprite.treatment = treatment;
      if (!sprite.currentTexture) {
        const body = sprite.container.getChildAt(0) as Graphics;
        body.clear();
        this.drawBodyShape(body, treatment);
      }
    }

    const position = agent.currentRoomId
      ? getAgentPositionByRoomId(layout, agent.currentRoomId, this.hashSeed(agent.agentId))
      : getAgentPositionByRoomId(layout, "command");

    sprite.targetX = position.x;
    sprite.targetY = position.y;

    if (!sprite.isPositionInitialized) {
      sprite.isPositionInitialized = true;
      sprite.currentX = sprite.targetX;
      sprite.currentY = sprite.targetY;
      sprite.container.x = sprite.targetX;
      sprite.container.y = sprite.targetY;
    }

    // Detect room change -> force walk state until arrival
    if (agent.currentRoomId !== sprite.lastRoomId) {
      sprite.lastRoomId = agent.currentRoomId;
      sprite.currentState = "walk";
      sprite.walkFrames = this.assetLoader?.getAnimationFrames(`${agent.role}-walk`, 2) ?? null;
    }

    sprite.lastStatus = agent.status;
    this.applyVisual(sprite, agent);
  }

  private applyVisual(sprite: AgentSprite, agent: AgentView): void {
    const projection = this.lastProjection ?? this.emptyProjection();
    const computedState = computeAgentPresentationState(agent, projection);
    const targetState = sprite.currentState === "walk" ? "walk" : computedState;

    if (targetState === "walk" && sprite.walkFrames && sprite.walkFrames.length > 0) {
      sprite.currentState = "walk";
      sprite.currentTexture = sprite.walkFrames[0];
      this.setBodySprite(sprite, sprite.walkFrames[0]);
      return;
    }

    // 审批展示状态复用 idle 纹理（V1 没有专用 approval 精灵）
    const textureState = targetState === "approval" ? "idle" : targetState;
    const textureName = `${agent.role}-${textureState}`;
    const texture = this.assetLoader?.getTexture(textureName) ?? null;

    if (texture) {
      sprite.currentState = targetState;
      sprite.currentTexture = texture;
      this.setBodySprite(sprite, texture);
      return;
    }

    // Fallback: procedural shape
    sprite.currentState = targetState;
    sprite.currentTexture = null;
    this.setBodyGraphics(sprite, sprite.treatment);
  }

  private emptyProjection(): OfficeProjection {
    return {
      agents: [],
      tasks: [],
      artifacts: [],
      approvals: [],
      rooms: [],
      pendingApprovals: [],
      blockedTasks: [],
      errors: [],
    };
  }

  private setBodySprite(sprite: AgentSprite, texture: Texture): void {
    sprite.container.removeChildAt(0);
    const body = new Sprite(texture);
    body.anchor.set(0.5, 0.5);
    sprite.container.addChildAt(body, 0);
  }

  private setBodyGraphics(sprite: AgentSprite, treatment: AgentVisualTreatment): void {
    sprite.container.removeChildAt(0);
    const body = new Graphics();
    this.drawBodyShape(body, treatment);
    sprite.container.addChildAt(body, 0);
  }

  private drawBodyShape(g: Graphics, treatment: AgentVisualTreatment): void {
    const size = 16;
    switch (treatment.shape) {
      case "circle":
        g.circle(0, 0, size).fill({ color: treatment.bodyColor }).stroke({ color: treatment.accentColor, width: 2 });
        break;
      case "diamond":
        g.moveTo(0, -size)
          .lineTo(size, 0)
          .lineTo(0, size)
          .lineTo(-size, 0)
          .closePath()
          .fill({ color: treatment.bodyColor })
          .stroke({ color: treatment.accentColor, width: 2 });
        break;
      default:
        g.rect(-size, -size, size * 2, size * 2)
          .fill({ color: treatment.bodyColor })
          .stroke({ color: treatment.accentColor, width: 2 });
    }
  }

  private hashSeed(agentId: string): number {
    return agentId.charCodeAt(agentId.length - 1);
  }

  /** 平滑移动所有 agent 到目标位置。由外层 ticker 调用。 */
  tick(): void {
    for (const sprite of this.sprites.values()) {
      const dx = sprite.targetX - sprite.currentX;
      const dy = sprite.targetY - sprite.currentY;
      const isMoving = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5;

      if (this.reduceMotion) {
        if (isMoving) {
          sprite.currentX = sprite.targetX;
          sprite.currentY = sprite.targetY;
          sprite.container.x = sprite.currentX;
          sprite.container.y = sprite.currentY;
        } else if (sprite.currentState === "walk") {
          const agent =
            this.lastProjection?.agents.find((a) => a.agentId === sprite.agentId) ??
            ({ status: sprite.lastStatus } as AgentView);
          sprite.currentTexture = null;
          sprite.walkFrameIndex = 0;
          this.applyVisual(sprite, agent);
        }
        continue;
      }

      if (isMoving) {
        sprite.currentX += dx * 0.1;
        sprite.currentY += dy * 0.1;
        sprite.container.x = sprite.currentX;
        sprite.container.y = sprite.currentY;

        // Animate walk strip
        if (sprite.currentState === "walk" && sprite.walkFrames && sprite.walkFrames.length > 0) {
          sprite.walkTimer++;
          if (sprite.walkTimer % 10 === 0) {
            sprite.walkFrameIndex = (sprite.walkFrameIndex + 1) % sprite.walkFrames.length;
            sprite.currentTexture = sprite.walkFrames[sprite.walkFrameIndex];
            this.setBodySprite(sprite, sprite.currentTexture);
          }
        }
      } else if (sprite.currentState === "walk") {
        // Arrived: switch back to status-based state
        const agent =
          this.lastProjection?.agents.find((a) => a.agentId === sprite.agentId) ??
          ({ status: sprite.lastStatus } as AgentView);
        sprite.currentTexture = null;
        sprite.walkFrameIndex = 0;
        this.applyVisual(sprite, agent);
      }
    }
  }

  /** 测试钩子：返回指定 agent 的目标位置。 */
  getAgentTarget(agentId: string): { x: number; y: number } | null {
    const sprite = this.sprites.get(agentId);
    if (!sprite) return null;
    return { x: sprite.targetX, y: sprite.targetY };
  }

  /** 测试钩子：返回指定 agent 的当前位置。 */
  getAgentPosition(agentId: string): { x: number; y: number } | null {
    const sprite = this.sprites.get(agentId);
    if (!sprite) return null;
    return { x: sprite.currentX, y: sprite.currentY };
  }

  /** 测试钩子：返回当前所有 agent 的视觉处理记录。 */
  getAgentVisualTreatments(): AgentVisualTreatment[] {
    return Array.from(this.sprites.values()).map((sprite) => sprite.treatment);
  }
}
