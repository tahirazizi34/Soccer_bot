require("dotenv").config();
const { runCycle } = require("./src/agent");

const required = ["GEMINI_API_KEY", "FACEBOOK_PAGE_ID", "FACEBOOK_ACCESS_TOKEN"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

console.log("⚽ Soccer Bot starting up...");
console.log("🕐 Schedule: Every 60 minutes via setInterval");
console.log("📄 Page ID:", process.env.FACEBOOK_PAGE_ID);

const INTERVAL_MS = 60 * 60 * 1000; // 1 hour in milliseconds

// Run immediately on startup
runCycle();

// Then every hour using setInterval (more reliable than cron on Railway)
setInterval(() => {
  runCycle();
}, INTERVAL_MS);

console.log(`✅ Scheduler active — next post in 60 minutes.`);
