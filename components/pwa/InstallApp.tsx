"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function standaloneNow() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

export function InstallApp({ className }: { className: string }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState<string | null>(null);

  useEffect(() => {
    if (standaloneNow()) setInstalled(true);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    function onPrompt(event: Event) {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    }
    function onInstalled() {
      setInstalled(true);
      setPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (prompt) {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setPrompt(null);
      if (choice.outcome === "accepted") setInstalled(true);
      return;
    }
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    setHelp(
      ios
        ? "On iPhone, tap Share, then Add to Home Screen. TransitIQ then opens like an app, without the desktop site."
        : "Open the browser menu and choose Install app, or Add to Home screen. TransitIQ then opens like an app on the phone."
    );
  }

  return (
    <>
      <button type="button" className={className} onClick={() => void install()}>
        Install app
      </button>
      {help ? <Modal message={help} onConfirm={() => setHelp(null)} onCancel={() => setHelp(null)} /> : null}
    </>
  );
}
