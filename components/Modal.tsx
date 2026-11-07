"use client";

import { useEffect, useRef, useState } from "react";
import { primaryBtn, quietBtn } from "@/components/dashboard/styles";

export function Modal({
  message,
  confirmLabel = "OK",
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  useEffect(() => {
    confirmRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") cancelRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-ink/50 p-4" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={message}
        className="w-full max-w-md border-2 border-ink bg-paper p-5 shadow-[var(--shadow-brutal)]"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-sm text-ink">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          {cancelLabel ? (
            <button type="button" className={quietBtn} onClick={onCancel}>
              {cancelLabel}
            </button>
          ) : null}
          <button ref={confirmRef} type="button" className={primaryBtn} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Notice({ message }: { message: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return <Modal message={message} onConfirm={() => setOpen(false)} onCancel={() => setOpen(false)} />;
}
