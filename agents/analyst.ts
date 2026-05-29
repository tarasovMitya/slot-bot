// Analyst — SERP analysis and GSC data interpretation
import { callHaiku } from "./shared/claude.ts";
import { startPolling, sendMessage, TgMessage } from "./shared/telegram.ts";
import { ANALYST_PROMPT } from "./shared/prompts.ts";

const TOKEN = process.env.ANALYST_TOKEN!;
const GROUP_ID = process.env.SEO_GROUP_ID!;

export async function startAnalyst() {
  if (!TOKEN) { console.warn("[analyst] ANALYST_TOKEN not set, skipping"); return; }

  startPolling(TOKEN, async (msg: TgMessage) => {
    const text = msg.text ?? "";
    if (!text.includes("@seo_analyst_bot")) return;

    const taskId = text.match(/TASK_ID:(\S+)/)?.[1] ?? `T${Date.now()}`;
    const instruction = text
      .replace(/@seo_analyst_bot\s*/i, "")
      .replace(/TASK_ID:\S+\s*/i, "")
      .replace(/ACTION:\w+\s*/i, "")
      .trim();

    await sendMessage(TOKEN, GROUP_ID, `📊 TASK_ID:${taskId} — анализирую данные...`);

    try {
      const result = await callHaiku(ANALYST_PROMPT, instruction);
      await sendMessage(TOKEN, GROUP_ID, `ANALYSIS_READY TASK_ID:${taskId}\n${result}`);
    } catch (e) {
      await sendMessage(TOKEN, GROUP_ID, `❌ TASK_ID:${taskId} — ошибка анализа: ${e}`);
    }
  }, "analyst");
}
