/** Emails with full access (admin / HR) — single source of truth */
export const ADMIN_OR_HR_EMAILS = [
  "admin@gmail.com",
  "hr@pavonine.net",
];

export const ROLES = {
  ADMIN: "admin",
  MANAGER: "manager",
  STAFF: "staff",
};

export function isAdminOrHR(user) {
  if (!user?.email) return false;
  const e = String(user.email).trim().toLowerCase();
  return ADMIN_OR_HR_EMAILS.some(
    (x) => String(x).trim().toLowerCase() === e,
  );
}

export function normalizeRole(role) {
  const r = String(role ?? "").trim().toLowerCase();
  if (r === ROLES.ADMIN) return ROLES.ADMIN;
  if (r === ROLES.MANAGER) return ROLES.MANAGER;
  if (r === ROLES.STAFF) return ROLES.STAFF;
  return null;
}

/**
 * Infer role from Firebase mapping when `role` field is missing (legacy rows).
 */
export function inferRoleFromMapping(mapping) {
  if (!mapping || typeof mapping !== "object") return ROLES.STAFF;
  const explicit = normalizeRole(mapping.role);
  if (explicit) return explicit;
  const raw =
    mapping.departments || (mapping.department ? [mapping.department] : []);
  const list = Array.isArray(raw) ? raw : [];
  if (list.length > 0) return ROLES.MANAGER;
  return ROLES.STAFF;
}

/** Full app admin: hardcoded emails or explicit `admin` role in Firebase */
export function isAdminAccess(user, userRole) {
  if (isAdminOrHR(user)) return true;
  return normalizeRole(userRole) === ROLES.ADMIN;
}

export function canEditAttendanceForEmployee({
  user,
  userRole,
  userDepartments,
  employee,
}) {
  if (!user) return false;
  if (isAdminAccess(user, userRole)) return true;
  if (normalizeRole(userRole) === ROLES.STAFF) return false;
  if (!userDepartments?.length || !employee?.boPhan) return false;
  const empDept = String(employee.boPhan).trim().toLowerCase();
  return userDepartments.some(
    (dept) => String(dept || "").trim().toLowerCase() === empDept,
  );
}

export function canAddAttendanceForDepartment({
  user,
  userRole,
  userDepartments,
  boPhan,
}) {
  return canEditAttendanceForEmployee({
    user,
    userRole,
    userDepartments,
    employee: { boPhan },
  });
}
