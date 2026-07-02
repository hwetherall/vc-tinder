// LLM access via OpenRouter. Split out of discover.mjs so the enrich pipeline
// shares one implementation of "prompt in, validated JSON out".

import { fetchJSON } from './exa.mjs';

export const MODEL = process.env.MODEL || 'anthropic/claude-opus-4';

// Extract a JSON object from a model response that may be wrapped in ```json
// code fences or surrounded by prose (OpenRouter's json_object mode isn't
// enforced for every model — opus-4 fences its output).
export function extractJson(content) {
  let s = String(content == null ? '' : content).trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last > first) s = s.slice(first, last + 1);
  return JSON.parse(s);
}

async function chat(prompt, { maxTokens, model, responseFormat }) {
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not set');
  const body = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  };
  if (responseFormat) body.response_format = responseFormat;
  const data = await fetchJSON('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify(body),
  }, { timeoutMs: 120000 });

  const choice = (data.choices || [])[0];
  if (!choice) throw new Error('no choices in response');
  if (choice.finish_reason === 'content_filter') throw new Error('model refused');
  return choice.message.content;
}

// One chat completion, JSON out. The prompt must describe the exact shape it
// wants (and say "no markdown fences") — extractJson cleans up the stragglers.
export async function chatJSON(prompt, { maxTokens = 1500, model = MODEL } = {}) {
  const content = await chat(prompt, { maxTokens, model, responseFormat: { type: 'json_object' } });
  return extractJson(content);
}

// One chat completion, plain text out (used for markdown digests).
export async function chatText(prompt, { maxTokens = 3000, model = MODEL } = {}) {
  return chat(prompt, { maxTokens, model });
}
