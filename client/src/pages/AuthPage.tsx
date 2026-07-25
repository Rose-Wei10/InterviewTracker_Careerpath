import {
  SignIn,
  SignedIn,
  SignedOut,
} from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";

export default function AuthPage() {
  return (
    <>
      <SignedIn>
        <Navigate to="/dashboard" replace />
      </SignedIn>

      <SignedOut>
        <div className="flex justify-center items-center min-h-screen">
          <SignIn
            routing="hash"
            fallbackRedirectUrl="/dashboard"
          />
        </div>
      </SignedOut>
    </>
  );
}