import { useMemo } from "react";
import {
  collectPayrollMonthSortedEmployeeIds,
  payrollMonthRepresentativeEmployee,
} from "@/features/payroll/payrollMonthlyGridData";

function chunkByDateFromList(chunks) {
  return new Map((chunks ?? []).map((c) => [c.dateKey, c]));
}

/** STT, rep, map ngày (display + live) từ chunk tháng. */
export function usePayrollMonthEmployeeIndex(dayChunks, displayDayChunks) {
  const sortedIds = useMemo(
    () => collectPayrollMonthSortedEmployeeIds(displayDayChunks),
    [displayDayChunks],
  );

  const repById = useMemo(() => {
    const m = new Map();
    for (const id of sortedIds) {
      m.set(id, payrollMonthRepresentativeEmployee(displayDayChunks, id));
    }
    return m;
  }, [sortedIds, displayDayChunks]);

  const chunkByDate = useMemo(
    () => chunkByDateFromList(displayDayChunks),
    [displayDayChunks],
  );

  const chunkByDateLive = useMemo(
    () => chunkByDateFromList(dayChunks),
    [dayChunks],
  );

  return { sortedIds, repById, chunkByDate, chunkByDateLive };
}
