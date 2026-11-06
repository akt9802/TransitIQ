"use client";

import { useState } from "react";

type Step = "email" | "otp" | "password" | "login";

export default function LoginForm() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setMessage(data.message ?? "Code sent.");
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setStep("password");
      setMessage("Code verified. Set your password.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function setPwd(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save password");
    } finally {
      setLoading(false);
    }
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: loginPassword }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 font-sans">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">
        Fleet owner sign in
      </h1>
      <p className="mt-2 text-sm text-muted">
        New users: enter email → OTP from inbox → set password. Returning: use
        email + password at the end.
      </p>

      {message ? (
        <p className="mt-4 rounded-md border-2 border-ink/15 bg-paper-muted px-3 py-2 text-sm text-ink-soft">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      {step === "email" && (
        <form onSubmit={requestOtp} className="mt-6 space-y-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm"
              autoComplete="email"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md border-2 border-ink bg-accent py-3 text-xs font-extrabold uppercase tracking-wider text-accent-ink shadow-[var(--shadow-brutal-sm)] disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send verification code"}
          </button>
          <p className="text-center text-xs text-muted">
            Already set a password?{" "}
            <button
              type="button"
              className="font-bold text-accent underline decoration-2 underline-offset-2"
              onClick={() => {
                setStep("login");
                setMessage(null);
                setError(null);
              }}
            >
              Sign in with password
            </button>
          </p>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={verifyOtp} className="mt-6 space-y-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted">
            6-digit code
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="mt-2 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm tracking-widest"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md border-2 border-ink bg-accent py-3 text-xs font-extrabold uppercase tracking-wider text-accent-ink shadow-[var(--shadow-brutal-sm)] disabled:opacity-50"
          >
            {loading ? "Checking…" : "Verify code"}
          </button>
        </form>
      )}

      {step === "password" && (
        <form onSubmit={setPwd} className="mt-6 space-y-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted">
            Password (min 8 characters)
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm"
              autoComplete="new-password"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md border-2 border-ink bg-accent py-3 text-xs font-extrabold uppercase tracking-wider text-accent-ink shadow-[var(--shadow-brutal-sm)] disabled:opacity-50"
          >
            {loading ? "Saving…" : "Save password & sign in"}
          </button>
        </form>
      )}

      {step === "login" && (
        <form onSubmit={login} className="mt-6 space-y-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted">
            Password
            <input
              type="password"
              required
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="mt-2 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm"
              autoComplete="current-password"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md border-2 border-ink bg-accent py-3 text-xs font-extrabold uppercase tracking-wider text-accent-ink shadow-[var(--shadow-brutal-sm)] disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      )}
    </div>
  );
}
