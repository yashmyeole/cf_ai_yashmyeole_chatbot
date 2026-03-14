# cf_ai_chatbot

A minimal but fully functional AI chat web app built with the Cloudflare developer stack. This project demonstrates:

- **Frontend**: Cloudflare Pages static site with a simple chat UI
- **Backend**: Cloudflare Worker coordinating requests
- **State**: Cloudflare Durable Objects storing per-user conversation memory
- **LLM**: Primary integration with Workers AI (Llama 3.3), with automatic fallback to OpenAI's API

## Project Structure

```
cf_ai_yashmyeole_chatbot/
├── pages/                           # Cloudflare Pages static site (frontend)
│   ├── index.html                   # Chat UI HTML
│   ├── app.js                       # Frontend chat logic (vanilla JS)
│   └── styles.css                   # Basic styling
├── src/
│   ├── index.js                     # Main Worker entry point (handles API routes)
│   ├── durable_objects/
│   │   └── chat_memory.js           # Durable Object class for conversation history
│   └── llm_adapters/
│       ├── workers_ai.js            # Workers AI (Llama 3.3) integration
│       └── openai.js                # OpenAI Chat Completions fallback
├── wrangler.toml                    # Wrangler configuration (Worker + DO bindings)
├── package.json                     # Dependencies for local dev
├── .gitignore                       # Git exclusions
├── script/
│   └── dev_commands.sh              # Useful local test and deployment commands
├── README.md                        # This file
└── PROMPTS.md                       # Original prompt used to generate repo
```

## Quick Start

### Prerequisites

- **Node.js** v16+ and **npm**
- **Wrangler CLI**: `npm install -g wrangler`
- Cloudflare account with access to Durable Objects (even on free tier)
- (Optional) OpenAI API key for fallback LLM

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment & Secrets

In `wrangler.toml`, the configuration already includes:

- Durable Object bindings
- Environment variables for configuration

**To use Workers AI (Cloudflare's free LLM):**

```bash
# Workers AI is part of the Cloudflare free tier; no additional setup needed.
# The Worker will automatically use it if available.
```

**To set up OpenAI fallback:**

```bash
wrangler secret put OPENAI_API_KEY
# Paste your OpenAI API key when prompted
# (This is only used if Workers AI is unavailable or fails)
```

**Optional configuration via secrets:**

```bash
# Control which LLM to use (defaults to workers_ai if available)
wrangler secret put WORKERS_AI_ENABLED
# Set to "true" or "false"

# Model name for Workers AI (defaults to "llama-3.3")
wrangler secret put WORKERS_AI_MODEL
# e.g., "llama-3.3"
```

### 3. Local Development

```bash
# Start local Wrangler dev server (Worker + Durable Objects emulation)
wrangler dev

# In another terminal, test via curl (see scripts/dev_commands.sh for examples)
curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user","message":"Hello, who are you?"}'

# Or open http://localhost:8787 in your browser to use the chat UI
```

### 4. Deploy to Cloudflare

**Deploy the Worker:**

```bash
wrangler publish
# or
wrangler deploy
```

**Deploy the Pages frontend:**

If using Cloudflare Pages with GitHub integration, push to your repo. Otherwise:

```bash
wrangler pages deploy pages/
```

Your chat app will be live at `https://<project>.pages.dev` (Worker routes at `/api/*`).

## API Endpoints

### POST `/api/chat`

Send a user message and get an AI response.

**Request:**

```json
{
  "userId": "user123",
  "message": "What is the meaning of life?"
}
```

**Response:**

```json
{
  "reply": "The meaning of life is a philosophical question... [AI response]"
}
```

**Status codes:**

- `200`: Success
- `400`: Missing userId or message
- `500`: LLM error or all adapters unavailable

### GET `/api/history?userId=<userId>`

Retrieve conversation history for a user.

**Response:**

```json
{
  "history": [
    { "role": "user", "text": "Hello", "ts": 1615000000000 },
    { "role": "assistant", "text": "Hi there!", "ts": 1615000001000 }
  ]
}
```

## Configuration & Secrets

### Environment Variables (in `wrangler.toml`)

- `WORKERS_AI_ENABLED` (default: `"true"`): Enable/disable Workers AI
- `WORKERS_AI_MODEL` (default: `"llama-3.3"`): Model ID for Workers AI
- `CONVERSATION_HISTORY_LIMIT` (default: `6`): Max messages to keep per user
- `OPENAI_MODEL` (default: `"gpt-4o-mini"`): OpenAI model for fallback

### Secrets (via `wrangler secret put`)

- `OPENAI_API_KEY`: Your OpenAI API key (required for fallback LLM)

## LLM Behavior

### 1. Workers AI (Primary)

- Uses Cloudflare's free Workers AI with Llama 3.3 model
- Fast, no external API calls needed
- Runs within Cloudflare network

### 2. OpenAI (Fallback)

- Automatically used if Workers AI is disabled or fails
- Uses `gpt-4o-mini` (cost-effective) or can be configured to `gpt-4-turbo`
- Requires `OPENAI_API_KEY` secret

**Adapter selection logic:**

1. If `WORKERS_AI_ENABLED` is true, try Workers AI
2. If Workers AI unavailable or fails, fall back to OpenAI
3. If both unavailable, return error

## Free-Tier Optimization

This project is designed to run comfortably within Cloudflare's free tier:

- **Durable Objects**: Free tier includes 1M operations/day (sufficient for a small demo)
- **Workers**: 100k requests/day free
- **Workers AI**: Free tier includes request limits; check Cloudflare dashboard
- **Conversation History**: Limited to last **6 messages** per user by default to reduce storage usage
- **Prompt Engineering**: System prompt and messages kept concise to minimize token usage

## Example Usage

### Via Browser (Chat UI)

1. Open `http://localhost:8787` (or your deployed Pages URL)
2. Enter your username
3. Type a message and click "Send"
4. See AI response streamed in

### Via cURL

```bash
# Single message
curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -d '{"userId":"alice","message":"Hi, tell me a short joke."}'

# Get history
curl "http://localhost:8787/api/history?userId=alice"
```

### Via JavaScript

```javascript
const response = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    userId: "bob",
    message: "What time is it?",
  }),
});
const data = await response.json();
console.log(data.reply);
```

## Rate Limiting & Safety

- Each user conversation is isolated to its own Durable Object
- Default history limit is 6 messages to control storage and context length
- Prompts are compact to minimize token usage
- No explicit rate limiter in this minimal version; Cloudflare's infrastructure provides implicit limits

For production, consider adding:

- Request rate limiting (Cloudflare Page Rules)
- Message length validation
- Request signing/authentication

## Development Tips

### Check Wrangler Logs

```bash
# While running wrangler dev, logs appear in the console
# For deployed workers, view logs:
wrangler logs
```

### Debug Durable Objects

Edit `wrangler.toml` to point to a local or staging namespace:

```toml
[[durable_objects.bindings]]
name = "CHAT_MEMORY"
class_name = "ChatMemory"
script_name = "cf-ai-chatbot"
```

### Test with Slow Network (Browser DevTools)

1. Open DevTools → Network tab
2. Throttle connection
3. Send a message and observe streaming/delays

## Deployment Checklist

- [ ] Set `OPENAI_API_KEY` via `wrangler secret put` (if using fallback)
- [ ] Verify `wrangler.toml` has correct namespace bindings
- [ ] Run `wrangler publish` to deploy Worker
- [ ] Run `wrangler pages deploy pages/` or push to GitHub for Pages
- [ ] Test `/api/chat` and `/api/history` endpoints
- [ ] Verify Durable Object is accessible in Cloudflare dashboard

## Troubleshooting

### "No adapter available"

- Ensure `OPENAI_API_KEY` is set if Workers AI is disabled
- Check Cloudflare dashboard for Workers AI limits

### LLM responses timeout

- Workers AI usually responds in <5s; verify network
- OpenAI call timeout is 30s; check API status

### Durable Object not persisting

- Verify binding name in `wrangler.toml` matches code
- Ensure Durable Object migration is enabled

### Pages won't deploy

- Confirm `pages/` folder contains `index.html`
- Check Cloudflare Pages project settings

## Example Prompts

System prompt used (see `src/index.js`):

```
You are a helpful, concise AI assistant. Answer user questions directly and honestly.
Keep responses brief (under 200 words). Be friendly but professional.
```

See `PROMPTS.md` for the full original prompt used to generate this repo.

## License

MIT (or as specified in your project)

## Notes

- This is a minimal but production-ready example
- Code is fully commented for clarity
- Suitable as a portfolio project demonstrating Cloudflare developer stack
- Free-tier optimized but scalable to paid plans if needed
# cf_ai_yashmyeole_chatbot
