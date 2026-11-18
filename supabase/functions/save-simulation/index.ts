import { clerkClaims, adminClient, cors } from "../_shared/auth.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const claims = await clerkClaims(req); const body = await req.json(); const supabase = adminClient();
    const { data: profile, error: profileError } = await supabase.from("profiles").select("id").eq("clerk_user_id", String(claims.sub)).single();
    if (profileError || !profile) throw new Error("Profile is not synced yet");
    const { data, error } = await supabase.from("simulations").insert({ user_id: profile.id, simulation_name: String(body.simulation_name || "Simulation"), card_data: body.card_data || {} }).select("id,simulation_name,created_at,updated_at").single();
    if (error) throw error;
    return new Response(JSON.stringify(data), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) { return new Response(JSON.stringify({ error: String((error as Error).message || error) }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } }); }
});
