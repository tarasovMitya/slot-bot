// Telegram helpers for sending messages (no custom polling — use grammy instead)

export async function sendMessage(
  token: string,
  chatId: string | number,
  text: string,
  parseMode: "HTML" | "Markdown" = "HTML",
): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    }),
  });
  const d = await res.json() as { ok: boolean; description?: string };
  if (!d.ok) throw new Error(`Telegram sendMessage error: ${d.description}`);
}

export function splitMessage(text: string): string[] {
  const MAX = 4000;
  if (text.length <= MAX) return [text];
  const parts: string[] = [];
  let i = 0;
  while (i < text.length) {
    parts.push(text.slice(i, i + MAX));
    i += MAX;
  }
  return parts;
}

export async function sendLong(
  token: string,
  chatId: string | number,
  text: string,
): Promise<void> {
  for (const chunk of splitMessage(text)) {
    await sendMessage(token, chatId, chunk);
  }
}
