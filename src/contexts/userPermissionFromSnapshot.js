import { inferRoleFromMapping, isAdminOrHR, ROLES } from "@/config/authRoles";

export function normalizeUserEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

export function departmentsArrayEqual(a, b) {
  if (a === b) return true;
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

export function userPermissionStateEqual(prev, next) {
  return (
    prev?.userRole === next?.userRole &&
    departmentsArrayEqual(prev?.userDepartments, next?.userDepartments)
  );
}

function departmentsFromMapping(mapping) {
  if (!mapping || typeof mapping !== "object") return [];
  const raw = mapping.departments || (mapping.department ? [mapping.department] : []);
  return Array.isArray(raw) ? raw.filter(Boolean) : [];
}

/** Tìm mapping Firebase cho email đăng nhập hiện tại. */
export function findUserDepartmentMapping(data, user) {
  if (!data || typeof data !== "object" || !user?.email) return null;
  const emailNorm = normalizeUserEmail(user.email);
  return (
    Object.values(data).find((mapping) => {
      if (!mapping?.email) return false;
      return normalizeUserEmail(mapping.email) === emailNorm;
    }) ?? null
  );
}

/** Suy ra departments + role từ snapshot userDepartments cho user hiện tại. */
export function resolveUserPermissionFromDepartmentsData(data, user) {
  if (!user?.email) {
    return { userDepartments: [], userRole: null };
  }

  const mapping = findUserDepartmentMapping(data, user);
  if (mapping) {
    const userDepartments = departmentsFromMapping(mapping);
    let userRole = inferRoleFromMapping({ ...mapping, departments: userDepartments });
    if (isAdminOrHR(user)) userRole = ROLES.ADMIN;
    return { userDepartments, userRole };
  }

  return {
    userDepartments: [],
    userRole: isAdminOrHR(user) ? ROLES.ADMIN : ROLES.STAFF,
  };
}
