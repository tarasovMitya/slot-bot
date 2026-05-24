import { Bot, InlineKeyboard } from "grammy";

const BOT_TOKEN = process.env.BOT_TOKEN!;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID!;
const CHANNEL_ID = process.env.CHANNEL_ID!;
const MINI_APP_URL = "https://slot-home.ru/app";

const bot = new Bot(BOT_TOKEN);

// ─── Главное меню ─────────────────────────────────────────────────────────────

const mainMenu = new InlineKeyboard()
  .webApp("🚀 Открыть приложение", MINI_APP_URL).row()
  .text("🧹 Уборка", "service_cleaning")
  .text("🔧 Сантехник", "service_plumber")
  .text("⚡ Электрик", "service_electrician").row()
  .text("🛋 Мебель", "service_furniture")
  .text("🔨 Мастер на час", "service_handyman")
  .text("🧴 Химчистка", "service_dryclean").row()
  .text("💬 Написать менеджеру", "contact_manager");

// ─── Данные об услугах ────────────────────────────────────────────────────────

const SERVICES: Record<string, { name: string; price: string; url: string; desc: string }> = {
  service_cleaning: {
    name: "Уборка квартиры",
    price: "от 2 000 ₽",
    url: `${MINI_APP_URL}?service=cleaning`,
    desc: "Поддерживающая и генеральная уборка. Уборка после ремонта. Выезд в день заказа.",
  },
  service_plumber: {
    name: "Сантехник на дом",
    price: "от 1 200 ₽",
    url: `${MINI_APP_URL}?service=plumber`,
    desc: "Прочистка засоров, замена смесителей и труб, установка сантехники. Выезд за 2 часа.",
  },
  service_electrician: {
    name: "Электрик на дом",
    price: "от 1 500 ₽",
    url: `${MINI_APP_URL}?service=electrician`,
    desc: "Замена розеток, установка люстр, ремонт проводки. Гарантия на работы.",
  },
  service_furniture: {
    name: "Сборка мебели",
    price: "от 800 ₽",
    url: `${MINI_APP_URL}?service=furniture`,
    desc: "Сборка шкафов, кроватей, кухонь, IKEA. Быстро и аккуратно.",
  },
  service_handyman: {
    name: "Мастер на час",
    price: "от 1 000 ₽",
    url: `${MINI_APP_URL}?service=handyman`,
    desc: "Полки, карнизы, картины, мелкий ремонт. Любые бытовые задачи.",
  },
  service_dryclean: {
    name: "Химчистка мебели",
    price: "от 1 500 ₽",
    url: `${MINI_APP_URL}?service=dryclean`,
    desc: "Химчистка диванов, кресел, матрасов и ковров на дому.",
  },
};

// ─── SEO посты для канала ─────────────────────────────────────────────────────

const POSTS = [
  `🧹 *Когда нужна генеральная уборка?*\n\nБольшинство откладывают её «на потом» — и зря. Признаки, что время пришло:\n\n• Пыль на верхних полках и за мебелью\n• Жёлтые разводы на кафеле в ванной\n• Запах в холодильнике несмотря на чистку\n• Ощущение, что квартира «не дышит»\n\nПрофессиональная генеральная уборка решает всё это за 3–5 часов. От 4 000 ₽.\n\n👉 slot-home.ru/moscow/cleaning`,
  `🔧 *3 признака, что пора вызвать сантехника*\n\nНе ждите пока станет хуже:\n\n1️⃣ Вода уходит медленно — засор уже есть\n2️⃣ Кран капает — за месяц утекает до 200 литров воды\n3️⃣ Трубы «стучат» — давление или воздух в системе\n\nВызов сантехника на дом от 1 200 ₽. Выезд за 2 часа.\n\n👉 slot-home.ru/moscow/plumber`,
  `⚡ *Почему мигает свет?*\n\nМигание лампочек — не просто раздражает, это сигнал:\n\n• Плохой контакт в розетке или патроне\n• Перегруженная линия\n• Изношенная проводка (актуально для домов 1970–90-х)\n\nНе чините проводку самостоятельно — это опасно. Электрик выедет в день заказа.\n\n👉 slot-home.ru/moscow/electrician`,
  `🛋 *Сборка IKEA: реальные цифры*\n\nСколько времени занимает сборка самому vs мастеру:\n\n• Шкаф PAX — 3–4 часа / 1–1.5 часа\n• Кровать MALM — 2 часа / 45 минут\n• Кухня METOD — 6–8 часов / 2–3 часа\n\nПлюс мастер соберёт ровно и с гарантией. От 800 ₽.\n\n👉 slot-home.ru/moscow/furniture`,
  `🪟 *Как часто мыть окна?*\n\nГрязные окна пропускают на 30–40% меньше света. Оптимально:\n\n• Весна и осень — обязательно\n• После ремонта у соседей — срочно\n• Летом в центре Москвы — раз в 2 месяца\n\nПрофессиональная мойка без разводов — от 500 ₽ за окно.\n\n👉 slot-home.ru/moscow/cleaning`,
  `🧴 *Химчистка дивана на дому — стоит ли?*\n\nДиван собирает до 100 000 пылевых клещей на кв.м. Обычный пылесос убирает только поверхностную пыль.\n\nПрофессиональная химчистка работает вглубь:\n✅ Удаляет пятна и запахи\n✅ Убивает клещей и аллергены\n✅ Высыхает за 2–3 часа\n\nОт 2 500 ₽.\n\n👉 slot-home.ru/moscow/dry-cleaning`,
  `🔨 *Что сделает мастер на час за 1 000 ₽?*\n\nЗа один час:\n\n✅ Повесить 3–5 полок или карнизов\n✅ Установить телевизор на стену\n✅ Поменять дверную ручку и замок\n✅ Повесить 10–15 картин или зеркал\n✅ Починить скрипящую дверь\n\nМастер привезёт свой инструмент.\n\n👉 slot-home.ru/moscow/handyman`,
  `💧 *Замена батарей отопления: когда и сколько?*\n\nЗнаки, что радиатор нужно менять:\n\n• Ржавые пятна или следы протечек\n• Батарея греет неравномерно\n• Громкий стук при включении отопления\n• Радиатор старше 20 лет\n\nЗамена батареи под ключ — от 3 000 ₽. Работаем в межотопительный сезон.\n\n👉 slot-home.ru/moscow/plumber`,
  `🏠 *Уборка после ремонта: почему это сложнее обычной?*\n\nСтроительная пыль — особенная. Она:\n\n• Проникает в щели и вентиляцию\n• Оседает на всех поверхностях за 2–3 недели\n• Содержит цемент и гипс, которые въедаются в покрытия\n\nОбычная уборка не справляется. Нужна профессиональная с промышленным пылесосом.\n\nОт 5 000 ₽. Выезд в день заказа.\n\n👉 slot-home.ru/moscow/cleaning`,
];

// ─── Автопостинг в канал каждые 3 дня ────────────────────────────────────────

let postIndex = 0;

async function publishPost() {
  try {
    const text = POSTS[postIndex % POSTS.length];
    await bot.api.sendMessage(CHANNEL_ID, text, {
      parse_mode: "Markdown",
      link_preview_options: { is_disabled: true },
    });
    console.log(`📢 Published post #${postIndex} to ${CHANNEL_ID}`);
    postIndex++;
  } catch (e) {
    console.error("Post error:", e);
  }
}

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

// Первый пост через 1 минуту после старта, затем каждые 3 дня
setTimeout(async () => {
  await publishPost();
  setInterval(publishPost, THREE_DAYS_MS);
}, 60_000);

// ─── /start ───────────────────────────────────────────────────────────────────

bot.command("start", async (ctx) => {
  const name = ctx.from?.first_name ?? "друг";
  await ctx.reply(
    `👋 Привет, ${name}!\n\n` +
    `Я бот сервиса *SLOT* — проверенные мастера на дом в Москве.\n\n` +
    `🚀 Нажми «Открыть приложение» — рассчитай стоимость и оформи заказ прямо здесь, не выходя из Telegram.`,
    { parse_mode: "Markdown", reply_markup: mainMenu }
  );
});

// ─── Кнопки услуг ─────────────────────────────────────────────────────────────

bot.on("callback_query:data", async (ctx) => {
  const data = ctx.callbackQuery.data;
  await ctx.answerCallbackQuery();

  if (data === "contact_manager") {
    await ctx.reply("💬 Напишите ваш вопрос — менеджер ответит в течение 15 минут.");
    return;
  }
  if (data === "back_to_menu") {
    await ctx.reply("Выберите услугу:", { reply_markup: mainMenu });
    return;
  }

  const service = SERVICES[data];
  if (!service) return;

  const keyboard = new InlineKeyboard()
    .webApp(`🚀 Заказать ${service.name}`, service.url).row()
    .text("← Назад", "back_to_menu");

  await ctx.reply(
    `*${service.name}*\n💰 ${service.price}\n\n${service.desc}`,
    { parse_mode: "Markdown", reply_markup: keyboard }
  );
});

// ─── Пересылка сообщений менеджеру ───────────────────────────────────────────

bot.on("message:text", async (ctx) => {
  if (ctx.message.text.startsWith("/")) return;

  const user = ctx.from;
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
  const username = user?.username ? `@${user.username}` : "без username";

  await bot.api.sendMessage(
    ADMIN_CHAT_ID,
    `📩 *Новое сообщение*\n\n👤 ${name} (${username})\n🆔 ${user?.id}\n\n💬 ${ctx.message.text}`,
    { parse_mode: "Markdown" }
  );

  await ctx.reply(
    "✅ Получено! Менеджер ответит в течение 15 минут.",
    {
      reply_markup: new InlineKeyboard()
        .webApp("🚀 Открыть приложение", MINI_APP_URL),
    }
  );
});

// ─── Старт ────────────────────────────────────────────────────────────────────

bot.start();
console.log("✅ SLOT bot started. Auto-posting every 3 days.");
