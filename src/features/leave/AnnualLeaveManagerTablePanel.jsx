import { memo, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import HrTablePagination from "@/components/ui/HrTablePagination";
import { useHrTablePagination } from "@/hooks/useHrTablePagination";
import AnnualLeaveManagerTableRow from "./AnnualLeaveManagerTableRow";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import {
  ANNUAL_LEAVE_TABLE_HEADER_GRADIENT,
  annualLeaveStickyColClass,
  annualLeaveTableThClass,
} from "./annualLeaveTableStyles";
import { filterAnnualLeaveManagerMonthValues } from "./annualLeaveManagerMonthFilter";

const EMPTY_MONTH_VALUES = Object.freeze(Array.from({ length: 12 }, () => 0));

const ROW_DISPLAY_KEYS = [
  ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR,
  ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_ADJUSTMENT,
  ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE,
  ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED,
  ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED,
  ANNUAL_LEAVE_EMP.BALANCE,
];

function annualLeaveRowDisplayEqual(prevRow, nextRow) {
  if (prevRow === nextRow) return true;
  if (!prevRow || !nextRow) return false;
  for (const key of ROW_DISPLAY_KEYS) {
    if (prevRow[key] !== nextRow[key]) return false;
  }
  return true;
}

function AnnualLeaveManagerTablePanel({
  filteredEntries,
  monthlyByEmpKey,
  storedMonthlyByEmpKey = {},
  year,
  monthFilter = "",
  monthColumnLabels,
  detailThroughDateKey,
  attendanceEnhancing = false,
  attendanceUsageReady = false,
  attendanceAccrualReady = false,
  resolveDisplayRow,
  canManage = false,
  adjustmentSavingId = "",
  onAdjustmentSave,
}) {
  const { t } = useTranslation();
  const tableColCount =
    10 + monthColumnLabels.length + 1 + (canManage ? 1 : 0);
  const tablePagination = useHrTablePagination(filteredEntries, {
    resetDeps: [year, monthFilter, filteredEntries.length],
  });
  const pagedRowCacheRef = useRef(new Map());

  const pagedMonthValuesByEmpKey = useMemo(() => {
    const map = new Map();
    for (const entry of tablePagination.pagedItems) {
      const rawValues = attendanceUsageReady
        ? monthlyByEmpKey[entry.id] ?? EMPTY_MONTH_VALUES
        : storedMonthlyByEmpKey[entry.id] ?? EMPTY_MONTH_VALUES;
      map.set(
        entry.id,
        filterAnnualLeaveManagerMonthValues(rawValues, monthFilter),
      );
    }
    return map;
  }, [
    attendanceUsageReady,
    monthFilter,
    monthlyByEmpKey,
    storedMonthlyByEmpKey,
    tablePagination.pagedItems,
  ]);

  const pagedLiveRows = useMemo(() => {
    const cache = pagedRowCacheRef.current;
    const activeKeys = new Set();
    const rows = tablePagination.pagedItems.map((entry, localIdx) => {
      const freshRow = resolveDisplayRow(entry) ?? entry._raw;
      activeKeys.add(entry.id);
      const cached = cache.get(entry.id);
      const row =
        cached?.row && annualLeaveRowDisplayEqual(cached.row, freshRow)
          ? cached.row
          : freshRow;
      const item = {
        entry,
        row,
        index: tablePagination.rowIndexOffset + localIdx,
      };
      cache.set(entry.id, item);
      return item;
    });
    for (const key of cache.keys()) {
      if (!activeKeys.has(key)) cache.delete(key);
    }
    return rows;
  }, [
    resolveDisplayRow,
    tablePagination.pagedItems,
    tablePagination.rowIndexOffset,
  ]);

  return (
    <>
      <div
        className={`annual-leave-table-compact w-full max-w-none rounded-md bg-white shadow-sm dark:bg-slate-900 dark:ring-1 dark:ring-slate-700${
          attendanceEnhancing ? " annual-leave-table--attendance-pending" : ""
        }`}
      >
        <div className="annual-leave-table-scroll w-full min-w-0 max-w-full">
          <table className="annual-leave-table w-max min-w-full max-w-none border-separate border-spacing-0">
            <colgroup>
              <col className="annual-leave-col-no annual-leave-sticky-col annual-leave-sticky-col-0" />
              <col className="annual-leave-col-code annual-leave-sticky-col annual-leave-sticky-col-1" />
              <col className="annual-leave-col-code annual-leave-sticky-col annual-leave-sticky-col-2" />
              <col className="annual-leave-name annual-leave-sticky-col annual-leave-sticky-col-3" />
              <col className="annual-leave-sticky-col annual-leave-sticky-col-4" />
              <col className="annual-leave-sticky-col annual-leave-sticky-col-5" />
              <col className="annual-leave-sticky-col annual-leave-sticky-col-6" />
              <col className="annual-leave-sticky-col annual-leave-sticky-col-7" />
              <col className="annual-leave-sticky-col annual-leave-sticky-col-8" />
              <col className="annual-leave-sticky-col annual-leave-sticky-col-9" />
              {monthColumnLabels.map((label) => (
                <col key={label} className="annual-leave-col-month" />
              ))}
              {canManage ? <col className="annual-leave-col-adjust" /> : null}
              <col className="annual-leave-col-detail" />
            </colgroup>
            <thead className="sticky top-0 z-20">
              <tr style={{ background: ANNUAL_LEAVE_TABLE_HEADER_GRADIENT }}>
                <th
                  rowSpan={2}
                  className={`${annualLeaveTableThClass} ${annualLeaveStickyColClass(0, { header: true })}`}
                >
                  No
                </th>
                <th colSpan={2} className={annualLeaveTableThClass}>
                  EMPL. CODE
                </th>
                <th
                  rowSpan={2}
                  className={`${annualLeaveTableThClass} ${annualLeaveStickyColClass(3, { header: true })}`}
                >
                  Full Name
                </th>
                <th
                  rowSpan={2}
                  className={`${annualLeaveTableThClass} ${annualLeaveStickyColClass(4, { header: true })}`}
                >
                  Date of Birth
                </th>
                <th
                  rowSpan={2}
                  className={`${annualLeaveTableThClass} ${annualLeaveStickyColClass(5, { header: true })}`}
                >
                  SUB-DEPARTMENT
                </th>
                <th
                  rowSpan={2}
                  className={`${annualLeaveTableThClass} ${annualLeaveStickyColClass(6, { header: true })}`}
                >
                  START WORKING DATE
                </th>
                <th
                  rowSpan={2}
                  className={`${annualLeaveTableThClass} ${annualLeaveStickyColClass(7, { header: true })}`}
                >
                  ANNUAL LEAVE IN CURRENT YEAR
                </th>
                <th
                  rowSpan={2}
                  className={`${annualLeaveTableThClass} ${annualLeaveStickyColClass(8, { header: true })}`}
                >
                  ANNUAL LEAVE USED
                </th>
                <th
                  rowSpan={2}
                  className={`${annualLeaveTableThClass} ${annualLeaveStickyColClass(9, { header: true })} annual-leave-balance-col-header`}
                >
                  BALANCE
                </th>
                {monthColumnLabels.map((label) => (
                  <th
                    key={label}
                    rowSpan={2}
                    className={`${annualLeaveTableThClass} min-w-[4.25rem] whitespace-nowrap`}
                  >
                    {label}
                  </th>
                ))}
                {canManage ? (
                  <th rowSpan={2} className={annualLeaveTableThClass}>
                    {t("annualLeave.adjustmentColumn", {
                      defaultValue: "ADJUST",
                    })}
                  </th>
                ) : null}
                <th rowSpan={2} className={annualLeaveTableThClass}>
                  {t("annualLeave.detailColumn", {
                    defaultValue: "DETAIL",
                  })}
                </th>
              </tr>
              <tr style={{ background: ANNUAL_LEAVE_TABLE_HEADER_GRADIENT }}>
                <th
                  className={`${annualLeaveTableThClass} ${annualLeaveStickyColClass(1, { header: true })}`}
                >
                  MNV
                </th>
                <th
                  className={`${annualLeaveTableThClass} ${annualLeaveStickyColClass(2, { header: true })}`}
                >
                  MVT
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 ? (
                <tr>
                  <td
                    colSpan={tableColCount}
                    className="px-4 py-10 text-center text-sm text-black dark:text-slate-400"
                  >
                    {t("annualLeave.noData")}
                  </td>
                </tr>
              ) : (
                pagedLiveRows.map(({ entry, row, index }) => (
                  <AnnualLeaveManagerTableRow
                    key={entry.id}
                    row={row ?? entry._raw}
                    raw={entry._raw}
                    index={index}
                    year={year}
                    throughDateKey={detailThroughDateKey}
                    monthValues={
                      pagedMonthValuesByEmpKey.get(entry.id) ??
                      EMPTY_MONTH_VALUES
                    }
                    canManage={canManage}
                    adjustmentSaving={adjustmentSavingId === entry.id}
                    onAdjustmentSave={onAdjustmentSave}
                    attendanceUsageReady={attendanceUsageReady}
                    attendanceAccrualReady={attendanceAccrualReady}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="annual-leave-pagination shrink-0">
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
    </>
  );
}

function areTablePanelPropsEqual(prev, next) {
  return (
    prev.filteredEntries === next.filteredEntries &&
    prev.monthlyByEmpKey === next.monthlyByEmpKey &&
    prev.storedMonthlyByEmpKey === next.storedMonthlyByEmpKey &&
    prev.year === next.year &&
    prev.monthFilter === next.monthFilter &&
    prev.monthColumnLabels === next.monthColumnLabels &&
    prev.detailThroughDateKey === next.detailThroughDateKey &&
    prev.attendanceEnhancing === next.attendanceEnhancing &&
    prev.attendanceUsageReady === next.attendanceUsageReady &&
    prev.attendanceAccrualReady === next.attendanceAccrualReady &&
    prev.resolveDisplayRow === next.resolveDisplayRow &&
    prev.canManage === next.canManage &&
    prev.adjustmentSavingId === next.adjustmentSavingId &&
    prev.onAdjustmentSave === next.onAdjustmentSave
  );
}

export default memo(AnnualLeaveManagerTablePanel, areTablePanelPropsEqual);
