import { SignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";
export default function AuthPage() {
  return (
    <>
      <SignedIn>
        <Navigate to="/dashboard" replace />
      </SignedIn>
      <SignedOut>
        <div className="auth-page">
          <div>
            <p className="eyebrow">CAREERPATH · INTERVIEW TRACKER</p>
            <h1>
              A clearer path
              <br />
              to your next chapter.
            </h1>
            <p>
              Organize your opportunities. Prepare with purpose.
              <br />
              Take the next step with confidence.
            </p>
          </div>
          <SignIn routing="hash" fallbackRedirectUrl="/dashboard" />
        </div>
      </SignedOut>
    </>
  );
}
