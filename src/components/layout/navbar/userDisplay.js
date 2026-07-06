import { isAdminOrHR, normalizeRole, ROLES } from "@/config/authRoles";

function truncateDisplay(str, maxChars) {
  const s = String(str ?? "").trim();
  if (!s) return "";
  const chars = Array.from(s);
  if (chars.length <= maxChars) return s;
  return `${chars.slice(0, Math.max(0, maxChars - 1)).join("")}…`;
}

export function getNavbarUserDisplayName(user) {
  if (!user) return "";
  const name = String(user.name ?? "").trim();
  if (name) return name;
  const email = String(user.email ?? "").trim();
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}

export function getNavbarUserRoleLabel(user, userRole) {
  const role = normalizeRole(userRole);
  if (isAdminOrHR(user) || role === ROLES.ADMIN) return "ADMINISTRATOR";
  if (role === ROLES.HR) return "HR";
  if (role === ROLES.MANAGER) return "MANAGER";
  if (role === ROLES.STAFF) return "STAFF";
  return "USER";
}

export function getNavbarUserDisplayShort(user) {
  if (!user) return "";
  const name = String(user.name ?? "").trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    const piece =
      parts.length >= 2 ? parts[parts.length - 1] : (parts[0] ?? name);
    return truncateDisplay(piece, 10);
  }
  const email = String(user.email ?? "");
  const at = email.indexOf("@");
  const local = at > 0 ? email.slice(0, at) : email;
  return truncateDisplay(local, 12);
}
