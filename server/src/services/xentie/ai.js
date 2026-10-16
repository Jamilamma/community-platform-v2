// Xentie — optional AI layer. The provider is chosen with environment variables:
//   XENTIE_AI_PROVIDER = anthropic | openai      (anything else / empty = AI disabled)
//   XENTIE_AI_API_KEY  = your provider key
//   XENTIE_AI_MODEL    = optional model name override
//   XENTIE_AI_BASE_URL = optional (OpenAI-compatible providers such as Groq, OpenRouter, Together…)
//
// If nothing is configured, or a call fails, callers fall back to Xentie's built-in answers.

const DEFAULT_MODELS = {
  anthropic: "claude-haiku-4-5-20251001",
  openai: "gpt-4o-mini",
};

const TIMEOUT_MS = 15000;

function provider() {
  return String(process.env.XENTIE_AI_PROVIDER || "").trim().toLowerCase();
}

function isConfigured() {
  return ["anthropic", "openai"].includes(provider()) && !!process.env.XENTIE_AI_API_KEY;
}

async function postJson(url, headers, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await res.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      /* non-JSON body */
    }
    if (!res.ok) {
      // keep the provider's error short and never include headers / keys
      let detail = String(data?.error?.message || data?.message || `status ${res.status}`);
      const key = process.env.XENTIE_AI_API_KEY;
      if (key) detail = detail.split(key).join("[hidden]");
      throw new Error(`AI provider error: ${detail.slice(0, 160)}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sends one system prompt + one user message and returns the reply text.
 * Throws on any failure (the caller decides on the fallback).
 */
async function complete({ system, user, maxTokens = 350 }) {
  if (!isConfigured()) throw new Error("AI not configured");

  const key = process.env.XENTIE_AI_API_KEY;
  const model = process.env.XENTIE_AI_MODEL || DEFAULT_MODELS[provider()];

  if (provider() === "anthropic") {
    const base = (process.env.XENTIE_AI_BASE_URL || "https://api.anthropic.com").replace(/\/+$/, "");
    const data = await postJson(
      `${base}/v1/messages`,
      { "x-api-key": key, "anthropic-version": "2023-06-01" },
      { model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }
    );
    return (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
  }

  // openai-compatible
  const base = (process.env.XENTIE_AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const data = await postJson(
    `${base}/chat/completions`,
    { Authorization: `Bearer ${key}` },
    {
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }
  );
  return String(data?.choices?.[0]?.message?.content || "").trim();
}

module.exports = { isConfigured, complete };
