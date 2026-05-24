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
4. Also generate a short Unsplash search query (2-4 words) that best matches the news story for finding a relevant photo.
5. Return ONLY a JSON object with three fields: {"headline": "short headline of the news", "post": "the full Facebook post text", "imageQuery": "unsplash search query"}
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

  const text = textBlock.text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in response");
  const parsed = JSON.parse(jsonMatch[0]);
  return parsed;
}

async function fetchUnsplashImage(query) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    console.log("⚠️  No Unsplash key — skipping image");
    return null;
  }

  console.log(`🖼️  Searching Unsplash for: "${query}"`);

  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=landscape&client_id=${accessKey}`;
  const response = await fetch(url);
  const data = await response.json();

  if (!data.results || data.results.length === 0) {
    console.log("⚠️  No Unsplash image found, trying fallback...");
    // Fallback to generic soccer photo
    const fallback = await fetch(`https://api.unsplash.com/search/photos?query=soccer+football+stadium&per_page=5&orientation=landscape&client_id=${accessKey}`);
    const fallbackData = await fallback.json();
    if (!fallbackData.results || fallbackData.results.length === 0) return null;
    return fallbackData.results[0].urls.regular;
  }

  // Pick a random one from top 5 for variety
  const random = data.results[Math.floor(Math.random() * data.results.length)];
  return random.urls.regular;
}

async function postToFacebookWithImage(message, imageUrl) {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;

  // If we have an image, upload it first then attach to post
  if (imageUrl) {
    console.log("📸 Uploading image to Facebook...");

    // Step 1: Upload photo unpublished
    const photoRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: imageUrl,
        published: false,
        access_token: accessToken,
      }),
    });

    const photoData = await photoRes.json();

    if (!photoRes.ok || photoData.error) {
      console.log("⚠️  Image upload failed, posting without image...");
      return postToFacebook(message);
    }

    console.log(`✅ Image uploaded: ${photoData.id}`);

    // Step 2: Create post with attached photo
    const postRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        attached_media: [{ media_fbid: photoData.id }],
        access_token: accessToken,
      }),
    });

    const postData = await postRes.json();

    if (!postRes.ok || postData.error) {
      const err = postData?.error;
      throw new Error(`Facebook API Error [Code ${err?.code}]: ${err?.message}`);
    }

    return postData;
  }

  return postToFacebook(message);
}

async function postToFacebook(message) {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;

  console.log("📤 Posting to Facebook (text only)...");

  const url = `https://graph.facebook.com/v19.0/${pageId}/feed`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, access_token: accessToken }),
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    const err = data?.error;
    throw new Error(`Facebook API Error [Code ${err?.code}]: ${err?.message} (Type: ${err?.type})`);
  }

  return data;
}

async function runCycle() {
  console.log("\n========================================");
  console.log(`⚽ Soccer Bot running at ${new Date().toISOString()}`);
  console.log("========================================");

  try {
    const { headline, post, imageQuery } = await fetchSoccerNewsAndGeneratePost();
    console.log(`📰 Story: ${headline}`);
    console.log(`✍️  Post: ${post}`);
    console.log(`🔎 Image query: ${imageQuery}`);

    const imageUrl = await fetchUnsplashImage(imageQuery || "soccer football");
    if (imageUrl) {
      console.log(`🖼️  Image found: ${imageUrl}`);
    }

    const result = await postToFacebookWithImage(post, imageUrl);
    console.log(`✅ Posted successfully! Post ID: ${result.id}`);
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
  }
}

module.exports = { runCycle };
