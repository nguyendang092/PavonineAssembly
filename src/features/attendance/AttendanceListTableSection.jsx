import React, { memo, useMemo } from "react";
import AttendanceTableRow, {
  AttendanceTableColgroup,
  AttendanceTableThead,
} from "./attendanceTableRow";
import { attendanceTableWrapperMinWidthClass } from "./attendanceListShared";
import { isSeasonalAttendanceRoot } from "./attendanceSeasonalStt";

/**
 * Bảng điểm danh — render đủ hàng (không virtual) để tránh chỉ thấy ~10–15 dòng sau tối ưu.
 */
function AttendanceListTableSection({
  columnPlan,
  deferredFilteredEmployees,
  showRowModalActions,
  canDeleteDayRecord,
  tl,
  user,
  canEditEmployee,
  onEdit,
  onDelete,
  isOffDay,
  isHolidayDay,
  isCompensatoryDay,
  t,
  attendanceRootPath = "attendance",
}) {
  const isSeasonalAttendance = isSeasonalAttendanceRoot(attendanceRootPath);

  const canEditByEmpId = useMemo(() => {
    const map = new Map();
    for (const emp of deferredFilteredEmployees) {
      const id = emp?.id ?? emp?.mnv;
      if (id != null) map.set(id, canEditEmployee(emp));
    }
    return map;
  }, [deferredFilteredEmployees, canEditEmployee]);

  const sharedRowProps = useMemo(
    () => ({
      showRowModalActions,
      user,
      tl,
      t,
      onEdit,
      onDelete,
      canDeleteRow: canDeleteDayRecord,
      columnPlan,
      isOffDay,
      isHolidayDay,
      isCompensatoryDay,
      isSeasonalAttendance,
    }),
    [
      showRowModalActions,
      user,
      tl,
      t,
      onEdit,
      onDelete,
      canDeleteDayRecord,
      columnPlan,
      isOffDay,
      isHolidayDay,
      isCompensatoryDay,
      isSeasonalAttendance,
    ],
  );

  return (
    <div
      className={`min-w-0 w-full max-w-none bg-white ${
        columnPlan === "minimal"
          ? "overflow-x-hidden"
          : "overflow-x-auto overscroll-x-contain [scrollbar-gutter:stable]"
      }`}
    >
      <table
        className={`w-full max-w-none table-fixed border-collapse ${attendanceTableWrapperMinWidthClass(columnPlan)}`}
      >
        <AttendanceTableColgroup
          showRowModalActions={showRowModalActions}
          columnPlan={columnPlan}
        />
        <AttendanceTableThead
          tl={tl}
          showRowModalActions={showRowModalActions}
          stickyHeader={true}
          canDeleteRow={canDeleteDayRecord}
          columnPlan={columnPlan}
        />
        <tbody>
          {deferredFilteredEmployees.map((emp, idx) => {
            const rowKey = emp.id ?? emp.mnv ?? `row-${idx}`;
            return (
              <AttendanceTableRow
                key={rowKey}
                emp={emp}
                idx={idx}
                canEdit={canEditByEmpId.get(rowKey) ?? false}
                {...sharedRowProps}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default memo(AttendanceListTableSection);
