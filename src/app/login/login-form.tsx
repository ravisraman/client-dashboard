"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await authClient.signIn.magicLink({
      email: email.trim().toLowerCase(),
      callbackURL: "/",
      errorCallbackURL: "/login?error=link",
    });
    setState(error ? "error" : "sent");
  }

  if (state === "sent") {
    return (
      <div className="mt-6 bg-ok-soft p-4 text-sm text-ok">
        If <strong>{email}</strong> is registered, a sign-in link is on its way. It expires in 15 minutes.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-3">
      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {state === "error" && (
        <p className="text-sm text-accent">Something went wrong or too many attempts. Please wait a minute and try again.</p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
