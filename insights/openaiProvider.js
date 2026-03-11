function joinUrl(baseUrl, suffix) {
  return `${String(baseUrl || "https://api.openai.com/v1").replace(/\/$/, "")}${suffix}`;
}

async function callOpenAIChat(prompt, opts) {
  if (typeof fetch !== "function") {
    throw new Error("global fetch is unavailable in this Node runtime");
  }

  const apiKey = String(opts?.apiKey || "").trim();
  if (!apiKey) {
    throw new Error("missing UX_INSIGHTS_API_KEY for openai provider");
  }

  const endpoint = joinUrl(opts?.baseUrl || process.env.UX_INSIGHTS_BASE_URL, "/chat/completions");
  const model = String(opts?.model || process.env.UX_INSIGHTS_MODEL || "gpt-4.1-mini");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user }
      ]
    })
  });

  if (!response.ok) {
    const reason = await response.text().catch(() => "");
    throw new Error(`openai provider failed: ${response.status} ${reason}`);
  }

  const body = await response.json();
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("openai provider returned empty content");
  }

  return {
    model,
    content
  };
}

module.exports = {
  callOpenAIChat
};
