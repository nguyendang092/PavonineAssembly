import React, { memo, useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import AttendanceTableRow, {
  ATTENDANCE_VIRTUAL_THRESHOLD,
  AttendanceTableColgroup,
  AttendanceTableThead,
  AttendanceVirtualHeader,
} from "./attendanceTableRow";
import { attendanceTableWrapperMinWidthClass } from "./attendanceListShared";

/**
 * Bảng điểm danh (virtual / full) — tách JSX để AttendanceList re-render ít hơn.
 */
function AttendanceListTableSection({
  columnPlan,
  forceVirtualizedRows,
  deferredFilteredEmployees,
  attendanceGridTemplateColumns,
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
}) {
  const tableScrollParentRef = useRef(null);
  const rowEstimatePx = 36;
  const shouldVirtualize =
    forceVirtualizedRows ||
    deferredFilteredEmployees.length > ATTENDANCE_VIRTUAL_THRESHOLD;

  const rowVirtualizer = useVirtualizer({
    count: deferredFilteredEmployees.length,
    getScrollElement: () => tableScrollParentRef.current,
    estimateSize: () => rowEstimatePx,
    overscan: 10,
  });

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
    ],
  );

  return (
    <TableShell columnPlan={columnPlan}>
      {shouldVirtualize ? (
        <div
          ref={tableScrollParentRef}
          className={`max-h-[min(82vh,900px)] w-full min-w-0 max-w-full overflow-y-auto ${
            columnPlan === "minimal"
              ? "overflow-x-hidden"
              : "overflow-x-auto overscroll-x-contain [scrollbar-gutter:stable]"
          }`}
        >
          <VirtualGrid
            columnPlan={columnPlan}
            attendanceGridTemplateColumns={attendanceGridTemplateColumns}
            showRowModalActions={showRowModalActions}
            canDeleteDayRecord={canDeleteDayRecord}
            tl={tl}
            rowVirtualizer={rowVirtualizer}
            deferredFilteredEmployees={deferredFilteredEmployees}
            sharedRowProps={sharedRowProps}
            canEditEmployee={canEditEmployee}
          />
        </div>
      ) : (
        <div
          ref={tableScrollParentRef}
          className={`min-w-0 w-full max-w-full ${
            columnPlan === "minimal" ? "overflow-x-hidden" : "overflow-x-auto"
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
                  key={emp.id}
                  emp={emp}
                  idx={idx}
                  virtualRow={undefined}
                  canEdit={canEditEmployee(emp)}
                  {...sharedRowProps}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TableShell>
  );
}

function TableShell({ columnPlan, children }) {
  return (
    <div
      className={`min-w-0 w-full max-w-full bg-white rounded-lg shadow-lg ${
        columnPlan === "minimal" ? "overflow-x-hidden" : "overflow-x-auto"
      }`}
    >
      {children}
    </div>
  );
}

function VirtualGrid({
  columnPlan,
  attendanceGridTemplateColumns,
  showRowModalActions,
  canDeleteDayRecord,
  tl,
  rowVirtualizer,
  deferredFilteredEmployees,
  sharedRowProps,
  canEditEmployee,
}) {
  return (
    <div
      className={`w-full max-w-none ${attendanceTableWrapperMinWidthClass(columnPlan)}`}
      role="table"
    >
      <AttendanceVirtualHeader
        tl={tl}
        showRowModalActions={showRowModalActions}
        gridTemplateColumns={attendanceGridTemplateColumns}
        canDeleteRow={canDeleteDayRecord}
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
          const emp = deferredFilteredEmployees[virtualRow.index];
          const idx = virtualRow.index;
          return (
            <AttendanceTableRow
              key={emp.id}
              emp={emp}
              idx={idx}
              virtualRow={virtualRow}
              canEdit={canEditEmployee(emp)}
              measureElementRef={rowVirtualizer.measureElement}
              gridTemplateColumns={attendanceGridTemplateColumns}
              {...sharedRowProps}
            />
          );
        })}
      </div>
    </div>
  );
}

export default memo(AttendanceListTableSection);
