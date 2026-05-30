// Distribution — publishes approved content to Telegram/VK/vc.ru
import { startPolling, sendMessage, TgMessage } from "./shared/telegram.ts";
import { DISTRIBUTION_PROMPT } from "./shared/prompts.ts";
import { postToVk } from "../vk.ts";

const TOKEN = process.env.DISTRIBUTION_TOKEN!;
const GROUP_ID = process.env.SEO_GROUP_ID!;
const BOT_TOKEN = process.env.BOT_TOKEN!;
const CHANNEL = process.env.CHANNEL_ID || "@slot_home_msk";
const SITE = "https://slot-home.ru";

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
};

interface Section {
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
  sections: Section[];
}

function extractContent(sections: Section[]) {
  let intro = "";
  const bullets: string[] = [];
  const prices: Array<{ label: string; value: string }> = [];
  let tip = "";

  for (const s of sections) {
    if (s.type === "p" && !intro && s.text) intro = s.text;
    else if ((s.type === "ul" || s.type === "ol") && !bullets.length && s.items) {
      bullets.push(...s.items.slice(0, 5));
    } else if (s.type === "table" && !prices.length && s.rows) {
      prices.push(...s.rows.slice(0, 5));
    } else if (s.type === "tip" && !tip && s.text) {
      tip = s.text;
    }
  }
  return { intro, bullets, prices, tip };
}

function formatTelegram(article: Article): string {
  const { intro, bullets, prices, tip } = extractContent(article.sections);
  const em = CATEGORY_EMOJI[article.category] || "📌";
  const url = `${SITE}/blog/${article.slug}`;
  let text = `${em} <b>${article.title}</b>\n\n`;
  if (intro) text += `${intro}\n\n`;
  if (bullets.length) {
    text += `<b>Ключевые моменты:</b>\n`;
    for (const b of bullets) text += `• ${b}\n`;
    text += "\n";
  }
  if (prices.length) {
    text += `<b>Цены в Москве 2026:</b>\n`;
    for (const p of prices) text += `• ${p.label}: ${p.value}\n`;
    text += "\n";
  }
  if (tip) text += `💡 <i>${tip}</i>\n\n`;
  text += `📖 <a href="${url}">Читать полностью на сайте</a>`;
  return text;
}

function formatVk(article: Article): string {
  const { intro, bullets, prices, tip } = extractContent(article.sections);
  const em = CATEGORY_EMOJI[article.category] || "📌";
  const url = `${SITE}/blog/${article.slug}`;
  let text = `${em} ${article.title}\n\n`;
  if (intro) text += `${intro}\n\n`;
  if (bullets.length) {
    text += `📌 Ключевые моменты:\n`;
    for (const b of bullets) text += `• ${b}\n`;
    text += "\n";
  }
  if (prices.length) {
    text += `💰 Цены в Москве 2026:\n`;
    for (const p of prices) text += `• ${p.label}: ${p.value}\n`;
    text += "\n";
  }
  if (tip) text += `💡 ${tip}\n\n`;
  text += `📖 Читать полностью: ${url}\n\n`;
  const tag = article.categorySlug || "слуги";
  text += `#${tag} #слот_хоум #москва #мастер_на_дом`;
  return text;
}

async function postToTelegramChannel(text: string): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHANNEL, text, parse_mode: "HTML" }),
  });
  const d = await res.json() as { ok: boolean; description?: string };
  if (!d.ok) throw new Error(`Telegram error: ${d.description}`);
}

export async function startDistribution() {
  if (!TOKEN) { console.warn("[distribution] DISTRIBUTION_TOKEN not set, skipping"); return; }

  startPolling(TOKEN, async (msg: TgMessage) => {
    const text = msg.text ?? "";
    if (!text.includes("@slot_distrib_bot")) return;

    const taskId = text.match(/TASK_ID:(\S+)/)?.[1] ?? `T${Date.now()}`;
    const jsonStart = text.indexOf("\n{");
    if (jsonStart === -1) {
      await sendMessage(TOKEN, GROUP_ID, `❌ TASK_ID:${taskId} — JSON статьи не найден`);
      return;
    }

    let article: Article;
    try {
      article = JSON.parse(text.slice(jsonStart + 1));
    } catch (e) {
      await sendMessage(TOKEN, GROUP_ID, `❌ TASK_ID:${taskId} — ошибка парсинга JSON: ${e}`);
      return;
    }

    await sendMessage(TOKEN, GROUP_ID, `📤 TASK_ID:${taskId} — публикую "${article.title}"...`);

    const results: string[] = [];

    try {
      await postToTelegramChannel(formatTelegram(article));
      results.push(`✅ Telegram: @slot_home_msk`);
    } catch (e) {
      results.push(`❌ Telegram: ${e}`);
    }

    await new Promise(r => setTimeout(r, 2000));

    try {
      const vkResult = await postToVk({ message: formatVk(article) });
      results.push(`✅ VK: ${vkResult.url}`);
    } catch (e) {
      results.push(`❌ VK: ${e}`);
    }

    await sendMessage(TOKEN, GROUP_ID,
      `PUBLISH_DONE TASK_ID:${taskId}\n${results.join("\n")}`);
  }, "distribution");
}
