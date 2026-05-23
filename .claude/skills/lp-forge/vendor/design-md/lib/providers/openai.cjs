// ────────────────────────────────────────────────────────────────────
//  design-md — OpenAI provider
//  ADDED BY lp-forge — patch to vendored design-md (Aria A-1 hybrid).
//  Mirrors openrouter.cjs interface. Uses OpenAI Chat Completions API.
// ────────────────────────────────────────────────────────────────────
"use strict";

const fs = require("fs");

const OPENAI_DEFAULT_MODEL = process.env.OPENAI_DEFAULT_MODEL || "gpt-4o-mini";
const OPENAI_DEFAULT_MAX_TOKENS = parseInt(process.env.DESIGN_MD_MAX_TOKENS || "16384", 10);
const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

function extractDesignMd(rawContent) {
  if (!rawContent) return "";
  const fmStart = rawContent.search(/^---\s*$/m);
  if (fmStart !== -1) return rawContent.slice(fmStart);
  return rawContent;
}

async function invoke(promptText, options = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[!] OpenAI selected but OPENAI_API_KEY not set.");
    process.exit(6);
  }

  const model = options.model || OPENAI_DEFAULT_MODEL;
  const maxTokens = options.maxTokens || OPENAI_DEFAULT_MAX_TOKENS;

  console.log(`[openai] calling ${model} (max_completion_tokens=${maxTokens})…`);

  const body = JSON.stringify({
    model,
    messages: [{ role: "user", content: promptText }],
    max_completion_tokens: maxTokens,
    temperature: 0
  });

  let response;
  try {
    response = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body
    });
  } catch (err) {
    return {
      status: 1, stdout: "",
      stderr: `[openai] network error: ${err.message}`,
      httpStatus: null, finishReason: null, usage: null
    };
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    return {
      status: 1, stdout: "",
      stderr: `[openai] HTTP ${response.status}: ${bodyText.slice(0, 500)}`,
      httpStatus: response.status, finishReason: null, usage: null
    };
  }

  let json;
  try { json = await response.json(); }
  catch (err) {
    return {
      status: 1, stdout: "",
      stderr: `[openai] failed to parse JSON: ${err.message}`,
      httpStatus: response.status, finishReason: null, usage: null
    };
  }

  const choice = json.choices && json.choices[0];
  const rawContent = (choice && choice.message && choice.message.content) || "";
  const finishReason = (choice && choice.finish_reason) || null;
  const usage = json.usage || null;

  const content = extractDesignMd(rawContent);

  if (options.designMdPath && content) {
    fs.writeFileSync(options.designMdPath, content, "utf8");
  }

  return {
    status: 0, stdout: content, stderr: "",
    httpStatus: response.status, finishReason, usage
  };
}

module.exports = { invoke, OPENAI_DEFAULT_MODEL };
