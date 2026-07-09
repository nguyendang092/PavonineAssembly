import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { formatAnnualLeaveDecimal } from "./annualLeaveCalculated";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import { buildEmployeeAttendanceDayRow } from "./annualLeaveEmployeeTimeRows";
import {
  getAttendanceYearSnapshot,
  isAttendanceYearSnapshotReady,
  subscribeAttendanceYear,
} from "./annualLeaveLiveStore";
import "./annualLeaveLeaveDayDetailPopup.css";

function formatDateKeyVi(dateKey) {
  if (!dateKey || typeof dateKey !== "string") return dateKey;
  const [y, m, d] = dateKey.split("-");
  if (!y || !m || !d) return dateKey;
  return `${d}/${m}/${y}`;
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 11h18" />
    </svg>
  );
}

function ClockInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 1.5" />
      <path d="M16 4l2-2" />
    </svg>
  );
}

function ClockOutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5" />
      <path d="M8 20l-2 2" />
    </svg>
  );
}

function ShiftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 7h16M4 12h10M4 17h14" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5a1.25 1.25 0 1 1 0 2.5A1.25 1.25 0 0 1 12 7zm-1 4h2v7h-2v-7z" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2 1 21h22L12 2zm0 5 7.5 13h-15L12 7zm-1 3v5h2v-5h-2zm0 6v2h2v-2h-2z" />
    </svg>
  );
}

function InfoCard({ icon, label, value, wide = false }) {
  return (
    <div
      className={`al-day-detail-info-card${wide ? " al-day-detail-info-card-wide" : ""}`}
    >
      <span className="al-day-detail-info-icon">{icon}</span>
      <div className="al-day-detail-info-text">
        <span className="al-day-detail-info-label">{label}</span>
        <span className="al-day-detail-info-value">{value}</span>
      </div>
    </div>
  );
}

export default function AnnualLeaveLeaveDayDetailPopup({
  open,
  onClose,
  row,
  leaveDay,
  empKey,
  attendanceRootPath = "attendance",
  throughDateKey = null,
  year,
  t,
}) {
  const [loading, setLoading] = useState(false);
  const [attendanceRoot, setAttendanceRoot] = useState({});

  const dateKey = leaveDay?.dateKey ?? "";

  useEffect(() => {
    if (!open || !empKey || !dateKey) {
      setAttendanceRoot({});
      setLoading(false);
      return;
    }

    let cancelled = false;

    const rebuild = () => {
      if (!isAttendanceYearSnapshotReady(attendanceRootPath, year, throughDateKey)) {
        return;
      }
      if (cancelled) return;
      setAttendanceRoot(
        getAttendanceYearSnapshot(attendanceRootPath, year, throughDateKey) ?? {},
      );
      setLoading(false);
    };

    setLoading(true);
    rebuild();

    const unsubscribe = subscribeAttendanceYear(
      attendanceRootPath,
      year,
      rebuild,
      throughDateKey,
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [open, empKey, dateKey, attendanceRootPath, year, throughDateKey]);

  const dayRow = useMemo(
    () => buildEmployeeAttendanceDayRow(attendanceRoot, dateKey, empKey),
    [attendanceRoot, dateKey, empKey],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !row || !leaveDay) return null;

  const name = row[ANNUAL_LEAVE_EMP.FULL_NAME] ?? "";
  const mnv = String(row[ANNUAL_LEAVE_EMP.MNV_PREFIX] ?? "").trim();
  const leaveTypeLabel =
    dayRow?.leaveType && dayRow.leaveType !== "—"
      ? dayRow.leaveType
      : leaveDay.type === "PN"
        ? "PN"
        : String(leaveDay.type ?? "").trim() || "1/2PN";
  const isHalfLeave =
    leaveTypeLabel === "1/2PN" ||
    String(leaveDay.type ?? "").toUpperCase().includes("1/2");
  const deductionLabel = formatAnnualLeaveDecimal(leaveDay.deduction ?? 0);
  const dayUnit = t("annualLeave.dayUnit", { defaultValue: "Ngày" });

  return createPortal(
    <div className="al-day-detail-overlay" onClick={onClose} role="presentation">
      <div
        className="al-day-detail-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="al-day-detail-popup-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="al-day-detail-header">
          <div className="al-day-detail-header-top">
            <p className="al-day-detail-kicker">
              {t("annualLeave.leaveDayDetailKicker", {
                defaultValue: "Chi tiết ngày nghỉ",
              })}
            </p>
            <button
              type="button"
              className="al-day-detail-close"
              onClick={onClose}
              aria-label={t("annualLeave.close", { defaultValue: "Đóng" })}
            >
              ✕
            </button>
          </div>
          <h3 id="al-day-detail-popup-title" className="al-day-detail-employee-name">
            {name || "—"}
          </h3>
          {mnv ? (
            <p className="al-day-detail-mnv">
              <span className="al-day-detail-mnv-label">MNV</span>
              <span className="al-day-detail-mnv-value">{mnv}</span>
            </p>
          ) : null}
          <p className="al-day-detail-date">
            <CalendarIcon />
            <span>{formatDateKeyVi(dateKey)}</span>
          </p>
        </header>

        <div className="al-day-detail-body">
          {loading ? (
            <div className="al-day-detail-loading" aria-busy="true">
              <div className="al-day-detail-loading-dots" aria-hidden>
                <span />
                <span />
                <span />
              </div>
              <span>
                {t("annualLeave.leaveDayDetailLoading", {
                  defaultValue: "Đang tải dữ liệu điểm danh…",
                })}
              </span>
            </div>
          ) : (
            <>
              <div className="al-day-detail-hero">
                <div
                  className={`al-day-detail-type-badge ${
                    isHalfLeave
                      ? "al-day-detail-type-badge-half"
                      : "al-day-detail-type-badge-pn"
                  }`}
                >
                  <span className="al-day-detail-type-badge-label">
                    {t("annualLeave.leaveDayDetailLeaveType", {
                      defaultValue: "Loại phép",
                    })}
                  </span>
                  <span className="al-day-detail-type-badge-value">
                    {leaveTypeLabel}
                  </span>
                </div>
                <div className="al-day-detail-deduction-card">
                  <span className="al-day-detail-deduction-label">
                    {t("annualLeave.leaveDayDetailDeduction", {
                      defaultValue: "Trừ phép",
                    })}
                  </span>
                  <span className="al-day-detail-deduction-value">
                    {deductionLabel}
                  </span>
                  <span className="al-day-detail-deduction-unit">{dayUnit}</span>
                </div>
              </div>

              <div className="al-day-detail-cards">
                <InfoCard
                  icon={<ClockInIcon />}
                  label={t("annualLeave.workHoursInColumn", {
                    defaultValue: "Giờ vào",
                  })}
                  value={dayRow?.timeIn ?? "—"}
                />
                <InfoCard
                  icon={<ClockOutIcon />}
                  label={t("annualLeave.workHoursOutColumn", {
                    defaultValue: "Giờ ra",
                  })}
                  value={dayRow?.timeOut ?? "—"}
                />
                <InfoCard
                  icon={<ShiftIcon />}
                  label={t("annualLeave.workHoursShiftColumn", {
                    defaultValue: "Ca",
                  })}
                  value={dayRow?.shift ?? "—"}
                  wide
                />
              </div>

              {leaveDay.displayOnly ? (
                <p className="al-day-detail-note">
                  <InfoIcon />
                  {t("annualLeave.displayOnlyMonthTag", {
                    defaultValue: "Lịch sử cũ",
                  })}
                  {" — "}
                  {t("annualLeave.leaveDayDetailTrialNote", {
                    defaultValue: "Không trừ vào phép năm chính thức",
                  })}
                </p>
              ) : null}

              {dayRow && !dayRow.hasRecord ? (
                <p className="al-day-detail-missing">
                  <WarningIcon />
                  {t("annualLeave.leaveDayDetailNoAttendance", {
                    defaultValue: "Không có bản ghi điểm danh cho ngày này",
                  })}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
