// ────────────────────────────────────────────────────────────────────
//  lp-forge — OpenAI Native Provider
//  Allow-list: gpt-4o-mini (default cheap), gpt-4o, gpt-4.1, o3-mini.
//  Vision-capable for brand-capture phase: gpt-4o, gpt-4o-mini, gpt-4.1.
//  Aria A-8: temperature locked to 0 in production.
// ────────────────────────────────────────────────────────────────────
"use strict";

let _client = null;

function getClient() {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = new Error("OPENAI_API_KEY environment variable not set");
    err.code = 6; // PROVIDER_MISCONFIG
    throw err;
  }
  // Lazy-require so the SDK isn't loaded unless OpenAI is the chosen provider
  const OpenAI = require("openai");
  _client = new OpenAI({ apiKey });
  return _client;
}

/**
 * Invoke OpenAI chat completion.
 * options: { model, maxTokens, temperature, system, jsonMode }
 * Returns: { status, stdout, stderr, usage, finishReason }
 */
async function invoke(promptText, options = {}) {
  const client = getClient();
  const model = options.model || "gpt-4o-mini";
  const temperature = options.temperature !== undefined ? options.temperature : 0;
  const maxTokens = options.maxTokens || 4096;

  const messages = [];
  if (options.system) messages.push({ role: "system", content: options.system });
  messages.push({ role: "user", content: promptText });

  const req = {
    model,
    messages,
    temperature,
    max_completion_tokens: maxTokens
  };
  if (options.jsonMode) req.response_format = { type: "json_object" };

  try {
    const response = await client.chat.completions.create(req);
    const choice = response.choices && response.choices[0];
    return {
      status: "ok",
      provider: "openai",
      model,
      stdout: (choice && choice.message && choice.message.content) || "",
      stderr: "",
      usage: response.usage || null,
      finishReason: (choice && choice.finish_reason) || null
    };
  } catch (err) {
    const e = new Error(`OpenAI request failed: ${err.message || String(err)}`);
    // Map HTTP status to lp-forge exit codes
    if (err.status === 401 || err.status === 403) e.code = 6; // PROVIDER_MISCONFIG
    else if (err.status === 429) e.code = 5; // LLM_EXHAUSTED (rate limit)
    else e.code = 7; // HTTP_ERROR
    throw e;
  }
}

module.exports = { invoke, getClient };
