import React, { memo, useMemo, useRef, useCallback } from "react";
import AttendanceTableRow, {
  AttendanceTableColgroup,
  AttendanceTableThead,
} from "./attendanceTableRow";
import { attendanceTableWrapperMinWidthClass } from "./attendanceListShared";
import { isSeasonalAttendanceRoot, isKoreanAttendanceRoot } from "./attendanceSeasonalStt";
import {
  useHrTableRowVirtualizer,
  HrVirtualTableSpacerRow,
  HR_TABLE_VIRTUAL_MAX_HEIGHT,
} from "@/hooks/hrTableVirtualization.jsx";

const ATTENDANCE_VIRTUAL_COL_SPAN = 24;
const ATTENDANCE_ROW_ESTIMATE_PX = 38;

function AttendanceListTableSection({
  columnPlan,
  deferredFilteredEmployees,
  rowIndexOffset = 0,
  virtualizeRows = false,
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
  selectedDate,
}) {
  const scrollRef = useRef(null);
  const isSeasonalAttendance = isSeasonalAttendanceRoot(attendanceRootPath);
  const isKoreanAttendance = isKoreanAttendanceRoot(attendanceRootPath);
  const attendanceLayoutOptions = useMemo(() => {
    const options = {};
    if (isKoreanAttendance) options.koreanAttendanceLayout = true;
    if (isSeasonalAttendance) options.seasonalAttendanceLayout = true;
    return options;
  }, [isKoreanAttendance, isSeasonalAttendance]);
  const attendanceTableMinWidthClass = attendanceTableWrapperMinWidthClass(
    columnPlan,
    attendanceLayoutOptions,
  );

  const getRowKey = useCallback(
    (emp, idx) => emp.id ?? emp.mnv ?? `row-${idx}`,
    [],
  );

  const getVirtualItemKey = useCallback(
    (index) => {
      const emp = deferredFilteredEmployees[index];
      return getRowKey(emp, rowIndexOffset + index);
    },
    [deferredFilteredEmployees, getRowKey, rowIndexOffset],
  );

  const { shouldVirtualize, virtualItems, paddingTop, paddingBottom } =
    useHrTableRowVirtualizer({
      rowCount: deferredFilteredEmployees.length,
      enabled: virtualizeRows,
      scrollRef,
      estimateRowHeight: ATTENDANCE_ROW_ESTIMATE_PX,
      getItemKey: getVirtualItemKey,
    });

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
      isKoreanAttendance,
      attendanceDateKey: selectedDate,
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
      isKoreanAttendance,
      selectedDate,
    ],
  );

  const renderEmployeeRow = useCallback(
    (emp, idx) => {
      const rowKey = getRowKey(emp, idx);
      return (
        <AttendanceTableRow
          key={rowKey}
          emp={emp}
          idx={idx}
          canEdit={canEditByEmpId.get(rowKey) ?? false}
          {...sharedRowProps}
        />
      );
    },
    [canEditByEmpId, getRowKey, sharedRowProps],
  );

  const outerScrollClass =
    columnPlan === "minimal"
      ? "overflow-x-hidden"
      : "overflow-x-auto";

  const verticalScrollClass = shouldVirtualize
    ? "hr-table-virtual-scroll overflow-y-auto overscroll-y-contain"
    : "";

  return (
    <div className="attendance-table-compact min-w-0 w-full max-w-none bg-white">
      <div
        ref={shouldVirtualize ? scrollRef : null}
        className={`attendance-table-scroll min-w-0 w-full max-w-full ${outerScrollClass} ${verticalScrollClass}`}
        style={
          shouldVirtualize
            ? { maxHeight: HR_TABLE_VIRTUAL_MAX_HEIGHT }
            : undefined
        }
      >
        <table
          className={`w-full max-w-none table-fixed border-collapse ${attendanceTableMinWidthClass}`}
        >
          <AttendanceTableColgroup
            showRowModalActions={showRowModalActions}
            columnPlan={columnPlan}
            layoutOptions={attendanceLayoutOptions}
          />
          <AttendanceTableThead
            tl={tl}
            showRowModalActions={showRowModalActions}
            stickyHeader={true}
            canDeleteRow={canDeleteDayRecord}
            columnPlan={columnPlan}
          />
          <tbody>
            {shouldVirtualize ? (
              <>
                <HrVirtualTableSpacerRow
                  colSpan={ATTENDANCE_VIRTUAL_COL_SPAN}
                  heightPx={paddingTop}
                />
                {virtualItems.map((virtualRow) => {
                  const emp = deferredFilteredEmployees[virtualRow.index];
                  if (!emp) return null;
                  return renderEmployeeRow(
                    emp,
                    rowIndexOffset + virtualRow.index,
                  );
                })}
                <HrVirtualTableSpacerRow
                  colSpan={ATTENDANCE_VIRTUAL_COL_SPAN}
                  heightPx={paddingBottom}
                />
              </>
            ) : (
              deferredFilteredEmployees.map((emp, localIdx) =>
                renderEmployeeRow(emp, rowIndexOffset + localIdx),
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default memo(AttendanceListTableSection);
