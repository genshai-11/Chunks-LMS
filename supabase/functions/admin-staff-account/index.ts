import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type StaffAction =
  | {
      action: "createTeacher";
      email: string;
      displayName: string;
      password: string;
      avatarUrl?: string | null;
    }
  | {
      action: "updateTeacher";
      userId: string;
      email: string;
      displayName: string;
      avatarUrl?: string | null;
    }
  | { action: "setTeacherStatus"; userId: string; accountStatus: "active" | "inactive" }
  | { action: "deleteTeacher"; userId: string };

type Json = Record<string, unknown>;

function json(body: Json, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeEmail(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

function normalizeName(raw: unknown): string {
  return String(raw ?? "").trim();
}

function requirePassword(raw: unknown): string {
  const password = String(raw ?? "");
  if (password.length < 6) throw new Error("Teacher password must be at least 6 characters");
  return password;
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

async function findAuthUserByEmail(admin: ReturnType<typeof createClient>, email: string) {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Auth list users failed: ${error.message}`);
    const found = data.users.find((user) => (user.email ?? "").toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 1000) return null;
  }
  throw new Error("Auth user lookup exceeded pagination limit");
}

async function requireAdmin(admin: ReturnType<typeof createClient>, token: string) {
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) throw new Error("Invalid staff session");

  const { data: caller, error: callerError } = await admin
    .from("users")
    .select("id, account_status")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();
  if (callerError) throw new Error(`Caller lookup failed: ${callerError.message}`);
  if (!caller || caller.account_status === "inactive") throw new Error("Admin account is inactive");

  const { data: role, error: roleError } = await admin
    .from("staff_roles")
    .select("user_id")
    .eq("user_id", caller.id)
    .eq("role", "admin")
    .eq("active", true)
    .maybeSingle();
  if (roleError) throw new Error(`Admin role lookup failed: ${roleError.message}`);
  if (!role) throw new Error("Admin role required");

  const { data: membership, error: membershipError } = await admin
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", caller.id)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  if (membershipError) throw new Error(`Admin organization lookup failed: ${membershipError.message}`);
  if (!membership?.organization_id) throw new Error("Admin organization membership required");

  return { authUserId: authData.user.id, userId: caller.id as string, organizationId: membership.organization_id as string };
}

async function assertTeacher(admin: ReturnType<typeof createClient>, userId: string) {
  const { data: role, error } = await admin
    .from("staff_roles")
    .select("user_id")
    .eq("user_id", userId)
    .eq("role", "teacher")
    .maybeSingle();
  if (error) throw new Error(`Teacher role lookup failed: ${error.message}`);
  if (!role) throw new Error("Teacher account not found");
}

async function upsertTeacherDomainUser(
  admin: ReturnType<typeof createClient>,
  input: { email: string; displayName: string; avatarUrl?: string | null; organizationId: string },
) {
  const existing = await admin
    .from("users")
    .select("id, auth_user_id")
    .ilike("email", input.email)
    .maybeSingle();
  if (existing.error) throw new Error(`Teacher lookup failed: ${existing.error.message}`);

  let userId = existing.data?.id as string | undefined;
  let authUserId = existing.data?.auth_user_id as string | null | undefined;

  if (userId) {
    const { error } = await admin
      .from("users")
      .update({
        email: input.email,
        display_name: input.displayName,
        avatar_url: input.avatarUrl ?? null,
        account_status: "active",
        allow_multi_class: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (error) throw new Error(`Teacher update failed: ${error.message}`);
  } else {
    const { data, error } = await admin
      .from("users")
      .insert({
        email: input.email,
        display_name: input.displayName,
        avatar_url: input.avatarUrl ?? null,
        account_status: "active",
        allow_multi_class: false,
      })
      .select("id, auth_user_id")
      .single();
    if (error) throw new Error(`Teacher insert failed: ${error.message}`);
    userId = data.id as string;
    authUserId = data.auth_user_id as string | null;
  }

  const { error: membershipError } = await admin.from("organization_memberships").upsert(
    { organization_id: input.organizationId, user_id: userId, role: "teacher" },
    { onConflict: "organization_id,user_id,role" },
  );
  if (membershipError) throw new Error(`Teacher membership failed: ${membershipError.message}`);

  const { error: staffRoleError } = await admin.from("staff_roles").upsert(
    { user_id: userId, role: "teacher", active: true, revoked_at: null },
    { onConflict: "user_id,role" },
  );
  if (staffRoleError) throw new Error(`Teacher staff role failed: ${staffRoleError.message}`);

  return { userId: userId!, authUserId: authUserId ?? null };
}

async function createTeacher(admin: ReturnType<typeof createClient>, actor: Awaited<ReturnType<typeof requireAdmin>>, body: StaffAction) {
  if (body.action !== "createTeacher") throw new Error("Invalid create action");
  const email = normalizeEmail(body.email);
  const displayName = normalizeName(body.displayName);
  const password = requirePassword(body.password);
  if (!email) throw new Error("Teacher email is required");
  if (!displayName) throw new Error("Teacher name is required");

  const domain = await upsertTeacherDomainUser(admin, {
    email,
    displayName,
    avatarUrl: body.avatarUrl ?? null,
    organizationId: actor.organizationId,
  });

  let authUserId = domain.authUserId;
  const existingAuth = authUserId ? null : await findAuthUserByEmail(admin, email);
  if (existingAuth) {
    authUserId = existingAuth.id;
    const { error } = await admin.auth.admin.updateUserById(existingAuth.id, {
      email,
      password,
      user_metadata: { full_name: displayName, name: displayName },
    });
    if (error) throw new Error(`Auth user update failed: ${error.message}`);
  } else if (authUserId) {
    const { error } = await admin.auth.admin.updateUserById(authUserId, {
      email,
      password,
      user_metadata: { full_name: displayName, name: displayName },
    });
    if (error) throw new Error(`Auth user update failed: ${error.message}`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: displayName, name: displayName },
      app_metadata: { staff_role: "teacher" },
    });
    if (error || !data.user) throw new Error(`Auth user create failed: ${error?.message ?? "no user returned"}`);
    authUserId = data.user.id;
  }

  const { error: linkError } = await admin
    .from("users")
    .update({ auth_user_id: authUserId, updated_at: new Date().toISOString() })
    .eq("id", domain.userId);
  if (linkError) throw new Error(`Auth link failed: ${linkError.message}`);

  return { userId: domain.userId, authUserId, email, displayName };
}

async function updateTeacher(admin: ReturnType<typeof createClient>, body: StaffAction) {
  if (body.action !== "updateTeacher") throw new Error("Invalid update action");
  const email = normalizeEmail(body.email);
  const displayName = normalizeName(body.displayName);
  if (!body.userId) throw new Error("Teacher id is required");
  if (!email) throw new Error("Teacher email is required");
  if (!displayName) throw new Error("Teacher name is required");
  await assertTeacher(admin, body.userId);

  const { data: current, error: currentError } = await admin
    .from("users")
    .select("auth_user_id")
    .eq("id", body.userId)
    .single();
  if (currentError) throw new Error(`Teacher lookup failed: ${currentError.message}`);

  const { error } = await admin
    .from("users")
    .update({
      email,
      display_name: displayName,
      avatar_url: body.avatarUrl ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.userId);
  if (error) throw new Error(`Teacher update failed: ${error.message}`);

  if (current.auth_user_id) {
    const { error: authError } = await admin.auth.admin.updateUserById(current.auth_user_id, {
      email,
      user_metadata: { full_name: displayName, name: displayName },
    });
    if (authError) throw new Error(`Auth user update failed: ${authError.message}`);
  }

  return { userId: body.userId, email, displayName, authUserId: current.auth_user_id ?? null };
}

async function setTeacherStatus(admin: ReturnType<typeof createClient>, body: StaffAction) {
  if (body.action !== "setTeacherStatus") throw new Error("Invalid status action");
  if (!body.userId) throw new Error("Teacher id is required");
  await assertTeacher(admin, body.userId);

  const active = body.accountStatus === "active";
  const { error: userError } = await admin
    .from("users")
    .update({ account_status: body.accountStatus, updated_at: new Date().toISOString() })
    .eq("id", body.userId);
  if (userError) throw new Error(`Teacher status failed: ${userError.message}`);

  const { error: roleError } = await admin
    .from("staff_roles")
    .update({ active, revoked_at: active ? null : new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", body.userId)
    .eq("role", "teacher");
  if (roleError) throw new Error(`Teacher role status failed: ${roleError.message}`);

  return { userId: body.userId, accountStatus: body.accountStatus };
}

async function deleteTeacher(admin: ReturnType<typeof createClient>, body: StaffAction) {
  if (body.action !== "deleteTeacher") throw new Error("Invalid delete action");
  if (!body.userId) throw new Error("Teacher id is required");
  await assertTeacher(admin, body.userId);

  const { count, error: classError } = await admin
    .from("classes")
    .select("id", { count: "exact", head: true })
    .eq("teacher_user_id", body.userId);
  if (classError) throw new Error(`Class assignment lookup failed: ${classError.message}`);
  if ((count ?? 0) > 0) throw new Error("Cannot delete teacher still linked to a class; reassign first");

  const { data: current, error: currentError } = await admin
    .from("users")
    .select("auth_user_id")
    .eq("id", body.userId)
    .single();
  if (currentError) throw new Error(`Teacher lookup failed: ${currentError.message}`);

  if (current.auth_user_id) {
    const { error: authError } = await admin.auth.admin.deleteUser(current.auth_user_id);
    if (authError) throw new Error(`Auth user delete failed: ${authError.message}`);
  }

  await admin.from("staff_roles").delete().eq("user_id", body.userId).eq("role", "teacher");
  await admin.from("organization_memberships").delete().eq("user_id", body.userId).eq("role", "teacher");
  const { error: userError } = await admin.from("users").delete().eq("id", body.userId);
  if (userError) throw new Error(`Teacher delete failed: ${userError.message}`);

  return { userId: body.userId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const token = bearerToken(req);
    if (!token) return json({ error: "Missing Authorization bearer token" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase service configuration missing");

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const actor = await requireAdmin(admin, token);
    const body = (await req.json()) as StaffAction;

    switch (body.action) {
      case "createTeacher":
        return json({ ok: true, data: await createTeacher(admin, actor, body) });
      case "updateTeacher":
        return json({ ok: true, data: await updateTeacher(admin, body) });
      case "setTeacherStatus":
        return json({ ok: true, data: await setTeacherStatus(admin, body) });
      case "deleteTeacher":
        return json({ ok: true, data: await deleteTeacher(admin, body) });
      default:
        return json({ error: "Unsupported staff account action" }, 400);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Staff account operation failed";
    return json({ ok: false, error: message }, message.includes("required") || message.includes("Invalid") ? 403 : 400);
  }
});
