import { memo, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import AttendanceListShell from "./AttendanceListShell";
import { attendanceListDateForAnnualLeaveYear } from "@/features/leave/annualLeaveCrossLinks";
import "./attendanceSidebar.css";

function AttendanceHrPageShell({
  children,
  contextDate,
  statisticsOpen,
  onOpenStatistics,
}) {
  const [searchParams] = useSearchParams();

  const resolvedContextDate = useMemo(() => {
    if (contextDate && /^\d{4}-\d{2}-\d{2}$/.test(contextDate)) {
      return contextDate;
    }
    const fromDate = searchParams.get("date");
    if (fromDate && /^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
      return fromDate;
    }
    const yearRaw = searchParams.get("year");
    if (yearRaw && /^\d{4}$/.test(yearRaw)) {
      return attendanceListDateForAnnualLeaveYear(Number(yearRaw));
    }
    return new Date().toISOString().slice(0, 10);
  }, [contextDate, searchParams]);

  return (
    <AttendanceListShell
      contextDate={resolvedContextDate}
      statisticsOpen={statisticsOpen}
      onOpenStatistics={onOpenStatistics}
    >
      {children}
    </AttendanceListShell>
  );
}

export default memo(AttendanceHrPageShell);
