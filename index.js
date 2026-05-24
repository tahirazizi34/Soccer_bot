require("dotenv").config();
const cron = require("node-cron");
const { runCycle } = require("./src/agent");

// Validate env vars on startup
const required = ["ANTHROPIC_API_KEY", "FACEBOOK_PAGE_ID", "FACEBOOK_ACCESS_TOKEN"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

console.log("⚽ Soccer Bot starting up...");
console.log("🕐 Schedule: Every 6 hours (12am, 6am, 12pm, 6pm)");
console.log("📄 Page ID:", process.env.FACEBOOK_PAGE_ID);

// Run immediately on startup
runCycle();

// Then run every 6 hours: midnight, 6am, 12pm, 6pm
cron.schedule("0 * * * *", () => {
  runCycle();
});

console.log("✅ Scheduler active. Bot is running!");
