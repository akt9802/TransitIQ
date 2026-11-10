import type { ReactNode } from "react";

type Props = { className?: string };

function Mark({ className = "h-4 w-4", children }: Props & { children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function EyeIcon({ className }: Props) {
  return (
    <Mark className={className}>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </Mark>
  );
}

export function EyeOffIcon({ className }: Props) {
  return (
    <Mark className={className}>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.2A10 10 0 0 1 12 6c6.5 0 10 6 10 6a18 18 0 0 1-3.2 3.8" />
      <path d="M6.1 6.1C3.5 7.8 2 12 2 12s3.5 6 10 6a10 10 0 0 0 4.2-.9" />
    </Mark>
  );
}

export function BuildingIcon({ className }: Props) {
  return (
    <Mark className={className}>
      <path d="M4 20V6l8-3 8 3v14" />
      <path d="M9 20v-5h6v5" />
      <path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01" />
    </Mark>
  );
}

export function PeopleIcon({ className }: Props) {
  return (
    <Mark className={className}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19c.6-2.6 2.8-4 6-4s5.4 1.4 6 4" />
      <circle cx="17" cy="9" r="2" />
      <path d="M17 15c2 .3 3.4 1.4 4 3" />
    </Mark>
  );
}

export function PersonIcon({ className }: Props) {
  return (
    <Mark className={className}>
      <circle cx="12" cy="8" r="3" />
      <path d="M5 19c.8-3 3.2-4.5 7-4.5S18.2 16 19 19" />
    </Mark>
  );
}

export function RouteIcon({ className }: Props) {
  return (
    <Mark className={className}>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M8 7c4 0 4 5 8 5h2" />
      <path d="M16 17c-4 0-4-5-8-5" />
    </Mark>
  );
}

export function PulseIcon({ className }: Props) {
  return (
    <Mark className={className}>
      <path d="M3 12h4l2-5 4 10 2-5h6" />
    </Mark>
  );
}

export function DropIcon({ className }: Props) {
  return (
    <Mark className={className}>
      <path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11Z" />
    </Mark>
  );
}

export function StarIcon({ className }: Props) {
  return (
    <Mark className={className}>
      <path d="m12 3 2.4 5.4L20 9.2l-4 3.8.9 5.5L12 16.2 7.1 18.5 8 13 4 9.2l5.6-.8L12 3Z" />
    </Mark>
  );
}

export function AlertIcon({ className }: Props) {
  return (
    <Mark className={className}>
      <path d="M12 4 3 19h18L12 4Z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </Mark>
  );
}
