// Copywriter — generates full article JSON using Claude Sonnet
import { callSonnet } from "./shared/claude.ts";
import { startPolling, sendMessage, sendLong, TgMessage } from "./shared/telegram.ts";
import { COPYWRITER_PROMPT } from "./shared/prompts.ts";

const TOKEN = process.env.COPYWRITER_TOKEN!;
const GROUP_ID = process.env.SEO_GROUP_ID!;
const MY_USERNAME = "slot_copywriter_bot";

function extractTaskId(text: string): string {
  const m = text.match(/TASK_ID:(\S+)/);
  return m?.[1] ?? `T${Date.now()}`;
}

function extractAction(text: string): string {
  const m = text.match(/ACTION:(\w+)/);
  return m?.[1] ?? "";
}

async function generateArticle(taskId: string, instruction: string): Promise<void> {
  await sendMessage(TOKEN, GROUP_ID, `✍️ TASK_ID:${taskId} — начинаю написание статьи...`);

  try {
    const raw = await callSonnet(COPYWRITER_PROMPT, instruction);

    // Extract JSON from response
    const jsonMatch = raw.match(/\{[\s\S]+\}/);
    if (!jsonMatch) {
      await sendMessage(TOKEN, GROUP_ID, `❌ TASK_ID:${taskId} — не удалось получить JSON статьи`);
      return;
    }

    const article = JSON.parse(jsonMatch[0]);

    // Basic validation
    if (!article.slug || !article.title || !article.sections?.length) {
      await sendMessage(TOKEN, GROUP_ID, `❌ TASK_ID:${taskId} — некорректный формат статьи`);
      return;
    }

    // Count approximate words
    const wordCount = article.sections
      .filter((s: {type: string; text?: string; items?: string[]}) => s.text || s.items)
      .map((s: {type: string; text?: string; items?: string[]}) =>
        s.text ? s.text.split(/\s+/).length :
        (s.items ?? []).join(" ").split(/\s+/).length)
      .reduce((a: number, b: number) => a + b, 0);

    if (wordCount < 700) {
      await sendMessage(TOKEN, GROUP_ID,
        `⚠️ TASK_ID:${taskId} — статья маловата (~${wordCount} слов), переписываю...`);

      const expanded = await callSonnet(COPYWRITER_PROMPT,
        `${instruction}\n\nВАЖНО: Предыдущая версия была только ~${wordCount} слов. Нужно минимум 900. Расширь каждый раздел, добавь больше деталей, конкретных примеров и цифр.`);

      const expandedMatch = expanded.match(/\{[\s\S]+\}/);
      if (expandedMatch) {
        const expandedArticle = JSON.parse(expandedMatch[0]);
        await sendLong(TOKEN, GROUP_ID,
          `ARTICLE_READY TASK_ID:${taskId}\n${JSON.stringify(expandedArticle, null, 2)}`);
        return;
      }
    }

    await sendLong(TOKEN, GROUP_ID,
      `ARTICLE_READY TASK_ID:${taskId}\n${JSON.stringify(article, null, 2)}`);
  } catch (e) {
    await sendMessage(TOKEN, GROUP_ID, `❌ TASK_ID:${taskId} — ошибка: ${e}`);
  }
}

export async function startCopywriter() {
  if (!TOKEN) { console.warn("[copywriter] COPYWRITER_TOKEN not set, skipping"); return; }

  startPolling(TOKEN, async (msg: TgMessage) => {
    const text = msg.text ?? "";
    if (!text.includes(`@${MY_USERNAME}`) && !text.includes("@slot_copywriter_bot")) return;

    const taskId = extractTaskId(text);
    const action = extractAction(text);

    // Remove the mention prefix to get the instruction
    const instruction = text
      .replace(/@slot_copywriter_bot\s*/i, "")
      .replace(/TASK_ID:\S+\s*/i, "")
      .replace(/ACTION:\w+\s*/i, "")
      .trim();

    if (action === "write") {
      await generateArticle(taskId, instruction);
    } else if (action === "edit") {
      const editInstruction = `Перепиши статью с учётом правок:\n${instruction}`;
      await generateArticle(taskId, editInstruction);
    }
  }, "copywriter");
}
