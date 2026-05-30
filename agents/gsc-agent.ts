import { Bot } from "grammy";
import { sendMessage } from "./shared/telegram.ts";

const TOKEN = process.env.GSC_AGENT_TOKEN!;
const GROUP_ID = process.env.SEO_GROUP_ID!;
const DMITRY_ID = process.env.DMITRY_CHAT_ID || "865826947";
const INDEXNOW_KEY = "a9f3b2c8d1e4f7a6b5c3d2e9f1a8b7c4";
const SITE = "https://slot-home.ru";
const GSC_CLIENT_ID = process.env.GSC_OAUTH_CLIENT_ID!;
const GSC_CLIENT_SECRET = process.env.GSC_OAUTH_CLIENT_SECRET!;
const GSC_REFRESH_TOKEN = process.env.GSC_REFRESH_TOKEN!;

async function getToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body: new URLSearchParams({client_id:GSC_CLIENT_ID,client_secret:GSC_CLIENT_SECRET,refresh_token:GSC_REFRESH_TOKEN,grant_type:"refresh_token"}),
  });
  const d = await res.json() as {access_token?:string;error?:string};
  if (!d.access_token) throw new Error(`GSC token: ${d.error}`);
  return d.access_token;
}

async function indexNow(urls: string[]) {
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({host:"slot-home.ru",key:INDEXNOW_KEY,urlList:urls}),
  });
  if (!res.ok) throw new Error(`IndexNow: ${res.status}`);
}

async function googleIndex(url: string) {
  const token = await getToken();
  const res = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
    method:"POST", headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
    body: JSON.stringify({url,type:"URL_UPDATED"}),
  });
  if (!res.ok) throw new Error(`Google Indexing: ${await res.text()}`);
}

async function gscReport(): Promise<string> {
  const token = await getToken();
  const end = new Date().toISOString().slice(0,10);
  const start = new Date(Date.now()-7*86400_000).toISOString().slice(0,10);
  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE+"/")}/searchAnalytics/query`,
    {method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
     body:JSON.stringify({startDate:start,endDate:end,dimensions:["page"],rowLimit:10,orderBy:[{fieldName:"clicks",sortOrder:"DESCENDING"}]})},
  );
  if (!res.ok) return "Нет данных GSC";
  const data = await res.json() as {rows?:Array<{keys:string[];clicks:number;impressions:number;position:number}>};
  if (!data.rows?.length) return "Нет данных за период";
  const clicks=data.rows.reduce((s,r)=>s+r.clicks,0);
  const impr=data.rows.reduce((s,r)=>s+r.impressions,0);
  let report=`📈 GSC: ${start} — ${end}\n\nКлики: ${clicks}\nПоказы: ${impr}\nCTR: ${(clicks/impr*100).toFixed(1)}%\n\nТоп:\n`;
  for(const r of data.rows.slice(0,5)) report+=`• ${r.keys[0].replace(SITE,"")} — ${r.clicks} кл., поз. ${r.position.toFixed(1)}\n`;
  return report;
}

export async function startGscAgent() {
  if (!TOKEN) { console.warn("[gsc-agent] GSC_AGENT_TOKEN not set, skipping"); return; }
  const bot = new Bot(TOKEN);

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    if (!text.includes("@slot_gsc_bot")) return;
    const taskId = text.match(/TASK_ID:(\S+)/)?.[1] ?? `T${Date.now()}`;
    const action = text.match(/ACTION:(\w+)/)?.[1] ?? "";
    const instruction = text.replace(/@slot_gsc_bot\s*/i,"").replace(/TASK_ID:\S+\s*/i,"").replace(/ACTION:\w+\s*/i,"").trim();

    if (action === "index") {
      const urls = instruction.split("\n").map(u=>u.trim()).filter(u=>u.startsWith("http"));
      if (!urls.length) { await sendMessage(TOKEN,GROUP_ID,`❌ TASK_ID:${taskId} — URL не указан`); return; }
      await sendMessage(TOKEN,GROUP_ID,`📡 TASK_ID:${taskId} — индексирую...`);
      const results:string[]=[];
      for(const url of urls){
        try{await indexNow([url]);await googleIndex(url);results.push(`✅ ${url}`);}
        catch(e){results.push(`❌ ${url}: ${e}`);}
      }
      await sendMessage(TOKEN,GROUP_ID,`INDEX_DONE TASK_ID:${taskId}\n${results.join("\n")}`);
    } else if (action==="report") {
      try{const r=await gscReport();await sendMessage(TOKEN,GROUP_ID,`GSC_READY TASK_ID:${taskId}\n${r}`);}
      catch(e){await sendMessage(TOKEN,GROUP_ID,`❌ GSC error: ${e}`);}
    }
  });

  // Weekly report Monday 08:00 UTC
  setInterval(async()=>{
    const n=new Date();
    if(n.getUTCDay()===1&&n.getUTCHours()===8&&n.getUTCMinutes()===0){
      try{const r=await gscReport();await sendMessage(TOKEN,DMITRY_ID,r);}catch(e){console.error("[gsc] weekly report:",e);}
    }
  },60_000);

  console.log("[gsc-agent] starting grammy polling...");
  bot.start({ onStart: () => console.log("[gsc-agent] polling active ✅") });
}
