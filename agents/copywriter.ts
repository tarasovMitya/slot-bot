import { Bot } from "grammy";
import { callSonnet } from "./shared/claude.ts";
import { sendMessage, sendLong } from "./shared/telegram.ts";
import { COPYWRITER_PROMPT } from "./shared/prompts.ts";

const TOKEN = process.env.COPYWRITER_TOKEN!;
const GROUP_ID = process.env.SEO_GROUP_ID!;

async function generateArticle(taskId: string, instruction: string): Promise<void> {
  await sendMessage(TOKEN, GROUP_ID, `✍️ TASK_ID:${taskId} — пишу статью...`);
  try {
    const raw = await callSonnet(COPYWRITER_PROMPT, instruction);
    const jsonMatch = raw.match(/\{[\s\S]+\}/);
    if (!jsonMatch) { await sendMessage(TOKEN, GROUP_ID, `❌ TASK_ID:${taskId} — нет JSON в ответе`); return; }
    const article = JSON.parse(jsonMatch[0]);
    if (!article.slug || !article.title || !article.sections?.length) {
      await sendMessage(TOKEN, GROUP_ID, `❌ TASK_ID:${taskId} — некорректный JSON`); return;
    }
    await sendLong(TOKEN, GROUP_ID, `ARTICLE_READY TASK_ID:${taskId}\n${JSON.stringify(article, null, 2)}`);
  } catch (e) {
    await sendMessage(TOKEN, GROUP_ID, `❌ TASK_ID:${taskId} — ошибка: ${e}`);
  }
}

export async function startCopywriter() {
  if (!TOKEN) { console.warn("[copywriter] COPYWRITER_TOKEN not set, skipping"); return; }
  const bot = new Bot(TOKEN);

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    if (!text.includes("@slot_copywriter_bot")) return;
    const taskId = text.match(/TASK_ID:(\S+)/)?.[1] ?? `T${Date.now()}`;
    const action = text.match(/ACTION:(\w+)/)?.[1] ?? "";
    const instruction = text.replace(/@slot_copywriter_bot\s*/i, "").replace(/TASK_ID:\S+\s*/i, "").replace(/ACTION:\w+\s*/i, "").trim();
    if (action === "write" || action === "edit") await generateArticle(taskId, instruction);
  });

  console.log("[copywriter] starting grammy polling...");
  bot.start({ onStart: () => console.log("[copywriter] polling active ✅") });
}
