"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { lockApp, signOut, useAuth } from "@/lib/auth-client";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/assets", label: "Assets" },
  { href: "/liabilities", label: "Liabilities" },
  { href: "/goals", label: "Goals" },
  { href: "/snapshots", label: "Snapshots" },
  { href: "/analytics", label: "Analytics" },
  { href: "/connections", label: "Connections" },
  { href: "/security", label: "Security" },
];

export function Nav() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="text-base font-semibold text-slate-900">
          My Money
        </Link>
        <nav className="flex flex-wrap gap-1">
          {LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  active
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          {user ? (
            <span className="mr-2 hidden max-w-[14rem] truncate text-sm text-slate-500 lg:inline">
              {user.email}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void lockApp()}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Lock
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
