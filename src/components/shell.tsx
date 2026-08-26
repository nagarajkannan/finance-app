"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AuthGate } from "@/components/auth-gate";
import { DataError } from "@/components/data-error";
import { Nav } from "@/components/nav";

/** Pages that must render without a Google sign-in or a PIN. */
const PUBLIC_PATHS = ["/privacy", "/terms"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function PublicHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
        <Link
          href="/"
          className="text-base font-semibold leading-none text-slate-900"
        >
          My Money
        </Link>
        <Link
          href="/"
          className="rounded-lg px-2.5 py-1.5 text-sm font-medium leading-none text-slate-600 hover:bg-slate-100"
        >
          Sign in
        </Link>
      </div>
    </header>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (isPublic(pathname)) {
    return (
      <>
        <PublicHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {children}
        </main>
      </>
    );
  }

  return (
    <AuthGate>
      <Nav />
      <DataError />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </AuthGate>
  );
}
