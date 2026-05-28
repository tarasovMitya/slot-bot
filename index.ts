import { Bot, InlineKeyboard, webhookCallback } from "grammy";
import { createHmac } from "node:crypto";
import { createServer } from "node:http";

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
          content: { title?: string; text: string; html?: string };
        };

        if (secret !== PUBLISH_SECRET) {
          res.writeHead(401).end(JSON.stringify({ error: "Unauthorized" }));
          return;
        }

        const results: Record<string, string> = {};

        // VK
        if ((type === "vk" || type === "all") && VK_TOKEN) {
          const vkRes = await fetch("https://api.vk.com/method/wall.post", {
            method: "POST",
            body: new URLSearchParams({
              owner_id: String(VK_OWNER_ID),
              from_group: "1",
              message: content.text,
              access_token: VK_TOKEN,
              v: "5.199",
            }),
          });
          const vkData = await vkRes.json() as { response?: { post_id: number } };
          if (vkData.response?.post_id) {
            results.vk = `https://vk.com/wall${VK_OWNER_ID}_${vkData.response.post_id}`;
          }
        }

        // Telegram channel
        if (type === "telegram" || type === "all") {
          await bot.api.sendMessage(Number(CHANNEL_ID) || -1003795683781, content.text);
          results.telegram = "sent";
        }

        // vc.ru (needs fresh access token)
        if ((type === "vcru" || type === "all") && VC_REFRESH_TOKEN && content.title) {
          const tokenRes = await fetch("https://api.vc.ru/v3.4/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `token=${VC_REFRESH_TOKEN}`,
          });
          const tokenData = await tokenRes.json() as { data?: { accessToken: string } };
          const accessToken = tokenData.data?.accessToken;

          if (accessToken) {
            const entryObj = {
              subsite_id: 5980245,
              title: content.title,
              entry: { blocks: [{ type: "text", cover: false, hidden: false, anchor: "", data: { text: content.html || content.text } }] },
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
  });
}

startBot();
