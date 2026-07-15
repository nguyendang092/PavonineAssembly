import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import ExcelJS from "exceljs";
import AttendanceHrPageShell from "./AttendanceHrPageShell";
import { useAttendanceDashboardData } from "./useAttendanceDashboardData";
import {
  DASHBOARD_PERIOD_DAY,
  DASHBOARD_PERIOD_IDS,
  normalizeDashboardPeriod,
} from "./attendanceDashboardPeriod";
import {
  ATTENDANCE_DASHBOARD_ON_TIME_CUTOFF,
  buildAttendanceDashboardSnapshot,
} from "./attendanceDashboardMetrics";
import {
  getAttendanceLeaveTypeBadgeClassName,
  getAttendanceLeaveTypeColorClassName,
  getAttendanceLeaveTypeHexColor,
} from "./attendanceGioVaoTypeOptions";
import { ISO_DATE_KEY_RE } from "./attendanceListShared";
import { getTodayDateKeyLocal } from "@/utils/dateKey";
import "./attendanceDashboard.css";
import "./hrPageCompact.css";
import "./attendanceToolbarFocus.css";

function getEmployeeInitials(name) {
  const parts = String(name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const a = parts[parts.length - 2];
  const b = parts[parts.length - 1];
  return `${a[0] ?? ""}${b[0] ?? ""}`.toUpperCase() || "?";
}

function formatLeaveBadgeLabel(label) {
  const t = String(label ?? "").trim();
  if (!t) return "—";
  if (/1\/2.*phép/i.test(t)) return "Phép năm (1/2)";
  return t;
}

const SENIORITY_LABEL_KEYS = {
  lt3m: "dashboardSeniorityLt3m",
  m3_6: "dashboardSeniority3_6m",
  m6_1y: "dashboardSeniority6m_1y",
  y1_3: "dashboardSeniority1_3",
  y3_5: "dashboardSeniority3_5",
  y5_10: "dashboardSeniority5_10",
  gt10: "dashboardSeniorityGt10",
};

const DASHBOARD_COLUMN_BAR_MARGIN = {
  top: 20,
  right: 4,
  left: -8,
  bottom: -4,
};

const PERIOD_LABEL_KEYS = {
  day: "dashboardPeriodDay",
  week: "dashboardPeriodWeek",
  month: "dashboardPeriodMonth",
  year: "dashboardPeriodYear",
};

const TREND_TITLE_KEYS = {
  day: "dashboardWeekTrend",
  week: "dashboardWeekTrend",
  month: "dashboardMonthTrend",
  year: "dashboardYearTrend",
};

const RESIGNATION_DEPT_COLORS = [
  "#4b5563",
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#b45309",
  "#7c3aed",
  "#0891b2",
  "#be123c",
  "#0f766e",
  "#9333ea",
];

function renderDonutCountPctLabel(total) {
  return function LeaveDonutSegmentLabel({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
    value,
  }) {
    const count = Number(value) || 0;
    if (count <= 0 || percent < 0.05) return null;
    const pct =
      total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.52;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text
        x={x}
        y={y}
        fill="#0f172a"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={9}
        fontWeight={800}
        stroke="#ffffff"
        strokeWidth={2}
        paintOrder="stroke"
      >
        {`${count} (${pct}%)`}
      </text>
    );
  };
}

function renderWeekTrendPointLabel(color, offsetY) {
  return function WeekTrendPointLabel({ x, y, value, index }) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return null;
    const isFirst = index === 0;
    return (
      <text
        x={(x ?? 0) + (isFirst ? 6 : 0)}
        y={(y ?? 0) - offsetY}
        fill={color}
        fontSize={9}
        fontWeight={700}
        textAnchor={isFirst ? "start" : "middle"}
      >
        {num}
      </text>
    );
  };
}

function createCountPctBarLabel(total, fill = "#312e81") {
  return function CountPctBarLabel({ x, y, width, value }) {
    const count = Number(value) || 0;
    if (count <= 0) return null;
    const pct =
      total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
    return (
      <text
        x={(x ?? 0) + (width ?? 0) / 2}
        y={(y ?? 0) - 6}
        fill={fill}
        fontSize={9}
        fontWeight={700}
        textAnchor="middle"
      >
        {`${count} (${pct}%)`}
      </text>
    );
  };
}

function KpiCard({ label, value, sub, tone = "" }) {
  return (
    <div className={`attendance-dashboard__kpi attendance-dashboard__kpi--${tone}`}>
      <div className="attendance-dashboard__kpi-label">{label}</div>
      <div className="attendance-dashboard__kpi-value">{value}</div>
      {sub ? <div className="attendance-dashboard__kpi-sub">{sub}</div> : null}
    </div>
  );
}

function DashboardCard({ title, subtitle, badge, children, className = "" }) {
  return (
    <section className={`attendance-dashboard__card ${className}`}>
      <header className="attendance-dashboard__card-head">
        <div className="attendance-dashboard__card-head-main">
          <div className="attendance-dashboard__card-head-text">{title}</div>
          {subtitle ? (
            <div className="attendance-dashboard__card-subtitle">{subtitle}</div>
          ) : null}
        </div>
        {badge != null ? (
          <span className="attendance-dashboard__card-badge">{badge}</span>
        ) : null}
      </header>
      <div className="attendance-dashboard__card-body">{children}</div>
    </section>
  );
}

function AttendanceDashboardPage() {
  const { t, i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [deptFilter, setDeptFilter] = useState("");
  const [exportBusy, setExportBusy] = useState(false);

  const dateFromUrl = searchParams.get("date");
  const periodFromUrl = searchParams.get("period");
  const selectedDate = useMemo(() => {
    if (dateFromUrl && ISO_DATE_KEY_RE.test(dateFromUrl)) return dateFromUrl;
    return getTodayDateKeyLocal();
  }, [dateFromUrl]);

  const selectedPeriod = useMemo(
    () => normalizeDashboardPeriod(periodFromUrl),
    [periodFromUrl],
  );

  useEffect(() => {
    const needsDate = !dateFromUrl || !ISO_DATE_KEY_RE.test(dateFromUrl);
    const needsPeriod =
      !periodFromUrl || !DASHBOARD_PERIOD_IDS.includes(periodFromUrl);
    if (!needsDate && !needsPeriod) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (needsDate) next.set("date", selectedDate);
        if (needsPeriod) next.set("period", selectedPeriod);
        return next;
      },
      { replace: true },
    );
  }, [
    dateFromUrl,
    periodFromUrl,
    selectedDate,
    selectedPeriod,
    setSearchParams,
  ]);

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
    loading: dataLoading,
    employees,
    rosterEmployees,
    trendPoints,
    periodLabel,
    periodDayCount,
    isOffDay,
    isHolidayDay,
    offDayCount,
    holidayCount,
  } = useAttendanceDashboardData(
    "attendance",
    selectedDate,
    selectedPeriod,
    displayLocale,
  );

  const departments = useMemo(() => {
    const set = new Set();
    for (const emp of rosterEmployees) {
      const d = String(emp.boPhan ?? "").trim();
      if (d) set.add(d);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [rosterEmployees]);

  const snapshot = useMemo(
    () =>
      buildAttendanceDashboardSnapshot(employees, selectedDate, {
        deptFilter,
        rosterEmployees,
        periodDays: periodDayCount,
      }),
    [employees, selectedDate, deptFilter, rosterEmployees, periodDayCount],
  );

  const handleDateChange = (e) => {
    const v = e.target.value;
    if (!ISO_DATE_KEY_RE.test(v)) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("date", v);
      return next;
    });
  };

  const handlePeriodChange = (e) => {
    const v = normalizeDashboardPeriod(e.target.value);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("period", v);
      return next;
    });
  };

  const kpiTotalSub =
    selectedPeriod === DASHBOARD_PERIOD_DAY
      ? tl("dashboardKpiDeptCount", "{{count}} bộ phận", {
          count: snapshot.summary.deptCount,
        })
      : tl("dashboardKpiPeriodSub", "{{unique}} NV · {{days}} ngày · {{records}} lượt", {
          unique: snapshot.summary.uniqueEmployees,
          days: snapshot.summary.periodDays,
          records: snapshot.summary.total,
        });

  const handlePrint = () => window.print();

  const handleExportExcel = async () => {
    setExportBusy(true);
    try {
      const wb = new ExcelJS.Workbook();
      const sheet = wb.addWorksheet("Dashboard");
      const s = snapshot.summary;
      sheet.addRow([tl("dashboardReportTitle", "Báo cáo thống kê điểm danh")]);
      sheet.addRow([tl("dashboardDateLabel", "Ngày"), periodLabel]);
      sheet.addRow([
        tl("dashboardPeriodLabel", "Kỳ"),
        tl(PERIOD_LABEL_KEYS[selectedPeriod] ?? "dashboardPeriodDay", selectedPeriod),
      ]);
      sheet.addRow([]);
      sheet.addRow([
        tl("dashboardKpiTotal", "Tổng nhân viên"),
        s.total,
      ]);
      sheet.addRow([
        tl("dashboardKpiOnTime", "Đúng giờ"),
        s.onTime,
        `${s.onTimePct}%`,
      ]);
      sheet.addRow([tl("dashboardKpiLate", "Đi trễ"), s.late]);
      sheet.addRow([tl("dashboardKpiLeave", "Nghỉ có phép"), s.onLeave]);
      sheet.addRow([
        tl("dashboardKpiAbsent", "Vắng không lý do"),
        s.absent,
      ]);
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance-dashboard-${selectedDate}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportBusy(false);
    }
  };

  const leaveDonutTotal = useMemo(
    () =>
      snapshot.leaveBreakdown.reduce((sum, row) => sum + row.count, 0),
    [snapshot.leaveBreakdown],
  );

  const leaveDonutData = useMemo(
    () =>
      snapshot.leaveBreakdown.map((row) => {
        const fill = getAttendanceLeaveTypeHexColor(row.label);
        const pct =
          leaveDonutTotal > 0
            ? Math.round((row.count / leaveDonutTotal) * 1000) / 10
            : 0;
        return {
          name: row.label,
          value: row.count,
          fill,
          pct,
        };
      }),
    [snapshot.leaveBreakdown, leaveDonutTotal],
  );

  const leaveDonutLabel = useMemo(
    () => renderDonutCountPctLabel(leaveDonutTotal),
    [leaveDonutTotal],
  );

  const resignationPieData = useMemo(() => {
    const rows = snapshot.deptResignationRate.filter((row) => row.resigned > 0);
    const resignedTotal = snapshot.resignationSummary.resignedRecords;
    return rows.map((row, i) => ({
      name: row.dept,
      value: row.resigned,
      fill: RESIGNATION_DEPT_COLORS[i % RESIGNATION_DEPT_COLORS.length],
      deptRate: row.rate,
      deptTotal: row.total,
      sharePct:
        resignedTotal > 0
          ? Math.round((row.resigned / resignedTotal) * 1000) / 10
          : 0,
    }));
  }, [snapshot.deptResignationRate, snapshot.resignationSummary.resignedRecords]);

  const resignationPieTotal = snapshot.resignationSummary.resignedRecords;

  const resignationDonutLabel = useMemo(
    () => renderDonutCountPctLabel(resignationPieTotal),
    [resignationPieTotal],
  );

  const resignationDetailRows = useMemo(() => {
    const resignedTotal = snapshot.resignationSummary.resignedRecords;
    return snapshot.deptResignationRate
      .filter((row) => row.resigned > 0)
      .map((row, i) => ({
        ...row,
        fill: RESIGNATION_DEPT_COLORS[i % RESIGNATION_DEPT_COLORS.length],
        sharePct:
          resignedTotal > 0
            ? Math.round((row.resigned / resignedTotal) * 1000) / 10
            : 0,
      }));
  }, [
    snapshot.deptResignationRate,
    snapshot.resignationSummary.resignedRecords,
  ]);

  const deptHeadcountChartHeight = useMemo(() => {
    const n = snapshot.deptHeadcount.length;
    if (n === 0) return 220;
    return Math.max(220, n * 26 + 44);
  }, [snapshot.deptHeadcount.length]);

  const leaveCardTitle =
    selectedPeriod === DASHBOARD_PERIOD_DAY
      ? tl("dashboardLeaveTypes", "Loại phép hôm nay")
      : tl("dashboardLeaveTypesPeriod", "Loại phép trong kỳ");

  const leaveCardSubtitle = tl(
    "dashboardLeaveSubtitle",
    "{{count}} người nghỉ · theo nhóm",
    { count: leaveDonutTotal },
  );

  const seniorityTotal = useMemo(
    () =>
      snapshot.seniority.buckets.reduce((sum, bucket) => sum + bucket.count, 0),
    [snapshot.seniority.buckets],
  );

  const seniorityChartData = useMemo(
    () =>
      snapshot.seniority.buckets.map((b) => ({
        label: tl(
          SENIORITY_LABEL_KEYS[b.key] ?? b.key,
          b.key,
        ),
        count: b.count,
        pct:
          seniorityTotal > 0
            ? Math.round((b.count / seniorityTotal) * 1000) / 10
            : 0,
      })),
    [snapshot.seniority.buckets, seniorityTotal, tl],
  );

  const seniorityBarLabel = useMemo(
    () => createCountPctBarLabel(seniorityTotal),
    [seniorityTotal],
  );

  const newHiresTotal = useMemo(
    () =>
      snapshot.newHiresByYear.reduce((sum, row) => sum + row.count, 0),
    [snapshot.newHiresByYear],
  );

  const newHiresChartData = useMemo(
    () =>
      snapshot.newHiresByYear.map((row) => ({
        label: String(row.year),
        count: row.count,
      })),
    [snapshot.newHiresByYear],
  );

  const newHiresBarLabel = useMemo(
    () => createCountPctBarLabel(newHiresTotal, "#0f766e"),
    [newHiresTotal],
  );

  return (
    <AttendanceHrPageShell contextDate={selectedDate}>
      <div className="attendance-dashboard attendance-dashboard--fit hr-page-compact attendance-list-viewport w-full max-w-none">
        <div className="attendance-dashboard__shell">
          <header className="attendance-dashboard__report-head dashboard-report-surface">
            <div className="attendance-dashboard__report-brand">
              <span className="attendance-dashboard__report-logo" aria-hidden>
                PVN
              </span>
              <div className="attendance-dashboard__report-brand-text">
                <h1 className="attendance-dashboard__report-company">
                  {tl(
                    "dashboardCompanyName",
                    "CÔNG TY TNHH PAVONINE VINA",
                  )}
                </h1>
                <p className="attendance-dashboard__report-address">
                  {tl(
                    "dashboardCompanyAddress",
                    "Lots VII-3, VII-2, and part of Lot VII-3, My Xuan B1 - Tien Hung Industrial Park, Phu My Ward, Ho Chi Minh City, Vietnam",
                  )}
                </p>
              </div>
            </div>

            <div className="attendance-dashboard__report-date-block">
              <span className="attendance-dashboard__report-date-label">
                {selectedPeriod === DASHBOARD_PERIOD_DAY
                  ? tl("dashboardReportDateLabel", "NGÀY BÁO CÁO")
                  : tl("dashboardReportPeriodLabel", "KỲ BÁO CÁO")}
              </span>
              <time
                className="attendance-dashboard__report-date-value"
                dateTime={selectedDate}
              >
                {periodLabel}
              </time>
            </div>

            <div className="attendance-dashboard__report-signatures" aria-hidden>
              <div className="attendance-dashboard__report-sign">
                <span className="attendance-dashboard__report-sign-line" />
                <span className="attendance-dashboard__report-sign-label">
                  {tl("dashboardSignPreparer", "Người lập")}
                </span>
              </div>
              <div className="attendance-dashboard__report-sign">
                <span className="attendance-dashboard__report-sign-line" />
                <span className="attendance-dashboard__report-sign-label">
                  {tl("dashboardSignChecker", "Kiểm tra")}
                </span>
              </div>
              <div className="attendance-dashboard__report-sign">
                <span className="attendance-dashboard__report-sign-line" />
                <span className="attendance-dashboard__report-sign-label">
                  {tl("dashboardSignApprover", "Phê duyệt")}
                </span>
              </div>
            </div>
          </header>

          <div className="attendance-dashboard__toolbar attendance-dashboard__no-print">
            <div className="attendance-dashboard__filters">
            <span className="attendance-dashboard__filter-label">
              {tl("dashboardPeriodLabel", "Kỳ")}
            </span>
            <select
              className="attendance-dashboard__filter-select"
              value={selectedPeriod}
              onChange={handlePeriodChange}
            >
              {DASHBOARD_PERIOD_IDS.map((id) => (
                <option key={id} value={id}>
                  {tl(PERIOD_LABEL_KEYS[id] ?? id, id)}
                </option>
              ))}
            </select>
            <span className="attendance-dashboard__filter-label">
              {tl("dashboardAnchorDateLabel", "Mốc ngày")}
            </span>
            <input
              type="date"
              className="attendance-dashboard__filter-input"
              value={selectedDate}
              onChange={handleDateChange}
            />
            <span className="attendance-dashboard__filter-label">
              {tl("dashboardDeptFilter", "Bộ phận")}
            </span>
            <select
              className="attendance-dashboard__filter-select"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              <option value="">
                {tl("dashboardDeptAll", "Tất cả bộ phận")}
              </option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <span className="attendance-dashboard__filter-chip">
              {tl("dashboardStandardTime", "Giờ chuẩn")}:{" "}
              {ATTENDANCE_DASHBOARD_ON_TIME_CUTOFF}
              {isOffDay
                ? selectedPeriod === DASHBOARD_PERIOD_DAY
                  ? ` · ${tl("dashboardOffDay", "Ngày nghỉ")}`
                  : ` · ${tl("dashboardOffDaysInPeriod", "{{count}} ngày nghỉ", { count: offDayCount })}`
                : ""}
              {isHolidayDay
                ? selectedPeriod === DASHBOARD_PERIOD_DAY
                  ? ` · ${tl("dashboardHoliday", "Ngày lễ")}`
                  : ` · ${tl("dashboardHolidaysInPeriod", "{{count}} ngày lễ", { count: holidayCount })}`
                : ""}
            </span>
            </div>
            <div className="attendance-dashboard__hero-actions">
              <button
                type="button"
                className="attendance-dashboard__btn attendance-dashboard__btn--gold"
                onClick={() => void handleExportExcel()}
                disabled={exportBusy}
              >
                {tl("dashboardExportExcel", "Xuất Excel")}
              </button>
              <button
                type="button"
                className="attendance-dashboard__btn attendance-dashboard__btn--outline"
                onClick={handlePrint}
              >
                {tl("dashboardPrint", "In báo cáo")}
              </button>
            </div>
          </div>

          {dataLoading ? (
            <p className="attendance-dashboard__loading">
              {tl("dashboardLoading", "Đang tải dữ liệu…")}
            </p>
          ) : (
          <>
              <div className="attendance-dashboard__kpis">
                <KpiCard
                  label={
                    selectedPeriod === DASHBOARD_PERIOD_DAY
                      ? tl("dashboardKpiTotal", "Tổng nhân viên")
                      : tl("dashboardKpiTotalRecords", "Tổng lượt điểm danh")
                  }
                  value={snapshot.summary.total}
                  sub={kpiTotalSub}
                />
                <KpiCard
                  tone="green"
                  label={tl(
                    "dashboardKpiOnTime",
                    "Đúng giờ ≤ {{time}}",
                    { time: ATTENDANCE_DASHBOARD_ON_TIME_CUTOFF },
                  )}
                  value={`${snapshot.summary.onTime} / ${snapshot.summary.total}`}
                  sub={`${snapshot.summary.onTimePct}%`}
                />
                <KpiCard
                  tone="amber"
                  label={tl(
                    "dashboardKpiLate",
                    "Đi trễ > {{time}}",
                    { time: ATTENDANCE_DASHBOARD_ON_TIME_CUTOFF },
                  )}
                  value={snapshot.summary.late}
                  sub={`${snapshot.summary.latePct}%`}
                />
                <KpiCard
                  tone="sky"
                  label={tl("dashboardKpiLeave", "Nghỉ có phép")}
                  value={snapshot.summary.onLeave}
                />
                <KpiCard
                  tone="rose"
                  label={tl("dashboardKpiAbsent", "Vắng không lý do")}
                  value={snapshot.summary.absent}
                />
              </div>

              <p className="attendance-dashboard__insight attendance-dashboard__insight--warn">
                {tl("dashboardInsightWarn", {
                  defaultValue:
                    "{{onTimePct}}% nhân viên đúng giờ. Cần theo dõi {{absent}} trường hợp vắng không lý do.",
                  onTimePct: snapshot.summary.onTimePct,
                  absent: snapshot.summary.absent,
                })}
              </p>
              <p className="attendance-dashboard__insight attendance-dashboard__insight--info">
                {tl("dashboardInsightTenure", {
                  defaultValue:
                    "{{pct}}% nhân viên trên 6 tháng thâm niên; trung bình {{years}} năm.",
                  pct: snapshot.seniority.over6MonthsPct,
                  years: snapshot.seniority.avgYears,
                })}
              </p>

              <div className="attendance-dashboard__grid attendance-dashboard__grid--pair">
                <DashboardCard
                  title={tl(
                    "dashboardMorningChart",
                    "Nhập điểm danh buổi sáng",
                  )}
                >
                  <div className="attendance-dashboard__chart attendance-dashboard__chart--tall">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={snapshot.morningBuckets}>
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10, fill: "#475569" }}
                          interval={0}
                          angle={-35}
                          textAnchor="end"
                          height={48}
                          axisLine={{ stroke: "#334155", strokeWidth: 2 }}
                          tickLine={{ stroke: "#64748b", strokeWidth: 1 }}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "#475569" }}
                          axisLine={{ stroke: "#334155", strokeWidth: 2 }}
                          tickLine={{ stroke: "#64748b", strokeWidth: 1 }}
                        />
                        <Tooltip />
                        <Bar
                          dataKey="count"
                          fill="#1e3a6e"
                          radius={[3, 3, 0, 0]}
                          name={tl("dashboardHeadcount", "Số người")}
                        >
                          <LabelList
                            dataKey="count"
                            position="top"
                            fill="#0f172a"
                            fontSize={10}
                            fontWeight={700}
                            formatter={(value) =>
                              Number(value) > 0 ? value : ""
                            }
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </DashboardCard>

                <DashboardCard
                  title={tl(
                    TREND_TITLE_KEYS[selectedPeriod] ?? "dashboardWeekTrend",
                    selectedPeriod === "month"
                      ? "Xu hướng theo tuần trong tháng"
                      : selectedPeriod === "year"
                        ? "Xu hướng theo tháng trong năm"
                        : "Xu hướng theo tuần",
                  )}
                >
                  <div className="attendance-dashboard__chart attendance-dashboard__chart--tall">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={trendPoints}
                        margin={{ top: 32, right: 16, left: 0, bottom: 0 }}
                      >
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 10, fill: "#475569" }}
                            axisLine={{ stroke: "#334155", strokeWidth: 2 }}
                            tickLine={{ stroke: "#64748b", strokeWidth: 1 }}
                          />
                          <YAxis
                            tick={{ fontSize: 10, fill: "#475569" }}
                            axisLine={{ stroke: "#334155", strokeWidth: 2 }}
                            tickLine={{ stroke: "#64748b", strokeWidth: 1 }}
                          />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Line
                            type="monotone"
                            dataKey="onTime"
                            stroke="#059669"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            name={tl("dashboardKpiOnTimeShort", "Đúng giờ")}
                          >
                            <LabelList
                              dataKey="onTime"
                              content={renderWeekTrendPointLabel("#047857", 8)}
                            />
                          </Line>
                          <Line
                            type="monotone"
                            dataKey="absent"
                            stroke="#e11d48"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            name={tl("dashboardKpiAbsentShort", "Vắng")}
                          >
                            <LabelList
                              dataKey="absent"
                              content={renderWeekTrendPointLabel("#be123c", 22)}
                            />
                          </Line>
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                </DashboardCard>
              </div>

              <div className="attendance-dashboard__grid attendance-dashboard__grid--dept-week">
                <DashboardCard
                  title={tl("dashboardDeptWatch", "Bộ phận cần theo dõi")}
                >
                  <div className="attendance-dashboard__dept-week-panel">
                    <p className="attendance-dashboard__dept-watch-sort">
                      {tl(
                        "dashboardDeptWatchSort",
                        "Xếp theo % đúng giờ thấp nhất",
                      )}
                      {snapshot.deptWatchlist.length > 0
                        ? ` · ${snapshot.deptWatchlist.length}`
                        : ""}
                    </p>
                    <div className="attendance-dashboard__dept-week-scroll">
                      {snapshot.deptWatchlist.length === 0 ? (
                        <p className="attendance-dashboard__empty">
                          {tl("dashboardNoData", "Không có dữ liệu")}
                        </p>
                      ) : (
                        snapshot.deptWatchlist.map((row) => (
                          <div key={row.dept} className="attendance-dashboard__dept-bar">
                            <span className="attendance-dashboard__dept-bar-name">
                              {row.dept}
                            </span>
                            <span className="attendance-dashboard__dept-bar-ratio">
                              {row.onTime}/{row.total}
                            </span>
                            <div className="attendance-dashboard__dept-bar-track">
                              <div
                                className={`attendance-dashboard__dept-bar-fill ${
                                  row.isFullOnTime
                                    ? "attendance-dashboard__dept-bar-fill--full"
                                    : "attendance-dashboard__dept-bar-fill--below"
                                }`}
                                style={{ width: `${Math.min(row.onTimeRate, 100)}%` }}
                              />
                            </div>
                            <span
                              className={`attendance-dashboard__dept-bar-pct ${
                                row.isFullOnTime
                                  ? "attendance-dashboard__dept-bar-pct--full"
                                  : "attendance-dashboard__dept-bar-pct--below"
                              }`}
                            >
                              {row.onTimeRate}%
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </DashboardCard>

                <DashboardCard
                  title={tl("dashboardLateList", "Nhân viên đi trễ")}
                  className="attendance-dashboard__card--late"
                >
                  <div className="attendance-dashboard__dept-week-panel">
                    {snapshot.lateEmployees.length === 0 ? (
                      <p className="attendance-dashboard__empty">
                        {tl("dashboardNoLate", "Không có đi trễ")}
                      </p>
                    ) : (
                      <div className="attendance-dashboard__list attendance-dashboard__list--capped attendance-dashboard__list--late-fill">
                        <div className="attendance-dashboard__list-body--capped-scroll attendance-dashboard__late-employees-scroll">
                          <div
                            className="attendance-dashboard__list-head attendance-dashboard__list-head--late-sticky"
                            aria-hidden
                          >
                            <span>{tl("dashboardColName", "Họ và tên")}</span>
                            <span>{tl("dashboardColDept", "Bộ phận")}</span>
                            <span>{tl("dashboardColTimeIn", "Giờ vào")}</span>
                          </div>
                          {snapshot.lateEmployees.map((row) => (
                            <div
                              key={`${row.mnv}-${row.timeIn}`}
                              className="attendance-dashboard__list-row attendance-dashboard__list-row--3"
                            >
                              <span className="attendance-dashboard__list-name">
                                {row.name}
                              </span>
                              <span className="attendance-dashboard__list-meta">
                                {row.dept}
                              </span>
                              <span className="attendance-dashboard__list-badge">
                                {row.timeIn}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </DashboardCard>

                <DashboardCard title={leaveCardTitle}>
                  <div className="attendance-dashboard__dept-week-panel">
                    {leaveDonutData.length === 0 ? (
                      <p className="attendance-dashboard__empty">
                        {tl("dashboardNoLeave", "Không có nghỉ phép")}
                      </p>
                    ) : (
                      <div className="attendance-dashboard__leave-panel">
                        {leaveDonutTotal > 0 ? (
                          <p className="attendance-dashboard__leave-subtitle">
                            {leaveCardSubtitle}
                          </p>
                        ) : null}
                        <div className="attendance-dashboard__leave-summary">
                          <div className="attendance-dashboard__leave-donut">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={leaveDonutData}
                                  dataKey="value"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  innerRadius="58%"
                                  outerRadius="88%"
                                  paddingAngle={2}
                                  stroke="#fff"
                                  strokeWidth={2}
                                  label={leaveDonutLabel}
                                  labelLine={false}
                                >
                                  {leaveDonutData.map((entry) => (
                                    <Cell key={entry.name} fill={entry.fill} />
                                  ))}
                                </Pie>
                                <Tooltip
                                  formatter={(value, _name, item) => {
                                    const count = Number(value) || 0;
                                    const pct = item?.payload?.pct ?? 0;
                                    return [
                                      `${count} (${pct}%)`,
                                      item?.payload?.name ?? "",
                                    ];
                                  }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <ul className="attendance-dashboard__leave-legend">
                            {leaveDonutData.map((row) => (
                              <li
                                key={row.name}
                                className="attendance-dashboard__leave-legend-item"
                              >
                                <span
                                  className="attendance-dashboard__leave-legend-swatch"
                                  style={{ backgroundColor: row.fill }}
                                  aria-hidden
                                />
                                <span
                                  className={`attendance-dashboard__leave-legend-label ${getAttendanceLeaveTypeColorClassName(row.name)}`}
                                >
                                  {row.name}
                                </span>
                                <span className="attendance-dashboard__leave-legend-count">
                                  {row.value} · {row.pct}%
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="attendance-dashboard__leave-divider" />

                        <h3 className="attendance-dashboard__leave-list-title">
                          {tl("dashboardLeaveListTitle", "Danh sách nghỉ phép")}
                        </h3>

                        {snapshot.onLeaveEmployees.length === 0 ? (
                          <p className="attendance-dashboard__empty">
                            {tl("dashboardNoLeave", "Không có nghỉ phép")}
                          </p>
                        ) : (
                          <div className="attendance-dashboard__leave-people">
                            {snapshot.onLeaveEmployees.map((row) => (
                              <div
                                key={`${row.mnv || row.name}-${row.leaveLabel}`}
                                className="attendance-dashboard__leave-person"
                              >
                                <span
                                  className="attendance-dashboard__leave-avatar"
                                  aria-hidden
                                >
                                  {getEmployeeInitials(row.name)}
                                </span>
                                <div className="attendance-dashboard__leave-person-info">
                                  <span className="attendance-dashboard__leave-person-name">
                                    {row.name}
                                  </span>
                                  <span className="attendance-dashboard__leave-person-meta">
                                    {row.dept} · {row.mnv}
                                  </span>
                                </div>
                                <span
                                  className={`attendance-dashboard__leave-badge border ${getAttendanceLeaveTypeBadgeClassName(row.leaveLabel)}`}
                                >
                                  {formatLeaveBadgeLabel(row.leaveLabel)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </DashboardCard>
              </div>

              <div className="attendance-dashboard__grid attendance-dashboard__grid--mid">
                <DashboardCard
                  title={tl(
                    "dashboardDeptStructure",
                    "Cơ cấu nhân sự theo bộ phận",
                  )}
                  className="attendance-dashboard__card--dept-headcount"
                >
                  <div className="attendance-dashboard__dept-headcount-wrap">
                    {snapshot.deptHeadcount.length === 0 ? (
                      <p className="attendance-dashboard__empty">
                        {tl("dashboardNoDeptHeadcount", "Không có dữ liệu")}
                      </p>
                    ) : (
                      <div
                        className="attendance-dashboard__chart attendance-dashboard__chart--dept-headcount"
                        style={{ height: deptHeadcountChartHeight }}
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={snapshot.deptHeadcount}
                            layout="vertical"
                            margin={{ left: 4, right: 28, top: 2, bottom: 0 }}
                          >
                            <XAxis
                              type="number"
                              height={14}
                              tick={{ fontSize: 9, fill: "#475569" }}
                              axisLine={{ stroke: "#334155", strokeWidth: 2 }}
                              tickLine={{ stroke: "#64748b", strokeWidth: 1 }}
                              allowDecimals={false}
                            />
                            <YAxis
                              type="category"
                              dataKey="dept"
                              width={84}
                              tick={{ fontSize: 9, fill: "#475569" }}
                              axisLine={{ stroke: "#334155", strokeWidth: 2 }}
                              tickLine={{ stroke: "#64748b", strokeWidth: 1 }}
                              padding={{ top: 0, bottom: 0 }}
                            />
                            <Tooltip />
                            <Bar
                              dataKey="count"
                              fill="#334155"
                              radius={[0, 3, 3, 0]}
                              name={tl("dashboardHeadcount", "Số người")}
                            >
                              <LabelList
                                dataKey="count"
                                position="right"
                                fill="#0f172a"
                                fontSize={9}
                                fontWeight={700}
                                formatter={(value) =>
                                  Number(value) > 0 ? value : ""
                                }
                              />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </DashboardCard>

                <DashboardCard
                  title={tl(
                    "dashboardDeptResignationRate",
                    "Tỉ lệ nghỉ việc theo bộ phận",
                  )}
                  className="attendance-dashboard__card--dept-resignation"
                >
                  <div className="attendance-dashboard__resignation-panel">
                    <div className="attendance-dashboard__resignation-kpis">
                      <div className="attendance-dashboard__resignation-kpi">
                        <span className="attendance-dashboard__resignation-kpi-label">
                          {tl("dashboardResignationKpiTotal", "Tổng nhân sự")}
                        </span>
                        <strong>
                          {snapshot.resignationSummary.totalRecords}
                        </strong>
                      </div>
                      <div className="attendance-dashboard__resignation-kpi attendance-dashboard__resignation-kpi--accent">
                        <span className="attendance-dashboard__resignation-kpi-label">
                          {tl(
                            "dashboardResignationKpiOverall",
                            "Tỉ lệ",
                          )}
                        </span>
                        <strong>
                          {snapshot.resignationSummary.overallRate}%
                        </strong>
                      </div>
                      <div className="attendance-dashboard__resignation-kpi">
                        <span className="attendance-dashboard__resignation-kpi-label">
                          {tl(
                            "dashboardResignationKpiUnique",
                            "Số lượng NV nghỉ việc",
                          )}
                        </span>
                        <strong>
                          {snapshot.resignationSummary.uniqueResigned}
                        </strong>
                      </div>
                    </div>

                    {resignationPieData.length === 0 ? (
                      <p className="attendance-dashboard__empty">
                        {tl("dashboardNoResignation", "Không có nghỉ việc")}
                      </p>
                    ) : (
                      <>
                        <div className="attendance-dashboard__leave-summary">
                          <div className="attendance-dashboard__leave-donut attendance-dashboard__leave-donut--tall">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={resignationPieData}
                                  dataKey="value"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  innerRadius="58%"
                                  outerRadius="88%"
                                  paddingAngle={2}
                                  stroke="#fff"
                                  strokeWidth={2}
                                  label={resignationDonutLabel}
                                  labelLine={false}
                                >
                                  {resignationPieData.map((entry) => (
                                    <Cell key={entry.name} fill={entry.fill} />
                                  ))}
                                </Pie>
                                <Tooltip
                                  formatter={(value, _name, item) => {
                                    const row = item?.payload;
                                    if (!row) return ["", ""];
                                    return [
                                      `${row.value}/${row.deptTotal} lượt (${row.deptRate}%)`,
                                      `${row.name} · ${row.sharePct}% cơ cấu`,
                                    ];
                                  }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="attendance-dashboard__resignation-legend-wrap">
                            <div
                              className="attendance-dashboard__resignation-legend-head"
                              aria-hidden
                            >
                              <span />
                              <span>
                                {tl("dashboardColDept", "Bộ phận")}
                              </span>
                              <span>
                                {tl(
                                  "dashboardResignationColRecords",
                                  "Lượt",
                                )}
                              </span>
                              <span>
                                {tl(
                                  "dashboardResignationColDeptRate",
                                  "Tỉ lệ BP",
                                )}
                              </span>
                              <span>
                                {tl(
                                  "dashboardResignationColShare",
                                  "Cơ cấu",
                                )}
                              </span>
                            </div>
                            <ul className="attendance-dashboard__resignation-legend">
                              {resignationDetailRows.map((row) => (
                                <li
                                  key={row.dept}
                                  className="attendance-dashboard__resignation-legend-item"
                                >
                                  <span
                                    className="attendance-dashboard__leave-legend-swatch"
                                    style={{ backgroundColor: row.fill }}
                                    aria-hidden
                                  />
                                  <span className="attendance-dashboard__resignation-legend-dept">
                                    {row.dept}
                                  </span>
                                  <span className="attendance-dashboard__resignation-legend-metric">
                                    {row.resigned}/{row.total}
                                  </span>
                                  <span className="attendance-dashboard__resignation-legend-metric attendance-dashboard__resignation-legend-metric--rate">
                                    {row.rate}%
                                  </span>
                                  <span className="attendance-dashboard__resignation-legend-metric">
                                    {row.sharePct}%
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </>
                    )}

                    <div className="attendance-dashboard__leave-divider" />

                    <h3 className="attendance-dashboard__resignation-section-title">
                      {tl(
                        "dashboardResignationEmployeeList",
                        "Danh sách nhân viên nghỉ việc",
                      )}
                    </h3>
                    {snapshot.resignedEmployees.length === 0 ? (
                      <p className="attendance-dashboard__empty">
                        {tl("dashboardNoResignation", "Không có nghỉ việc")}
                      </p>
                    ) : (
                      <div className="attendance-dashboard__list attendance-dashboard__list--capped attendance-dashboard__list--resignation">
                        <div className="attendance-dashboard__list-body--capped-scroll attendance-dashboard__resignation-employees-scroll">
                          <div
                            className="attendance-dashboard__list-head attendance-dashboard__list-head--resignation-days attendance-dashboard__list-head--resignation-sticky"
                            aria-hidden
                          >
                            <span>{tl("dashboardColName", "Họ và tên")}</span>
                            <span>{tl("dashboardColDept", "Bộ phận")}</span>
                            <span>{tl("dashboardColMnv", "Mã NV")}</span>
                            <span>
                              {tl("dashboardResignationColDays", "Ngày nghỉ việc")}
                            </span>
                          </div>
                          {snapshot.resignedEmployees.map((row) => (
                            <div
                              key={`${row.mnv || row.name}-${row.dept}`}
                              className="attendance-dashboard__list-row attendance-dashboard__list-row--resignation-days"
                            >
                              <span className="attendance-dashboard__list-name">
                                {row.name}
                              </span>
                              <span className="attendance-dashboard__list-meta attendance-dashboard__list-meta--dept">
                                {row.dept}
                              </span>
                              <span className="attendance-dashboard__list-meta attendance-dashboard__list-meta--mnv">
                                {row.mnv}
                              </span>
                              <span className="attendance-dashboard__list-badge attendance-dashboard__list-badge--muted attendance-dashboard__list-badge--days">
                                {row.resignationDate ?? "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </DashboardCard>
              </div>

              <div className="attendance-dashboard__grid attendance-dashboard__grid--bottom">
                <DashboardCard
                  title={tl("dashboardAbsentList", "Vắng không lý do")}
                  className="attendance-dashboard__card--absent"
                >
                  <div className="attendance-dashboard__list attendance-dashboard__list--capped">
                    {snapshot.absentEmployees.length === 0 ? (
                      <p className="attendance-dashboard__empty">
                        {tl("dashboardNoAbsent", "Không có vắng")}
                      </p>
                    ) : (
                      <>
                        <div
                          className="attendance-dashboard__list-head"
                          aria-hidden
                        >
                          <span>{tl("dashboardColName", "Họ và tên")}</span>
                          <span>{tl("dashboardColDept", "Bộ phận")}</span>
                          <span>{tl("dashboardColMnv", "Mã NV")}</span>
                        </div>
                        <div className="attendance-dashboard__list-body--capped-scroll">
                          {snapshot.absentEmployees.map((row) => (
                            <div
                              key={row.mnv || row.name}
                              className="attendance-dashboard__list-row attendance-dashboard__list-row--3"
                            >
                              <span className="attendance-dashboard__list-name">
                                {row.name}
                              </span>
                              <span className="attendance-dashboard__list-meta">
                                {row.dept}
                              </span>
                              <span className="attendance-dashboard__list-meta">
                                {row.mnv}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </DashboardCard>

                <DashboardCard
                  title={tl(
                    "dashboardNewHiresByYear",
                    "Tỉ lệ nhân viên mới theo năm",
                  )}
                  className="attendance-dashboard__card--new-hires"
                >
                  {newHiresChartData.length === 0 ? (
                    <p className="attendance-dashboard__empty">
                      {tl("dashboardNoData", "Không có dữ liệu")}
                    </p>
                  ) : (
                    <div className="attendance-dashboard__chart attendance-dashboard__chart--new-hires">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={newHiresChartData}
                          margin={DASHBOARD_COLUMN_BAR_MARGIN}
                        >
                          <XAxis
                            dataKey="label"
                            tick={{ fontSize: 8, fill: "#475569" }}
                            interval={0}
                            angle={0}
                            textAnchor="middle"
                            height={30}
                            axisLine={{ stroke: "#334155", strokeWidth: 2 }}
                            tickLine={{ stroke: "#64748b", strokeWidth: 1 }}
                          />
                          <YAxis
                            width={34}
                            tick={{ fontSize: 9, fill: "#475569" }}
                            tickMargin={2}
                            axisLine={{ stroke: "#334155", strokeWidth: 2 }}
                            tickLine={{ stroke: "#64748b", strokeWidth: 1 }}
                          />
                          <Tooltip
                            formatter={(value) => {
                              const count = Number(value) || 0;
                              const pct =
                                newHiresTotal > 0
                                  ? Math.round((count / newHiresTotal) * 1000) /
                                    10
                                  : 0;
                              return [
                                `${count} (${pct}%)`,
                                tl("dashboardHeadcount", "Số người"),
                              ];
                            }}
                          />
                          <Bar
                            dataKey="count"
                            fill="#0d9488"
                            radius={[4, 4, 0, 0]}
                            name={tl("dashboardHeadcount", "Số người")}
                          >
                            <LabelList
                              dataKey="count"
                              position="top"
                              content={newHiresBarLabel}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </DashboardCard>

                <DashboardCard
                  title={tl(
                    "dashboardSeniorityChart",
                    "Cơ cấu thâm niên làm việc",
                  )}
                  className="attendance-dashboard__card--seniority"
                >
                  <div className="attendance-dashboard__chart attendance-dashboard__chart--seniority">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={seniorityChartData}
                        margin={DASHBOARD_COLUMN_BAR_MARGIN}
                      >
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 8, fill: "#475569" }}
                          interval={0}
                          angle={0}
                          textAnchor="middle"
                          height={30}
                          axisLine={{ stroke: "#334155", strokeWidth: 2 }}
                          tickLine={{ stroke: "#64748b", strokeWidth: 1 }}
                        />
                        <YAxis
                          width={34}
                          tick={{ fontSize: 9, fill: "#475569" }}
                          tickMargin={2}
                          axisLine={{ stroke: "#334155", strokeWidth: 2 }}
                          tickLine={{ stroke: "#64748b", strokeWidth: 1 }}
                        />
                        <Tooltip
                          formatter={(value) => {
                            const count = Number(value) || 0;
                            const pct =
                              seniorityTotal > 0
                                ? Math.round((count / seniorityTotal) * 1000) / 10
                                : 0;
                            return [
                              `${count} (${pct}%)`,
                              tl("dashboardHeadcount", "Số người"),
                            ];
                          }}
                        />
                        <Bar
                          dataKey="count"
                          fill="#4f46e5"
                          radius={[4, 4, 0, 0]}
                          name={tl("dashboardHeadcount", "Số người")}
                        >
                          <LabelList
                            dataKey="count"
                            position="top"
                            content={seniorityBarLabel}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </DashboardCard>
              </div>
          </>
          )}
        </div>
      </div>
    </AttendanceHrPageShell>
  );
}

export default memo(AttendanceDashboardPage);
