import { useAuth, SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";
import { invokeEdgeFunction } from "../lib/supabase";
import { track } from "../lib/posthog";

function UpgradeAction() {
  const { getToken } = useAuth();
  const startCheckout = async () => {
    track("upgrade_clicked", { plan: "pro" });
    const token = await getToken();
    if (!token) return;
    const result = await invokeEdgeFunction<{ url?: string }>("create-checkout", { plan: "pro" }, token);
    if (result.url) window.location.assign(result.url);
  };
  return <button type="button" className="upgrade-button" onClick={() => void startCheckout()}>Upgrade to Pro</button>;
}

export function UpgradeButton() {
  return <span className="upgrade-wrap"><SignedIn><UpgradeAction /></SignedIn><SignedOut><SignInButton mode="modal"><button type="button" className="upgrade-button" onClick={() => track("upgrade_clicked", { plan: "pro", signed_in: false })}>Upgrade to Pro</button></SignInButton></SignedOut></span>;
}
