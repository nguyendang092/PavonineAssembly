/**
 * Quy tắc vai trò dùng chung (Admin / HR / Manager / Staff).
 * Ma trận theo **màn hình & chức năng** (route, file, mô tả tiếng Việt): `featurePermissions.js`.
 */
/** Emails with full access (admin / HR) — single source of truth */
export const ADMIN_OR_HR_EMAILS = [
  "admin@gmail.com",
  "hr@pavonine.net",
];

export const ROLES = {
  ADMIN: "admin",
  /** HR (Firebase userDepartments.role): cùng quyền đầy đủ với admin trên điểm danh / xóa toàn bộ ngày */
  HR: "hr",
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
  if (r === ROLES.HR) return ROLES.HR;
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

/** Admin / HR đầy đủ: email {@link ADMIN_OR_HR_EMAILS}, hoặc role Firebase `admin` / `hr`. Manager/Staff: không. */
export function isAdminAccess(user, userRole) {
  if (isAdminOrHR(user)) return true;
  const nr = normalizeRole(userRole);
  return nr === ROLES.ADMIN || nr === ROLES.HR;
}

/**
 * Được thêm / sửa / xóa bảng mapping trong trang Phân quyền User.
 * Chỉ Admin (email hệ thống hoặc role admin trên Firebase) hoặc tài khoản HR trong {@link ADMIN_OR_HR_EMAILS}.
 */
export function canManageUserDepartmentMappings(user, userRole) {
  return isAdminAccess(user, userRole);
}

/** Quản lý phép năm (upload Excel) — Admin / HR. */
export function canManageAnnualLeave(user, userRole) {
  return isAdminAccess(user, userRole);
}

/** Chỉnh ngày off / lễ / nghỉ bù (`attendance/{ngày}/_meta`) — Admin / HR. */
export function canManageAttendanceOffHolidayDays(user, userRole) {
  return isAdminAccess(user, userRole);
}

/**
 * Xóa dòng điểm danh theo ngày:
 * chỉ Admin / HR (xem {@link isAdminAccess}), không cho vai trò manager bộ phận.
 */
export function canDeleteEmployeeData(user, userRole) {
  return isAdminAccess(user, userRole);
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

/**
 * Xác nhận tăng ca sớm / không tăng ca sau 17:30 trên bảng giờ công.
 * Admin/HR hoặc quản lý bộ phận (manager).
 */
export function canConfirmOtPaperwork(user, userRole) {
  if (!user) return false;
  if (isAdminAccess(user, userRole)) return true;
  return normalizeRole(userRole) === ROLES.MANAGER;
}

/**
 * Manager chỉ tick/lưu NV trong bộ phận được gán; Admin/HR mọi NV.
 */
export function canConfirmOtPaperworkForEmployee({
  user,
  userRole,
  userDepartments,
  employee,
}) {
  if (!canConfirmOtPaperwork(user, userRole)) return false;
  if (isAdminAccess(user, userRole)) return true;
  return canEditAttendanceForEmployee({
    user,
    userRole,
    userDepartments,
    employee,
  });
}

/** BP được phép manager chỉnh TC trưa (`tangCaTrua`) trên form điểm danh. */
export const MANAGER_LUNCH_OT_DEPARTMENT_MATCH_KEYS = new Set([
  "anodizing",
  "extrusion",
]);

/**
 * Khóa so khớp BP Anodizing / Extrusion (kể cả `EXTRUCSION`, tiền tố số).
 * @param {unknown} deptRaw
 * @returns {string}
 */
export function managerLunchOtDepartmentMatchKey(deptRaw) {
  const s = String(deptRaw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "");
  if (!s) return "";
  if (s === "extrucsion") return "extrusion";
  const withoutLeadingOrdinal = s.replace(/^\d+/, "");
  if (MANAGER_LUNCH_OT_DEPARTMENT_MATCH_KEYS.has(withoutLeadingOrdinal)) {
    return withoutLeadingOrdinal;
  }
  if (MANAGER_LUNCH_OT_DEPARTMENT_MATCH_KEYS.has(s)) return s;
  return withoutLeadingOrdinal;
}

/** @param {unknown} deptRaw */
export function isManagerLunchOtDepartment(deptRaw) {
  const key = managerLunchOtDepartmentMatchKey(deptRaw);
  return MANAGER_LUNCH_OT_DEPARTMENT_MATCH_KEYS.has(key);
}

/**
 * Chỉnh TC trưa trên form: Admin/HR mọi NV; manager Anodizing / Extrusion — NV cùng BP được gán.
 */
export function canEditLunchOtForEmployee({
  user,
  userRole,
  userDepartments,
  employee,
}) {
  if (!user) return false;
  if (isAdminAccess(user, userRole)) return true;
  if (normalizeRole(userRole) !== ROLES.MANAGER) return false;
  if (
    !canEditAttendanceForEmployee({
      user,
      userRole,
      userDepartments,
      employee,
    })
  ) {
    return false;
  }
  return userDepartments.some((d) => isManagerLunchOtDepartment(d));
}
