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

/**
 * Được thêm / sửa / xóa bảng mapping trong trang Phân quyền User.
 * Chỉ Admin (email hệ thống hoặc role admin trên Firebase) hoặc tài khoản HR trong {@link ADMIN_OR_HR_EMAILS}.
 */
export function canManageUserDepartmentMappings(user, userRole) {
  return isAdminAccess(user, userRole);
}

/**
 * Xóa dòng điểm danh theo ngày hoặc xóa hồ sơ employeeProfiles:
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

/** Đăng thông báo nội bộ: Admin/HR + Manager (sếp bộ phận). */
export function canPostInternalAnnouncements(user, userRole) {
  if (!user?.email) return false;
  if (isAdminAccess(user, userRole)) return true;
  return normalizeRole(userRole) === ROLES.MANAGER;
}

/** Giá trị lưu Firebase: ai được đọc thông báo. */
export const ANNOUNCEMENT_VISIBILITY = {
  /** Mọi người (kể cả chưa đăng nhập) */
  ALL: "all",
  /** Chỉ tài khoản đã đăng nhập */
  AUTH: "auth",
  /** Quản lý bộ phận + Admin/HR */
  MANAGERS: "managers",
  /** Chỉ Admin / HR (email hệ thống hoặc role admin) */
  ADMIN: "admin",
};

/**
 * Người dùng hiện tại có được xem thông báo này không (theo `visibility` trên bản ghi).
 * Bản ghi cũ không có trường → coi như {@link ANNOUNCEMENT_VISIBILITY.ALL}.
 */
export function canViewAnnouncement(user, userRole, visibility) {
  const v =
    visibility == null || String(visibility).trim() === ""
      ? ANNOUNCEMENT_VISIBILITY.ALL
      : String(visibility).trim();
  if (v === ANNOUNCEMENT_VISIBILITY.ALL) return true;
  if (!user?.email) return false;
  if (v === ANNOUNCEMENT_VISIBILITY.AUTH) return true;
  if (v === ANNOUNCEMENT_VISIBILITY.ADMIN) return isAdminAccess(user, userRole);
  if (v === ANNOUNCEMENT_VISIBILITY.MANAGERS) {
    return (
      isAdminAccess(user, userRole) ||
      normalizeRole(userRole) === ROLES.MANAGER
    );
  }
  return false;
}
