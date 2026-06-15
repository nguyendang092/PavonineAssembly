import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { buildPayrollMonthDayCellFormRecord } from "@/features/payroll/buildPayrollDayFromRaw";
import { pickPayrollEmployeeJoinDate } from "@/features/payroll/payrollEmployeeFields";
import {
  collectPayrollMonthSortedEmployeeIds,
  fetchPayrollMonthDayChunks,
  formatPayrollMonthWeekday3,
  matchesPayrollMonthRowFilter,
  parsePayrollMonthSortableStt,
  payrollMonthRepresentativeEmployee,
} from "@/features/payroll/payrollMonthlyGridData";
import {
  payrollMonthlyTimesheetDayBodyBgClass,
  payrollMonthlyTimesheetDayHeaderBgClass,
} from "@/features/payroll/payrollMonthlyTimesheetGridStyle";
import { isPayrollMonthDayOnOrAfterJoin } from "@/features/payroll/payrollMonthlyRuleSummary";
import { payrollMonthMainRowDashMark } from "@/features/attendance/attendanceDayMeta";
import {
  formatAttendanceLeaveTypeColumnForEmployee,
  formatAttendanceTimeInColumnDisplay,
  getAttendanceLeaveTypeCompactBadgeClassName,
  getAttendanceLeaveTypeEmphasisBadgeClassName,
  getAttendanceLeaveTypeEmphasisCellClassName,
  isAttendanceGioVaoClockTime,
} from "@/features/attendance/attendanceGioVaoTypeOptions";
import { pickAttendanceEmployeeDayFields } from "@/features/attendance/attendanceEmployeeFields";
import AttendanceEmployeeFormModal from "@/features/attendance/AttendanceEmployeeFormModal";
import { canEditPayrollMonthTimesheetGridCell } from "@/config/featurePermissions";
import {
  enumerateDateKeysInclusive,
  getFirstDayOfMonthKey,
  getLastDayOfMonthKey,
  parseLocalDateKey,
} from "@/utils/dateKey";
import "./payrollMonthlyTimeInOutModal.css";

const STICKY_COL_WIDTHS = [42, 200, 80, 72];
const STICKY_COL_COUNT = STICKY_COL_WIDTHS.length;
const DAY_COL_WIDTH = 72;
const VIRTUAL_THRESHOLD = 18;
const ZOOM_LEVELS = [0.78, 0.85, 1, 1.15, 1.35];
const ZOOM_STORAGE_KEY = "payrollMonthlyTimeInOutZoomIdx";
const ZOOM_DEFAULT_IDX = ZOOM_LEVELS.indexOf(1);

const DAY_CELL_INTERACTIVE =
  "cursor-pointer ring-inset hover:ring-2 hover:ring-teal-400/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 dark:hover:ring-teal-500/50";

/** Một class viền duy nhất — chi tiết trong CSS (`pm-tio-cell`). */
function pmTioStickyClass() {
  return "pm-tio-cell pm-tio-sticky-cell";
}

function pmTioDayCellClass(extra = "") {
  return ["pm-tio-cell", "pm-tio-day-cell", extra].filter(Boolean).join(" ");
}

function timesheetZoomCssSupported() {
  return (
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("zoom", "1")
  );
}

const ZOOM_CSS_OK = timesheetZoomCssSupported();

function readStoredZoomIdx() {
  if (!ZOOM_CSS_OK) return ZOOM_DEFAULT_IDX;
  if (typeof window === "undefined") return ZOOM_DEFAULT_IDX;
  try {
    const raw = window.localStorage.getItem(ZOOM_STORAGE_KEY);
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 0 && n < ZOOM_LEVELS.length) return n;
  } catch {
    /* ignore */
  }
  return ZOOM_DEFAULT_IDX;
}

function stickyColStyle(colIndex) {
  let left = 0;
  for (let i = 0; i < colIndex; i++) left += STICKY_COL_WIDTHS[i];
  const w = STICKY_COL_WIDTHS[colIndex];
  return {
    position: "sticky",
    left,
    zIndex: 120 - colIndex,
    width: w,
    minWidth: w,
    maxWidth: w,
    boxSizing: "border-box",
    backgroundClip: "padding-box",
    transform: "translateZ(0)",
  };
}

function TimeInOutTimeGrid({ timeInDisp, timeOutDisp, tlPage }) {
  const inLabel = tlPage("monthlyTimeInOutLegendIn", "Vào");
  const outLabel = tlPage("timeOutShortLabel", "Ra");
  const inEmpty = timeInDisp === "—";
  const outEmpty = timeOutDisp === "—";
  return (
    <div className="pm-tio-time-grid">
      <span className="pm-tio-time-label pm-tio-time-label--in">{inLabel}</span>
      <span
        className={`pm-tio-time-value ${inEmpty ? "pm-tio-time-value--empty" : "pm-tio-time-value--filled"}`}
      >
        {timeInDisp}
      </span>
      <span className="pm-tio-time-label pm-tio-time-label--out">{outLabel}</span>
      <span
        className={`pm-tio-time-value ${outEmpty ? "pm-tio-time-value--empty" : "pm-tio-time-value--filled"}`}
      >
        {timeOutDisp}
      </span>
    </div>
  );
}

function dayColStyle() {
  return {
    width: DAY_COL_WIDTH,
    minWidth: DAY_COL_WIDTH,
    maxWidth: DAY_COL_WIDTH,
    boxSizing: "border-box",
  };
}

function formatTimeOutDisplay(raw) {
  const s = String(raw ?? "").trim();
  return s || "—";
}

function buildTimeInOutDayCells({ monthDayMeta, rep, rowId }) {
  return monthDayMeta.map(({ dateKey, chunk, bodyBg }) => {
    const beforeJoin = !isPayrollMonthDayOnOrAfterJoin(
      dateKey,
      pickPayrollEmployeeJoinDate(rep),
    );
    if (beforeJoin || !chunk) {
      return { dateKey, chunk, baseBg: bodyBg, beforeJoin, emp: null };
    }
    const emp = (chunk.byMonthEmployeeKey || chunk.byId).get(rowId);
    return { dateKey, chunk, baseBg: bodyBg, beforeJoin, emp };
  });
}

const TimeInOutDayCell = memo(function TimeInOutDayCell({
  dayCell,
  rowId,
  rep,
  loading,
  user,
  userRole,
  userDepartments,
  openDayCellEditor,
  tlPage,
}) {
  const cellStyle = dayColStyle();
  const dayCellClass = (extra = "") => pmTioDayCellClass(extra);

  if (dayCell.beforeJoin) {
    return (
      <td
        style={cellStyle}
        className={dayCellClass(`text-center text-slate-300 ${dayCell.baseBg}`)}
      >
        {" "}
      </td>
    );
  }

  if (!dayCell.chunk) {
    return (
      <td
        style={cellStyle}
        className={dayCellClass(`text-center text-slate-400 ${dayCell.baseBg}`)}
      >
        {" "}
      </td>
    );
  }

  const canOpen = canEditPayrollMonthTimesheetGridCell({
    loading,
    user,
    rep,
    rowDayEmp: dayCell.emp,
    userRole,
    userDepartments,
  });

  const interactClass = canOpen ? DAY_CELL_INTERACTIVE : "";
  const interactProps = canOpen
    ? {
        role: "button",
        tabIndex: 0,
        title: tlPage(
          "monthlyTimeInOutCellEditHint",
          "Bấm để sửa giờ vào/ra ngày này.",
        ),
        onClick: (e) => {
          e.preventDefault();
          openDayCellEditor(dayCell.dateKey, rowId);
        },
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openDayCellEditor(dayCell.dateKey, rowId);
          }
        },
      }
    : {};

  if (!dayCell.emp) {
    const dayCode = payrollMonthMainRowDashMark(dayCell.chunk, null);
    return (
      <td
        style={cellStyle}
        className={dayCellClass(
          `text-center align-middle text-[11px] font-extrabold tracking-wide text-slate-800 dark:text-slate-100 ${dayCell.baseBg} ${interactClass}`,
        )}
        {...interactProps}
      >
        {dayCode}
      </td>
    );
  }

  const fields = pickAttendanceEmployeeDayFields(dayCell.emp);
  const timeInRaw = String(fields.timeIn ?? "").trim();
  const timeOutRaw = String(fields.timeOut ?? "").trim();
  const leaveShort = formatAttendanceLeaveTypeColumnForEmployee(dayCell.emp);
  const leaveRaw = String(fields.leaveType ?? "").trim();

  if (leaveShort && !isAttendanceGioVaoClockTime(timeInRaw)) {
    return (
      <td
        style={cellStyle}
        className={dayCellClass(
          `pm-tio-leave-cell align-middle ${getAttendanceLeaveTypeEmphasisCellClassName(leaveRaw)} ${interactClass}`,
        )}
        {...interactProps}
      >
        <div className="pm-tio-leave-wrap">
          <span
            className={`pm-tio-leave-badge ${getAttendanceLeaveTypeEmphasisBadgeClassName(leaveRaw)} ${getAttendanceLeaveTypeCompactBadgeClassName(leaveShort)}`}
            title={leaveRaw}
          >
            {leaveShort}
          </span>
        </div>
      </td>
    );
  }

  const timeInDisp = timeInRaw
    ? formatAttendanceTimeInColumnDisplay(timeInRaw)
    : "—";
  const timeOutDisp = formatTimeOutDisplay(timeOutRaw);

  return (
    <td
      style={cellStyle}
      className={dayCellClass(`align-middle ${dayCell.baseBg} ${interactClass}`)}
      {...interactProps}
    >
      <TimeInOutTimeGrid
        timeInDisp={timeInDisp}
        timeOutDisp={timeOutDisp}
        tlPage={tlPage}
      />
    </td>
  );
});

const TimeInOutEmployeeRow = memo(function TimeInOutEmployeeRow({
  rowId,
  empBlockIdx,
  rep,
  dayCells,
  loading,
  user,
  userRole,
  userDepartments,
  openDayCellEditor,
  tlPage,
}) {
  const sttDisp =
    rep.stt != null && String(rep.stt).trim() !== ""
      ? rep.stt
      : empBlockIdx + 1;
  const rowBg =
    empBlockIdx % 2 === 0
      ? "bg-white dark:bg-slate-900"
      : "bg-slate-50/95 dark:bg-slate-800/95";
  return (
    <tr className={rowBg}>
      <td
        style={stickyColStyle(0)}
        className={`${pmTioStickyClass()} py-1.5 px-1.5 text-center text-[11px] font-extrabold tabular-nums text-slate-900 dark:text-slate-100 ${rowBg}`}
      >
        {sttDisp}
      </td>
      <td
        style={stickyColStyle(1)}
        className={`${pmTioStickyClass()} py-1.5 px-2 text-[11px] font-bold leading-tight text-slate-900 dark:text-slate-100 ${rowBg} truncate`}
        title={rep.hoVaTen || ""}
      >
        {rep.hoVaTen || "—"}
      </td>
      <td
        style={stickyColStyle(2)}
        className={`${pmTioStickyClass()} py-1.5 px-1 text-center text-[11px] font-bold tabular-nums text-slate-900 dark:text-slate-100 ${rowBg}`}
      >
        {rep.mnv || "—"}
      </td>
      <td
        style={stickyColStyle(3)}
        className={`${pmTioStickyClass()} py-1.5 px-1 text-center text-[10px] font-bold leading-snug text-slate-700 dark:text-slate-200 ${rowBg}`}
        title={rep.boPhan || ""}
      >
        {rep.boPhan || "—"}
      </td>
      {dayCells.map((dayCell) => (
        <TimeInOutDayCell
          key={dayCell.dateKey}
          dayCell={dayCell}
          rowId={rowId}
          rep={rep}
          loading={loading}
          user={user}
          userRole={userRole}
          userDepartments={userDepartments}
          openDayCellEditor={openDayCellEditor}
          tlPage={tlPage}
        />
      ))}
    </tr>
  );
});

/**
 * Lưới giờ vào / giờ ra cả tháng — layout tương tự bảng chấm công tháng (một ô/ngày: vào trên, ra dưới).
 */
export default function PayrollMonthlyTimeInOutModal({
  open,
  onClose,
  anchorDateKey,
  displayLocale = "vi-VN",
  tlPage,
  searchTerm = "",
  departmentFilter = "",
  payrollDepartmentOptions,
  onDepartmentFilterChange,
  normalizeDepartment = (v) =>
    String(v || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase(),
  user = null,
  userRole = null,
  userDepartments = null,
  onAlert,
  employees = [],
}) {
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [dayChunks, setDayChunks] = useState([]);
  const [localNameFilter, setLocalNameFilter] = useState("");
  const [zoomIdx, setZoomIdx] = useState(readStoredZoomIdx);
  const tableBodyScrollRef = useRef(null);
  const loadSeqRef = useRef(0);
  const [dayCellFormOpen, setDayCellFormOpen] = useState(false);
  const [dayCellFormDate, setDayCellFormDate] = useState("");
  const [dayCellFormInitial, setDayCellFormInitial] = useState(null);
  const [dayCellFormEmployees, setDayCellFormEmployees] = useState([]);

  const monthRange = useMemo(() => {
    const first = getFirstDayOfMonthKey(anchorDateKey);
    const last = getLastDayOfMonthKey(anchorDateKey);
    const keys = enumerateDateKeysInclusive(first, last);
    return { first, last, keys };
  }, [anchorDateKey]);

  const monthTitle = useMemo(() => {
    const d = parseLocalDateKey(monthRange.first);
    if (!d) return anchorDateKey;
    return d.toLocaleDateString(displayLocale, {
      month: "long",
      year: "numeric",
    });
  }, [monthRange.first, anchorDateKey, displayLocale]);

  const zoom = ZOOM_LEVELS[zoomIdx];

  const bumpZoom = useCallback((delta) => {
    setZoomIdx((i) => {
      const n = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, i + delta));
      try {
        window.localStorage.setItem(ZOOM_STORAGE_KEY, String(n));
      } catch {
        /* ignore */
      }
      return n;
    });
  }, []);

  const resetZoom = useCallback(() => {
    setZoomIdx(ZOOM_DEFAULT_IDX);
    try {
      window.localStorage.setItem(ZOOM_STORAGE_KEY, String(ZOOM_DEFAULT_IDX));
    } catch {
      /* ignore */
    }
  }, []);

  const loadMonth = useCallback(async () => {
    const currentLoadSeq = loadSeqRef.current + 1;
    loadSeqRef.current = currentLoadSeq;
    setLoading(true);
    setLoadingMore(false);
    setError("");
    setDayChunks([]);
    try {
      const allChunks = await fetchPayrollMonthDayChunks(monthRange.keys, {
        isStale: () => loadSeqRef.current !== currentLoadSeq,
        onFirstBatch: (chunks) => {
          setDayChunks(chunks);
          setLoading(false);
        },
        onAfterBatch: (i, total, chunks) => {
          setDayChunks(chunks);
          setLoadingMore(i + 4 < total);
        },
      });
      if (loadSeqRef.current !== currentLoadSeq || allChunks == null) return;
      setDayChunks(allChunks);
      if (!allChunks.length) {
        setError(
          tlPage(
            "monthlyTimeInOutEmpty",
            "Không có dữ liệu điểm danh nào trong tháng này.",
          ),
        );
      }
    } catch (e) {
      if (loadSeqRef.current !== currentLoadSeq) return;
      setError(
        tlPage("monthlyTimeInOutError", "Không tải được dữ liệu: {{error}}", {
          error: e?.message || String(e),
        }),
      );
    } finally {
      if (loadSeqRef.current === currentLoadSeq) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [monthRange.keys, tlPage]);

  useEffect(() => {
    if (!open) return;
    void loadMonth();
  }, [open, loadMonth]);

  useEffect(() => {
    if (!open) return undefined;
    const html = document.documentElement;
    const body = document.body;
    const mainScroll = document.getElementById("app-main-scroll");
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevMainOverflow = mainScroll?.style.overflow ?? "";
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    if (mainScroll) mainScroll.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      if (mainScroll) mainScroll.style.overflow = prevMainOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (open) return;
    setDayCellFormOpen(false);
    setDayCellFormDate("");
    setDayCellFormInitial(null);
    setDayCellFormEmployees([]);
  }, [open]);

  const sortedIds = useMemo(
    () => collectPayrollMonthSortedEmployeeIds(dayChunks),
    [dayChunks],
  );

  const repById = useMemo(() => {
    const m = new Map();
    for (const id of sortedIds) {
      m.set(id, payrollMonthRepresentativeEmployee(dayChunks, id));
    }
    return m;
  }, [sortedIds, dayChunks]);

  const chunkByDate = useMemo(
    () => new Map(dayChunks.map((c) => [c.dateKey, c])),
    [dayChunks],
  );

  const effectiveDepartmentFilter = departmentFilter || "";
  const effectiveSearchTerm = localNameFilter || searchTerm || "";

  const filteredIds = useMemo(() => {
    return sortedIds
      .filter((id) => {
        const rep = repById.get(id);
        return (
          rep &&
          matchesPayrollMonthRowFilter(rep, {
            searchTerm: effectiveSearchTerm,
            departmentFilter: effectiveDepartmentFilter,
            normalizeDepartment,
          })
        );
      })
      .sort((a, b) => {
        const aRep = repById.get(a);
        const bRep = repById.get(b);
        return (
          parsePayrollMonthSortableStt(aRep?.stt) -
          parsePayrollMonthSortableStt(bRep?.stt)
        );
      });
  }, [
    sortedIds,
    repById,
    effectiveSearchTerm,
    effectiveDepartmentFilter,
    normalizeDepartment,
  ]);

  const monthDayMeta = useMemo(
    () =>
      monthRange.keys.map((dateKey) => {
        const parsedDate = parseLocalDateKey(dateKey);
        const chunk = chunkByDate.get(dateKey);
        return {
          dateKey,
          parsedDate,
          dayOfMonth: parsedDate ? parsedDate.getDate() : "",
          weekdayLabel: formatPayrollMonthWeekday3(parsedDate),
          chunk,
          headerBg: payrollMonthlyTimesheetDayHeaderBgClass(parsedDate, chunk),
          bodyBg: payrollMonthlyTimesheetDayBodyBgClass(parsedDate, chunk),
        };
      }),
    [monthRange.keys, chunkByDate],
  );

  const dayCellsById = useMemo(() => {
    const m = new Map();
    for (const rowId of filteredIds) {
      m.set(
        rowId,
        buildTimeInOutDayCells({
          monthDayMeta,
          rep: repById.get(rowId),
          rowId,
        }),
      );
    }
    return m;
  }, [filteredIds, monthDayMeta, repById]);

  const openDayCellForm = useCallback((dateKey, dayEmps, formInitial) => {
    setDayCellFormEmployees(dayEmps);
    setDayCellFormDate(dateKey);
    setDayCellFormInitial(formInitial);
    setDayCellFormOpen(true);
  }, []);

  const openDayCellEditor = useCallback(
    (dateKey, rowId) => {
      if (!user) {
        onAlert?.({
          show: true,
          type: "error",
          message: tlPage(
            "monthlyTimesheetLoginToEdit",
            "Đăng nhập để chỉnh sửa điểm danh.",
          ),
        });
        return;
      }
      const ch = chunkByDate.get(dateKey);
      if (!ch) return;
      const rep = repById.get(rowId);
      if (!rep) return;
      const dayEmp = (ch.byMonthEmployeeKey || ch.byId).get(rowId);
      const dayEmps =
        Array.isArray(ch.baseEmployees) && ch.baseEmployees.length > 0
          ? ch.baseEmployees
          : Array.isArray(ch.employees)
            ? ch.employees
            : [];
      const formInitial = buildPayrollMonthDayCellFormRecord({
        chunk: ch,
        rowId,
        rep,
        dayEmp,
      });
      const canEditCell = canEditPayrollMonthTimesheetGridCell({
        loading: false,
        user,
        rep,
        rowDayEmp: dayEmp,
        userRole,
        userDepartments,
      });
      if (!canEditCell) {
        onAlert?.({
          show: true,
          type: "error",
          message: dayEmp
            ? tlPage(
                "monthlyTimesheetNoEditPermission",
                "Bạn không có quyền sửa nhân viên này.",
              )
            : tlPage(
                "monthlyTimesheetNoAddPermission",
                "Bạn không có quyền thêm điểm danh cho bộ phận này.",
              ),
        });
        return;
      }
      openDayCellForm(dateKey, dayEmps, formInitial);
    },
    [
      user,
      chunkByDate,
      repById,
      userRole,
      userDepartments,
      onAlert,
      tlPage,
      openDayCellForm,
    ],
  );

  const departmentOptions = useMemo(() => {
    if (payrollDepartmentOptions?.length) return payrollDepartmentOptions;
    const set = new Set();
    for (const id of sortedIds) {
      const rep = repById.get(id);
      const d = String(rep?.boPhan ?? "").trim();
      if (d) set.add(d);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "vi"));
  }, [sortedIds, repById, payrollDepartmentOptions]);

  const shouldVirtualize = filteredIds.length >= VIRTUAL_THRESHOLD;
  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? filteredIds.length : 0,
    getScrollElement: () => tableBodyScrollRef.current,
    estimateSize: () => 44 * (ZOOM_CSS_OK ? zoom : 1),
    overscan: 4,
  });

  const stickyTotal = STICKY_COL_WIDTHS.reduce((a, b) => a + b, 0);
  const dayColCount = monthRange.keys.length;
  const tableWidth = stickyTotal + dayColCount * DAY_COL_WIDTH;
  const modalWidth = tableWidth + 48;

  const tableColGroup = useMemo(
    () => (
      <colgroup>
        {STICKY_COL_WIDTHS.map((w, i) => (
          <col key={`sticky-col-${i}`} style={{ width: w, minWidth: w }} />
        ))}
        {monthRange.keys.map((dateKey) => (
          <col
            key={dateKey}
            style={{ width: DAY_COL_WIDTH, minWidth: DAY_COL_WIDTH }}
          />
        ))}
      </colgroup>
    ),
    [monthRange.keys],
  );

  const virtualItems = shouldVirtualize ? rowVirtualizer.getVirtualItems() : [];
  const tbodyPadTop =
    shouldVirtualize && virtualItems.length > 0 ? virtualItems[0].start : 0;
  const tbodyPadBottom =
    shouldVirtualize && virtualItems.length > 0
      ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0;

  if (!open) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 flex flex-col overflow-hidden overscroll-none bg-black/50 p-2 backdrop-blur-[1px] sm:p-4"
        style={{ zIndex: "var(--z-modal-backdrop, 1200)" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payroll-monthly-time-in-out-title"
      >
        <div
          className="mx-auto flex w-full flex-col overflow-hidden rounded-xl border border-teal-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900"
          style={{
            maxWidth: `min(calc(100vw - 1rem), ${modalWidth}px)`,
            maxHeight: "calc(100vh - 1rem)",
          }}
        >
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-gradient-to-r from-teal-600 to-cyan-600 px-3 py-2 dark:border-slate-700">
            <div className="min-w-0">
              <h2
                id="payroll-monthly-time-in-out-title"
                className="truncate text-sm font-extrabold uppercase tracking-wide text-white sm:text-base"
              >
                {tlPage("monthlyTimeInOutTitle", "Giờ vào / ra tháng")}
                {` (${monthTitle})`}
              </h2>
              <p className="text-[10px] font-medium text-teal-50/90">
                {tlPage(
                  "monthlyTimeInOutSubtitle",
                  "Mỗi ô: giờ vào (trên) · giờ ra (dưới).",
                )}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void loadMonth()}
                disabled={loading}
                className="rounded-lg border border-white/40 bg-white/15 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-white/25 disabled:opacity-50"
              >
                {tlPage("monthlyTimesheetReload", "Tải lại")}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border-2 border-white/80 bg-white px-3 py-1 text-xs font-bold text-teal-700 shadow-sm hover:bg-teal-50"
              >
                {tlPage("monthlyTimesheetClose", "Đóng")}
              </button>
            </div>
          </div>

          <div className="min-h-0 flex flex-1 flex-col p-2 sm:p-3">
            <div className="pm-tio-toolbar mb-2">
              <div className="pm-tio-legend">
                <span className="pm-tio-legend-chip pm-tio-legend-chip--note">
                  {tlPage(
                    "monthlyTimeInOutSubtitle",
                    "Mỗi ô: giờ vào (trên) · giờ ra (dưới).",
                  )}
                </span>
                <span className="pm-tio-legend-chip pm-tio-legend-chip--in">
                  <span className="pm-tio-time-label pm-tio-time-label--in">
                    {tlPage("monthlyTimeInOutLegendIn", "Vào")}
                  </span>
                  <span className="pm-tio-legend-arrow">→</span>
                  <span className="pm-tio-legend-sample">08:00</span>
                </span>
                <span className="pm-tio-legend-chip pm-tio-legend-chip--out">
                  <span className="pm-tio-time-label pm-tio-time-label--out">
                    {tlPage("timeOutShortLabel", "Ra")}
                  </span>
                  <span className="pm-tio-legend-arrow">→</span>
                  <span className="pm-tio-legend-sample">17:30</span>
                </span>
              </div>
              <div className="pm-tio-filters">
              <input
                type="text"
                value={localNameFilter}
                onChange={(e) => setLocalNameFilter(e.target.value)}
                placeholder={tlPage(
                  "monthlyTimesheetFilterNamePlaceholder",
                  "Lọc theo tên / MNV / bộ phận",
                )}
                className="pm-tio-filter-input pm-tio-filter-input--search"
              />
              <select
                value={departmentFilter}
                onChange={(e) => {
                  const v = e.target.value;
                  if (onDepartmentFilterChange) onDepartmentFilterChange(v);
                }}
                className="pm-tio-filter-input pm-tio-filter-input--select"
              >
                <option value="">
                  {tlPage("monthlyTimesheetDeptAll", "Tất cả bộ phận")}
                </option>
                {departmentOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              {ZOOM_CSS_OK ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => bumpZoom(-1)}
                    disabled={zoomIdx <= 0}
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-bold disabled:opacity-40"
                    title={tlPage("monthlyTimesheetZoomOut", "Thu nhỏ")}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => bumpZoom(1)}
                    disabled={zoomIdx >= ZOOM_LEVELS.length - 1}
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-bold disabled:opacity-40"
                    title={tlPage("monthlyTimesheetZoomIn", "Phóng to")}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={resetZoom}
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] font-bold"
                  >
                    {tlPage("monthlyTimesheetZoomReset", "Mặc định")}
                  </button>
                </div>
              ) : null}
              </div>
            </div>

            {loading && dayChunks.length === 0 ? (
              <p className="py-8 text-center text-sm font-semibold text-slate-600">
                {tlPage("monthlyTimesheetLoading", "Đang tải dữ liệu điểm danh…")}
              </p>
            ) : error ? (
              <p className="py-8 text-center text-sm font-semibold text-red-600">
                {error}
              </p>
            ) : (
              <div
                ref={tableBodyScrollRef}
                className="pm-tio-scroll min-h-0 flex-1 overflow-auto rounded-lg bg-white shadow-inner dark:bg-slate-950"
                style={
                  ZOOM_CSS_OK
                    ? { zoom }
                    : { transform: `scale(${zoom})`, transformOrigin: "top left" }
                }
              >
                <div className="pm-tio-table-wrap inline-block min-w-full align-middle">
                  <table
                    className="pm-tio-table border-collapse text-left text-slate-900 dark:text-slate-100"
                    style={{ width: tableWidth, minWidth: tableWidth }}
                  >
                    {tableColGroup}
                  <thead className="sticky top-0 z-[130] shadow-sm">
                    <tr>
                      <th
                        rowSpan={2}
                        style={stickyColStyle(0)}
                        className={`${pmTioStickyClass()} bg-slate-100 px-1.5 py-2 text-center text-[10px] font-extrabold uppercase tracking-wide text-slate-800 dark:bg-slate-800 dark:text-slate-100`}
                      >
                        {tlPage("monthlyTimesheetColStt", "STT")}
                      </th>
                      <th
                        rowSpan={2}
                        style={stickyColStyle(1)}
                        className={`${pmTioStickyClass()} bg-slate-100 px-2 py-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-800 dark:bg-slate-800 dark:text-slate-100`}
                      >
                        {tlPage("monthlyTimesheetColName", "Họ và tên")}
                      </th>
                      <th
                        rowSpan={2}
                        style={stickyColStyle(2)}
                        className={`${pmTioStickyClass()} bg-slate-100 px-1 py-2 text-center text-[10px] font-extrabold uppercase tracking-wide text-slate-800 dark:bg-slate-800 dark:text-slate-100`}
                      >
                        {tlPage("monthlyTimesheetColMnv", "MNV")}
                      </th>
                      <th
                        rowSpan={2}
                        style={stickyColStyle(3)}
                        className={`${pmTioStickyClass()} bg-slate-100 px-1 py-2 text-center text-[10px] font-extrabold uppercase tracking-wide text-slate-800 dark:bg-slate-800 dark:text-slate-100`}
                      >
                        {tlPage("monthlyTimesheetColDept", "BP")}
                      </th>
                      <th
                        colSpan={monthRange.keys.length}
                        className="pm-tio-cell bg-gradient-to-r from-teal-100 to-cyan-100 px-2 py-1.5 text-center text-[10px] font-extrabold uppercase tracking-wide text-teal-950 dark:from-teal-950/60 dark:to-cyan-950/40 dark:text-teal-100"
                      >
                        {tlPage("monthlyTimesheetDaysInMonth", "Ngày trong tháng")}
                      </th>
                    </tr>
                    <tr>
                      {monthDayMeta.map((d) => {
                        const isSun = d.parsedDate?.getDay() === 0;
                        return (
                          <th
                            key={d.dateKey}
                            style={dayColStyle()}
                            className={`pm-tio-cell px-1 py-1.5 text-center ${d.headerBg}`}
                          >
                            <div className="pm-tio-header-day">
                              {String(d.dayOfMonth).padStart(2, "0")}
                            </div>
                            <div
                              className={`pm-tio-header-wd ${isSun ? "pm-tio-header-wd--sun" : ""}`}
                            >
                              {d.weekdayLabel}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {shouldVirtualize ? (
                      <>
                        {tbodyPadTop > 0 ? (
                          <tr>
                            <td
                              colSpan={STICKY_COL_COUNT + dayColCount}
                              style={{ height: tbodyPadTop, padding: 0, border: 0 }}
                            />
                          </tr>
                        ) : null}
                        {virtualItems.map((vi) => {
                          const rowId = filteredIds[vi.index];
                          const rep = repById.get(rowId);
                          if (!rep) return null;
                          return (
                            <TimeInOutEmployeeRow
                              key={rowId}
                              rowId={rowId}
                              empBlockIdx={vi.index}
                              rep={rep}
                              dayCells={dayCellsById.get(rowId) ?? []}
                              loading={loading}
                              user={user}
                              userRole={userRole}
                              userDepartments={userDepartments}
                              openDayCellEditor={openDayCellEditor}
                              tlPage={tlPage}
                            />
                          );
                        })}
                        {tbodyPadBottom > 0 ? (
                          <tr>
                            <td
                              colSpan={STICKY_COL_COUNT + dayColCount}
                              style={{ height: tbodyPadBottom, padding: 0, border: 0 }}
                            />
                          </tr>
                        ) : null}
                      </>
                    ) : (
                      filteredIds.map((rowId, idx) => {
                        const rep = repById.get(rowId);
                        if (!rep) return null;
                        return (
                          <TimeInOutEmployeeRow
                            key={rowId}
                            rowId={rowId}
                            empBlockIdx={idx}
                            rep={rep}
                            dayCells={dayCellsById.get(rowId) ?? []}
                            loading={loading}
                            user={user}
                            userRole={userRole}
                            userDepartments={userDepartments}
                            openDayCellEditor={openDayCellEditor}
                            tlPage={tlPage}
                          />
                        );
                      })
                    )}
                  </tbody>
                </table>
                </div>
                {filteredIds.length === 0 && !loading ? (
                  <p className="py-6 text-center text-sm text-slate-500">
                    {tlPage(
                      "monthlyTimesheetNoRowsAfterFilter",
                      "Không có nhân viên phù hợp bộ lọc.",
                    )}
                  </p>
                ) : null}
              </div>
            )}
            {loadingMore ? (
              <p className="mt-1 text-center text-[10px] font-medium text-slate-500">
                {tlPage("monthlyTimesheetLoadingMore", "Đang tải thêm ngày…")}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <AttendanceEmployeeFormModal
        open={dayCellFormOpen}
        onClose={() => setDayCellFormOpen(false)}
        initialRecord={dayCellFormInitial}
        selectedDate={dayCellFormDate}
        employees={dayCellFormEmployees.length ? dayCellFormEmployees : employees}
        user={user}
        userRole={userRole}
        userDepartments={userDepartments}
        onAlert={onAlert}
        onSaved={() => {
          setDayCellFormOpen(false);
          void loadMonth();
        }}
        dayIsCompensatory={
          chunkByDate.get(dayCellFormDate)?.isCompensatoryDay ?? false
        }
      />
    </>,
    document.body,
  );
}
