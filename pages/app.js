// cf_ai_chatbot - Frontend Chat Application
// Vanilla JavaScript chat UI communicating with Cloudflare Worker backend

// DOM elements
const chatHistory = document.getElementById("chatHistory");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");
const loadHistoryBtn = document.getElementById("loadHistoryBtn");
const statusDiv = document.getElementById("status");
const userIdInput = document.getElementById("userId");

// State
let isLoading = false;

/**
 * Set status indicator with color
 * @param {string} message Status message
 * @param {string} type 'success', 'error', or 'loading'
 */
function setStatus(message, type = "default") {
  statusDiv.textContent = message;
  statusDiv.className = `status-indicator status-${type}`;
}

/**
 * Add a message to the chat history display
 * @param {string} role 'user' or 'assistant'
 * @param {string} text Message text
 */
function addChatMessage(role, text) {
  const messageEl = document.createElement("div");
  messageEl.className = `chat-message message-${role}`;

  const contentEl = document.createElement("div");
  contentEl.className = "message-content";
  contentEl.textContent = text;

  messageEl.appendChild(contentEl);
  chatHistory.appendChild(messageEl);

  // Scroll to bottom
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

/**
 * Send a message to the backend Worker API
 */
async function sendMessage() {
  const userId = userIdInput.value.trim();
  const message = messageInput.value.trim();

  if (!userId) {
    setStatus("Please enter a username", "error");
    userIdInput.focus();
    return;
  }

  if (!message) {
    setStatus("Please enter a message", "error");
    messageInput.focus();
    return;
  }

  // Disable input and show loading state
  isLoading = true;
  sendBtn.disabled = true;
  messageInput.disabled = true;
  setStatus("Sending...", "loading");

  // Add user message to display
  addChatMessage("user", message);
  messageInput.value = "";

  try {
    // Call Worker API
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, message }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(
        error.error || `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    const data = await response.json();

    // Add AI response to display
    addChatMessage("assistant", data.reply);
    setStatus("Ready", "success");
  } catch (error) {
    console.error("Chat error:", error);
    addChatMessage("system", `Error: ${error.message}`);
    setStatus(`Error: ${error.message}`, "error");
  } finally {
    // Re-enable input
    isLoading = false;
    sendBtn.disabled = false;
    messageInput.disabled = false;
    messageInput.focus();
  }
}

/**
 * Load conversation history from backend
 */
async function loadConversationHistory() {
  const userId = userIdInput.value.trim();

  if (!userId) {
    setStatus("Please enter a username", "error");
    return;
  }

  setStatus("Loading...", "loading");

  try {
    const response = await fetch(
      `/api/history?userId=${encodeURIComponent(userId)}`,
    );

    if (!response.ok) {
      throw new Error(`Failed to load history: ${response.statusText}`);
    }

    const data = await response.json();
    const { history } = data;

    // Clear current display and reload
    const systemMsg = chatHistory.querySelector(".system-message");
    chatHistory.innerHTML = "";
    if (systemMsg) chatHistory.appendChild(systemMsg);

    // Add all history messages
    history.forEach((msg) => {
      addChatMessage(msg.role, msg.text);
    });

    setStatus(
      `Loaded ${history.length} message(s)`,
      history.length > 0 ? "success" : "default",
    );
  } catch (error) {
    console.error("History load error:", error);
    setStatus(`Error: ${error.message}`, "error");
  }
}

/**
 * Clear chat history from display (not backend)
 */
function clearChatDisplay() {
  const systemMsg = document.createElement("div");
  systemMsg.className = "system-message";
  systemMsg.textContent = "Chat cleared. Start a new conversation!";
  chatHistory.innerHTML = "";
  chatHistory.appendChild(systemMsg);
  setStatus("Ready", "success");
}

/**
 * Event Listeners
 */
sendBtn.addEventListener("click", sendMessage);

// Send on Shift+Enter or Ctrl+Enter
messageInput.addEventListener("keydown", (e) => {
  if ((e.shiftKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    sendMessage();
  }
});

// Focus on input when page loads
window.addEventListener("load", () => {
  messageInput.focus();
  userIdInput.value += Math.random().toString(36).substr(2, 9);
});

clearBtn.addEventListener("click", clearChatDisplay);
loadHistoryBtn.addEventListener("click", loadConversationHistory);

// Initialize status
setStatus("Ready", "success");
