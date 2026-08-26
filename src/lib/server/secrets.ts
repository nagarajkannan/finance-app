import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

/**
 * Encrypts the one long lived secret this app has to keep — the Google refresh
 * token used to upload exports while nobody is signed in. The key is derived
 * from `AUTH_SECRET`, so a leaked database row is not enough on its own.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const SALT = "my-money-secret-box";

function key(): Buffer {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET is not set — put a long random string in your environment.",
    );
  }
  return scryptSync(secret, SALT, 32);
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);

  return [
    iv.toString("base64url"),
    encrypted.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}

/** Returns null when the value was written with a different `AUTH_SECRET`. */
export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;

  const [iv, payload, tag] = value.split(".");
  if (!iv || !payload || !tag) return null;

  try {
    const decipher = createDecipheriv(
      ALGORITHM,
      key(),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(payload, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
