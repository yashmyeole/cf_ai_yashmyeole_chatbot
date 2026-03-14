// cf_ai_chatbot - Cloudflare Worker
// Main entry point that handles API routes and orchestrates requests to Durable Objects and LLM adapters

import { ChatMemory } from "./durable_objects/chat_memory.js";
import createWorkersAIAdapter from "./llm_adapters/workers_ai.js";
import createOpenAIAdapter from "./llm_adapters/openai.js";

/**
 * System prompt used for all LLM interactions
 * Concise to minimize tokens while maintaining helpful behavior
 */
const SYSTEM_PROMPT =
  "You are a helpful, concise AI assistant. Answer user questions directly and honestly. Keep responses brief (under 200 words). Be friendly and professional.";

/**
 * Cloudflare Worker entry point
 * Handles incoming HTTP requests and routes to appropriate handlers
 *
 * @param {Request} request - Incoming HTTP request
 * @param {Object} env - Cloudflare environment (bindings, vars, secrets)
 * @param {Object} ctx - Execution context
 * @returns {Response} HTTP response
 */
// Import static assets (available when built with Wrangler)
// For local dev, we'll serve static files using a simple handler

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // API routes - Worker handles these
    try {
      if (request.method === "POST" && url.pathname === "/api/chat") {
        return await handleChat(request, env, ctx);
      }

      if (request.method === "GET" && url.pathname === "/api/history") {
        return await handleHistory(request, env);
      }

      // Serve static assets (index.html, app.js, styles.css) via Wrangler assets binding.
      // This keeps local dev simple: one command (`npx wrangler dev`) for UI + API.
      if (request.method === "GET" || request.method === "HEAD") {
        if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
          return env.ASSETS.fetch(request);
        }
      }

      // Fallback for unknown routes
      return new Response("Not found", {
        status: 404,
        headers: { "Content-Type": "text/plain" },
      });
    } catch (error) {
      console.error("Worker error:", error);
      return jsonResponse(
        { error: "Internal server error", message: error.message },
        500,
      );
    }
  },

  // Export Durable Object binding
  async scheduled(event, env, ctx) {
    // Placeholder for scheduled tasks (optional)
    // Could be used for periodic cleanup, health checks, etc.
  },
};

/**
 * Export the Durable Object class for Cloudflare
 */
export { ChatMemory };

/**
 * Handle POST /api/chat - process user message and return AI response
 *
 * @param {Request} request - Must contain { userId, message } in JSON body
 * @param {Object} env - Environment with bindings and config
 * @param {Object} ctx - Execution context
 * @returns {Response} JSON response with AI reply
 */
async function handleChat(request, env, ctx) {
  try {
    // Parse request body
    const body = await request.json();
    const { userId, message } = body;

    // Validate input
    if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
      return jsonResponse({ error: "Missing or invalid userId" }, 400);
    }

    if (
      !message ||
      typeof message !== "string" ||
      message.trim().length === 0
    ) {
      return jsonResponse({ error: "Missing or invalid message" }, 400);
    }

    const trimmedUserId = userId.trim();
    const trimmedMessage = message.trim();

    // Get Durable Object instance for this user
    const doId = env.CHAT_MEMORY.idFromName(trimmedUserId);
    const stub = env.CHAT_MEMORY.get(doId);

    // Append user message to history
    await stub.fetch(
      new Request("http://local/append", {
        method: "PUT",
        body: JSON.stringify({ role: "user", text: trimmedMessage }),
      }),
    );

    // Retrieve full conversation history
    const historyResponse = await stub.fetch(
      new Request("http://local/", {
        method: "GET",
      }),
    );
    const historyData = await historyResponse.json();
    const history = historyData.history || [];

    // Build prompt context from recent history (limit to last 6 messages to save tokens)
    const contextWindow = 6;
    const recentHistory = history.slice(-contextWindow);

    // Format history for LLM context
    let contextText = "";
    for (const msg of recentHistory.slice(0, -1)) {
      // Exclude the current message we just appended
      const role = msg.role === "user" ? "User" : "Assistant";
      contextText += `${role}: ${msg.text}\n`;
    }

    // Full prompt: system + context + current message
    const fullPrompt = contextText
      ? `${SYSTEM_PROMPT}\n\nPrevious conversation:\n${contextText}\nUser: ${trimmedMessage}`
      : `${SYSTEM_PROMPT}\n\nUser: ${trimmedMessage}`;

    // Get LLM adapters
    const workersAIAdapter = createWorkersAIAdapter(env);
    const openAIAdapter = createOpenAIAdapter(env);

    // Try adapters in order: Workers AI (primary), then OpenAI (fallback)
    let llmResponse = null;
    let lastError = null;

    // Try Workers AI first
    if (workersAIAdapter.canUse()) {
      try {
        const timeoutMs = parseInt(env.LLM_TIMEOUT_MS || "30000", 10) || 30000;
        llmResponse = await workersAIAdapter.callLM(
          SYSTEM_PROMPT,
          trimmedMessage,
          timeoutMs,
        );
        console.log("Used Workers AI");
      } catch (error) {
        lastError = error;
        console.warn("Workers AI failed, trying OpenAI fallback:", error);
      }
    }

    // Fallback to OpenAI if Workers AI unavailable
    if (!llmResponse && openAIAdapter.canUse()) {
      try {
        const timeoutMs = parseInt(env.LLM_TIMEOUT_MS || "30000", 10) || 30000;
        llmResponse = await openAIAdapter.callLM(
          SYSTEM_PROMPT,
          trimmedMessage,
          timeoutMs,
        );
        console.log("Used OpenAI fallback");
      } catch (error) {
        lastError = error;
        console.error("OpenAI also failed:", error);
      }
    }

    // If no adapter succeeded
    if (!llmResponse) {
      const errorMsg = lastError
        ? lastError.message
        : "No LLM adapter available";
      return jsonResponse({ error: errorMsg }, 500);
    }

    // Append assistant response to history
    const assistantReply = llmResponse.reply;
    await stub.fetch(
      new Request("http://local/append", {
        method: "PUT",
        body: JSON.stringify({ role: "assistant", text: assistantReply }),
      }),
    );

    // Return response to frontend
    return jsonResponse({ reply: assistantReply }, 200);
  } catch (error) {
    console.error("Chat handler error:", error);
    return jsonResponse(
      {
        error: "Failed to process chat",
        message: error.message,
      },
      500,
    );
  }
}

/**
 * Handle GET /api/history?userId=<userId> - retrieve conversation history
 *
 * @param {Request} request - Query param: userId
 * @param {Object} env - Environment with Durable Object binding
 * @returns {Response} JSON array of messages
 */
async function handleHistory(request, env) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");

    // Validate input
    if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
      return jsonResponse({ error: "Missing or invalid userId" }, 400);
    }

    // Get Durable Object for this user
    const doId = env.CHAT_MEMORY.idFromName(userId.trim());
    const stub = env.CHAT_MEMORY.get(doId);

    // Fetch history
    const response = await stub.fetch(
      new Request("http://local/", {
        method: "GET",
      }),
    );

    return response;
  } catch (error) {
    console.error("History handler error:", error);
    return jsonResponse(
      {
        error: "Failed to fetch history",
        message: error.message,
      },
      500,
    );
  }
}

/**
 * Utility: Return a JSON response with proper headers
 *
 * @param {Object} data - Data to serialize
 * @param {number} status - HTTP status code
 * @returns {Response}
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
