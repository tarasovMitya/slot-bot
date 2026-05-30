import { Bot } from "grammy";
import { callHaiku } from "./shared/claude.ts";
import { sendMessage } from "./shared/telegram.ts";
import { SEARCHER_PROMPT } from "./shared/prompts.ts";

const TOKEN = process.env.SEARCHER_TOKEN!;
const GROUP_ID = process.env.SEO_GROUP_ID!;

export async function startSearcher() {
  if (!TOKEN) { console.warn("[searcher] SEARCHER_TOKEN not set, skipping"); return; }
  const bot = new Bot(TOKEN);

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    if (!text.includes("@slot_searcher_bot")) return;
    const taskId = text.match(/TASK_ID:(\S+)/)?.[1] ?? `T${Date.now()}`;
    const instruction = text.replace(/@slot_searcher_bot\s*/i, "").replace(/TASK_ID:\S+\s*/i, "").replace(/ACTION:\w+\s*/i, "").trim();
    await sendMessage(TOKEN, GROUP_ID, `🔍 TASK_ID:${taskId} — исследую ключевые слова...`);
    try {
      const result = await callHaiku(SEARCHER_PROMPT, `Keyword research для темы:\n${instruction}`);
      await sendMessage(TOKEN, GROUP_ID, `SEARCH_READY TASK_ID:${taskId}\n${result}`);
    } catch (e) { await sendMessage(TOKEN, GROUP_ID, `❌ TASK_ID:${taskId} — ошибка: ${e}`); }
  });

  console.log("[searcher] starting grammy polling...");
  bot.start({ onStart: () => console.log("[searcher] polling active ✅") });
}
