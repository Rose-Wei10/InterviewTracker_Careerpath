import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { HttpError } from "../lib/errors";

export function gmailConfig() {
  const {
    GMAIL_CLIENT_ID,
    GMAIL_CLIENT_SECRET,
    GMAIL_REDIRECT_URI,
    GMAIL_ENCRYPTION_KEY,
  } = process.env;
  if (
    !GMAIL_CLIENT_ID ||
    !GMAIL_CLIENT_SECRET ||
    !GMAIL_REDIRECT_URI ||
    !GMAIL_ENCRYPTION_KEY ||
    !/^[a-f0-9]{64}$/i.test(GMAIL_ENCRYPTION_KEY)
  )
    throw new HttpError(503, "Gmail is not configured on this server.");
  return {
    client_id: GMAIL_CLIENT_ID,
    client_secret: GMAIL_CLIENT_SECRET,
    redirect_uri: GMAIL_REDIRECT_URI,
    key: Buffer.from(GMAIL_ENCRYPTION_KEY, "hex"),
  };
}

export function seal(value: string, owner: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", gmailConfig().key, nonce);
  cipher.setAAD(Buffer.from(owner));
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), body]).toString(
    "base64url",
  );
}

export function unseal(value: string, owner: string) {
  const bytes = Buffer.from(value, "base64url");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    gmailConfig().key,
    bytes.subarray(0, 12),
  );
  cipher.setAAD(Buffer.from(owner));
  cipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([
    cipher.update(bytes.subarray(28)),
    cipher.final(),
  ]).toString("utf8");
}

export async function gmailToken(grant: Record<string, string>) {
  const { client_id, client_secret, redirect_uri } = gmailConfig();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id,
      client_secret,
      redirect_uri,
      ...grant,
    }),
    signal: AbortSignal.timeout(10000),
  });
  const token = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
  };
  if (token.error === "invalid_grant")
    throw new HttpError(
      409,
      "Gmail access expired. Reconnect Gmail and try again.",
    );
  if (!response.ok || !token.access_token)
    throw new HttpError(502, "Google authorization failed. Try again.");
  return { ...token, access_token: token.access_token };
}

export async function gmailGet<T>(
  accessToken: string,
  path: string,
  params?: URLSearchParams,
): Promise<T> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/${path}?${params ?? ""}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000),
    },
  );
  if (response.status === 401)
    throw new HttpError(
      409,
      "Gmail access expired. Reconnect Gmail and try again.",
    );
  if (!response.ok)
    throw new HttpError(
      502,
      "Gmail could not complete the request. Try again.",
    );
  return response.json() as Promise<T>;
}
