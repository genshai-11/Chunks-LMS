import { createClient } from "npm:@supabase/supabase-js@2";
import {
  createDeterministicMockAdapter,
  createNineRouterAdapter,
  redactProviderMetadata,
  withAuditedRetries,
  type LiveTestGenerationAdapter,
} from "./adapters.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Action =
  | "generateTestItem"
  | "generateNarration"
  | "approveGeneratedAsset"
  | "getNarrationPlaybackUrl"
  | "getCapabilities"
  | "listTtsModels";

type GenerateTestItemBody = {
  action: "generateTestItem";
  packageVersionId: string;
  sectionId: string;
  promptDetails: string;
};

type GenerateNarrationBody = {
  action: "generateNarration";
  packageVersionId: string;
  target: "section_intro" | "test_item";
  testSectionId?: string | null;
  testItemId?: string | null;
  language: "vi" | "en";
  voiceId: string;
};

type ApproveGeneratedAssetBody = {
  action: "approveGeneratedAsset";
  generationJobId: string;
  notes?: string;
};

type GetNarrationPlaybackUrlBody = {
  action: "getNarrationPlaybackUrl";
  narrationVariantId: string;
};

type ListTtsModelsBody = {
  action: "listTtsModels";
  language?: "vi" | "en";
};

type GetCapabilitiesBody = {
  action: "getCapabilities";
};

type RequestBody =
  | GenerateTestItemBody
  | GenerateNarrationBody
  | ApproveGeneratedAssetBody
  | GetNarrationPlaybackUrlBody
  | ListTtsModelsBody
  | GetCapabilitiesBody;

// Supabase Edge functions intentionally use dynamic table names without generated DB types.
// deno-lint-ignore no-explicit-any
type SupabaseClientLike = any;

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

function parseKeyDictionary(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed.default ?? Object.values(parsed)[0];
  } catch {
    return undefined;
  }
}

function getPublishableKey(): string {
  const key =
    parseKeyDictionary(getEnv("SUPABASE_PUBLISHABLE_KEYS")) ??
    getEnv("SUPABASE_ANON_KEY");
  if (!key)
    throw new Error(
      "Supabase publishable/anon key is not configured for live-test-generation",
    );
  return key;
}

function getSecretKey(): string {
  const key =
    parseKeyDictionary(getEnv("SUPABASE_SECRET_KEYS")) ??
    getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!key)
    throw new Error(
      "Supabase secret/service_role key is not configured for live-test-generation",
    );
  return key;
}

function makeAdapter(): LiveTestGenerationAdapter {
  const mode = getEnv("LIVE_TEST_GENERATION_MODE") ?? "ninerouter";
  if (mode === "mock") return createDeterministicMockAdapter();
  if (mode !== "ninerouter")
    throw new Error("LIVE_TEST_GENERATION_MODE must be ninerouter or mock");

  return createNineRouterAdapter({
    baseUrl: getEnv("NINEROUTER_URL") ?? "",
    apiKey: getEnv("NINEROUTER_KEY"),
    llmModel: getEnv("NINEROUTER_LLM_MODEL") ?? "openai/gpt-5",
  });
}

async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  const digestBytes = new Uint8Array(bytes).buffer;
  const digest = await crypto.subtle.digest("SHA-256", digestBytes);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

async function requireAdmin(userClient: SupabaseClientLike): Promise<string> {
  const { data: isAdmin, error: adminError } = await userClient.rpc(
    "current_staff_is_admin",
  );
  if (adminError) throw new Error(`Admin check failed: ${adminError.message}`);
  if (isAdmin !== true)
    throw new Error(
      "Access Denied: Only Admin staff can use live-test generation.",
    );

  const { data: actorId, error: actorError } = await userClient.rpc(
    "live_test_v2_current_user_id",
  );
  if (actorError)
    throw new Error(`Actor resolution failed: ${actorError.message}`);
  return String(actorId);
}

async function loadPackageContext(
  admin: SupabaseClientLike,
  packageVersionId: string,
) {
  const { data: version, error: versionError } = await admin
    .from("test_package_versions")
    .select("id, package_id, status")
    .eq("id", packageVersionId)
    .maybeSingle();
  if (versionError)
    throw new Error(`Package version lookup failed: ${versionError.message}`);
  if (!version)
    throw new Error(
      "Invalid packageVersionId: Package version does not exist.",
    );
  if (version.status !== "draft")
    throw new Error(
      "Conflict: Package version is not a draft and cannot be modified.",
    );

  const { data: pkg, error: packageError } = await admin
    .from("test_packages")
    .select("organization_id")
    .eq("id", version.package_id)
    .maybeSingle();
  if (packageError)
    throw new Error(`Package lookup failed: ${packageError.message}`);
  if (!pkg?.organization_id)
    throw new Error(
      "Invalid packageVersionId: Package organization does not exist.",
    );

  return {
    organizationId: String(pkg.organization_id),
    status: String(version.status),
  };
}

async function updateJob(
  admin: SupabaseClientLike,
  jobId: string,
  values: Record<string, unknown>,
) {
  const { error } = await admin
    .from("generation_jobs")
    .update(values)
    .eq("id", jobId);
  if (error) throw new Error(`Generation job update failed: ${error.message}`);
}

async function requirePrivateNarrationBucket(
  admin: SupabaseClientLike,
): Promise<string | null> {
  const { data, error } = await admin.storage.getBucket("narration-audio");
  if (error)
    return `Private narration Storage bucket is not available: ${error.message}`;
  if (data.public) {
    return "narration-audio Storage bucket must be private before TTS generation can upload audio.";
  }
  return null;
}

async function insertGenerationJob(
  admin: SupabaseClientLike,
  values: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await admin
    .from("generation_jobs")
    .insert(values)
    .select("id")
    .single();
  if (error) throw new Error(`Generation job insert failed: ${error.message}`);
  return String(data.id);
}

async function generateTestItem(
  body: GenerateTestItemBody,
  actorUserId: string,
  admin: SupabaseClientLike,
  adapter: LiveTestGenerationAdapter,
) {
  const { organizationId } = await loadPackageContext(
    admin,
    body.packageVersionId,
  );

  const { data: section, error: sectionError } = await admin
    .from("test_sections")
    .select("id")
    .eq("id", body.sectionId)
    .eq("package_version_id", body.packageVersionId)
    .maybeSingle();
  if (sectionError)
    throw new Error(`Section lookup failed: ${sectionError.message}`);
  if (!section)
    throw new Error(
      "Invalid sectionId: Section does not belong to the package version.",
    );

  const requestedAt = new Date().toISOString();
  const jobId = await insertGenerationJob(admin, {
    organization_id: organizationId,
    requested_by_user_id: actorUserId,
    package_version_id: body.packageVersionId,
    test_section_id: body.sectionId,
    job_type: "test_item",
    status: "running",
    started_at: requestedAt,
    prompt_hash: `sha256:${await sha256Hex(body.promptDetails)}`,
  });

  const result = await withAuditedRetries(
    () => adapter.generateTestItem({ promptDetails: body.promptDetails }),
    2,
  );
  if ("error" in result) {
    await updateJob(admin, jobId, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error_code: result.error.name,
      error_message: result.error.message,
      attempts: result.attempts,
    });
    return {
      jobId,
      status: "failed",
      requestedAt,
      errorCode: result.error.name,
      errorMessage: result.error.message,
    };
  }

  const generated = result.result;
  const completedAt = new Date().toISOString();
  await updateJob(admin, jobId, {
    status: "succeeded",
    completed_at: completedAt,
    attempts: result.attempts,
    provider_metadata: redactProviderMetadata({
      ...generated.providerMetadata,
      generated_item: {
        prompt_vi: generated.promptVi,
        prompt_en: generated.promptEn,
        tc: generated.tc,
        lc: generated.lc,
        tl: generated.tl,
        measured_cvr: generated.measuredCvr,
      },
    }),
  });

  return {
    jobId,
    status: "succeeded",
    requestedAt,
    completedAt,
    itemPreview: { promptVi: generated.promptVi, promptEn: generated.promptEn },
  };
}

async function resolveNarrationText(
  admin: SupabaseClientLike,
  body: GenerateNarrationBody,
): Promise<string> {
  if (body.target === "section_intro") {
    if (!body.testSectionId || body.testItemId)
      throw new Error("Invalid parameters for section_intro narration target.");
    const { data: section, error: sectionError } = await admin
      .from("test_sections")
      .select("section_order, intro_text_vi, intro_text_en")
      .eq("id", body.testSectionId)
      .eq("package_version_id", body.packageVersionId)
      .maybeSingle();
    if (sectionError)
      throw new Error(`Section narration lookup failed: ${sectionError.message}`);
    if (!section)
      throw new Error("Invalid testSectionId: Section text was not found.");

    const rawText = body.language === "vi"
      ? section.intro_text_vi
      : section.intro_text_en;
    if (!rawText)
      throw new Error("Section intro text is missing for the requested language.");
    return String(rawText).trim().replace(/\s+/g, " ");
  }

  if (!body.testItemId || body.testSectionId)
    throw new Error("Invalid parameters for test_item narration target.");
  const { data: item, error: itemError } = await admin
    .from("test_items")
    .select("item_order, prompt_vi, prompt_en, spoken_script_vi, spoken_script_en")
    .eq("id", body.testItemId)
    .eq("package_version_id", body.packageVersionId)
    .maybeSingle();
  if (itemError) throw new Error(`Item narration lookup failed: ${itemError.message}`);
  if (!item)
    throw new Error("Invalid testItemId: Item was not found.");

  const rawText = body.language === "vi" ? item.prompt_vi : item.prompt_en;
  const override = body.language === "vi"
    ? item.spoken_script_vi
    : item.spoken_script_en;
  if (override) return String(override).trim().replace(/\s+/g, " ");
  if (!rawText)
    throw new Error(
      "Invalid testItemId: Item text was not found for requested language.",
    );

  const prefix = body.language === "vi"
    ? `Số ${item.item_order}.`
    : `Number ${item.item_order}.`;
  return `${prefix} ${String(rawText).trim().replace(/\s+/g, " ")}`;
}


async function generateNarration(
  body: GenerateNarrationBody,
  actorUserId: string,
  admin: SupabaseClientLike,
  adapter: LiveTestGenerationAdapter,
) {
  if (!["vi", "en"].includes(body.language))
    throw new Error("Invalid language: language must be vi or en.");
  if (!body.voiceId) throw new Error("Invalid voiceId: voiceId is required.");

  const { organizationId } = await loadPackageContext(
    admin,
    body.packageVersionId,
  );
  const text = await resolveNarrationText(admin, body);
  const sourceHash = `sha256:${await sha256Hex(`${text}:${body.language}:${body.voiceId}`)}`;
  const requestedAt = new Date().toISOString();
  const jobId = await insertGenerationJob(admin, {
    organization_id: organizationId,
    requested_by_user_id: actorUserId,
    package_version_id: body.packageVersionId,
    test_section_id:
      body.target === "section_intro" ? body.testSectionId : null,
    test_item_id: body.target === "test_item" ? body.testItemId : null,
    job_type:
      body.target === "section_intro"
        ? "section_intro_narration"
        : "item_narration",
    status: "running",
    started_at: requestedAt,
    source_hash: sourceHash,
  });

  const result = await withAuditedRetries(
    () =>
      adapter.generateSpeech({
        text,
        language: body.language,
        voiceId: body.voiceId,
      }),
    2,
  );
  if ("error" in result) {
    await updateJob(admin, jobId, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error_code: result.error.name,
      error_message: result.error.message,
      attempts: result.attempts,
    });
    return {
      jobId,
      status: "failed",
      requestedAt,
      errorCode: result.error.name,
      errorMessage: result.error.message,
    };
  }

  const speech = result.result;
  const bucketError = await requirePrivateNarrationBucket(admin);
  if (bucketError) {
    await updateJob(admin, jobId, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error_code: "PRIVATE_BUCKET_UNAVAILABLE",
      error_message: bucketError,
      attempts: result.attempts,
    });
    return {
      jobId,
      status: "failed",
      requestedAt,
      errorCode: "PRIVATE_BUCKET_UNAVAILABLE",
      errorMessage: bucketError,
    };
  }

  const storagePath = `narrations/${body.packageVersionId}/${jobId}.${speech.format}`;
  const { error: uploadError } = await admin.storage
    .from("narration-audio")
    .upload(storagePath, speech.bytes, {
      contentType: speech.mimeType,
      upsert: false,
    });
  if (uploadError) {
    await updateJob(admin, jobId, {
      status: "failed",
      completed_at: new Date().toISOString(),
      error_code: "STORAGE_UPLOAD_FAILED",
      error_message: uploadError.message,
      attempts: result.attempts,
    });
    return {
      jobId,
      status: "failed",
      requestedAt,
      errorCode: "STORAGE_UPLOAD_FAILED",
      errorMessage: uploadError.message,
    };
  }

  const sha256 = `sha256:${await sha256Hex(speech.bytes)}`;
  const { data: audio, error: audioError } = await admin
    .from("audio_assets")
    .insert({
      organization_id: organizationId,
      storage_bucket: "narration-audio",
      storage_path: storagePath,
      mime_type: speech.mimeType,
      sha256,
      visibility: "private",
      source_kind: "generated_tts",
      bytes: speech.bytes.byteLength,
      metadata: redactProviderMetadata({ format: speech.format }),
    })
    .select("id")
    .single();
  if (audioError)
    throw new Error(
      `Audio asset insert failed after storage upload: ${audioError.message}`,
    );

  const { data: variant, error: variantError } = await admin
    .from("narration_variants")
    .insert({
      package_version_id: body.packageVersionId,
      test_section_id:
        body.target === "section_intro" ? body.testSectionId : null,
      test_item_id: body.target === "test_item" ? body.testItemId : null,
      narration_target: body.target,
      language: body.language,
      voice_id: body.voiceId,
      voice_label: body.voiceId,
      source_text_hash: sourceHash,
      audio_asset_id: audio.id,
      approval_status: "generated",
      generation_job_id: jobId,
      provider_metadata: redactProviderMetadata(speech.providerMetadata),
    })
    .select("id")
    .single();
  if (variantError)
    throw new Error(
      `Narration variant insert failed after storage upload: ${variantError.message}`,
    );

  const completedAt = new Date().toISOString();
  await updateJob(admin, jobId, {
    status: "succeeded",
    completed_at: completedAt,
    narration_variant_id: variant.id,
    attempts: result.attempts,
    provider_metadata: redactProviderMetadata({
      ...speech.providerMetadata,
      audio_asset_id: audio.id,
      narration_variant_id: variant.id,
      storage_bucket: "narration-audio",
      storage_path: storagePath,
    }),
  });

  return {
    jobId,
    status: "succeeded",
    requestedAt,
    completedAt,
    narrationVariantId: variant.id,
    audioPath: storagePath,
  };
}

async function listTtsModels(body: ListTtsModelsBody) {
  const baseUrl = (getEnv("NINEROUTER_URL") ?? "").replace(/\/+$/, "");
  if (!baseUrl) throw new Error("NINEROUTER_URL is not configured.");
  const apiKey = getEnv("NINEROUTER_KEY");
  const headers: Record<string, string> = apiKey
    ? { Authorization: `Bearer ${apiKey}` }
    : {};
  const modelResponse = await fetch(`${baseUrl}/v1/models/tts`, { headers });
  const modelPayload = await modelResponse.json().catch(() => null) as {
    data?: Array<{ id?: string; owned_by?: string }>;
  } | null;
  if (!modelResponse.ok) {
    throw new Error(`9Router TTS model discovery failed (${modelResponse.status}).`);
  }

  const models = new Map<string, { id: string; provider: string; label: string }>();
  for (const model of modelPayload?.data ?? []) {
    if (!model.id) continue;
    models.set(model.id, {
      id: model.id,
      provider: model.owned_by ?? model.id.split("/")[0] ?? "unknown",
      label: model.id,
    });
  }

  if (body.language === "vi" || body.language === "en") {
    const languageTag = body.language === "vi" ? "vi" : "en";
    const voiceResponse = await fetch(
      `${baseUrl}/v1/audio/voices?provider=edge-tts&lang=${languageTag}`,
      { headers },
    );
    if (voiceResponse.ok) {
      const voicePayload = await voiceResponse.json().catch(() => null) as {
        data?: Array<{ model?: string; id?: string; name?: string }>;
      } | null;
      for (const voice of voicePayload?.data ?? []) {
        const rawId = voice.model ?? voice.id;
        if (!rawId) continue;
        const id = rawId.startsWith("edge-tts/") ? rawId : `edge-tts/${rawId}`;
        models.set(id, {
          id,
          provider: "edge-tts",
          label: voice.name ? `${voice.name} · ${id}` : id,
        });
      }
    }
  }

  return {
    language: body.language ?? null,
    models: [...models.values()].sort((a, b) =>
      a.provider.localeCompare(b.provider) || a.label.localeCompare(b.label)
    ),
  };
}

async function getNarrationPlaybackUrl(
  body: GetNarrationPlaybackUrlBody,
  userClient: SupabaseClientLike,
  admin: SupabaseClientLike,
) {
  if (!body.narrationVariantId)
    throw new Error("narrationVariantId is required.");
  const [{ data: actorId, error: actorError }, { data: isAdmin, error: adminError }] =
    await Promise.all([
      userClient.rpc("current_staff_user_id"),
      userClient.rpc("current_staff_is_admin"),
    ]);
  if (actorError || !actorId)
    throw new Error(`Staff access required: ${actorError?.message ?? "no active staff role"}`);
  if (adminError) throw new Error(`Admin check failed: ${adminError.message}`);

  const { data: variant, error: variantError } = await admin
    .from("narration_variants")
    .select("id, approval_status, audio_asset_id")
    .eq("id", body.narrationVariantId)
    .maybeSingle();
  if (variantError) throw new Error(`Narration lookup failed: ${variantError.message}`);
  if (!variant?.audio_asset_id) throw new Error("Narration audio is not available.");
  if (isAdmin !== true && variant.approval_status !== "approved")
    throw new Error("Only approved narration can be played by Teachers.");

  const { data: audio, error: audioError } = await admin
    .from("audio_assets")
    .select("storage_bucket, storage_path, mime_type, duration_ms")
    .eq("id", variant.audio_asset_id)
    .maybeSingle();
  if (audioError) throw new Error(`Audio lookup failed: ${audioError.message}`);
  if (!audio) throw new Error("Audio asset was not found.");

  const expiresIn = 600;
  const { data: signed, error: signedError } = await admin.storage
    .from(audio.storage_bucket)
    .createSignedUrl(audio.storage_path, expiresIn);
  if (signedError || !signed?.signedUrl)
    throw new Error(`Playback URL failed: ${signedError?.message ?? "missing signed URL"}`);
  return {
    narrationVariantId: variant.id,
    signedUrl: signed.signedUrl,
    expiresIn,
    mimeType: audio.mime_type,
    durationMs: audio.duration_ms,
  };
}

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")
    return jsonResponse({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization)
    return jsonResponse({ error: "Missing Authorization header" }, 401);

  const body = (await req.json()) as Partial<RequestBody> & { action?: Action };
  if (!body.action) return jsonResponse({ error: "Missing action" }, 400);

  const supabaseUrl = getEnv("SUPABASE_URL");
  if (!supabaseUrl)
    throw new Error("SUPABASE_URL is not configured for live-test-generation");

  const userClient = createClient(supabaseUrl, getPublishableKey(), {
    global: { headers: { Authorization: authorization } },
  });
  const adminClient = createClient(supabaseUrl, getSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (body.action === "getNarrationPlaybackUrl") {
    return jsonResponse(
      await getNarrationPlaybackUrl(
        body as GetNarrationPlaybackUrlBody,
        userClient,
        adminClient,
      ),
    );
  }

  if (body.action === "getCapabilities") {
    return jsonResponse({
      version: 4,
      exactSpokenScripts: true,
      signedNarrationPlayback: true,
      ttsModelDiscovery: true,
      selectedBatchGeneration: true,
      paidGenerationRequiresExplicitAction: true,
    });
  }

  const actorUserId = await requireAdmin(userClient);

  if (body.action === "listTtsModels") {
    return jsonResponse(await listTtsModels(body as ListTtsModelsBody));
  }

  if (body.action === "approveGeneratedAsset") {
    const { data, error } = await userClient.rpc("approve_generated_asset", {
      p_generation_job_id: body.generationJobId,
      p_notes: body.notes ?? "",
    });
    if (error) throw new Error(error.message);
    return jsonResponse(data);
  }

  const adapter = makeAdapter();
  if (body.action === "generateTestItem") {
    return jsonResponse(
      await generateTestItem(
        body as GenerateTestItemBody,
        actorUserId,
        adminClient,
        adapter,
      ),
    );
  }
  if (body.action === "generateNarration") {
    return jsonResponse(
      await generateNarration(
        body as GenerateNarrationBody,
        actorUserId,
        adminClient,
        adapter,
      ),
    );
  }

  return jsonResponse({ error: "Unknown action" }, 400);
}

Deno.serve(async (req) => {
  try {
    return await handleRequest(req);
  } catch (error) {
    return jsonResponse(
      {
        error: {
          code: (error as { name?: string }).name ?? "Error",
          message: (error as Error).message,
        },
      },
      400,
    );
  }
});
