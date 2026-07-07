/**
 * AgentRenderer — 根据 agent 的 currentRoomId 渲染角色。
 *
 * Stage 4 使用程序化角色轮廓；Stage 5 接入精灵纹理并支持行走动画。
 */
import { Container, Graphics, Text, TextStyle, Sprite, Texture } from "pixi.js";
import type { AgentView, OfficeProjection } from "@agent-office/protocol";
import { getAgentPositionByRoomId, type RoomLayout } from "../layout.js";
import type { AssetLoader } from "../asset-loader.js";
import { computeAgentPresentationState, type AgentPresentationState } from "../presentation-state.js";
import { ROLE_COLORS, STATUS_COLORS } from "../design-tokens.js";

const IDLE_BREATHE_PERIOD_MS = 1500;
const WALK_MS_PER_TILE = 250;
const TILE_SIZE_PX = 64;
const WALK_FRAME_MS = 100;

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
  idlePhase: number;
  walkStartX: number;
  walkStartY: number;
  walkElapsed: number;
  walkDuration: number;
}

export interface AgentVisualTreatment {
  bodyColor: number;
  accentColor: number;
  role: AgentView["role"];
}

type AgentVisualState = AgentPresentationState | "failed";

interface AgentPosture {
  bodyOffsetX: number;
  bodyOffsetY: number;
  headOffsetX: number;
  headOffsetY: number;
  faceDir: number;
}

export function resolveAgentTreatment(agent: AgentView): AgentVisualTreatment {
  return {
    bodyColor: ROLE_COLORS[agent.role] ?? 0xb8b0bc, // --base-300 fallback
    accentColor: STATUS_COLORS[agent.status] ?? 0x7d7682, // --base-400 fallback
    role: agent.role,
  };
}

export class AgentRenderer {
  private sprites = new Map<string, AgentSprite>();
  private lastProjection: OfficeProjection | null = null;
  private lastLayout: RoomLayout | null = null;
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
    this.lastLayout = layout;

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
    this.drawBodyShape(body, treatment, "idle");

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
      idlePhase: 0,
      walkStartX: 0,
      walkStartY: 0,
      walkElapsed: 0,
      walkDuration: 0,
    };
  }

  private updateAgentSprite(sprite: AgentSprite, agent: AgentView, layout: RoomLayout): void {
    sprite.statusText.text = agent.blockedReason ? `blocked: ${agent.blockedReason.slice(0, 20)}` : agent.status;

    const treatment = resolveAgentTreatment(agent);
    if (
      sprite.role !== agent.role ||
      sprite.treatment.bodyColor !== treatment.bodyColor ||
      sprite.treatment.accentColor !== treatment.accentColor ||
      sprite.treatment.role !== treatment.role
    ) {
      sprite.role = agent.role;
      sprite.treatment = treatment;
      if (!sprite.currentTexture) {
        const body = sprite.container.getChildAt(0) as Graphics;
        body.clear();
        this.drawBodyShape(body, treatment, sprite.currentState as AgentVisualState);
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
      sprite.walkStartX = sprite.currentX;
      sprite.walkStartY = sprite.currentY;
      sprite.walkElapsed = 0;
      const distance = Math.hypot(sprite.targetX - sprite.currentX, sprite.targetY - sprite.currentY);
      sprite.walkDuration = (distance / TILE_SIZE_PX) * WALK_MS_PER_TILE;
    }

    sprite.lastStatus = agent.status;
    this.applyVisual(sprite, agent);
  }

  private applyVisual(sprite: AgentSprite, agent: AgentView): void {
    const projection = this.lastProjection ?? this.emptyProjection();
    const computedState = computeAgentPresentationState(agent, projection);
    let visualState: AgentVisualState = sprite.currentState === "walk" ? "walk" : computedState;
    if (agent.status === "failed" && visualState !== "walk") {
      visualState = "failed";
    }
    const presentationState: AgentPresentationState = visualState === "failed" ? "blocked" : visualState;

    if (visualState === "walk" && sprite.walkFrames && sprite.walkFrames.length > 0) {
      sprite.currentState = presentationState;
      sprite.currentTexture = sprite.walkFrames[0];
      this.setBodySprite(sprite, sprite.walkFrames[0]);
      return;
    }

    // 审批 / 失败展示状态复用 idle / blocked 纹理（V1 没有专用精灵）
    const textureState = visualState === "approval" ? "idle" : visualState === "failed" ? "blocked" : visualState;
    const textureName = `${agent.role}-${textureState}`;
    const texture = this.assetLoader?.getTexture(textureName) ?? null;

    if (texture) {
      sprite.currentState = presentationState;
      sprite.currentTexture = texture;
      this.setBodySprite(sprite, texture);
      return;
    }

    // Fallback: procedural silhouette
    sprite.currentState = presentationState;
    sprite.currentTexture = null;
    this.setBodyGraphics(sprite, sprite.treatment, visualState, agent);
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

  private setBodyGraphics(sprite: AgentSprite, treatment: AgentVisualTreatment, state: AgentVisualState, agent: AgentView): void {
    sprite.container.removeChildAt(0);
    const body = new Graphics();
    const posture = this.computePosture(sprite, agent, state);
    this.drawBodyShape(body, treatment, state, posture);
    sprite.container.addChildAt(body, 0);
  }

  private computePosture(sprite: AgentSprite, agent: AgentView, state: AgentVisualState): AgentPosture {
    const posture: AgentPosture = {
      bodyOffsetX: 0,
      bodyOffsetY: 0,
      headOffsetX: 0,
      headOffsetY: 0,
      faceDir: this.hashSeed(sprite.agentId) % 2 === 0 ? 1 : -1,
    };

    const faceRoomCenter = (): void => {
      const roomId = agent.currentRoomId;
      if (roomId && this.lastLayout) {
        const room = this.lastLayout.rooms.find((r) => r.roomId === roomId);
        if (room) {
          const cx = room.x + room.width / 2;
          if (cx > sprite.targetX) posture.faceDir = 1;
          else if (cx < sprite.targetX) posture.faceDir = -1;
        }
      }
    };

    switch (state) {
      case "working":
        faceRoomCenter();
        posture.bodyOffsetX = 2 * posture.faceDir;
        posture.headOffsetX = 3 * posture.faceDir;
        break;
      case "blocked":
        posture.bodyOffsetY = 3;
        posture.headOffsetY = 5;
        break;
      case "failed":
        posture.bodyOffsetY = 3;
        posture.headOffsetY = 6;
        break;
      case "approval":
        faceRoomCenter();
        posture.bodyOffsetX = 1 * posture.faceDir;
        break;
    }

    return posture;
  }

  private drawBodyShape(
    g: Graphics,
    treatment: AgentVisualTreatment,
    state: AgentVisualState = "idle",
    posture?: AgentPosture
  ): void {
    const { bodyColor, accentColor, role } = treatment;
    const p = posture ?? {
      bodyOffsetX: 0,
      bodyOffsetY: 0,
      headOffsetX: 0,
      headOffsetY: 0,
      faceDir: 1,
    };

    switch (role) {
      case "orchestrator":
        this.drawOrchestrator(g, bodyColor, accentColor, state, p);
        break;
      case "worker":
        this.drawWorker(g, bodyColor, accentColor, state, p);
        break;
      case "reviewer":
        this.drawReviewer(g, bodyColor, accentColor, state, p);
        break;
      default:
        this.drawGeneric(g, bodyColor, accentColor, p);
    }
  }

  private drawOrchestrator(
    g: Graphics,
    bodyColor: number,
    accentColor: number,
    state: AgentVisualState,
    p: AgentPosture
  ): void {
    const bx = p.bodyOffsetX;
    const by = p.bodyOffsetY;
    const hx = p.headOffsetX;
    const hy = p.headOffsetY;
    const f = p.faceDir;

    // Tall body
    g.rect(bx - 4, by - 22, 8, 18).fill({ color: bodyColor }).stroke({ color: accentColor, width: 1 });
    // Head
    g.circle(hx, hy - 26, 5).fill({ color: bodyColor }).stroke({ color: accentColor, width: 1 });
    // Headset boom
    g.moveTo(hx, hy - 30).lineTo(hx + 5 * f, hy - 28).stroke({ color: accentColor, width: 1 });
    // Headset earpiece
    const earW = 3 * f;
    const earX = f === 1 ? hx + 4 : hx - 7;
    g.rect(earX, hy - 30, earW, 3).fill({ color: accentColor });
    // Tablet
    const tabletW = 5;
    const tabletX = f === 1 ? bx + 3 : bx - 3 - tabletW;
    g.rect(tabletX, by - 16, tabletW, 7).fill({ color: 0xb8b0bc }).stroke({ color: accentColor, width: 1 });

    if (state === "failed") {
      g.moveTo(hx - 2 * f, hy - 26).lineTo(hx - 2 * f, hy - 23).stroke({ color: accentColor, width: 1 });
    }
  }

  private drawWorker(
    g: Graphics,
    bodyColor: number,
    accentColor: number,
    state: AgentVisualState,
    p: AgentPosture
  ): void {
    const bx = p.bodyOffsetX;
    const by = p.bodyOffsetY;
    const hx = p.headOffsetX;
    const hy = p.headOffsetY;
    const f = p.faceDir;

    // Sturdy body
    g.rect(bx - 7, by - 18, 14, 15).fill({ color: bodyColor }).stroke({ color: accentColor, width: 1 });
    // Head
    g.circle(hx, hy - 24, 5).fill({ color: bodyColor }).stroke({ color: accentColor, width: 1 });
    // Helmet
    g.rect(hx - 6, hy - 30, 12, 4).fill({ color: accentColor });
    // Tool belt
    g.rect(bx - 7, by - 12, 14, 3).fill({ color: accentColor });
    // Tool pouch
    const pouchW = 4;
    const pouchX = f === 1 ? bx + 4 : bx - 4 - pouchW;
    g.rect(pouchX, by - 11, pouchW, 4).fill({ color: 0xb8b0bc }).stroke({ color: accentColor, width: 1 });

    if (state === "failed") {
      g.moveTo(hx - 2 * f, hy - 24).lineTo(hx - 2 * f, hy - 21).stroke({ color: accentColor, width: 1 });
    }
  }

  private drawReviewer(
    g: Graphics,
    bodyColor: number,
    accentColor: number,
    state: AgentVisualState,
    p: AgentPosture
  ): void {
    const bx = p.bodyOffsetX;
    const by = p.bodyOffsetY;
    const hx = p.headOffsetX;
    const hy = p.headOffsetY;
    const f = p.faceDir;

    // Slim body
    g.rect(bx - 3, by - 20, 6, 16).fill({ color: bodyColor }).stroke({ color: accentColor, width: 1 });
    // Head
    g.circle(hx, hy - 25, 4).fill({ color: bodyColor }).stroke({ color: accentColor, width: 1 });
    // Glasses
    const lensW = 3;
    const leftLensX = f === 1 ? hx - 4 : hx + 1;
    const rightLensX = f === 1 ? hx + 1 : hx - 4;
    g.rect(leftLensX, hy - 26, lensW, 2).fill({ color: accentColor });
    g.rect(rightLensX, hy - 26, lensW, 2).fill({ color: accentColor });
    // Clipboard
    const cbW = 6;
    const cbH = 9;
    const cbX = f === 1 ? bx + 4 : bx - 4 - cbW;
    g.rect(cbX, by - 18, cbW, cbH).fill({ color: 0xa89788 }).stroke({ color: accentColor, width: 1 });
    // Clipboard clip
    g.rect(cbX + 1, by - 19, 4, 2).fill({ color: accentColor });

    if (state === "failed") {
      g.moveTo(hx - 1 * f, hy - 25).lineTo(hx - 1 * f, hy - 22).stroke({ color: accentColor, width: 1 });
    }
  }

  private drawGeneric(g: Graphics, bodyColor: number, accentColor: number, p: AgentPosture): void {
    const size = 16;
    g.rect(p.bodyOffsetX - size, p.bodyOffsetY - size, size * 2, size * 2)
      .fill({ color: bodyColor })
      .stroke({ color: accentColor, width: 2 });
  }

  private hashSeed(agentId: string): number {
    return agentId.charCodeAt(agentId.length - 1);
  }

  /** 平滑移动所有 agent 到目标位置。由外层 ticker 调用。 */
  tick(deltaMS = 16.67): void {
    for (const sprite of this.sprites.values()) {
      const dx = sprite.targetX - sprite.currentX;
      const dy = sprite.targetY - sprite.currentY;
      const isMoving = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5;

      if (this.reduceMotion) {
        this.resetTransform(sprite);
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
        this.resetTransform(sprite);
        sprite.walkElapsed += deltaMS;
        const progress = Math.min(sprite.walkElapsed / sprite.walkDuration, 1);
        sprite.currentX = sprite.walkStartX + (sprite.targetX - sprite.walkStartX) * progress;
        sprite.currentY = sprite.walkStartY + (sprite.targetY - sprite.walkStartY) * progress;
        sprite.container.x = sprite.currentX;
        sprite.container.y = sprite.currentY;

        // Animate walk strip
        if (sprite.currentState === "walk" && sprite.walkFrames && sprite.walkFrames.length > 0) {
          sprite.walkTimer += deltaMS;
          if (sprite.walkTimer >= WALK_FRAME_MS) {
            sprite.walkTimer = 0;
            sprite.walkFrameIndex = (sprite.walkFrameIndex + 1) % sprite.walkFrames.length;
            sprite.currentTexture = sprite.walkFrames[sprite.walkFrameIndex];
            this.setBodySprite(sprite, sprite.currentTexture);
          }
        }

        if (progress >= 1) {
          // Arrived: switch back to status-based state
          const agent =
            this.lastProjection?.agents.find((a) => a.agentId === sprite.agentId) ??
            ({ status: sprite.lastStatus } as AgentView);
          sprite.currentTexture = null;
          sprite.walkFrameIndex = 0;
          this.applyVisual(sprite, agent);
        }
      } else {
        if (sprite.currentState === "walk") {
          // Arrived: switch back to status-based state
          const agent =
            this.lastProjection?.agents.find((a) => a.agentId === sprite.agentId) ??
            ({ status: sprite.lastStatus } as AgentView);
          sprite.currentTexture = null;
          sprite.walkFrameIndex = 0;
          this.applyVisual(sprite, agent);
        }

        if (sprite.currentState === "idle") {
          this.applyIdleBreathe(sprite, deltaMS);
        } else {
          this.resetTransform(sprite);
        }
      }
    }
  }

  private applyIdleBreathe(sprite: AgentSprite, deltaMS: number): void {
    sprite.idlePhase += deltaMS;
    const t = Math.sin((sprite.idlePhase / IDLE_BREATHE_PERIOD_MS) * Math.PI * 2);
    sprite.container.y = sprite.currentY + t * -1;
    sprite.container.scale.y = 1 + t * 0.03;
    sprite.container.scale.x = 1 + t * 0.01;
  }

  private resetTransform(sprite: AgentSprite): void {
    sprite.container.scale.set(1, 1);
    sprite.container.y = sprite.currentY;
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

  /** 测试钩子：返回指定 agent 的当前行走动画持续时间（毫秒）。 */
  getAgentWalkDuration(agentId: string): number | null {
    const sprite = this.sprites.get(agentId);
    if (!sprite) return null;
    return sprite.walkDuration;
  }

  /** 测试钩子：返回当前所有 agent 的视觉处理记录。 */
  getAgentVisualTreatments(): AgentVisualTreatment[] {
    return Array.from(this.sprites.values()).map((sprite) => sprite.treatment);
  }
}
