"use client";

import { useEffect, useRef } from "react";

/** Open a record once per reminder target, after paint, so the form is the thing the reminder named. */
export function useOpenRecord(token: string | undefined, open: () => void) {
  const seen = useRef<string | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (!token || seen.current === token) return;
    const timer = window.setTimeout(() => {
      seen.current = token;
      openRef.current();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [token]);
}

export function scrollToField(id: string) {
  let tries = 0;
  function look() {
    const node = document.getElementById(id);
    if (!node) {
      if (tries < 8) {
        tries += 1;
        window.setTimeout(look, 50);
      }
      return;
    }
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    const input = node.querySelector("input, select, textarea");
    if (input instanceof HTMLElement) input.focus();
  }
  window.setTimeout(look, 0);
}
