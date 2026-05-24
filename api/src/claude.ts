import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";

export type GenResult = {
  text: string;
  variations: string[];
  usage: { input: number; output: number };
};

export async function generate(prompt: string, maxTokens = 1600): Promise<GenResult> {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();
  const parts = text.split(/\n?-{3,}\n?/).map((s) => s.trim()).filter(Boolean);
  const variations = parts.length >= 2 ? parts.slice(0, 3) : [text];
  return {
    text,
    variations,
    usage: { input: msg.usage.input_tokens, output: msg.usage.output_tokens },
  };
}
