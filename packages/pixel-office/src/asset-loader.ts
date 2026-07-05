/**
 * AssetLoader — 加载并管理 V1 像素资产。
 *
 * - 使用 PixiJS Assets 异步加载 PNG 纹理。
 * - 暴露加载进度与失败列表。
 * - 渲染器可通过 getTexture 同步查询；未加载或失败时返回 null。
 */
import { Assets, Texture, Rectangle } from "pixi.js";

export interface AssetLoadResult {
  loaded: number;
  total: number;
  failed: string[];
}

const V1_ASSETS: string[] = [
  "agents/orchestrator-idle",
  "agents/orchestrator-walk",
  "agents/orchestrator-working",
  "agents/orchestrator-blocked",
  "agents/worker-idle",
  "agents/worker-walk",
  "agents/worker-working",
  "agents/worker-blocked",
  "agents/reviewer-idle",
  "agents/reviewer-walk",
  "agents/reviewer-working",
  "agents/reviewer-blocked",
  "rooms/floor-command",
  "rooms/floor-execution",
  "rooms/floor-review",
  "rooms/floor-approval",
  "props/desk-shared",
  "props/workbench",
  "props/review-table",
  "props/approval-counter",
  "effects/service-bell",
  "effects/sparkle",
  "effects/blocked-marker",
];

function textureName(assetPath: string): string {
  return assetPath.split("/").pop() ?? assetPath;
}

export class AssetLoader {
  private textures = new Map<string, Texture>();
  private failed: string[] = [];
  private total = 0;
  private loaded = 0;

  constructor(private basePath: string = "") {}

  async loadAll(assetNames: string[] = V1_ASSETS): Promise<AssetLoadResult> {
    this.textures.clear();
    this.failed = [];
    this.total = assetNames.length;
    this.loaded = 0;

    await Promise.all(
      assetNames.map(async (name) => {
        try {
          const url = `${this.basePath}${name}.png`;
          const texture = await Assets.load(url);
          this.textures.set(textureName(name), texture);
          this.loaded++;
        } catch {
          this.failed.push(textureName(name));
        }
      })
    );

    return this.getProgress();
  }

  getTexture(name: string): Texture | null {
    return this.textures.get(name) ?? null;
  }

  /**
   * Split a horizontal sprite strip into `frameCount` animation frames.
   * Returns null if the source texture is missing or too narrow.
   */
  getAnimationFrames(name: string, frameCount: number): Texture[] | null {
    const strip = this.getTexture(name);
    if (!strip || strip.width < frameCount) return null;
    const frameWidth = Math.floor(strip.width / frameCount);
    const frames: Texture[] = [];
    for (let i = 0; i < frameCount; i++) {
      const frame = new Rectangle(i * frameWidth, 0, frameWidth, strip.height);
      frames.push(new Texture({ source: strip.source, frame }));
    }
    return frames;
  }

  getProgress(): AssetLoadResult {
    return {
      loaded: this.loaded,
      total: this.total,
      failed: [...this.failed],
    };
  }
}
