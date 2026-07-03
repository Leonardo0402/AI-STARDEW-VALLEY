/**
 * PixelOfficeScene — PixiJS 渲染层。
 *
 * 核心规则：
 * - 只消费 OfficeProjection，不直接访问 RuntimeSnapshot
 * - 不在 PixiJS Sprite 中保存 Task 真相状态
 * - 角色移动是 Presentation State，不阻塞 Runtime
 * - 角色位置由 Agent 的 currentRoomId 决定，动画只负责平滑过渡
 */
import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import type {
  OfficeProjection,
  AgentView,
  RoomView,
  TaskView,
  ArtifactView,
  ApprovalView,
} from "@agent-office/protocol";

interface AgentSprite {
  container: Container;
  nameText: Text;
  statusText: Text;
  agentId: string;
  targetX: number;
  targetY: number;
  currentX: number;
  currentY: number;
}

const ROOM_COLORS: Record<string, number> = {
  command: 0x2a3a5a,
  execution: 0x2a5a3a,
  review: 0x5a3a2a,
  approval_delivery: 0x5a2a5a,
};

const STATUS_COLORS: Record<string, number> = {
  idle: 0x888888,
  planning: 0x4488ff,
  working: 0x44ff44,
  waiting: 0xffaa44,
  reviewing: 0xff44ff,
  blocked: 0xff4444,
  paused: 0x666666,
  failed: 0xff0000,
  offline: 0x333333,
};

export class PixelOfficeScene {
  private app: Application;
  private roomLayer: Container;
  private agentLayer: Container;
  private overlayLayer: Container;
  private agentSprites: Map<string, AgentSprite> = new Map();
  private currentProjection: OfficeProjection | null = null;
  private destroyed = false;
  private initialized = false;

  constructor(canvas: HTMLCanvasElement) {
    this.app = new Application();
    this.roomLayer = new Container();
    this.agentLayer = new Container();
    this.overlayLayer = new Container();
  }

  async init(canvas: HTMLCanvasElement): Promise<void> {
    if (this.destroyed) return;
    await this.app.init({
      canvas,
      width: 800,
      height: 600,
      backgroundColor: 0x1a1a2e,
      antialias: false,
    });
    if (this.destroyed) {
      // 在 init 期间被 destroy 了
      try { this.app.destroy(true); } catch { /* ignore */ }
      return;
    }

    this.app.stage.addChild(this.roomLayer);
    this.app.stage.addChild(this.agentLayer);
    this.app.stage.addChild(this.overlayLayer);

    // 启动渲染循环
    this.app.ticker.add(() => this.update());
    this.initialized = true;
  }

  /** 更新场景 — 只消费 OfficeProjection */
  updateProjection(projection: OfficeProjection): void {
    if (!this.initialized) return;
    this.currentProjection = projection;
    this.renderRooms(projection.rooms);
    this.renderAgents(projection.agents, projection.rooms);
    this.renderOverlays(projection);
  }

  destroy(): void {
    this.destroyed = true;
    if (this.initialized) {
      try {
        this.app.destroy(true);
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
          fontSize: 14,
          fill: 0xcccccc,
          fontFamily: "monospace",
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

  private createAgentSprite(agent: AgentView): AgentSprite {
    const container = new Container();

    // 角色方块 (32x32 像素块)
    const body = new Graphics();
    body.rect(-16, -16, 32, 32).fill({ color: this.getStatusColor(agent.status) });
    body.stroke({ color: 0xffffff, width: 1 });

    // 名字
    const nameText = new Text({
      text: agent.name,
      style: new TextStyle({ fontSize: 10, fill: 0xffffff, fontFamily: "monospace" }),
    });
    nameText.anchor.set(0.5, 0);
    nameText.y = 18;

    // 状态
    const statusText = new Text({
      text: agent.status,
      style: new TextStyle({ fontSize: 8, fill: 0xaaaaaa, fontFamily: "monospace" }),
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
      targetX: 0,
      targetY: 0,
      currentX: 0,
      currentY: 0,
    };
  }

  private updateAgentSprite(
    sprite: AgentSprite,
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
      .fill({ color: this.getStatusColor(agent.status) })
      .stroke({ color: 0xffffff, width: 1 });

    // 根据 currentRoomId 定位
    if (agent.currentRoomId) {
      const room = rooms.find((r) => r.roomId === agent.currentRoomId);
      if (room) {
        // 在房间内随机偏移定位（基于 agentId 哈希）
        const hash = agent.agentId.charCodeAt(agent.agentId.length - 1);
        const offsetX = ((hash % 3) - 1) * 80;
        const offsetY = ((hash % 2) - 0.5) * 100;
        sprite.targetX = room.bounds.x + room.bounds.width / 2 + offsetX;
        sprite.targetY = room.bounds.y + room.bounds.height / 2 + offsetY;
      }
    } else {
      // 没有 room 的 agent 放在指挥区
      const commandRoom = rooms.find((r) => r.type === "command");
      if (commandRoom) {
        sprite.targetX = commandRoom.bounds.x + commandRoom.bounds.width / 2;
        sprite.targetY = commandRoom.bounds.y + commandRoom.bounds.height / 2;
      }
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

    // 审批请求标记（闪烁的红圈）
    for (const approval of projection.pendingApprovals) {
      const task = projection.tasks.find((t) => t.taskId === approval.taskId);
      if (!task?.roomId) continue;
      const room = projection.rooms.find((r) => r.roomId === task.roomId);
      if (!room) continue;

      const pulse = (Math.sin(Date.now() / 300) + 1) / 2;
      const circle = new Graphics();
      circle
        .circle(room.bounds.x + room.bounds.width / 2, room.bounds.y + 20, 8 + pulse * 4)
        .fill({ color: 0xffff00, alpha: 0.3 + pulse * 0.4 })
        .stroke({ color: 0xffff00, width: 2 });

      const label = new Text({
        text: "审批!",
        style: new TextStyle({ fontSize: 10, fill: 0xffff00, fontFamily: "monospace" }),
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
        style: new TextStyle({ fontSize: 9, fill: 0xff4444, fontFamily: "monospace" }),
      });
      label.x = room.bounds.x + 8;
      label.y = room.bounds.y + room.bounds.height - 20;

      this.overlayLayer.addChild(label);
    }
  }

  private getStatusColor(status: string): number {
    return STATUS_COLORS[status] ?? 0x888888;
  }

  private update(): void {
    if (this.destroyed) return;

    // 平滑移动 agent 到目标位置
    for (const sprite of this.agentSprites.values()) {
      const dx = sprite.targetX - sprite.currentX;
      const dy = sprite.targetY - sprite.currentY;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        sprite.currentX += dx * 0.1;
        sprite.currentY += dy * 0.1;
        sprite.container.x = sprite.currentX;
        sprite.container.y = sprite.currentY;
      }
    }

    // 如果有 pendingApprovals，持续刷新 overlay 闪烁
    if (this.currentProjection && this.currentProjection.pendingApprovals.length > 0) {
      this.renderOverlays(this.currentProjection);
    }
  }
}
