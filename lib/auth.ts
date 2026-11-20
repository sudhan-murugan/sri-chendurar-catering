import { supabase, DEMO_MODE } from "./supabase";

const USER_KEY = "scc_user";
export const DEMO_USER = "00000000-0000-4000-8000-000000000000";

/** User id cached on the phone so the app opens offline without a network login. */
export function cachedUserId(): string | null {
  if (DEMO_MODE) return DEMO_USER;
  try {
    return localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<string> {
  const sbp = supabase();
  if (!sbp) return DEMO_USER;
  const sb = await sbp;
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) throw error ?? new Error("login failed");
  localStorage.setItem(USER_KEY, data.user.id);
  return data.user.id;
}

export async function logout() {
  localStorage.removeItem(USER_KEY);
  sessionStorage.clear();
  await (await supabase())?.auth.signOut();
}
