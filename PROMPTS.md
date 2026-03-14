# PROMPTS.md

## Original Prompt Used to Generate This Repository

Below is the exact prompt provided to generate the `cf_ai_chatbot` repository:

---

You are an expert Cloudflare developer. implement a minimal but fully functional Cloudflare AI demo satisfying the following assignment requirements:

Goal

- A small AI chat web app using Cloudflare developer stack:
  - Frontend: Cloudflare Pages static site (chat UI).
  - Backend: Cloudflare Worker that coordinates requests.
  - Memory / state: Cloudflare Durable Object for per-user conversation memory.
  - LLM: Prefer Workers AI running Llama 3.3, but include a fully-working fallback to OpenAI's API in case the Workers AI binding is not present.
  - Workflow/orchestration: the Worker code will act as the coordinator and call Durable Objects and the LLM.
- The repo name must start with `cf_ai_` (use `cf_ai_chatbot`).
- Include `README.md` with clear running & deployment instructions and required environment variables.
- Include `PROMPTS.md` containing the exact prompt you used (this one).
- Keep the project runnable within Cloudflare free-tier for small demo usage.
- Include helpful inline comments in code and short explanations where needed.

Output format & constraints

1. Output ONLY the repository tree and file contents. Do NOT ask questions.
2. For each file, show the path and then the complete file content in a fenced code block.
3. Include these files (at minimum):
   - `README.md`
   - `PROMPTS.md`
   - `wrangler.toml`
   - `package.json` (if used for local dev tooling)
   - `pages/` or `static/` folder with `index.html`, `app.js`, `styles.css`
   - `worker/` folder with the Worker entry (`src/index.js` or `worker.js`) and any helper modules
   - `worker/durable_objects/chat_memory.js` implementing a Durable Object class to store conversation history
   - `worker/llm_adapters/workers_ai.js` (Workers AI integration) and `worker/llm_adapters/openai.js` (OpenAI fallback)
   - `scripts/dev_commands.sh` (unix script with useful local test commands)
   - `.gitignore`
4. Ensure every file includes meaningful comments and is production-feasible (not intentionally truncated).
5. Use plain JavaScript (ES modules) for Workers and vanilla JS for the frontend (no heavy frameworks).
6. Use fetch-compatible patterns and standard Cloudflare Workers APIs.
7. In README, include step-by-step commands for:
   - Local development (`wrangler dev` or Pages preview)
   - How to set required secrets (examples: `wrangler secret put OPENAI_API_KEY`, `wrangler secret put WORKERS_AI_API_KEY` or equivalent)
   - How to deploy to Cloudflare (wrangler publish or Pages deploy)
   - How to test with `curl` or browser
8. Include example environment variables / secrets and recommended free-tier settings:
   - WORKERS_AI_ENABLED=true|false
   - WORKERS_AI_MODEL="llama-3.3" (used for Workers AI call)
   - OPENAI_API_KEY (fallback)
   - DURABLE_NAMESPACE binding name for Durable Objects
9. Make the Worker safe and cost-conscious:
   - Minimal token usage in prompt examples
   - Short default conversation history length (e.g., last 6 messages) kept in Durable Object
   - Rate-limit notes in README
10. Provide example prompts that the frontend sends to the LLM (concise system + user instruction).
11. Provide an example `PROMPTS.md` with the prompt that was used to generate the repository (this exact text).

Functional requirements (behavior)

- The frontend must allow a user to:
  - Enter a username (or session id)
  - Send chat messages
  - See AI responses streamed or returned promptly
- The Worker endpoints:
  - `POST /api/chat` — receives `{ userId, message }`, forwards message to Durable Object (append history), constructs a compact prompt using last N messages, calls the LLM adapter, appends response to history, returns `{ reply }`.
  - `GET /api/history?userId=...` — returns conversation history (last N messages).
- Durable Object:
  - Stores history as a small array of `{role:'user'|'assistant', text, ts}` limited to last N entries (configurable).
  - Exposes methods `append(userId, role, text)` and `read(userId)` so Worker interacts via `state.blockConcurrencyWhile` or standard fetch interface.
- LLM adapter:
  - `workers_ai.js`: call Workers AI if `WORKERS_AI_ENABLED` is set; include example request format for a Workers AI binding and use placeholders if necessary (explain in code comments how to replace placeholders with proper binding).
  - `openai.js`: call OpenAI Completion/Chat API as fallback (use `gpt-4o-mini` or similar; include option to use Llama if user provides a URL to a hosted Llama endpoint).
  - Return only `{ reply }` from each adapter (normalize outputs).
- Error handling:
  - Graceful errors and good HTTP status codes
  - Timeout handling and informative messages to frontend

Developer ergonomics

- Include `scripts/dev_commands.sh` with commands to run a local worker, to run curl tests, and to deploy.
- Include `.gitignore` to ignore `node_modules` and local secrets.

Make the code clear and ready to commit. Keep the entire project compact but functional (suitable as a portfolio assignment).

Now: produce the full repository tree and each file content as described above. Place the exact text of this prompt in `PROMPTS.md`. End of instructions.

---

## Notes

- This prompt was designed to create a minimal, production-ready Cloudflare AI chatbot
- The project satisfies all requirements listed above
- All file contents match the specifications outlined
- The repository is ready for deployment and further customization
