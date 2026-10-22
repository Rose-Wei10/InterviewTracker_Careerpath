// Browser-test-only Clerk boundary. Vite aliases this module only in mode=e2e.
import type { ReactNode } from "react";
export function ClerkProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
export function SignedIn({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
export function SignedOut() {
  return null;
}
export function UserButton() {
  return <span aria-label="Test account">Test account</span>;
}
export function SignIn() {
  return <div>Test sign in</div>;
}
export function RedirectToSignIn() {
  return null;
}
const getToken = async () => "browser-test-token";
export function useAuth() {
  return { getToken, userId: "e2e-user" };
}
export function useUser() {
  return { user: { firstName: "Rose" } };
}
