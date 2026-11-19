// Client-side session storage (token issued by the server, validated on every call).
import { useEffect, useState } from "react";

export interface StudentInfo { id: number; roll_no: string; name: string; class_label: string }
const KEY = "ss_session";
const ADMIN_KEY = "ss_admin";

export function getAdminToken(): string | null {
  return typeof window === "undefined" ? null : localStorage.getItem(ADMIN_KEY);
}
export function setAdminToken(t: string | null) {
  if (t) localStorage.setItem(ADMIN_KEY, t); else localStorage.removeItem(ADMIN_KEY);
}

/** Reads the signed-in student after hydration. `ready` is false during SSR/first paint. */
export function useSession() {
  const [state, setState] = useState<{ ready: boolean; session: { token: string; student: StudentInfo } | null }>({ ready: false, session: null });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const { getMe } = await import("./studyspace.functions");
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return alive && setState({ ready: true, session: null });
      const res = await getMe({ data: { token } });
      if (alive) setState({ ready: true, session: res.data ? { token, student: res.data } : null });
    };
    load().catch(() => alive && setState({ ready: true, session: null }));
    return () => { alive = false; };
  }, []);
  return state;
}

export async function signOut() {
  const { supabase } = await import("@/integrations/supabase/client");
  await supabase.auth.signOut();
}

export class ApiError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
/** Unwraps { data } | { error } responses, throwing ApiError. */
export function unwrap<T>(res: { data?: T | undefined; error?: { code: string; message: string } | undefined }): T {
  if (res.error) {
        throw new ApiError(res.error.code, res.error.message);
  }
  return res.data as T;
}
export function errorText(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return "Network problem. Check your connection and try again.";
}
