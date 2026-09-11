/**
 * Username-based login helper.
 *
 * Supabase Auth only signs in with an email, so the app hides that detail and
 * signs in with `<username>@<AUTH_EMAIL_DOMAIN>` behind the scenes.
 */
export const AUTH_EMAIL_DOMAIN =
  process.env.NEXT_PUBLIC_AUTH_EMAIL_DOMAIN?.trim() || "assets.local";

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isEmailLike(value: string): boolean {
  return value.includes("@");
}

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${AUTH_EMAIL_DOMAIN}`;
}

/** Accepts either a username or a full email (for legacy admin accounts). */
export function resolveLoginEmail(input: string): string {
  const value = input.trim();
  return isEmailLike(value) ? value.toLowerCase() : usernameToEmail(value);
}

export function isValidUsername(value: string): boolean {
  return /^[a-z0-9._-]{3,32}$/.test(normalizeUsername(value));
}
