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
  selectedDate,
  attendanceRootPath = "attendance",
}) {
  const isSeasonalAttendance = isSeasonalAttendanceRoot(attendanceRootPath);

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
      key={selectedDate || "no-date"}
      className={`min-w-0 w-full max-w-full bg-white rounded-lg shadow-lg ${
        columnPlan === "minimal" ? "overflow-x-hidden" : "overflow-x-auto"
      }`}
    >
      <div
        className={`max-h-[min(82vh,900px)] w-full min-w-0 max-w-full overflow-y-auto ${
          columnPlan === "minimal"
            ? "overflow-x-hidden"
            : "overflow-x-auto overscroll-x-contain [scrollbar-gutter:stable]"
        }`}
      >
        <table
          className={`w-full table-fixed border-collapse max-w-none ${attendanceTableWrapperMinWidthClass(columnPlan)}`}
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
            {deferredFilteredEmployees.map((emp, idx) => (
              <AttendanceTableRow
                key={emp.id ?? emp.mnv ?? `row-${idx}`}
                emp={emp}
                idx={idx}
                canEdit={canEditEmployee(emp)}
                {...sharedRowProps}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default memo(AttendanceListTableSection);
