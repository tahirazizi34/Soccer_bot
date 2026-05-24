require("dotenv").config();
const cron = require("node-cron");
const { runCycle } = require("./src/agent");

const required = ["GEMINI_API_KEY", "FACEBOOK_PAGE_ID", "FACEBOOK_ACCESS_TOKEN"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

console.log("⚽ Soccer Bot starting up...");
console.log("🕐 Schedule: Every 1 hour");
console.log("📄 Page ID:", process.env.FACEBOOK_PAGE_ID);

// Run immediately on startup
runCycle();

// Then every hour
cron.schedule("0 * * * *", () => {
  runCycle();
});

console.log("✅ Scheduler active. Bot is running!");
