export const DEFAULT_USERNAME_LOGIN_ALLOWED_ORIGINS = [
  "https://chunks-lms.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
] as const;

const CHUNKS_PREVIEW_HOST =
  /^chunks-[a-z0-9](?:[a-z0-9-]*[a-z0-9])?-genshai-11s-projects\.vercel\.app$/;

export function normalizeOrigin(origin: string): string | null {
  const candidate = origin.trim().replace(/\/$/, "");
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (url.origin !== candidate || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function parseAllowedOrigins(raw: string | undefined): Set<string> {
  const origins = new Set<string>();
  for (const value of [
    ...DEFAULT_USERNAME_LOGIN_ALLOWED_ORIGINS,
    ...(raw ?? "").split(","),
  ]) {
    const normalized = normalizeOrigin(value);
    if (normalized) origins.add(normalized);
  }
  return origins;
}

export function isAllowedUsernameLoginOrigin(
  origin: string | null,
  allowedOrigins: ReadonlySet<string>,
): boolean {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;
  if (allowedOrigins.has(normalized)) return true;
  const url = new URL(normalized);
  return (
    url.protocol === "https:" &&
    url.port === "" &&
    CHUNKS_PREVIEW_HOST.test(url.hostname)
  );
}

export function buildCorsHeaders(
  origin: string | null,
  allowedOrigins: ReadonlySet<string>,
): Record<string, string> {
  const normalized = origin ? normalizeOrigin(origin) : null;
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
  if (normalized && isAllowedUsernameLoginOrigin(normalized, allowedOrigins)) {
    headers["Access-Control-Allow-Origin"] = normalized;
  }
  return headers;
}
