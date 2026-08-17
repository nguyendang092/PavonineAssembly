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

function buildScopeEmpKeySet(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const set = new Set(entries.map((entry) => entry.id).filter(Boolean));
  return set.size > 0 ? set : null;
}

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

  const scopeEmpKeySet = useMemo(
    () => buildScopeEmpKeySet(filteredEntries),
    [filteredEntries],
  );

  const {
    deductionsByEmpKey,
    attendanceMonthlyByEmpKey,
    monthWorkSummaryByEmpKey,
    accrualAsOfDateKey,
    attendanceEnhancing,
    attendanceUsageReady,
    attendanceAccrualReady,
  } = useAnnualLeaveAttendanceEnhancement(year, yearData, {
    includePayrollMonthAccrual: true,
    throughDateKey: detailThroughDateKey,
    scopeEmpKeySet,
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

  const displayRowByEmpKey = useMemo(() => {
    const map = new Map();
    for (const entry of filteredEntries) {
      const monthValues = monthlyByEmpKey[entry.id] ?? EMPTY_MONTH_VALUES;
      if (attendanceUsageReady) {
        const row = normalizeAnnualLeaveRowLive(
          entry.id,
          entry._raw,
          deductionsByEmpKey,
          year,
          monthValues,
          attendanceAccrualReady
            ? monthWorkSummaryByEmpKey[entry.id] ?? null
            : null,
          {
            asOfDateKey: accrualAsOfDateKey,
            usageThroughMonthIndex,
          },
        );
        if (row) map.set(entry.id, row);
        continue;
      }

      const storedRow = normalizeAnnualLeaveRowStored(
        entry.id,
        entry._raw,
        year,
        storedMonthlyByEmpKey[entry.id] ?? monthValues,
        { usageThroughMonthIndex },
      );
      if (storedRow) map.set(entry.id, storedRow);
    }
    return map;
  }, [
    accrualAsOfDateKey,
    attendanceAccrualReady,
    attendanceUsageReady,
    deductionsByEmpKey,
    filteredEntries,
    monthWorkSummaryByEmpKey,
    monthlyByEmpKey,
    storedMonthlyByEmpKey,
    usageThroughMonthIndex,
    year,
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
      displayRowByEmpKey={displayRowByEmpKey}
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
