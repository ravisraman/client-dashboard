import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <BrandMark />
        <h1 className="mt-10 text-4xl">Client sign in</h1>
        <p className="mt-2 text-ink-soft">Sign in with the email address you use to book sessions.</p>
        {error && (
          <p className="mt-4 bg-accent-soft/30 p-3 text-sm text-accent">
            That sign-in link is invalid or has expired. Please request a new one.
          </p>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
