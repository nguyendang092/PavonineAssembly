import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUser } from "@/contexts/UserContext";
import { canManageAnnualLeave } from "@/config/authRoles";
import { db } from "@/services/firebase";
import { listAnnualLeaveManagerMonthColumnLabels } from "./annualLeaveCalculated";
import {
  buildAnnualLeaveMonthlyUsageByEmpKey,
  buildStoredMonthlyLeaveUsageByEmpKey,
  normalizeAnnualLeaveRowLive,
  normalizeAnnualLeaveRowStored,
} from "./annualLeaveDerived";
import { filterAnnualLeaveManagerEntries } from "./annualLeaveManagerFilter";
import { persistAnnualLeaveEmployeeAdjustment } from "./annualLeaveAttendanceSync";
import { useAnnualLeaveAttendanceEnhancement } from "./useAnnualLeaveAttendanceEnhancement";
import {
  filterAnnualLeaveManagerMonthColumnLabels,
  filterAnnualLeaveManagerMonthValues,
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
  detailThroughDateKey,
  filterPending,
  exportRef,
  canManage = false,
  onAdjustmentSaved,
  onAdjustmentSaveError,
}) {
  const { t } = useTranslation();
  const { user, userRole } = useUser();
  const canManageLeave = canManage || canManageAnnualLeave(user, userRole);
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

  const storedMonthlyByEmpKey = useMemo(
    () => buildStoredMonthlyLeaveUsageByEmpKey(yearData),
    [yearData],
  );

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

  const storedRowByEmpKey = useMemo(() => {
    const map = {};
    for (const entry of filteredEntries) {
      const monthValues = storedMonthlyByEmpKey[entry.id] ?? EMPTY_MONTH_VALUES;
      const row = normalizeAnnualLeaveRowStored(
        entry.id,
        entry._raw,
        year,
        monthValues,
        { usageThroughMonthIndex },
      );
      if (row) map[entry.id] = row;
    }
    return map;
  }, [
    filteredEntries,
    storedMonthlyByEmpKey,
    year,
    usageThroughMonthIndex,
  ]);

  const normalizeEntryRow = useCallback(
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
          preferStoredCurrentYear: !attendanceAccrualReady,
        },
      );
    },
    [
      attendanceAccrualReady,
      deductionsByEmpKey,
      detailThroughDateKey,
      monthlyByEmpKey,
      monthWorkSummaryByEmpKey,
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
        if (!attendanceCalculated) {
          return filtered
            .map((entry) => {
              const monthValues =
                storedMonthlyByEmpKey[entry.id] ?? EMPTY_MONTH_VALUES;
              return normalizeAnnualLeaveRowStored(
                entry.id,
                entry._raw,
                year,
                monthValues,
                { usageThroughMonthIndex },
              );
            })
            .filter(Boolean);
        }
        return filtered.map((entry) => normalizeEntryRow(entry)).filter(Boolean);
      },
      getMonthlyByEmpKey: () => monthlyByEmpKey,
      getMonthColumnLabels: () => monthColumnLabels,
    };
  }, [
    attendanceCalculated,
    deptIndex,
    entries,
    exportRef,
    monthColumnLabels,
    monthlyByEmpKey,
    normalizeEntryRow,
    storedMonthlyByEmpKey,
    usageThroughMonthIndex,
    year,
  ]);

  const handleAdjustmentSave = useCallback(
    async (empKey, adjustment, raw) => {
      if (!canManageLeave || !empKey || !raw) return;
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
      canManageLeave,
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
      filterPending={filterPending}
      attendanceEnhancing={attendanceEnhancing}
      attendanceUsageReady={attendanceUsageReady}
      attendanceAccrualReady={attendanceAccrualReady}
      attendanceCalculated={attendanceCalculated}
      storedRowByEmpKey={storedRowByEmpKey}
      storedMonthlyByEmpKey={storedMonthlyByEmpKey}
      normalizeEntryRow={normalizeEntryRow}
      canManage={canManageLeave}
      adjustmentSavingId={adjustmentSavingId}
      onAdjustmentSave={handleAdjustmentSave}
    />
  );
}

export default memo(AnnualLeaveManagerTableSection);
