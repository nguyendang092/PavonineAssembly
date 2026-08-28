export const PERMISSION_ROLE_LEVELS = Object.freeze({
  ADMIN: "admin",
  MANAGER: "manager",
  STAFF: "staff",
  SYSTEM: "system",
});

export const PERMISSION_ROLE_META = Object.freeze({
  admin: {
    labelVi: "Admin / HR",
    color: "#CBA24F",
    dim: "rgba(203, 162, 79, 0.14)",
  },
  manager: {
    labelVi: "Manager",
    color: "#5FBFC0",
    dim: "rgba(95, 191, 192, 0.14)",
  },
  staff: {
    labelVi: "Staff",
    color: "#9C90DD",
    dim: "rgba(156, 144, 221, 0.14)",
  },
  system: {
    labelVi: "Toàn hệ thống",
    color: "#6FA8D6",
    dim: "rgba(111, 168, 214, 0.14)",
  },
});

/** Suy luận cấp quyền chính từ id + helpers — dùng cho vạch màu + chip lọc. */
const MANAGER_LEVEL_IDS = new Set([
  "attendance_list",
  "attendance_form",
  "payroll_month_grid_day_cell",
  "payroll_salary_rows",
]);

export function inferPermissionRoleLevel(entry) {
  if (entry.id === "attendance_dashboard") {
    return PERMISSION_ROLE_LEVELS.SYSTEM;
  }

  if (MANAGER_LEVEL_IDS.has(entry.id)) {
    return PERMISSION_ROLE_LEVELS.MANAGER;
  }

  const helpers = entry.authRolesHelpers.join(" ").toLowerCase();

  if (/canmanage|candelete|isadminaccess|canviewkoreantimesheet/.test(helpers)) {
    return PERMISSION_ROLE_LEVELS.ADMIN;
  }

  if (/canedit|canadd|canconfirm/.test(helpers)) {
    return PERMISSION_ROLE_LEVELS.MANAGER;
  }

  return PERMISSION_ROLE_LEVELS.SYSTEM;
}

export function enrichPermissionCatalogEntry(entry) {
  return {
    ...entry,
    roleLevel: inferPermissionRoleLevel(entry),
  };
}

export function buildPermissionCatalogStats(catalog) {
  const routeSet = new Set();
  const moduleSet = new Set();
  for (const row of catalog) {
    for (const route of row.routes) routeSet.add(route);
    for (const mod of row.modules) moduleSet.add(mod);
  }
  return {
    entries: catalog.length,
    routes: routeSet.size,
    modules: moduleSet.size,
  };
}

/** Tách đường dẫn module catalog thành thư mục + tên file — hiển thị gọn trên UI. */
export function splitModulePath(modulePath) {
  const path = String(modulePath || "");
  const slash = path.lastIndexOf("/");
  if (slash < 0) {
    return { dir: "", name: path };
  }
  return {
    dir: path.slice(0, slash + 1),
    name: path.slice(slash + 1),
  };
}

export function filterPermissionCatalog(catalog, { query = "", roleFilters = [] } = {}) {
  const q = String(query).trim().toLowerCase();
  const activeRoles =
    roleFilters.length > 0 ? new Set(roleFilters) : null;

  return catalog.filter((row) => {
    const enriched = enrichPermissionCatalogEntry(row);
    if (activeRoles && !activeRoles.has(enriched.roleLevel)) return false;
    if (!q) return true;

    const blob = [
      row.id,
      row.labelVi,
      row.quyTac,
      ...row.routes,
      ...row.modules,
      ...row.authRolesHelpers,
      PERMISSION_ROLE_META[enriched.roleLevel]?.labelVi,
    ]
      .join(" ")
      .toLowerCase();
    return blob.includes(q);
  });
}
