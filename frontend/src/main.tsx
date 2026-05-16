import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App";
import "./index.css";

const PUBLISHABLE_KEY = (
  import.meta as ImportMeta & { env?: Record<string, string> }
).env?.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error(
    "Missing VITE_CLERK_PUBLISHABLE_KEY in .env — set it to your Clerk publishable key."
  );
}

// Apply saved appearance preferences before first render to prevent flash
const _fs = localStorage.getItem("clause-font-size");
if (_fs) document.documentElement.dataset.fontSize = _fs;
const _rx = localStorage.getItem("clause-radius");
if (_rx) document.documentElement.dataset.radius = _rx;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/sign-in">
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
