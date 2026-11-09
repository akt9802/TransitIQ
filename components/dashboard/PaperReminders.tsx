"use client";

import { useCallback, useEffect, useState } from "react";
import { quietBtn } from "@/components/dashboard/styles";

type Notice = { key: string; text: string; href: string; days: number | null };

function permissionNow(): NotificationPermission | "missing" {
  return typeof Notification === "undefined" ? "missing" : Notification.permission;
}

export default function PaperReminders() {
  const [banner, setBanner] = useState<Notice[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | "missing">("default");
  const urgent = banner.some((item) => item.days != null && item.days <= 6);

  const load = useCallback(async (claim: boolean) => {
    const res = await fetch(`/api/company/paper-reminders${claim ? "?claim=1" : ""}`);
    if (!res.ok) return;
    const data = (await res.json()) as { banner?: Notice[]; push?: Notice[] };
    setBanner(data.banner ?? []);
    for (const item of data.push ?? []) {
      try {
        new Notification("Paper due", { body: item.text, tag: item.key });
      } catch {
        /* The list on the page still shows. */
      }
    }
  }, []);

  useEffect(() => {
    setPermission(permissionNow());
    const claim = permissionNow() === "granted";
    void load(claim);
    const timer = window.setInterval(() => void load(permissionNow() === "granted"), 10 * 60 * 1000);
    const onFocus = () => void load(permissionNow() === "granted");
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [load]);

  if (banner.length === 0) return null;

  return (
    <section className="mb-6 border-2 border-ink bg-paper p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-ink">Reminders</h2>
        {permission === "default" ? (
          <button
            type="button"
            className={quietBtn}
            onClick={() => {
              void Notification.requestPermission().then((next) => {
                setPermission(next);
                if (next === "granted") void load(true);
              });
            }}
          >
            Turn on reminders
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-muted">
        {urgent
          ? "A due paper or service reminds you in the morning, afternoon, and evening until it is updated."
          : "Papers warn at 30, 15, and 7 days. A service also warns at 1,000, 500, and 200 km."}
        {permission === "denied" ? " Browser reminders are off, so this list is the notice." : ""}
      </p>
      <ul className="mt-3 space-y-2">
        {banner.map((item) => (
          <li key={item.key} className="text-sm text-ink">
            <a className="font-bold text-ink underline decoration-2 underline-offset-2" href={item.href}>
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
