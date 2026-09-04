import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AttendanceDailyReportTable from "./AttendanceDailyReportTable";
import AttendanceDailyReportMetrics from "./AttendanceDailyReportMetrics";
import PayrollMonthGridLoadingOverlay from "@/features/payroll/PayrollMonthGridLoadingOverlay";
import {
  buildAttendanceDailyReportGrid,
  buildDailyReportDashboardMetrics,
} from "./attendanceDailyReportStats";
import {
  exportAttendanceDailyReportExcel,
  exportAttendanceDailyReportImage,
} from "./attendanceDailyReportExport";
import { useAttendanceDailyReportData } from "./useAttendanceDailyReportData";
import { ISO_DATE_KEY_RE } from "./attendanceListShared";
import { useSelectedDateWithTodayRollover } from "@/hooks/useSelectedDateWithTodayRollover";
import "./attendanceDailyReport.css";
import "./hrPageCompact.css";

function AttendanceDailyReportPage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const exportRef = useRef(null);
  const [exportingImage, setExportingImage] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const dateFromUrl = searchParams.get("date");
  const urlDateKey =
    dateFromUrl && ISO_DATE_KEY_RE.test(dateFromUrl) ? dateFromUrl : null;
  const { selectedDate, setSelectedDate } =
    useSelectedDateWithTodayRollover(urlDateKey);

  useEffect(() => {
    if (selectedDate === dateFromUrl) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("date", selectedDate);
        return next;
      },
      { replace: true },
    );
  }, [selectedDate, dateFromUrl, setSearchParams]);

  const displayLocale = useMemo(() => {
    const lang = (i18n.language || "vi").toLowerCase();
    return lang.startsWith("ko") ? "ko-KR" : "vi-VN";
  }, [i18n.language]);

  const tl = useCallback(
    (key, defaultValue, options) =>
      t(`attendanceList.${key}`, defaultValue, options),
    [t],
  );

  const {
    loading,
    isRevalidating,
    refresh,
    error,
    regularEmployees,
    seasonalEmployees,
    dayMeta,
  } = useAttendanceDailyReportData(selectedDate);

  const report = useMemo(
    () =>
      buildAttendanceDailyReportGrid(regularEmployees, seasonalEmployees, {
        locale: displayLocale,
      }),
    [regularEmployees, seasonalEmployees, displayLocale],
  );

  const metrics = useMemo(
    () => buildDailyReportDashboardMetrics(report.rows, report.summary),
    [report],
  );

  const formattedDateChip = useMemo(() => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    if (!y || !m || !d) return selectedDate;
    return new Date(y, m - 1, d).toLocaleDateString(displayLocale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [selectedDate, displayLocale]);

  const labels = useMemo(
    () => ({
      process: tl("dailyReportProcess", "Công đoạn"),
      category: tl("dailyReportCategory", "Phân loại"),
      dayShift: tl("dailyReportDayShift", "Ca ngày"),
      nightShift: tl("dailyReportNightShift", "Ca đêm"),
      headcount: tl("dailyReportHeadcount", "Tổng NS"),
      absence: tl("dailyReportAbsence", "Vắng / phép"),
      present: tl("dailyReportPresent", "Hiện diện"),
      absenceRate: tl("dailyReportAbsenceRate", "Tỷ lệ vắng"),
      remarks: tl("dailyReportRemarks", "Ghi chú"),
      pendingShort: tl("dailyReportPendingShort", "Chưa đ.danh"),
      regularWorker: tl("dailyReportRegularWorker", "Chính thức"),
      dailyWorker: tl("dailyReportDailyWorker", "Thời vụ"),
      total: tl("dailyReportTotal", "TỔNG"),
      grandTotal: tl("dailyReportGrandTotal", "TỔNG CỘNG"),
      metricsAria: tl("dailyReportMetricsAria", "Tóm tắt điểm danh"),
      metricsTotalHeadcount: tl("dailyReportMetricsTotalHeadcount", "Tổng nhân sự"),
      metricsPresent: tl("dailyReportMetricsPresent", "Hiện diện thực tế"),
      metricsAbsenceRate: tl("dailyReportMetricsAbsenceRate", "Tỷ lệ vắng tổng"),
      metricsAttention: tl("dailyReportMetricsAttention", "Công đoạn cần chú ý"),
      metricsAttentionNone: tl(
        "dailyReportMetricsAttentionNone",
        "Không có công đoạn vượt ngưỡng",
      ),
      metricsHeadcountDetail: (regular, seasonal) =>
        tl(
          "dailyReportMetricsHeadcountDetail",
          "{{regular}} chính thức · {{seasonal}} thời vụ",
          { regular, seasonal },
        ),
      metricsPresentDetail: (day, night) =>
        tl(
          "dailyReportMetricsPresentDetail",
          "Ca ngày {{day}} · Ca đêm {{night}}",
          { day, night },
        ),
      metricsAbsenceDetail: (absent, pending) =>
        tl(
          "dailyReportMetricsAbsenceDetail",
          "{{absent}} vắng / phép · {{pending}} chưa điểm danh",
          { absent, pending },
        ),
      dateLabel: tl("dailyReportDateLabel", "Ngày"),
    }),
    [tl],
  );

  const exportTitle = tl(
    "dailyReportDashboardTitle",
    "Điểm danh nhân sự SẢN XUẤT",
  );

  const handleExportImage = useCallback(async () => {
    if (exportingImage || loading || error || !exportRef.current) return;
    setExportingImage(true);
    try {
      await exportAttendanceDailyReportImage({
        node: exportRef.current,
        dateKey: selectedDate,
      });
    } catch {
      window.alert(
        tl(
          "dailyReportImageExportError",
          "Không thể tải hình báo cáo. Vui lòng thử lại.",
        ),
      );
    } finally {
      setExportingImage(false);
    }
  }, [error, exportingImage, loading, selectedDate, tl]);

  const handleExportExcel = useCallback(async () => {
    if (exportingExcel || loading || error) return;
    setExportingExcel(true);
    try {
      await exportAttendanceDailyReportExcel({
        dateKey: selectedDate,
        rows: report.rows,
        summary: report.summary,
        metrics,
        labels,
        title: exportTitle,
      });
    } catch {
      window.alert(
        tl(
          "dailyReportExcelExportError",
          "Không thể xuất Excel. Vui lòng thử lại.",
        ),
      );
    } finally {
      setExportingExcel(false);
    }
  }, [
    error,
    exportTitle,
    exportingExcel,
    labels,
    loading,
    metrics,
    report,
    selectedDate,
    tl,
  ]);

  const handleDateChange = (e) => {
    const v = e.target.value;
    if (!ISO_DATE_KEY_RE.test(v)) return;
    setSelectedDate(v);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("date", v);
      return next;
    });
  };

  const dayBadge = dayMeta.isHolidayDay
    ? tl("holidayDayBadge", "Ngày lễ")
    : dayMeta.isCompensatoryDay
      ? tl("compensatoryDayBadge", "Nghỉ bù")
      : dayMeta.isOffDay
        ? tl("offDayBadge", "Ngày nghỉ")
        : "";

  return (
    <div className="attendance-daily-report hr-page-compact max-w-[1600px] mx-auto px-2 py-2 md:px-4 md:py-3">
      <div className="adr-sheet">
        <div ref={exportRef} className="adr-export-root">
          <header className="adr-head">
            <div className="adr-head__title-block">
              <h1 className="adr-head__title">{exportTitle}</h1>
              <p className="adr-head__subtitle">
                {tl(
                  "dailyReportDashboardSubtitle",
                  "Thống kê điểm danh mỗi ngày ở Sản xuất",
                )}
              </p>
            </div>
            <div className="adr-head__controls adr-no-export">
              <label className="adr-date-chip">
                <span aria-hidden>📅</span>
                <input
                  type="date"
                  className="adr-date-chip__input"
                  value={selectedDate}
                  onChange={handleDateChange}
                  aria-label={tl("dailyReportDateLabel", "Ngày")}
                />
                <span className="sr-only">{formattedDateChip}</span>
              </label>
              {dayBadge ? (
                <span className="adr-day-badge">{dayBadge}</span>
              ) : null}
              <div className="adr-head__actions">
                <button
                  type="button"
                  className="adr-export-btn"
                  onClick={refresh}
                  disabled={loading && !regularEmployees.length && !seasonalEmployees.length}
                  aria-busy={isRevalidating}
                >
                  {isRevalidating
                    ? tl("dailyReportRefreshing", "Đang làm mới…")
                    : tl("dailyReportRefresh", "Làm mới")}
                </button>
                <button
                  type="button"
                  className="adr-export-btn"
                  onClick={() => void handleExportImage()}
                  disabled={loading || !!error || exportingImage}
                  aria-busy={exportingImage}
                >
                  {exportingImage
                    ? tl("dailyReportImageExporting", "Đang tải…")
                    : tl("dailyReportDownloadImage", "Tải hình")}
                </button>
                <button
                  type="button"
                  className="adr-export-btn adr-export-btn--primary"
                  onClick={() => void handleExportExcel()}
                  disabled={loading || !!error || exportingExcel}
                  aria-busy={exportingExcel}
                >
                  {exportingExcel
                    ? tl("dailyReportExcelExporting", "Đang xuất…")
                    : tl("dailyReportExportExcel", "Xuất Excel")}
                </button>
              </div>
            </div>
          </header>

          {error ? (
            <div className="adr-error" role="alert">
              {tl("dailyReportError", "Không tải được dữ liệu: {{error}}", {
                error,
              })}
            </div>
          ) : null}

          {(regularEmployees.length ||
            seasonalEmployees.length ||
            !loading) &&
          !error ? (
            <AttendanceDailyReportMetrics metrics={metrics} labels={labels} />
          ) : null}

          <div className="adr-table-panel">
            <PayrollMonthGridLoadingOverlay
              active={
                loading &&
                regularEmployees.length === 0 &&
                seasonalEmployees.length === 0
              }
              message={tl("dailyReportLoading", "Đang tải báo cáo…")}
            />
            {!loading || regularEmployees.length || seasonalEmployees.length ? (
              <AttendanceDailyReportTable
                rows={report.rows}
                summary={report.summary}
                dateKey={selectedDate}
                locale={displayLocale}
                labels={labels}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(AttendanceDailyReportPage);
