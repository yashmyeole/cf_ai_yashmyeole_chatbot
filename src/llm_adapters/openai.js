// cf_ai_chatbot - OpenAI LLM Adapter
// Provides integration with OpenAI API as fallback when Workers AI is unavailable
// Uses Chat Completions endpoint with gpt-4o-mini or configurable model

/**
 * Initialize OpenAI adapter
 * Requires OPENAI_API_KEY to be set as an environment secret
 *
 * @param {Object} env - Cloudflare environment (should contain OPENAI_API_KEY secret)
 * @returns {Object} Adapter interface: { canUse(), callLM() }
 */
export function createOpenAIAdapter(env) {
  // Check if API key is available
  const apiKey = env.OPENAI_API_KEY;
  const hasApiKey = apiKey !== undefined && apiKey.length > 0;

  return {
    /**
     * Check if this adapter can be used
     * @returns {boolean}
     */
    canUse: () => hasApiKey,

    /**
     * Call OpenAI Chat Completions API
     *
     * @param {string} systemPrompt - System instruction for the model
     * @param {string} userMessage - User's message
     * @param {number} timeoutMs - Request timeout in milliseconds
     * @returns {Promise<{reply: string}>} Response object with reply text
     */
    callLM: async (systemPrompt, userMessage, timeoutMs = 30000) => {
      // Get model from environment (default: gpt-4o-mini for cost efficiency)
      const model = env.OPENAI_MODEL || "gpt-4o-mini";

      try {
        // Create abort signal for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        // Call OpenAI Chat Completions API
        const response = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                {
                  role: "system",
                  content: systemPrompt,
                },
                {
                  role: "user",
                  content: userMessage,
                },
              ],
              // Reasonable defaults for free-tier usage
              temperature: 0.7,
              max_tokens: 500,
              top_p: 0.9,
            }),
            signal: controller.signal,
          },
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg =
            errorData.error?.message || `OpenAI API error: ${response.status}`;
          throw new Error(errorMsg);
        }

        const data = await response.json();

        // Extract reply from OpenAI response structure
        // OpenAI returns { choices: [{ message: { content: "..." } }] }
        const reply =
          data.choices?.[0]?.message?.content || "No response from OpenAI";

        return { reply };
      } catch (error) {
        if (error.name === "AbortError") {
          throw new Error("OpenAI request timeout");
        }
        throw error;
      }
    },
  };
}

export default createOpenAIAdapter;
