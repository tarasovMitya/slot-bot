#!/usr/bin/env ts-node
// Publishes a new article to slot-home.ru by appending to blogData.ts,
// then git commits and pushes (Railway auto-deploys on push to main).
//
// Usage:
//   ts-node publish-site.ts article.json
//   echo '<json>' | ts-node publish-site.ts
//
// Article JSON format:
// {
//   "slug": "url-slug",
//   "title": "Заголовок",
//   "excerpt": "Краткое описание",
//   "category": "Электрика",
//   "categorySlug": "electrician",
//   "readTime": 5,
//   "metaTitle": "SEO заголовок",
//   "metaDescription": "SEO описание",
//   "relatedServiceSlug": "electrician",
//   "sections": [
//     { "type": "p", "text": "Текст параграфа" },
//     { "type": "h2", "text": "Подзаголовок" },
//     { "type": "ul", "items": ["пункт 1", "пункт 2"] },
//     { "type": "tip", "text": "Совет" }
//   ]
// }

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { generateImage } from "./generate-image.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BLOG_DATA_PATH = resolve(__dirname, "../calc/src/pages/blog/blogData.ts");
const CALC_DIR = resolve(__dirname, "../calc");

interface Article {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  categorySlug: string;
  readTime: number;
  publishedAt?: string;
  metaTitle: string;
  metaDescription: string;
  relatedServiceSlug: string;
  coverImage?: string;
  sections: unknown[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[а-яёА-ЯЁ]/g, (c) => {
      const map: Record<string, string> = {
        а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"zh",з:"z",и:"i",
        й:"j",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",
        у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ы:"y",э:"e",ю:"yu",я:"ya",ъ:"",ь:"",
      };
      return map[c.toLowerCase()] || c;
    })
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  // Read JSON from file argument or stdin
  let raw = "";
  if (process.argv[2]) {
    raw = readFileSync(process.argv[2], "utf-8");
  } else {
    raw = readFileSync("/dev/stdin", "utf-8");
  }

  const article: Article = JSON.parse(raw);
  article.publishedAt = article.publishedAt || new Date().toISOString().slice(0, 10);
  article.slug = article.slug || slugify(article.title);

  // Generate cover image via Pollinations.ai (free)
  if (!article.coverImage) {
    try {
      article.coverImage = await generateImage(article.slug, article.title, article.category);
    } catch (e) {
      console.warn("⚠️  Image generation failed (non-critical):", e);
    }
  }

  // Read current blogData.ts
  const src = readFileSync(BLOG_DATA_PATH, "utf-8");

  // Check for duplicate slug
  if (src.includes(`slug: "${article.slug}"`)) {
    console.error(`❌ Slug "${article.slug}" already exists`);
    process.exit(1);
  }

  // Format the new article entry
  const sectionsStr = JSON.stringify(article.sections, null, 6)
    .replace(/^/gm, "      ")
    .trim();

  const coverLine = article.coverImage
    ? `\n    coverImage: "${article.coverImage}",`
    : "";

  const entry = `  {
    slug: "${article.slug}",
    title: "${article.title.replace(/"/g, '\\"')}",
    excerpt: "${article.excerpt.replace(/"/g, '\\"')}",
    category: "${article.category}",
    categorySlug: "${article.categorySlug}",
    readTime: ${article.readTime},
    publishedAt: "${article.publishedAt}",
    metaTitle: "${article.metaTitle.replace(/"/g, '\\"')}",
    metaDescription: "${article.metaDescription.replace(/"/g, '\\"')}",
    relatedServiceSlug: "${article.relatedServiceSlug}",${coverLine}
    sections: ${sectionsStr},
  },`;

  // Insert before closing bracket of ARTICLES array
  const updated = src.replace(/^];$/m, `${entry}\n];`);
  writeFileSync(BLOG_DATA_PATH, updated, "utf-8");
  console.log(`✅ Article "${article.title}" added to blogData.ts`);

  // Build (regenerates rss.xml too)
  console.log("🔨 Building...");
  execSync("npm run build", { cwd: CALC_DIR, stdio: "inherit" });

  // Git commit + push
  console.log("📦 Committing...");
  execSync(`git add src/pages/blog/blogData.ts`, { cwd: CALC_DIR });
  if (article.coverImage) {
    // Stage the generated image file (path is relative to calc root)
    const imgRelPath = `public${article.coverImage}`;
    execSync(`git add "${imgRelPath}"`, { cwd: CALC_DIR });
  }
  execSync(
    `git commit -m "content: add article '${article.title.replace(/'/g, "")}'\\n\\nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"`,
    { cwd: CALC_DIR }
  );
  execSync("git push origin main", { cwd: CALC_DIR });
  console.log(`🚀 Deployed! https://slot-home.ru/blog/${article.slug}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
