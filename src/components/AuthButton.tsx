import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/clerk-react";

export function AuthButton() {
  const { user } = useUser();
  return <span className="auth-button" aria-label={user ? `Signed in as ${user.fullName || user.primaryEmailAddress?.emailAddress || "user"}` : "Authentication"}>
    <SignedOut><SignInButton mode="modal"><button type="button" className="theme-toggle">Sign in</button></SignInButton></SignedOut>
    <SignedIn><span className="auth-user-label">{user?.firstName || user?.primaryEmailAddress?.emailAddress || "Account"}</span><UserButton afterSignOutUrl={window.location.href} /></SignedIn>
  </span>;
}
