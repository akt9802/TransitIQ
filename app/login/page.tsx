import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import LoginForm from "./LoginForm";

export const metadata = {
  title: "Sign in — TransitIQ",
  description: "Fleet owner email verification and sign in.",
};

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect("/dashboard");
  }
  return (
    <main id="main">
      <LoginForm />
    </main>
  );
}
