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
import { db, ref, onValue } from "@/services/firebase";
import {
  EMPLOYEE_PROFILES_PATH,
  mergeEmployeeProfileAndDay,
  employeeProfileStorageKeyFromMnv,
} from "@/utils/employeeRosterRecord";
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
  isAttendanceDayMetaKey,
  getIsOffDayFromRaw,
} from "@/features/attendance/attendanceDayMeta";
import AlertMessage from "@/components/ui/AlertMessage";
import AttendanceEmployeeFormModal from "@/features/attendance/AttendanceEmployeeFormModal";
import "./payrollTableCompact.css";

/** Bảng lương: min-width hẹp hơn điểm danh một chút (nhiều cột). Thêm cột Sửa thì nới thêm ~56px (class cố định để Tailwind JIT nhận). */
function payrollTableWrapperMinWidthClass(
  columnPlan,
  showRowModalActions = false,
) {
  switch (columnPlan) {
    case "full":
      return showRowModalActions ? "min-w-[1236px]" : "min-w-[1180px]";
    case "compact":
      return showRowModalActions ? "min-w-[976px]" : "min-w-[920px]";
    case "narrow":
      return showRowModalActions ? "min-w-[836px]" : "min-w-[780px]";
    case "minimal":
      return showRowModalActions ? "min-w-[456px]" : "min-w-[400px]";
    default:
      return showRowModalActions ? "min-w-[896px]" : "min-w-[840px]";
  }
}

function applyAttendanceMerge(rawData, profMap) {
  if (!rawData || typeof rawData !== "object") return [];
  const arr = Object.entries(rawData)
    .filter(([id]) => !isAttendanceDayMetaKey(id))
    .map(([id, emp]) => {
      const pk = employeeProfileStorageKeyFromMnv(emp?.mnv);
      const prof = pk ? profMap[pk] : null;
      return mergeEmployeeProfileAndDay({ ...emp, id }, prof, null);
    });
  arr.sort((a, b) => (a.stt || 0) - (b.stt || 0));
  return arr;
}

const noop = () => {};

/**
 * Trang lương: đọc attendance/{ngày} (chỉ xem), bảng riêng với cột TC off (ngày off).
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
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  const [employeeProfilesMap, setEmployeeProfilesMap] = useState({});
  const [employees, setEmployees] = useState([]);

  const attendanceRawRef = useRef(undefined);
  const profilesRef = useRef({});

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
    const profRef = ref(db, EMPLOYEE_PROFILES_PATH);
    const unsub = onValue(profRef, (snapshot) => {
      const v = snapshot.val();
      setEmployeeProfilesMap(v && typeof v === "object" ? v : {});
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    profilesRef.current = employeeProfilesMap;
  }, [employeeProfilesMap]);

  const applyMerge = useCallback((rawData, profMap) => {
    return applyAttendanceMerge(rawData, profMap);
  }, []);

  useEffect(() => {
    attendanceRawRef.current = undefined;
    setEmployees([]);
    const empRef = ref(db, `attendance/${selectedDate}`);
    const unsubscribe = onValue(empRef, (snapshot) => {
      const data = snapshot.val();
      attendanceRawRef.current = data;
      setIsOffDay(getIsOffDayFromRaw(data));
      setEmployees(applyMerge(data, profilesRef.current));
    });
    return () => unsubscribe();
  }, [selectedDate, applyMerge]);

  useEffect(() => {
    const raw = attendanceRawRef.current;
    if (raw === undefined) return;
    setEmployees(applyMerge(raw, employeeProfilesMap));
  }, [employeeProfilesMap, applyMerge]);

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
    () => filterRows(employees),
    [employees, filterRows],
  );

  const departments = useMemo(() => {
    const set = new Set();
    for (const emp of employees) {
      const d = String(emp.boPhan ?? "").trim();
      if (d) set.add(d);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [employees]);

  const canSeeEmployee = useCallback(
    (employee) =>
      canEditAttendanceForEmployee({
        user,
        userRole,
        userDepartments,
        employee,
      }),
    [user, userRole, userDepartments],
  );

  const visibleRows = useMemo(
    () => filteredEmployees.filter((emp) => canSeeEmployee(emp)),
    [filteredEmployees, canSeeEmployee],
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
    visibleRows.length > ATTENDANCE_VIRTUAL_THRESHOLD;

  const rowVirtualizer = useVirtualizer({
    count: visibleRows.length,
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

        {isOffDay ? (
          <div
            className="mb-3 rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-xs text-violet-950 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-100"
            role="status"
          >
            {tlPage(
              "offDayPayrollBanner",
              "Ngày đang bật «Ngày off»: cột Giờ công hiển thị «-»; cùng quy tắc tính như giờ công nằm ở cột TC off.",
            )}
          </div>
        ) : null}

        {/* Khu dự phòng: tính lương (sẽ gắn sau) */}
        <div className="mb-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
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
                    const emp = visibleRows[virtualRow.index];
                    const idx = virtualRow.index;
                    return (
                      <PayrollSalaryTableRow
                        key={emp.id}
                        emp={emp}
                        idx={idx}
                        virtualRow={virtualRow}
                        showRowModalActions={showRowModalActions}
                        user={user}
                        canEdit={canSeeEmployee(emp)}
                        savingGioVao={false}
                        editingGioVaoValue={undefined}
                        savingCaLamViec={false}
                        editingCaLamViecValue={undefined}
                        tl={tlTable}
                        t={t}
                        onGioVaoChange={noop}
                        onGioVaoSave={noop}
                        onCaLamChange={noop}
                        onCaLamSave={noop}
                        onEdit={handleOpenEditEmployee}
                        onDelete={noop}
                        canDeleteRow={false}
                        measureElementRef={rowVirtualizer.measureElement}
                        gridTemplateColumns={attendanceGridTemplateColumns}
                        columnPlan={columnPlan}
                        isOffDay={isOffDay}
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
                  {visibleRows.map((emp, idx) => (
                    <PayrollSalaryTableRow
                      key={emp.id}
                      emp={emp}
                      idx={idx}
                      virtualRow={undefined}
                      showRowModalActions={showRowModalActions}
                      user={user}
                      canEdit={canSeeEmployee(emp)}
                      savingGioVao={false}
                      editingGioVaoValue={undefined}
                      savingCaLamViec={false}
                      editingCaLamViecValue={undefined}
                      tl={tlTable}
                      t={t}
                      onGioVaoChange={noop}
                      onGioVaoSave={noop}
                      onCaLamChange={noop}
                      onCaLamSave={noop}
                      onEdit={handleOpenEditEmployee}
                      onDelete={noop}
                      canDeleteRow={false}
                      columnPlan={columnPlan}
                      isOffDay={isOffDay}
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
    </>
  );
}
