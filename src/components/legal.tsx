import Link from "next/link";
import type { ReactNode } from "react";

export const LEGAL_CONTACT_EMAIL = "deivammuthupandi123@gmail.com";
export const LEGAL_LAST_UPDATED = "26 August 2026";

export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto w-full max-w-3xl">
      <h1 className="text-3xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">
        Last updated {LEGAL_LAST_UPDATED}
      </p>
      <p className="mt-4 text-base text-slate-700">{intro}</p>
      {children}
      <p className="mt-10 text-sm text-slate-500">
        Questions about this page? Email{" "}
        <a
          className="font-medium text-slate-900 underline"
          href={`mailto:${LEGAL_CONTACT_EMAIL}`}
        >
          {LEGAL_CONTACT_EMAIL}
        </a>
        .
      </p>
    </article>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
        {children}
      </div>
    </section>
  );
}

export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-sm text-slate-500">
        <span>My Money — assets, liabilities and goals</span>
        <nav className="flex items-center gap-4">
          <Link className="hover:text-slate-900" href="/privacy">
            Privacy Policy
          </Link>
          <Link className="hover:text-slate-900" href="/terms">
            Terms of Service
          </Link>
        </nav>
      </div>
    </footer>
  );
}
