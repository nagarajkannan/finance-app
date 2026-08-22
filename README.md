# My Money — simple finance app

A beginner-friendly Next.js app to track three things only:

1. **Assets** — what you own
2. **Liabilities** — what you owe
3. **Goals** — what you are saving for

Data is stored in Postgres through Prisma, so the same numbers show up on every browser and device you open the app in. You sign in with Google and unlock the app with a 4 digit PIN, and every account only ever sees its own assets, liabilities and goals.

## Modules

### Sign in and PIN lock
- **Google is the only way in.** No passwords, no email links.
- The first sign-in asks you to **create a 4 digit PIN**. It is stored as a salted scrypt hash, never in plain text.
- The PIN is asked again whenever you come back to the app: switching to another app or tab for more than 15 seconds, closing the browser, or 30 minutes after the last unlock all lock it again. **Lock** in the header locks it straight away.
- Five wrong PINs lock the PIN for 15 minutes.
- Assets, liabilities, goals and Groww connections are per account — every API route reads and writes only the rows belonging to the signed-in user.
- Change your PIN under **Security**.

### Assets
- Add, edit, view and delete assets.
- Guided flow: **Category → Asset type → Asset details**.
- Categories: Equity, Debt, Real Estate, Commodities, Cash & Savings, Other.
- Each asset stores name, category, type, institution, invested amount, current value, start date and notes.
- Update the current value at any time from the asset page; every linked goal recalculates instantly.
- Shows invested amount, current value, profit / loss, profit / loss % and total asset value.
- The asset list is grouped by category, with a per-category total row.

### Debt assets are calculated, not typed in
Debt assets ask for how the instrument works instead of asking you for the value today:
- **FD / RD** — amount (or monthly deposit), interest rate, compounding frequency, start date, tenure.
- **Bonds** — face value, quantity, buy price, coupon rate, payout frequency (or cumulative), buy and maturity dates.
- **Government schemes** — one time or yearly deposit, rate, start date, tenure.
- **Insurance** — yearly premium, premium term, policy term, guaranteed maturity amount, start date.
- **Debt MF / ETF** — units, average buy NAV, today's NAV.
- **Other debt** — amount, rate, simple or compound, start date, tenure.

Tenure can be entered in **days, months or years**. The value today, the money put in so far and the maturity value are derived from those inputs and are recalculated as time passes. Each debt form (and the asset page) shows a "How is this calculated?" panel at the top with the exact formula used for that instrument.

### Equity mutual funds, stocks and ETFs are calculated too
Picking **Equity → Equity Mutual Fund / Direct Stock / ETF Fund** opens one shared holding form:
- **Fund / symbol** is searched live — mutual funds come from the full AMFI scheme list (`api.mfapi.in`), stocks and ETFs from Yahoo Finance filtered to NSE / BSE listings.
- **Units (or quantity), average buy NAV / price and total invested** stay in step: type any two and the third is worked out for you.
- **Today's NAV / price** is fetched for the instrument you picked, and the asset page refreshes it when it is more than 6 hours old (there is also a **Refresh** button). You can type a price in yourself if the lookup fails.
- **Current value = units × today's price**, so you never type the value today.
- Mutual funds add investment mode (**SIP / lump sum**), folio, and — for SIP — the SIP amount and the day of the month it is debited. Stocks and ETFs add dividend received and the demat / broker.
- The asset is named after the fund or symbol you picked, so there is no separate name to type. Link it to a goal from the goal itself.

Lookups go through `/api/market/search` and `/api/market/quote` so nothing is called from the browser directly.

### Groww sync
Connect a Groww account under **Connections** and your Groww holdings appear as assets on their own:
- Sign in with a daily access token, an API key + secret, or an API key + TOTP from the Groww Trading API.
- Stocks and ETFs come in with quantity, average price and today's price; gold / silver ETFs and SGBs land under Commodities.
- Holdings are matched by ISIN, so a sync updates the existing asset instead of adding a duplicate, and new Groww purchases show up automatically.
- Synced assets cannot be edited by hand — the asset page shows when it was last updated and a **Sync now** button. A sync also runs on its own when the data is more than 30 minutes old.
- A holding that stops coming back from Groww is flagged instead of deleted.
- Anything Groww cannot give us is listed instead of guessed: **mutual fund folios, digital gold and MCX commodities are not part of the Groww Trading API**, and holdings without a live price show the invested amount.
- **Mutual funds come in from a file instead**: download your mutual fund holdings from Groww as CSV and upload it under Connections. Columns are matched loosely (scheme, ISIN, folio, units, NAV, invested and current value), funds are matched on ISIN or folio so re-uploading updates them, and any row that cannot be read is listed rather than dropped.

Credentials stay in your browser; they are sent to a small server route (`/api/groww/sync`) only for the duration of a sync, because Groww cannot be called directly from the browser.

### Liabilities
- Add, edit, view and delete liabilities (home, vehicle, personal, education, credit card, gold, business, friends/family, other).
- Stores lender, original amount, outstanding amount, interest rate, start/end date, EMI and notes.
- Shows total outstanding plus per-liability outstanding, type and EMI.

### Goals
- Create goals with name, description, target amount and target date.
- Link **specific individual assets** — e.g. 2 of your 3 mutual funds for a house goal and the third for a marriage goal. The picker groups assets by category and type, with "select all" per type, and warns when an asset is already used by another goal.
- Progress is derived from the current value of the linked assets: target, current, remaining, progress %.

### Dashboard
Total asset value, invested amount, profit / loss, total outstanding liabilities, goal progress, and **Net worth = assets − liabilities**.

## Running locally

```bash
npm install
cp .env.example .env   # then fill in DATABASE_URL, the Google keys and AUTH_SECRET
npm run db:generate    # generate the Prisma client
npm run db:push        # create the tables
npm run dev            # http://localhost:3000
```

### Google sign-in setup

1. In the [Google Cloud console](https://console.cloud.google.com/apis/credentials) create an **OAuth client ID** of type *Web application*.
2. Add the redirect URIs you use:
   - `http://localhost:3000/api/auth/google/callback`
   - `https://your-app.onrender.com/api/auth/google/callback`
3. Put the client ID and secret in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
4. Set `AUTH_SECRET` to a long random string (`openssl rand -base64 48`) — it signs the session and PIN cookies.
5. On Render also set `APP_URL` to the public URL, so the redirect URI matches the one you registered.
6. Optionally set `ALLOWED_EMAILS` to a comma separated list to keep the deployment to your own accounts.

### Deploying to Render

Build command (the schema push creates the `users` table and the owner columns — without it sign-in fails with a Prisma error):

```bash
npm install && npm run db:generate && npm run db:push && npm run build
```

Start command: `npm run start`. `APP_URL` must be the public URL — every redirect is built from it, otherwise Render's internal `localhost:10000` origin leaks into the browser.

### Data created before login existed

Rows written by the old, login-free version have an empty owner and are invisible to everyone. Sign in once with the account that should own them, then run:

```bash
npm run db:claim -- you@gmail.com
```

Node.js 20.19+ / 22.12+ is needed for Prisma 7. Groww credentials are the one thing that stays in the browser — they are never written to the database.

Other scripts: `npm run build`, `npm run start`, `npm run lint`.
