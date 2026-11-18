import { createClient, type Session } from "@supabase/supabase-js";

const PROJECT_URL = "https://dcpacwqhhyaslxstxrmp.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_e_WnqNZj-GGz27atg52EkQ_annJQ8WI";

export const supabase = createClient(PROJECT_URL, PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "implicit",
  },
});

export type CloudSession = Session;

export type CloudScenarioRow = {
  scenario_id: string;
  name: string;
  saved_at: string;
  updated_at?: string;
  payload: { cards: unknown[]; settings: Record<string, unknown> };
};
export type CloudScenarioVersionRow = CloudScenarioRow & { id: string; created_at: string };

function authError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export async function getCloudSession(): Promise<CloudSession | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw authError(error);
  return data.session;
}

export function subscribeCloudAuth(onSession: (session: CloudSession | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => onSession(session));
  return () => data.subscription.unsubscribe();
}

async function currentSession(): Promise<CloudSession> {
  const session = await getCloudSession();
  if (!session) throw new Error("Sign in to use cloud scenarios.");
  return session;
}

export async function signUpCloudUser(email: string, password: string, redirectTo: string): Promise<CloudSession | null> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectTo, data: { app: "credit-card-utilisation-management-simulator" } },
  });
  if (error) throw authError(error);
  return data.session;
}

export async function signInCloudUser(email: string, password: string): Promise<CloudSession> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw authError(error || new Error("No active session returned."));
  return data.session;
}

export async function signOutCloudUser(_session: CloudSession): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw authError(error);
}

export async function listCloudScenarios(_session?: CloudSession): Promise<{ session: CloudSession; rows: CloudScenarioRow[] }> {
  const session = await currentSession();
  const { data, error } = await supabase
    .from("simulator_scenarios")
    .select("scenario_id,name,saved_at,updated_at,payload")
    .order("saved_at", { ascending: false });
  if (error) throw authError(error);
  return { session, rows: (data || []) as CloudScenarioRow[] };
}

export async function saveCloudScenario(_session: CloudSession, row: CloudScenarioRow): Promise<CloudSession> {
  const session = await currentSession();
  const { error } = await supabase
    .from("simulator_scenarios")
    .upsert({ user_id: session.user.id, ...row }, { onConflict: "user_id,scenario_id" });
  if (error) throw authError(error);
  const { error: versionError } = await supabase
    .from("simulator_scenario_versions")
    .insert({ user_id: session.user.id, scenario_id: row.scenario_id, name: row.name, saved_at: row.saved_at, payload: row.payload });
  if (versionError) throw authError(versionError);
  return session;
}

export async function listCloudScenarioVersions(_session: CloudSession, scenarioId: string): Promise<{ session: CloudSession; rows: CloudScenarioVersionRow[] }> {
  const session = await currentSession();
  const { data, error } = await supabase
    .from("simulator_scenario_versions")
    .select("id,scenario_id,name,saved_at,created_at,payload")
    .eq("scenario_id", scenarioId)
    .order("created_at", { ascending: false });
  if (error) throw authError(error);
  return { session, rows: (data || []) as CloudScenarioVersionRow[] };
}

export async function deleteCloudScenario(_session: CloudSession, scenarioId: string): Promise<CloudSession> {
  const session = await currentSession();
  const { error } = await supabase.from("simulator_scenarios").delete().eq("scenario_id", scenarioId);
  if (error) throw authError(error);
  return session;
}
