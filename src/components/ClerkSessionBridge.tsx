import { useEffect } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { invokeEdgeFunction } from "../lib/supabase";
import { track } from "../lib/posthog";

export function ClerkSessionBridge() {
  const { isSignedIn, user, isLoaded } = useUser();
  const { getToken } = useAuth();
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    let cancelled = false;
    void (async () => {
      const token = await getToken();
      if (!token || cancelled) return;
      await invokeEdgeFunction("sync-clerk-profile", {
        clerk_user_id: user.id,
        email: user.primaryEmailAddress?.emailAddress || "",
        full_name: user.fullName || user.username || "",
      }, token);
      track("user_signed_in", { provider: "clerk" });
    })().catch(error => console.warn("Profile sync unavailable until Edge Functions are configured", error));
    return () => { cancelled = true; };
  }, [getToken, isLoaded, isSignedIn, user]);
  return null;
}
