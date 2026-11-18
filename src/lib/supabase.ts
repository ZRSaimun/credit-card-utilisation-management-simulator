import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL || "https://dcpacwqhhyaslxstxrmp.supabase.co";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_e_WnqNZj-GGz27atg52EkQ_annJQ8WI";

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" },
});

export async function invokeEdgeFunction<T>(name: string, body: Record<string, unknown>, token?: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, {
    body,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (error) throw error;
  return data as T;
}
