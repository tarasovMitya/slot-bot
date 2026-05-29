// Daily blog post publisher: 3 articles per day to Telegram + VK
// Reads articles from articles.json, filters by publishedAt === today
// Usage: node --experimental-strip-types post-daily.ts [YYYY-MM-DD]

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { postToVk } from "./vk.ts";

const __dir = dirname(fileURLToPath(import.meta.url));

interface SectionBlock {
  type: string;
  text?: string;
  items?: string[];
  rows?: Array<{ label: string; value: string }>;
}

interface Article {
  slug: string;
  title: string;
  category: string;
  categorySlug: string;
  publishedAt: string;
  sections: SectionBlock[];
}

const ARTICLES: Article[] = JSON.parse(
  readFileSync(join(__dir, "articles.json"), "utf-8")
);

const BOT_TOKEN = process.env.BOT_TOKEN!;
const CHANNEL = process.env.CHANNEL_ID || "@slot_home_msk";
const SITE = "https://slot-home.ru";
const MAX_PER_DAY = 3;

const TARGET_DATE = process.argv[2] || new Date().toISOString().slice(0, 10);

// ── Category emoji map ────────────────────────────────────────────────────────

const CATEGORY_EMOJI: Record<string, string> = {
  "Электрика": "⚡",
  "Сантехника": "💧",
  "Уборка": "🧹",
  "Химчистка": "🧴",
  "Сборка мебели": "🛋",
  "Муж на час": "🔨",
  "Установка ТВ": "📺",
  "Установка дверей": "🚪",
  "Ремонт": "🏗",
  "Кондиционеры": "❄️",
  "Советы": "💡",
  "Истории клиентов": "📖",
};

function emoji(article: Article): string {
  return CATEGORY_EMOJI[article.category] || "📌";
}

// ── Extract key content from sections ────────────────────────────────────────

function extractContent(sections: SectionBlock[]) {
  let intro = "";
  const bullets: string[] = [];
  const prices: Array<{ label: string; value: string }> = [];
  const tips: string[] = [];

  for (const s of sections) {
    if (s.type === "p" && !intro && s.text) {
      intro = s.text;
    } else if ((s.type === "ul" || s.type === "ol") && bullets.length === 0 && s.items) {
      bullets.push(...s.items.slice(0, 6));
    } else if (s.type === "table" && prices.length === 0 && s.rows) {
      prices.push(...s.rows.slice(0, 5));
    } else if (s.type === "tip" && tips.length === 0 && s.text) {
      tips.push(s.text);
    }
  }

  return { intro, bullets, prices, tips };
}

// ── Format VK post (full content, plain text) ─────────────────────────────────

function formatVk(article: Article): string {
  const { intro, bullets, prices, tips } = extractContent(article.sections);
  const url = `${SITE}/blog/${article.slug}`;
  const em = emoji(article);

  let text = `${em} ${article.title}\n\n`;

  if (intro) text += `${intro}\n\n`;

  if (bullets.length > 0) {
    text += `📌 Ключевые моменты:\n`;
    for (const b of bullets) text += `• ${b}\n`;
    text += "\n";
  }

  if (prices.length > 0) {
    text += `💰 Цены в Москве 2026:\n`;
    for (const p of prices) text += `• ${p.label}: ${p.value}\n`;
    text += "\n";
  }

  if (tips.length > 0) {
    text += `💡 ${tips[0]}\n\n`;
  }

  text += `📖 Читать полностью: ${url}\n\n`;

  const tag = article.categorySlug || article.category.toLowerCase().replace(/\s+/g, "_");
  text += `#${tag} #слот_хоум #москва #мастер_на_дом`;

  return text;
}

// ── Format Telegram post (HTML) ───────────────────────────────────────────────

function formatTelegram(article: Article): string {
  const { intro, bullets, prices, tips } = extractContent(article.sections);
  const url = `${SITE}/blog/${article.slug}`;
  const em = emoji(article);

  let text = `${em} <b>${article.title}</b>\n\n`;

  if (intro) text += `${intro}\n\n`;

  if (bullets.length > 0) {
    text += `<b>Ключевые моменты:</b>\n`;
    for (const b of bullets) text += `• ${b}\n`;
    text += "\n";
  }

  if (prices.length > 0) {
    text += `<b>Цены в Москве 2026:</b>\n`;
    for (const p of prices) text += `• ${p.label}: ${p.value}\n`;
    text += "\n";
  }

  if (tips.length > 0) {
    text += `💡 <i>${tips[0]}</i>\n\n`;
  }

  text += `📖 <a href="${url}">Читать полностью на сайте</a>`;

  return text;
}

// ── Post to Telegram ──────────────────────────────────────────────────────────

async function postTelegram(text: string): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHANNEL,
      text,
      parse_mode: "HTML",
      link_preview_options: { is_disabled: false },
    }),
  });
  const d = await res.json() as { ok: boolean; description?: string };
  if (!d.ok) throw new Error(`Telegram error: ${d.description}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const todayArticles = ARTICLES
  .filter(a => a.publishedAt === TARGET_DATE)
  .slice(0, MAX_PER_DAY);

if (todayArticles.length === 0) {
  console.log(`No articles scheduled for ${TARGET_DATE}`);
  process.exit(0);
}

console.log(`Publishing ${todayArticles.length} articles for ${TARGET_DATE}...`);

let posted = 0;

for (const article of todayArticles) {
  console.log(`\n→ ${article.title}`);

  try {
    await postTelegram(formatTelegram(article));
    console.log(`  ✅ Telegram`);
  } catch (e) {
    console.log(`  ❌ Telegram: ${e}`);
  }

  await new Promise(r => setTimeout(r, 2000));

  try {
    const result = await postToVk({ message: formatVk(article) });
    console.log(`  ✅ VK: ${result.url}`);
  } catch (e) {
    console.log(`  ❌ VK: ${e}`);
  }

  posted++;
  if (posted < todayArticles.length) {
    await new Promise(r => setTimeout(r, 10000));
  }
}

console.log(`\n✅ Done: ${posted} articles published for ${TARGET_DATE}`);
