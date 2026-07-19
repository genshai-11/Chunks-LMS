export type LiveTestGeneratedItem = {
  promptVi: string;
  promptEn: string;
  tc: number;
  lc: number;
  tl: number;
  measuredCvr: number;
  providerMetadata: Record<string, unknown>;
};

export type LiveTestGeneratedSpeech = {
  bytes: Uint8Array;
  mimeType: string;
  format: string;
  providerMetadata: Record<string, unknown>;
};

export type LiveTestGenerationAdapter = {
  generateTestItem(input: {
    promptDetails: string;
  }): Promise<LiveTestGeneratedItem>;
  generateSpeech(input: {
    text: string;
    language: "vi" | "en";
    voiceId: string;
  }): Promise<LiveTestGeneratedSpeech>;
};

export type NineRouterAdapterConfig = {
  baseUrl: string;
  apiKey?: string;
  llmModel: string;
};

type FetchLike = typeof fetch;

const SECRET_KEY_PATTERN =
  /(authorization|api[-_]?key|secret|token|credential|password)/i;

export function redactProviderMetadata(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map((item) => redactProviderMetadata(item));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>,
    )) {
      out[key] = SECRET_KEY_PATTERN.test(key)
        ? "[redacted]"
        : redactProviderMetadata(nested);
    }
    return out;
  }
  return value;
}

function normaliseBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed)
    throw new Error(
      "NINEROUTER_URL is required when LIVE_TEST_GENERATION_MODE is ninerouter",
    );
  return trimmed;
}

function authorizationHeaders(apiKey?: string): Record<string, string> {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

function getContentText(payload: unknown): string {
  const obj = payload as {
    choices?: Array<{ message?: { content?: unknown } }>;
    content?: Array<{ type?: string; text?: string }>;
  };

  const openAiContent = obj.choices?.[0]?.message?.content;
  if (typeof openAiContent === "string") return openAiContent;

  const anthropicText = obj.content?.find((part) => part.type === "text")?.text;
  if (typeof anthropicText === "string") return anthropicText;

  throw new Error("9Router LLM response did not include generated content");
}

function parseGeneratedItem(
  content: string,
): Omit<LiveTestGeneratedItem, "providerMetadata"> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(
      `9Router LLM response was not valid JSON: ${(error as Error).message}`,
    );
  }

  const item = parsed as Record<string, unknown>;
  const promptVi = item.promptVi ?? item.prompt_vi;
  const promptEn = item.promptEn ?? item.prompt_en;
  const tc = Number(item.tc);
  const lc = Number(item.lc);
  const tl = Number(item.tl);
  const measuredCvr = Number(
    item.measuredCvr ?? item.measured_cvr ?? tc * lc * tl,
  );

  if (typeof promptVi !== "string" || typeof promptEn !== "string") {
    throw new Error(
      "9Router LLM response must include promptVi/promptEn strings",
    );
  }
  if (![tc, lc, tl, measuredCvr].every((n) => Number.isFinite(n) && n > 0)) {
    throw new Error(
      "9Router LLM response must include positive numeric tc/lc/tl/measuredCvr values",
    );
  }

  return { promptVi, promptEn, tc, lc, tl, measuredCvr };
}

export function createNineRouterAdapter(
  config: NineRouterAdapterConfig,
  fetchImpl: FetchLike = fetch,
): LiveTestGenerationAdapter {
  const baseUrl = normaliseBaseUrl(config.baseUrl);

  return {
    async generateTestItem(input) {
      const response = await fetchImpl(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          ...authorizationHeaders(config.apiKey),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.llmModel,
          stream: false,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "Generate one Chunks-LMS Live Test item as strict JSON with keys promptVi, promptEn, tc, lc, tl, measuredCvr. Keep prompts suitable for Focus/Awareness observation; do not include markdown.",
            },
            { role: "user", content: input.promptDetails },
          ],
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          `9Router LLM request failed (${response.status}): ${JSON.stringify(redactProviderMetadata(payload))}`,
        );
      }

      const generated = parseGeneratedItem(getContentText(payload));
      const metadata = redactProviderMetadata({
        provider: "9router",
        endpoint: "/v1/chat/completions",
        model: (payload as { model?: unknown })?.model ?? config.llmModel,
        id: (payload as { id?: unknown })?.id,
        usage: (payload as { usage?: unknown })?.usage,
      }) as Record<string, unknown>;

      return { ...generated, providerMetadata: metadata };
    },

    async generateSpeech(input) {
      const response = await fetchImpl(`${baseUrl}/v1/audio/speech`, {
        method: "POST",
        headers: {
          ...authorizationHeaders(config.apiKey),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: input.voiceId,
          input: input.text,
        }),
      });

      if (!response.ok) {
        let errorBody: unknown = null;
        try {
          errorBody = await response.json();
        } catch {
          errorBody = await response.text().catch(() => "");
        }
        throw new Error(
          `9Router TTS request failed (${response.status}): ${JSON.stringify(redactProviderMetadata(errorBody))}`,
        );
      }

      const contentType = response.headers.get("content-type") ?? "audio/mpeg";
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength === 0)
        throw new Error("9Router TTS response did not include audio bytes");

      const format = contentType.includes("wav")
        ? "wav"
        : contentType.includes("ogg")
          ? "ogg"
          : "mp3";
      const metadata = redactProviderMetadata({
        provider: "9router",
        endpoint: "/v1/audio/speech",
        model: input.voiceId,
        bytes: bytes.byteLength,
        contentType,
      }) as Record<string, unknown>;

      return {
        bytes,
        mimeType: contentType,
        format,
        providerMetadata: metadata,
      };
    },
  };
}

export function createDeterministicMockAdapter(): LiveTestGenerationAdapter {
  return {
    async generateTestItem(input) {
      return {
        promptVi: `[Mock] Câu hỏi mẫu tiếng Việt từ ${input.promptDetails}`,
        promptEn: `[Mock] Sample English prompt from ${input.promptDetails}`,
        tc: 3,
        lc: 1,
        tl: 1,
        measuredCvr: 3,
        providerMetadata: {
          provider: "local-deterministic-mock",
          mode: "mock",
        },
      };
    },
    async generateSpeech(input) {
      const text = `mock-audio:${input.language}:${input.voiceId}:${input.text}`;
      return {
        bytes: new TextEncoder().encode(text),
        mimeType: "audio/mpeg",
        format: "mp3",
        providerMetadata: {
          provider: "local-deterministic-mock",
          mode: "mock",
          bytes: text.length,
        },
      };
    },
  };
}

export type RetryAttempt = {
  attempt: number;
  startedAt: string;
  completedAt: string;
  status: "succeeded" | "failed";
  errorCode?: string;
  errorMessage?: string;
  providerMetadata?: unknown;
};

export async function withAuditedRetries<
  T extends { providerMetadata?: unknown },
>(
  operation: () => Promise<T>,
  maxAttempts = 2,
): Promise<
  | { result: T; attempts: RetryAttempt[] }
  | { error: Error; attempts: RetryAttempt[] }
> {
  const attempts: RetryAttempt[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const startedAt = new Date().toISOString();
    try {
      const result = await operation();
      attempts.push({
        attempt,
        startedAt,
        completedAt: new Date().toISOString(),
        status: "succeeded",
        providerMetadata: redactProviderMetadata(result.providerMetadata),
      });
      return { result, attempts };
    } catch (error) {
      attempts.push({
        attempt,
        startedAt,
        completedAt: new Date().toISOString(),
        status: "failed",
        errorCode: (error as { name?: string }).name ?? "Error",
        errorMessage: (error as Error).message,
      });
      if (attempt === maxAttempts) return { error: error as Error, attempts };
    }
  }

  return { error: new Error("Retry loop exited unexpectedly"), attempts };
}
