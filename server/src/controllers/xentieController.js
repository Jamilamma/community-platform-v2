const { handleMessage } = require("../services/xentie");

// Simple in-memory rate limit per user (20 messages / minute). No extra package needed.
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 20;
const hits = new Map();

function limited(userId) {
  const now = Date.now();
  const recent = (hits.get(userId) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(userId, recent);
    return true;
  }
  recent.push(now);
  hits.set(userId, recent);
  return false;
}

// keep the map from growing forever
setInterval(() => {
  const now = Date.now();
  for (const [id, times] of hits) {
    if (!times.some((t) => now - t < WINDOW_MS)) hits.delete(id);
  }
}, WINDOW_MS).unref();

// POST /api/xentie/chat   { message, state?, history? }
async function chat(req, res) {
  try {
    const { message, state, history } = req.body || {};

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ message: "Please type a message for Xentie." });
    }
    if (limited(req.user._id)) {
      return res.status(429).json({ message: "You're sending messages very quickly. Please wait a few seconds and try again." });
    }

    const result = await handleMessage({
      user: req.user,
      message,
      state,
      history,
      io: req.app.get("io"),
    });
    res.json(result);
  } catch (err) {
    console.error("[xentie] controller error:", String(err.message || err).slice(0, 300));
    res.status(500).json({ message: "Xentie is having a moment. Please try again shortly." });
  }
}

module.exports = { chat };
