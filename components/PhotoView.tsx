"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { quietBtn } from "@/components/dashboard/styles";

export function PhotoView({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="absolute inset-0 cursor-pointer border-0 bg-transparent p-0"
        aria-label={alt ? `View ${alt}` : "View photo"}
        onClick={() => setOpen(true)}
      >
        <Image alt={alt} className="object-cover" fill sizes="240px" src={src} unoptimized />
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[11000] flex items-center justify-center bg-ink/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={alt || "Photo"}
            className="flex max-h-[92vh] w-full max-w-4xl flex-col items-end gap-3"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className={quietBtn} onClick={() => setOpen(false)}>
              Close
            </button>
            {/* The uploaded file is already a JPEG served by our own route. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="max-h-[80vh] w-auto max-w-full self-center border-2 border-ink bg-paper object-contain shadow-[var(--shadow-brutal)]"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
