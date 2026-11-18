import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return <><SignedIn>{children}</SignedIn><SignedOut><RedirectToSignIn /></SignedOut></>;
}
