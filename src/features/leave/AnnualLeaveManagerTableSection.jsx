import { memo, useMemo } from "react";
import { listAnnualLeaveManagerMonthColumnLabels } from "./annualLeaveCalculated";
import {
  filterAnnualLeaveManagerMonthColumnLabels,
} from "./annualLeaveManagerMonthFilter";
import AnnualLeaveManagerTablePanel from "./AnnualLeaveManagerTablePanel";

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
  const monthColumnLabels = useMemo(
    () =>
      filterAnnualLeaveManagerMonthColumnLabels(
        listAnnualLeaveManagerMonthColumnLabels(year),
        monthFilter,
      ),
    [year, monthFilter],
  );

  return (
    <AnnualLeaveManagerTablePanel
      filteredEntries={filteredEntries}
      entries={entries}
      deptIndex={deptIndex}
      storedMonthlyByEmpKey={storedMonthlyByEmpKey}
      yearData={yearData}
      year={year}
      monthFilter={monthFilter}
      monthColumnLabels={monthColumnLabels}
      detailThroughDateKey={detailThroughDateKey}
      exportRef={exportRef}
      canManage={canManage}
      onAdjustmentSaved={onAdjustmentSaved}
      onAdjustmentSaveError={onAdjustmentSaveError}
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
