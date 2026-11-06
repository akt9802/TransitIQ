"use client";

import { useEffect, useState } from "react";
import TruckLogo from "@/components/icons/TruckLogo";

/** Scroll progress: truck follows the leading edge of the fill. */
export default function ScrollTruckProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const read = () => {
      const el = document.documentElement;
      const total = el.scrollHeight - el.clientHeight;
      if (total <= 0) {
        setPct(0);
        return;
      }
      setPct(Math.min(1, Math.max(0, el.scrollTop / total)));
    };
    read();
    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read, { passive: true });
    return () => {
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
    };
  }, []);

  const pct100 = Math.round(pct * 100);
  const truckLeft = `clamp(0px, calc(${pct * 100}% - 0.875rem), calc(100% - 1.75rem))`;

  return (
    <div
      className="relative h-2 w-full min-w-0 bg-paper-muted/90"
      role="progressbar"
      aria-valuenow={pct100}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Scroll progress through the page"
    >
      <div
        className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-100 ease-out"
        style={{ width: `${pct * 100}%` }}
      />
      <div
        className="absolute top-1/2 z-10 -translate-y-1/2 transition-[left] duration-100 ease-out"
        style={{ left: truckLeft }}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded border-2 border-ink bg-paper shadow-[var(--shadow-brutal-sm)]">
          <TruckLogo className="h-4 w-4 text-accent" decorative />
        </span>
      </div>
    </div>
  );
}
