const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function fetchSoccerNewsAndGeneratePost() {
  console.log("🔍 Searching for latest soccer news...");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1000,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    system: `You are a soccer news social media manager. Your job:
1. Search for the LATEST breaking soccer/football news (scores, transfers, injuries, match previews, results).
2. Write ONE engaging Facebook post about the most interesting story you find.
3. The post must: be 2-4 sentences, include relevant emojis, use hashtags (#Soccer #Football + relevant team/player tags), feel natural and engaging — not robotic.
4. Return ONLY a JSON object with two fields: {"headline": "short headline of the news", "post": "the full Facebook post text"}
Do NOT include markdown, code fences, or any other text — pure JSON only.`,
    messages: [
      {
        role: "user",
        content: `Search for the latest soccer/football news right now (${new Date().toUTCString()}) and write a Facebook post about the most interesting story.`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) throw new Error("No text response from Claude");

  const clean = textBlock.text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(clean);
  return parsed;
}

async function postToFacebook(message) {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;

  console.log("📤 Posting to Facebook...");

  const url = `https://graph.facebook.com/v19.0/${pageId}/feed`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, access_token: accessToken }),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    const err = data?.error;
    throw new Error(
      `Facebook API Error [Code ${err?.code}]: ${err?.message} (Type: ${err?.type})`
    );
  }

  return data;
}

async function runCycle() {
  console.log("\n========================================");
  console.log(`⚽ Soccer Bot running at ${new Date().toISOString()}`);
  console.log("========================================");

  try {
    const { headline, post } = await fetchSoccerNewsAndGeneratePost();
    console.log(`📰 Story: ${headline}`);
    console.log(`✍️  Post: ${post}`);

    const result = await postToFacebook(post);
    console.log(`✅ Posted successfully! Post ID: ${result.id}`);
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
  }
}

module.exports = { runCycle };
