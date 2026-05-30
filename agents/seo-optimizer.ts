import { Bot } from "grammy";
import { callHaiku } from "./shared/claude.ts";
import { sendMessage } from "./shared/telegram.ts";
import { SEO_OPTIMIZER_PROMPT } from "./shared/prompts.ts";

const TOKEN = process.env.SEO_OPTIMIZER_TOKEN!;
const GROUP_ID = process.env.SEO_GROUP_ID!;

export async function startSeoOptimizer() {
  if (!TOKEN) { console.warn("[seo-optimizer] SEO_OPTIMIZER_TOKEN not set, skipping"); return; }
  const bot = new Bot(TOKEN);

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    if (!text.includes("@slot_seoopimizer_bot")) return;
    const taskId = text.match(/TASK_ID:(\S+)/)?.[1] ?? `T${Date.now()}`;
    const instruction = text.replace(/@slot_seoopimizer_bot\s*/i, "").replace(/TASK_ID:\S+\s*/i, "").replace(/ACTION:\w+\s*/i, "").trim();
    await sendMessage(TOKEN, GROUP_ID, `🔧 TASK_ID:${taskId} — оптимизирую SEO...`);
    try {
      const result = await callHaiku(SEO_OPTIMIZER_PROMPT, `Оптимизируй SEO:\n${instruction}`);
      await sendMessage(TOKEN, GROUP_ID, `SEO_READY TASK_ID:${taskId}\n${result}`);
    } catch (e) { await sendMessage(TOKEN, GROUP_ID, `❌ TASK_ID:${taskId} — ошибка: ${e}`); }
  });

  console.log("[seo-optimizer] starting grammy polling...");
  bot.start({ onStart: () => console.log("[seo-optimizer] polling active ✅") });
}
