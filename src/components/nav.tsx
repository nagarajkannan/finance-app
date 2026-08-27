"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { lockApp, signOut, useAuth } from "@/lib/auth-client";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/assets", label: "Assets" },
  { href: "/liabilities", label: "Liabilities" },
  { href: "/cash-flow", label: "Cash flow" },
  { href: "/goals", label: "Goals" },
  { href: "/snapshots", label: "Snapshots" },
  { href: "/analytics", label: "Analytics" },
  { href: "/connections", label: "Connections" },
  { href: "/security", label: "Security" },
];

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden
    >
      <rect x="5" y="11" width="14" height="11" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function Nav() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
        <Link
          href="/"
          className="shrink-0 text-base font-semibold leading-none text-slate-900"
        >
          My Money
        </Link>
        <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium leading-none ${
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
        <div className="flex shrink-0 items-center gap-1">
          {user ? (
            <span className="mr-1 hidden max-w-56 truncate text-sm leading-none text-slate-500 lg:inline">
              {user.email}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void lockApp()}
            title="Lock"
            aria-label="Lock"
            className="inline-flex size-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <LockIcon />
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-lg px-2.5 py-1.5 text-sm font-medium leading-none text-slate-600 hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
