const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AnalysisChatRequest = {
  prompt?: string;
  context?: unknown;
};

type ProviderMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getEnv(name: string): string | undefined {
  const value = Deno.env.get(name)?.trim();
  return value ? value : undefined;
}

function providerUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, "");
  return normalized.endsWith("/v1")
    ? `${normalized}/chat/completions`
    : `${normalized}/v1/chat/completions`;
}

function parseProviderJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return {
      answer: content,
      cards: [],
      chartSuggestion: null,
      followUpQuestions: [],
    };
  }
}

async function callProvider(messages: ProviderMessage[]) {
  const baseUrl = getEnv("ANALYSIS_CHAT_BASE_URL");
  const apiKey = getEnv("ANALYSIS_CHAT_API_KEY");
  const model = getEnv("ANALYSIS_CHAT_MODEL") ?? "gpt";

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Analysis chat provider is not configured. Set ANALYSIS_CHAT_BASE_URL and ANALYSIS_CHAT_API_KEY as Supabase secrets.",
    );
  }

  const response = await fetch(providerUrl(baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: false,
      response_format: { type: "json_object" },
      messages,
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Provider request failed (${response.status}): ${text.slice(0, 500)}`,
    );
  }

  const data = JSON.parse(text) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: unknown;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Provider returned no message content.");

  return { result: parseProviderJson(content), usage: data.usage ?? null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  try {
    const body = (await req.json()) as AnalysisChatRequest;
    const prompt = body.prompt?.trim();
    if (!prompt) return jsonResponse({ error: "Prompt is required" }, 400);

    const contextJson = JSON.stringify(body.context ?? {}, null, 2).slice(
      0,
      12000,
    );
    const system = `You are an analytics assistant inside Chunks-LMS. Help staff turn 1:1 assessment data into safe, explainable custom analysis cards or chart suggestions. Use only the supplied context. Do not invent database fields, SQL, or private data. Return strict JSON with this shape: {"answer":"short Vietnamese explanation","cards":[{"title":"string","value":"string","unit":"string","description":"string","tone":"good|warn|neutral"}],"chartSuggestion":{"title":"string","kind":"line|bar|pie|combo|none","description":"string"}|null,"followUpQuestions":["string"]}. Keep values derived from the context summary, not hidden data.`;

    const { result, usage } = await callProvider([
      { role: "system", content: system },
      {
        role: "user",
        content: `User request:\n${prompt}\n\nCurrent analysis context JSON:\n${contextJson}`,
      },
    ]);

    return jsonResponse({ result, usage });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown analysis chat error";
    return jsonResponse({ error: message }, 500);
  }
});
