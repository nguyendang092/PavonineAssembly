import { memo, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { buildAttendanceAnnualLeaveUsageDetailForEmpKey } from "./annualLeaveBalanceLookup";
import { annualLeaveEmpFirebaseKey } from "./annualLeaveEmpKey";
import { buildAnnualLeaveDetailModalRowFromEmp } from "./annualLeaveModalRowFromEmp";
import {
  getAttendanceYearSnapshot,
  subscribeAttendanceYear,
} from "./annualLeaveLiveStore";
import AnnualLeaveUsageDetailModal from "./AnnualLeaveUsageDetailModal";
import "./annualLeaveManager.css";

function AnnualLeaveUsageDetailTrigger({
  emp,
  year,
  yearData = null,
  attendanceRootPath = "attendance",
  throughDateKey = null,
  className = "",
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);

  const empKey = annualLeaveEmpFirebaseKey(emp?.mnv);
  const row = useMemo(
    () => buildAnnualLeaveDetailModalRowFromEmp(emp, yearData),
    [emp, yearData],
  );

  const detailFilter = useMemo(
    () => (throughDateKey ? { throughDateKey } : null),
    [throughDateKey],
  );

  useEffect(() => {
    if (!open || !empKey) {
      setDetail(null);
      return;
    }

    const rebuild = () => {
      const attendanceRoot = getAttendanceYearSnapshot(
        attendanceRootPath,
        year,
        throughDateKey,
      );
      if (!attendanceRoot) return;
      setDetail(
        buildAttendanceAnnualLeaveUsageDetailForEmpKey(
          attendanceRoot,
          year,
          empKey,
          detailFilter,
        ),
      );
    };

    rebuild();
    return subscribeAttendanceYear(
      attendanceRootPath,
      year,
      rebuild,
      throughDateKey,
    );
  }, [
    open,
    empKey,
    attendanceRootPath,
    year,
    throughDateKey,
    detailFilter,
  ]);

  if (!empKey) return null;

  return (
    <>
      <button
        type="button"
        className={`annual-leave-inline-detail-btn ${className}`.trim()}
        onClick={() => setOpen(true)}
        title={t("annualLeave.viewUsageDetail")}
        aria-label={t("annualLeave.viewUsageDetail")}
      >
        <svg
          className="annual-leave-inline-detail-btn-icon"
          viewBox="0 0 16 16"
          width="13"
          height="13"
          aria-hidden
          focusable="false"
        >
          <path
            fill="currentColor"
            d="M6.75 2.5a4.25 4.25 0 1 0 2.98 7.18l3.56 3.56a.75.75 0 1 0 1.06-1.06l-3.56-3.56A4.25 4.25 0 0 0 6.75 2.5zm0 1.5a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5z"
          />
        </svg>
      </button>
      <AnnualLeaveUsageDetailModal
        open={open}
        onClose={() => setOpen(false)}
        row={row}
        detail={detail}
        year={year}
        t={t}
      />
    </>
  );
}

export default memo(AnnualLeaveUsageDetailTrigger);
