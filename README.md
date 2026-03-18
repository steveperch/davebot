# DaveBot — Loom Knowledge Base

AI-powered knowledge base that indexes Loom video transcripts and supporting documents. Employees can ask questions and get answers with links to source videos/docs.

## Features

- **Video Library** — Import Loom videos (single or bulk), auto-fetch transcripts
- **Document Library** — Add supporting docs and files alongside videos
- **AI Q&A** — Ask questions, get answers from the full knowledge base
- **Slack Integration** — `/davebot` slash command + @mention Q&A
- **Slack Auto-Ingest** — Loom URLs shared in Slack channels are auto-imported

## Tech Stack

- **Frontend:** React + Tailwind CSS + shadcn/ui
- **Backend:** Express.js
- **AI:** Anthropic Claude for Q&A answers
- **Storage:** In-memory (resets on restart)

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude AI |
| `PORT` | No | Server port (defaults to 5000) |

## Deploy to Railway

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) and create a new project
3. Choose "Deploy from GitHub repo" and select this repo
4. Add environment variable: `ANTHROPIC_API_KEY` = your key
5. Railway auto-detects Node.js, runs `npm run build` then `npm start`
6. Copy your Railway public URL for Slack setup

## Local Development

```bash
npm install
ANTHROPIC_API_KEY=your-key npm run dev
```

## Slack Setup

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps)
2. Add slash command `/davebot` → Request URL: `https://YOUR-RAILWAY-URL/api/slack/command`
3. Enable Event Subscriptions → Request URL: `https://YOUR-RAILWAY-URL/api/slack/events`
4. Subscribe to bot events: `app_mention`, `message.channels`, `link_shared`
5. Add bot scopes: `commands`, `chat:write`, `app_mentions:read`, `channels:history`, `links:read`
6. Install to workspace
7. `/invite @DaveBot` in channels where Loom links are shared
