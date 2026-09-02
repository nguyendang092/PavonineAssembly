import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { listAnnualLeaveCalendarYearMonths } from "./annualLeaveCalculated";
import {
  filterAnnualLeaveManagerMonthColumnLabels,
} from "./annualLeaveManagerMonthFilter";
import AnnualLeaveManagerTablePanel from "./AnnualLeaveManagerTablePanel";

function buildLocalizedMonthColumnLabels(year, t) {
  const y = Number(year);
  if (!Number.isFinite(y)) return [];
  const yy = String(y).slice(2);
  return listAnnualLeaveCalendarYearMonths(y).map((yearMonth) => {
    const month = Number(String(yearMonth).slice(5, 7));
    return t("annualLeave.tableMonthColumn", {
      month,
      year: yy,
      defaultValue: `T${month}-${yy}`,
    });
  });
}

function AnnualLeaveManagerTableSection({
  year,
  monthFilter = "",
  entries,
  deptIndex,
  filteredEntries,
  tableFilterKey = "",
  filterPending = false,
  lazyLoadRequired = false,
  totalEmployeeCount = 0,
  storedMonthlyByEmpKey = {},
  detailThroughDateKey,
  exportRef,
  canManage = false,
  onAdjustmentSaved,
  onAdjustmentSaveError,
}) {
  const { t } = useTranslation();
  const monthColumnLabels = useMemo(
    () =>
      filterAnnualLeaveManagerMonthColumnLabels(
        buildLocalizedMonthColumnLabels(year, t),
        monthFilter,
      ),
    [year, monthFilter, t],
  );

  return (
    <AnnualLeaveManagerTablePanel
      filteredEntries={filteredEntries}
      tableFilterKey={tableFilterKey}
      filterPending={filterPending}
      lazyLoadRequired={lazyLoadRequired}
      totalEmployeeCount={totalEmployeeCount}
      entries={entries}
      deptIndex={deptIndex}
      storedMonthlyByEmpKey={storedMonthlyByEmpKey}
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
    prev.entries === next.entries &&
    prev.deptIndex === next.deptIndex &&
    prev.filteredEntries === next.filteredEntries &&
    prev.tableFilterKey === next.tableFilterKey &&
    prev.filterPending === next.filterPending &&
    prev.lazyLoadRequired === next.lazyLoadRequired &&
    prev.totalEmployeeCount === next.totalEmployeeCount &&
    prev.storedMonthlyByEmpKey === next.storedMonthlyByEmpKey &&
    prev.detailThroughDateKey === next.detailThroughDateKey &&
    prev.exportRef === next.exportRef &&
    prev.canManage === next.canManage &&
    prev.onAdjustmentSaved === next.onAdjustmentSaved &&
    prev.onAdjustmentSaveError === next.onAdjustmentSaveError
  );
}

export default memo(AnnualLeaveManagerTableSection, areTableSectionPropsEqual);
