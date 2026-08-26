import type { Metadata } from "next";
import Link from "next/link";
import {
  LEGAL_CONTACT_EMAIL,
  LegalPage,
  List,
  Section,
} from "@/components/legal";

export const metadata: Metadata = {
  title: "Privacy Policy — My Money",
  description:
    "How My Money collects, uses, stores and deletes your data, including the Google account data and Google Drive access the app uses.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="My Money (“the app”, “we”, “us”) is a personal finance tracker for assets, liabilities and goals. This policy explains what data the app collects, why it is collected, how it is used and stored, and how you can delete it."
    >
      <Section title="Who runs this app">
        <p>
          My Money is run by an individual developer and is available at{" "}
          <a
            className="font-medium text-slate-900 underline"
            href="https://yourfinanceapp.com"
          >
            yourfinanceapp.com
          </a>
          . For any privacy question or request, email{" "}
          <a
            className="font-medium text-slate-900 underline"
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </Section>

      <Section title="Data we collect">
        <List
          items={[
            <>
              <strong>Google account data.</strong> When you sign in with
              Google, we receive your Google account ID, email address, name and
              profile picture URL. This is used only to create your account and
              to keep your records separate from other users&apos;.
            </>,
            <>
              <strong>Financial data you enter.</strong> Assets, liabilities,
              goals, snapshots and the details attached to them (names,
              amounts, institutions, interest rates, dates and notes).
            </>,
            <>
              <strong>Connection credentials you choose to add.</strong> If you
              connect a broker account (for example Groww) the credentials you
              enter are kept in your own browser and are sent to our server only
              for the duration of a sync so the broker can be called. They are
              not stored on our servers afterwards.
            </>,
            <>
              <strong>Technical data.</strong> Standard server logs (IP address,
              request time, user agent) and session cookies used to keep you
              signed in and to hold your PIN unlock state. We do not use
              advertising or third-party analytics trackers.
            </>,
          ]}
        />
        <p>
          We do not ask for and do not want government identifiers, card
          numbers, bank account numbers or bank login credentials. Please do not
          enter them into the app.
        </p>
      </Section>

      <Section title="How we use your data">
        <List
          items={[
            "To show your assets, liabilities, goals, net worth and progress.",
            "To fetch prices for the instruments you added, so current values stay up to date.",
            "To create the Excel exports and snapshots you ask for.",
            "To keep your account secure (Google sign-in, PIN lock, rate limiting on wrong PIN attempts).",
          ]}
        />
        <p>
          We do not sell your data, we do not share it with data brokers, and we
          do not use it for advertising or to train machine learning or AI
          models.
        </p>
      </Section>

      <Section title="Google user data and Google Drive access">
        <p>
          The app requests the following Google OAuth scopes, and nothing wider:
        </p>
        <List
          items={[
            <>
              <code className="rounded bg-slate-100 px-1 py-0.5">
                openid
              </code>
              ,{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5">email</code>{" "}
              and{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5">profile</code>{" "}
              — to sign you in and identify your account.
            </>,
            <>
              <code className="rounded bg-slate-100 px-1 py-0.5">
                https://www.googleapis.com/auth/drive.file
              </code>{" "}
              — to create Excel exports of your own assets, liabilities and
              goals in a <em>My Money exports</em> folder in your Google Drive,
              so you keep a history of your data that you own. This scope only
              gives the app access to files and folders the app itself created;
              it cannot read, list or modify any other file in your Drive.
            </>,
          ]}
        />
        <p>
          Drive uploads only happen when you ask for them — pressing{" "}
          <em>Save to Drive now</em>, or leaving the Excel-export option enabled
          for snapshots. Nothing is downloaded from your Drive, and no Drive
          file content is read by the app or sent anywhere else.
        </p>
        <p>
          Google access and refresh tokens are stored on our server only so the
          app can upload the exports you asked for. You can revoke that access
          at any time at{" "}
          <a
            className="font-medium text-slate-900 underline"
            href="https://myaccount.google.com/permissions"
          >
            myaccount.google.com/permissions
          </a>
          .
        </p>
      </Section>

      <Section title="Limited Use disclosure">
        <p>
          My Money&apos;s use and transfer of information received from Google
          APIs adheres to the{" "}
          <a
            className="font-medium text-slate-900 underline"
            href="https://developers.google.com/terms/api-services-user-data-policy"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. Specifically, Google user
          data is used only to provide and improve the features described above,
          is never transferred to others except as needed to provide those
          features, to comply with applicable law, or as part of a merger or
          acquisition, is never used for advertising, and is never read by
          humans unless you give explicit consent for a specific support issue,
          it is needed for security purposes, or it is required by law.
        </p>
      </Section>

      <Section title="Where your data is stored and who can see it">
        <p>
          Your records are stored in a managed PostgreSQL database used only by
          this app, and the app is served from a managed hosting provider.
          Traffic is encrypted with HTTPS. Every API route filters rows by the
          signed-in account, so no user can see another user&apos;s data. PINs
          are stored only as salted scrypt hashes, never in plain text.
        </p>
        <p>
          Sub-processors are limited to the hosting and database providers that
          run the app, Google (sign-in and Drive), and the market-data providers
          used to look up prices. Price lookups send only the fund name, symbol
          or scheme code you picked — never your holdings, amounts or identity.
        </p>
      </Section>

      <Section title="How long we keep data and how to delete it">
        <List
          items={[
            "Your assets, liabilities, goals and snapshots are kept until you delete them or ask us to delete your account.",
            "Deleting an item in the app removes it from the database immediately.",
            <>
              To delete your entire account and all of its data, email{" "}
              <a
                className="font-medium text-slate-900 underline"
                href={`mailto:${LEGAL_CONTACT_EMAIL}`}
              >
                {LEGAL_CONTACT_EMAIL}
              </a>{" "}
              from the Google address you signed in with. We will delete
              everything within 30 days and confirm by email.
            </>,
            "Server logs are kept for a short operational period (typically up to 30 days) and then rotated out.",
            "Files already exported to your Google Drive belong to you; deleting your account here does not delete them, and you can remove them yourself from Drive.",
          ]}
        />
      </Section>

      <Section title="Your rights">
        <p>
          You can access and correct your data at any time inside the app,
          export it as an Excel workbook, and request deletion as described
          above. Depending on where you live you may also have the right to
          object to processing or to lodge a complaint with your local data
          protection authority.
        </p>
      </Section>

      <Section title="Children">
        <p>
          The app is not intended for anyone under 18 and we do not knowingly
          collect data from children.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          If this policy changes we will update the date at the top of this page
          and, for material changes, show a notice in the app the next time you
          sign in. Continued use of the app after a change means you accept the
          updated policy.
        </p>
      </Section>

      <Section title="Related">
        <p>
          See also our{" "}
          <Link className="font-medium text-slate-900 underline" href="/terms">
            Terms of Service
          </Link>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
