import { memo, useEffect, useMemo } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useTodayDateKeyLocal } from "@/hooks/useTodayDateKeyLocal";
import AttendanceListShell from "./AttendanceListShell";
import { attendanceListDateForAnnualLeaveYear } from "@/features/leave/annualLeaveCrossLinks";
import { isProductionLayoutPath } from "@/features/production/productionSidebarConfig";
import "./attendanceSidebar.css";
import "./hrPageViewport.css";

function AttendanceHrPageShell({
  children,
  contextDate,
  statisticsOpen,
  onOpenStatistics,
}) {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const todayKey = useTodayDateKeyLocal();
  const inProductionLayout = isProductionLayoutPath(pathname);

  useEffect(() => {
    const root = document.getElementById("app-main-scroll");
    root?.classList.add("hr-page-scroll-root");
    document.documentElement.classList.add("hr-page-active");

    return () => {
      root?.classList.remove("hr-page-scroll-root");
      document.documentElement.classList.remove("hr-page-active");
    };
  }, []);

  useEffect(() => {
    document.getElementById("hr-page-main-scroll")?.scrollTo(0, 0);
    document.getElementById("app-main-scroll")?.scrollTo(0, 0);
  }, [pathname]);

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
      return attendanceListDateForAnnualLeaveYear(Number(yearRaw), todayKey);
    }
    return todayKey;
  }, [contextDate, searchParams, todayKey]);

  if (inProductionLayout) {
    return <div className="hr-page-body">{children}</div>;
  }

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
