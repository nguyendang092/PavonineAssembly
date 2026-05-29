import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import A3ManualEmployeeListModal from "./A3ManualEmployeeListModal";
import {
  a3EmployeeKey,
  buildA3EmployeePickerOptions,
  buildA3ErrorCountLookup,
  mergeAnnouncementEmployeeRows,
  sumA3ErrorCounts,
  upsertA3ManualEmployeeEntries,
} from "../lib/a3AnnouncementUtils";
import {
  MC_DEFECT_CHART_PRIMARY,
  MC_DEFECT_CHART_TEXT,
  MC_DEFECT_CHART_TOOLTIP_PROPS,
  MC_DEFECT_FILTER_ALL,
} from "../lib/constants";
import { normalizeText } from "../lib/dataAggregations";

const A3_AXIS_TICK_STYLE = { fontSize: 10, fill: MC_DEFECT_CHART_TEXT };
const A3_BAR_LABEL_STYLE = {
  position: "right",
  fill: MC_DEFECT_CHART_TEXT,
  fontSize: 11,
  fontWeight: 800,
};
const A3_SELECT_FIELD_CLASS =
  "h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-sky-900/40";

function MCDefectReportEmployeeMonthlyAnnouncement({
  employeeRows,
  reportMonth,
  reportPeriodLabel,
  reportDepartment,
  employeePickerOptions = [],
  manualEmployees = [],
  setManualEmployees,
  a3ManualSaving = false,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isManualListModalOpen, setIsManualListModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [customEmployeeName, setCustomEmployeeName] = useState("");
  const [pendingErrorCount, setPendingErrorCount] = useState("0");
  const printAreaRef = useRef(null);
  const { t } = useTranslation();
  const tl = useCallback(
    (key, defaultValue, opts) =>
      t(`mcDefectReport.${key}`, { defaultValue, ...opts }),
    [t],
  );

  const displayedEmployeeRows = useMemo(
    () => mergeAnnouncementEmployeeRows(employeeRows, manualEmployees),
    [employeeRows, manualEmployees],
  );
  const displayedTotalErrorCount = useMemo(
    () => sumA3ErrorCounts(displayedEmployeeRows),
    [displayedEmployeeRows],
  );

  const pickerOptions = useMemo(
    () => buildA3EmployeePickerOptions(employeePickerOptions, manualEmployees),
    [employeePickerOptions, manualEmployees],
  );

  const errorCountLookup = useMemo(
    () => buildA3ErrorCountLookup(employeeRows, manualEmployees),
    [employeeRows, manualEmployees],
  );

  const chartHeight = useMemo(
    () => Math.max(320, displayedEmployeeRows.length * 30 + 76),
    [displayedEmployeeRows.length],
  );

  const yAxisWidth = useMemo(() => {
    if (!displayedEmployeeRows.length) return 90;
    const maxLen = Math.max(
      ...displayedEmployeeRows.map((row) => String(row.employee || "").length),
    );
    return Math.min(360, Math.max(120, Math.ceil(maxLen * 7) + 18));
  }, [displayedEmployeeRows]);

  const tooltipFormatter = useCallback(
    (value) => [`${value}`, tl("errorCount", "Số lỗi")],
    [tl],
  );

  const closeManualListModal = useCallback(() => {
    setIsManualListModalOpen(false);
  }, []);

  useEffect(() => {
    setIsManualListModalOpen(false);
  }, [reportMonth, reportDepartment]);

  useEffect(() => {
    if (!manualEmployees.length) {
      setIsManualListModalOpen(false);
    }
  }, [manualEmployees.length]);

  const upsertManualEmployees = useCallback(
    (entries) => {
      if (!setManualEmployees) return;
      setManualEmployees((prev) =>
        upsertA3ManualEmployeeEntries(prev, entries),
      );
    },
    [setManualEmployees],
  );

  const handleSelectedEmployeeChange = useCallback(
    (event) => {
      const employee = normalizeText(event.target.value);
      setSelectedEmployee(employee);
      setPendingErrorCount(
        employee
          ? String(errorCountLookup.get(a3EmployeeKey(employee)) ?? 0)
          : "0",
      );
    },
    [errorCountLookup],
  );

  const addEmployeeToList = useCallback(
    (employeeName) => {
      const employee = normalizeText(employeeName);
      if (!employee) return false;
      upsertManualEmployees([
        {
          employee,
          errorCount: Math.max(0, Number(pendingErrorCount || 0)),
        },
      ]);
      return true;
    },
    [pendingErrorCount, upsertManualEmployees],
  );

  const resetPendingAddForm = useCallback(() => {
    setPendingErrorCount("0");
  }, []);

  const handleAddSelectedEmployee = useCallback(() => {
    if (!addEmployeeToList(selectedEmployee)) return;
    setSelectedEmployee("");
    resetPendingAddForm();
  }, [addEmployeeToList, resetPendingAddForm, selectedEmployee]);

  const handleAddCustomEmployee = useCallback(() => {
    if (!addEmployeeToList(customEmployeeName)) return;
    setCustomEmployeeName("");
    resetPendingAddForm();
  }, [addEmployeeToList, customEmployeeName, resetPendingAddForm]);

  const handleAddAllDepartmentEmployees = useCallback(() => {
    if (!employeePickerOptions.length) return;
    upsertManualEmployees(
      employeePickerOptions.map((employee) => ({
        employee,
        errorCount: errorCountLookup.get(a3EmployeeKey(employee)) ?? 0,
      })),
    );
  }, [employeePickerOptions, errorCountLookup, upsertManualEmployees]);

  const renderEmployeeAxisTick = useCallback(
    ({ x, y, payload }) => (
      <text
        x={x}
        y={y}
        dy={4}
        fill={MC_DEFECT_CHART_TEXT}
        fontSize={10}
        fontWeight={700}
        textAnchor="end"
      >
        {String(payload?.value || "")}
      </text>
    ),
    [],
  );

  const handlePrintA3 = useCallback(() => {
    if (!printAreaRef.current) return;
    const printRoot = document.createElement("div");
    printRoot.className = "mc-defect-print-root";
    const clonedPrintArea = printAreaRef.current.cloneNode(true);
    clonedPrintArea.classList.add("mc-defect-a3-chart-print-clone");
    printRoot.appendChild(clonedPrintArea);
    const clonedHeading = printRoot.querySelector(
      ".mc-defect-a3-chart-print-heading",
    );
    if (clonedHeading) clonedHeading.style.display = "block";
    const clonedChartBody = printRoot.querySelector(
      ".mc-defect-a3-chart-print-body",
    );
    if (clonedChartBody) clonedChartBody.style.minWidth = "0";
    document.body.appendChild(printRoot);
    document.body.classList.add("mc-defect-printing");

    const cleanup = () => {
      document.body.classList.remove("mc-defect-printing");
      printRoot.remove();
      window.removeEventListener("afterprint", cleanup);
    };

    window.addEventListener("afterprint", cleanup);
    requestAnimationFrame(() => window.print());
    setTimeout(cleanup, 10000);
  }, []);

  const customEmployeeTrimmed = normalizeText(customEmployeeName);

  const employeeInputPanel = (
    <div className="mc-defect-a3-no-print mb-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm dark:border-slate-700 dark:from-slate-900 dark:to-slate-800/70">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">
            {tl("a3EmployeeListInputLabel", "Danh sách nhân viên A3")}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {tl(
              "a3EmployeePickerHint",
              "Chọn nhân viên có sẵn từ dropdown, hoặc nhập tên mới nếu chưa có trong danh sách.",
            )}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {tl("a3ManualEmployeeCount", "{{count}} nhân viên", {
            count: manualEmployees.length,
          })}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_110px_auto] md:items-end">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase text-slate-500">
            {tl("a3SelectEmployee", "Chọn nhân viên")}
          </span>
          <select
            value={selectedEmployee}
            onChange={handleSelectedEmployeeChange}
            className={A3_SELECT_FIELD_CLASS}
          >
            <option value="">
              {tl("a3SelectEmployeePlaceholder", "-- Chọn nhân viên --")}
            </option>
            {pickerOptions.map((employee) => (
              <option key={employee} value={employee}>
                {employee}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase text-slate-500">
            {tl("a3ManualErrorCount", "Số lỗi")}
          </span>
          <input
            type="number"
            min="0"
            step="1"
            value={pendingErrorCount}
            onChange={(event) => setPendingErrorCount(event.target.value)}
            className={`${A3_SELECT_FIELD_CLASS} text-center`}
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase text-transparent select-none">
            action
          </span>
          <button
            type="button"
            onClick={handleAddSelectedEmployee}
            disabled={a3ManualSaving || !selectedEmployee}
            className="h-10 rounded-xl bg-sky-700 px-4 text-xs font-bold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 dark:disabled:bg-slate-700"
          >
            {tl("addA3Employee", "Thêm")}
          </button>
        </div>
      </div>

      <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="min-w-0 flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase text-slate-500">
              {tl("a3NewEmployeeName", "Nhân viên mới")}
            </span>
            <input
              type="text"
              value={customEmployeeName}
              onChange={(event) => setCustomEmployeeName(event.target.value)}
              placeholder={tl(
                "a3NewEmployeePlaceholder",
                "Nhập tên nhân viên chưa có trong dropdown",
              )}
              className={A3_SELECT_FIELD_CLASS}
            />
          </label>
          <button
            type="button"
            onClick={handleAddCustomEmployee}
            disabled={a3ManualSaving || !customEmployeeTrimmed}
            className="h-10 shrink-0 rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            {tl("addA3NewEmployee", "Thêm nhân viên mới")}
          </button>
        </div>
      </div>

      {reportDepartment && reportDepartment !== MC_DEFECT_FILTER_ALL ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAddAllDepartmentEmployees}
            disabled={a3ManualSaving || !employeePickerOptions.length}
            className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-900 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100 dark:hover:bg-sky-900/60"
          >
            {tl(
              "addAllA3DepartmentEmployees",
              "Thêm toàn bộ bộ phận {{department}}",
              { department: reportDepartment },
            )}
          </button>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {tl("a3PickerOptionCount", "{{count}} nhân viên trong danh sách", {
              count: employeePickerOptions.length,
            })}
          </span>
        </div>
      ) : null}

      {manualEmployees.length ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsManualListModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-sky-200/80 bg-gradient-to-r from-sky-50 to-white px-3.5 py-2 text-xs font-bold text-sky-900 shadow-sm transition hover:border-sky-300 hover:from-sky-100 hover:to-sky-50 dark:border-sky-900/60 dark:from-sky-950/40 dark:to-slate-900 dark:text-sky-100 dark:hover:border-sky-800"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 10h16M4 14h16M4 18h16"
              />
            </svg>
            {tl("viewA3ManualList", "Xem chi tiết ({{count}} nhân viên)", {
              count: manualEmployees.length,
            })}
          </button>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {tl(
              "a3ManualListModalHint",
              "Mở popup để chỉnh số lỗi và xóa nhân viên đã thêm.",
            )}
          </span>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-xs font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {tl(
            "a3NoManualEmployees",
            "Chưa có nhân viên nào trong danh sách A3.",
          )}
        </div>
      )}
    </div>
  );

  return (
    <section className="mc-defect-a3-section rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-300">
            {tl("a3Badge", "Mục in A3")}
          </p>
          <h2 className="text-xl font-black uppercase tracking-wide text-slate-950 dark:text-slate-50">
            {tl("a3Title", "Danh sách lỗi nhân viên trong tháng")}
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
            {tl("a3Subtitle", "Kỳ báo cáo: {{period}} · Tổng lỗi: {{total}}", {
              period: reportPeriodLabel,
              total: displayedTotalErrorCount,
            })}
          </p>
        </div>
        <div className="mc-defect-a3-no-print flex flex-wrap gap-2">
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls="mc-defect-a3-chart"
            onClick={() => setIsExpanded((value) => !value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            {isExpanded
              ? tl("hideA3Section", "Tắt phần này")
              : tl("showA3Section", "Mở phần này")}
          </button>
          {isExpanded ? (
            <button
              type="button"
              onClick={handlePrintA3}
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
            >
              {tl("printA3", "In A3")}
            </button>
          ) : null}
        </div>
      </div>

      {!isExpanded ? (
        <div className="mc-defect-a3-no-print rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">
          {tl(
            "a3CollapsedHint",
            "Phần này đang được thu gọn. Mở khi cần xem hoặc in thông báo A3.",
          )}
        </div>
      ) : displayedEmployeeRows.length ? (
        <>
          {employeeInputPanel}
          <div
            id="mc-defect-a3-chart"
            ref={printAreaRef}
            className="mc-defect-a3-chart-print mc-defect-a3-scroll rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/40"
          >
            <div className="mc-defect-a3-chart-print-heading">
              <h2>{tl("a3Title", "Danh sách lỗi nhân viên trong tháng")}</h2>
              <p>
                {tl(
                  "a3Subtitle",
                  "Kỳ báo cáo: {{period}} · Tổng lỗi: {{total}}",
                  {
                    period: reportPeriodLabel,
                    total: displayedTotalErrorCount,
                  },
                )}
              </p>
            </div>
            <div
              className="mc-defect-a3-chart-print-body"
              style={{ height: chartHeight, minWidth: 760 }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={displayedEmployeeRows}
                  layout="vertical"
                  margin={{ top: 8, right: 42, left: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={A3_AXIS_TICK_STYLE}
                  />
                  <YAxis
                    type="category"
                    dataKey="employee"
                    width={yAxisWidth}
                    interval={0}
                    tick={renderEmployeeAxisTick}
                  />
                  <Tooltip
                    {...MC_DEFECT_CHART_TOOLTIP_PROPS}
                    formatter={tooltipFormatter}
                  />
                  <Bar
                    dataKey="errorCount"
                    name={tl("errorCount", "Số lỗi")}
                    fill={MC_DEFECT_CHART_PRIMARY}
                    radius={[0, 8, 8, 0]}
                    barSize={16}
                  >
                    <LabelList dataKey="errorCount" {...A3_BAR_LABEL_STYLE} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <>
          {employeeInputPanel}
          <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {tl("a3Empty", "Không có dữ liệu lỗi nhân viên trong kỳ này.")}
          </div>
        </>
      )}

      <A3ManualEmployeeListModal
        isOpen={isManualListModalOpen}
        manualEmployees={manualEmployees}
        setManualEmployees={setManualEmployees}
        saving={a3ManualSaving}
        onClose={closeManualListModal}
      />
    </section>
  );
}

export default memo(MCDefectReportEmployeeMonthlyAnnouncement);
