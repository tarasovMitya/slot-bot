import { Bot } from "grammy";
import { sendMessage } from "./shared/telegram.ts";
import { postToVk } from "../vk.ts";

const TOKEN = process.env.DISTRIBUTION_TOKEN!;
const GROUP_ID = process.env.SEO_GROUP_ID!;
const BOT_TOKEN = process.env.BOT_TOKEN!;
const CHANNEL = process.env.CHANNEL_ID || "@slot_home_msk";
const SITE = "https://slot-home.ru";

const EMOJI: Record<string, string> = {
  "Электрика":"⚡","Сантехника":"💧","Уборка":"🧹","Химчистка":"🧴",
  "Сборка мебели":"🛋","Муж на час":"🔨","Ремонт":"🏗","Кондиционеры":"❄️","Советы":"💡",
};

interface Section { type: string; text?: string; items?: string[]; rows?: Array<{label:string;value:string}>; }
interface Article { slug: string; title: string; category: string; categorySlug: string; sections: Section[]; }

function extract(sections: Section[]) {
  let intro=""; const bullets:string[]=[]; const prices:Array<{label:string;value:string}>[]=[] as any; let tip="";
  for (const s of sections) {
    if (s.type==="p" && !intro && s.text) intro=s.text;
    else if ((s.type==="ul"||s.type==="ol") && !bullets.length && s.items) bullets.push(...s.items.slice(0,5));
    else if (s.type==="table" && !(prices as any).length && s.rows) (prices as any).push(...s.rows.slice(0,5));
    else if (s.type==="tip" && !tip && s.text) tip=s.text;
  }
  return { intro, bullets, prices: prices as Array<{label:string;value:string}>, tip };
}

function fmtTg(a: Article): string {
  const {intro,bullets,prices,tip}=extract(a.sections);
  const em=EMOJI[a.category]||"📌"; const url=`${SITE}/blog/${a.slug}`;
  let t=`${em} <b>${a.title}</b>\n\n`;
  if(intro) t+=`${intro}\n\n`;
  if(bullets.length){t+=`<b>Ключевые моменты:</b>\n`;for(const b of bullets)t+=`• ${b}\n`;t+="\n";}
  if(prices.length){t+=`<b>Цены 2026:</b>\n`;for(const p of prices)t+=`• ${p.label}: ${p.value}\n`;t+="\n";}
  if(tip) t+=`💡 <i>${tip}</i>\n\n`;
  t+=`📖 <a href="${url}">Читать полностью</a>`;
  return t;
}

function fmtVk(a: Article): string {
  const {intro,bullets,prices,tip}=extract(a.sections);
  const em=EMOJI[a.category]||"📌"; const url=`${SITE}/blog/${a.slug}`;
  let t=`${em} ${a.title}\n\n`;
  if(intro) t+=`${intro}\n\n`;
  if(bullets.length){t+=`📌 Ключевые моменты:\n`;for(const b of bullets)t+=`• ${b}\n`;t+="\n";}
  if(prices.length){t+=`💰 Цены 2026:\n`;for(const p of prices)t+=`• ${p.label}: ${p.value}\n`;t+="\n";}
  if(tip) t+=`💡 ${tip}\n\n`;
  t+=`📖 ${url}\n\n#${a.categorySlug||"услуги"} #слот_хоум #москва`;
  return t;
}

async function postTg(text: string) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({chat_id:CHANNEL, text, parse_mode:"HTML"}),
  });
  const d = await res.json() as {ok:boolean;description?:string};
  if(!d.ok) throw new Error(`Telegram: ${d.description}`);
}

export async function startDistribution() {
  if (!TOKEN) { console.warn("[distribution] DISTRIBUTION_TOKEN not set, skipping"); return; }
  const bot = new Bot(TOKEN);

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    if (!text.includes("@slot_distrib_bot")) return;
    const taskId = text.match(/TASK_ID:(\S+)/)?.[1] ?? `T${Date.now()}`;
    const jsonStart = text.indexOf("\n{");
    if (jsonStart === -1) { await sendMessage(TOKEN, GROUP_ID, `❌ TASK_ID:${taskId} — JSON не найден`); return; }
    let article: Article;
    try { article = JSON.parse(text.slice(jsonStart+1)); }
    catch (e) { await sendMessage(TOKEN, GROUP_ID, `❌ TASK_ID:${taskId} — ошибка JSON: ${e}`); return; }

    await sendMessage(TOKEN, GROUP_ID, `📤 TASK_ID:${taskId} — публикую "${article.title}"...`);
    const results: string[] = [];
    try { await postTg(fmtTg(article)); results.push(`✅ Telegram @slot_home_msk`); } catch(e){results.push(`❌ Telegram: ${e}`);}
    await new Promise(r=>setTimeout(r,2000));
    try { const r=await postToVk({message:fmtVk(article)}); results.push(`✅ VK: ${r.url}`); } catch(e){results.push(`❌ VK: ${e}`);}
    await sendMessage(TOKEN, GROUP_ID, `PUBLISH_DONE TASK_ID:${taskId}\n${results.join("\n")}`);
  });

  console.log("[distribution] starting grammy polling...");
  bot.start({ onStart: () => console.log("[distribution] polling active ✅") });
}
