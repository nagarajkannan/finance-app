import type { Metadata } from "next";
import Link from "next/link";
import {
  LEGAL_CONTACT_EMAIL,
  LegalPage,
  List,
  Section,
} from "@/components/legal";

export const metadata: Metadata = {
  title: "Terms of Service — My Money",
  description:
    "The terms you agree to when using My Money to track your assets, liabilities and goals.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="These terms are the agreement between you and My Money (“the app”, “we”, “us”). By signing in to or using the app you accept them. If you do not accept them, please do not use the app."
    >
      <Section title="What the app does">
        <p>
          My Money lets you record the assets you own, the liabilities you owe
          and the goals you are saving for, see your net worth, and export that
          information as an Excel workbook — optionally into your own Google
          Drive. The app is provided free of charge for personal use.
        </p>
      </Section>

      <Section title="Not financial advice">
        <p>
          The app is a record-keeping and calculation tool only. Nothing in it is
          investment, tax, legal or financial advice, and no figure shown is a
          recommendation to buy, sell or hold anything. Values for deposits,
          bonds and similar instruments are estimates derived from the inputs you
          provide, and market prices come from third-party sources that may be
          delayed, incomplete or wrong. Always check with your bank, broker or a
          qualified adviser before acting on anything you see here.
        </p>
      </Section>

      <Section title="Your account">
        <List
          items={[
            "You need a Google account to sign in, and you must set a 4 digit PIN that unlocks the app.",
            "Keep your Google account and your PIN secure. You are responsible for activity that happens through your account.",
            "You must be at least 18 years old and use the app only for lawful purposes.",
            "Do not attempt to access other users' data, disrupt the service, scrape it, or work around its security and rate limits.",
          ]}
        />
      </Section>

      <Section title="Your data and connected accounts">
        <p>
          The data you enter stays yours. We handle it as described in our{" "}
          <Link
            className="font-medium text-slate-900 underline"
            href="/privacy"
          >
            Privacy Policy
          </Link>
          . If you connect a broker account or upload a holdings file, you
          confirm you are entitled to use those credentials and that data. If you
          allow Google Drive exports, you grant the app permission to create
          files in a folder it creates in your Drive; it never reads your other
          files. You can revoke that access at any time in your Google account
          settings.
        </p>
      </Section>

      <Section title="Availability and changes">
        <p>
          The app is offered on an as-available basis. Features may change or be
          removed, and the service may be interrupted for maintenance or for
          reasons outside our control, including changes at Google, brokers or
          market-data providers. Please keep your own backups by exporting your
          data regularly.
        </p>
      </Section>

      <Section title="Disclaimer and liability">
        <p>
          The app is provided “as is” and “as available”, without warranties of
          any kind, express or implied, including fitness for a particular
          purpose, accuracy of calculations or market data, and uninterrupted
          availability. To the maximum extent permitted by law, we are not liable
          for any indirect, incidental or consequential loss, or for any lost
          profits, lost savings, investment losses or data loss arising from your
          use of the app.
        </p>
      </Section>

      <Section title="Ending your use">
        <p>
          You can stop using the app at any time, revoke its Google access, and
          ask us to delete your account by emailing{" "}
          <a
            className="font-medium text-slate-900 underline"
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
          . We may suspend or end access to an account that breaks these terms or
          puts the service or other users at risk.
        </p>
      </Section>

      <Section title="Changes to these terms">
        <p>
          We may update these terms; the date at the top of this page shows the
          latest version, and material changes will be shown in the app.
          Continuing to use the app after a change means you accept the updated
          terms.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about these terms can be sent to{" "}
          <a
            className="font-medium text-slate-900 underline"
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
