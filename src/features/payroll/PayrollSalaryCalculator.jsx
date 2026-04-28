import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useUser } from "@/contexts/UserContext";
import { canEditAttendanceForEmployee } from "@/config/authRoles";
import { db, ref, onValue, get, update } from "@/services/firebase";
import { parsePayrollDayFromAttendanceRaw } from "@/features/payroll/buildPayrollDayFromRaw";
import { payrollTableWrapperMinWidthClass } from "@/features/payroll/payrollTableLayout";
import {
  readEarlyOtSessionSuppressed,
  writeEarlyOtSessionSuppressed,
} from "@/features/payroll/payrollEarlyOtSession";
import {
  ATTENDANCE_VIRTUAL_THRESHOLD,
  getAttendanceGridTemplateColumns,
} from "@/features/attendance/AttendanceTableRow";
import PayrollSalaryTableRow, {
  PayrollSalaryTableColgroup,
  PayrollSalaryTableThead,
  PayrollSalaryVirtualHeader,
} from "@/features/payroll/payrollSalaryTableUi";
import { useAttendanceColumnPlan } from "@/features/attendance/useAttendanceBirthDeptColumns";
import {
  ATTENDANCE_DAY_META_KEY,
  ATTENDANCE_DAY_META_EARLY_OT_KEY,
  normalizeEarlyOtPaperworkMap,
} from "@/features/attendance/attendanceDayMeta";
import AlertMessage from "@/components/ui/AlertMessage";
import AttendanceEmployeeFormModal from "@/features/attendance/AttendanceEmployeeFormModal";
import {
  buildPayrollSalaryExcelWorkbookMultiDay,
  downloadPayrollSalaryExcel,
  downloadPayrollWorkbookToFile,
  formatPayrollExcelDateCell,
  PAYROLL_EXCEL_MAX_RANGE_DAYS,
} from "@/features/payroll/payrollExcelExport";
import {
  enumerateDateKeysInclusive,
  getTodayDateKeyLocal,
} from "@/utils/dateKey";
import PayrollRangeExcelExportModal from "@/features/payroll/PayrollRangeExcelExportModal";
import { isEarlyArrivalFor0600PaperworkOvertime } from "@/features/attendance/attendanceWorkingHours";
import PayrollEarlyOvertimePaperworkModal from "@/features/payroll/PayrollEarlyOvertimePaperworkModal";
import PayrollMonthlyTimesheetModal from "@/features/payroll/PayrollMonthlyTimesheetModal";
import "./payrollTableCompact.css";

const noop = () => {};

/**
 * Trang lương: đọc attendance/{ngày} (chỉ xem). Ngày off + ca ngày: giờ quy đổi ở cột TC off.
 * Điểm danh NV: chỉnh sửa chấm công — không hiển thị cột TC off.
 */
export default function PayrollSalaryCalculator() {
  const { t, i18n } = useTranslation();
  const displayLocale = i18n.language?.startsWith("ko") ? "ko-KR" : "vi-VN";
  const { user, userRole, userDepartments } = useUser();

  const [alert, setAlert] = useState({ show: false, type: "", message: "" });
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [employeeModalRecord, setEmployeeModalRecord] = useState(null);
  const todayKey = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const d = searchParams.get("date");
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) setSelectedDate(d);
  }, [searchParams]);
  const [isOffDay, setIsOffDay] = useState(false);
  const [isHolidayDay, setIsHolidayDay] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  const [employees, setEmployees] = useState([]);
  const [earlyOtMap, setEarlyOtMap] = useState({});
  const [earlyOtModalOpen, setEarlyOtModalOpen] = useState(false);
  const [earlyOtSuppressed, setEarlyOtSuppressed] = useState(false);
  /** Tự động mở popup: không bật lại khi user đã chọn «không hiển thị trong phiên» (sessionStorage). */
  const [earlyOtSessionSuppressed, setEarlyOtSessionSuppressed] =
    useState(false);
  /** `"pending"` — chỉ NV chưa chọn; `"all"` — tất cả NV đủ điều kiện (sửa lại). */
  const [earlyOtModalMode, setEarlyOtModalMode] = useState("pending");
  const [earlyOtSaving, setEarlyOtSaving] = useState(false);
  const [rangeExportModalOpen, setRangeExportModalOpen] = useState(false);
  const [rangeExportBusy, setRangeExportBusy] = useState(false);
  const [excelExportMenuOpen, setExcelExportMenuOpen] = useState(false);
  const [monthlyTimesheetOpen, setMonthlyTimesheetOpen] = useState(false);

  const attendanceRawRef = useRef(undefined);
  const excelExportMenuRef = useRef(null);

  /** Nhãn bảng: ưu tiên `salaryCalc.table.*`, fallback `attendanceList.*`. */
  const tlTable = useCallback(
    (key, defaultValue, options = {}) =>
      t(`salaryCalc.table.${key}`, {
        defaultValue: t(`attendanceList.${key}`, { defaultValue, ...options }),
        ...options,
      }),
    [t],
  );
  const tlPage = useCallback(
    (key, defaultValue, options = {}) =>
      t(`salaryCalc.${key}`, { defaultValue, ...options }),
    [t],
  );

  const normalizeDepartment = useCallback((value) => {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }, []);

  useEffect(() => {
    attendanceRawRef.current = undefined;
    setEmployees([]);
    setEarlyOtMap({});
    const empRef = ref(db, `attendance/${selectedDate}`);
    const unsubscribe = onValue(empRef, (snapshot) => {
      const data = snapshot.val();
      attendanceRawRef.current = data;
      const parsed = parsePayrollDayFromAttendanceRaw(data);
      setIsOffDay(parsed.isOffDay);
      setIsHolidayDay(parsed.isHolidayDay);
      setEmployees(parsed.baseEmployees);
      setEarlyOtMap(parsed.earlyOtPaperworkById);
    });
    return () => unsubscribe();
  }, [selectedDate]);

  useEffect(() => {
    setEarlyOtSuppressed(false);
    setEarlyOtModalMode("pending");
    setEarlyOtModalOpen(false);
  }, [selectedDate]);

  useEffect(() => {
    setEarlyOtSessionSuppressed(readEarlyOtSessionSuppressed(user?.uid));
  }, [user?.uid]);

  const mergeEarlyOt = useCallback(
    async (updates) => {
      const metaRef = ref(
        db,
        `attendance/${selectedDate}/${ATTENDANCE_DAY_META_KEY}`,
      );
      const snap = await get(metaRef);
      const metaVal = snap.val();
      const cur = normalizeEarlyOtPaperworkMap(
        metaVal && typeof metaVal === "object"
          ? metaVal[ATTENDANCE_DAY_META_EARLY_OT_KEY]
          : undefined,
      );
      const next = { ...cur, ...updates };
      await update(metaRef, { [ATTENDANCE_DAY_META_EARLY_OT_KEY]: next });
    },
    [selectedDate],
  );

  const employeesForPayroll = useMemo(
    () =>
      employees.map((e) => ({
        ...e,
        payrollEarlyOtPaperwork: earlyOtMap[e.id],
      })),
    [employees, earlyOtMap],
  );

  /** Vào ≤ 06:00 (ca ngày) — vẫn hiện nút / modal khi ngày off (chỉ tắt tự mở popup). */
  const earlyOtEligibleEmployees = useMemo(
    () =>
      employees.filter((e) =>
        isEarlyArrivalFor0600PaperworkOvertime(e.gioVao, e.caLamViec),
      ),
    [employees],
  );

  const pendingEarlyOtEmployees = useMemo(
    () => earlyOtEligibleEmployees.filter((e) => !(e.id in earlyOtMap)),
    [earlyOtEligibleEmployees, earlyOtMap],
  );

  const earlyOtModalRows = useMemo(() => {
    if (earlyOtModalMode === "all") return earlyOtEligibleEmployees;
    return pendingEarlyOtEmployees;
  }, [earlyOtModalMode, earlyOtEligibleEmployees, pendingEarlyOtEmployees]);

  const earlyOtInitialChecked = useCallback(
    (id) => {
      if (earlyOtModalMode === "pending") return false;
      return !!earlyOtMap[id];
    },
    [earlyOtModalMode, earlyOtMap],
  );

  useEffect(() => {
    if (earlyOtModalMode === "all") return;
    if (earlyOtSuppressed || earlyOtSessionSuppressed) {
      if (earlyOtModalOpen) setEarlyOtModalOpen(false);
      return;
    }
    if (isOffDay || isHolidayDay) {
      if (earlyOtModalOpen && earlyOtModalMode === "pending") {
        setEarlyOtModalOpen(false);
      }
      return;
    }
    if (pendingEarlyOtEmployees.length > 0) {
      setEarlyOtModalMode("pending");
      setEarlyOtModalOpen(true);
    } else if (earlyOtModalOpen) {
      setEarlyOtModalOpen(false);
    }
  }, [
    isOffDay,
    isHolidayDay,
    earlyOtSuppressed,
    earlyOtSessionSuppressed,
    pendingEarlyOtEmployees,
    earlyOtModalOpen,
    earlyOtModalMode,
  ]);

  const handleEarlyOtSave = useCallback(
    async (updates, { suppressSession } = {}) => {
      setEarlyOtSaving(true);
      try {
        await mergeEarlyOt(updates);
        setEarlyOtModalOpen(false);
        setEarlyOtModalMode("pending");
        setEarlyOtSuppressed(false);
        if (suppressSession) {
          setEarlyOtSessionSuppressed(true);
          writeEarlyOtSessionSuppressed(user?.uid, true);
        }
      } catch (err) {
        setAlert({
          show: true,
          type: "error",
          message: tlPage(
            "earlyOtSaveError",
            "Không lưu được giấy tăng ca lên Firebase. Kiểm tra kết nối hoặc quyền ghi.",
            { error: err?.message || String(err) },
          ),
        });
      } finally {
        setEarlyOtSaving(false);
      }
    },
    [mergeEarlyOt, tlPage, user?.uid],
  );

  /** Đóng / click nền: luôn `suppressed` — tránh effect mở lại ngay (đặc biệt sau khi đóng từ chế độ «tất cả»). */
  const handleEarlyOtDismiss = useCallback(
    ({ suppressSession } = {}) => {
      setEarlyOtModalOpen(false);
      setEarlyOtSuppressed(true);
      setEarlyOtModalMode("pending");
      if (suppressSession) {
        setEarlyOtSessionSuppressed(true);
        writeEarlyOtSessionSuppressed(user?.uid, true);
      }
    },
    [user?.uid],
  );

  const filterRows = useCallback(
    (list) => {
      const q = searchTerm.trim().toLowerCase();
      return list.filter((emp) => {
        const empDeptKey = normalizeDepartment(emp.boPhan);
        const departmentFilterKey = normalizeDepartment(departmentFilter);
        if (departmentFilterKey && empDeptKey !== departmentFilterKey)
          return false;
        if (!q) return true;
        return (
          (emp.hoVaTen || "").toLowerCase().includes(q) ||
          (emp.mnv || "").toLowerCase().includes(q) ||
          (emp.boPhan || "").toLowerCase().includes(q)
        );
      });
    },
    [searchTerm, departmentFilter, normalizeDepartment],
  );

  const filteredEmployees = useMemo(
    () => filterRows(employeesForPayroll),
    [employeesForPayroll, filterRows],
  );

  const departments = useMemo(() => {
    const set = new Set();
    for (const emp of employees) {
      const d = String(emp.boPhan ?? "").trim();
      if (d) set.add(d);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [employees]);

  /** Chỉ ảnh hưởng nút Sửa / mở form — không lọc dòng xem (mọi user đã đăng nhập xem cùng danh sách theo ngày). */
  const canEditEmployeeRow = useCallback(
    (employee) =>
      canEditAttendanceForEmployee({
        user,
        userRole,
        userDepartments,
        employee,
      }),
    [user, userRole, userDepartments],
  );

  /** Cột Sửa — popup cập nhật nhân viên (cùng Firebase với Điểm danh; listener đồng bộ mọi màn). */
  const showRowModalActions = true;

  const handleOpenEditEmployee = useCallback(
    (emp) => {
      if (!user) {
        setAlert({
          show: true,
          type: "error",
          message: t("attendanceList.pleaseLogin"),
        });
        return;
      }
      if (
        !canEditAttendanceForEmployee({
          user,
          userRole,
          userDepartments,
          employee: emp,
        })
      ) {
        setAlert({
          show: true,
          type: "error",
          message: t("attendanceList.error"),
        });
        return;
      }
      setEmployeeModalRecord({ ...emp });
      setShowEmployeeModal(true);
    },
    [user, userRole, userDepartments, t],
  );

  const columnPlan = useAttendanceColumnPlan();
  const attendanceGridTemplateColumns = useMemo(
    () =>
      getAttendanceGridTemplateColumns(
        showRowModalActions,
        columnPlan,
        "payroll",
      ),
    [showRowModalActions, columnPlan],
  );

  const tableScrollParentRef = useRef(null);
  const shouldVirtualizeTable =
    filteredEmployees.length > ATTENDANCE_VIRTUAL_THRESHOLD;

  const rowVirtualizer = useVirtualizer({
    count: filteredEmployees.length,
    getScrollElement: () => tableScrollParentRef.current,
    estimateSize: () => 34,
    overscan: 12,
  });

  useEffect(() => {
    if (alert.show) {
      const timer = setTimeout(() => {
        setAlert((a) => ({ ...a, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show]);

  useEffect(() => {
    if (!excelExportMenuOpen) return;
    const onPointerDown = (e) => {
      const el = excelExportMenuRef.current;
      if (el && !el.contains(e.target)) setExcelExportMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [excelExportMenuOpen]);

  const payrollExportSheetTitle = useMemo(() => {
    const dateStr = new Date(selectedDate).toLocaleDateString(displayLocale);
    const base = tlPage("exportSheetTitle", "Bảng giờ công nhân viên");
    let suffix = "";
    if (isHolidayDay)
      suffix = ` (${tlPage("exportHolidaySuffix", "Ngày lễ")})`;
    else if (isOffDay)
      suffix = ` (${tlPage("exportOffDaySuffix", "Ngày off")})`;
    return `${base} — ${dateStr}${suffix}`;
  }, [selectedDate, isOffDay, isHolidayDay, displayLocale, tlPage]);

  const handleExportPayrollExcelRange = useCallback(
    async (rangeFrom, rangeTo) => {
      const keys = enumerateDateKeysInclusive(rangeFrom, rangeTo);
      if (!keys.length) {
        setAlert({
          show: true,
          type: "error",
          message: tlPage(
            "exportRangeInvalid",
            "Khoảng ngày không hợp lệ hoặc từ ngày lớn hơn đến ngày.",
          ),
        });
        return;
      }
      if (keys.length > PAYROLL_EXCEL_MAX_RANGE_DAYS) {
        setAlert({
          show: true,
          type: "error",
          message: tlPage(
            "exportRangeTooLong",
            "Tối đa 366 ngày mỗi lần xuất. Vui lòng thu hẹp khoảng ngày.",
          ),
        });
        return;
      }
      setRangeExportBusy(true);
      try {
        const dayChunks = [];
        for (const dateKey of keys) {
          const snap = await get(ref(db, `attendance/${dateKey}`));
          const raw = snap.val();
          const parsed = parsePayrollDayFromAttendanceRaw(raw);
          if (!parsed.baseEmployees.length) continue;
          dayChunks.push({
            dateKey,
            employees: parsed.baseEmployees,
            isPayrollOffLikeDay: parsed.isPayrollOffLikeDay,
            isOffDay: parsed.isOffDay,
            isHolidayDay: parsed.isHolidayDay,
            earlyOtPaperworkById: parsed.earlyOtPaperworkById,
          });
        }
        if (!dayChunks.length) {
          setAlert({
            show: true,
            type: "error",
            message: tlPage(
              "exportRangePayrollEmpty",
              "Không có dữ liệu điểm danh trong khoảng ngày đã chọn.",
            ),
          });
          return;
        }
        const fromKey = keys[0];
        const toKey = keys[keys.length - 1];
        const sheetTitle = `${tlPage("exportSheetTitle", "Bảng giờ công nhân viên")} — ${formatPayrollExcelDateCell(fromKey, displayLocale)} – ${formatPayrollExcelDateCell(toKey, displayLocale)}`;
        const workbook = await buildPayrollSalaryExcelWorkbookMultiDay({
          dayChunks,
          tlTable,
          sheetTitle,
        });
        await downloadPayrollWorkbookToFile({
          workbook,
          filename: `Bang-gio-cong_${fromKey}_den_${toKey}.xlsx`,
        });
        const totalRows = dayChunks.reduce((s, d) => s + d.employees.length, 0);
        setAlert({
          show: true,
          type: "success",
          message: tlPage(
            "exportRangeExcelSuccess",
            "✅ Đã xuất Excel (nhiều ngày).",
            {
              days: dayChunks.length,
              rows: totalRows,
            },
          ),
        });
        setRangeExportModalOpen(false);
      } catch (err) {
        setAlert({
          show: true,
          type: "error",
          message: tlPage("exportExcelError", "❌ Xuất Excel thất bại.", {
            error: err?.message || String(err),
          }),
        });
      } finally {
        setRangeExportBusy(false);
      }
    },
    [db, displayLocale, tlPage, tlTable],
  );

  const handleExportPayrollExcel = useCallback(async () => {
    if (!employees.length) {
      setAlert({
        show: true,
        type: "error",
        message: tlPage(
          "exportExcelEmpty",
          "Không có dữ liệu điểm danh trong ngày để xuất.",
        ),
      });
      return;
    }
    try {
      await downloadPayrollSalaryExcel({
        employees,
        selectedDate,
        isPayrollOffLikeDay: isOffDay || isHolidayDay,
        isOffDay,
        isHolidayDay,
        tlTable,
        sheetTitle: payrollExportSheetTitle,
        earlyOtPaperworkById: earlyOtMap,
      });
      setAlert({
        show: true,
        type: "success",
        message: tlPage("exportExcelSuccess", "✅ Đã xuất Excel.", {
          rows: employees.length,
        }),
      });
    } catch (err) {
      setAlert({
        show: true,
        type: "error",
        message: tlPage("exportExcelError", "❌ Xuất Excel thất bại.", {
          error: err?.message || String(err),
        }),
      });
    }
  }, [
    employees,
    selectedDate,
    isOffDay,
    isHolidayDay,
    tlTable,
    tlPage,
    payrollExportSheetTitle,
    earlyOtMap,
  ]);

  return (
    <>
      <div className="p-2 md:p-4 transition-all duration-300">
        <div className="mb-2 md:mb-3">
          <div className="rounded-lg border-t-4 border-violet-600 bg-white px-2.5 py-1.5 shadow-md md:px-3 md:py-2 dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h1 className="text-base font-bold uppercase leading-tight tracking-wide text-[#1e293b] md:text-lg dark:text-slate-100">
                  {tlPage("pageTitle", "Lương — dữ liệu điểm danh")}
                </h1>
                <p className="mt-0.5 text-[11px] leading-snug text-gray-600 md:text-xs">
                  {tlPage(
                    "pageSubtitle",
                    "Cùng dữ liệu với Điểm danh NV; cột Sửa mở form cập nhật tại đây — lưu Firebase đồng bộ mọi nơi dùng MNV. Công thức lương sẽ bổ sung sau.",
                  )}
                </p>
                <p className="mt-0.5 text-[10px] text-gray-500 md:text-[11px]">
                  {tlPage("dateLabel", "Ngày")}:{" "}
                  {new Date(selectedDate).toLocaleDateString(displayLocale)}
                </p>
              </div>
              <Link
                to={`/attendance-list?date=${encodeURIComponent(selectedDate)}`}
                className="mb-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline md:text-xs"
              >
                <span aria-hidden>←</span>
                {tlPage("linkAttendance", "Điểm danh NV")}
              </Link>
            </div>
          </div>
        </div>

        <AlertMessage alert={alert} />

        {/* Khu dự phòng: tính lương (sẽ gắn sau) */}
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-8 w-full shrink-0 rounded-md border bg-white px-2 text-sm font-semibold text-emerald-700 focus:ring-2 focus:ring-emerald-300 dark:border-slate-600 dark:bg-slate-900 dark:text-emerald-300 sm:w-auto"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={tlPage(
                "searchPlaceholder",
                "Tìm theo tên, MNV, bộ phận…",
              )}
              className="h-8 w-full min-w-0 rounded-md border px-2 text-sm focus:ring-2 focus:ring-emerald-200 sm:w-48"
            />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="h-8 max-w-full rounded-md border bg-white px-2 text-xs font-medium dark:border-slate-600 dark:bg-slate-900 sm:max-w-xs"
            >
              <option value="">{tlPage("allDepts", "Tất cả bộ phận")}</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-1.5 sm:w-auto sm:justify-end">
            <button
              type="button"
              onClick={() => setMonthlyTimesheetOpen(true)}
              className="h-8 shrink-0 rounded-lg border-2 border-indigo-500 bg-indigo-50 px-2.5 text-xs font-bold text-indigo-800 shadow-sm transition hover:bg-indigo-100 dark:border-indigo-400/80 dark:bg-indigo-950/50 dark:text-indigo-100 dark:hover:bg-indigo-900/60"
              title={tlPage(
                "monthlyTimesheetButtonHint",
                "Xem lưới điểm danh theo từng ngày trong tháng của ngày đang chọn (cùng bộ lọc tìm / BP).",
              )}
            >
              {tlPage("monthlyTimesheetButton", "Bảng chấm công tháng")}
            </button>
            {earlyOtEligibleEmployees.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setEarlyOtSuppressed(false);
                  setEarlyOtModalMode("all");
                  setEarlyOtModalOpen(true);
                }}
                className="h-8 shrink-0 rounded-lg border-2 border-blue-600/90 bg-gradient-to-b from-sky-500 to-blue-600 px-3 text-xs font-bold text-white shadow-md shadow-sky-600/25 transition hover:from-sky-400 hover:to-blue-500 dark:border-blue-500/80 dark:from-sky-600 dark:to-blue-700 dark:hover:from-sky-500 dark:hover:to-blue-600"
                title={tlPage(
                  "earlyOtPaperworkHint",
                  "Xác nhận có giấy tăng ca khung 06:00–08:00 cho nhân viên vào ≤ 06:00 (ca ngày).",
                )}
              >
                {tlPage("earlyOtPaperworkButton", "Xác nhận tăng ca")}
              </button>
            ) : null}
            <div className="relative" ref={excelExportMenuRef}>
              <button
                type="button"
                aria-expanded={excelExportMenuOpen}
                aria-haspopup="menu"
                onClick={() => setExcelExportMenuOpen((o) => !o)}
                className="h-8 shrink-0 inline-flex items-center gap-1 rounded-lg border-2 border-emerald-600 bg-emerald-600 px-2.5 pr-2 text-xs font-bold text-white shadow-md shadow-emerald-900/20 transition hover:bg-emerald-700 dark:border-emerald-500 dark:hover:bg-emerald-600"
                title={tlPage(
                  "exportExcelMenuHint",
                  "Xuất Excel: một ngày hoặc nhiều ngày.",
                )}
              >
                <span>{tlPage("exportExcelMenu", "⬇ Xuất Excel")}</span>
                <svg
                  className={`h-3.5 w-3.5 shrink-0 opacity-90 transition-transform ${excelExportMenuOpen ? "rotate-180" : ""}`}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {excelExportMenuOpen ? (
                <ul
                  role="menu"
                  className="absolute right-0 top-full z-[120] mt-1 min-w-[14.5rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-left shadow-lg ring-1 ring-black/5 dark:border-slate-600 dark:bg-slate-800 dark:ring-white/10"
                >
                  <li role="none">
                    <button
                      type="button"
                      role="menuitem"
                      title={tlPage(
                        "exportExcelHint",
                        "Xuất toàn bộ nhân viên trong ngày (theo dữ liệu điểm danh), đủ các cột giờ như trên bảng.",
                      )}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-800 hover:bg-emerald-50 dark:text-slate-100 dark:hover:bg-slate-700/80"
                      onClick={() => {
                        setExcelExportMenuOpen(false);
                        void handleExportPayrollExcel();
                      }}
                    >
                      <span
                        aria-hidden
                        className="text-emerald-600 dark:text-emerald-400"
                      >
                        ⬇
                      </span>
                      {tlPage("exportExcelOneDay", "Một ngày (ngày đang chọn)")}
                    </button>
                  </li>
                  <li role="none">
                    <button
                      type="button"
                      role="menuitem"
                      title={tlPage(
                        "exportExcelRangeHint",
                        "Xuất Excel nhiều ngày: chọn từ ngày và đến ngày (mặc định hôm nay).",
                      )}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-slate-800 hover:bg-emerald-50 dark:text-slate-100 dark:hover:bg-slate-700/80"
                      onClick={() => {
                        setExcelExportMenuOpen(false);
                        setRangeExportModalOpen(true);
                      }}
                    >
                      <span
                        aria-hidden
                        className="text-sky-600 dark:text-sky-400"
                      >
                        ⬇
                      </span>
                      {tlPage("exportExcelRange", "Nhiều ngày")}
                    </button>
                  </li>
                </ul>
              ) : null}
            </div>
          </div>
        </div>
        <div className="payroll-salary-table-compact min-w-0 w-full max-w-full overflow-x-auto rounded-lg bg-white text-[10px] leading-tight shadow-lg md:text-[11px] dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
          {shouldVirtualizeTable ? (
            <div
              ref={tableScrollParentRef}
              className="max-h-[min(82vh,900px)] w-full min-w-0 max-w-full overflow-y-auto overflow-x-auto overscroll-x-contain [scrollbar-gutter:stable]"
            >
              <div
                className={`w-full max-w-none ${payrollTableWrapperMinWidthClass(columnPlan, showRowModalActions)}`}
                role="table"
              >
                <PayrollSalaryVirtualHeader
                  tl={tlTable}
                  showRowModalActions={showRowModalActions}
                  gridTemplateColumns={attendanceGridTemplateColumns}
                  canDeleteRow={false}
                  columnPlan={columnPlan}
                />
                <div
                  role="rowgroup"
                  className="w-full"
                  style={{
                    position: "relative",
                    height: `${rowVirtualizer.getTotalSize()}px`,
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const emp = filteredEmployees[virtualRow.index];
                    const idx = virtualRow.index;
                    return (
                      <PayrollSalaryTableRow
                        key={emp.id}
                        emp={emp}
                        idx={idx}
                        virtualRow={virtualRow}
                        showRowModalActions={showRowModalActions}
                        user={user}
                        canEdit={canEditEmployeeRow(emp)}
                        tl={tlTable}
                        t={t}
                        onEdit={handleOpenEditEmployee}
                        onDelete={noop}
                        canDeleteRow={false}
                        measureElementRef={rowVirtualizer.measureElement}
                        gridTemplateColumns={attendanceGridTemplateColumns}
                        columnPlan={columnPlan}
                        isOffDay={isOffDay}
                        isHolidayDay={isHolidayDay}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div
              ref={tableScrollParentRef}
              className="min-w-0 w-full max-w-full overflow-x-auto"
            >
              <table
                className={`w-full table-fixed border-collapse max-w-none ${payrollTableWrapperMinWidthClass(columnPlan, showRowModalActions)}`}
              >
                <PayrollSalaryTableColgroup
                  showRowModalActions={showRowModalActions}
                  columnPlan={columnPlan}
                />
                <PayrollSalaryTableThead
                  tl={tlTable}
                  showRowModalActions={showRowModalActions}
                  stickyHeader={true}
                  canDeleteRow={false}
                  columnPlan={columnPlan}
                />
                <tbody>
                  {filteredEmployees.map((emp, idx) => (
                    <PayrollSalaryTableRow
                      key={emp.id}
                      emp={emp}
                      idx={idx}
                      virtualRow={undefined}
                      showRowModalActions={showRowModalActions}
                      user={user}
                      canEdit={canEditEmployeeRow(emp)}
                      tl={tlTable}
                      t={t}
                      onEdit={handleOpenEditEmployee}
                      onDelete={noop}
                      canDeleteRow={false}
                      columnPlan={columnPlan}
                      isOffDay={isOffDay}
                      isHolidayDay={isHolidayDay}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <AttendanceEmployeeFormModal
        open={showEmployeeModal}
        onClose={() => {
          setShowEmployeeModal(false);
          setEmployeeModalRecord(null);
        }}
        initialRecord={employeeModalRecord}
        selectedDate={selectedDate}
        employees={employees}
        user={user}
        userRole={userRole}
        userDepartments={userDepartments}
        onAlert={setAlert}
      />

      <PayrollRangeExcelExportModal
        open={rangeExportModalOpen}
        onDismiss={() => {
          if (!rangeExportBusy) setRangeExportModalOpen(false);
        }}
        onExport={handleExportPayrollExcelRange}
        todayKey={getTodayDateKeyLocal()}
        exporting={rangeExportBusy}
        title={tlPage("exportRangeModalTitle", "Xuất Excel nhiều ngày")}
        fromLabel={tlPage("exportRangeFrom", "Từ ngày")}
        toLabel={tlPage("exportRangeTo", "Đến ngày")}
        exportLabel={tlPage("exportRangeSubmit", "Xuất Excel")}
        cancelLabel={tlPage("exportRangeCancel", "Hủy")}
      />

      <PayrollMonthlyTimesheetModal
        open={monthlyTimesheetOpen}
        onClose={() => setMonthlyTimesheetOpen(false)}
        anchorDateKey={selectedDate}
        displayLocale={displayLocale}
        tlPage={tlPage}
        searchTerm={searchTerm}
        departmentFilter={departmentFilter}
        payrollDepartmentOptions={departments}
        onDepartmentFilterChange={setDepartmentFilter}
        normalizeDepartment={normalizeDepartment}
      />

      <PayrollEarlyOvertimePaperworkModal
        open={earlyOtModalOpen && earlyOtModalRows.length > 0}
        rows={earlyOtModalRows}
        initialChecked={earlyOtInitialChecked}
        onDismiss={handleEarlyOtDismiss}
        onSave={handleEarlyOtSave}
        saving={earlyOtSaving}
        title={tlPage("earlyOtModalTitle", "Xác nhận đăng ký tăng ca")}
        description={tlPage(
          "earlyOtModalDescription",
          "Nhân viên có thời gian vào <= 06:00 sẽ phải có giấy đăng ký tăng ca để xác nhận là có tăng ca hay không.",
        )}
        saveLabel={tlPage("earlyOtModalSave", "Lưu")}
        skipAllLabel={tlPage(
          "earlyOtModalSkipAll",
          "Tất cả không có giấy tăng ca",
        )}
        suppressSessionLabel={tlPage(
          "earlyOtModalDontShowSession",
          "Không tự hiển thị lại hộp thoại này trong phiên đăng nhập hiện tại",
        )}
      />
    </>
  );
}
