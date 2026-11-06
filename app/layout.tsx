import type { Metadata } from "next";
import { Chivo_Mono } from "next/font/google";
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
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${chivoMono.variable} h-full`}>
      {/* suppressHydrationWarning: browser extensions may inject attributes on <body> before React hydrates */}
      <body className="min-h-full font-sans" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
