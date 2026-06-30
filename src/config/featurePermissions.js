/**
 * Đăng ký quyền theo **chức năng** + hàm kiểm tra có tên rõ.
 *
 * - Quy tắc vai trò cơ bản: {@link ./authRoles.js}
 * - **Quy trình** khi thêm màn hoặc hành động mới:
 *   1. Nếu là luật dùng nhiều nơi → thêm / tái sử dụng hàm trong `authRoles.js`.
 *   2. Nếu gắn một luồng UI cụ thể → thêm `can…` ở đây (gọi `authRoles`) và **một mục** trong `PERMISSION_CATALOG`.
 *   3. Component gọi `can…` từ file này thay vì nhân bài `isAdminAccess && …`.
 *
 * Tra cứu nhanh: đọc `PERMISSION_CATALOG` (bảng mô tả); tìm implementation bằng `modules` / `grep` theo `id`.
 */

import {
  canAddAttendanceForDepartment,
  canEditAttendanceForEmployee,
  canManageAttendanceOffHolidayDays,
  isAdminAccess,
} from "./authRoles";

/** ID ổn định — dùng trong catalog, log, hoặc test (không đổi chuỗi tùy tiện). */
export const PERMISSION_IDS = Object.freeze({
  PAYROLL_MONTH_GRID_DAY_CELL: "payroll_month_grid_day_cell",
  ATTENDANCE_LIST: "attendance_list",
  ATTENDANCE_FORM: "attendance_form",
  ATTENDANCE_DELETE: "attendance_delete",
  ATTENDANCE_OFF_HOLIDAY_DAYS: "attendance_off_holiday_days",
  PAYROLL_SALARY_ROWS: "payroll_salary_rows",
  USER_DEPARTMENT_MAPPING: "user_department_mapping",
  INTERNAL_ANNOUNCEMENTS: "internal_announcements",
  CERTIFICATE_EDIT: "certificate_edit",
  PERFORMANCE_CHART_EDIT: "performance_chart_edit",
  NAVBAR_ADMIN_MENU: "navbar_admin_menu",
  PERMISSION_CATALOG_PAGE: "permission_catalog_page",
});

/**
 * Bảng tra cứu cho dev / PM; hiển thị trên UI tại `/permission-catalog` (Admin/HR).
 *
 * @type {readonly {
 *   id: string,
 *   labelVi: string,
 *   quyTac: string,
 *   routes: string[],
 *   modules: string[],
 *   authRolesHelpers: string[],
 * }[]}
 */
export const PERMISSION_CATALOG = Object.freeze([
  {
    id: PERMISSION_IDS.PAYROLL_MONTH_GRID_DAY_CELL,
    labelVi: "Lưới tháng (bảng lương) — bấm ô ngày mở form điểm danh",
    quyTac:
      "Admin/HR và manager bộ phận: bấm ô ngày để sửa (canEditAttendance / canAddAttendance). Manager: sửa hạn chế qua form (loại phép, ca, nghỉ bù, chế độ NV).",
    routes: ["/attendance-salary"],
    modules: ["features/payroll/PayrollMonthlyTimesheetModal.jsx"],
    authRolesHelpers: [
      "canEditAttendanceForEmployee",
      "canAddAttendanceForDepartment",
    ],
  },
  {
    id: PERMISSION_IDS.ATTENDANCE_LIST,
    labelVi: "Danh sách điểm danh theo ngày — sửa / thao tác danh sách",
    quyTac:
      "Admin/HR: nhiều thao tác đầy đủ. Manager: sửa NV cùng bộ phận. Staff: hạn chế (xem authRoles + AttendanceList).",
    routes: ["/attendance-list"],
    modules: ["features/attendance/AttendanceList.jsx"],
    authRolesHelpers: [
      "isAdminAccess",
      "canEditAttendanceForEmployee",
      "canDeleteEmployeeData",
    ],
  },
  {
    id: PERMISSION_IDS.ATTENDANCE_FORM,
    labelVi: "Form điểm danh nhân viên (modal)",
    quyTac:
      "Lưu theo canEditAttendanceForEmployee; một số trường chỉ Admin/HR (allowFullEdit / isRestrictedEdit).",
    routes: ["/attendance-list", "/attendance-salary", "/seasonal-staff-attendance"],
    modules: ["features/attendance/AttendanceEmployeeFormModal.jsx"],
    authRolesHelpers: [
      "isAdminAccess",
      "canEditAttendanceForEmployee",
    ],
  },
  {
    id: PERMISSION_IDS.ATTENDANCE_DELETE,
    labelVi: "Xóa bản ghi điểm danh / xóa dữ liệu NV (theo luồng app)",
    quyTac: "Chỉ Admin/HR — canDeleteEmployeeData.",
    routes: ["/attendance-list"],
    modules: ["features/attendance/AttendanceList.jsx"],
    authRolesHelpers: ["canDeleteEmployeeData"],
  },
  {
    id: PERMISSION_IDS.ATTENDANCE_OFF_HOLIDAY_DAYS,
    labelVi: "Ngày OFF / LỄ / NGHỈ BÙ — chọn và lưu lịch tháng",
    quyTac: "Chỉ Admin/HR — canManageAttendanceOffHolidayDays.",
    routes: ["/attendance-list", "/seasonal-staff-attendance"],
    modules: [
      "features/attendance/AttendanceListDateOffToolbar.jsx",
      "features/attendance/AttendanceOffDaysModal.jsx",
    ],
    authRolesHelpers: ["canManageAttendanceOffHolidayDays"],
  },
  {
    id: PERMISSION_IDS.PAYROLL_SALARY_ROWS,
    labelVi: "Trang tính lương — chỉnh dòng liên quan điểm danh",
    quyTac:
      "Theo canEditAttendanceForEmployee (phạm vi bộ phận / Admin HR). Xác nhận tăng ca: canConfirmOtPaperwork / canConfirmOtPaperworkForEmployee.",
    routes: ["/attendance-salary"],
    modules: ["features/payroll/PayrollSalaryCalculator.jsx"],
    authRolesHelpers: [
      "canEditAttendanceForEmployee",
      "canConfirmOtPaperwork",
      "canConfirmOtPaperworkForEmployee",
    ],
  },
  {
    id: PERMISSION_IDS.USER_DEPARTMENT_MAPPING,
    labelVi: "Phân quyền user — bộ phận (Firebase mapping)",
    quyTac: "Chỉ Admin/HR — canManageUserDepartmentMappings.",
    routes: ["/user-department"],
    modules: ["features/employee/UserDepartmentManager.jsx"],
    authRolesHelpers: ["canManageUserDepartmentMappings"],
  },
  {
    id: PERMISSION_IDS.INTERNAL_ANNOUNCEMENTS,
    labelVi: "Thông báo nội bộ — đăng / quản trị visibility",
    quyTac:
      "Đăng bài: canPostInternalAnnouncements (Admin/HR + Manager). Xem theo visibility: canViewAnnouncement.",
    routes: ["/", "/email"],
    modules: [
      "features/employee/InternalAnnouncements.jsx",
      "features/employee/InternalAnnouncementsCompose.jsx",
    ],
    authRolesHelpers: [
      "canPostInternalAnnouncements",
      "isAdminAccess",
      "ANNOUNCEMENT_VISIBILITY",
      "canViewAnnouncement",
    ],
  },
  {
    id: PERMISSION_IDS.CERTIFICATE_EDIT,
    labelVi: "Tạo / chỉnh bằng khen (mẫu 1 & 2)",
    quyTac: "Chỉ Admin/HR — isAdminAccess.",
    routes: ["/bangkhen1", "/bangkhen2"],
    modules: [
      "components/ui/CertificateGenerator1.jsx",
      "components/ui/CertificateGenerator2.jsx",
    ],
    authRolesHelpers: ["isAdminAccess"],
  },
  {
    id: PERMISSION_IDS.PERFORMANCE_CHART_EDIT,
    labelVi: "Biểu đồ cải tiến (Performance) — chỉnh dữ liệu",
    quyTac: "Chỉ Admin/HR — isAdminAccess.",
    routes: ["/performance"],
    modules: ["features/dashboard/PerformanceChart.jsx"],
    authRolesHelpers: ["isAdminAccess"],
  },
  {
    id: PERMISSION_IDS.PERMISSION_CATALOG_PAGE,
    labelVi: "Trang tra cứu PERMISSION_CATALOG (nội bộ)",
    quyTac:
      "Chỉ Admin/HR — isAdminAccess; URL /permission-catalog; mục vào trong menu avatar (NavbarUserMenu).",
    routes: ["/permission-catalog"],
    modules: [
      "features/admin/PermissionCatalogPage.jsx",
      "components/layout/navbar/NavbarUserMenu.jsx",
    ],
    authRolesHelpers: ["isAdminAccess"],
  },
  {
    id: PERMISSION_IDS.NAVBAR_ADMIN_MENU,
    labelVi: "Menu điều hướng — nhóm chỉ Admin/HR (vd. bằng khen)",
    quyTac: "Navbar ẩn/hiện theo isAdminAccess; khớp menuConfig.adminOnly (vd. nhóm bằng khen).",
    routes: [],
    modules: ["components/layout/navbar/Navbar.jsx", "config/menuConfig.js"],
    authRolesHelpers: ["isAdminAccess"],
  },
]);

/** In ra console (vd. gọi từ DevTools) để xem catalog dạng bảng. */
export function debugPrintPermissionCatalog() {
  console.table(
    PERMISSION_CATALOG.map((r) => ({
      id: r.id,
      labelVi: r.labelVi,
      routes: r.routes.join(", "),
      modules: r.modules.join(", "),
    })),
  );
}

function payrollMonthTimesheetGridPermEmployee(rep, rowDayEmp) {
  return {
    ...rep,
    ...rowDayEmp,
    boPhan: rowDayEmp.boPhan || rep.boPhan,
  };
}

/**
 * Ô ngày trên lưới tháng (modal bảng lương): mở / sửa form điểm danh.
 * Admin/HR và manager bộ phận — cùng quy tắc {@link canEditAttendanceForEmployee} / {@link canAddAttendanceForDepartment}.
 * @see PERMISSION_IDS.PAYROLL_MONTH_GRID_DAY_CELL
 */
export function canEditPayrollMonthTimesheetGridCell({
  loading,
  user,
  rep,
  rowDayEmp,
  userRole,
  userDepartments,
}) {
  if (loading || !user || !rep) return false;
  if (rowDayEmp) {
    return canEditAttendanceForEmployee({
      user,
      userRole,
      userDepartments,
      employee: payrollMonthTimesheetGridPermEmployee(rep, rowDayEmp),
    });
  }
  return canAddAttendanceForDepartment({
    user,
    userRole,
    userDepartments,
    boPhan: rep.boPhan,
  });
}
