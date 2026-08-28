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
  ATTENDANCE_DASHBOARD: "attendance_dashboard",
  ATTENDANCE_FORM: "attendance_form",
  ATTENDANCE_DELETE: "attendance_delete",
  ATTENDANCE_OFF_HOLIDAY_DAYS: "attendance_off_holiday_days",
  PAYROLL_SALARY_ROWS: "payroll_salary_rows",
  USER_DEPARTMENT_MAPPING: "user_department_mapping",
  CERTIFICATE_EDIT: "certificate_edit",
  PERFORMANCE_CHART_EDIT: "performance_chart_edit",
  NAVBAR_ADMIN_MENU: "navbar_admin_menu",
  PERMISSION_CATALOG_PAGE: "permission_catalog_page",
  KOREAN_TIMESHEET: "korean_timesheet",
  ANNUAL_LEAVE: "annual_leave",
});

/**
 * Bảng tra cứu cho dev / PM; hiển thị trên UI tại `/permission-catalog` (Admin/HR).
 *
 * @type {readonly {
 *   id: string,
 *   labelVi: string,
 *   quyTac: string, // Mô tả chức năng / mục đích luồng (hiển thị trên UI)
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
      "Trên trang giờ công, mở lưới tháng theo từng nhân viên; bấm ô từng ngày để sửa giờ vào/ra, loại phép và ca làm việc của ngày đó.",
    routes: ["/attendance-salary"],
    modules: [
      "features/payroll/PayrollMonthlyTimesheetModal.jsx",
      "features/payroll/PayrollMonthlyTimeInOutModal.jsx",
    ],
    authRolesHelpers: [
      "canEditPayrollMonthTimesheetGridCell",
      "canEditAttendanceForEmployee",
      "canAddAttendanceForDepartment",
    ],
  },
  {
    id: PERMISSION_IDS.ATTENDANCE_LIST,
    labelVi: "Danh sách điểm danh theo ngày — sửa / thao tác danh sách",
    quyTac:
      "Danh sách điểm danh theo ngày: xem, lọc, tìm kiếm nhân viên; mở form sửa từng dòng; upload Excel; in và xuất báo cáo.",
    routes: ["/attendance-list"],
    modules: [
      "features/attendance/AttendanceList.jsx",
      "features/attendance/useAttendanceListSetup.js",
      "features/attendance/useAttendanceListMutations.js",
    ],
    authRolesHelpers: [
      "isAdminAccess",
      "canEditAttendanceForEmployee",
      "canDeleteEmployeeData",
    ],
  },
  {
    id: PERMISSION_IDS.ATTENDANCE_DASHBOARD,
    labelVi: "Dashboard điểm danh — xem báo cáo / xuất Excel",
    quyTac:
      "Xem thống kê điểm danh theo kỳ và bộ phận; mở báo cáo ngày chi tiết; xuất Excel và in báo cáo.",
    routes: ["/attendance-dashboard", "/attendance-daily-report"],
    modules: [
      "features/attendance/AttendanceDashboardPage.jsx",
      "features/attendance/AttendanceDailyReportPage.jsx",
      "features/attendance/useAttendanceDashboardData.js",
      "features/attendance/useAttendanceDailyReportData.js",
      "features/attendance/AttendanceListShell.jsx",
    ],
    authRolesHelpers: [
      "canViewAttendanceDashboard",
      "canExportAttendanceDashboard",
      "canPrintAttendanceDashboardReport",
    ],
  },
  {
    id: PERMISSION_IDS.ATTENDANCE_FORM,
    labelVi: "Form điểm danh nhân viên (modal)",
    quyTac:
      "Modal nhập và sửa điểm danh một nhân viên trong ngày: giờ vào/ra, loại phép, ca, nghỉ bù, ghi chú; lưu Firebase và đồng bộ phép năm khi có PN.",
    routes: ["/attendance-list", "/attendance-salary", "/seasonal-staff-attendance"],
    modules: [
      "features/attendance/AttendanceEmployeeFormModal.jsx",
      "utils/attendanceEmployeeRecord.js",
      "config/annualLeaveClientSync.js",
      "features/leave/annualLeaveClientDaySync.js",
    ],
    authRolesHelpers: [
      "isAdminAccess",
      "canEditAttendanceForEmployee",
    ],
  },
  {
    id: PERMISSION_IDS.ATTENDANCE_DELETE,
    labelVi: "Xóa bản ghi điểm danh / xóa dữ liệu NV (theo luồng app)",
    quyTac:
      "Xóa toàn bộ bản ghi điểm danh của một nhân viên trong ngày đang chọn.",
    routes: ["/attendance-list"],
    modules: [
      "features/attendance/AttendanceList.jsx",
      "features/attendance/useAttendanceListMutations.js",
      "features/attendance/useAttendanceListSetup.js",
    ],
    authRolesHelpers: ["canDeleteEmployeeData"],
  },
  {
    id: PERMISSION_IDS.ATTENDANCE_OFF_HOLIDAY_DAYS,
    labelVi: "Ngày OFF / LỄ / NGHỈ BÙ — chọn và lưu lịch tháng",
    quyTac:
      "Thiết lập lịch tháng: đánh dấu ngày OFF công ty, ngày lễ và ngày nghỉ bù — áp dụng chung cho bảng điểm danh và giờ công.",
    routes: [
      "/attendance-list",
      "/seasonal-staff-attendance",
      "/attendance-salary",
    ],
    modules: [
      "features/attendance/AttendanceListDateOffToolbar.jsx",
      "features/attendance/AttendanceOffDaysModal.jsx",
      "features/attendance/AttendanceOffHolidayDaysControl.jsx",
      "features/payroll/PayrollSalaryCalculator.jsx",
      "features/payroll/PayrollMonthlyTimesheetModal.jsx",
    ],
    authRolesHelpers: ["canManageAttendanceOffHolidayDays"],
  },
  {
    id: PERMISSION_IDS.PAYROLL_SALARY_ROWS,
    labelVi: "Trang tính lương — chỉnh dòng liên quan điểm danh",
    quyTac:
      "Trang tính lương/giờ công: xem bảng nhân viên theo tháng, chỉnh thông tin chấm công trên từng dòng và xác nhận giấy tờ tăng ca (OT).",
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
    quyTac:
      "Gán tài khoản đăng nhập với bộ phận và quyền manager trên Firebase — dùng cho phân quyền theo bộ phận trong HR.",
    routes: ["/user-department"],
    modules: ["features/employee/UserDepartmentManager.jsx"],
    authRolesHelpers: ["canManageUserDepartmentMappings"],
  },
  {
    id: PERMISSION_IDS.CERTIFICATE_EDIT,
    labelVi: "Tạo / chỉnh bằng khen (mẫu 1 & 2)",
    quyTac: "Tạo và chỉnh nội dung bằng khen mẫu 1 và mẫu 2 (xuất/in certificate).",
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
    quyTac:
      "Biểu đồ cải tiến sản xuất: xem và cập nhật dữ liệu performance trên dashboard.",
    routes: ["/performance"],
    modules: ["features/dashboard/PerformanceChart.jsx"],
    authRolesHelpers: ["isAdminAccess"],
  },
  {
    id: PERMISSION_IDS.PERMISSION_CATALOG_PAGE,
    labelVi: "Trang tra cứu PERMISSION_CATALOG (nội bộ)",
    quyTac:
      "Trang nội bộ tra cứu quyền, route, module và helper — hỗ trợ dev/HR khi thêm màn hoặc đổi phân quyền.",
    routes: ["/permission-catalog"],
    modules: [
      "features/admin/PermissionCatalogPage.jsx",
      "features/admin/PermissionCatalogCard.jsx",
      "features/admin/permissionCatalogUtils.js",
      "components/layout/navbar/NavbarUserMenu.jsx",
    ],
    authRolesHelpers: ["isAdminAccess"],
  },
  {
    id: PERMISSION_IDS.NAVBAR_ADMIN_MENU,
    labelVi: "Menu điều hướng — nhóm chỉ Admin/HR (vd. bằng khen)",
    quyTac:
      "Ẩn/hiện các nhóm menu navbar chỉ dành Admin/HR (ví dụ nhóm bằng khen), theo cấu hình menuConfig.",
    routes: [],
    modules: ["components/layout/navbar/Navbar.jsx", "config/menuConfig.js"],
    authRolesHelpers: ["isAdminAccess"],
  },
  {
    id: PERMISSION_IDS.KOREAN_TIMESHEET,
    labelVi: "Korean Timesheet — điểm danh nhân viên Hàn",
    quyTac:
      "Điểm danh riêng cho nhân viên Hàn Quốc — giao diện và luồng tương tự danh sách điểm danh nhưng tách route.",
    routes: ["/korean-timesheet"],
    modules: [
      "features/attendance/KoreanTimesheetPage.jsx",
      "features/attendance/AttendanceListShell.jsx",
    ],
    authRolesHelpers: ["isAdminAccess", "canViewKoreanTimesheet"],
  },
  {
    id: PERMISSION_IDS.ANNUAL_LEAVE,
    labelVi: "Quản lý phép năm — xem / upload / đồng bộ / điều chỉnh HR",
    quyTac:
      "Bảng phép năm theo năm và nhân viên: xem tồn phép, dùng phép từng tháng; upload Excel, tính lại từ điểm danh, điều chỉnh HR và xóa dữ liệu năm.",
    routes: ["/annual-leave"],
    modules: [
      "features/leave/AnnualLeaveManager.jsx",
      "features/leave/AnnualLeaveManagerTablePanel.jsx",
      "features/leave/annualLeaveAttendanceSync.js",
      "features/leave/annualLeaveClientDaySync.js",
      "config/annualLeaveClientSync.js",
    ],
    authRolesHelpers: ["canManageAnnualLeave"],
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

/** Korean Timesheet — chỉ Admin / HR xem và thao tác. */
export function canViewKoreanTimesheet(user, userRole) {
  return isAdminAccess(user, userRole);
}

/** Dashboard điểm danh — mọi user đã đăng nhập, không phân quyền theo vai trò/bộ phận. */
export function canViewAttendanceDashboard(user) {
  return Boolean(user?.email);
}

export function canExportAttendanceDashboard(user) {
  return canViewAttendanceDashboard(user);
}

export function canPrintAttendanceDashboardReport(user) {
  return canViewAttendanceDashboard(user);
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
