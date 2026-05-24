# ⚽ Soccer Bot — AI Facebook Agent

Automatically posts soccer news to your Facebook Page 4x per day using Claude AI.

## How it works
1. Wakes up at 12am, 6am, 12pm, 6pm daily
2. Uses Claude AI + web search to find the latest soccer news
3. Generates an engaging Facebook post
4. Posts it to your page automatically

## Deploy to Railway (Free)

### Step 1 — Push to GitHub
1. Create a new repo at github.com
2. Run these commands:
```bash
git init
git add .
git commit -m "Initial soccer bot"
git remote add origin https://github.com/YOUR_USERNAME/soccer-bot.git
git push -u origin main
```

### Step 2 — Deploy on Railway
1. Go to railway.app and sign up (free)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your soccer-bot repo
4. Click "Variables" and add these 3 environment variables:
   - ANTHROPIC_API_KEY → your key from console.anthropic.com
   - FACEBOOK_PAGE_ID → 1132011973332956
   - FACEBOOK_ACCESS_TOKEN → your token from Graph API Explorer
5. Click "Deploy" — done!

## Environment Variables
| Variable | Description |
|----------|-------------|
| ANTHROPIC_API_KEY | From console.anthropic.com |
| FACEBOOK_PAGE_ID | Your Facebook Page ID |
| FACEBOOK_ACCESS_TOKEN | Page token from Graph API Explorer |

## Local Testing
```bash
npm install
cp .env.example .env
# Edit .env with your real values
npm start
```
