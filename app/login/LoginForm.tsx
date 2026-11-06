"use client";

import { useState } from "react";
import type { OtpPurpose } from "@/lib/auth/otp";

type Step = "email" | "otp" | "password" | "login" | "forgot";

const fieldClass =
  "mt-2 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm";
const btnClass =
  "w-full rounded-md border-2 border-ink bg-accent py-3 text-xs font-extrabold uppercase tracking-wider text-accent-ink shadow-[var(--shadow-brutal-sm)] disabled:opacity-50";
const labelClass = "block text-xs font-bold uppercase tracking-wider text-muted";
const linkClass = "font-bold text-accent underline decoration-2 underline-offset-2";

export default function LoginForm() {
  const [step, setStep] = useState<Step>("email");
  const [purpose, setPurpose] = useState<OtpPurpose>("signup");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function go(next: Step, nextMessage?: string | null) {
    setStep(next);
    setError(null);
    setMessage(nextMessage ?? null);
    setCode("");
    setPassword("");
  }

  async function requestOtp(e: React.FormEvent, nextPurpose: OtpPurpose) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    setPurpose(nextPurpose);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: nextPurpose }),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        exists?: boolean;
      };
      if (res.status === 409 || data.exists) {
        go("login", data.error ?? "An account already exists. Sign in with your password.");
        return;
      }
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
        body: JSON.stringify({ email, code, purpose }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setStep("password");
      setMessage(
        purpose === "reset" ? "Code verified. Choose a new password." : "Code verified. Set your password."
      );
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

  const heading =
    step === "login"
      ? "Sign in"
      : step === "forgot" || (step === "otp" && purpose === "reset") || (step === "password" && purpose === "reset")
        ? "Reset password"
        : "Fleet owner sign in";

  return (
    <div className="mx-auto max-w-md px-4 py-16 font-sans">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">{heading}</h1>
      <p className="mt-2 text-sm text-muted">
        {step === "login"
          ? "Use the email and password for your fleet account."
          : step === "forgot" || purpose === "reset"
            ? "We’ll email a code so you can set a new password."
            : "New here? Verify your email, then set a password. Existing accounts sign in with password."}
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
        <form onSubmit={(e) => requestOtp(e, "signup")} className="mt-6 space-y-4">
          <label className={labelClass}>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
              autoComplete="email"
            />
          </label>
          <button type="submit" disabled={loading} className={btnClass}>
            {loading ? "Sending…" : "Send verification code"}
          </button>
          <p className="text-center text-xs text-muted">
            Already have an account?{" "}
            <button type="button" className={linkClass} onClick={() => go("login")}>
              Sign in with password
            </button>
          </p>
        </form>
      )}

      {step === "forgot" && (
        <form onSubmit={(e) => requestOtp(e, "reset")} className="mt-6 space-y-4">
          <label className={labelClass}>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
              autoComplete="email"
            />
          </label>
          <button type="submit" disabled={loading} className={btnClass}>
            {loading ? "Sending…" : "Send reset code"}
          </button>
          <p className="text-center text-xs text-muted">
            Remembered it?{" "}
            <button type="button" className={linkClass} onClick={() => go("login")}>
              Back to sign in
            </button>
          </p>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={verifyOtp} className="mt-6 space-y-4">
          <label className={labelClass}>
            6-digit code
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={`${fieldClass} tracking-widest`}
            />
          </label>
          <button type="submit" disabled={loading} className={btnClass}>
            {loading ? "Checking…" : "Verify code"}
          </button>
          <p className="text-center text-xs text-muted">
            <button
              type="button"
              className={linkClass}
              onClick={() => go(purpose === "reset" ? "forgot" : "email")}
            >
              Use a different email
            </button>
          </p>
        </form>
      )}

      {step === "password" && (
        <form onSubmit={setPwd} className="mt-6 space-y-4">
          <label className={labelClass}>
            {purpose === "reset" ? "New password (min 8 characters)" : "Password (min 8 characters)"}
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={fieldClass}
              autoComplete="new-password"
            />
          </label>
          <button type="submit" disabled={loading} className={btnClass}>
            {loading ? "Saving…" : purpose === "reset" ? "Save new password & sign in" : "Save password & sign in"}
          </button>
        </form>
      )}

      {step === "login" && (
        <form onSubmit={login} className="mt-6 space-y-4">
          <label className={labelClass}>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Password
            <input
              type="password"
              required
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className={fieldClass}
              autoComplete="current-password"
            />
          </label>
          <button type="submit" disabled={loading} className={btnClass}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <p className="flex flex-col items-center gap-2 text-center text-xs text-muted">
            <button type="button" className={linkClass} onClick={() => go("forgot")}>
              Forgot password?
            </button>
            <span>
              New here?{" "}
              <button
                type="button"
                className={linkClass}
                onClick={() => {
                  setPurpose("signup");
                  go("email");
                }}
              >
                Create an account
              </button>
            </span>
          </p>
        </form>
      )}
    </div>
  );
}
