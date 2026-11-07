import { redirect } from "next/navigation";
import { Notice } from "@/components/Modal";
import OwnerDashboard from "@/components/dashboard/OwnerDashboard";
import { ensureAuthSchema } from "@/lib/auth/schema";
import { getSession } from "@/lib/auth/session";
import { getWorkspace } from "@/lib/company/queries";
import { formatPgError } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard — TransitIQ",
  description: "Fleet owner company and profile.",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const { section } = await searchParams;

  try {
    await ensureAuthSchema();
    const workspace = await getWorkspace(session.sub);
    if (!workspace) {
      return <DashboardError message="This account could not be loaded." />;
    }
    return <OwnerDashboard workspace={workspace} section={section} />;
  } catch (error) {
    console.error("dashboard", error);
    return <DashboardError message={formatPgError(error)} />;
  }
}

function DashboardError({ message }: { message: string }) {
  return (
    <main id="main" className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Dashboard unavailable</h1>
      <Notice message={message} />
      <a
        href="/dashboard"
        className="mt-6 inline-block rounded-md border-2 border-ink bg-accent px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider text-accent-ink shadow-[var(--shadow-brutal-sm)]"
      >
        Try again
      </a>
    </main>
  );
}
