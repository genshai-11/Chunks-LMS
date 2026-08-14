import { createClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://chunks-lms.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

class InvalidCredentialsError extends Error {}
class TooManyAttemptsError extends Error {}

type LoginBody = {
  username?: unknown;
  password?: unknown;
};
// Edge functions intentionally use dynamic tables without generated database types.
// deno-lint-ignore no-explicit-any
type SupabaseClientLike = any;

function getEnv(name: string): string | undefined {
  const value = Deno.env.get(name)?.trim();
  return value || undefined;
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

function publishableKey(): string {
  const key =
    parseKeyDictionary(getEnv("SUPABASE_PUBLISHABLE_KEYS")) ??
    getEnv("SUPABASE_ANON_KEY");
  if (!key) throw new Error("Publishable Auth key is not configured");
  return key;
}

function allowedOrigins(): Set<string> {
  const configured = (getEnv("USERNAME_LOGIN_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
}

function requestOrigin(req: Request): string | null {
  return req.headers.get("Origin")?.trim().replace(/\/$/, "") ?? null;
}

function isAllowedOrigin(req: Request): boolean {
  const origin = requestOrigin(req);
  if (!origin) return true;
  if (allowedOrigins().has(origin)) return true;
  try {
    const url = new URL(origin);
    if (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname.endsWith(".vercel.app")
    ) {
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = requestOrigin(req);
  const allowed = origin && isAllowedOrigin(req) ? origin : "*";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}

function json(
  req: Request,
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

function normalizeUsername(raw: unknown): string {
  return String(raw ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase();
}

function clientAddress(req: Request): string {
  // Supabase's gateway supplies X-Forwarded-For. Use the right-most address so
  // a caller-controlled prefix cannot rotate throttle buckets.
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",").at(-1)?.trim().slice(0, 128) || "unknown";
}

async function hmacBucket(keySource: string, value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(keySource),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function enforceRateLimit(
  admin: SupabaseClientLike,
  serviceRoleKey: string,
  req: Request,
  username: string,
) {
  const address = clientAddress(req);
  const buckets = [
    { value: `ip:${address}`, limit: 30 },
    { value: `ip-username:${address}:${username}`, limit: 8 },
  ];

  // Check the broad IP bucket first so a blocked source cannot keep creating
  // one new per-username bucket per request.
  for (const bucket of buckets) {
    const bucketHash = await hmacBucket(serviceRoleKey, bucket.value);
    const { data, error } = await admin.rpc("consume_username_login_attempt", {
      p_bucket_hash: bucketHash,
      p_attempt_limit: bucket.limit,
    });
    if (error) throw new Error("Username login rate limit failed");
    if (data !== true) throw new TooManyAttemptsError();
  }
}

async function resolveStaffAuthEmail(
  admin: SupabaseClientLike,
  username: string,
): Promise<string | null> {
  const { data: domainUser, error: userError } = await admin
    .from("users")
    .select("id, auth_user_id, account_status")
    .eq("username", username)
    .maybeSingle();
  if (userError) throw new Error("Staff username lookup failed");

  // Always perform the role query so unknown, inactive, and unauthorized
  // usernames follow the same database/Auth request shape as eligible staff.
  const roleLookupUserId =
    domainUser?.id ?? "00000000-0000-0000-0000-000000000000";
  const { data: role, error: roleError } = await admin
    .from("staff_roles")
    .select("user_id")
    .eq("user_id", roleLookupUserId)
    .eq("active", true)
    .in("role", ["admin", "teacher"])
    .limit(1)
    .maybeSingle();
  if (roleError) throw new Error("Staff role lookup failed");

  const authLookupUserId =
    domainUser?.auth_user_id ?? "00000000-0000-0000-0000-000000000000";
  const { data: authData, error: authError } =
    await admin.auth.admin.getUserById(authLookupUserId);
  const email = authError
    ? null
    : (authData.user?.email?.trim().toLowerCase() ?? null);
  const eligible =
    domainUser?.account_status === "active" &&
    Boolean(domainUser.auth_user_id) &&
    Boolean(role) &&
    Boolean(email);
  return eligible ? email : null;
}

Deno.serve(async (req) => {
  if (!isAllowedOrigin(req)) {
    return json(req, { ok: false, error: "Origin not allowed" }, 403);
  }
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return json(req, { ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = (await req.json().catch(() => ({}))) as LoginBody;
    const username = normalizeUsername(body.username);
    const password = typeof body.password === "string" ? body.password : "";

    const supabaseUrl = getEnv("SUPABASE_URL");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase service configuration missing");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await enforceRateLimit(admin, serviceRoleKey, req, username.slice(0, 64));
    if (!USERNAME_PATTERN.test(username) || !password) {
      throw new InvalidCredentialsError();
    }
    const email = await resolveStaffAuthEmail(admin, username);

    const authClient = createClient(supabaseUrl, publishableKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await authClient.auth.signInWithPassword({
      email: email ?? `username-login-${crypto.randomUUID()}@example.invalid`,
      password,
    });
    if (!email || error || !data.session) throw new InvalidCredentialsError();

    return json(req, {
      ok: true,
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresIn: data.session.expires_in,
        expiresAt: data.session.expires_at,
      },
    });
  } catch (error) {
    if (error instanceof TooManyAttemptsError) {
      return json(
        req,
        { ok: false, error: "Too many login attempts. Try again later." },
        429,
      );
    }
    if (error instanceof InvalidCredentialsError) {
      return json(
        req,
        { ok: false, error: "Invalid username or password" },
        401,
      );
    }
    return json(
      req,
      { ok: false, error: "Login temporarily unavailable" },
      500,
    );
  }
});
