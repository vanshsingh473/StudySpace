// Server-only helpers: admin DB client, session checks, rate limiting.
import { getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { mapDbError } from "./availability";

export const db = supabaseAdmin;
export type Fail = { error: { code: string; message: string } };

export class AppError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export function fail(e: unknown): Fail {
  const msg = e instanceof AppError ? e.code : (e as { message?: string })?.message;
  if (!(e instanceof AppError)) console.error("[studyspace]", e);
  return { error: mapDbError(msg) };
}

export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.rpc as any)(fn, args);
  if (error) throw new AppError(error.message);
  return data as T;
}

export function clientIp(): string {
  return getRequestHeader("cf-connecting-ip") || getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function rateLimit(key: string, max: number, windowSecs: number) {
  const ok = await rpc<boolean>("hit_rate_limit", { p_key: key, p_max: max, p_window_secs: windowSecs });
  if (!ok) throw new AppError("RATE_LIMITED");
}

async function session(token: unknown) {
  if (typeof token !== "string" || token.length < 20) throw new AppError("UNAUTHORIZED");
  const { data } = await db.from("sessions").select("student_id,is_admin,expires_at").eq("token", token).maybeSingle();
  if (!data || new Date(data.expires_at) < new Date()) throw new AppError("UNAUTHORIZED");
  return data;
}

/** Verifies a signed-in student's access token and returns their student row. */
export async function currentStudent(token: unknown) {
  if (typeof token !== "string" || token.length < 20) throw new AppError("UNAUTHORIZED");
  const { data: u, error } = await db.auth.getUser(token);
  if (error || !u.user) throw new AppError("UNAUTHORIZED");
  const { data } = await db.from("students").select("id,roll_no,name,class_label").eq("user_id", u.user.id).maybeSingle();
  if (!data) throw new AppError("UNAUTHORIZED");
  return data;
}

export async function requireStudent(token: unknown): Promise<number> {
  return (await currentStudent(token)).id;
}

/** Auth-only client for password sign-in on the server (no session storage). */
export async function anonAuthClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export async function requireAdmin(token: unknown) {
  const s = await session(token);
  if (!s.is_admin) throw new AppError("UNAUTHORIZED");
}
