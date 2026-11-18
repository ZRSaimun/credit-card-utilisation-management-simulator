import { clerkClaims, cors } from "../_shared/auth.ts";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const claims = await clerkClaims(req); const { to, type, simulationName, summary } = await req.json();
    const recipient = String(to || (claims as Record<string, unknown>).email || ""); if (!recipient) throw new Error("Recipient email is required");
    const subject = type === "welcome" ? "Welcome to Credit Card Simulator!" : "Your simulation has been saved";
    const html = type === "welcome" ? `<h1>Welcome to Credit Card Simulator!</h1><p>Explore card utilisation and repayment scenarios.</p><p><a href="${Deno.env.get("APP_SITE_URL") || "https://zrsaimun.github.io/credit-card-utilisation-management-simulator/"}">Open the simulator</a></p>` : `<h1>Your simulation has been saved</h1><p><b>${String(simulationName || "Simulation")}</b></p><pre>${String(summary || "Saved successfully")}</pre>`;
    const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: Deno.env.get("RESEND_FROM_EMAIL") || "Credit Card Simulator <onboarding@resend.dev>", to: [recipient], subject, html }) });
    if (!response.ok) throw new Error(await response.text());
    return new Response(JSON.stringify({ sent: true }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) { return new Response(JSON.stringify({ error: String((error as Error).message || error) }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } }); }
});
