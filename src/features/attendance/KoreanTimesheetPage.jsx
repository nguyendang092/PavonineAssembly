import React from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUser } from "@/contexts/UserContext";
import { canViewKoreanTimesheet } from "@/config/featurePermissions";
import AttendanceList from "./AttendanceList";
import { KOREAN_ATTENDANCE_ROOT } from "./attendanceSeasonalStt";

export default function KoreanTimesheetPage() {
  const { t } = useTranslation();
  const { user, userRole } = useUser();

  if (!canViewKoreanTimesheet(user, userRole)) {
    return <Navigate to="/attendance-list" replace />;
  }

  return (
    <AttendanceList
      attendanceRootPath={KOREAN_ATTENDANCE_ROOT}
      headerTitle={t(
        "attendanceList.koreanActiveEmployeesTitle",
        "KOREAN TIMESHEET",
      )}
      headerSubtitle={t(
        "attendanceList.koreanActiveEmployeesSubtitle",
        "Korean Staff Attendance",
      )}
      counterpartLinkTo={null}
    />
  );
}
