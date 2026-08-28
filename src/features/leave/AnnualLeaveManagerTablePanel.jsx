import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUserIdentity } from "@/contexts/UserContext";
import { db } from "@/services/firebase";
import HrTablePagination from "@/components/ui/HrTablePagination";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import PayrollMonthGridLoadingOverlay from "@/features/payroll/PayrollMonthGridLoadingOverlay";
import { useHrTablePagination } from "@/hooks/useHrTablePagination";
import AnnualLeaveManagerTableRow from "./AnnualLeaveManagerTableRow";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import {
  ANNUAL_LEAVE_TABLE_HEADER_GRADIENT,
  annualLeaveStickyColClass,
  annualLeaveTableThClass,
} from "./annualLeaveTableStyles";
import { buildAnnualLeaveMonthlyUsageByEmpKey } from "./annualLeaveDerived";
import { buildAnnualLeaveManagerDisplayRow } from "./annualLeaveManagerDisplayRow";
import { filterAnnualLeaveManagerEntries } from "./annualLeaveManagerFilter";
import { persistAnnualLeaveEmployeeAdjustment } from "./annualLeaveAttendanceSync";
import { resolveAnnualLeaveRawWithProfiles } from "./annualLeaveRawProfile";
import { useAnnualLeaveAttendanceEnhancement } from "./useAnnualLeaveAttendanceEnhancement";
import {
  filterAnnualLeaveManagerMonthValues,
  resolveAnnualLeaveManagerMonthIndex,
} from "./annualLeaveManagerMonthFilter";

const EMPTY_MONTH_VALUES = Object.freeze(Array.from({ length: 12 }, () => 0));

const ROW_DISPLAY_KEYS = [
  ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR,
  ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_ADJUSTMENT,
  ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE,
  ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED,
  ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED,
  ANNUAL_LEAVE_EMP.BALANCE,
];

function buildScopeEmpKeySet(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const set = new Set(entries.map((entry) => entry.id).filter(Boolean));
  return set.size > 0 ? set : null;
}

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
  tableFilterKey = "",
  filterPending = false,
  entries = [],
  deptIndex = {},
  lazyLoadRequired = false,
  totalEmployeeCount = 0,
  storedMonthlyByEmpKey = {},
  yearData = null,
  year,
  monthFilter = "",
  monthColumnLabels,
  detailThroughDateKey,
  exportRef,
  canManage = false,
  onAdjustmentSaved,
  onAdjustmentSaveError,
}) {
  const { t } = useTranslation();
  const { user } = useUserIdentity();
  const [adjustmentSavingId, setAdjustmentSavingId] = useState("");
  const tableColCount = 10 + monthColumnLabels.length + 1 + (canManage ? 1 : 0);

  const tablePagination = useHrTablePagination(filteredEntries, {
    resetDeps: [year, monthFilter, tableFilterKey],
  });

  const pagedScopeEmpKeyKey = useMemo(
    () =>
      tablePagination.pagedItems
        .map((entry) => entry.id)
        .filter(Boolean)
        .sort()
        .join("|"),
    [tablePagination.pagedItems],
  );

  const pagedScopeEmpKeySet = useMemo(
    () => buildScopeEmpKeySet(tablePagination.pagedItems),
    [pagedScopeEmpKeyKey, tablePagination.pagedItems],
  );

  const usageThroughMonthIndex =
    resolveAnnualLeaveManagerMonthIndex(monthFilter);

  const {
    deductionsByEmpKey,
    attendanceMonthlyByEmpKey,
    monthWorkSummaryByEmpKey,
    attendanceProfileByEmpKey,
    accrualAsOfDateKey,
    attendanceEnhancing,
    attendanceUsageReady,
    attendanceAccrualReady,
    isEmpUsageReady,
    isEmpAccrualReady,
  } = useAnnualLeaveAttendanceEnhancement(year, yearData, {
    includePayrollMonthAccrual: true,
    throughDateKey: detailThroughDateKey,
    scopeEmpKeySet: pagedScopeEmpKeySet,
    accrualThroughMonthIndex: usageThroughMonthIndex,
  });

  const { monthlyByEmpKey } = useMemo(
    () =>
      buildAnnualLeaveMonthlyUsageByEmpKey(
        year,
        storedMonthlyByEmpKey,
        attendanceMonthlyByEmpKey,
      ),
    [attendanceMonthlyByEmpKey, year, storedMonthlyByEmpKey],
  );

  const buildDisplayRowForEntry = useCallback(
    (
      entry,
      {
        usageReady = attendanceUsageReady,
        accrualReady = attendanceAccrualReady,
      } = {},
    ) => {
      const monthValues =
        monthlyByEmpKey[entry.id] ??
        storedMonthlyByEmpKey[entry.id] ??
        EMPTY_MONTH_VALUES;
      const profiledRaw = resolveAnnualLeaveRawWithProfiles(
        entry._raw,
        entry.id,
        attendanceProfileByEmpKey,
      );
      return buildAnnualLeaveManagerDisplayRow({
        entry: { ...entry, _raw: profiledRaw },
        year,
        monthValues,
        usageThroughMonthIndex,
        attendanceUsageReady: usageReady,
        attendanceAccrualReady: accrualReady,
        deductionsByEmpKey,
        monthWorkSummaryByEmpKey,
        accrualAsOfDateKey,
      });
    },
    [
      accrualAsOfDateKey,
      attendanceAccrualReady,
      attendanceProfileByEmpKey,
      attendanceUsageReady,
      deductionsByEmpKey,
      monthWorkSummaryByEmpKey,
      monthlyByEmpKey,
      storedMonthlyByEmpKey,
      usageThroughMonthIndex,
      year,
    ],
  );

  const displayRowByEmpKey = useMemo(() => {
    const map = new Map();
    for (const entry of tablePagination.pagedItems) {
      const row = buildDisplayRowForEntry(entry, {
        usageReady: isEmpUsageReady(entry.id),
        accrualReady: isEmpAccrualReady(entry.id),
      });
      if (row) map.set(entry.id, row);
    }
    return map;
  }, [
    buildDisplayRowForEntry,
    isEmpAccrualReady,
    isEmpUsageReady,
    tablePagination.pagedItems,
  ]);

  const resolveDisplayRow = useCallback(
    (entry) => displayRowByEmpKey.get(entry.id) ?? entry._raw,
    [displayRowByEmpKey],
  );

  useEffect(() => {
    if (!exportRef) return;
    exportRef.current = {
      getExportRows(filters) {
        const filtered = filterAnnualLeaveManagerEntries(
          entries,
          filters,
          deptIndex,
        );
        return filtered
          .map((entry, idx) => {
            const row = buildDisplayRowForEntry(entry, {
              usageReady: isEmpUsageReady(entry.id),
              accrualReady: isEmpAccrualReady(entry.id),
            });
            if (!row) return null;
            return {
              ...row,
              rowNo: entry._raw?.rowNo ?? idx + 1,
            };
          })
          .filter(Boolean);
      },
      getMonthlyByEmpKey(filters) {
        const filtered = filterAnnualLeaveManagerEntries(
          entries,
          filters,
          deptIndex,
        );
        const map = {};
        for (const entry of filtered) {
          const rawValues = attendanceUsageReady
            ? (monthlyByEmpKey[entry.id] ?? EMPTY_MONTH_VALUES)
            : (storedMonthlyByEmpKey[entry.id] ?? EMPTY_MONTH_VALUES);
          map[entry.id] = filterAnnualLeaveManagerMonthValues(
            rawValues,
            monthFilter,
          );
        }
        return map;
      },
      getMonthColumnLabels: () => monthColumnLabels,
    };
  }, [
    buildDisplayRowForEntry,
    deptIndex,
    entries,
    exportRef,
    isEmpAccrualReady,
    isEmpUsageReady,
    monthColumnLabels,
    monthFilter,
    monthlyByEmpKey,
    attendanceUsageReady,
    storedMonthlyByEmpKey,
  ]);

  const handleAdjustmentSave = useCallback(
    async (empKey, adjustment, raw) => {
      if (!canManage || !empKey || !raw) return;
      setAdjustmentSavingId(empKey);
      try {
        await persistAnnualLeaveEmployeeAdjustment(db, {
          year,
          empKey,
          raw,
          adjustment,
          deductionsByEmpKey,
          attendanceMonthlyByEmpKey,
          monthWorkSummaryByEmpKey,
          updatedBy: user?.email ?? "",
        });
        onAdjustmentSaved?.();
      } catch (err) {
        onAdjustmentSaveError?.(
          err,
          t("annualLeave.adjustmentSaveError", {
            defaultValue: "Không lưu được điều chỉnh phép năm.",
          }),
        );
      } finally {
        setAdjustmentSavingId("");
      }
    },
    [
      canManage,
      year,
      user?.email,
      deductionsByEmpKey,
      attendanceMonthlyByEmpKey,
      monthWorkSummaryByEmpKey,
      onAdjustmentSaved,
      onAdjustmentSaveError,
      t,
    ],
  );

  const pagedRowCacheRef = useRef(new Map());

  const pagedMonthValuesByEmpKey = useMemo(() => {
    const map = new Map();
    for (const entry of tablePagination.pagedItems) {
      const rowReady = isEmpUsageReady(entry.id);
      const rawValues = rowReady
        ? (monthlyByEmpKey[entry.id] ?? EMPTY_MONTH_VALUES)
        : (storedMonthlyByEmpKey[entry.id] ?? EMPTY_MONTH_VALUES);
      map.set(
        entry.id,
        filterAnnualLeaveManagerMonthValues(rawValues, monthFilter),
      );
    }
    return map;
  }, [
    isEmpUsageReady,
    monthFilter,
    monthlyByEmpKey,
    storedMonthlyByEmpKey,
    tablePagination.pagedItems,
  ]);

  const pagedLiveRows = useMemo(() => {
    const cache = pagedRowCacheRef.current;
    const activeKeys = new Set();
    const rows = tablePagination.pagedItems.map((entry, localIdx) => {
      const freshRow = resolveDisplayRow(entry);
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

  const tableLoadingActive =
    !lazyLoadRequired && (filterPending || attendanceEnhancing);
  const tableLoadingMessage = filterPending
    ? t("annualLeave.tableLoadingFilter", {
        defaultValue: "Đang lọc dữ liệu…",
      })
    : t("annualLeave.tableLoadingAttendance", {
        defaultValue: "Đang tính phép từ điểm danh…",
      });
  const tableLoadingSubtitle = t("annualLeave.tableLoadingSubtitle", {
    defaultValue: "Vui lòng chờ trong giây lát",
  });

  return (
    <>
      <div
        className={`annual-leave-table-compact relative w-full max-w-none rounded-md bg-white shadow-sm dark:bg-slate-900 dark:ring-1 dark:ring-slate-700${
          filterPending ? " annual-leave-table--filter-pending" : ""
        }${
          attendanceEnhancing ? " annual-leave-table--attendance-pending" : ""
        }`}
      >
        <PayrollMonthGridLoadingOverlay
          active={tableLoadingActive}
          message={tableLoadingMessage}
          subtitle={tableLoadingSubtitle}
          mode="overlay"
          className="annual-leave-table-loading-overlay rounded-md"
        />
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
              {lazyLoadRequired ? (
                <tr>
                  <td
                    colSpan={tableColCount}
                    className="px-4 py-10 text-center text-sm text-black dark:text-slate-300"
                  >
                    {t("annualLeave.lazyLoadDeptRequired", {
                      defaultValue:
                        "Có {{count}} nhân viên — chọn bộ phận hoặc tìm MNV/tên để xem bảng (giảm tải dữ liệu).",
                      count: totalEmployeeCount,
                    })}
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
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
                    onAdjustmentSave={handleAdjustmentSave}
                    attendanceUsageReady={isEmpUsageReady(entry.id)}
                    attendanceAccrualReady={isEmpAccrualReady(entry.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="annual-leave-pagination shrink-0">
        {!lazyLoadRequired ? (
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
        ) : null}
      </div>
    </>
  );
}

function areTablePanelPropsEqual(prev, next) {
  return (
    prev.filteredEntries === next.filteredEntries &&
    prev.tableFilterKey === next.tableFilterKey &&
    prev.filterPending === next.filterPending &&
    prev.lazyLoadRequired === next.lazyLoadRequired &&
    prev.totalEmployeeCount === next.totalEmployeeCount &&
    prev.entries === next.entries &&
    prev.deptIndex === next.deptIndex &&
    prev.storedMonthlyByEmpKey === next.storedMonthlyByEmpKey &&
    prev.yearData === next.yearData &&
    prev.year === next.year &&
    prev.monthFilter === next.monthFilter &&
    prev.monthColumnLabels === next.monthColumnLabels &&
    prev.detailThroughDateKey === next.detailThroughDateKey &&
    prev.exportRef === next.exportRef &&
    prev.canManage === next.canManage &&
    prev.onAdjustmentSaved === next.onAdjustmentSaved &&
    prev.onAdjustmentSaveError === next.onAdjustmentSaveError
  );
}

export default memo(AnnualLeaveManagerTablePanel, areTablePanelPropsEqual);
