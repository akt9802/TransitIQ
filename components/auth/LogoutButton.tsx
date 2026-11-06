"use client";

import { useState } from "react";

type Props = {
  className?: string;
};

export default function LogoutButton({ className }: Props) {
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={loading}
      className={
        className ??
        "rounded-md border-2 border-ink bg-paper px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider text-ink shadow-[var(--shadow-brutal-sm)] transition hover:-translate-y-0.5 hover:bg-paper-muted disabled:opacity-50"
      }
    >
      {loading ? "Signing out…" : "Log out"}
    </button>
  );
}
