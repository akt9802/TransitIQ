"use client";

import { usePathname } from "next/navigation";
import LogoutButton from "@/components/auth/LogoutButton";
import TruckLogo from "@/components/icons/TruckLogo";
import ScrollTruckProgress from "@/components/landing/ScrollTruckProgress";

const SHELL = "mx-auto w-full max-w-7xl px-3 sm:px-4 md:px-5 lg:px-6";

const BTN =
  "rounded-md border-2 border-ink bg-paper px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider text-ink shadow-[var(--shadow-brutal-sm)] transition duration-150 hover:-translate-y-0.5 hover:bg-accent-soft hover:shadow-[var(--shadow-brutal)] active:translate-y-0 active:shadow-none";

const NAV = [
  { href: "/#offer", label: "Product" },
  { href: "/#how", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
] as const;

type Props = { email: string | null; name?: string | null };

export default function SiteHeader({ email, name }: Props) {
  const label = name?.trim() || email;
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isLogin = pathname === "/login";
  const isDashboard = pathname === "/dashboard";

  return (
    <header className="sticky top-0 z-50 bg-paper/95 shadow-none backdrop-blur-sm print:hidden">
      <div className={`flex flex-wrap items-center justify-between gap-4 py-3.5 ${SHELL}`}>
        <a
          href="/"
          className="group flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-ink no-underline"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-md border-2 border-ink bg-accent shadow-[var(--shadow-brutal-sm)] transition-transform group-hover:-translate-y-0.5">
            <TruckLogo className="h-6 w-6 text-accent-ink" decorative />
          </span>
          TransitIQ
        </a>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          {isHome || isLogin ? (
            <nav aria-label="Page" className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="rounded px-1 text-xs font-extrabold uppercase tracking-wider text-ink no-underline transition hover:bg-accent-soft hover:text-accent"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          ) : null}
          {email ? (
            <>
              {!isDashboard ? (
                <a href="/dashboard" className={BTN}>
                  Dashboard
                </a>
              ) : (
                <span className="hidden max-w-[14rem] truncate text-sm text-ink sm:inline">{label}</span>
              )}
              <LogoutButton />
            </>
          ) : !isLogin ? (
            <a href="/login" className={BTN}>
              Sign in
            </a>
          ) : null}
        </div>
      </div>
      {isHome ? (
        <div className="bg-paper-muted/50">
          <ScrollTruckProgress />
        </div>
      ) : (
        <div className="h-px bg-ink/15" />
      )}
    </header>
  );
}
