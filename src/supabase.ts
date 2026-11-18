const PROJECT_URL = "https://dcpacwqhhyaslxstxrmp.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_e_WnqNZj-GGz27atg52EkQ_annJQ8WI";
const SESSION_STORAGE_KEY = "cc-utilisation-simulator-auth-v1";

export type CloudSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email?: string };
};

export type CloudScenarioRow = {
  scenario_id: string;
  name: string;
  saved_at: string;
  payload: { cards: unknown[]; settings: Record<string, unknown> };
};

function parseJson(text: string): any {
  try { return text ? JSON.parse(text) : null; } catch { return null; }
}

async function request(path: string, init: RequestInit = {}, token?: string): Promise<any> {
  const response = await fetch(PROJECT_URL + path, {
    ...init,
    headers: {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${token || PUBLISHABLE_KEY}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const text = await response.text();
  const result = parseJson(text);
  if (!response.ok) {
    const message = result?.msg || result?.message || result?.error_description || result?.error || `Supabase request failed (${response.status})`;
    throw new Error(String(message));
  }
  return result;
}

export function readCloudSession(): CloudSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (typeof value?.access_token !== "string" || typeof value?.refresh_token !== "string" ||
        typeof value?.user?.id !== "string") return null;
    return value as CloudSession;
  } catch { return null; }
}

function storeSession(result: any): CloudSession {
  const session: CloudSession = {
    access_token: result.access_token,
    refresh_token: result.refresh_token,
    expires_at: Number(result.expires_at) || Math.floor(Date.now() / 1000) + Number(result.expires_in || 3600),
    user: { id: result.user.id, email: result.user.email },
  };
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  return session;
}

export async function refreshCloudSession(session: CloudSession): Promise<CloudSession> {
  const result = await request("/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  return storeSession(result);
}

export async function getFreshCloudSession(session: CloudSession): Promise<CloudSession> {
  if (session.expires_at > Math.floor(Date.now() / 1000) + 60) return session;
  return refreshCloudSession(session);
}

export async function signUpCloudUser(email: string, password: string, redirectTo: string): Promise<CloudSession | null> {
  const result = await request("/auth/v1/signup?redirect_to=" + encodeURIComponent(redirectTo), {
    method: "POST",
    body: JSON.stringify({ email, password, data: { app: "credit-card-utilisation-management-simulator" } }),
  });
  if (result?.access_token && result?.refresh_token && result?.user?.id) return storeSession(result);
  return null;
}

export async function signInCloudUser(email: string, password: string): Promise<CloudSession> {
  const result = await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return storeSession(result);
}

export async function signOutCloudUser(session: CloudSession): Promise<void> {
  try { await request("/auth/v1/logout", { method: "POST" }, session.access_token); }
  finally { localStorage.removeItem(SESSION_STORAGE_KEY); }
}

export async function listCloudScenarios(session: CloudSession): Promise<{ session: CloudSession; rows: CloudScenarioRow[] }> {
  const fresh = await getFreshCloudSession(session);
  const rows = await request("/rest/v1/simulator_scenarios?select=scenario_id,name,saved_at,payload&order=saved_at.desc", {}, fresh.access_token);
  return { session: fresh, rows: rows as CloudScenarioRow[] };
}

export async function saveCloudScenario(session: CloudSession, row: CloudScenarioRow): Promise<CloudSession> {
  const fresh = await getFreshCloudSession(session);
  await request("/rest/v1/simulator_scenarios?on_conflict=user_id,scenario_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ user_id: fresh.user.id, ...row }]),
  }, fresh.access_token);
  return fresh;
}

export async function deleteCloudScenario(session: CloudSession, scenarioId: string): Promise<CloudSession> {
  const fresh = await getFreshCloudSession(session);
  const query = new URLSearchParams({ scenario_id: "eq." + scenarioId });
  await request("/rest/v1/simulator_scenarios?" + query.toString(), { method: "DELETE" }, fresh.access_token);
  return fresh;
}
