import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  appBaseUrl,
  DRIVE_SCOPE,
  exchangeCode,
  fetchProfile,
  isAllowedEmail,
} from "@/lib/server/google";
import { encryptSecret } from "@/lib/server/secrets";
import { startSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const OAUTH_COOKIE = "mm_oauth";

function loginError(request: Request, message: string): NextResponse {
  return NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent(message)}`, appBaseUrl(request)),
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const store = await cookies();
  const pending = store.get(OAUTH_COOKIE)?.value;
  store.delete(OAUTH_COOKIE);

  const error = url.searchParams.get("error");
  if (error) return loginError(request, error);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const [expectedState, codeVerifier] = (pending ?? "").split(".");

  if (!code || !state || !expectedState || state !== expectedState) {
    return loginError(request, "The sign-in link expired. Please try again.");
  }

  try {
    const tokens = await exchangeCode({ request, code, codeVerifier });
    const profile = await fetchProfile(tokens.accessToken);

    if (!isAllowedEmail(profile.email)) {
      return loginError(request, "This app is not shared with that account.");
    }

    /* Google only sends a refresh token when Drive access is granted offline;
       without one the exports can only be downloaded, never uploaded. */
    const drive =
      tokens.refreshToken && tokens.scopes.includes(DRIVE_SCOPE)
        ? {
            driveRefreshToken: encryptSecret(tokens.refreshToken),
            driveConnectedAt: new Date(),
          }
        : {};

    const user = await db.user.upsert({
      where: { googleId: profile.sub },
      create: {
        googleId: profile.sub,
        email: profile.email,
        name: profile.name,
        image: profile.picture,
        ...drive,
      },
      update: {
        email: profile.email,
        name: profile.name,
        image: profile.picture,
        lastLoginAt: new Date(),
        ...drive,
      },
    });

    await startSession(user.id);
    return NextResponse.redirect(new URL("/", appBaseUrl(request)));
  } catch (cause) {
    console.error("Google sign-in failed", cause);
    return loginError(
      request,
      cause instanceof Error ? cause.message : "Google sign-in failed.",
    );
  }
}
