// Topic database for the SEO content pipeline
// Tracks existing topics and provides new ones for generation

export interface TopicSuggestion {
  title: string;
  keyword: string;
  category: string;
  categorySlug: string;
  relatedServiceSlug: string;
  intent: "informational" | "commercial" | "transactional";
  priority: number; // 1-10
}

// All service categories on slot-home.ru
const SERVICE_CATEGORIES = {
  electrician: "Электрика",
  plumber: "Сантехника",
  cleaning: "Уборка",
  "dry-cleaning": "Химчистка",
  "furniture-assembly": "Сборка мебели",
  handyman: "Муж на час",
  "tv-installation": "Установка ТВ",
  "door-installation": "Установка дверей",
  repair: "Ремонт",
  conditioner: "Кондиционеры",
} as const;

// Master topic list — expanded set of article ideas
// priority 8-10: high commercial intent, low competition
// priority 5-7: informational, useful for topical authority
// priority 1-4: supplementary, lower priority

export const TOPIC_POOL: TopicSuggestion[] = [
  // Электрика
  { title: "Установка умного дома в квартире: с чего начать", keyword: "умный дом квартира установка", category: "Электрика", categorySlug: "electrician", relatedServiceSlug: "electrician", intent: "commercial", priority: 9 },
  { title: "Электрощиток в квартире: что внутри и как разобраться", keyword: "электрощиток квартира", category: "Электрика", categorySlug: "electrician", relatedServiceSlug: "electrician", intent: "informational", priority: 7 },
  { title: "Перенос розетки в квартире: можно ли и сколько стоит", keyword: "перенос розетки квартира", category: "Электрика", categorySlug: "electrician", relatedServiceSlug: "electrician", intent: "commercial", priority: 8 },
  { title: "Заземление в квартире: нужно ли и как сделать", keyword: "заземление квартира сделать", category: "Электрика", categorySlug: "electrician", relatedServiceSlug: "electrician", intent: "informational", priority: 7 },
  { title: "Автоматы и УЗО: в чём разница и что выбрать", keyword: "автомат УЗО отличие", category: "Электрика", categorySlug: "electrician", relatedServiceSlug: "electrician", intent: "informational", priority: 6 },
  { title: "Замена лампочек на светодиодные: стоит ли игра свеч", keyword: "замена ламп светодиодные", category: "Электрика", categorySlug: "electrician", relatedServiceSlug: "electrician", intent: "informational", priority: 5 },

  // Сантехника
  { title: "Установка смесителя в ванной своими руками или мастер", keyword: "установка смесителя ванная", category: "Сантехника", categorySlug: "plumber", relatedServiceSlug: "plumber", intent: "commercial", priority: 9 },
  { title: "Водонагреватель в квартире: накопительный или проточный", keyword: "водонагреватель квартира выбор", category: "Сантехника", categorySlug: "plumber", relatedServiceSlug: "plumber", intent: "commercial", priority: 8 },
  { title: "Установка водонагревателя в квартире: этапы и стоимость", keyword: "установка водонагревателя квартира", category: "Сантехника", categorySlug: "plumber", relatedServiceSlug: "plumber", intent: "transactional", priority: 9 },
  { title: "Фильтр для воды под мойку: виды и установка", keyword: "фильтр вода под мойку установка", category: "Сантехника", categorySlug: "plumber", relatedServiceSlug: "plumber", intent: "commercial", priority: 8 },
  { title: "Канализация в квартире: как устроена и частые проблемы", keyword: "канализация квартира проблемы", category: "Сантехника", categorySlug: "plumber", relatedServiceSlug: "plumber", intent: "informational", priority: 6 },
  { title: "Жёсткая вода в Москве: проблемы и решения", keyword: "жёсткая вода Москва", category: "Сантехника", categorySlug: "plumber", relatedServiceSlug: "plumber", intent: "informational", priority: 7 },

  // Уборка
  { title: "Уборка квартиры после смерти родственника: что нужно знать", keyword: "уборка квартиры после смерти", category: "Уборка", categorySlug: "cleaning", relatedServiceSlug: "cleaning", intent: "transactional", priority: 8 },
  { title: "Клининг перед переездом: что включить в список", keyword: "клининг переезд квартира", category: "Уборка", categorySlug: "cleaning", relatedServiceSlug: "cleaning", intent: "transactional", priority: 8 },
  { title: "Регулярная уборка квартиры: как часто и сколько стоит", keyword: "регулярная уборка квартира Москва", category: "Уборка", categorySlug: "cleaning", relatedServiceSlug: "cleaning", intent: "commercial", priority: 8 },
  { title: "Уборка офиса в Москве: виды и цены 2026", keyword: "уборка офис Москва цена", category: "Уборка", categorySlug: "cleaning", relatedServiceSlug: "cleaning", intent: "commercial", priority: 7 },
  { title: "Как найти хорошую домработницу в Москве", keyword: "домработница Москва найти", category: "Уборка", categorySlug: "cleaning", relatedServiceSlug: "cleaning", intent: "commercial", priority: 7 },
  { title: "Мойка фасадов зданий в Москве: виды и цены", keyword: "мойка фасадов Москва", category: "Уборка", categorySlug: "cleaning", relatedServiceSlug: "cleaning", intent: "commercial", priority: 6 },

  // Химчистка
  { title: "Химчистка мягкой мебели на дому: полное руководство", keyword: "химчистка мягкая мебель дом", category: "Химчистка", categorySlug: "dry-cleaning", relatedServiceSlug: "dry-cleaning", intent: "commercial", priority: 8 },
  { title: "Химчистка ковра: выезд на дом или доставка в химчистку", keyword: "химчистка ковёр дом доставка", category: "Химчистка", categorySlug: "dry-cleaning", relatedServiceSlug: "dry-cleaning", intent: "commercial", priority: 8 },
  { title: "Пятна на диване: что делать и когда звать профессионала", keyword: "пятно диван убрать", category: "Химчистка", categorySlug: "dry-cleaning", relatedServiceSlug: "dry-cleaning", intent: "transactional", priority: 7 },
  { title: "Запах в квартире: как избавиться навсегда", keyword: "запах квартира устранить", category: "Химчистка", categorySlug: "dry-cleaning", relatedServiceSlug: "dry-cleaning", intent: "transactional", priority: 7 },

  // Сборка мебели
  { title: "Сборка кровати: своими руками или вызвать мастера", keyword: "сборка кровать мастер", category: "Сборка мебели", categorySlug: "furniture-assembly", relatedServiceSlug: "furniture-assembly", intent: "commercial", priority: 8 },
  { title: "Сборка детской комнаты: порядок и советы", keyword: "сборка детская комната", category: "Сборка мебели", categorySlug: "furniture-assembly", relatedServiceSlug: "furniture-assembly", intent: "commercial", priority: 7 },
  { title: "Разборка и сборка мебели при переезде: как организовать", keyword: "разборка сборка мебель переезд", category: "Сборка мебели", categorySlug: "furniture-assembly", relatedServiceSlug: "furniture-assembly", intent: "transactional", priority: 8 },
  { title: "Ремонт мебели на дому: что можно починить", keyword: "ремонт мебель дом", category: "Сборка мебели", categorySlug: "furniture-assembly", relatedServiceSlug: "furniture-assembly", intent: "commercial", priority: 7 },

  // Муж на час
  { title: "Поклейка потолочных плинтусов: сделать самому или мастер", keyword: "поклейка плинтус потолок", category: "Муж на час", categorySlug: "handyman", relatedServiceSlug: "handyman", intent: "commercial", priority: 7 },
  { title: "Крепление полок на гипсокартон: правила и нагрузки", keyword: "крепление полки гипсокартон", category: "Муж на час", categorySlug: "handyman", relatedServiceSlug: "handyman", intent: "informational", priority: 6 },
  { title: "Монтаж зеркала на стену: как и чем крепить", keyword: "монтаж зеркало стена", category: "Муж на час", categorySlug: "handyman", relatedServiceSlug: "handyman", intent: "commercial", priority: 7 },
  { title: "Регулировка пластиковых окон: как и когда делать", keyword: "регулировка пластиковые окна", category: "Муж на час", categorySlug: "handyman", relatedServiceSlug: "handyman", intent: "commercial", priority: 8 },
  { title: "Установка москитной сетки на окно: виды и монтаж", keyword: "москитная сетка установка", category: "Муж на час", categorySlug: "handyman", relatedServiceSlug: "handyman", intent: "commercial", priority: 8 },
  { title: "Подоконник пластиковый: замена и монтаж", keyword: "подоконник пластиковый замена", category: "Муж на час", categorySlug: "handyman", relatedServiceSlug: "handyman", intent: "commercial", priority: 7 },

  // Ремонт
  { title: "Шпаклёвка стен перед поклейкой обоев: технология", keyword: "шпаклёвка стены обои", category: "Ремонт", categorySlug: "repair", relatedServiceSlug: "repair", intent: "informational", priority: 6 },
  { title: "Выравнивание стен в квартире: методы и стоимость", keyword: "выравнивание стены квартира", category: "Ремонт", categorySlug: "repair", relatedServiceSlug: "repair", intent: "commercial", priority: 8 },
  { title: "Демонтаж перегородки в квартире: согласование и стоимость", keyword: "демонтаж перегородка квартира", category: "Ремонт", categorySlug: "repair", relatedServiceSlug: "repair", intent: "commercial", priority: 8 },
  { title: "Укладка плитки в ванной: самому или мастер", keyword: "укладка плитка ванная мастер", category: "Ремонт", categorySlug: "repair", relatedServiceSlug: "repair", intent: "commercial", priority: 9 },
  { title: "Ремонт в однушке под ключ: этапы и бюджет", keyword: "ремонт однушка под ключ Москва", category: "Ремонт", categorySlug: "repair", relatedServiceSlug: "repair", intent: "commercial", priority: 9 },
  { title: "Декоративная штукатурка: виды и стоимость нанесения", keyword: "декоративная штукатурка нанесение цена", category: "Ремонт", categorySlug: "repair", relatedServiceSlug: "repair", intent: "commercial", priority: 7 },

  // Кондиционеры
  { title: "Кондиционер зимой: можно ли работать и на обогрев", keyword: "кондиционер зима обогрев", category: "Кондиционеры", categorySlug: "conditioner", relatedServiceSlug: "conditioner", intent: "informational", priority: 7 },
  { title: "Инверторный кондиционер: стоит ли переплачивать", keyword: "инверторный кондиционер стоит ли", category: "Кондиционеры", categorySlug: "conditioner", relatedServiceSlug: "conditioner", intent: "commercial", priority: 8 },
  { title: "Кондиционер в офис: выбор и установка для 20-50 кв.м", keyword: "кондиционер офис установка", category: "Кондиционеры", categorySlug: "conditioner", relatedServiceSlug: "conditioner", intent: "commercial", priority: 8 },
  { title: "Мобильный кондиционер: плюсы, минусы и лучшие модели 2026", keyword: "мобильный кондиционер 2026", category: "Кондиционеры", categorySlug: "conditioner", relatedServiceSlug: "conditioner", intent: "commercial", priority: 7 },

  // Местное SEO (районы Москвы)
  { title: "Вызов мастера на дом в Митино: электрик, сантехник, уборка", keyword: "мастер на дом Митино", category: "Советы", categorySlug: "tips", relatedServiceSlug: "handyman", intent: "transactional", priority: 9 },
  { title: "Мастер на дом в Строгино: услуги и цены", keyword: "мастер на дом Строгино", category: "Советы", categorySlug: "tips", relatedServiceSlug: "handyman", intent: "transactional", priority: 9 },
  { title: "Вызов электрика в Тушино: цены и время выезда", keyword: "электрик Тушино вызов", category: "Электрика", categorySlug: "electrician", relatedServiceSlug: "electrician", intent: "transactional", priority: 9 },
  { title: "Сантехник в Щукино: срочный вызов на дом", keyword: "сантехник Щукино вызов", category: "Сантехника", categorySlug: "plumber", relatedServiceSlug: "plumber", intent: "transactional", priority: 9 },
  { title: "Уборка квартиры в Хорошёво-Мнёвниках: цены и клининг", keyword: "уборка квартира Хорошёво-Мнёвники", category: "Уборка", categorySlug: "cleaning", relatedServiceSlug: "cleaning", intent: "transactional", priority: 8 },
];

// Get topics not yet covered (check against existing article slugs)
export function getAvailableTopics(existingSlugs: Set<string>): TopicSuggestion[] {
  return TOPIC_POOL
    .filter(t => !existingSlugs.has(topicToSlug(t.title)))
    .sort((a, b) => b.priority - a.priority);
}

export function topicToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[а-яёА-ЯЁ]/g, char => {
      const map: Record<string, string> = {
        а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"zh",з:"z",и:"i",
        й:"j",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",
        у:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",
        ь:"",э:"e",ю:"yu",я:"ya",
      };
      return map[char] || char;
    })
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
