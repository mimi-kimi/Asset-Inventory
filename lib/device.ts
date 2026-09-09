/**
 * Simple server-side device detection based on the User-Agent header.
 * Used only for choosing the landing view after login:
 * desktop → /dashboard, mobile → /mobile.
 */
export function isMobileUA(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return /Android|iPhone|iPod|iPad|Opera Mini|IEMobile|WPDesktop|Mobile/i.test(
    ua,
  );
}
