/**
 * Minimal PixiJS stub for node-based renderer tests.
 *
 * The stub records draw calls and child additions so tests can assert
 * on renderer behavior without a real canvas / WebGL context.
 */
import { vi } from "vitest";

export class MockGraphics {
  public commands: Array<{ type: string; args: unknown[] }> = [];
  public strokeStyle: { color?: number; width?: number } | null = null;
  public fillStyle: { color?: number; alpha?: number } | null = null;

  rect(x: number, y: number, w: number, h: number): this {
    this.commands.push({ type: "rect", args: [x, y, w, h] });
    return this;
  }

  moveTo(x: number, y: number): this {
    this.commands.push({ type: "moveTo", args: [x, y] });
    return this;
  }

  lineTo(x: number, y: number): this {
    this.commands.push({ type: "lineTo", args: [x, y] });
    return this;
  }

  closePath(): this {
    this.commands.push({ type: "closePath", args: [] });
    return this;
  }

  circle(x: number, y: number, r: number): this {
    this.commands.push({ type: "circle", args: [x, y, r] });
    return this;
  }

  fill(style?: { color?: number; alpha?: number }): this {
    this.fillStyle = style ?? null;
    this.commands.push({ type: "fill", args: [style] });
    return this;
  }

  stroke(style?: { color?: number; width?: number }): this {
    this.strokeStyle = style ?? null;
    this.commands.push({ type: "stroke", args: [style] });
    return this;
  }

  clear(): this {
    this.commands = [];
    this.strokeStyle = null;
    this.fillStyle = null;
    return this;
  }
}

export class MockText {
  public anchor = { set: vi.fn(), x: 0, y: 0 };
  public x = 0;
  public y = 0;
  public text: string;
  public style: unknown;

  constructor(options: { text?: string; style?: unknown } = {}) {
    this.text = options.text ?? "";
    this.style = options.style;
  }
}

export class MockContainer {
  public children: unknown[] = [];
  public x = 0;
  public y = 0;
  public removed = false;

  addChild(child: unknown): unknown {
    this.children.push(child);
    return child;
  }

  removeChild(child: unknown): unknown {
    this.children = this.children.filter((c) => c !== child);
    return child;
  }

  removeChildren(): void {
    this.children = [];
  }

  getChildAt(index: number): unknown {
    return this.children[index];
  }

  removeChildAt(index: number): unknown {
    const child = this.children[index];
    this.children = this.children.filter((_, i) => i !== index);
    return child;
  }

  addChildAt(child: unknown, index: number): unknown {
    this.children.splice(index, 0, child);
    return child;
  }
}

export class MockApplication {
  public stage = new MockContainer();
  public ticker = { add: vi.fn(), remove: vi.fn() };
  public destroyed = false;
  public initOptions: unknown = null;

  async init(options: unknown): Promise<void> {
    this.initOptions = options;
  }

  destroy(): void {
    this.destroyed = true;
  }
}

export class MockTextStyle {
  constructor(public style: unknown) {}
}

export class MockRectangle {
  constructor(
    public x: number,
    public y: number,
    public width: number,
    public height: number
  ) {}
}

export class MockTexture {
  public width = 32;
  public height = 32;
  public baseTexture = this;
  public frame = { x: 0, y: 0, width: 32, height: 32 };
  public sourceUrl: string;
  public source: MockTexture;

  constructor(arg: string | { source?: MockTexture; frame?: unknown }) {
    if (typeof arg === "string") {
      this.sourceUrl = arg;
    } else {
      this.source = arg.source ?? this;
      this.sourceUrl = this.source.sourceUrl;
      if (arg.frame && typeof arg.frame === "object" && arg.frame !== null) {
        const f = arg.frame as { x: number; y: number; width: number; height: number };
        this.frame = { x: f.x, y: f.y, width: f.width, height: f.height };
      }
    }
    this.source ??= this;
  }
}

export class MockSprite extends MockContainer {
  public texture: MockTexture | null = null;
  public width = 0;
  public height = 0;
  public anchor = { set: vi.fn(), x: 0, y: 0 };
  public scale = { set: vi.fn(), x: 1, y: 1 };
  public visible = true;

  constructor(texture?: MockTexture) {
    super();
    if (texture) this.texture = texture;
  }
}

export class MockAssets {
  private static textures = new Map<string, MockTexture>();
  private static failSet = new Set<string>();

  static reset(textures: Record<string, MockTexture> = {}, fail: string[] = []): void {
    this.textures = new Map(Object.entries(textures));
    this.failSet = new Set(fail);
  }

  static async load(url: string): Promise<MockTexture> {
    const name = url.split("/").pop()!.replace(".png", "");
    if (this.failSet.has(name)) {
      throw new Error(`Failed to load ${url}`);
    }
    const texture = this.textures.get(name);
    if (!texture) {
      throw new Error(`Texture not found: ${url}`);
    }
    return texture;
  }
}

export function createPixiMock() {
  return {
    Application: MockApplication,
    Container: MockContainer,
    Graphics: MockGraphics,
    Text: MockText,
    TextStyle: MockTextStyle,
    Texture: MockTexture,
    Sprite: MockSprite,
    Assets: MockAssets,
    Rectangle: MockRectangle,
  };
}
