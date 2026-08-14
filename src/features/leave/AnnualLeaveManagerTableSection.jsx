import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUser } from "@/contexts/UserContext";
import { db } from "@/services/firebase";
import { listAnnualLeaveManagerMonthColumnLabels } from "./annualLeaveCalculated";
import {
  buildAnnualLeaveMonthlyUsageByEmpKey,
  normalizeAnnualLeaveRowLive,
  normalizeAnnualLeaveRowStored,
} from "./annualLeaveDerived";
import { filterAnnualLeaveManagerEntries } from "./annualLeaveManagerFilter";
import { persistAnnualLeaveEmployeeAdjustment } from "./annualLeaveAttendanceSync";
import { useAnnualLeaveAttendanceEnhancement } from "./useAnnualLeaveAttendanceEnhancement";
import {
  filterAnnualLeaveManagerMonthColumnLabels,
  resolveAnnualLeaveManagerMonthIndex,
} from "./annualLeaveManagerMonthFilter";
import AnnualLeaveManagerTablePanel from "./AnnualLeaveManagerTablePanel";

const EMPTY_MONTH_VALUES = Object.freeze(Array.from({ length: 12 }, () => 0));

function AnnualLeaveManagerTableSection({
  year,
  monthFilter = "",
  yearData,
  entries,
  deptIndex,
  filteredEntries,
  storedMonthlyByEmpKey = {},
  detailThroughDateKey,
  exportRef,
  canManage = false,
  onAdjustmentSaved,
  onAdjustmentSaveError,
}) {
  const { t } = useTranslation();
  const { user } = useUser();
  const [adjustmentSavingId, setAdjustmentSavingId] = useState("");

  const {
    deductionsByEmpKey,
    attendanceMonthlyByEmpKey,
    monthWorkSummaryByEmpKey,
    attendanceEnhancing,
    attendanceUsageReady,
    attendanceAccrualReady,
    attendanceCalculated,
  } = useAnnualLeaveAttendanceEnhancement(year, yearData, {
    includePayrollMonthAccrual: true,
    throughDateKey: detailThroughDateKey,
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

  const monthColumnLabels = useMemo(
    () =>
      filterAnnualLeaveManagerMonthColumnLabels(
        listAnnualLeaveManagerMonthColumnLabels(year),
        monthFilter,
      ),
    [year, monthFilter],
  );

  const usageThroughMonthIndex = resolveAnnualLeaveManagerMonthIndex(monthFilter);

  const normalizeLiveEntryRow = useCallback(
    (entry) => {
      const monthValues = monthlyByEmpKey[entry.id] ?? EMPTY_MONTH_VALUES;
      return normalizeAnnualLeaveRowLive(
        entry.id,
        entry._raw,
        deductionsByEmpKey,
        year,
        monthValues,
        monthWorkSummaryByEmpKey[entry.id] ?? null,
        {
          asOfDateKey: detailThroughDateKey,
          usageThroughMonthIndex,
        },
      );
    },
    [
      deductionsByEmpKey,
      detailThroughDateKey,
      monthlyByEmpKey,
      monthWorkSummaryByEmpKey,
      usageThroughMonthIndex,
      year,
    ],
  );

  const resolveDisplayRow = useCallback(
    (entry) => {
      if (attendanceCalculated) {
        return normalizeLiveEntryRow(entry);
      }
      const monthValues = storedMonthlyByEmpKey[entry.id] ?? EMPTY_MONTH_VALUES;
      return normalizeAnnualLeaveRowStored(
        entry.id,
        entry._raw,
        year,
        monthValues,
        { usageThroughMonthIndex },
      );
    },
    [
      attendanceCalculated,
      normalizeLiveEntryRow,
      storedMonthlyByEmpKey,
      usageThroughMonthIndex,
      year,
    ],
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
        return filtered.map((entry) => resolveDisplayRow(entry)).filter(Boolean);
      },
      getMonthlyByEmpKey: () => monthlyByEmpKey,
      getMonthColumnLabels: () => monthColumnLabels,
    };
  }, [
    deptIndex,
    entries,
    exportRef,
    monthColumnLabels,
    monthlyByEmpKey,
    resolveDisplayRow,
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

  return (
    <AnnualLeaveManagerTablePanel
      filteredEntries={filteredEntries}
      monthlyByEmpKey={monthlyByEmpKey}
      year={year}
      monthFilter={monthFilter}
      monthColumnLabels={monthColumnLabels}
      detailThroughDateKey={detailThroughDateKey}
      attendanceEnhancing={attendanceEnhancing}
      attendanceUsageReady={attendanceUsageReady}
      attendanceAccrualReady={attendanceAccrualReady}
      storedMonthlyByEmpKey={storedMonthlyByEmpKey}
      resolveDisplayRow={resolveDisplayRow}
      canManage={canManage}
      adjustmentSavingId={adjustmentSavingId}
      onAdjustmentSave={handleAdjustmentSave}
    />
  );
}

function areTableSectionPropsEqual(prev, next) {
  return (
    prev.year === next.year &&
    prev.monthFilter === next.monthFilter &&
    prev.yearData === next.yearData &&
    prev.entries === next.entries &&
    prev.deptIndex === next.deptIndex &&
    prev.filteredEntries === next.filteredEntries &&
    prev.storedMonthlyByEmpKey === next.storedMonthlyByEmpKey &&
    prev.detailThroughDateKey === next.detailThroughDateKey &&
    prev.exportRef === next.exportRef &&
    prev.canManage === next.canManage &&
    prev.onAdjustmentSaved === next.onAdjustmentSaved &&
    prev.onAdjustmentSaveError === next.onAdjustmentSaveError
  );
}

export default memo(AnnualLeaveManagerTableSection, areTableSectionPropsEqual);
