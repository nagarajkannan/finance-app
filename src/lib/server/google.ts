const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

export interface GoogleProfile {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

function isDev(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function googleConfig() {
  const clientId = isDev()
    ? process.env.GOOGLE_CLIENT_ID_DEV || process.env.GOOGLE_CLIENT_ID
    : process.env.GOOGLE_CLIENT_ID;
  const clientSecret = isDev()
    ? process.env.GOOGLE_CLIENT_SECRET_DEV || process.env.GOOGLE_CLIENT_SECRET
    : process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      isDev()
        ? "GOOGLE_CLIENT_ID_DEV / GOOGLE_CLIENT_SECRET_DEV are not set — add them to your environment."
        : "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set — add them to your environment.",
    );
  }
  return { clientId, clientSecret };
}

/**
 * Public origin of the app. Behind a proxy such as Render the request URL is
 * the internal one (localhost:10000), so `APP_URL` wins when it is set.
 * In `next dev`, `APP_URL_DEV` (typically http://localhost:3000) is used
 * so Google redirects stay on the local OAuth client.
 */
export function appBaseUrl(request: Request): string {
  const configured = (
    isDev() ? process.env.APP_URL_DEV : process.env.APP_URL
  )?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

/** Must match the redirect URI registered with Google exactly. */
export function redirectUri(request: Request): string {
  return `${appBaseUrl(request)}/api/auth/google/callback`;
}

export function authorizeUrl(options: {
  request: Request;
  state: string;
  codeChallenge: string;
}): string {
  const { clientId } = googleConfig();
  const url = new URL(AUTH_ENDPOINT);

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri(options.request));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", options.state);
  url.searchParams.set("code_challenge", options.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");

  return url.toString();
}

export async function exchangeCode(options: {
  request: Request;
  code: string;
  codeVerifier: string;
}): Promise<string> {
  const { clientId, clientSecret } = googleConfig();

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: options.code,
      code_verifier: options.codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(options.request),
    }),
  });

  const body = (await response.json().catch(() => null)) as {
    access_token?: string;
    error_description?: string;
    error?: string;
  } | null;

  if (!response.ok || !body?.access_token) {
    throw new Error(
      body?.error_description ?? body?.error ?? "Google rejected the sign-in.",
    );
  }
  return body.access_token;
}

export async function fetchProfile(accessToken: string): Promise<GoogleProfile> {
  const response = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const body = (await response.json().catch(() => null)) as
    | (Partial<GoogleProfile> & { email_verified?: boolean })
    | null;

  if (!response.ok || !body?.sub || !body.email) {
    throw new Error("Google did not return an account.");
  }
  if (body.email_verified === false) {
    throw new Error("That Google account does not have a verified email.");
  }

  return {
    sub: body.sub,
    email: body.email,
    name: body.name ?? body.email,
    picture: body.picture ?? "",
  };
}

/**
 * Optional allow list, so a personal deployment can be limited to your own
 * Google accounts instead of every Google account in the world.
 */
export function isAllowedEmail(email: string): boolean {
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return allowed.length === 0 || allowed.includes(email.toLowerCase());
}
