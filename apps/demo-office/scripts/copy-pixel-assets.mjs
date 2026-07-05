#!/usr/bin/env node
/**
 * Copy pixel-office sprite assets into demo-office/public/assets so Vite
 * serves them in dev and includes them in the production build.
 */
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = join(__dirname, "..", "..", "..", "packages", "pixel-office", "assets");
const target = join(__dirname, "..", "public", "assets");

if (!existsSync(source)) {
  console.error(`Pixel asset source not found: ${source}`);
  process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });
cpSync(source, target, { recursive: true, force: true });
console.log(`Copied pixel assets to ${target}`);
