// VK community wall posting client
// Uses VK API v5.199 with community token

const VK_API = "https://api.vk.com/method";
const VK_VERSION = "5.199";
const VK_GROUP_ID = 239140857; // club239140857
const VK_OWNER_ID = -239140857; // negative = group

// Set via VK_TOKEN env var or directly
const VK_TOKEN = process.env.VK_TOKEN || "";

interface VkWallPostParams {
  message: string;
  attachments?: string; // "photo123_456,doc789_012"
  link?: string;
}

interface VkPostResult {
  postId: number;
  url: string;
}

export async function postToVk(params: VkWallPostParams): Promise<VkPostResult> {
  const body = new URLSearchParams({
    owner_id: String(VK_OWNER_ID),
    from_group: "1",
    message: params.message,
    v: VK_VERSION,
    access_token: VK_TOKEN,
  });

  if (params.attachments) body.append("attachments", params.attachments);
  if (params.link) body.append("attachments", params.link);

  const res = await fetch(`${VK_API}/wall.post`, {
    method: "POST",
    body,
  });

  const data = (await res.json()) as { response?: { post_id: number }; error?: { error_msg: string } };

  if (data.error) throw new Error(`VK API error: ${data.error.error_msg}`);

  const postId = data.response!.post_id;
  return {
    postId,
    url: `https://vk.com/wall${VK_OWNER_ID}_${postId}`,
  };
}

// Delayed post (Unix timestamp)
export async function scheduleVkPost(params: VkWallPostParams, publishAt: Date): Promise<VkPostResult> {
  const body = new URLSearchParams({
    owner_id: String(VK_OWNER_ID),
    from_group: "1",
    message: params.message,
    publish_date: String(Math.floor(publishAt.getTime() / 1000)),
    v: VK_VERSION,
    access_token: VK_TOKEN,
  });

  if (params.attachments) body.append("attachments", params.attachments);

  const res = await fetch(`${VK_API}/wall.post`, { method: "POST", body });
  const data = (await res.json()) as { response?: { post_id: number }; error?: { error_msg: string } };

  if (data.error) throw new Error(`VK API error: ${data.error.error_msg}`);

  const postId = data.response!.post_id;
  return { postId, url: `https://vk.com/wall${VK_OWNER_ID}_${postId}` };
}

// CLI: VK_TOKEN=xxx ts-node vk.ts "Текст поста"
if (import.meta.url === `file://${process.argv[1]}`) {
  const message = process.argv[2];
  if (!message || !VK_TOKEN) {
    console.error("Usage: VK_TOKEN=xxx ts-node vk.ts <message>");
    process.exit(1);
  }
  postToVk({ message })
    .then((r) => console.log(`✅ Posted: ${r.url}`))
    .catch(console.error);
}
