import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export const metadata = {
  title: "Dashboard — TransitIQ",
  description: "Fleet owner dashboard.",
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <main
      id="main"
      className="mx-auto flex min-h-[70vh] w-full max-w-7xl items-center justify-center px-4 py-16 sm:px-6"
    >
      <p className="text-2xl font-extrabold tracking-tight text-ink md:text-3xl">
        This is the dashboard page
      </p>
    </main>
  );
}
