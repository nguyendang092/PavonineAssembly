/** Emails with full access (admin / HR) — single source of truth */
export const ADMIN_OR_HR_EMAILS = [
  "admin@gmail.com",
  "hr@pavonine.net",
];

export function isAdminOrHR(user) {
  if (!user?.email) return false;
  const e = String(user.email).trim().toLowerCase();
  return ADMIN_OR_HR_EMAILS.some(
    (x) => String(x).trim().toLowerCase() === e,
  );
}
