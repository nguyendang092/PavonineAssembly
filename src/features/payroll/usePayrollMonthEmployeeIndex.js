import { useMemo } from "react";
import {
  collectPayrollMonthSortedEmployeeIds,
  payrollMonthDisplayMnvFromRowId,
  payrollMonthRepresentativeEmployee,
} from "@/features/payroll/payrollMonthlyGridData";

function chunkByDateFromList(chunks) {
  return new Map((chunks ?? []).map((c) => [c.dateKey, c]));
}

/** STT, rep, map ngày — dùng `dayChunks` (mới nhất), không `displayDayChunks` (deferred). */
export function usePayrollMonthEmployeeIndex(dayChunks, displayDayChunks) {
  const sortedIds = useMemo(
    () => collectPayrollMonthSortedEmployeeIds(dayChunks),
    [dayChunks],
  );

  const repById = useMemo(() => {
    const m = new Map();
    for (const id of sortedIds) {
      const rep =
        payrollMonthRepresentativeEmployee(dayChunks, id) ||
        Object.freeze({
          mnv: payrollMonthDisplayMnvFromRowId(id),
          monthEmployeeKey: id,
          boPhanAll: [],
        });
      m.set(id, rep);
    }
    return m;
  }, [sortedIds, dayChunks]);

  const chunkByDate = useMemo(
    () => chunkByDateFromList(dayChunks),
    [dayChunks],
  );

  const chunkByDateLive = useMemo(
    () => chunkByDateFromList(dayChunks),
    [dayChunks],
  );

  return { sortedIds, repById, chunkByDate, chunkByDateLive };
}
