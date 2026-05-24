import { Bot, InlineKeyboard } from "grammy";

const BOT_TOKEN = process.env.BOT_TOKEN!;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID!;
const CHANNEL_ID = process.env.CHANNEL_ID!;
const MINI_APP_URL = "https://slot-home.ru/app";

const bot = new Bot(BOT_TOKEN);

// ─── Клавиатуры ───────────────────────────────────────────────────────────────

function mainMenu() {
  return new InlineKeyboard()
    .webApp("🚀 Заказать услугу", MINI_APP_URL).row()
    .webApp("📋 Мои заявки", `${MINI_APP_URL}?tab=orders`).row()
    .text("💬 Написать в поддержку", "support");
}

// ─── /start ───────────────────────────────────────────────────────────────────

bot.command("start", async (ctx) => {
  const name = ctx.from?.first_name ?? "друг";

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
  `🧹 *Когда нужна генеральная уборка?*\n\nПризнаки, что время пришло:\n• Пыль на верхних полках и за мебелью\n• Жёлтые разводы на кафеле\n• Ощущение, что квартира «не дышит»\n\nПрофессиональная уборка за 3–5 часов. От 4 000 ₽.\n\n👉 slot-home.ru/moscow/cleaning`,
  `🔧 *3 признака, что пора вызвать сантехника*\n\n1️⃣ Вода уходит медленно — засор уже есть\n2️⃣ Кран капает — 200 литров в месяц\n3️⃣ Трубы «стучат» — давление или воздух\n\nОт 1 200 ₽. Выезд за 2 часа.\n\n👉 slot-home.ru/moscow/plumber`,
  `⚡ *Почему мигает свет?*\n\n• Плохой контакт в розетке\n• Перегруженная линия\n• Изношенная проводка\n\nНе чините сами — это опасно. Электрик в день заказа.\n\n👉 slot-home.ru/moscow/electrician`,
  `🛋 *Сборка IKEA: самому vs мастер*\n\n• Шкаф PAX — 3–4 ч. / 1–1.5 ч.\n• Кровать MALM — 2 ч. / 45 мин.\n• Кухня METOD — 6–8 ч. / 2–3 ч.\n\nОт 800 ₽. Мастер соберёт ровно и с гарантией.\n\n👉 slot-home.ru/moscow/furniture`,
  `🧴 *Химчистка дивана — зачем?*\n\nДиван накапливает до 100 000 пылевых клещей на кв.м. Пылесос убирает только верхний слой.\n\n✅ Удаляет пятна и запахи\n✅ Убивает клещей и аллергены\n✅ Высыхает за 2–3 часа\n\nОт 2 500 ₽. На дому.\n\n👉 slot-home.ru/moscow/dry-cleaning`,
  `🔨 *Что сделает мастер на час за 1 000 ₽?*\n\n✅ Повесить 3–5 полок\n✅ Установить телевизор\n✅ Поменять замок\n✅ Повесить картины и зеркала\n✅ Починить скрипящую дверь\n\nМастер приедет со своим инструментом.\n\n👉 slot-home.ru/moscow/handyman`,
  `💧 *Замена батарей: когда пора?*\n\n• Ржавые пятна или протечки\n• Греет неравномерно\n• Стук при включении отопления\n• Старше 20 лет\n\nПод ключ от 3 000 ₽.\n\n👉 slot-home.ru/moscow/plumber`,
  `🏠 *Уборка после ремонта*\n\nСтроительная пыль особенная — проникает в щели, содержит цемент и гипс.\n\nОбычная уборка не справляется. Нужен профессиональный пылесос.\n\nОт 5 000 ₽. Выезд в день заказа.\n\n👉 slot-home.ru/moscow/cleaning`,
  `🪟 *Мойка окон — когда?*\n\nГрязные окна пропускают на 30–40% меньше света.\n\n• Весной — смываем зимнюю грязь\n• Осенью — перед пасмурными днями\n• После ремонта у соседей\n\nОт 300 ₽ за окно.\n\n👉 slot-home.ru/moscow/cleaning`,
];

let postIndex = 0;

async function publishPost() {
  try {
    const text = POSTS[postIndex % POSTS.length];
    await bot.api.sendMessage(CHANNEL_ID, text, {
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: true },
    });
    console.log(`📢 Post #${postIndex} published`);
    postIndex++;
  } catch (e) {
    console.error("Post error:", e);
  }
}

setTimeout(async () => {
  await publishPost();
  setInterval(publishPost, 3 * 24 * 60 * 60 * 1000);
}, 60_000);

// ─── Старт ────────────────────────────────────────────────────────────────────

bot.start();
console.log("✅ SLOT bot started. Posting every 3 days.");
