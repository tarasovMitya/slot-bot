// Telegram Bot API helpers

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

export async function getUpdates(
  token: string,
  offset: number,
  timeout = 25,
): Promise<TgUpdate[]> {
  const res = await fetch(
    `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=${timeout}&allowed_updates=["message"]`,
  );
  const d = await res.json() as { ok: boolean; result: TgUpdate[] };
  if (!d.ok) return [];
  return d.result;
}

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
}

export interface TgMessage {
  message_id: number;
  from?: { id: number; username?: string; first_name: string };
  chat: { id: number; type: string; title?: string };
  text?: string;
  date: number;
}

// Long-polling loop: calls handler for each new message
export async function startPolling(
  token: string,
  handler: (msg: TgMessage) => Promise<void>,
  label: string,
): Promise<void> {
  let offset = 0;
  console.log(`[${label}] polling started`);

  while (true) {
    try {
      const updates = await getUpdates(token, offset);
      for (const u of updates) {
        offset = u.update_id + 1;
        if (u.message) {
          handler(u.message).catch(e => console.error(`[${label}] handler error:`, e));
        }
      }
    } catch (e) {
      console.error(`[${label}] polling error:`, e);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

// Split long text into <=4096 char chunks
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
    if (splitMessage(text).length > 1) await new Promise(r => setTimeout(r, 500));
  }
}
