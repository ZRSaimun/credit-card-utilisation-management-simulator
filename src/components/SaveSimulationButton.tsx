import { useAuth, useUser } from "@clerk/clerk-react";
import { useState } from "react";
import { invokeEdgeFunction } from "../lib/supabase";
import { track } from "../lib/posthog";

export function SaveSimulationButton({ name, cardData }: { name: string; cardData: unknown }) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const save = async () => {
    setBusy(true); setMessage("");
    try {
      const token = await getToken();
      if (!token) throw new Error("Sign in before saving to Supabase.");
      const result = await invokeEdgeFunction<{ error?: string }>("save-simulation", { simulation_name: name || "Simulation", card_data: cardData }, token);
      if (result.error) throw new Error(result.error);
      track("simulation_saved", { storage: "supabase", card_count: Array.isArray(cardData) ? cardData.length : undefined });
      if (user?.primaryEmailAddress?.emailAddress) await invokeEdgeFunction("send-email", { type: "simulation_saved", to: user.primaryEmailAddress.emailAddress, simulationName: name || "Simulation", summary: "Your simulation was saved to your private account." }, token);
      setMessage("Saved to Supabase");
    } catch (error) { setMessage(String((error as Error).message || error)); }
    finally { setBusy(false); }
  };
  return <span className="cloud-save-action"><button type="button" onClick={() => void save()} disabled={busy}>{busy ? "Saving…" : "Save to Supabase"}</button>{message && <small role="status">{message}</small>}</span>;
}
