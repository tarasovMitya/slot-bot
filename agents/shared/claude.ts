const API_KEY = process.env.ANTHROPIC_API_KEY!;
const API_URL = "https://api.anthropic.com/v1/messages";

export type ClaudeModel = "claude-haiku-4-5-20251001" | "claude-sonnet-4-6";

export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  model: ClaudeModel = "claude-haiku-4-5-20251001",
  maxTokens = 4096,
): Promise<string> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json() as {
    content: Array<{ type: string; text: string }>;
  };
  return data.content[0]?.text ?? "";
}

export async function callHaiku(system: string, user: string): Promise<string> {
  return callClaude(system, user, "claude-haiku-4-5-20251001", 2048);
}

export async function callSonnet(system: string, user: string): Promise<string> {
  return callClaude(system, user, "claude-sonnet-4-6", 8096);
}
