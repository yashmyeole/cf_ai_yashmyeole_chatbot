// cf_ai_chatbot - Workers AI LLM Adapter
// Provides integration with Cloudflare Workers AI (Llama 3.3)
// This is the primary LLM adapter; OpenAI is used as fallback

/**
 * Initialize Workers AI adapter
 * Requires the AI binding to be available in the Worker environment
 *
 * @param {Object} env - Cloudflare environment (should contain AI binding)
 * @returns {Object} Adapter interface: { canUse(), callLM() }
 */
export function createWorkersAIAdapter(env) {
  // Check if Workers AI is enabled and available
  const isEnabled = env.WORKERS_AI_ENABLED !== "false";
  const hasAIBinding = env.AI !== undefined;

  return {
    /**
     * Check if this adapter can be used
     * @returns {boolean}
     */
    canUse: () => isEnabled && hasAIBinding,

    /**
     * Call Workers AI with a prompt
     * Uses Llama 3.3 model by default
     *
     * @param {string} systemPrompt - System instruction for the model
     * @param {string} userMessage - User's message
     * @param {number} timeoutMs - Request timeout in milliseconds
     * @returns {Promise<{reply: string}>} Response object with reply text
     */
    callLM: async (systemPrompt, userMessage, timeoutMs = 30000) => {
      // Get model name from environment (default: llama-3.3)
      const modelName = env.WORKERS_AI_MODEL || "llama-3.3";

      // Build the prompt in a format suitable for Llama
      // Llama models work best with a clear system/assistant/user structure
      const fullPrompt = `${systemPrompt}\n\nUser: ${userMessage}\n\nAssistant:`;

      try {
        // Create abort signal for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        // Call Workers AI
        // Note: The AI binding is provisioned by Cloudflare in the Worker environment
        // No authentication headers needed - it's bound to your account
        const response = await env.AI.run(modelName, {
          prompt: fullPrompt,
          // Optional parameters for Llama:
          // max_tokens: 512,        // Limit response length
          // temperature: 0.7,       // Control randomness
          // top_p: 0.9,             // Nucleus sampling
        });

        clearTimeout(timeoutId);

        // Extract text from response
        // Workers AI returns { response: "text" } or similar structure
        const reply =
          response.response || response.result || JSON.stringify(response);

        return { reply };
      } catch (error) {
        if (error.name === "AbortError") {
          throw new Error("Workers AI request timeout");
        }
        throw error;
      }
    },
  };
}

export default createWorkersAIAdapter;
