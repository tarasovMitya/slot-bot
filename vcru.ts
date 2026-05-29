// vc.ru API client for publishing articles
// Auth: form-encoded, JWT via JWTAuthorization header

const VCRU_API = "https://api.vc.ru";
const VCRU_AUTH_API = "https://api.vc.ru/v3.4/auth";
const VCRU_SUBSITE_ID = 5980245; // Slot Home personal blog

let REFRESH_TOKEN = "8ea5ff102c1b28636c423dd62c2cb83b0f93731bb2cbd585f0062b60ef5f2419";
let cachedAccessToken: string | null = null;
let tokenExpiry = 0;

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiry - 30_000) {
    return cachedAccessToken;
  }

  const res = await fetch(`${VCRU_AUTH_API}/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `token=${REFRESH_TOKEN}`,
  });

  const data = (await res.json()) as {
    data: { accessToken: string; refreshToken: string; accessExpTimestamp: number; refreshExpTimestamp: number };
  };

  REFRESH_TOKEN = data.data.refreshToken;
  cachedAccessToken = data.data.accessToken;
  tokenExpiry = data.data.accessExpTimestamp * 1000;

  return cachedAccessToken;
}

interface VcruBlock {
  type: "text" | "header" | "quote";
  cover: boolean;
  hidden: boolean;
  anchor: string;
  data: Record<string, string>;
}

interface PublishResult {
  id: number;
  url: string;
  title: string;
}

export async function publishToVcru(
  title: string,
  htmlContent: string,
  publish = false
): Promise<PublishResult> {
  const token = await getAccessToken();

  const blocks: VcruBlock[] = [
    {
      type: "text",
      cover: false,
      hidden: false,
      anchor: "",
      data: { text: htmlContent },
    },
  ];

  const entryObj = {
    subsite_id: VCRU_SUBSITE_ID,
    title,
    entry: { blocks },
  };

  const body = new URLSearchParams();
  body.append("entry", JSON.stringify(entryObj));

  const createRes = await fetch(`${VCRU_API}/v2.8/editor`, {
    method: "POST",
    headers: {
      "JWTAuthorization": `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const createData = (await createRes.json()) as { result: { entry: { id: number; url: string; title: string } } };
  const entry = createData.result.entry;

  if (publish) {
    await publishDraft(entry.id);
  }

  return { id: entry.id, url: entry.url, title: entry.title };
}

export async function publishDraft(entryId: number): Promise<void> {
  const token = await getAccessToken();

  await fetch(`${VCRU_API}/v2.8/editor/${entryId}/publish`, {
    method: "POST",
    headers: { "JWTAuthorization": `Bearer ${token}` },
  });
}

// CLI usage: ts-node vcru.ts "Заголовок" "HTML-контент" [--publish]
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , title, content, flag] = process.argv;
  if (!title || !content) {
    console.error("Usage: ts-node vcru.ts <title> <html-content> [--publish]");
    process.exit(1);
  }

  publishToVcru(title, content, flag === "--publish")
    .then((r) => {
      console.log(`✅ Entry created: ${r.url}`);
      if (flag === "--publish") console.log("📢 Published!");
    })
    .catch(console.error);
}
