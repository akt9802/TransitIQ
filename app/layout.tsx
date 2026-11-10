import type { Metadata, Viewport } from "next";
import { Chivo_Mono } from "next/font/google";
import SiteHeader from "@/components/layout/SiteHeader";
import { ensureAuthSchema } from "@/lib/auth/schema";
import { getSession, getUserName } from "@/lib/auth/session";
import "./globals.css";

const chivoMono = Chivo_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "800"],
  variable: "--font-chivo-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TransitIQ — Fleet control meets road safety",
  description:
    "Live tracking, hazard alerts and smart routing for Indian trucking fleets. Free for up to 3 trucks.",
  applicationName: "TransitIQ",
  appleWebApp: {
    capable: true,
    title: "TransitIQ",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#2a5cda",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();
  let name: string | null = null;
  if (session) {
    try {
      await ensureAuthSchema();
      name = await getUserName(session.sub);
    } catch (error) {
      console.error("header name", error);
    }
  }

  return (
    <html lang="en" className={`${chivoMono.variable} h-full`}>
      {/* suppressHydrationWarning: browser extensions may inject attributes on <body> before React hydrates */}
      <body className="min-h-full font-sans" suppressHydrationWarning>
        <a
          href="#main"
          className="absolute left-4 top-4 z-[120] -translate-y-[220%] rounded-md border-2 border-ink bg-accent px-3 py-2 text-xs font-extrabold uppercase tracking-wider text-accent-ink shadow-[var(--shadow-brutal-sm)] transition focus:translate-y-0"
        >
          Skip to content
        </a>
        <SiteHeader email={session?.email ?? null} name={name} />
        {children}
      </body>
    </html>
  );
}
