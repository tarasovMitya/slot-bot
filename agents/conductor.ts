// Conductor — orchestrates all SEO agents, reports to Dmitry
import { callHaiku, callSonnet } from "./shared/claude.ts";
import { startPolling, sendMessage, sendLong } from "./shared/telegram.ts";
import type { TgMessage } from "./shared/telegram.ts";
import { CONDUCTOR_PROMPT } from "./shared/prompts.ts";
import { TOPIC_POOL, getAvailableTopics, topicToSlug } from "./topics.ts";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const TOKEN = process.env.CONDUCTOR_TOKEN!;
const GROUP_ID = process.env.SEO_GROUP_ID!;
const CHANNEL_ID = process.env.SEO_CHANNEL_ID!;
const DMITRY_ID = process.env.DMITRY_CHAT_ID || "865826947";
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
    return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  }
  return {
    lastReportDate: null,
    lastArticleDate: null,
    pendingApprovals: [],
    articlesThisMonth: 0,
    budgetUsed: 0,
  };
}

function saveState(state: ConductorState) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Get next topic not yet published
function getNextTopic(): typeof TOPIC_POOL[0] | null {
  const articlesFile = join(__dir, "../articles.json");
  if (!existsSync(articlesFile)) return TOPIC_POOL[0];
  const articles = JSON.parse(readFileSync(articlesFile, "utf-8")) as Array<{ slug: string }>;
  const existingSlugs = new Set(articles.map(a => a.slug));
  const available = getAvailableTopics(existingSlugs);
  return available[0] ?? null;
}

async function sendMorningReport(state: ConductorState) {
  const topic = getNextTopic();
  const report = `📊 SEO OS — утро ${today()}

✅ Опубликовано в этом месяце: ${state.articlesThisMonth}
📝 В очереди на апрув: ${state.pendingApprovals.length}
🎯 План на сегодня:
• Написать статью: "${topic?.title ?? "тема не найдена"}"
• SERP-аудит топ ключей
💰 Бюджет: $${state.budgetUsed.toFixed(2)} / $5.00`;

  await sendMessage(TOKEN, DMITRY_ID, report);
  state.lastReportDate = today();
  saveState(state);
}

async function requestArticle(topic: typeof TOPIC_POOL[0]) {
  const taskId = `T${Date.now()}`;
  const msg = `@slot_copywriter_bot TASK_ID:${taskId} ACTION:write
Тема: ${topic.title}
Ключ: ${topic.keyword}
Категория: ${topic.category}
categorySlug: ${topic.categorySlug}
Intent: ${topic.intent}`;
  await sendMessage(TOKEN, GROUP_ID, msg);
  return taskId;
}

async function handleApproval(msg: TgMessage, state: ConductorState) {
  const text = msg.text ?? "";
  const approveMatch = text.match(/\[Approve\]\s*([a-z0-9-]+)/i);
  const rejectMatch = text.match(/\[Reject\]\s*([a-z0-9-]+)/i);
  const editMatch = text.match(/\[Edit:\s*(.+?)\]\s*([a-z0-9-]+)/is);

  if (approveMatch) {
    const slug = approveMatch[1];
    const pending = state.pendingApprovals.find(p => p.slug === slug);
    if (!pending) {
      await sendMessage(TOKEN, DMITRY_ID, `❓ Не найдена статья с slug: ${slug}`);
      return;
    }
    // Send publish task
    const taskId = `P${Date.now()}`;
    await sendMessage(TOKEN, GROUP_ID,
      `@slot_distrib_bot TASK_ID:${taskId} ACTION:publish\n${pending.json}`);
    state.pendingApprovals = state.pendingApprovals.filter(p => p.slug !== slug);
    state.articlesThisMonth++;
    state.budgetUsed += 0.05;
    saveState(state);
    await sendMessage(TOKEN, DMITRY_ID, `✅ Статья "${pending.title}" отправлена на публикацию.`);
  } else if (rejectMatch) {
    const slug = rejectMatch[1];
    state.pendingApprovals = state.pendingApprovals.filter(p => p.slug !== slug);
    saveState(state);
    await sendMessage(TOKEN, DMITRY_ID, `🗑 Статья ${slug} отклонена и удалена из очереди.`);
  } else if (editMatch) {
    const feedback = editMatch[1];
    const slug = editMatch[2];
    const pending = state.pendingApprovals.find(p => p.slug === slug);
    if (pending) {
      const taskId = `E${Date.now()}`;
      await sendMessage(TOKEN, GROUP_ID,
        `@slot_copywriter_bot TASK_ID:${taskId} ACTION:edit\nSlug: ${slug}\nПравки: ${feedback}\n${pending.json}`);
    }
  }
}

async function handleCommand(text: string, chatId: number, state: ConductorState) {
  if (text === "/report" || text === "/report@slot_conductor_bot") {
    await sendMorningReport(state);
  } else if (text === "/status" || text === "/status@slot_conductor_bot") {
    const topic = getNextTopic();
    await sendMessage(TOKEN, chatId,
      `🤖 SEO OS Status\n\n` +
      `Агентов активно: 7\n` +
      `Статей в очереди: ${state.pendingApprovals.length}\n` +
      `Следующая тема: ${topic?.title ?? "пул пуст"}\n` +
      `Бюджет: $${state.budgetUsed.toFixed(2)} / $5.00`);
  } else if (text.startsWith("/generate ") || text.startsWith("/generate@slot_conductor_bot ")) {
    const customTopic = text.replace(/^\/generate(@\S+)?\s+/, "");
    await sendMessage(TOKEN, GROUP_ID,
      `@slot_copywriter_bot TASK_ID:T${Date.now()} ACTION:write\nТема: ${customTopic}`);
    await sendMessage(TOKEN, chatId, `📝 Запрос на статью отправлен: "${customTopic}"`);
  } else if (text === "/stop" || text === "/stop@slot_conductor_bot") {
    await sendMessage(TOKEN, chatId, `🛑 Остановка по команде. Активные задачи завершат работу.`);
    process.exit(0);
  }
}

// Receive article from copywriter (JSON in group message from copywriter bot)
async function handleGroupMessage(msg: TgMessage, state: ConductorState) {
  const text = msg.text ?? "";

  // Article JSON delivered by copywriter
  if (text.startsWith("ARTICLE_READY TASK_ID:")) {
    const jsonStart = text.indexOf("\n{");
    if (jsonStart === -1) return;
    const jsonStr = text.slice(jsonStart + 1);
    try {
      const article = JSON.parse(jsonStr);
      const preview = `📝 Статья готова к апруву\n\nТема: ${article.title}\nSlug: ${article.slug}\nКатегория: ${article.category}\nВремя чтения: ${article.readTime} мин\n\n— — — превью — — —\n${article.sections.find((s: {type:string;text?:string}) => s.type === "p")?.text ?? ""}\n— — — — — — — — —\n\n[Approve] ${article.slug}\n[Reject] ${article.slug}\n[Edit: правки] ${article.slug}`;

      state.pendingApprovals.push({
        taskId: `T${Date.now()}`,
        slug: article.slug,
        title: article.title,
        json: jsonStr,
        requestedAt: new Date().toISOString(),
      });
      saveState(state);
      await sendLong(TOKEN, DMITRY_ID, preview);
    } catch (e) {
      console.error("[conductor] failed to parse article JSON:", e);
    }
  }
}

export async function startConductor() {
  if (!TOKEN) { console.warn("[conductor] CONDUCTOR_TOKEN not set, skipping"); return; }

  const state = loadState();

  // Daily schedule check every minute
  setInterval(async () => {
    const now = new Date();
    const h = now.getUTCHours();
    const m = now.getUTCMinutes();

    // 06:00 UTC = 09:00 MSK — morning report
    if (h === 6 && m === 0 && state.lastReportDate !== today()) {
      await sendMorningReport(state).catch(console.error);
    }

    // 07:30 UTC = 10:30 MSK — request new article
    if (h === 7 && m === 30 && state.lastArticleDate !== today()) {
      if (state.budgetUsed < 4.50) {
        const topic = getNextTopic();
        if (topic) {
          await requestArticle(topic).catch(console.error);
          state.lastArticleDate = today();
          saveState(state);
        }
      }
    }
  }, 60_000);

  console.log(`[conductor] starting, GROUP_ID=${GROUP_ID}, DMITRY=${DMITRY_ID}`);

  startPolling(TOKEN, async (msg: TgMessage) => {
    const text = msg.text ?? "";
    const chatType = msg.chat.type;
    const isPrivate = chatType === "private";
    const fromId = msg.from?.id;

    console.log(`[conductor] msg from=${fromId} chat=${msg.chat.id} type=${chatType} text=${text.slice(0,50)}`);

    if (isPrivate) {
      if (text === "/start") {
        await sendMessage(TOKEN, msg.chat.id,
          `🤖 SEO Conductor online\n\nТвой ID: ${fromId}\n\nКоманды:\n/status — статус системы\n/report — утренний отчёт\n/generate [тема] — написать статью`);
      } else if (text.startsWith("/")) {
        await handleCommand(text, msg.chat.id, state);
      } else if (text.includes("[Approve]") || text.includes("[Reject]") || text.includes("[Edit:")) {
        await handleApproval(msg, state);
      } else {
        const reply = await callHaiku(CONDUCTOR_PROMPT, text);
        await sendMessage(TOKEN, msg.chat.id, reply);
      }
    } else if (chatType === "group" || chatType === "supergroup") {
      await handleGroupMessage(msg, state);
    }
  }, "conductor");
}
