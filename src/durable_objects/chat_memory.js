// cf_ai_chatbot - Durable Object for conversation memory
// Stores per-user conversation history with automatic cleanup of old messages

import { DurableObject } from "cloudflare:workers";

/**
 * ChatMemory Durable Object
 * Handles persistent storage of conversation history for each user
 * Automatically limits history to CONVERSATION_HISTORY_LIMIT messages
 */
export class ChatMemory extends DurableObject {
  /**
   * Constructor - initializes Durable Object state
   * @param {Object} state - Cloudflare Durable Object state
   * @param {Object} env - Cloudflare environment (bindings, vars, secrets)
   */
  constructor(state, env) {
    super(state, env);
    this.state = state;
    this.env = env;
    this.historyLimit =
      parseInt(env.CONVERSATION_HISTORY_LIMIT || "6", 10) || 6;
  }

  /**
   * Handle incoming requests to the Durable Object
   * Routes: PUT (append), GET (read)
   * @param {Request} request - Incoming request
   * @returns {Response} JSON response
   */
  async fetch(request) {
    const url = new URL(request.url);

    // PUT /append : append a message
    if (request.method === "PUT" && url.pathname === "/append") {
      return await this.handleAppend(request);
    }

    // GET / : get all history
    if (request.method === "GET" && url.pathname === "/") {
      return await this.handleRead();
    }

    return new Response("Not Found", { status: 404 });
  }

  /**
   * Append a message to conversation history
   * @param {Request} request - Must contain JSON body with role and text
   * @returns {Response} JSON response with updated history
   */
  async handleAppend(request) {
    try {
      const body = await request.json();
      const { role, text } = body;

      if (!role || !text) {
        return new Response(JSON.stringify({ error: "Missing role or text" }), {
          status: 400,
        });
      }

      // Use blockConcurrencyWhile to ensure atomic updates
      await this.state.blockConcurrencyWhile(async () => {
        let history = (await this.state.storage.get("messages")) || [];

        // Append new message
        history.push({
          role,
          text,
          ts: Date.now(),
        });

        // Trim history to limit (keep newest entries)
        if (history.length > this.historyLimit) {
          history = history.slice(-this.historyLimit);
        }

        // Persist to storage
        await this.state.storage.put("messages", history);
      });

      return new Response(JSON.stringify({ status: "appended" }), {
        status: 200,
      });
    } catch (error) {
      console.error("ChatMemory append error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
      });
    }
  }

  /**
   * Read conversation history
   * @returns {Response} JSON array of messages
   */
  async handleRead() {
    try {
      const history = (await this.state.storage.get("messages")) || [];
      return new Response(JSON.stringify({ history }), { status: 200 });
    } catch (error) {
      console.error("ChatMemory read error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
      });
    }
  }
}

export default ChatMemory;
