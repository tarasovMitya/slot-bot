#!/usr/bin/env ts-node
// Generates a cover image for a blog article using Pollinations.ai (free, no API key).
// Saves the image to calc/public/blog-images/<slug>.jpg
//
// Usage:
//   ts-node generate-image.ts <slug> "<article title>" "<category>"

import { createWriteStream } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const IMAGES_DIR = resolve(__dirname, "../calc/public/blog-images");

// Maps category to visual context for better prompts
const CATEGORY_CONTEXT: Record<string, string> = {
  "Электрика":    "electrical panel, copper wiring, modern apartment fuse box, professional electrical tools",
  "Сантехника":   "bathroom plumbing pipes, chrome faucet, modern sink installation, wrench and fittings",
  "Уборка":       "bright clean modern living room, cleaning supplies, fresh sparkling apartment interior",
  "Сборка мебели":"flat-pack furniture assembly, allen key, wooden panels, modern apartment interior",
  "Ремонт":       "apartment renovation, paint roller, fresh white walls, construction tools",
  "Мастер на час":"toolbox, drill, measuring tape, handyman tools, modern Moscow apartment",
};

async function generateImage(slug: string, title: string, category: string): Promise<string> {
  const context = CATEGORY_CONTEXT[category] || "home services, professional tools, modern apartment";

  const prompt = [
    `Professional photo for home services blog: ${title}.`,
    context,
    `Modern Moscow apartment interior. Clean minimalist style. Natural light. High contrast. No people faces. No text. Wide shot.`,
  ].join(" ");

  const encodedPrompt = encodeURIComponent(prompt);
  // Pollinations.ai — free, no auth, Flux model, WebP for smaller file size
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1792&height=1008&model=flux&nologo=true&enhance=true`;

  console.log(`🎨 Generating image for "${title}" via Pollinations.ai...`);

  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Pollinations.ai error ${response.status}`);
  }

  // Save as .jpg (Pollinations returns JPEG; rename to .webp if content-type is webp)
  const contentType = response.headers.get("content-type") || "";
  const ext = contentType.includes("webp") ? "webp" : "jpg";
  const filename = `${slug}.${ext}`;
  const outputPath = resolve(IMAGES_DIR, filename);

  await pipeline(Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(outputPath));

  console.log(`✅ Saved: public/blog-images/${filename}`);
  return `/blog-images/${filename}`;
}

export { generateImage };

// CLI entry (only when run directly)
const isMain = process.argv[1]?.endsWith("generate-image.ts") || process.argv[1]?.endsWith("generate-image.js");
if (isMain) {
  const [, , slug, title, category] = process.argv;
  if (!slug || !title) {
    console.error("Usage: ts-node generate-image.ts <slug> <title> [category]");
    process.exit(1);
  }
  generateImage(slug, title, category || "Мастер на час")
    .then((path) => console.log(`Cover image path: ${path}`))
    .catch((e) => { console.error(e); process.exit(1); });
}
