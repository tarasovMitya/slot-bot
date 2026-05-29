import { Bot, InlineKeyboard, webhookCallback } from "grammy";
import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BOT_TOKEN = process.env.BOT_TOKEN!;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID!;
const CHANNEL_ID = process.env.CHANNEL_ID!;
const MINI_APP_URL = "https://slot-home.ru/app";
const SERVER_URL = "https://slot-home.ru";

const bot = new Bot(BOT_TOKEN);

// ─── Клавиатуры ───────────────────────────────────────────────────────────────

function mainMenu() {
  return new InlineKeyboard()
    .webApp("🚀 Заказать услугу", MINI_APP_URL).row()
    .webApp("📋 Мои заявки", `${MINI_APP_URL}?tab=orders`).row()
    .text("💬 Написать в поддержку", "support");
}

// ─── Настройка бота при старте ────────────────────────────────────────────────

async function setupBot() {
  try {
    // Команды в меню
    await bot.api.setMyCommands([
      { command: "start", description: "Открыть главное меню" },
      { command: "help", description: "Помощь и поддержка" },
    ]);

    // Кнопка меню (левый нижний угол чата) → открывает мини-апп
    await bot.api.setChatMenuButton({
      menu_button: {
        type: "web_app",
        text: "📱 Открыть приложение",
        web_app: { url: MINI_APP_URL },
      },
    });

    console.log("✅ Bot setup complete: commands + menu button set");
  } catch (e) {
    console.error("Setup error (non-critical):", e);
  }
}

// ─── Auth session helper ──────────────────────────────────────────────────────

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function storeAuthSession(
  state: string,
  code: string,
  from: { id: number; first_name: string; last_name?: string; username?: string }
): Promise<void> {
  const payload = JSON.stringify({
    state,
    code,
    telegram_id: from.id,
    first_name: from.first_name ?? null,
    last_name: from.last_name ?? null,
    username: from.username ?? null,
  });
  const sig = createHmac("sha256", BOT_TOKEN).update(payload).digest("hex");
  const res = await fetch(`${SERVER_URL}/api/telegram-auth/bot-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Bot-Signature": sig },
    body: payload,
  });
  if (!res.ok) throw new Error(`Server error (${res.status}): ${await res.text()}`);
}

// ─── /start ───────────────────────────────────────────────────────────────────

bot.command("start", async (ctx) => {
  const payload = ctx.match;
  const isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup";

  // Bot-based Telegram login flow
  if (payload?.startsWith("LOGIN_")) {
    const state = payload.slice(6);
    const code = generateCode();
    try {
      await storeAuthSession(state, code, ctx.from!);
      await ctx.reply(
        `🔐 Ваш код подтверждения:\n\n` +
        `\`${code}\`\n\n` +
        `Введите его на сайте slot\\-home\\.ru для входа\\.\n` +
        `Код действителен 5 минут\\.`,
        { parse_mode: "MarkdownV2" }
      );
    } catch (e) {
      console.error("Auth session error:", e);
      await ctx.reply("❌ Не удалось выполнить вход. Вернитесь на сайт и попробуйте снова.");
    }
    return;
  }

  const name = ctx.from?.first_name ?? "друг";

  if (isGroup) {
    await ctx.reply(`👋 Привет! Напишите мне в личку: @slot_home_bot`);
    return;
  }

  await ctx.reply(
    `👋 Привет, ${name}!\n\n` +
    `Я помогу вызвать проверенного мастера на дом в Москве.\n\n` +
    `🏠 *Выезд в день заказа*\n` +
    `💰 *Фиксированные цены*\n` +
    `✅ *Проверенные мастера*\n\n` +
    `Нажмите «Заказать услугу» — выберите услугу, укажите адрес и время прямо в приложении.`,
    { parse_mode: "Markdown", reply_markup: mainMenu() }
  );
});

// ─── Поддержка ────────────────────────────────────────────────────────────────

const PENDING_SUPPORT = new Set<number>();

bot.callbackQuery("support", async (ctx) => {
  await ctx.answerCallbackQuery();
  PENDING_SUPPORT.add(ctx.from.id);
  await ctx.reply(
    "💬 Напишите ваш вопрос — менеджер ответит в течение 15 минут."
  );
});

// ─── Сообщения ────────────────────────────────────────────────────────────────

bot.on("message:text", async (ctx) => {
  if (ctx.message.text.startsWith("/")) return;

  const userId = ctx.from?.id;
  const name = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(" ");
  const username = ctx.from?.username ? `@${ctx.from.username}` : "без username";

  // Ответ менеджера пользователю: "Ответ 123456789: текст"
  if (String(ctx.chat.id) === ADMIN_CHAT_ID) {
    const match = ctx.message.text.match(/^Ответ (\d+):\s*([\s\S]+)$/);
    if (match) {
      try {
        await bot.api.sendMessage(match[1], `👨‍💼 *Поддержка SLOT:*\n\n${match[2]}`, { parse_mode: "Markdown" });
        await ctx.reply(`✅ Ответ отправлен пользователю ${match[1]}`);
      } catch {
        await ctx.reply(`❌ Не удалось отправить пользователю ${match[1]}`);
      }
      return;
    }
  }

  // Сообщение в поддержку
  if (userId && PENDING_SUPPORT.has(userId)) {
    PENDING_SUPPORT.delete(userId);
    await bot.api.sendMessage(
      ADMIN_CHAT_ID,
      `📩 *Вопрос в поддержку*\n\n👤 ${name} (${username})\n🆔 ID: ${userId}\n\n💬 ${ctx.message.text}\n\n_Ответить: "Ответ ${userId}: текст"_`,
      { parse_mode: "Markdown" }
    );
    await ctx.reply("✅ Вопрос принят! Ответим в течение 15 минут.", { reply_markup: mainMenu() });
    return;
  }

  // Любое другое сообщение — форвард менеджеру
  await bot.api.sendMessage(
    ADMIN_CHAT_ID,
    `📩 *Сообщение*\n\n👤 ${name} (${username})\n🆔 ID: ${userId}\n\n💬 ${ctx.message.text}\n\n_Ответить: "Ответ ${userId}: текст"_`,
    { parse_mode: "Markdown" }
  );
  await ctx.reply("Получили! Чем ещё могу помочь?", { reply_markup: mainMenu() });
});

// ─── Автопостинг каждые 3 дня ────────────────────────────────────────────────

const POSTS = [
  `🧹 *Когда нужна генеральная уборка?*\n\nПризнаки, что время пришло:\n• Пыль на верхних полках и за мебелью\n• Жёлтые разводы на кафеле\n• Ощущение, что квартира «не дышит»\n\nПрофессиональная уборка за 3–5 часов. От 4 000 ₽.\n\n👉 slot-home.ru/services/cleaning`,
  `🔧 *3 признака, что пора вызвать сантехника*\n\n1️⃣ Вода уходит медленно — засор уже есть\n2️⃣ Кран капает — 200 литров в месяц\n3️⃣ Трубы «стучат» — давление или воздух\n\nОт 1 200 ₽. Выезд за 2 часа.\n\n👉 slot-home.ru/services/plumber`,
  `⚡ *Почему мигает свет?*\n\n• Плохой контакт в розетке\n• Перегруженная линия\n• Изношенная проводка\n\nНе чините сами — это опасно. Электрик в день заказа.\n\n👉 slot-home.ru/services/electrician`,
  `🛋 *Сборка IKEA: самому vs мастер*\n\n• Шкаф PAX — 3–4 ч. / 1–1.5 ч.\n• Кровать MALM — 2 ч. / 45 мин.\n• Кухня METOD — 6–8 ч. / 2–3 ч.\n\nОт 800 ₽. Мастер соберёт ровно и с гарантией.\n\n👉 slot-home.ru/services/furniture-assembly`,
  `🧴 *Химчистка дивана — зачем?*\n\nДиван накапливает до 100 000 пылевых клещей на кв.м. Пылесос убирает только верхний слой.\n\n✅ Удаляет пятна и запахи\n✅ Убивает клещей и аллергены\n✅ Высыхает за 2–3 часа\n\nОт 2 500 ₽. На дому.\n\n👉 slot-home.ru/services/dry-cleaning`,
  `🔨 *Что сделает мастер на час за 1 000 ₽?*\n\n✅ Повесить 3–5 полок\n✅ Установить телевизор\n✅ Поменять замок\n✅ Повесить картины и зеркала\n✅ Починить скрипящую дверь\n\nМастер приедет со своим инструментом.\n\n👉 slot-home.ru/services/handyman`,
  `💧 *Замена батарей: когда пора?*\n\n• Ржавые пятна или протечки\n• Греет неравномерно\n• Стук при включении отопления\n• Старше 20 лет\n\nПод ключ от 3 000 ₽.\n\n👉 slot-home.ru/services/plumber`,
  `🏠 *Уборка после ремонта*\n\nСтроительная пыль особенная — проникает в щели, содержит цемент и гипс.\n\nОбычная уборка не справляется. Нужен профессиональный пылесос.\n\nОт 5 000 ₽. Выезд в день заказа.\n\n👉 slot-home.ru/services/cleaning`,
  `🪟 *Мойка окон — когда?*\n\nГрязные окна пропускают на 30–40% меньше света.\n\n• Весной — смываем зимнюю грязь\n• Осенью — перед пасмурными днями\n• После ремонта у соседей\n\nОт 300 ₽ за окно.\n\n👉 slot-home.ru/services/cleaning`,
  `🔌 *Нужен электрик — срочно*\n\nКогда нельзя ждать:\n• Выбило автомат и не включается\n• Запах горелой проводки\n• Искры из розетки\n• Свет пропал в части квартиры\n\nЭлектрик в день заказа. От 700 ₽ за вызов.\n\n👉 slot-home.ru/services/electrician`,
  `🚰 *Протекает труба под раковиной?*\n\nЧто делать до приезда мастера:\n1. Перекрыть вентиль под раковиной\n2. Подставить ведро\n3. Не пользоваться водой в этой зоне\n\nСантехник устранит утечку за 1 час. От 1 500 ₽.\n\n👉 slot-home.ru/services/plumber`,
  `🛏 *Сборка детской мебели*\n\nДетская кроватка и шкаф — это не IKEA для взрослых. Множество мелких деталей, инструкция на 40 шагов.\n\nМастер соберёт правильно и безопасно. Гарантия устойчивости.\n\nОт 1 200 ₽. Инструмент с собой.\n\n👉 slot-home.ru/services/furniture-assembly`,
  `🧽 *Химчистка матраса на дому*\n\nМатрас за 5 лет впитывает:\n• 1–2 кг пота и кожного жира\n• Пылевые клещи и их экскременты\n• Бытовую пыль и аллергены\n\nПрофессиональная чистка убирает всё это. Высыхает за 3–4 часа.\n\nОт 1 800 ₽.\n\n👉 slot-home.ru/services/dry-cleaning`,
  `🏡 *Первая уборка в новой квартире*\n\nДаже новостройка требует уборки:\n• Строительная пыль в вентиляции\n• Следы монтажной пены\n• Остатки затирки на плитке\n• Плёнка на окнах\n\nСпециализированная уборка после сдачи ключей. От 4 500 ₽.\n\n👉 slot-home.ru/services/cleaning`,
  `🎭 *Карниз и шторы — поможем повесить*\n\nКажется просто, но:\n• Нужен перфоратор и дюбели\n• Важно попасть в горизонталь\n• В панельных домах — трубы в стенах\n\nМастер повесит карниз ровно и надёжно. От 600 ₽.\n\n👉 slot-home.ru/services/handyman`,
  `🧹 *Уборка балкона — весенний ритуал*\n\nЗа зиму на балконе накапливается:\n• Пыль и грязь с улицы\n• Старый мусор\n• Паутина по углам\n\nПрофессиональная уборка балкона — 1–2 часа. Включая мытьё остекления изнутри.\n\nОт 1 500 ₽.\n\n👉 slot-home.ru/services/cleaning`,
  `💡 *Замена люстры или люминесцентного светильника*\n\nЗвучит несложно, но:\n• Надо обесточить квартиру\n• Провода могут быть без маркировки\n• Некоторые светильники весят 5–10 кг\n\nЭлектрик подключит безопасно. От 700 ₽.\n\n👉 slot-home.ru/services/electrician`,
  `🚿 *Замена смесителя в ванной*\n\nСмеситель меняют когда:\n• Течёт вентиль или излив\n• Расшатался в стене\n• Ржавчина на корпусе\n• Просто устарел\n\nСантехник привезёт новый или установит ваш. От 1 200 ₽.\n\n👉 slot-home.ru/services/plumber`,
];

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
// Anchor date: 2026-05-27 12:00 UTC — slot 0 starts here
const SCHEDULE_ANCHOR = new Date("2026-05-27T12:00:00Z").getTime();

async function publishScheduledPost() {
  const slot = Math.floor((Date.now() - SCHEDULE_ANCHOR) / THREE_DAYS_MS);
  const postIdx = ((slot % POSTS.length) + POSTS.length) % POSTS.length;
  const text = POSTS[postIdx];
  try {
    await bot.api.sendMessage(CHANNEL_ID, text, {
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: true },
    });
    console.log(`📢 Post slot #${slot} (index ${postIdx}) published`);
  } catch (e) {
    console.error("Post error:", e);
  }
}

function schedulePosting() {
  const now = Date.now();
  const slot = Math.floor((now - SCHEDULE_ANCHOR) / THREE_DAYS_MS);
  const nextSlotTime = SCHEDULE_ANCHOR + (slot + 1) * THREE_DAYS_MS;
  const delay = nextSlotTime - now;
  console.log(`⏰ Next post in ${Math.round(delay / 1000 / 60)} min (slot #${slot + 1})`);
  setTimeout(async () => {
    await publishScheduledPost();
    setInterval(publishScheduledPost, THREE_DAYS_MS);
  }, delay);
}

// ─── /myid ───────────────────────────────────────────────────────────────────

bot.command("myid", async (ctx) => {
  const chatId = ctx.chat.id;
  const userId = ctx.from?.id;
  await ctx.reply(
    `🆔 *Chat ID:* \`${chatId}\`\n👤 *User ID:* \`${userId}\``,
    { parse_mode: "Markdown" }
  );
});

// ─── /help ────────────────────────────────────────────────────────────────────

bot.command("help", async (ctx) => {
  await ctx.reply(
    "ℹ️ *SLOT — мастера на дом*\n\n" +
    "🚀 Нажмите «Заказать услугу» — выберите услугу и оформите заявку прямо в приложении.\n\n" +
    "📋 «Мои заявки» — история и статусы ваших заказов.\n\n" +
    "💬 «Поддержка» — вопросы и помощь, ответим за 15 минут.",
    { parse_mode: "Markdown", reply_markup: mainMenu() }
  );
});

// ─── Ежедневная публикация статей (10:00 МСК = 07:00 UTC) ────────────────────

const SITE_URL = "https://slot-home.ru";
const VK_TOKEN_ENV = process.env.VK_TOKEN || "";
const VK_OWNER = -239140857;

const CAT_EMOJI: Record<string, string> = {
  "Электрика": "⚡", "Сантехника": "💧", "Уборка": "🧹", "Химчистка": "🧴",
  "Сборка мебели": "🛋", "Муж на час": "🔨", "Установка ТВ": "📺",
  "Установка дверей": "🚪", "Ремонт": "🏗", "Кондиционеры": "❄️",
  "Советы": "💡", "Истории клиентов": "📖",
};

interface BlogSection { type: string; text?: string; items?: string[]; rows?: Array<{ label: string; value: string }>; }
interface BlogArticle { slug: string; title: string; category: string; categorySlug: string; publishedAt: string; sections: BlogSection[]; }

function loadArticles(): BlogArticle[] {
  try {
    const __dir = dirname(fileURLToPath(import.meta.url));
    return JSON.parse(readFileSync(join(__dir, "articles.json"), "utf-8"));
  } catch { return []; }
}

function buildPostContent(a: BlogArticle) {
  let intro = "", bullets: string[] = [], prices: Array<{ label: string; value: string }> = [], tip = "";
  for (const s of a.sections) {
    if (s.type === "p" && !intro && s.text) intro = s.text;
    else if ((s.type === "ul" || s.type === "ol") && !bullets.length && s.items) bullets = s.items.slice(0, 5);
    else if (s.type === "table" && !prices.length && s.rows) prices = s.rows.slice(0, 4);
    else if (s.type === "tip" && !tip && s.text) tip = s.text;
  }
  return { intro, bullets, prices, tip };
}

async function dailyPostArticles(dateStr: string) {
  const articles = loadArticles();
  const toPost = articles.filter(a => a.publishedAt === dateStr).slice(0, 3);
  if (!toPost.length) { console.log(`[daily] No articles for ${dateStr}`); return; }

  console.log(`[daily] Posting ${toPost.length} articles for ${dateStr}`);
  const chanId = Number(CHANNEL_ID) || -1003795683781;

  for (const a of toPost) {
    const em = CAT_EMOJI[a.category] || "📌";
    const url = `${SITE_URL}/blog/${a.slug}`;
    const { intro, bullets, prices, tip } = buildPostContent(a);

    // Telegram (HTML)
    try {
      let tg = `${em} <b>${a.title}</b>\n\n`;
      if (intro) tg += `${intro}\n\n`;
      if (bullets.length) { tg += `<b>Ключевые моменты:</b>\n`; bullets.forEach(b => tg += `• ${b}\n`); tg += "\n"; }
      if (prices.length) { tg += `<b>Цены в Москве 2026:</b>\n`; prices.forEach(p => tg += `• ${p.label}: ${p.value}\n`); tg += "\n"; }
      if (tip) tg += `💡 <i>${tip}</i>\n\n`;
      tg += `📖 <a href="${url}">Читать полностью</a>`;
      await bot.api.sendMessage(chanId, tg, { parse_mode: "HTML", link_preview_options: { is_disabled: false } });
      console.log(`  ✅ Telegram: ${a.title}`);
    } catch (e) { console.error(`  ❌ Telegram: ${e}`); }

    await new Promise(r => setTimeout(r, 3000));

    // VK (plain text, long format)
    if (VK_TOKEN_ENV) {
      try {
        let vk = `${em} ${a.title}\n\n`;
        if (intro) vk += `${intro}\n\n`;
        if (bullets.length) { vk += `📌 Ключевые моменты:\n`; bullets.forEach(b => vk += `• ${b}\n`); vk += "\n"; }
        if (prices.length) { vk += `💰 Цены в Москве 2026:\n`; prices.forEach(p => vk += `• ${p.label}: ${p.value}\n`); vk += "\n"; }
        if (tip) vk += `💡 ${tip}\n\n`;
        vk += `📖 Читать полностью: ${url}\n\n`;
        const tag = a.categorySlug || a.category.toLowerCase().replace(/\s+/g, "_");
        vk += `#${tag} #слот_хоум #москва #мастер_на_дом`;
        const vkBody = new URLSearchParams({ owner_id: String(VK_OWNER), from_group: "1", message: vk, access_token: VK_TOKEN_ENV, v: "5.199" });
        const vkRes = await fetch("https://api.vk.com/method/wall.post", { method: "POST", body: vkBody });
        const vkData = await vkRes.json() as { response?: { post_id: number }; error?: { error_msg: string } };
        if (vkData.response?.post_id) console.log(`  ✅ VK post_id=${vkData.response.post_id}`);
        else console.error(`  ❌ VK: ${vkData.error?.error_msg}`);
      } catch (e) { console.error(`  ❌ VK: ${e}`); }
    }

    await new Promise(r => setTimeout(r, 8000));
  }
  console.log(`[daily] Done for ${dateStr}`);
}

function scheduleDailyBlogPosts() {
  function getNextPostTime(): number {
    const now = new Date();
    // 07:00 UTC = 10:00 Moscow
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 7, 0, 0, 0));
    if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
    return next.getTime() - now.getTime();
  }

  function scheduleNext() {
    const delay = getNextPostTime();
    console.log(`[daily] Next blog post in ${Math.round(delay / 60000)} min`);
    setTimeout(async () => {
      const today = new Date().toISOString().slice(0, 10);
      await dailyPostArticles(today);
      scheduleNext();
    }, delay);
  }

  scheduleNext();
}

// ─── Старт ────────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT) || 3000;
const WEBHOOK_DOMAIN = process.env.WEBHOOK_DOMAIN || "https://slot-telegram-bot-production.up.railway.app";

async function startBot() {
  await bot.api.setWebhook(`${WEBHOOK_DOMAIN}/bot`);
  console.log(`✅ Webhook set: ${WEBHOOK_DOMAIN}/bot`);

  const PUBLISH_SECRET = process.env.PUBLISH_SECRET || "slot-publish-secret";
  const VK_TOKEN = process.env.VK_TOKEN || "";
  const VC_REFRESH_TOKEN = process.env.VC_REFRESH_TOKEN || "";
  const VK_OWNER_ID = -239140857;

  const handler = webhookCallback(bot, "http");
  const server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");

    // ── /api/publish — публикация контента агентом ────────────────────────────
    if (req.method === "POST" && req.url === "/api/publish") {
      let body = "";
      req.on("data", (c) => (body += c));
      await new Promise((r) => req.on("end", r));

      try {
        const { secret, type, content } = JSON.parse(body) as {
          secret: string;
          type: "vk" | "vcru" | "telegram" | "all";
          content: { title?: string; text: string; html?: string; imageUrl?: string; articleUrl?: string };
        };

        if (secret !== PUBLISH_SECRET) {
          res.writeHead(401).end(JSON.stringify({ error: "Unauthorized" }));
          return;
        }

        const results: Record<string, string> = {};

        // Generate image via Pollinations if not provided
        const imageUrl = content.imageUrl || (() => {
          const prompt = encodeURIComponent(
            `${content.title || content.text.slice(0, 80)}. Home services Moscow apartment. Clean minimalist photo. No text. No faces.`
          );
          return `https://image.pollinations.ai/prompt/${prompt}?width=1200&height=630&model=flux&nologo=true`;
        })();

        // VK — post with image + link to slot-home.ru (no Telegraph)
        if ((type === "vk" || type === "all") && VK_TOKEN) {
          try {
            // Step 1: get upload server
            const uploadServerRes = await fetch(
              `https://api.vk.com/method/photos.getWallUploadServer?group_id=239140857&access_token=${VK_TOKEN}&v=5.199`
            );
            const uploadServer = await uploadServerRes.json() as { response?: { upload_url: string } };
            const uploadUrl = uploadServer.response?.upload_url;

            let attachments = "";
            if (uploadUrl) {
              // Step 2: upload image
              const imgRes = await fetch(imageUrl);
              const imgBlob = await imgRes.blob();
              const form = new FormData();
              form.append("photo", imgBlob, "image.jpg");
              const uploadRes = await fetch(uploadUrl, { method: "POST", body: form });
              const uploaded = await uploadRes.json() as { server: number; photo: string; hash: string };
              // Step 3: save photo
              const saveParams = new URLSearchParams({
                group_id: "239140857", server: String(uploaded.server),
                photo: uploaded.photo, hash: uploaded.hash,
                access_token: VK_TOKEN, v: "5.199",
              });
              const saveRes = await fetch("https://api.vk.com/method/photos.saveWallPhoto", { method: "POST", body: saveParams });
              const saved = await saveRes.json() as { response?: Array<{ owner_id: number; id: number }> };
              const photo = saved.response?.[0];
              if (photo) attachments = `photo${photo.owner_id}_${photo.id}`;
            }

            // Add article link to post text (no Telegraph)
            const vkText = content.articleUrl
              ? `${content.text}\n\n📖 Читать полностью: ${content.articleUrl}`
              : content.text;

            const vkParams: Record<string, string> = {
              owner_id: String(VK_OWNER_ID), from_group: "1",
              message: vkText, access_token: VK_TOKEN, v: "5.199",
            };
            if (attachments) vkParams.attachments = attachments;

            const vkRes = await fetch("https://api.vk.com/method/wall.post", {
              method: "POST", body: new URLSearchParams(vkParams),
            });
            const vkData = await vkRes.json() as { response?: { post_id: number }; error?: { error_msg: string } };
            if (vkData.response?.post_id) {
              results.vk = `https://vk.com/wall${VK_OWNER_ID}_${vkData.response.post_id}`;
            } else if (vkData.error) {
              results.vk_error = vkData.error.error_msg;
            }
          } catch (vkErr: unknown) {
            results.vk_error = vkErr instanceof Error ? vkErr.message : String(vkErr);
          }
        }

        // Telegram channel — send with image
        if (type === "telegram" || type === "all") {
          try {
            const chanId = Number(CHANNEL_ID) || -1003795683781;
            const caption = content.articleUrl
              ? `${content.text}\n\n👉 ${content.articleUrl}`
              : content.text;
            // Try sendPhoto first, fall back to sendMessage
            try {
              await bot.api.sendPhoto(chanId, imageUrl, { caption, parse_mode: "HTML" });
            } catch {
              await bot.api.sendMessage(chanId, caption, { parse_mode: "HTML" });
            }
            results.telegram = "sent";
          } catch (tgErr: unknown) {
            results.telegram_error = tgErr instanceof Error ? tgErr.message : String(tgErr);
          }
        }

        // vc.ru — refresh token rotates, save the new one
        if ((type === "vcru" || type === "all") && VC_REFRESH_TOKEN && content.title) {
          const tokenRes = await fetch("https://api.vc.ru/v3.4/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `token=${VC_REFRESH_TOKEN}`,
          });
          const tokenData = await tokenRes.json() as { data?: { accessToken: string; refreshToken?: string } };
          const accessToken = tokenData.data?.accessToken;
          // Rotate refresh token in memory for next call
          if (tokenData.data?.refreshToken) {
            // Note: update Railway env var separately — refresh token rotates every call
            console.log("vc.ru new refreshToken:", tokenData.data.refreshToken);
          }

          if (accessToken) {
            const articleLink = content.articleUrl || "";
            const htmlContent = content.html
              ? content.html + (articleLink ? `<p>Источник: <a href="${articleLink}">${articleLink}</a></p>` : "")
              : content.text + (articleLink ? `\n\nИсточник: ${articleLink}` : "");

            const entryObj = {
              subsite_id: 5980245,
              title: content.title,
              entry: { blocks: [{ type: "text", cover: false, hidden: false, anchor: "", data: { text: htmlContent } }] },
            };
            const entryBody = new URLSearchParams();
            entryBody.append("entry", JSON.stringify(entryObj));
            const createRes = await fetch("https://api.vc.ru/v2.8/editor", {
              method: "POST",
              headers: { "JWTAuthorization": `Bearer ${accessToken}`, "Content-Type": "application/x-www-form-urlencoded" },
              body: entryBody.toString(),
            });
            const createData = await createRes.json() as { result?: { entry: { id: number; url: string } } };
            const entryId = createData.result?.entry?.id;
            if (entryId) {
              await fetch(`https://api.vc.ru/v2.8/editor/${entryId}/publish`, {
                method: "POST",
                headers: { "JWTAuthorization": `Bearer ${accessToken}` },
              });
              results.vcru = createData.result!.entry.url;
            }
          }
        }

        // Notify admin (plain text to avoid Markdown issues with URLs)
        const summary = Object.entries(results).map(([k, v]) => `${k}: ${v}`).join("\n");
        await bot.api.sendMessage(865826947, `📢 Опубликовано агентом\n\n${content.title || "Пост"}\n\n${summary}`);

        res.writeHead(200).end(JSON.stringify({ ok: true, results }));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        res.writeHead(500).end(JSON.stringify({ error: msg }));
      }
      return;
    }

    if (req.method === "POST" && req.url === "/bot") {
      await handler(req, res);
    } else {
      res.writeHead(200).end("OK");
    }
  });

  server.listen(PORT, () => {
    console.log(`✅ SLOT bot started. Listening on port ${PORT}`);
    setupBot();
    schedulePosting();
    scheduleDailyBlogPosts();
  });
}

startBot();
