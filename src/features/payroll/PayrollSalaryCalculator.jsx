import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useDeferredValue,
  startTransition,
} from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useUser } from "@/contexts/UserContext";
import {
  canConfirmOtPaperwork,
  canConfirmOtPaperworkForEmployee,
  canEditAttendanceForEmployee,
  isAdminAccess,
} from "@/config/authRoles";
import { db, ref, onValue, get, update } from "@/services/firebase";
import {
  parsePayrollDayFromAttendanceRaw,
  reconcilePayrollEmployeesFromBase,
  shallowStringRecordEqual,
} from "@/features/payroll/buildPayrollDayFromRaw";
import {
  pickPayrollEmployeeDayFields,
} from "@/features/payroll/payrollEmployeeFields";
import { payrollTableWrapperMinWidthClass } from "@/features/payroll/payrollTableLayout";
import {
  ATTENDANCE_VIRTUAL_THRESHOLD,
  getAttendanceGridTemplateColumns,
} from "@/features/attendance/attendanceTableRow";
import PayrollSalaryTableRow, {
  PayrollSalaryTableColgroup,
  PayrollSalaryTableThead,
  PayrollSalaryVirtualHeader,
} from "@/features/payroll/payrollSalaryTableUi";
import { useAnnualLeaveBalanceMap } from "@/features/leave/useAnnualLeaveBalanceMap";
import { annualLeaveYearFromDateKey } from "@/features/leave/annualLeaveBalanceLookup";
import { useAttendanceColumnPlan } from "@/features/attendance/useAttendanceBirthDeptColumns";
import {
  ATTENDANCE_DAY_META_KEY,
  ATTENDANCE_DAY_META_EARLY_OT_KEY,
  ATTENDANCE_DAY_META_LATE_OT_KEY,
  normalizeEarlyOtPaperworkMap,
  normalizeLateOtPaperworkMap,
} from "@/features/attendance/attendanceDayMeta";
import AlertMessage from "@/components/ui/AlertMessage";
import HrTablePagination from "@/components/ui/HrTablePagination";
import { useHrTablePagination } from "@/hooks/useHrTablePagination";
import PayrollMonthGridLoadingOverlay from "@/features/payroll/PayrollMonthGridLoadingOverlay";
import PayrollToolsMenu from "@/features/payroll/PayrollToolsMenu";
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
import { businessEmployeeCode } from "@/utils/attendanceEmployeeRecord";
import PayrollRangeExcelExportModal from "@/features/payroll/PayrollRangeExcelExportModal";
import {
  getOvertimeHoursFromGioRa,
  isEarlyArrivalForPaperworkOvertime,
  isNightShiftCaLamViec,
} from "@/features/attendance/attendanceWorkingHours";
import PayrollEarlyOvertimePaperworkModal from "@/features/payroll/PayrollEarlyOvertimePaperworkModal";
import {
  readEarlyOtSessionSuppressed,
  writeEarlyOtSessionSuppressed,
} from "@/features/payroll/payrollEarlyOtSession";
import PayrollMonthlyTimesheetModal from "@/features/payroll/PayrollMonthlyTimesheetModal";
import PayrollMonthlyTimeInOutModal from "@/features/payroll/PayrollMonthlyTimeInOutModal";
import AttendanceHrPageShell from "@/features/attendance/AttendanceHrPageShell";
import "@/features/attendance/attendanceToolbarFocus.css";
import "@/features/attendance/hrPageCompact.css";
import "./payrollTableCompact.css";

const noop = () => {};

function sortEmployeesAscForPopup(rows) {
  return [...rows].sort((a, b) => {
    const aStt = Number(a?.stt);
    const bStt = Number(b?.stt);
    const aSttNorm = Number.isFinite(aStt) ? aStt : Number.POSITIVE_INFINITY;
    const bSttNorm = Number.isFinite(bStt) ? bStt : Number.POSITIVE_INFINITY;
    return aSttNorm - bSttNorm;
  });
}

/**
 * Trang lương: đọc attendance/{ngày} (chỉ xem). Ngày off + ca ngày: giờ quy đổi ở cột TC off.
 * Điểm danh NV: chỉnh sửa chấm công — không hiển thị cột TC off.
 */
export default function PayrollSalaryCalculator() {
  const { t, i18n } = useTranslation();
  const displayLocale = i18n.language?.startsWith("ko") ? "ko-KR" : "vi-VN";
  const { user, userRole, userDepartments } = useUser();
  const canConfirmOt = canConfirmOtPaperwork(user, userRole);

  const canConfirmOtForEmployee = useCallback(
    (employee) =>
      canConfirmOtPaperworkForEmployee({
        user,
        userRole,
        userDepartments,
        employee,
      }),
    [user, userRole, userDepartments],
  );

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
  const annualLeaveYear = annualLeaveYearFromDateKey(selectedDate);
  const {
    balanceByMnv: annualLeaveBalanceByMnv,
    yearData: annualLeaveYearData,
  } = useAnnualLeaveBalanceMap(annualLeaveYear, {
    throughDateKey: selectedDate,
  });
  const [isOffDay, setIsOffDay] = useState(false);
  const [isHolidayDay, setIsHolidayDay] = useState(false);
  const [isCompensatoryDay, setIsCompensatoryDay] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  const [employees, setEmployees] = useState([]);
  const [earlyOtMap, setEarlyOtMap] = useState({});
  const [lateOtExcludedMap, setLateOtExcludedMap] = useState({});
  const [earlyOtModalOpen, setEarlyOtModalOpen] = useState(false);
  const [earlyOtSuppressed, setEarlyOtSuppressed] = useState(false);
  const [earlyOtSessionSuppressed, setEarlyOtSessionSuppressed] = useState(false);
  /** `"pending"` — chỉ NV chưa chọn; `"all"` — tất cả NV đủ điều kiện (mở từ nút toolbar). */
  const [earlyOtModalMode, setEarlyOtModalMode] = useState("pending");
  const [earlyOtSaving, setEarlyOtSaving] = useState(false);
  const [lateOtModalOpen, setLateOtModalOpen] = useState(false);
  const [lateOtModalMode, setLateOtModalMode] = useState("pending");
  const [lateOtSaving, setLateOtSaving] = useState(false);
  const [rangeExportModalOpen, setRangeExportModalOpen] = useState(false);
  const [rangeExportBusy, setRangeExportBusy] = useState(false);
  const [monthlyTimesheetOpen, setMonthlyTimesheetOpen] = useState(false);
  const [monthlyTimeInOutOpen, setMonthlyTimeInOutOpen] = useState(false);
  const [isDayLoading, setIsDayLoading] = useState(false);

  const attendanceRawRef = useRef(undefined);
  const listenGenerationRef = useRef(0);
  const employeesRef = useRef([]);
  const payrollEmployeesRef = useRef([]);

  useEffect(() => {
    employeesRef.current = employees;
  }, [employees]);

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

  const deferredSearchTerm = useDeferredValue(searchTerm);
  const isSearchStale = searchTerm !== deferredSearchTerm;
  const isTableBusy = isDayLoading || isSearchStale;

  useEffect(() => {
    const generation = ++listenGenerationRef.current;
    attendanceRawRef.current = undefined;
    setIsDayLoading(true);
    setEmployees([]);
    setEarlyOtMap({});
    setLateOtExcludedMap({});
    const empRef = ref(db, `attendance/${selectedDate}`);
    const unsubscribe = onValue(empRef, (snapshot) => {
      if (generation !== listenGenerationRef.current) return;

      const data = snapshot.val();
      attendanceRawRef.current = data;

      startTransition(() => {
        const parsed = parsePayrollDayFromAttendanceRaw(
          data,
          employeesRef.current,
          payrollEmployeesRef.current,
        );
        payrollEmployeesRef.current = parsed.payrollEmployees;
        setIsOffDay((prev) =>
          prev === parsed.isOffDay ? prev : parsed.isOffDay,
        );
        setIsHolidayDay((prev) =>
          prev === parsed.isHolidayDay ? prev : parsed.isHolidayDay,
        );
        setIsCompensatoryDay((prev) =>
          prev === parsed.isCompensatoryDay ? prev : parsed.isCompensatoryDay,
        );
        setEarlyOtMap((prev) =>
          shallowStringRecordEqual(prev, parsed.earlyOtPaperworkById)
            ? prev
            : parsed.earlyOtPaperworkById,
        );
        setLateOtExcludedMap((prev) =>
          shallowStringRecordEqual(prev, parsed.lateOtExcludedById)
            ? prev
            : parsed.lateOtExcludedById,
        );
        setEmployees((prevBase) => {
          if (
            parsed.baseEmployees === prevBase ||
            (prevBase.length === parsed.baseEmployees.length &&
              prevBase.every((row, i) => row === parsed.baseEmployees[i]))
          ) {
            return prevBase;
          }
          return parsed.baseEmployees;
        });
        setIsDayLoading(false);
      });
    });
    return () => unsubscribe();
  }, [selectedDate]);

  useEffect(() => {
    setEarlyOtSuppressed(false);
    setEarlyOtModalMode("pending");
    setEarlyOtModalOpen(false);
    setLateOtModalMode("pending");
    setLateOtModalOpen(false);
  }, [selectedDate]);

  useEffect(() => {
    setEarlyOtSessionSuppressed(readEarlyOtSessionSuppressed(user?.uid));
  }, [user?.uid]);

  const mergeOtPaperworkMeta = useCallback(
    async (metaFieldKey, normalizeMap, updates) => {
      const metaRef = ref(
        db,
        `attendance/${selectedDate}/${ATTENDANCE_DAY_META_KEY}`,
      );
      const snap = await get(metaRef);
      const metaVal = snap.val();
      const cur = normalizeMap(
        metaVal && typeof metaVal === "object"
          ? metaVal[metaFieldKey]
          : undefined,
      );
      const next = { ...cur, ...updates };
      await update(metaRef, { [metaFieldKey]: next });
    },
    [selectedDate],
  );

  const mergeEarlyOt = useCallback(
    (updates) =>
      mergeOtPaperworkMeta(
        ATTENDANCE_DAY_META_EARLY_OT_KEY,
        normalizeEarlyOtPaperworkMap,
        updates,
      ),
    [mergeOtPaperworkMeta],
  );

  const mergeLateOt = useCallback(
    (updates) =>
      mergeOtPaperworkMeta(
        ATTENDANCE_DAY_META_LATE_OT_KEY,
        normalizeLateOtPaperworkMap,
        updates,
      ),
    [mergeOtPaperworkMeta],
  );

  const employeesForPayroll = useMemo(() => {
    const next = reconcilePayrollEmployeesFromBase(
      payrollEmployeesRef.current,
      employees,
      earlyOtMap,
      lateOtExcludedMap,
    );
    payrollEmployeesRef.current = next;
    return next;
  }, [employees, earlyOtMap, lateOtExcludedMap]);

  /** Manager chỉ xác nhận TC trong bộ phận; Admin/HR toàn công ty. */
  const otPaperworkScopeEmployees = useMemo(() => {
    if (isAdminAccess(user, userRole)) return employees;
    return employees.filter((e) => canConfirmOtForEmployee(e));
  }, [employees, user, userRole, canConfirmOtForEmployee]);

  const filterOtPaperworkUpdates = useCallback(
    (updates) => {
      if (isAdminAccess(user, userRole)) return updates;
      const out = {};
      for (const [id, val] of Object.entries(updates)) {
        const emp = employees.find((e) => e.id === id);
        if (emp && canConfirmOtForEmployee(emp)) out[id] = val;
      }
      return out;
    },
    [user, userRole, employees, canConfirmOtForEmployee],
  );

  /** Vào sớm (ca ngày ≤ 06:40 / ca đêm 15:00–18:40) — hiện nút «Xác nhận tăng ca». */
  const earlyOtEligibleEmployees = useMemo(
    () =>
      sortEmployeesAscForPopup(
        otPaperworkScopeEmployees.filter((e) => {
          const { timeIn, shiftCode } = pickPayrollEmployeeDayFields(e);
          return isEarlyArrivalForPaperworkOvertime(timeIn, shiftCode);
        }),
      ),
    [otPaperworkScopeEmployees],
  );

  const pendingEarlyOtEmployees = useMemo(
    () => earlyOtEligibleEmployees.filter((e) => !(e.id in earlyOtMap)),
    [earlyOtEligibleEmployees, earlyOtMap],
  );

  /** Ra sau 17:30 (ca ngày) — mặc định vẫn tính TC; popup dùng để đánh dấu KHÔNG tăng ca. */
  const lateOtEligibleEmployees = useMemo(
    () =>
      sortEmployeesAscForPopup(
        otPaperworkScopeEmployees.filter((e) => {
          const { shiftCode, timeOut } = pickPayrollEmployeeDayFields(e);
          if (isNightShiftCaLamViec(shiftCode)) return false;
          const ot = getOvertimeHoursFromGioRa(timeOut);
          return Number.isFinite(ot) && ot > 0;
        }),
      ),
    [otPaperworkScopeEmployees],
  );

  const pendingLateOtEmployees = useMemo(
    () => lateOtEligibleEmployees.filter((e) => !(e.id in lateOtExcludedMap)),
    [lateOtEligibleEmployees, lateOtExcludedMap],
  );

  const lateOtModalRows = useMemo(() => {
    if (lateOtModalMode === "all") return lateOtEligibleEmployees;
    return pendingLateOtEmployees;
  }, [lateOtModalMode, lateOtEligibleEmployees, pendingLateOtEmployees]);

  const lateOtInitialChecked = useCallback(
    (id) => {
      if (lateOtModalMode === "pending") return false;
      return !!lateOtExcludedMap[id];
    },
    [lateOtModalMode, lateOtExcludedMap],
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
    if (isOffDay || isHolidayDay || isCompensatoryDay) {
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
    isCompensatoryDay,
    earlyOtSuppressed,
    earlyOtSessionSuppressed,
    pendingEarlyOtEmployees,
    earlyOtModalOpen,
    earlyOtModalMode,
  ]);

  const openEarlyOtModal = useCallback((mode = "all") => {
    setEarlyOtModalMode(mode);
    setEarlyOtModalOpen(true);
  }, []);

  const openLateOtModal = useCallback((mode = "all") => {
    setLateOtModalMode(mode);
    setLateOtModalOpen(true);
  }, []);

  const handleEarlyOtSave = useCallback(
    async (updates, { suppressSession } = {}) => {
      if (!canConfirmOt) {
        setAlert({
          show: true,
          type: "error",
          message: tlPage(
            "otPaperworkSaveForbidden",
            "Chỉ Admin / HR / quản lý bộ phận được xác nhận tăng ca.",
          ),
        });
        return;
      }
      setEarlyOtSaving(true);
      try {
        await mergeEarlyOt(filterOtPaperworkUpdates(updates));
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
    [canConfirmOt, filterOtPaperworkUpdates, mergeEarlyOt, tlPage, user?.uid],
  );

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

  const handleLateOtSave = useCallback(
    async (updates) => {
      if (!canConfirmOt) {
        setAlert({
          show: true,
          type: "error",
          message: tlPage(
            "otPaperworkSaveForbidden",
            "Chỉ Admin / HR / quản lý bộ phận được xác nhận tăng ca.",
          ),
        });
        return;
      }
      setLateOtSaving(true);
      try {
        await mergeLateOt(filterOtPaperworkUpdates(updates));
        setLateOtModalOpen(false);
        setLateOtModalMode("pending");
      } catch (err) {
        setAlert({
          show: true,
          type: "error",
          message: tlPage(
            "lateOtSaveError",
            "Không lưu được giấy tăng ca (sau 17:30). Kiểm tra kết nối hoặc quyền ghi.",
            { error: err?.message || String(err) },
          ),
        });
      } finally {
        setLateOtSaving(false);
      }
    },
    [canConfirmOt, filterOtPaperworkUpdates, mergeLateOt, tlPage],
  );

  const handleLateOtDismiss = useCallback(() => {
    setLateOtModalOpen(false);
    setLateOtModalMode("pending");
  }, []);

  const filterRows = useCallback(
    (list, term) => {
      const q = term.trim().toLowerCase();
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
    [departmentFilter, normalizeDepartment],
  );

  const filteredEmployees = useMemo(
    () =>
      sortEmployeesAscForPopup(
        filterRows(employeesForPayroll, deferredSearchTerm),
      ),
    [employeesForPayroll, filterRows, deferredSearchTerm],
  );

  const tablePagination = useHrTablePagination(filteredEmployees, {
    resetDeps: [selectedDate, deferredSearchTerm, departmentFilter],
  });

  const pagedEmployees = tablePagination.pagedItems;
  const rowIndexOffset = tablePagination.rowIndexOffset;

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
    pagedEmployees.length > ATTENDANCE_VIRTUAL_THRESHOLD;

  const rowVirtualizer = useVirtualizer({
    count: pagedEmployees.length,
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

  const payrollExportSheetTitle = useMemo(() => {
    const dateStr = new Date(selectedDate).toLocaleDateString(displayLocale);
    const base = tlPage("exportSheetTitle", "Bảng giờ công nhân viên");
    let suffix = "";
    if (isHolidayDay) suffix = ` (${tlPage("exportHolidaySuffix", "Ngày lễ")})`;
    else if (isCompensatoryDay)
      suffix = ` (${tlPage("exportCompensatorySuffix", "Nghỉ bù")})`;
    else if (isOffDay)
      suffix = ` (${tlPage("exportOffDaySuffix", "Ngày off")})`;
    return `${base} — ${dateStr}${suffix}`;
  }, [
    selectedDate,
    isOffDay,
    isHolidayDay,
    isCompensatoryDay,
    displayLocale,
    tlPage,
  ]);

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
            isCompensatoryDay: parsed.isCompensatoryDay,
            earlyOtPaperworkById: parsed.earlyOtPaperworkById,
            lateOtExcludedById: parsed.lateOtExcludedById || {},
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
        isPayrollOffLikeDay: isOffDay || isHolidayDay || isCompensatoryDay,
        isOffDay,
        isHolidayDay,
        isCompensatoryDay,
        tlTable,
        sheetTitle: payrollExportSheetTitle,
        earlyOtPaperworkById: earlyOtMap,
        lateOtExcludedById: lateOtExcludedMap,
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
    isCompensatoryDay,
    tlTable,
    tlPage,
    payrollExportSheetTitle,
    earlyOtMap,
    lateOtExcludedMap,
  ]);

  return (
    <>
      <AttendanceHrPageShell contextDate={selectedDate}>
      <div className="payroll-salary-page hr-page-compact attendance-list-viewport w-full max-w-none">
        <div className="mb-1 shrink-0">
          <div className="w-full border-t-4 border-violet-600 bg-white px-2 py-0.5 shadow-sm dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
            <h1 className="text-sm font-bold uppercase leading-snug tracking-wide text-[#1e293b] md:text-base dark:text-slate-100">
              {tlPage("pageTitle", "Xem giờ công")}
            </h1>
            <p className="mt-0 hidden text-[10px] leading-snug text-gray-600 md:mt-0.5 md:block md:text-[11px]">
              {tlPage(
                "pageSubtitle",
                "Cùng dữ liệu với Điểm danh NV; cột Sửa mở form cập nhật tại đây — lưu Firebase đồng bộ mọi nơi dùng MNV. Công thức lương sẽ bổ sung sau.",
              )}
            </p>
          </div>
        </div>

        <AlertMessage alert={alert} />

        <div className="attendance-toolbar-controls sticky top-0 z-30 mb-1 flex flex-col gap-1 border-b border-slate-200/90 bg-white px-1.5 py-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2 md:px-2 dark:border-slate-700/90 dark:bg-slate-900">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-8 w-full min-w-0 rounded-md border bg-white px-2 text-sm font-semibold text-emerald-700 focus:ring-2 focus:ring-emerald-300 dark:border-slate-600 dark:bg-slate-900 dark:text-emerald-300 sm:w-auto"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={tlPage(
                "searchPlaceholder",
                "Tìm theo tên, MNV, bộ phận…",
              )}
              className="h-8 w-full min-w-0 rounded-md border px-2 text-sm focus:ring-2 focus:ring-emerald-200 sm:w-44"
            />
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="h-8 max-w-full rounded-md border bg-white px-2 text-xs font-medium dark:border-slate-600 dark:bg-slate-900 sm:max-w-[11rem]"
            >
              <option value="">{tlPage("allDepts", "Tất cả bộ phận")}</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-1 sm:w-auto sm:justify-end">
            <PayrollToolsMenu
              tlPage={tlPage}
              t={t}
              onOpenMonthlyTimesheet={() => setMonthlyTimesheetOpen(true)}
              onOpenMonthlyTimeInOut={() => setMonthlyTimeInOutOpen(true)}
              onOpenEarlyOt={() => openEarlyOtModal("all")}
              onOpenLateOt={() => openLateOtModal("all")}
              onExportOneDay={() => void handleExportPayrollExcel()}
              onExportRange={() => setRangeExportModalOpen(true)}
              showEarlyOtAction={earlyOtEligibleEmployees.length > 0}
              showLateOtAction={lateOtEligibleEmployees.length > 0}
            />
          </div>
        </div>
        <div className="payroll-salary-table-compact relative min-w-0 w-full max-w-none overflow-x-auto overscroll-x-contain rounded-md bg-white leading-tight shadow-sm dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
          <PayrollMonthGridLoadingOverlay
            active={isTableBusy}
            message={
              isDayLoading
                ? tlPage("dayDataLoading", "Đang tải dữ liệu...")
                : tlPage("dayDataRendering", "Đang cập nhật bảng…")
            }
          />
          {shouldVirtualizeTable ? (
            <div
              ref={tableScrollParentRef}
              className="payroll-salary-table-scroll max-h-[min(88vh,920px)] w-full min-w-0 max-w-full overflow-y-auto overflow-x-auto overscroll-x-contain"
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
                    const emp = pagedEmployees[virtualRow.index];
                    const idx = rowIndexOffset + virtualRow.index;
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
                        isCompensatoryDay={isCompensatoryDay}
                        annualLeaveBalanceByMnv={annualLeaveBalanceByMnv}
                        annualLeaveYear={annualLeaveYear}
                        annualLeaveYearData={annualLeaveYearData}
                        annualLeaveThroughDateKey={selectedDate}
                        annualLeaveAttendanceRootPath="attendance"
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div
              ref={tableScrollParentRef}
              className="payroll-salary-table-scroll min-w-0 w-full max-w-full overflow-x-auto overscroll-x-contain"
            >
              <table
                className={`w-full max-w-none table-fixed border-collapse ${payrollTableWrapperMinWidthClass(columnPlan, showRowModalActions)}`}
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
                  {pagedEmployees.map((emp, localIdx) => (
                    <PayrollSalaryTableRow
                      key={emp.id}
                      emp={emp}
                      idx={rowIndexOffset + localIdx}
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
                      isCompensatoryDay={isCompensatoryDay}
                      annualLeaveBalanceByMnv={annualLeaveBalanceByMnv}
                      annualLeaveYear={annualLeaveYear}
                      annualLeaveYearData={annualLeaveYearData}
                      annualLeaveThroughDateKey={selectedDate}
                      annualLeaveAttendanceRootPath="attendance"
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <HrTablePagination
          rangeStart={tablePagination.rangeStart}
          rangeEnd={tablePagination.rangeEnd}
          totalItems={tablePagination.totalItems}
          page={tablePagination.page}
          totalPages={tablePagination.totalPages}
          pageNumbers={tablePagination.pageNumbers}
          pageSize={tablePagination.pageSize}
          onPageChange={tablePagination.setPage}
          onPageSizeChange={tablePagination.setPageSize}
        />
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
        dayIsCompensatory={isCompensatoryDay}
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

      <PayrollMonthlyTimeInOutModal
        open={monthlyTimeInOutOpen}
        onClose={() => setMonthlyTimeInOutOpen(false)}
        anchorDateKey={selectedDate}
        displayLocale={displayLocale}
        tlPage={tlPage}
        searchTerm={searchTerm}
        departmentFilter={departmentFilter}
        payrollDepartmentOptions={departments}
        onDepartmentFilterChange={setDepartmentFilter}
        normalizeDepartment={normalizeDepartment}
        user={user}
        userRole={userRole}
        userDepartments={userDepartments}
        onAlert={setAlert}
        employees={employees}
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
        user={user}
        userRole={userRole}
        userDepartments={userDepartments}
        onAlert={setAlert}
        employees={employees}
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
          "Trước 06:00 → 2h (05:40–06:40 + 06:40–07:40); từ 06:00 → 06:40–07:40 (1h). Ca đêm: TC sớm 17:40–18:40 + 18:40–19:40 (max 2h); GC 19:40–05:00 (8h).",
        )}
        saveLabel={tlPage("earlyOtModalSave", "Lưu")}
        selectAllLabel={tlPage("earlyOtModalSelectAll", "Chọn tất cả")}
        skipAllLabel={tlPage("earlyOtModalDeselectAll", "Bỏ chọn tất cả")}
        searchPlaceholder={tlPage(
          "paperworkModalSearchPlaceholder",
          "Lọc theo tên / MNV / bộ phận",
        )}
        departmentPlaceholder={tlPage(
          "paperworkModalDepartmentPlaceholder",
          "Tất cả bộ phận",
        )}
        readOnly={!canConfirmOt}
        showSuppressSession
        suppressSessionLabel={tlPage(
          "earlyOtModalDontShowSession",
          "Không hiển thị trong hôm nay.",
        )}
        viewOnlyHint={tlPage(
          "otPaperworkViewOnlyHint",
          "Chỉ Admin / HR / quản lý bộ phận được tick và lưu. Bạn chỉ xem danh sách và trạng thái hiện tại.",
        )}
      />

      <PayrollEarlyOvertimePaperworkModal
        open={lateOtModalOpen && lateOtModalRows.length > 0}
        rows={lateOtModalRows}
        initialChecked={lateOtInitialChecked}
        onDismiss={handleLateOtDismiss}
        onSave={handleLateOtSave}
        saving={lateOtSaving}
        title={tlPage("lateOtModalTitle", "Xác nhận không tăng ca sau 17:30")}
        description={tlPage(
          "lateOtModalDescription",
          "Mặc định nhân viên có giờ ra sau 17:30 (ca ngày) vẫn được tính tăng ca. Hãy tick những người KHÔNG tính tăng ca.",
        )}
        saveLabel={tlPage("lateOtModalSave", "Lưu")}
        selectAllLabel={tlPage("lateOtModalSelectAll", "Chọn tất cả")}
        skipAllLabel={tlPage("lateOtModalDeselectAll", "Bỏ chọn tất cả")}
        timeLabel={tlPage("timeOutShortLabel", "Ra")}
        timeField="gioRa"
        searchPlaceholder={tlPage(
          "paperworkModalSearchPlaceholder",
          "Lọc theo tên / MNV / bộ phận",
        )}
        departmentPlaceholder={tlPage(
          "paperworkModalDepartmentPlaceholder",
          "Tất cả bộ phận",
        )}
        readOnly={!canConfirmOt}
        viewOnlyHint={tlPage(
          "otPaperworkViewOnlyHint",
          "Chỉ Admin / HR / quản lý bộ phận được tick và lưu. Bạn chỉ xem danh sách và trạng thái hiện tại.",
        )}
      />
      </AttendanceHrPageShell>
    </>
  );
}
