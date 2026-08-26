import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/shell";
import { SiteFooter } from "@/components/legal";

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
        <Shell>{children}</Shell>
        <SiteFooter />
      </body>
    </html>
  );
}
