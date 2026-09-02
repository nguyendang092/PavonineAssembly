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
  annualLeaveStickyColClass,
  annualLeaveTableThClass,
} from "./annualLeaveTableStyles";
import { buildAnnualLeaveMonthlyUsageByEmpKey } from "./annualLeaveDerived";
import { buildDerivedMapsFromLeaveAggYear } from "./attendanceLeaveAgg";
import { useLeaveAggYearExternal } from "./annualLeaveLiveExternalHooks";
import { buildAnnualLeaveManagerDisplayRow } from "./annualLeaveManagerDisplayRow";
import { filterAnnualLeaveManagerEntries } from "./annualLeaveManagerFilter";
import { persistAnnualLeaveEmployeeAdjustment } from "./annualLeaveAttendanceSync";
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
  const tableColCount = 8 + monthColumnLabels.length + 1 + (canManage ? 1 : 0);

  const tablePagination = useHrTablePagination(filteredEntries, {
    resetDeps: [year, monthFilter, tableFilterKey],
  });

  const usageThroughMonthIndex =
    resolveAnnualLeaveManagerMonthIndex(monthFilter);

  const { data: leaveAggYearData } = useLeaveAggYearExternal(year, true);

  const leaveAggMonthlyByEmpKey = useMemo(() => {
    if (!leaveAggYearData) return {};
    return buildDerivedMapsFromLeaveAggYear(leaveAggYearData, year)
      .attendanceMonthlyByEmpKey;
  }, [leaveAggYearData, year]);

  const { monthlyByEmpKey } = useMemo(
    () =>
      buildAnnualLeaveMonthlyUsageByEmpKey(
        year,
        storedMonthlyByEmpKey,
        leaveAggMonthlyByEmpKey,
      ),
    [leaveAggMonthlyByEmpKey, year, storedMonthlyByEmpKey],
  );

  const buildDisplayRowForEntry = useCallback(
    (entry) => {
      const monthValues =
        monthlyByEmpKey[entry.id] ??
        storedMonthlyByEmpKey[entry.id] ??
        EMPTY_MONTH_VALUES;
      return buildAnnualLeaveManagerDisplayRow({
        entry,
        year,
        monthValues,
        usageThroughMonthIndex,
      });
    },
    [monthlyByEmpKey, storedMonthlyByEmpKey, usageThroughMonthIndex, year],
  );

  const displayRowByEmpKey = useMemo(() => {
    const map = new Map();
    for (const entry of tablePagination.pagedItems) {
      const row = buildDisplayRowForEntry(entry);
      if (row) map.set(entry.id, row);
    }
    return map;
  }, [buildDisplayRowForEntry, tablePagination.pagedItems]);

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
            const row = buildDisplayRowForEntry(entry);
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
          const rawValues =
            monthlyByEmpKey[entry.id] ?? storedMonthlyByEmpKey[entry.id] ?? EMPTY_MONTH_VALUES;
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
    monthColumnLabels,
    monthFilter,
    monthlyByEmpKey,
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
      onAdjustmentSaved,
      onAdjustmentSaveError,
      t,
    ],
  );

  const pagedRowCacheRef = useRef(new Map());

  const pagedMonthValuesByEmpKey = useMemo(() => {
    const map = new Map();
    for (const entry of tablePagination.pagedItems) {
      const rawValues =
        monthlyByEmpKey[entry.id] ?? storedMonthlyByEmpKey[entry.id] ?? EMPTY_MONTH_VALUES;
      map.set(
        entry.id,
        filterAnnualLeaveManagerMonthValues(rawValues, monthFilter),
      );
    }
    return map;
  }, [
    monthFilter,
    monthlyByEmpKey,
    storedMonthlyByEmpKey,
    tablePagination.pagedItems,
  ]);

  const pagedRows = useMemo(() => {
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

  const tableLoadingActive = !lazyLoadRequired && filterPending;
  const tableLoadingMessage = t("annualLeave.tableLoadingFilter", {
    defaultValue: "Đang lọc dữ liệu…",
  });
  const tableLoadingSubtitle = t("annualLeave.tableLoadingSubtitle", {
    defaultValue: "Vui lòng chờ trong giây lát",
  });

  return (
    <>
      <div
        className={`annual-leave-table-compact relative w-full max-w-none${
          filterPending ? " annual-leave-table--filter-pending" : ""
        }`}
      >
        <PayrollMonthGridLoadingOverlay
          active={tableLoadingActive}
          message={tableLoadingMessage}
          subtitle={tableLoadingSubtitle}
          mode="overlay"
          className="annual-leave-table-loading-overlay"
        />
        <div className="annual-leave-table-scroll">
          <table className="annual-leave-table border-separate border-spacing-0">
            <colgroup>
              <col className="annual-leave-col-no" />
              <col className="annual-leave-col-mnv" />
              <col className="annual-leave-name" />
              <col className="annual-leave-col-dept" />
              <col className="annual-leave-col-start" />
              <col className="annual-leave-col-current" />
              <col className="annual-leave-col-used" />
              <col className="annual-leave-col-balance" />
              {monthColumnLabels.map((label) => (
                <col key={label} className="annual-leave-col-month" />
              ))}
              {canManage ? <col className="annual-leave-col-adjust" /> : null}
              <col className="annual-leave-col-detail" />
            </colgroup>
            <thead>
              <tr>
                <th
                  className={`${annualLeaveTableThClass} ${annualLeaveStickyColClass(0, { header: true })}`}
                >
                  {t("annualLeave.tableColNo", { defaultValue: "STT" })}
                </th>
                <th
                  className={`${annualLeaveTableThClass} ${annualLeaveStickyColClass(1, { header: true })}`}
                >
                  {t("annualLeave.tableColMnv", { defaultValue: "Mã NV" })}
                </th>
                <th
                  className={`${annualLeaveTableThClass} ${annualLeaveStickyColClass(2, { header: true })}`}
                >
                  {t("annualLeave.tableColFullName", {
                    defaultValue: "Họ và tên",
                  })}
                </th>
                <th className={annualLeaveTableThClass}>
                  {t("annualLeave.tableColDepartment", {
                    defaultValue: "Bộ phận",
                  })}
                </th>
                <th className={annualLeaveTableThClass}>
                  {t("annualLeave.tableColStartDate", {
                    defaultValue: "Ngày vào làm",
                  })}
                </th>
                <th className={annualLeaveTableThClass}>
                  {t("annualLeave.tableColCurrentYearLeave", {
                    defaultValue: "Phép năm",
                  })}
                </th>
                <th className={annualLeaveTableThClass}>
                  {t("annualLeave.tableColUsedLeave", {
                    defaultValue: "Đã dùng",
                  })}
                </th>
                <th
                  className={`${annualLeaveTableThClass} annual-leave-balance-col-header`}
                >
                  {t("annualLeave.tableColBalance", { defaultValue: "Còn lại" })}
                </th>
                {monthColumnLabels.map((label) => (
                  <th
                    key={label}
                    className={`${annualLeaveTableThClass} min-w-[4.25rem] whitespace-nowrap`}
                  >
                    {label}
                  </th>
                ))}
                {canManage ? (
                  <th className={annualLeaveTableThClass}>
                    {t("annualLeave.adjustmentColumn", {
                      defaultValue: "Điều chỉnh",
                    })}
                  </th>
                ) : null}
                <th className={annualLeaveTableThClass}>
                  {t("annualLeave.detailColumn", {
                    defaultValue: "Chi tiết",
                  })}
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
                pagedRows.map(({ entry, row, index }) => (
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
