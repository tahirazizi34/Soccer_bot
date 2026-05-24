const { GoogleGenerativeAI } = require("@google/generative-ai");

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function fetchSoccerNewsAndGeneratePost() {
  console.log("🔍 Searching for latest soccer news with Gemini...");

  const model = genai.getGenerativeModel({
    model: "gemini-1.5-flash",
    tools: [{ googleSearch: {} }],
  });

  const prompt = `Search for the LATEST breaking soccer/football news right now (${new Date().toUTCString()}).

Find the most interesting story and return ONLY a JSON object with these three fields:
{
  "headline": "short headline of the news",
  "post": "an engaging 2-4 sentence Facebook post with relevant emojis and hashtags like #Soccer #Football plus team/player tags",
  "imageQuery": "2-4 word Unsplash search query matching the story"
}

The post must feel natural and engaging — not robotic.
Return pure JSON only — no markdown, no code fences, no extra text.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in Gemini response");
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
    console.log("⚠️  No image found, trying fallback...");
    const fallback = await fetch(`https://api.unsplash.com/search/photos?query=soccer+football+stadium&per_page=5&orientation=landscape&client_id=${accessKey}`);
    const fallbackData = await fallback.json();
    if (!fallbackData.results || fallbackData.results.length === 0) return null;
    return fallbackData.results[0].urls.regular;
  }

  const random = data.results[Math.floor(Math.random() * data.results.length)];
  return random.urls.regular;
}

async function postToFacebookWithImage(message, imageUrl) {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;

  if (imageUrl) {
    console.log("📸 Uploading image to Facebook...");

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
    if (imageUrl) console.log(`🖼️  Image found: ${imageUrl}`);

    const result = await postToFacebookWithImage(post, imageUrl);
    console.log(`✅ Posted successfully! Post ID: ${result.id}`);
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
  }
}

module.exports = { runCycle };
