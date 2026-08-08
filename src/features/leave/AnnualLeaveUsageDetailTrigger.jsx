import {
  lazy,
  memo,
  startTransition,
  Suspense,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { annualLeaveEmpFirebaseKey } from "./annualLeaveEmpKey";
import {
  buildAnnualLeaveDetailModalRowFromEmp,
  buildAnnualLeaveDetailModalRowFromManagerRow,
} from "./annualLeaveModalRowFromEmp";
import "./annualLeaveManager.css";

const AnnualLeaveUsageDetailModal = lazy(
  () => import("./AnnualLeaveUsageDetailModal"),
);

function AnnualLeaveUsageDetailTrigger({
  emp = null,
  /** Hàng từ bảng quản lý phép năm — dùng thay `emp` điểm danh/lương */
  managerRow = null,
  year,
  yearData = null,
  attendanceRootPath = "attendance",
  throughDateKey = null,
  className = "",
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const empKey = managerRow?.id ?? annualLeaveEmpFirebaseKey(emp?.mnv);
  const row = useMemo(() => {
    if (managerRow) return buildAnnualLeaveDetailModalRowFromManagerRow(managerRow);
    return buildAnnualLeaveDetailModalRowFromEmp(emp, yearData);
  }, [managerRow, emp, yearData]);

  if (!empKey || !row) return null;

  return (
    <>
      <button
        type="button"
        className={`annual-leave-inline-detail-btn ${className}`.trim()}
        onClick={() => startTransition(() => setOpen(true))}
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
      {open ? (
        <Suspense fallback={null}>
          <AnnualLeaveUsageDetailModal
            open={open}
            onClose={() => setOpen(false)}
            row={row}
            year={year}
            t={t}
            empKey={empKey}
            attendanceRootPath={attendanceRootPath}
            throughDateKey={throughDateKey}
          />
        </Suspense>
      ) : null}
    </>
  );
}

export default memo(AnnualLeaveUsageDetailTrigger);
