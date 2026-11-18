import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";
import { adminClient, cors } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-12-18.acacia" });
    const signature = req.headers.get("stripe-signature"); if (!signature) throw new Error("Missing Stripe signature");
    const event = await stripe.webhooks.constructEventAsync(await req.text(), signature, Deno.env.get("STRIPE_WEBHOOK_SECRET")!);
    const object = event.data.object as Stripe.Checkout.Session | Stripe.Subscription;
    const customer = typeof object.customer === "string" ? object.customer : object.customer?.id;
    const active = ["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated"].includes(event.type);
    const inactive = ["customer.subscription.deleted"].includes(event.type);
    if ((active || inactive) && customer) { const supabase = adminClient(); await supabase.from("profiles").update({ is_pro: active, stripe_customer_id: customer }).eq("stripe_customer_id", customer); }
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (error) { return new Response(JSON.stringify({ error: String((error as Error).message || error) }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } }); }
});
