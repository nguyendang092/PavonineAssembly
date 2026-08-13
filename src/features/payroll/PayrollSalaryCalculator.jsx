import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useDeferredValue,
  startTransition,
  lazy,
  Suspense,
} from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUser } from "@/contexts/UserContext";
import {
  canConfirmOtPaperwork,
  canConfirmOtPaperworkForEmployee,
  canEditAttendanceForEmployee,
  isAdminAccess,
} from "@/config/authRoles";
import { db, ref, onValue, update } from "@/services/firebase";
import {
  parsePayrollDayFromAttendanceRaw,
  reconcilePayrollEmployeesFromBase,
  shallowStringRecordEqual,
} from "@/features/payroll/buildPayrollDayFromRaw";
import {
  pickPayrollEmployeeDayFields,
} from "@/features/payroll/payrollEmployeeFields";
import { payrollTableWrapperMinWidthClass } from "@/features/payroll/payrollTableLayout";
import PayrollSalaryTableRow, {
  PayrollSalaryTableColgroup,
  PayrollSalaryTableThead,
} from "@/features/payroll/payrollSalaryTableUi";
import { useAnnualLeaveBalanceMap } from "@/features/leave/useAnnualLeaveBalanceMap";
import { annualLeaveEmpFirebaseKey } from "@/features/leave/annualLeaveEmpKey";
import {
  annualLeaveYearFromDateKey,
  getDisplayAnnualLeaveBalanceForAttendance,
} from "@/features/leave/annualLeaveBalanceLookup";
import { useAttendanceColumnPlan } from "@/features/attendance/useAttendanceBirthDeptColumns";
import {
  ATTENDANCE_DAY_META_KEY,
  ATTENDANCE_DAY_META_EARLY_OT_KEY,
  ATTENDANCE_DAY_META_LATE_OT_KEY,
  ATTENDANCE_DAY_META_NIGHT_OT_KEY,
  normalizeEarlyOtPaperworkMap,
  normalizeLateOtPaperworkMap,
  normalizeNightOtPaperworkMap,
} from "@/features/attendance/attendanceDayMeta";
import AlertMessage from "@/components/ui/AlertMessage";
import HrTablePagination from "@/components/ui/HrTablePagination";
import { useHrTablePagination } from "@/hooks/useHrTablePagination";
import PayrollMonthGridLoadingOverlay from "@/features/payroll/PayrollMonthGridLoadingOverlay";
import PayrollToolsMenu from "@/features/payroll/PayrollToolsMenu";
import AttendanceOffHolidayDaysControl from "@/features/attendance/AttendanceOffHolidayDaysControl";
import { getTodayDateKeyLocal } from "@/utils/dateKey";
import { executePayrollSalaryExcelExportRange } from "@/features/payroll/payrollSalaryExcelExportRange";
import {
  getOvertimeHoursFromGioRa,
  isEarlyArrivalForPaperworkOvertime,
  isNightOtPaperworkEligible,
  isNightShiftCaLamViec,
} from "@/features/attendance/attendanceWorkingHours";
import { filterPayrollEmployeesForTimesheetExport } from "@/features/payroll/payrollTimesheetExportFilters";
import {
  readEarlyOtSessionSuppressed,
  writeEarlyOtSessionSuppressed,
} from "@/features/payroll/payrollEarlyOtSession";
import {
  PAYROLL_TIMESHEET_PRESENCE_FILTER,
  PAYROLL_SHORT_HOURS_FILTER,
} from "@/features/payroll/attendanceDayPresenceFilters";
import AttendanceHrPageShell from "@/features/attendance/AttendanceHrPageShell";
import "@/features/attendance/attendanceToolbarFocus.css";
import "@/features/attendance/hrPageCompact.css";
import "./payrollTableCompact.css";
import "./payrollSalaryPage.css";

const AttendanceEmployeeFormModal = lazy(
  () => import("@/features/attendance/AttendanceEmployeeFormModal"),
);
const PayrollRangeExcelExportModal = lazy(
  () => import("@/features/payroll/PayrollRangeExcelExportModal"),
);
const PayrollEarlyOvertimePaperworkModal = lazy(
  () => import("@/features/payroll/PayrollEarlyOvertimePaperworkModal"),
);
const PayrollMonthlyTimesheetModal = lazy(
  () => import("@/features/payroll/PayrollMonthlyTimesheetModal"),
);
const PayrollMonthlyTimeInOutModal = lazy(
  () => import("@/features/payroll/PayrollMonthlyTimeInOutModal"),
);

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

  useEffect(() => {
    setWorkHoursFilter(PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL);
    setLeaveTypeFilter(PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL);
    setOvertimeFilter(PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL);
    setShortHoursFilter(PAYROLL_SHORT_HOURS_FILTER.ALL);
  }, [selectedDate]);
  const annualLeaveYear = annualLeaveYearFromDateKey(selectedDate);

  const [isOffDay, setIsOffDay] = useState(false);
  const [isHolidayDay, setIsHolidayDay] = useState(false);
  const [isCompensatoryDay, setIsCompensatoryDay] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [workHoursFilter, setWorkHoursFilter] = useState(
    PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
  );
  const [leaveTypeFilter, setLeaveTypeFilter] = useState(
    PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
  );
  const [overtimeFilter, setOvertimeFilter] = useState(
    PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
  );
  const [shortHoursFilter, setShortHoursFilter] = useState(
    PAYROLL_SHORT_HOURS_FILTER.ALL,
  );

  const [employees, setEmployees] = useState([]);
  const [earlyOtMap, setEarlyOtMap] = useState({});
  const [lateOtExcludedMap, setLateOtExcludedMap] = useState({});
  const [nightOtMap, setNightOtMap] = useState({});
  const [earlyOtModalOpen, setEarlyOtModalOpen] = useState(false);
  const [earlyOtSuppressed, setEarlyOtSuppressed] = useState(false);
  const [earlyOtSessionSuppressed, setEarlyOtSessionSuppressed] = useState(false);
  /** `"pending"` — chỉ NV chưa chọn; `"all"` — tất cả NV đủ điều kiện (mở từ nút toolbar). */
  const [earlyOtModalMode, setEarlyOtModalMode] = useState("pending");
  const [earlyOtSaving, setEarlyOtSaving] = useState(false);
  const [lateOtModalOpen, setLateOtModalOpen] = useState(false);
  const [nightOtModalOpen, setNightOtModalOpen] = useState(false);
  const [nightOtSaving, setNightOtSaving] = useState(false);
  const [lateOtModalMode, setLateOtModalMode] = useState("pending");
  const [lateOtSaving, setLateOtSaving] = useState(false);
  const [rangeExportModalOpen, setRangeExportModalOpen] = useState(false);
  const [exportModalMode, setExportModalMode] = useState("range");
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
  const tlAttendance = useCallback(
    (key, defaultValue, options = {}) =>
      t(`attendanceList.${key}`, { defaultValue, ...options }),
    [t],
  );

  const normalizeDepartment = useCallback((value) => {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }, []);

  const deferredSearchTerm = useDeferredValue(searchTerm);
  const deferredDepartmentFilter = useDeferredValue(departmentFilter);
  const deferredWorkHoursFilter = useDeferredValue(workHoursFilter);
  const deferredLeaveTypeFilter = useDeferredValue(leaveTypeFilter);
  const deferredOvertimeFilter = useDeferredValue(overtimeFilter);
  const deferredShortHoursFilter = useDeferredValue(shortHoursFilter);
  const isSearchStale = searchTerm !== deferredSearchTerm;
  const filtersPending =
    isSearchStale ||
    departmentFilter !== deferredDepartmentFilter ||
    workHoursFilter !== deferredWorkHoursFilter ||
    leaveTypeFilter !== deferredLeaveTypeFilter ||
    overtimeFilter !== deferredOvertimeFilter ||
    shortHoursFilter !== deferredShortHoursFilter;
  const isTableBusy = isDayLoading || filtersPending;

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
        setNightOtMap((prev) =>
          shallowStringRecordEqual(prev, parsed.nightOtPaperworkById)
            ? prev
            : parsed.nightOtPaperworkById,
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
    setNightOtModalOpen(false);
  }, [selectedDate]);

  useEffect(() => {
    setEarlyOtSessionSuppressed(readEarlyOtSessionSuppressed(user?.uid));
  }, [user?.uid]);

  const mergeOtPaperworkMeta = useCallback(
    async (metaFieldKey, normalizeMap, updates, localMap) => {
      const metaRef = ref(
        db,
        `attendance/${selectedDate}/${ATTENDANCE_DAY_META_KEY}`,
      );
      const cur = normalizeMap(localMap ?? {});
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
        earlyOtMap,
      ),
    [mergeOtPaperworkMeta, earlyOtMap],
  );

  const mergeLateOt = useCallback(
    (updates) =>
      mergeOtPaperworkMeta(
        ATTENDANCE_DAY_META_LATE_OT_KEY,
        normalizeLateOtPaperworkMap,
        updates,
        lateOtExcludedMap,
      ),
    [mergeOtPaperworkMeta, lateOtExcludedMap],
  );

  const mergeNightOt = useCallback(
    (updates) =>
      mergeOtPaperworkMeta(
        ATTENDANCE_DAY_META_NIGHT_OT_KEY,
        normalizeNightOtPaperworkMap,
        updates,
        nightOtMap,
      ),
    [mergeOtPaperworkMeta, nightOtMap],
  );

  const employeesForPayroll = useMemo(
    () =>
      reconcilePayrollEmployeesFromBase(
        payrollEmployeesRef.current,
        employees,
        earlyOtMap,
        lateOtExcludedMap,
        nightOtMap,
      ),
    [employees, earlyOtMap, lateOtExcludedMap, nightOtMap],
  );

  useEffect(() => {
    payrollEmployeesRef.current = employeesForPayroll;
  }, [employeesForPayroll]);

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

  /** Giờ vào 22:00–05:00 — xác nhận hệ số ×2.7. */
  const nightOtEligibleEmployees = useMemo(
    () =>
      sortEmployeesAscForPopup(
        otPaperworkScopeEmployees.filter((e) => {
          const { timeIn } = pickPayrollEmployeeDayFields(e);
          return isNightOtPaperworkEligible(timeIn);
        }),
      ),
    [otPaperworkScopeEmployees],
  );

  const nightOtInitialChecked = useCallback(
    (id) => !!nightOtMap[id],
    [nightOtMap],
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

  const openNightOtModal = useCallback(() => {
    setNightOtModalOpen(true);
  }, []);

  const handleNightOtSave = useCallback(
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
      setNightOtSaving(true);
      try {
        await mergeNightOt(filterOtPaperworkUpdates(updates));
        setNightOtModalOpen(false);
      } catch (err) {
        setAlert({
          show: true,
          type: "error",
          message: tlPage(
            "nightOtSaveError",
            "Không lưu được xác nhận tăng ca đêm. Kiểm tra kết nối hoặc quyền ghi.",
            { error: err?.message || String(err) },
          ),
        });
      } finally {
        setNightOtSaving(false);
      }
    },
    [canConfirmOt, filterOtPaperworkUpdates, mergeNightOt, tlPage],
  );

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
    (list, term) =>
      filterPayrollEmployeesForTimesheetExport(list, {
        searchTerm: term,
        departmentFilter: deferredDepartmentFilter,
        workHoursFilter: deferredWorkHoursFilter,
        leaveTypeFilter: deferredLeaveTypeFilter,
        overtimeFilter: deferredOvertimeFilter,
        shortHoursFilter: deferredShortHoursFilter,
        normalizeDepartment,
        dayCtx: {
          isOffDay,
          isHolidayDay,
          isCompensatoryDay,
          dateKey: selectedDate,
        },
        earlyOtPaperworkById: earlyOtMap,
        lateOtExcludedById: lateOtExcludedMap,
        nightOtPaperworkById: nightOtMap,
      }),
    [
      deferredDepartmentFilter,
      deferredWorkHoursFilter,
      deferredLeaveTypeFilter,
      deferredOvertimeFilter,
      deferredShortHoursFilter,
      earlyOtMap,
      isCompensatoryDay,
      isHolidayDay,
      isOffDay,
      lateOtExcludedMap,
      nightOtMap,
      normalizeDepartment,
      selectedDate,
    ],
  );

  const filteredEmployees = useMemo(
    () =>
      sortEmployeesAscForPopup(
        filterRows(employeesForPayroll, deferredSearchTerm),
      ),
    [employeesForPayroll, filterRows, deferredSearchTerm],
  );

  const tablePagination = useHrTablePagination(filteredEmployees, {
    resetDeps: [
      selectedDate,
      deferredSearchTerm,
      deferredDepartmentFilter,
      deferredWorkHoursFilter,
      deferredLeaveTypeFilter,
      deferredOvertimeFilter,
      deferredShortHoursFilter,
    ],
  });

  const pagedEmployees = tablePagination.pagedItems;
  const tableRowIndexOffset = tablePagination.rowIndexOffset;

  const annualLeaveScopeEmpKeys = useMemo(
    () =>
      pagedEmployees
        .map((emp) => annualLeaveEmpFirebaseKey(emp.mnv))
        .filter(Boolean),
    [pagedEmployees],
  );

  const {
    balanceByMnv: annualLeaveBalanceByMnv,
  } = useAnnualLeaveBalanceMap(annualLeaveYear, {
    throughDateKey: selectedDate,
    scopeEmpKeys: annualLeaveScopeEmpKeys,
  });

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

  const otPaperworkDateLabel = useMemo(() => {
    const date = new Date(`${selectedDate}T12:00:00`);
    return date.toLocaleDateString(displayLocale, {
      weekday: "long",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }, [selectedDate, displayLocale]);

  const otPaperworkDateCaption = tlPage(
    "paperworkModalDateCaption",
    "Ngày chấm công",
  );

  const handleExportPayrollExcelFromModal = useCallback(
    async (rangeFrom, rangeTo, selectedDepartments) => {
      setRangeExportBusy(true);
      try {
        const result = await executePayrollSalaryExcelExportRange({
          rangeFrom,
          rangeTo,
          selectedDepartments,
          selectedDate,
          currentDayEmployees: employeesForPayroll,
          currentDayMeta: {
            isOffDay,
            isHolidayDay,
            isCompensatoryDay,
            earlyOtPaperworkById: earlyOtMap,
            lateOtExcludedById: lateOtExcludedMap,
            nightOtPaperworkById: nightOtMap,
          },
          toolbarFilters: {
            searchTerm,
            departmentFilter,
            workHoursFilter,
            leaveTypeFilter,
            overtimeFilter,
            shortHoursFilter,
          },
          db,
          ref,
          get,
          displayLocale,
          tlPage,
          tlTable,
          normalizeDepartment,
          singleDaySheetTitle:
            rangeFrom === rangeTo && rangeFrom === selectedDate
              ? payrollExportSheetTitle
              : null,
        });
        setAlert({ show: true, ...result.alert });
        if (result.ok) setRangeExportModalOpen(false);
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
    [
      db,
      displayLocale,
      tlPage,
      tlTable,
      selectedDate,
      employeesForPayroll,
      isOffDay,
      isHolidayDay,
      isCompensatoryDay,
      earlyOtMap,
      lateOtExcludedMap,
      nightOtMap,
      normalizeDepartment,
      payrollExportSheetTitle,
      searchTerm,
      departmentFilter,
      workHoursFilter,
      leaveTypeFilter,
      overtimeFilter,
      shortHoursFilter,
    ],
  );

  return (
    <>
      <AttendanceHrPageShell contextDate={selectedDate}>
      <div className="payroll-salary-page payroll-salary-page-viewport hr-page-viewport hr-page-compact attendance-list-viewport w-full max-w-none">
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

        <AlertMessage
          alert={alert}
          onClose={() => setAlert((a) => ({ ...a, show: false }))}
        />

        <div className="hr-page-body">
        <div className="attendance-toolbar-controls sticky top-0 z-30 mb-1 flex shrink-0 flex-col gap-1 border-b border-slate-200/90 bg-white px-1.5 py-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2 md:px-2 dark:border-slate-700/90 dark:bg-slate-900">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            <AttendanceOffHolidayDaysControl
              user={user}
              userRole={userRole}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              isOffDay={isOffDay}
              isHolidayDay={isHolidayDay}
              isCompensatoryDay={isCompensatoryDay}
              tl={tlAttendance}
              className="min-w-0 flex-1"
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
              onOpenNightOt={openNightOtModal}
              onExportOneDay={() => {
                setExportModalMode("single");
                setRangeExportModalOpen(true);
              }}
              onExportRange={() => {
                setExportModalMode("range");
                setRangeExportModalOpen(true);
              }}
              showEarlyOtAction={earlyOtEligibleEmployees.length > 0}
              showLateOtAction={lateOtEligibleEmployees.length > 0}
              showNightOtAction
              showPresenceFilters
              workHoursFilter={workHoursFilter}
              leaveTypeFilter={leaveTypeFilter}
              overtimeFilter={overtimeFilter}
              shortHoursFilter={shortHoursFilter}
              onWorkHoursFilterChange={setWorkHoursFilter}
              onLeaveTypeFilterChange={setLeaveTypeFilter}
              onOvertimeFilterChange={setOvertimeFilter}
              onShortHoursFilterChange={setShortHoursFilter}
              filtersDisabled={isTableBusy}
            />
          </div>
        </div>
        <PayrollMonthGridLoadingOverlay
          active={isDayLoading}
          mode="viewport"
          message={tlPage("dayDataLoading", "Đang tải dữ liệu...")}
        />
        <div className="payroll-salary-table-panel">
        <div className="payroll-salary-table-compact relative min-w-0 w-full max-w-none rounded-md bg-white leading-tight shadow-sm dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
          <PayrollMonthGridLoadingOverlay
            active={filtersPending && !isDayLoading}
            message={tlPage("dayDataRendering", "Đang cập nhật bảng…")}
          />
          <div className="payroll-salary-table-scroll min-w-0 w-full max-w-full">
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
                {pagedEmployees.map((emp, localIdx) => {
                  const annualLeaveBalance =
                    getDisplayAnnualLeaveBalanceForAttendance(
                      emp,
                      annualLeaveBalanceByMnv,
                    );
                  return (
                    <PayrollSalaryTableRow
                      key={emp.id}
                      emp={emp}
                      idx={tableRowIndexOffset + localIdx}
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
                      attendanceDateKey={selectedDate}
                      annualLeaveBalance={annualLeaveBalance}
                      annualLeaveYear={annualLeaveYear}
                      annualLeaveThroughDateKey={selectedDate}
                      annualLeaveAttendanceRootPath="attendance"
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="payroll-salary-pagination">
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
        </div>
        </div>
      </div>

      {showEmployeeModal ? (
        <Suspense fallback={null}>
      <AttendanceEmployeeFormModal
        open
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
        dayIsOffDay={isOffDay}
        dayIsHolidayDay={isHolidayDay}
      />
        </Suspense>
      ) : null}

      {rangeExportModalOpen ? (
        <Suspense fallback={null}>
      <PayrollRangeExcelExportModal
        open
        onDismiss={() => {
          if (!rangeExportBusy) setRangeExportModalOpen(false);
        }}
        onExport={handleExportPayrollExcelFromModal}
        todayKey={getTodayDateKeyLocal()}
        singleDayKey={exportModalMode === "single" ? selectedDate : null}
        departmentOptions={departments}
        initialDepartmentFilter={departmentFilter}
        exporting={rangeExportBusy}
        title={tlPage(
          exportModalMode === "single"
            ? "exportSingleDayModalTitle"
            : "exportRangeModalTitle",
          exportModalMode === "single"
            ? "Xuất Excel một ngày"
            : "Xuất Excel nhiều ngày",
        )}
        hint={tlPage(
          exportModalMode === "single"
            ? "exportSingleDayModalHint"
            : "exportExcelRangeHint",
          exportModalMode === "single"
            ? "Xuất bảng giờ công của ngày đang chọn. Có thể lọc theo bộ phận."
            : "Chọn khoảng ngày và bộ phận cần xuất.",
        )}
        dateSectionLabel={tlPage("exportDateSectionLabel", "Khoảng ngày")}
        fromLabel={tlPage("exportRangeFrom", "Từ ngày")}
        toLabel={tlPage("exportRangeTo", "Đến ngày")}
        exportLabel={tlPage("exportRangeSubmit", "Xuất Excel")}
        cancelLabel={tlPage("exportRangeCancel", "Hủy")}
        departmentLabel={tlPage("exportDepartmentLabel", "Bộ phận")}
        departmentHint={tlPage(
          "exportDepartmentHint",
          "Không chọn = xuất tất cả bộ phận",
        )}
        departmentAllLabel={tlPage("exportDepartmentAll", "Tất cả bộ phận")}
        departmentSelectedLabel={tlPage(
          "exportDepartmentSelected",
          "Đã chọn {{count}}/{{total}} bộ phận",
        )}
        summarySingleLabel={tlPage(
          "exportSummarySingle",
          "Ngày {{date}}",
        )}
        summaryRangeLabel={tlPage(
          "exportSummaryRange",
          "{{from}} → {{to}}",
        )}
        selectAllDepartmentsLabel={tlPage(
          "exportDepartmentSelectAll",
          "Chọn tất cả",
        )}
        clearDepartmentsLabel={tlPage("exportDepartmentClear", "Bỏ chọn")}
      />
        </Suspense>
      ) : null}

      {monthlyTimeInOutOpen ? (
        <Suspense fallback={null}>
        <PayrollMonthlyTimeInOutModal
          open
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
        </Suspense>
      ) : null}

      {monthlyTimesheetOpen ? (
        <Suspense fallback={null}>
        <PayrollMonthlyTimesheetModal
          open
          onClose={() => setMonthlyTimesheetOpen(false)}
          anchorDateKey={selectedDate}
          displayLocale={displayLocale}
          tlPage={tlPage}
          searchTerm={searchTerm}
          departmentFilter={departmentFilter}
          payrollDepartmentOptions={departments}
          onDepartmentFilterChange={setDepartmentFilter}
          workHoursFilter={workHoursFilter}
          leaveTypeFilter={leaveTypeFilter}
          overtimeFilter={overtimeFilter}
          shortHoursFilter={shortHoursFilter}
          onWorkHoursFilterChange={setWorkHoursFilter}
          onLeaveTypeFilterChange={setLeaveTypeFilter}
          onOvertimeFilterChange={setOvertimeFilter}
          onShortHoursFilterChange={setShortHoursFilter}
          normalizeDepartment={normalizeDepartment}
          user={user}
          userRole={userRole}
          userDepartments={userDepartments}
          onAlert={setAlert}
          employees={employees}
        />
        </Suspense>
      ) : null}

      {earlyOtModalOpen && earlyOtModalRows.length > 0 ? (
        <Suspense fallback={null}>
      <PayrollEarlyOvertimePaperworkModal
        open
        rows={earlyOtModalRows}
        initialChecked={earlyOtInitialChecked}
        onDismiss={handleEarlyOtDismiss}
        onSave={handleEarlyOtSave}
        saving={earlyOtSaving}
        title={tlPage("earlyOtModalTitle", "Xác nhận đăng ký tăng ca")}
        dateLabel={otPaperworkDateLabel}
        dateCaption={otPaperworkDateCaption}
        description={tlPage(
          "earlyOtModalDescription",
          "Ca ngày — vào ≤ 06:40\n• Trước 06:00: 2h (05:40–06:40 + 06:40–07:40)\n• Từ 06:00: 1h (06:40–07:40)\n\nCa đêm\n• TC sớm: 17:40–18:40 + 18:40–19:40 (tối đa 2h)\n• GC: 19:40 → 05:00 (8h)",
        )}
        rulesAside
        rulesTitle={tlPage("earlyOtModalRulesTitle", "Quy tắc tính giờ")}
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
        </Suspense>
      ) : null}

      {lateOtModalOpen && lateOtModalRows.length > 0 ? (
        <Suspense fallback={null}>
      <PayrollEarlyOvertimePaperworkModal
        open
        rows={lateOtModalRows}
        initialChecked={lateOtInitialChecked}
        onDismiss={handleLateOtDismiss}
        onSave={handleLateOtSave}
        saving={lateOtSaving}
        title={tlPage("lateOtModalTitle", "Xác nhận không tăng ca sau 17:30")}
        dateLabel={otPaperworkDateLabel}
        dateCaption={otPaperworkDateCaption}
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
        </Suspense>
      ) : null}

      {nightOtModalOpen ? (
        <Suspense fallback={null}>
      <PayrollEarlyOvertimePaperworkModal
        open
        rows={nightOtEligibleEmployees}
        initialChecked={nightOtInitialChecked}
        onDismiss={() => setNightOtModalOpen(false)}
        onSave={handleNightOtSave}
        saving={nightOtSaving}
        title={tlPage("nightOtPaperworkButton", "Xác nhận tăng ca đêm")}
        dateLabel={otPaperworkDateLabel}
        dateCaption={otPaperworkDateCaption}
        description={tlPage(
          "nightOtModalDescription",
          "Giờ vào từ 22:00 đến 05:00 — khi tick xác nhận, giờ trong khung 22:00–06:00 được tính hệ số tăng ca ×2.7 (ngày thường).",
        )}
        saveLabel={tlPage("nightOtModalSave", "Lưu")}
        selectAllLabel={tlPage("nightOtModalSelectAll", "Chọn tất cả")}
        skipAllLabel={tlPage("nightOtModalDeselectAll", "Bỏ chọn tất cả")}
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
        </Suspense>
      ) : null}
      </AttendanceHrPageShell>
    </>
  );
}
