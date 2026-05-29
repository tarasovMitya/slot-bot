// GSC Agent — Google Search Console indexing and reporting
import { callHaiku } from "./shared/claude.ts";
import { startPolling, sendMessage, TgMessage } from "./shared/telegram.ts";
import { GSC_AGENT_PROMPT } from "./shared/prompts.ts";

const TOKEN = process.env.GSC_AGENT_TOKEN!;
const GROUP_ID = process.env.SEO_GROUP_ID!;
const DMITRY_ID = process.env.DMITRY_CHAT_ID || "865826947";

const INDEXNOW_KEY = "a9f3b2c8d1e4f7a6b5c3d2e9f1a8b7c4";
const SITE = "https://slot-home.ru";

// GSC OAuth
const GSC_CLIENT_ID = process.env.GSC_OAUTH_CLIENT_ID!;
const GSC_CLIENT_SECRET = process.env.GSC_OAUTH_CLIENT_SECRET!;
const GSC_REFRESH_TOKEN = process.env.GSC_REFRESH_TOKEN!;

async function getGscAccessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GSC_CLIENT_ID,
      client_secret: GSC_CLIENT_SECRET,
      refresh_token: GSC_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const d = await res.json() as { access_token?: string; error?: string };
  if (!d.access_token) throw new Error(`GSC token error: ${d.error}`);
  return d.access_token;
}

async function submitIndexNow(urls: string[]): Promise<void> {
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ host: "slot-home.ru", key: INDEXNOW_KEY, urlList: urls }),
  });
  if (!res.ok) throw new Error(`IndexNow error: ${res.status}`);
}

async function requestGoogleIndex(url: string): Promise<void> {
  const token = await getGscAccessToken();
  const res = await fetch(
    `https://indexing.googleapis.com/v3/urlNotifications:publish`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ url, type: "URL_UPDATED" }),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Indexing API error: ${err}`);
  }
}

async function getGscPerformance(): Promise<string> {
  const token = await getGscAccessToken();
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);

  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE + "/")}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: ["page"],
        rowLimit: 10,
        orderBy: [{ fieldName: "clicks", sortOrder: "DESCENDING" }],
      }),
    },
  );

  if (!res.ok) return "Не удалось получить данные GSC";
  const data = await res.json() as {
    rows?: Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }>;
  };

  if (!data.rows?.length) return "Нет данных за период";

  const totalClicks = data.rows.reduce((s, r) => s + r.clicks, 0);
  const totalImpressions = data.rows.reduce((s, r) => s + r.impressions, 0);
  const avgCtr = (totalClicks / totalImpressions * 100).toFixed(1);

  let report = `📈 GSC REPORT: ${startDate} — ${endDate}\n\n`;
  report += `Клики: ${totalClicks}\nПоказы: ${totalImpressions}\nCTR: ${avgCtr}%\n\nТоп страниц:\n`;
  for (const row of data.rows.slice(0, 5)) {
    const page = row.keys[0].replace(SITE, "");
    report += `• ${page} — ${row.clicks} кл., позиция ${row.position.toFixed(1)}\n`;
  }

  return report;
}

export async function startGscAgent() {
  if (!TOKEN) { console.warn("[gsc-agent] GSC_AGENT_TOKEN not set, skipping"); return; }

  // Weekly performance report — every Monday 08:00 UTC
  setInterval(async () => {
    const now = new Date();
    if (now.getUTCDay() === 1 && now.getUTCHours() === 8 && now.getUTCMinutes() === 0) {
      try {
        const report = await getGscPerformance();
        await sendMessage(TOKEN, DMITRY_ID, report);
        await sendMessage(TOKEN, GROUP_ID, `GSC_REPORT\n${report}`);
      } catch (e) {
        await sendMessage(TOKEN, GROUP_ID, `❌ GSC weekly report error: ${e}`);
      }
    }
  }, 60_000);

  startPolling(TOKEN, async (msg: TgMessage) => {
    const text = msg.text ?? "";
    if (!text.includes("@seo_gsc_bot")) return;

    const taskId = text.match(/TASK_ID:(\S+)/)?.[1] ?? `T${Date.now()}`;
    const action = text.match(/ACTION:(\w+)/)?.[1] ?? "";

    const instruction = text
      .replace(/@seo_gsc_bot\s*/i, "")
      .replace(/TASK_ID:\S+\s*/i, "")
      .replace(/ACTION:\w+\s*/i, "")
      .trim();

    if (action === "index") {
      const urls = instruction.split("\n").map(u => u.trim()).filter(u => u.startsWith("http"));
      if (!urls.length) {
        await sendMessage(TOKEN, GROUP_ID, `❌ TASK_ID:${taskId} — URL не указан`);
        return;
      }

      await sendMessage(TOKEN, GROUP_ID, `📡 TASK_ID:${taskId} — отправляю на индексирование...`);

      const results: string[] = [];
      for (const url of urls) {
        try {
          await submitIndexNow([url]);
          await requestGoogleIndex(url);
          results.push(`✅ ${url}`);
        } catch (e) {
          results.push(`❌ ${url}: ${e}`);
        }
      }

      await sendMessage(TOKEN, GROUP_ID, `INDEX_DONE TASK_ID:${taskId}\n${results.join("\n")}`);
    } else if (action === "report") {
      try {
        const report = await getGscPerformance();
        await sendMessage(TOKEN, GROUP_ID, `GSC_READY TASK_ID:${taskId}\n${report}`);
      } catch (e) {
        await sendMessage(TOKEN, GROUP_ID, `❌ TASK_ID:${taskId} — GSC error: ${e}`);
      }
    }
  }, "gsc-agent");
}
