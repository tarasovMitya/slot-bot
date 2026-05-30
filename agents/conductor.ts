// Conductor — orchestrates all SEO agents, reports to Dmitry
import { Bot } from "grammy";
import { callHaiku } from "./shared/claude.ts";
import { sendMessage, sendLong } from "./shared/telegram.ts";
import { CONDUCTOR_PROMPT } from "./shared/prompts.ts";
import { TOPIC_POOL, getAvailableTopics } from "./topics.ts";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const TOKEN = process.env.CONDUCTOR_TOKEN!;
const GROUP_ID = process.env.SEO_GROUP_ID!;
const DMITRY_ID = process.env.DMITRY_CHAT_ID || "865826947";

const __dir = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dir, "../conductor-state.json");

interface ConductorState {
  lastReportDate: string | null;
  lastArticleDate: string | null;
  pendingApprovals: PendingApproval[];
  articlesThisMonth: number;
  budgetUsed: number;
}

interface PendingApproval {
  taskId: string;
  slug: string;
  title: string;
  json: string;
  requestedAt: string;
}

function loadState(): ConductorState {
  if (existsSync(STATE_FILE)) {
    try { return JSON.parse(readFileSync(STATE_FILE, "utf-8")); } catch {}
  }
  return { lastReportDate: null, lastArticleDate: null, pendingApprovals: [], articlesThisMonth: 0, budgetUsed: 0 };
}

function saveState(state: ConductorState) {
  try { writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); } catch {}
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function getNextTopic() {
  const articlesFile = join(__dir, "../articles.json");
  if (!existsSync(articlesFile)) return TOPIC_POOL[0];
  try {
    const articles = JSON.parse(readFileSync(articlesFile, "utf-8")) as Array<{ slug: string }>;
    const available = getAvailableTopics(new Set(articles.map(a => a.slug)));
    return available[0] ?? null;
  } catch { return TOPIC_POOL[0]; }
}

async function sendMorningReport(state: ConductorState) {
  const topic = getNextTopic();
  const report = `📊 SEO OS — утро ${today()}

✅ Опубликовано в этом месяце: ${state.articlesThisMonth}
📝 На апруве: ${state.pendingApprovals.length}
🎯 Сегодня: "${topic?.title ?? "пул пуст"}"
💰 Бюджет: $${state.budgetUsed.toFixed(2)} / $5.00`;
  await sendMessage(TOKEN, DMITRY_ID, report);
  state.lastReportDate = today();
  saveState(state);
}

async function requestArticle(topic: typeof TOPIC_POOL[0]) {
  const taskId = `T${Date.now()}`;
  await sendMessage(TOKEN, GROUP_ID,
    `@slot_copywriter_bot TASK_ID:${taskId} ACTION:write\nТема: ${topic.title}\nКлюч: ${topic.keyword}\nКатегория: ${topic.category}\ncategorySlug: ${topic.categorySlug}`);
  return taskId;
}

export async function startConductor() {
  if (!TOKEN) { console.warn("[conductor] CONDUCTOR_TOKEN not set, skipping"); return; }

  console.log("[conductor] initializing grammy bot...");
  const state = loadState();
  const bot = new Bot(TOKEN);

  bot.command("start", async (ctx) => {
    await ctx.reply(`🤖 SEO Conductor online\n\nТвой ID: ${ctx.from?.id}\n\n/status — статус\n/report — отчёт\n/generate [тема] — статья`);
  });

  bot.command("status", async (ctx) => {
    const topic = getNextTopic();
    await ctx.reply(`🤖 SEO OS Status\n\nСтатей в очереди: ${state.pendingApprovals.length}\nСледующая тема: ${topic?.title ?? "пул пуст"}\nБюджет: $${state.budgetUsed.toFixed(2)} / $5.00`);
  });

  bot.command("report", async (ctx) => {
    await sendMorningReport(state);
    await ctx.reply("📊 Отчёт отправлен");
  });

  bot.command("stop", async (ctx) => {
    await ctx.reply("🛑 Остановка...");
    process.exit(0);
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    const isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup";

    if (isGroup) {
      // Handle article delivery from copywriter
      if (text.startsWith("ARTICLE_READY TASK_ID:")) {
        const jsonStart = text.indexOf("\n{");
        if (jsonStart === -1) return;
        try {
          const article = JSON.parse(text.slice(jsonStart + 1));
          const preview = `📝 Статья на апрув\n\nТема: ${article.title}\nSlug: ${article.slug}\nКатегория: ${article.category}\nЧтение: ${article.readTime} мин\n\n— превью —\n${article.sections?.find((s: {type:string;text?:string}) => s.type === "p")?.text ?? ""}\n— — —\n\n[Approve] ${article.slug}\n[Reject] ${article.slug}`;
          state.pendingApprovals.push({ taskId: `T${Date.now()}`, slug: article.slug, title: article.title, json: text.slice(jsonStart + 1), requestedAt: new Date().toISOString() });
          saveState(state);
          await sendLong(TOKEN, DMITRY_ID, preview);
        } catch (e) { console.error("[conductor] article parse error:", e); }
      }
      return;
    }

    // Private chat — handle approvals and questions
    if (text.includes("[Approve]")) {
      const slug = text.match(/\[Approve\]\s*([a-z0-9-]+)/i)?.[1];
      const pending = state.pendingApprovals.find(p => p.slug === slug);
      if (pending) {
        await sendMessage(TOKEN, GROUP_ID, `@slot_distrib_bot TASK_ID:P${Date.now()} ACTION:publish\n${pending.json}`);
        state.pendingApprovals = state.pendingApprovals.filter(p => p.slug !== slug);
        state.articlesThisMonth++;
        state.budgetUsed += 0.05;
        saveState(state);
        await ctx.reply(`✅ Статья "${pending.title}" отправлена на публикацию`);
      }
    } else if (text.includes("[Reject]")) {
      const slug = text.match(/\[Reject\]\s*([a-z0-9-]+)/i)?.[1];
      state.pendingApprovals = state.pendingApprovals.filter(p => p.slug !== slug);
      saveState(state);
      await ctx.reply(`🗑 Статья ${slug} отклонена`);
    } else if (!text.startsWith("/")) {
      try {
        const reply = await callHaiku(CONDUCTOR_PROMPT, text);
        await ctx.reply(reply);
      } catch (e) { await ctx.reply(`❌ Ошибка Claude API: ${e}`); }
    }
  });

  // Daily schedule
  setInterval(async () => {
    const now = new Date();
    const h = now.getUTCHours(), m = now.getUTCMinutes();
    if (h === 6 && m === 0 && state.lastReportDate !== today()) {
      await sendMorningReport(state).catch(console.error);
    }
    if (h === 7 && m === 30 && state.lastArticleDate !== today() && state.budgetUsed < 4.50) {
      const topic = getNextTopic();
      if (topic) {
        await requestArticle(topic).catch(console.error);
        state.lastArticleDate = today();
        saveState(state);
      }
    }
  }, 60_000);

  console.log("[conductor] starting grammy polling...");
  // Send startup ping to group to verify the bot is alive
  if (GROUP_ID) {
    sendMessage(TOKEN, GROUP_ID, "🤖 Conductor online — polling started").catch(e =>
      console.error("[conductor] startup ping failed:", e)
    );
  }
  bot.start({ onStart: () => console.log("[conductor] polling active ✅") }).catch(e =>
    console.error("[conductor] bot.start error:", e)
  );
}
