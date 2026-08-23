import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";
import { DataError } from "@/components/data-error";
import { AuthGate } from "@/components/auth-gate";

export const metadata: Metadata = {
  title: "My Money — Assets, Liabilities & Goals",
  description:
    "A simple app to track what you own, what you owe, and your money goals.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="flex min-h-full flex-col bg-slate-50">
        <AuthGate>
          <Nav />
          <DataError />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
            {children}
          </main>
        </AuthGate>
      </body>
    </html>
  );
}
