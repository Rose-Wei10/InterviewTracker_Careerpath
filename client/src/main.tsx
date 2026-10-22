import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App";
import "./index.css";
const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {key ? (
      <ClerkProvider publishableKey={key}>
        <App />
      </ClerkProvider>
    ) : (
      <div className="setup">
        <h1>Welcome to Careerpath</h1>
        <p>
          Set VITE_CLERK_PUBLISHABLE_KEY in client/.env to enable secure
          sign-in. See the README for local setup.
        </p>
      </div>
    )}
  </React.StrictMode>,
);
