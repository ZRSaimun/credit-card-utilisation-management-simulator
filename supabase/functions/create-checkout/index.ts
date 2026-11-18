import { clerkClaims, adminClient, cors } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const claims = await clerkClaims(req); const supabase = adminClient();
    const clerkUserId = String(claims.sub || "");
    const { data: profile, error } = await supabase.from("profiles").select("id,email,stripe_customer_id").eq("clerk_user_id", clerkUserId).single();
    if (error || !profile) throw new Error("Sync your profile before starting checkout");
    const params = new URLSearchParams({ mode: "subscription", "line_items[0][price]": Deno.env.get("STRIPE_PRO_PRICE_ID")!, "line_items[0][quantity]": "1", success_url: `${Deno.env.get("APP_SITE_URL")}?checkout=success`, cancel_url: `${Deno.env.get("APP_SITE_URL")}?checkout=cancelled`, customer_email: profile.email, "metadata[profile_id]": profile.id });
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: params });
    const session = await response.json(); if (!response.ok) throw new Error(session.error?.message || "Stripe checkout failed");
    return new Response(JSON.stringify({ url: session.url }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) { return new Response(JSON.stringify({ error: String((error as Error).message || error) }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } }); }
});
