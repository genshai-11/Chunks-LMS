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
  "generateTestItem" | "generateNarration" | "approveGeneratedAsset";

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

type RequestBody =
  GenerateTestItemBody | GenerateNarrationBody | ApproveGeneratedAssetBody;

type SupabaseClientLike = ReturnType<typeof createClient>;

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
  const digest = await crypto.subtle.digest("SHA-256", bytes);
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
    const { data, error } = await admin
      .from("test_sections")
      .select("title")
      .eq("id", body.testSectionId)
      .eq("package_version_id", body.packageVersionId)
      .maybeSingle();
    if (error)
      throw new Error(`Section narration lookup failed: ${error.message}`);
    if (!data?.title)
      throw new Error("Invalid testSectionId: Section text was not found.");
    return String(data.title);
  }

  if (!body.testItemId || body.testSectionId)
    throw new Error("Invalid parameters for test_item narration target.");
  const { data, error } = await admin
    .from("test_items")
    .select("prompt_vi, prompt_en")
    .eq("id", body.testItemId)
    .eq("package_version_id", body.packageVersionId)
    .maybeSingle();
  if (error) throw new Error(`Item narration lookup failed: ${error.message}`);
  const text = body.language === "vi" ? data?.prompt_vi : data?.prompt_en;
  if (!text)
    throw new Error(
      "Invalid testItemId: Item text was not found for requested language.",
    );
  return String(text);
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

  const actorUserId = await requireAdmin(userClient);

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
