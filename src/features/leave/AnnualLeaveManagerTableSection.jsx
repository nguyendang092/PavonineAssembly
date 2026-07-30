import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { listAnnualLeaveManagerMonthColumnLabels } from "./annualLeaveCalculated";
import {
  buildAnnualLeaveMonthlyUsageByEmpKey,
  buildStoredMonthlyLeaveUsageByEmpKey,
  normalizeAnnualLeaveRowLive,
} from "./annualLeaveDerived";
import { filterAnnualLeaveManagerEntries } from "./annualLeaveManagerFilter";
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
}) {
  const {
    deductionsByEmpKey,
    attendanceMonthlyByEmpKey,
    monthWorkSummaryByEmpKey,
    attendanceEnhancing,
  } = useAnnualLeaveAttendanceEnhancement(year, yearData, {
    includePayrollMonthAccrual: true,
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
    />
  );
}

export default memo(AnnualLeaveManagerTableSection);
