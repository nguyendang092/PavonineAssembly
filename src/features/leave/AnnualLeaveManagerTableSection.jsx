import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUser } from "@/contexts/UserContext";
import { canManageAnnualLeave } from "@/config/authRoles";
import { db } from "@/services/firebase";
import { listAnnualLeaveManagerMonthColumnLabels } from "./annualLeaveCalculated";
import {
  buildAnnualLeaveMonthlyUsageByEmpKey,
  buildStoredMonthlyLeaveUsageByEmpKey,
  normalizeAnnualLeaveRowLive,
} from "./annualLeaveDerived";
import { filterAnnualLeaveManagerEntries } from "./annualLeaveManagerFilter";
import { persistAnnualLeaveEmployeeAdjustment } from "./annualLeaveAttendanceSync";
import { useAnnualLeaveAttendanceEnhancement } from "./useAnnualLeaveAttendanceEnhancement";
import AnnualLeaveManagerTablePanel from "./AnnualLeaveManagerTablePanel";
const EMPTY_MONTH_VALUES = Object.freeze(Array.from({ length: 12 }, () => 0));

function AnnualLeaveManagerTableSection({
  year,
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
    () => listAnnualLeaveManagerMonthColumnLabels(year),
    [year],
  );

  const liveMapsRef = useRef({
    deductionsByEmpKey: {},
    monthlyByEmpKey: {},
    monthWorkSummaryByEmpKey: {},
  });
  liveMapsRef.current = {
    deductionsByEmpKey,
    monthlyByEmpKey,
    monthWorkSummaryByEmpKey,
  };

  const normalizeEntryRow = useCallback(
    (entry) => {
      const maps = liveMapsRef.current;
      return normalizeAnnualLeaveRowLive(
        entry.id,
        entry._raw,
        maps.deductionsByEmpKey,
        year,
        maps.monthlyByEmpKey[entry.id] ?? EMPTY_MONTH_VALUES,
        maps.monthWorkSummaryByEmpKey[entry.id] ?? null,
      );
    },
    [year],
  );

  useEffect(() => {
    if (!exportRef) return;
    exportRef.current = {
      getExportRows(filters) {
        return filterAnnualLeaveManagerEntries(entries, filters, deptIndex)
          .map((entry) => normalizeEntryRow(entry))
          .filter(Boolean);
      },
      getMonthlyByEmpKey: () => liveMapsRef.current.monthlyByEmpKey,
      getMonthColumnLabels: () => monthColumnLabels,
    };
  }, [deptIndex, entries, exportRef, monthColumnLabels, normalizeEntryRow]);

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
      monthColumnLabels={monthColumnLabels}
      detailThroughDateKey={detailThroughDateKey}
      filterPending={filterPending}
      attendanceEnhancing={attendanceEnhancing}
      normalizeEntryRow={normalizeEntryRow}
      canManage={canManageLeave}
      adjustmentSavingId={adjustmentSavingId}
      onAdjustmentSave={handleAdjustmentSave}
    />
  );
}

export default memo(AnnualLeaveManagerTableSection);
