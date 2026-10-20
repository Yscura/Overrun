// Accounts: a name and a password, so nobody can play on someone else's profile (or take their name). Kept in the
// profiles (data/progress.json), with the password salted and hashed (scrypt), never in plain text. A login hands
// the browser a token to stay logged in with; only its hash is kept.
//
// Profiles from before accounts have no password yet: whoever logs in to one first sets it (and keeps its progress).

import crypto from 'node:crypto';
import type { Profile } from './profiles';

export interface Auth {
  salt: string;
  hash: string;
  /** Hashes of the login tokens handed out (the newest few: one per browser that stays logged in). */
  tokens: string[];
}

/** Names: 2 to 16 characters (spaces squeezed); passwords at least 4. */
export const ACCOUNT = { minName: 2, maxName: 16, minPassword: 3, maxPassword: 64, tokens: 5 };

const sha = (text: string) => crypto.createHash('sha256').update(text).digest('hex');

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 32).toString('hex');
}

function samePassword(password: string, auth: Auth): boolean {
  const a = Buffer.from(hashPassword(password, auth.salt), 'hex');
  const b = Buffer.from(auth.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** A fresh token for this profile (the oldest one is dropped past ACCOUNT.tokens). */
function newToken(auth: Auth): string {
  const token = crypto.randomBytes(24).toString('hex');
  auth.tokens = [sha(token), ...auth.tokens].slice(0, ACCOUNT.tokens);
  return token;
}

/** The name as typed, tidied up, or null if it can't be one. */
export function cleanName(raw: unknown): string | null {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (name.length < ACCOUNT.minName || name.length > ACCOUNT.maxName) return null;
  // (Bots go by "Name (bot)".)
  if (/\(bot\)$/i.test(name)) return null;
  return name;
}

export type LoginResult = { ok: true; name: string; token: string; created: boolean } | { ok: false; message: string };

/**
 * Logs in with a name and password, or creates the account if the name is new (or claims an old profile that has no
 * password yet). Returns the name as the account has it, and a token to stay logged in with.
 */
export function login(store: Record<string, Profile>, rawName: unknown, rawPassword: unknown): LoginResult {
  const name = cleanName(rawName);
  if (!name) {
    const bot = /\(bot\)\s*$/i.test(String(rawName ?? ''));
    return { ok: false, message: bot ? 'That name is kept for bots.' : `Names are ${ACCOUNT.minName} to ${ACCOUNT.maxName} characters.` };
  }
  const password = String(rawPassword ?? '');
  if (password.length < ACCOUNT.minPassword || password.length > ACCOUNT.maxPassword) {
    return { ok: false, message: `Passwords are at least ${ACCOUNT.minPassword} characters.` };
  }
  const key = name.toLowerCase();
  const existing = store[key];
  if (existing?.auth) {
    if (!samePassword(password, existing.auth)) return { ok: false, message: 'Wrong password for that name.' };
    return { ok: true, name: existing.display ?? name, token: newToken(existing.auth), created: false };
  }
  // A new account, or an old profile claimed: the password is set now.
  const profile = (store[key] ??= { points: 0, ranks: {} });
  const salt = crypto.randomBytes(16).toString('hex');
  profile.auth = { salt, hash: hashPassword(password, salt), tokens: [] };
  profile.display ??= name;
  return { ok: true, name: profile.display, token: newToken(profile.auth), created: !existing };
}

/** Logs back in with a token from an earlier login. */
export function resume(store: Record<string, Profile>, rawName: unknown, rawToken: unknown): LoginResult {
  const profile = store[String(rawName ?? '').trim().toLowerCase()];
  const token = String(rawToken ?? '');
  if (!profile?.auth || !token || !profile.auth.tokens.includes(sha(token))) return { ok: false, message: 'Please log in again.' };
  return { ok: true, name: profile.display ?? String(rawName).trim(), token, created: false };
}

/** Forgets a token (logging out on that browser). */
export function logout(store: Record<string, Profile>, name: string | null, rawToken: unknown): void {
  const auth = name ? store[name.toLowerCase()]?.auth : undefined;
  if (auth) auth.tokens = auth.tokens.filter((t) => t !== sha(String(rawToken ?? '')));
}
