const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const HISTORY_FILE = path.join(__dirname, "posted_headlines.json");
const MAX_HISTORY = 48; // keep last 48 headlines (2 days worth)

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
    }
  } catch (e) {}
  return [];
}

function saveHistory(history) {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (e) {
    console.log("⚠️  Could not save history:", e.message);
  }
}

function normalizeHeadline(h) {
  return h.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

function isTooSimilar(newHeadline, history) {
  const normalized = normalizeHeadline(newHeadline);
  const newWords = new Set(normalized.split(" ").filter(w => w.length > 4));

  for (const old of history) {
    const oldNorm = normalizeHeadline(old);
    const oldWords = new Set(oldNorm.split(" ").filter(w => w.length > 4));
    const shared = [...newWords].filter(w => oldWords.has(w));
    const similarity = shared.length / Math.max(newWords.size, 1);
    if (similarity > 0.6) return true;
  }
  return false;
}

async function fetchSoccerNewsAndGeneratePost(recentHeadlines) {
  console.log("🔍 Searching for latest soccer news with Gemini...");

  const model = genai.getGenerativeModel({
    model: "gemini-2.5-flash",
    tools: [{ googleSearch: {} }],
  });

  const avoidSection = recentHeadlines.length > 0
    ? `\n\nIMPORTANT: Do NOT cover any of these recently posted stories:\n${recentHeadlines.slice(0, 10).map((h, i) => `${i + 1}. ${h}`).join("\n")}\nPick a DIFFERENT story that hasn't been covered yet.`
    : "";

  const prompt = `Search for the LATEST breaking soccer/football news right now (${new Date().toUTCString()}).${avoidSection}

Find the most interesting story that is NEW and UNIQUE and return ONLY a JSON object with these three fields:
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
      const err = photoData?.error;
      console.log(`⚠️  Image upload failed [Code ${err?.code}]: ${err?.message || JSON.stringify(photoData)} — posting without image...`);
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
    const history = loadHistory();
    console.log(`📋 Recent headlines in memory: ${history.length}`);

    const { headline, post, imageQuery } = await fetchSoccerNewsAndGeneratePost(history);
    console.log(`📰 Story: ${headline}`);

    // Check similarity before posting
    if (isTooSimilar(headline, history)) {
      console.log("⚠️  Too similar to a recent post — skipping this cycle.");
      return;
    }

    console.log(`✍️  Post: ${post}`);
    console.log(`🔎 Image query: ${imageQuery}`);

    const imageUrl = await fetchUnsplashImage(imageQuery || "soccer football");
    if (imageUrl) console.log(`🖼️  Image found: ${imageUrl}`);

    const result = await postToFacebookWithImage(post, imageUrl);
    console.log(`✅ Posted successfully! Post ID: ${result.id}`);

    // Save headline to history
    const updated = [headline, ...history].slice(0, MAX_HISTORY);
    saveHistory(updated);
    console.log(`💾 Headline saved to history (${updated.length} total)`);

  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
  }
}

module.exports = { runCycle };
