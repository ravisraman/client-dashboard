import Link from "next/link";
import { BrandMark } from "./brand-mark";
import { SignOutButton } from "./sign-out-button";

export function Header({ user }: { user: { name: string; email: string; role: string } }) {
  return (
    <header className="flex flex-col gap-3 border-b border-rule px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-12">
      <BrandMark />
      <nav className="flex flex-wrap items-center gap-x-7 gap-y-2 text-[0.8125rem] tracking-[0.04em]">
        {user.role === "admin" && (
          <>
            <NavLink href="/admin">Report</NavLink>
            <NavLink href="/admin/clients">Clients</NavLink>
          </>
        )}
        <span className="hidden text-ink-faint md:inline">{user.email}</span>
        <SignOutButton />
      </nav>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="border-b border-transparent pb-0.5 text-ink-body no-underline hover:border-rule-strong hover:text-ink"
    >
      {children}
    </Link>
  );
}
