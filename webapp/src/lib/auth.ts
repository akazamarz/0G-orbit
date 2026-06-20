import { createHmac, randomBytes } from "node:crypto";
import { SiweMessage } from "siwe";
import { loadWebappConfig } from "./webapp-config";

const config = loadWebappConfig();

export interface Session {
  wallet: string;
  expiresAt: number;
}

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function generateNonce(): string {
  return randomBytes(16).toString("hex");
}

export function createSiweMessage(wallet: string, nonce: string): string {
  const message = new SiweMessage({
    domain: "localhost",
    address: wallet,
    statement: "Sign in to Orbit",
    uri: "http://localhost:3000",
    version: "1",
    chainId: 16602,
    nonce,
  });
  return message.toMessage();
}

export async function verifySiwe(
  message: string,
  signature: string,
  expectedNonce?: string,
): Promise<string> {
  const siwe = new SiweMessage(message);
  const result = await siwe.verify({ signature, nonce: expectedNonce });
  if (!result.success) {
    const err = result.error;
    throw new Error(err?.type ?? "invalid SIWE signature");
  }
  return siwe.address;
}

function base64UrlEncode(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

function base64UrlDecode<T>(str: string): T {
  return JSON.parse(Buffer.from(str, "base64url").toString("utf8")) as T;
}

function signToken(payload: string): string {
  return createHmac("sha256", config.JWT_SECRET).update(payload).digest("base64url");
}

export function createSessionToken(wallet: string): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = base64UrlEncode({ wallet, expiresAt });
  return `${payload}.${signToken(payload)}`;
}

export function verifySessionToken(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (signToken(payload) !== sig) return null;
  const session = base64UrlDecode<Session>(payload);
  if (session.expiresAt < Date.now()) return null;
  return session;
}

export function getSessionFromCookies(cookieHeader: string | undefined): Session | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/orbit_session=([^;]+)/);
  return match ? verifySessionToken(match[1]) : null;
}

export function getSiweNonceFromCookies(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/orbit_siwe_nonce=([^;]+)/);
  return match?.[1] ?? null;
}
