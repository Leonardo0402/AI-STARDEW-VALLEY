/**
 * PixelOfficeScene — PixiJS 渲染层。
 *
 * 核心规则：
 * - 只消费 OfficeProjection，不直接访问 RuntimeSnapshot
 * - 不在 PixiJS Sprite 中保存 Task 真相状态
 * - 角色移动是 Presentation State，不阻塞 Runtime
 * - 角色位置由 Agent 的 currentRoomId 决定，动画只负责平滑过渡
 *
 * Stage 4 改造：
 * - 新增 useSpriteRenderer 选项，开启后使用分层渲染器（room / prop / agent / effect）。
 * - 默认开启；保留原有的单体程序化渲染器作为显式关闭时的 fallback。
 */
import { Application, Container, Graphics, Text, TextStyle, Ticker } from "pixi.js";
import type {
  OfficeProjection,
  AgentView,
  RoomView,
} from "@agent-office/protocol";
import { AgentRenderer } from "./renderer/agent-renderer.js";
import { EffectRenderer } from "./renderer/effect-renderer.js";
import { PropRenderer } from "./renderer/prop-renderer.js";
import { RoomRenderer } from "./renderer/room-renderer.js";
import { ROLE_COLORS, STATUS_COLORS, ROOM_COLORS } from "./design-tokens.js";
import { createLayoutFromRoomViews, createDefaultLayout, type RoomLayout } from "./layout.js";
import { AssetLoader } from "./asset-loader.js";
import { computeAgentPresentationState } from "./presentation-state.js";

const WALK_MS_PER_TILE = 250;
const TILE_SIZE_PX = 64;
const IDLE_BREATHE_PERIOD_MS = 1500;
const BELL_PERIOD_MS = 1200;
const BLOCKED_PERIOD_MS = 1000;
const SPARKLE_PERIOD_MS = 800;
const SPARKLE_STEPS = 4;
const SPARKLE_STEP_SCALES = [0.8, 1.0, 1.1, 0.9];

interface LegacyAgentSprite {
  container: Container;
  nameText: Text;
  statusText: Text;
  agentId: string;
  targetX: number;
  targetY: number;
  currentX: number;
  currentY: number;
  lastRoomId: string | null;
  walkStartX: number;
  walkStartY: number;
  walkElapsed: number;
  walkDuration: number;
}

export interface PixelOfficeSceneOptions {
  /** 开启 Stage 4 分层精灵渲染器；默认 true。传 false 回退到单体程序化渲染器。 */
  useSpriteRenderer?: boolean;
  /** 禁用连续动画（行走帧、脉冲等）。 */
  reduceMotion?: boolean;
}

export class PixelOfficeScene {
  private app: Application;
  private contentRoot: Container;
  private roomLayer: Container;
  private propLayer: Container;
  private agentLayer: Container;
  private overlayLayer: Container;
  private agentSprites: Map<string, LegacyAgentSprite> = new Map();
  private currentProjection: OfficeProjection | null = null;
  private pendingProjection: OfficeProjection | null = null;
  private currentLayout: RoomLayout | null = null;
  private destroyed = false;
  private initialized = false;
  private resizeObserver: ResizeObserver | null = null;

  private useSpriteRenderer: boolean;
  private reduceMotion: boolean;
  private overlayPulsePhase = 0;
  private idlePhase = 0;
  private blockedPulsePhase = 0;
  private sparklePhase = 0;
  private roomRenderer?: RoomRenderer;
  private propRenderer?: PropRenderer;
  private agentRenderer?: AgentRenderer;
  private effectRenderer?: EffectRenderer;
  private assetLoader?: AssetLoader;

  constructor(canvas: HTMLCanvasElement, options: PixelOfficeSceneOptions = {}) {
    this.useSpriteRenderer = options.useSpriteRenderer ?? true;
    this.reduceMotion = options.reduceMotion ?? false;
    this.app = new Application();
    this.contentRoot = new Container();
    this.roomLayer = new Container();
    this.propLayer = new Container();
    this.agentLayer = new Container();
    this.overlayLayer = new Container();
    this.contentRoot.addChild(this.roomLayer);
    this.contentRoot.addChild(this.propLayer);
    this.contentRoot.addChild(this.agentLayer);
    this.contentRoot.addChild(this.overlayLayer);
  }

  setReduceMotion(value: boolean): void {
    this.reduceMotion = value;
    this.agentRenderer?.setReduceMotion(value);
    this.effectRenderer?.setReduceMotion(value);
    if (value) {
      for (const sprite of this.agentSprites.values()) {
        sprite.container.scale.set(1, 1);
        sprite.container.y = sprite.currentY;
      }
    }
  }

  async init(canvas: HTMLCanvasElement): Promise<void> {
    if (this.destroyed) return;
    await this.app.init({
      canvas,
      width: canvas.clientWidth || 800,
      height: canvas.clientHeight || 600,
      backgroundColor: 0x161418,
      antialias: false,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    if (this.destroyed) {
      // 在 init 期间被 destroy 了
      try { this.app.destroy({ removeView: false }); } catch { /* ignore */ }
      return;
    }

    this.app.stage.addChild(this.contentRoot);

    // Responsive: scale the 800×600 design content to fit the stage while
    // preserving aspect ratio, and re-center when the parent resizes.
    const parent = canvas.parentElement;
    if (parent) {
      this.resizeObserver = new ResizeObserver((entries) => {
        const rect = entries[0]?.contentRect ?? parent.getBoundingClientRect();
        this.fit(rect.width, rect.height);
      });
      this.resizeObserver.observe(parent);
      this.fit(parent.clientWidth, parent.clientHeight);
    }

    if (this.useSpriteRenderer) {
      this.assetLoader = new AssetLoader(this.resolveAssetBasePath());
      try {
        await this.assetLoader.loadAll();
      } catch {
        // 加载失败时继续：各渲染器内部会回退到程序化绘制
      }
      this.roomRenderer = new RoomRenderer(this.roomLayer, this.assetLoader);
      this.propRenderer = new PropRenderer(this.propLayer, this.assetLoader);
      this.agentRenderer = new AgentRenderer(this.agentLayer, this.assetLoader, this.reduceMotion);
      this.effectRenderer = new EffectRenderer(this.overlayLayer, this.assetLoader, this.reduceMotion);
    }

    // 启动渲染循环
    this.app.ticker.add((ticker) => this.update(ticker));
    this.initialized = true;

    // 如果在初始化完成前已有投影传入，补渲染一次。
    if (this.pendingProjection) {
      this.updateProjection(this.pendingProjection);
      this.pendingProjection = null;
    }
  }

  private resolveAssetBasePath(): string {
    // In the browser, assets are served from the host's /assets/ directory
    // (copied from packages/pixel-office/assets by the demo-office build).
    if (typeof location !== "undefined") {
      return new URL("assets/", location.href).href;
    }
    return "";
  }

  /** 更新场景 — 只消费 OfficeProjection */
  updateProjection(projection: OfficeProjection): void {
    if (!this.initialized) {
      this.pendingProjection = projection;
      return;
    }
    this.currentProjection = projection;

    if (this.useSpriteRenderer && this.roomRenderer && this.propRenderer && this.agentRenderer && this.effectRenderer) {
      const layout = projection.rooms.length > 0 ? createLayoutFromRoomViews(projection.rooms) : createDefaultLayout();
      this.currentLayout = layout;
      this.roomRenderer.render(layout);
      this.propRenderer.render(layout, projection.pendingApprovals.length);
      this.agentRenderer.render(projection.agents, layout, projection);
      this.effectRenderer.render(projection, layout);
    } else {
      this.renderRooms(projection.rooms);
      this.renderAgents(projection.agents, projection.rooms);
      this.renderOverlays(projection);
    }
  }

  private fit(width: number, height: number): void {
    if (this.destroyed || !this.app.renderer) return;
    this.app.renderer.resize(width, height);

    const designWidth = 800;
    const designHeight = 600;
    const scale = Math.min(width / designWidth, height / designHeight);
    this.contentRoot.scale.set(scale);
    this.contentRoot.position.set(
      (width - designWidth * scale) / 2,
      (height - designHeight * scale) / 2
    );
  }

  destroy(): void {
    this.destroyed = true;
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.initialized) {
      try {
        // Keep the <canvas> element in the DOM so React can unmount/reuse it.
        this.app.destroy({ removeView: false });
      } catch {
        // PixiJS destroy 可能抛错（如 StrictMode 双调用），忽略
      }
    }
    this.initialized = false;
  }

  // ─── 内部渲染方法 ──────────────────────────────────────────

  private renderRooms(rooms: RoomView[]): void {
    this.roomLayer.removeChildren();
    for (const room of rooms) {
      const g = new Graphics();
      const color = ROOM_COLORS[room.type] ?? 0x333333;
      g.rect(room.bounds.x, room.bounds.y, room.bounds.width, room.bounds.height)
        .fill({ color, alpha: 0.3 })
        .stroke({ color, width: 2 });

      // 房间标签
      const label = new Text({
        text: room.name,
        style: new TextStyle({
          fontSize: 10,
          fill: 0xb8b0bc,
          fontFamily: '"Press Start 2P", monospace',
        }),
      });
      label.x = room.bounds.x + 8;
      label.y = room.bounds.y + 4;

      this.roomLayer.addChild(g);
      this.roomLayer.addChild(label);
    }
  }

  private renderAgents(agents: AgentView[], rooms: RoomView[]): void {
    // 移除不存在的 agent
    for (const [id, sprite] of this.agentSprites) {
      if (!agents.find((a) => a.agentId === id)) {
        this.agentLayer.removeChild(sprite.container);
        this.agentSprites.delete(id);
      }
    }

    for (const agent of agents) {
      let sprite = this.agentSprites.get(agent.agentId);
      if (!sprite) {
        sprite = this.createAgentSprite(agent);
        this.agentSprites.set(agent.agentId, sprite);
        this.agentLayer.addChild(sprite.container);
      }
      this.updateAgentSprite(sprite, agent, rooms);
    }
  }

  private createAgentSprite(agent: AgentView): LegacyAgentSprite {
    const container = new Container();

    // 角色方块 (32x32 像素块)
    const body = new Graphics();
    body
      .rect(-16, -16, 32, 32)
      .fill({ color: this.getRoleColor(agent.role) })
      .stroke({ color: this.getStatusColor(agent.status), width: 2 });

    // 名字
    const nameText = new Text({
      text: agent.name,
      style: new TextStyle({ fontSize: 10, fill: 0xf2f0eb, fontFamily: 'Inter, system-ui, sans-serif' }),
    });
    nameText.anchor.set(0.5, 0);
    nameText.y = 18;

    // 状态
    const statusText = new Text({
      text: agent.status,
      style: new TextStyle({ fontSize: 10, fill: 0xb8b0bc, fontFamily: 'Inter, system-ui, sans-serif' }),
    });
    statusText.anchor.set(0.5, 0);
    statusText.y = 32;

    container.addChild(body);
    container.addChild(nameText);
    container.addChild(statusText);

    return {
      container,
      nameText,
      statusText,
      agentId: agent.agentId,
      targetX: 0,
      targetY: 0,
      currentX: 0,
      currentY: 0,
      lastRoomId: agent.currentRoomId ?? null,
      walkStartX: 0,
      walkStartY: 0,
      walkElapsed: 0,
      walkDuration: 0,
    };
  }

  private updateAgentSprite(
    sprite: LegacyAgentSprite,
    agent: AgentView,
    rooms: RoomView[]
  ): void {
    // 更新状态文字
    sprite.statusText.text = agent.status;
    if (agent.blockedReason) {
      sprite.statusText.text = `blocked: ${agent.blockedReason.slice(0, 20)}`;
    }

    // 重绘方块颜色
    const body = sprite.container.getChildAt(0) as Graphics;
    body.clear();
    body
      .rect(-16, -16, 32, 32)
      .fill({ color: this.getRoleColor(agent.role) })
      .stroke({ color: this.getStatusColor(agent.status), width: 2 });

    // 根据 currentRoomId 定位
    const position = this.computeLegacyAgentPosition(agent, rooms);
    if (position) {
      sprite.targetX = position.x;
      sprite.targetY = position.y;
    }

    // 房间变化时启动行走插值
    if (agent.currentRoomId !== sprite.lastRoomId) {
      sprite.lastRoomId = agent.currentRoomId;
      sprite.walkStartX = sprite.currentX;
      sprite.walkStartY = sprite.currentY;
      sprite.walkElapsed = 0;
      const distance = Math.hypot(sprite.targetX - sprite.currentX, sprite.targetY - sprite.currentY);
      sprite.walkDuration = distance === 0 ? 0 : (distance / TILE_SIZE_PX) * WALK_MS_PER_TILE;
    }

    // 初始化位置
    if (sprite.currentX === 0 && sprite.currentY === 0) {
      sprite.currentX = sprite.targetX;
      sprite.currentY = sprite.targetY;
      sprite.container.x = sprite.targetX;
      sprite.container.y = sprite.targetY;
    }
  }

  private renderOverlays(projection: OfficeProjection): void {
    this.overlayLayer.removeChildren();

    const approvalPulse = this.reduceMotion
      ? 0.5
      : (Math.sin((this.overlayPulsePhase / BELL_PERIOD_MS) * Math.PI * 2) + 1) / 2;
    const blockedPulse = this.reduceMotion
      ? 0.5
      : (Math.sin((this.blockedPulsePhase / BLOCKED_PERIOD_MS) * Math.PI * 2) + 1) / 2;

    // 审批请求标记（闪烁的红圈）
    for (const approval of projection.pendingApprovals) {
      const task = projection.tasks.find((t) => t.taskId === approval.taskId);
      if (!task?.roomId) continue;
      const room = projection.rooms.find((r) => r.roomId === task.roomId);
      if (!room) continue;

      const circle = new Graphics();
      circle
        .circle(room.bounds.x + room.bounds.width / 2, room.bounds.y + 20, 8 + approvalPulse * 4)
        .fill({ color: 0xe6a85c, alpha: 0.3 + approvalPulse * 0.4 })
        .stroke({ color: 0xe6a85c, width: 2 });

      const label = new Text({
        text: "审批!",
        style: new TextStyle({ fontSize: 10, fill: 0xe6a85c, fontFamily: '"Press Start 2P", monospace' }),
      });
      label.anchor.set(0.5, 0.5);
      label.x = room.bounds.x + room.bounds.width / 2;
      label.y = room.bounds.y + 20;

      this.overlayLayer.addChild(circle);
      this.overlayLayer.addChild(label);
    }

    // 阻塞标记
    for (const task of projection.blockedTasks) {
      if (!task.roomId) continue;
      const room = projection.rooms.find((r) => r.roomId === task.roomId);
      if (!room) continue;

      const label = new Text({
        text: `⚠ ${task.blockedReason?.slice(0, 30) ?? "blocked"}`,
        style: new TextStyle({ fontSize: 10, fill: 0xc96a5b, fontFamily: 'Inter, system-ui, sans-serif' }),
      });
      label.x = room.bounds.x + 8;
      label.y = room.bounds.y + room.bounds.height - 20;

      this.overlayLayer.addChild(label);
    }

    // 阻塞 agent 红色脉冲光晕
    for (const agent of projection.agents) {
      const state = computeAgentPresentationState(agent, projection);
      if (state !== "blocked" || agent.status === "failed") continue;
      const pos = this.getAgentRenderPosition(agent, projection.rooms);
      if (!pos) continue;

      const glowRadius = 18 + blockedPulse * 4;
      const glowAlpha = 0.1 + blockedPulse * 0.15;
      const glow = new Graphics();
      glow.circle(pos.x, pos.y, glowRadius).fill({ color: 0xc96a5b, alpha: glowAlpha });
      this.overlayLayer.addChild(glow);

      const bubbleX = pos.x + 12;
      const bubbleY = pos.y - 18;
      const marker = new Graphics();
      marker
        .circle(bubbleX, bubbleY, 6)
        .fill({ color: 0xc96a5b })
        .stroke({ color: 0x7a3d34, width: 1 });
      marker
        .moveTo(bubbleX - 3, bubbleY + 4)
        .lineTo(bubbleX - 6, bubbleY + 9)
        .lineTo(bubbleX, bubbleY + 5)
        .closePath()
        .fill({ color: 0xc96a5b });
      this.overlayLayer.addChild(marker);

      const exclamation = new Text({
        text: "!",
        style: new TextStyle({ fontSize: 10, fill: 0xf2f0eb, fontFamily: "Inter, system-ui, sans-serif" }),
      });
      exclamation.anchor.set(0.5, 0.5);
      exclamation.x = bubbleX;
      exclamation.y = bubbleY;
      this.overlayLayer.addChild(exclamation);
    }

    // working agent 工具火花
    for (const agent of projection.agents) {
      const state = computeAgentPresentationState(agent, projection);
      if (state !== "working") continue;
      const pos = this.getAgentRenderPosition(agent, projection.rooms);
      if (!pos) continue;

      const scale = this.reduceMotion
        ? SPARKLE_STEP_SCALES[0]
        : SPARKLE_STEP_SCALES[Math.floor(this.sparklePhase / (SPARKLE_PERIOD_MS / SPARKLE_STEPS)) % SPARKLE_STEPS];
      const sparkle = new Graphics();
      this.drawStar(sparkle, pos.x + 8, pos.y - 24, 5 * scale, 0xe6a85c);
      this.overlayLayer.addChild(sparkle);
    }
  }

  private computeLegacyAgentPosition(agent: AgentView, rooms: RoomView[]): { x: number; y: number } | null {
    if (!agent.currentRoomId) {
      const commandRoom = rooms.find((r) => r.type === "command");
      if (!commandRoom) return null;
      return {
        x: commandRoom.bounds.x + commandRoom.bounds.width / 2,
        y: commandRoom.bounds.y + commandRoom.bounds.height / 2,
      };
    }
    const room = rooms.find((r) => r.roomId === agent.currentRoomId);
    if (!room) return null;
    const hash = agent.agentId.charCodeAt(agent.agentId.length - 1);
    const offsetX = ((hash % 3) - 1) * 80;
    const offsetY = ((hash % 2) - 0.5) * 100;
    return {
      x: room.bounds.x + room.bounds.width / 2 + offsetX,
      y: room.bounds.y + room.bounds.height / 2 + offsetY,
    };
  }

  private getAgentRenderPosition(agent: AgentView, rooms: RoomView[]): { x: number; y: number } | null {
    const sprite = this.agentSprites.get(agent.agentId);
    if (sprite) {
      return { x: sprite.targetX, y: sprite.targetY };
    }
    return this.computeLegacyAgentPosition(agent, rooms);
  }

  private getRoleColor(role: string): number {
    return ROLE_COLORS[role] ?? 0xb8b0bc; // --base-300 fallback
  }

  private getStatusColor(status: string): number {
    return STATUS_COLORS[status] ?? 0x7d7682; // --base-400 fallback
  }

  private drawStar(g: Graphics, x: number, y: number, radius: number, color: number): void {
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

  private update(ticker: Ticker): void {
    if (this.destroyed) return;

    if (this.useSpriteRenderer && this.agentRenderer) {
      this.agentRenderer.tick(ticker.deltaMS);

      // 持续刷新效果层（blocked/working/approval）；reduceMotion 下只渲染一次，不逐帧刷新
      if (!this.reduceMotion && this.currentProjection && this.currentLayout) {
        this.effectRenderer?.render(this.currentProjection, this.currentLayout, ticker.deltaMS);
      }
      return;
    }

    if (!this.reduceMotion) {
      this.overlayPulsePhase += ticker.deltaMS;
      this.idlePhase += ticker.deltaMS;
      this.blockedPulsePhase += ticker.deltaMS;
      this.sparklePhase += ticker.deltaMS;
    }

    // 平滑移动 agent 到目标位置
    for (const sprite of this.agentSprites.values()) {
      const dx = sprite.targetX - sprite.currentX;
      const dy = sprite.targetY - sprite.currentY;
      const isMoving = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5;

      if (isMoving) {
        if (this.reduceMotion || sprite.walkDuration === 0) {
          sprite.currentX = sprite.targetX;
          sprite.currentY = sprite.targetY;
        } else {
          sprite.walkElapsed += ticker.deltaMS;
          const progress = Math.min(sprite.walkElapsed / sprite.walkDuration, 1);
          sprite.currentX = sprite.walkStartX + (sprite.targetX - sprite.walkStartX) * progress;
          sprite.currentY = sprite.walkStartY + (sprite.targetY - sprite.walkStartY) * progress;
        }
        sprite.container.x = sprite.currentX;
        sprite.container.y = sprite.currentY;
        sprite.container.scale.set(1, 1);
        continue;
      }

      // 静止 idle 时应用呼吸动画
      if (this.reduceMotion) {
        sprite.container.scale.set(1, 1);
        sprite.container.y = sprite.currentY;
      } else if (this.currentProjection) {
        const agent = this.currentProjection.agents.find((a) => a.agentId === sprite.agentId);
        if (agent && computeAgentPresentationState(agent, this.currentProjection) === "idle") {
          const t = Math.sin((this.idlePhase / IDLE_BREATHE_PERIOD_MS) * Math.PI * 2);
          sprite.container.y = sprite.currentY + t * -1;
          sprite.container.scale.set(1 + t * 0.01, 1 + t * 0.03);
        } else {
          sprite.container.scale.set(1, 1);
          sprite.container.y = sprite.currentY;
        }
      }
    }

    // 持续刷新覆盖层效果（reduceMotion 时保持静态）
    if (!this.reduceMotion && this.currentProjection) {
      const hasAnimatedOverlay =
        this.currentProjection.pendingApprovals.length > 0 ||
        this.currentProjection.agents.some((a) => {
          const state = computeAgentPresentationState(a, this.currentProjection!);
          return state === "working" || (state === "blocked" && a.status !== "failed");
        });
      if (hasAnimatedOverlay) {
        this.renderOverlays(this.currentProjection);
      }
    }
  }
}
