"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { quietBtn } from "@/components/dashboard/styles";

type Notice = { key: string; text: string; href: string; days: number | null };

function permissionNow(): NotificationPermission | "missing" {
  return typeof Notification === "undefined" ? "missing" : Notification.permission;
}

export default function PaperReminders() {
  const router = useRouter();
  const [banner, setBanner] = useState<Notice[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | "missing">("default");
  const urgent = banner.some((item) => item.days != null && item.days <= 6);

  const load = useCallback(async (claim: boolean) => {
    const res = await fetch(`/api/company/paper-reminders${claim ? "?claim=1" : ""}`, { cache: "no-store" });
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
    const onSaved = () => void load(permissionNow() === "granted");
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("transitiq-reminders", onSaved);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("transitiq-reminders", onSaved);
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
            <a
              className="-mx-1 inline-block rounded-sm px-1 font-bold text-ink underline decoration-2 underline-offset-2 hover:bg-accent-soft"
              href={item.href}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                event.preventDefault();
                const url = new URL(item.href, window.location.origin);
                url.searchParams.set("open", String(Date.now()));
                router.push(`${url.pathname}?${url.searchParams.toString()}`);
              }}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
