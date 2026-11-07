"use client";

import { primaryBtn, quietBtn } from "@/components/dashboard/styles";

export default function PrintButton() {
  return (
    <div className="flex flex-wrap gap-3 print:hidden">
      <button type="button" className={primaryBtn} onClick={() => window.print()}>
        Save as PDF
      </button>
      <a className={`${quietBtn} no-underline`} href="/dashboard?section=trips">
        Back to trips
      </a>
    </div>
  );
}
