import { memo, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import AttendanceListShell from "./AttendanceListShell";
import { attendanceListDateForAnnualLeaveYear } from "@/features/leave/annualLeaveCrossLinks";
import "./attendanceSidebar.css";
import "./hrPageViewport.css";

function AttendanceHrPageShell({
  children,
  contextDate,
  statisticsOpen,
  onOpenStatistics,
}) {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const root = document.getElementById("app-main-scroll");
    root?.classList.add("hr-page-scroll-root");
    document.documentElement.classList.add("hr-page-active");

    return () => {
      root?.classList.remove("hr-page-scroll-root");
      document.documentElement.classList.remove("hr-page-active");
    };
  }, []);

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
