"use client";

import { useState } from "react";
import { quietBtn } from "@/components/dashboard/styles";

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
        className ?? quietBtn
      }
    >
      {loading ? "Signing out…" : "Log out"}
    </button>
  );
}
