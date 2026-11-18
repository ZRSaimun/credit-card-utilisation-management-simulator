import { clerkClaims, adminClient, cors } from "../_shared/auth.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const claims = await clerkClaims(req); const body = await req.json();
    const clerkUserId = String(claims.sub || ""); const email = String(body.email || "");
    if (!clerkUserId || !email) throw new Error("A verified Clerk user and email are required");
    const supabase = adminClient();
    const { data: existing } = await supabase.from("profiles").select("id").eq("clerk_user_id", clerkUserId).maybeSingle();
    let id = existing?.id;
    if (!id) { const created = await supabase.auth.admin.createUser({ email, email_confirm: true }); if (created.error) throw created.error; id = created.data.user?.id; }
    if (!id) throw new Error("Could not provision a Supabase profile");
    const { error } = await supabase.from("profiles").upsert({ id, clerk_user_id: clerkUserId, email, full_name: body.full_name || "" }, { onConflict: "id" });
    if (error) throw error;
    if (!existing && Deno.env.get("RESEND_API_KEY")) {
      await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: Deno.env.get("RESEND_FROM_EMAIL") || "Credit Card Simulator <onboarding@resend.dev>", to: [email], subject: "Welcome to Credit Card Simulator!", html: `<h1>Welcome${body.full_name ? `, ${body.full_name}` : ""}!</h1><p>Explore card utilisation and repayment scenarios safely.</p><p><a href="${Deno.env.get("APP_SITE_URL") || "https://zrsaimun.github.io/credit-card-utilisation-management-simulator/"}">Open the simulator</a></p>` }) });
    }
    return new Response(JSON.stringify({ id, clerk_user_id: clerkUserId }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) { return new Response(JSON.stringify({ error: String((error as Error).message || error) }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } }); }
});
