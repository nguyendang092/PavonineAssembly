import React, {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { buildPayrollMonthDayCellFormRecord } from "@/features/payroll/buildPayrollDayFromRaw";
import {
  enrichPayrollMonthRepByIdWithMasterEmployees,
  formatPayrollMonthWeekday3,
  resolvePayrollMonthDayEmployee,
} from "@/features/payroll/payrollMonthlyGridData";
import {
  buildPayrollMonthTimesheetFlagsById,
  filterPayrollMonthTimesheetRowIds,
  needsPayrollMonthTimesheetPresenceFlags,
  PAYROLL_TIMESHEET_PRESENCE_FILTER,
  PAYROLL_SHORT_HOURS_FILTER,
} from "@/features/payroll/payrollMonthTimesheetFilters";
import {
  formatCoeffHoursForDisplay,
  formatPayrollMonthlyCoeffSubrowDayCell,
  getPayrollMonthlyCoeffHoursMap,
  getPayrollMonthlyMainRowCell,
  PAYROLL_MONTHLY_SUBROWS,
} from "@/features/payroll/payrollMonthlyCoefficientBuckets";
import { pickPayrollEmployeeJoinDate } from "@/features/payroll/payrollEmployeeFields";
import { payrollOtDayParamsFromMonthChunkEmp } from "@/features/payroll/payrollOtDayParams";
import { writePayrollMonthlyTimesheetWorkbook } from "@/features/payroll/payrollMonthlyTimesheetExcelGrid";
import {
  buildMonthlyDetailMatrixForEmployee,
  fmtPayrollMonthlySummaryHoursCell,
  isPayrollMonthDayCellBeforeJoinWithoutAttendance,
} from "@/features/payroll/payrollMonthlyRuleSummary";
import {
  buildPayrollMonthlyTimesheetDetailHeadersByGroup,
  DETAIL_GROUP_KEYS,
  MONTH_DETAIL_COLS_PER_BLOCK,
  MONTH_DETAIL_OT_COL_COUNT,
  MONTH_DETAIL_PHASE_COLS_PER_BLOCK,
  MONTH_DETAIL_PHASE_WORKDAY_COL_COUNT,
  MONTH_DETAIL_SATS_COL_COUNT,
  MONTH_DETAIL_TOTAL_COLS_PER_BLOCK,
  MONTH_DETAIL_WORKDAY_COL_COUNT,
  PAYROLL_MONTHLY_DETAIL_COL_WIDTH_PX,
  payrollMonthlyTimesheetTotalColCount,
  resolveMonthlyDetailGroupAndCol,
} from "@/features/payroll/payrollMonthlyTimesheetLayout";
import {
  payrollMonthlyTimesheetDayBodyBgClass,
  payrollMonthlyTimesheetDayHeaderBgClass,
  payrollMonthlyTimesheetDetailGroupBodyClass,
  payrollMonthlyTimesheetDetailGroupHeaderClass,
} from "@/features/payroll/payrollMonthlyTimesheetGridStyle";
import {
  enumerateDateKeysInclusive,
  getFirstDayOfMonthKey,
  getLastDayOfMonthKey,
  parseLocalDateKey,
} from "@/utils/dateKey";
import { payrollMonthMainRowDashMark } from "@/features/attendance/attendanceDayMeta";
import {
  getAttendanceLeaveTypeCompactBadgeClassName,
  getAttendanceLeaveTypeEmphasisBadgeClassName,
  getAttendanceLeaveTypeEmphasisCellClassName,
} from "@/features/attendance/attendanceGioVaoTypeOptions";
import AttendanceEmployeeFormModal from "@/features/attendance/AttendanceEmployeeFormModal";
import AttendanceOffHolidayDaysControl from "@/features/attendance/AttendanceOffHolidayDaysControl";
import { canEditPayrollMonthTimesheetGridCell } from "@/config/featurePermissions";
import PayrollMonthGridLoadingOverlay from "@/features/payroll/PayrollMonthGridLoadingOverlay";
import {
  buildPayrollMonthGridOverlayCopy,
  usePayrollMonthModalScrollLock,
} from "@/features/payroll/payrollMonthModalUi";
import { isKoreanAttendanceRoot } from "@/features/attendance/attendanceSeasonalStt";
import { usePayrollMonthDayChunks } from "@/features/payroll/usePayrollMonthDayChunks";
import { usePayrollMonthEmployeeIndex } from "@/features/payroll/usePayrollMonthEmployeeIndex";
import { usePayrollMonthSummaries } from "@/features/payroll/usePayrollMonthSummaries";
import { computePayrollMonthSummariesForIds } from "@/features/payroll/payrollMonthSummaryCompute";
import PayrollDepartmentMultiSelect from "@/features/payroll/PayrollDepartmentMultiSelect";
import PayrollMonthNavigator from "@/features/payroll/PayrollMonthNavigator";
import PayrollRangeExcelExportModal from "@/features/payroll/PayrollRangeExcelExportModal";
import PayrollTimesheetPresenceFiltersMenu from "@/features/payroll/PayrollTimesheetPresenceFiltersMenu";
import { payrollExportDepartmentFilenameSuffix } from "@/features/payroll/payrollExportDepartmentFilter";
import "./payrollMonthlyTimesheetModal.css";

/** Cột cố định trái: STT, Họ tên, MNV, BP, Hệ số TC [px]. */
const STICKY_COL_WIDTHS = [36, 200, 72, 80, 64];
const MONTH_DAY_COL_WIDTH = 42;

/** Chiều cao scroll mỗi khối NV (N dòng × ô ngày) — khớp `.pm-ts-data-cell`. */
function payrollMonthlyEmpBlockScrollHeight(zoom = 1) {
  return PAYROLL_MONTHLY_SUBROWS.length * MONTH_DAY_COL_WIDTH * zoom;
}
/** Dưới ngưỡng này render đủ dòng; từ ngưỡng trở lên ảo hóa theo khối NV để tránh OOM. */
const MONTHLY_TIMESHEET_VIRTUAL_THRESHOLD = 8;
const MONTHLY_TIMESHEET_VIRTUAL_OVERSCAN = 2;
const MONTH_HEADER_ROW_TOPS_DEFAULT = {
  row1: 0,
  row2: 28,
  row3: 76,
};

/** Thu/phóng lưới: `zoom` trên khối bảng (ảnh hưởng cả sticky header / ảo hóa). */
const TIMESHEET_ZOOM_LEVELS = [0.78, 0.85, 1, 1.15, 1.35];
const TIMESHEET_ZOOM_STORAGE_KEY = "payrollMonthlyTimesheetZoomIdx";
const TIMESHEET_ZOOM_DEFAULT_IDX = TIMESHEET_ZOOM_LEVELS.indexOf(1);

function timesheetZoomCssSupported() {
  return (
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("zoom", "1")
  );
}

const TIMESHEET_ZOOM_CSS_OK = timesheetZoomCssSupported();

function readStoredTimesheetZoomIdx() {
  if (!TIMESHEET_ZOOM_CSS_OK) return TIMESHEET_ZOOM_DEFAULT_IDX;
  if (typeof window === "undefined") return TIMESHEET_ZOOM_DEFAULT_IDX;
  try {
    const raw = window.localStorage.getItem(TIMESHEET_ZOOM_STORAGE_KEY);
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n >= 0 && n < TIMESHEET_ZOOM_LEVELS.length) {
      return n;
    }
  } catch {
    /* ignore */
  }
  return TIMESHEET_ZOOM_DEFAULT_IDX;
}

/** Ô ngày trên lưới tháng — bấm mở form điểm danh (khi có quyền). */
const MONTH_DAY_CELL_INTERACTIVE =
  "cursor-pointer hover:bg-indigo-100/75 dark:hover:bg-indigo-950/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500";

const STICKY_TH_BASE_CLASS =
  "relative border border-r-0 !border-solid border-[1px] border-slate-400 !bg-slate-100 bg-clip-padding px-1.5 py-1.5 text-left font-bold text-slate-900 dark:border-slate-500 dark:!bg-slate-800 dark:text-slate-100";
const STICKY_TD_BASE_CLASS =
  "relative border border-r-0 !border-solid border-[1px] border-slate-300 !bg-white bg-clip-padding px-1.5 py-1 align-middle font-medium text-slate-900 dark:border-slate-700 dark:!bg-slate-900 dark:text-slate-100";
const STRONG_BORDER_CLASS = "!border-2 !border-black !border-solid";
const STRONG_BORDER_BOTTOM_CLASS = "!border-b-2 !border-b-black !border-solid";
const STRONG_BORDER_LEFT_CLASS = "!border-l-2 !border-l-black !border-solid";
const THIN_HEAD_BORDER_CLASS =
  "border !border-solid border-[1px] border-slate-400 dark:border-slate-600";
const THIN_BODY_BORDER_CLASS =
  "border !border-solid border-[1px] border-slate-300 dark:border-slate-700";
const NO_TOP_BORDER_CLASS = "!border-t-0";

/** Dòng chính ô ngày (loại phép / giờ công / gạch): một cỡ chữ, tránh lệch giữa các mã phép. */
const MONTH_DAY_MAIN_CELL_CLASS =
  "pm-ts-day-cell pm-ts-data-cell text-center align-middle leading-none text-slate-900 dark:text-slate-100";

const MONTH_DAY_MAIN_VALUE_CLASS =
  "pm-ts-day-value tabular-nums text-black dark:text-black";

const MONTH_DAY_LEAVE_BADGE_BASE_CLASS = "pm-ts-leave-badge";

/** Ô ngày: class + props a11y khi được phép mở form điểm danh. */
function payrollMonthTimesheetDayCellA11y({
  canOpen,
  dateKey,
  rowId,
  openDayCellEditor,
  tlPage,
}) {
  if (!canOpen) return { className: "", props: {} };
  const activate = () => openDayCellEditor(dateKey, rowId);
  return {
    className: MONTH_DAY_CELL_INTERACTIVE,
    props: {
      role: "button",
      tabIndex: 0,
      title: tlPage(
        "monthlyTimesheetDayCellEditHint",
        "Bấm để sửa điểm danh ngày này.",
      ),
      onClick: (e) => {
        e.preventDefault();
        activate();
      },
      onKeyDown: (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate();
        }
      },
    },
  };
}

function stickyColStyle(colIndex) {
  let left = 0;
  for (let i = 0; i < colIndex; i++) left += STICKY_COL_WIDTHS[i];
  const isLastStickyCol = colIndex === STICKY_COL_WIDTHS.length - 1;
  return {
    position: "sticky",
    left,
    zIndex: 120 - colIndex,
    width: STICKY_COL_WIDTHS[colIndex],
    minWidth: STICKY_COL_WIDTHS[colIndex],
    maxWidth: STICKY_COL_WIDTHS[colIndex],
    boxSizing: "border-box",
    backgroundClip: "padding-box",
    transform: "translateZ(0)",
    borderRight: isLastStickyCol ? "2px solid #000" : "1px dashed #94a3b8",
  };
}

function stickyColClass(colIndex) {
  return colIndex === STICKY_COL_WIDTHS.length - 1 ? "pm-ts-sticky-edge" : "";
}

function monthDayCellStyle() {
  return {
    width: MONTH_DAY_COL_WIDTH,
    minWidth: MONTH_DAY_COL_WIDTH,
    maxWidth: MONTH_DAY_COL_WIDTH,
    boxSizing: "border-box",
  };
}

function monthDetailCellStyle() {
  return {
    width: PAYROLL_MONTHLY_DETAIL_COL_WIDTH_PX,
    minWidth: PAYROLL_MONTHLY_DETAIL_COL_WIDTH_PX,
    maxWidth: PAYROLL_MONTHLY_DETAIL_COL_WIDTH_PX,
    boxSizing: "border-box",
  };
}

function monthHeaderStickyStyle(top, zIndex) {
  return {
    position: "sticky",
    top,
    zIndex,
    backgroundClip: "padding-box",
    isolation: "isolate",
  };
}

function buildPayrollMonthEmployeeDayCells({ monthDayMeta, rep, rowId }) {
  return monthDayMeta.map(({ dateKey, chunk, bodyBg }) => {
    if (!chunk) {
      return {
        dateKey,
        chunk,
        baseBg: bodyBg,
        beforeJoin: false,
        emp: null,
        main: null,
        coeffMap: null,
      };
    }
    const emp = resolvePayrollMonthDayEmployee(chunk, rowId, rep);
    const joinDate =
      pickPayrollEmployeeJoinDate(rep) || pickPayrollEmployeeJoinDate(emp);
    const beforeJoin = isPayrollMonthDayCellBeforeJoinWithoutAttendance(
      dateKey,
      joinDate,
      emp,
    );
    if (beforeJoin) {
      return {
        dateKey,
        chunk,
        baseBg: bodyBg,
        beforeJoin,
        emp: null,
        main: null,
        coeffMap: null,
      };
    }
    const main = emp ? getPayrollMonthlyMainRowCell(emp, chunk) : null;
    const coeffMap = emp
      ? getPayrollMonthlyCoeffHoursMap(
          payrollOtDayParamsFromMonthChunkEmp(emp, chunk),
        )
      : null;
    return {
      dateKey,
      chunk,
      baseBg: bodyBg,
      beforeJoin,
      emp,
      main,
      coeffMap,
    };
  });
}

function payrollMonthlyEmployeeBlockPropsEqual(prev, next) {
  return (
    prev.rowId === next.rowId &&
    prev.empBlockIdx === next.empBlockIdx &&
    prev.rowDays === next.rowDays &&
    prev.rep === next.rep &&
    prev.summaries === next.summaries &&
    prev.loading === next.loading &&
    prev.user === next.user &&
    prev.userRole === next.userRole &&
    prev.userDepartments === next.userDepartments &&
    prev.openDayCellEditor === next.openDayCellEditor &&
    prev.tlPage === next.tlPage &&
    prev.fmtHours === next.fmtHours
  );
}

const PayrollMonthlyTimesheetDayCell = memo(
  function PayrollMonthlyTimesheetDayCell({
    dayCell,
    rowId,
    rep,
    sr,
    loading,
    user,
    userRole,
    userDepartments,
    isLastSub,
    subrowEdgeClass,
    blockStartClass,
    openDayCellEditor,
    tlPage,
  }) {
    const cellStyle = {
      ...monthDayCellStyle(),
      ...(isLastSub ? { borderBottom: "2px solid #000" } : null),
    };

    if (dayCell.beforeJoin) {
      return (
        <td
          style={cellStyle}
          className={`${THIN_BODY_BORDER_CLASS} pm-ts-day-cell pm-ts-data-cell text-center text-slate-300 ${dayCell.baseBg} ${subrowEdgeClass} ${blockStartClass}`}
        >
          {" "}
        </td>
      );
    }

    if (!dayCell.chunk) {
      return (
        <td
          style={cellStyle}
          className={`${THIN_BODY_BORDER_CLASS} pm-ts-day-cell pm-ts-data-cell text-center text-slate-400 ${dayCell.baseBg} ${subrowEdgeClass} ${blockStartClass}`}
        >
          {" "}
        </td>
      );
    }

    const canOpenThisDayCell = canEditPayrollMonthTimesheetGridCell({
      loading,
      user,
      rep,
      rowDayEmp: dayCell.emp,
      userRole,
      userDepartments,
    });
    const { className: dayCellInteractCls, props: dayCellInteract } =
      payrollMonthTimesheetDayCellA11y({
        canOpen: canOpenThisDayCell,
        dateKey: dayCell.dateKey,
        rowId,
        openDayCellEditor,
        tlPage,
      });

    if (!dayCell.emp) {
      const dayCode =
        sr.coeff == null
          ? payrollMonthMainRowDashMark(dayCell.chunk, null)
          : " ";
      return (
        <td
          style={cellStyle}
          className={`${THIN_BODY_BORDER_CLASS} pm-ts-day-cell pm-ts-data-cell text-center align-middle font-bold text-slate-900 dark:text-slate-100 ${dayCell.baseBg} ${subrowEdgeClass} ${blockStartClass} ${dayCellInteractCls}`}
          {...dayCellInteract}
        >
          {dayCode}
        </td>
      );
    }

    if (sr.coeff == null) {
      const main = dayCell.main;
      let inner;
      const isLeaveCell = main.kind === "leave";
      if (isLeaveCell) {
        inner = (
          <div className="pm-ts-leave-wrap">
            <span
              className={`${MONTH_DAY_LEAVE_BADGE_BASE_CLASS} ${getAttendanceLeaveTypeEmphasisBadgeClassName(main.leaveRaw)} ${getAttendanceLeaveTypeCompactBadgeClassName(main.leaveShort)}`}
              title={main.leaveRaw}
            >
              {main.leaveShort}
            </span>
          </div>
        );
      } else if (main.kind === "hours") {
        inner = (
          <div className="pm-ts-day-value-wrap">
            <span className={MONTH_DAY_MAIN_VALUE_CLASS}>
              {formatCoeffHoursForDisplay(main.hours)}
            </span>
          </div>
        );
      } else {
        const dayMark = payrollMonthMainRowDashMark(dayCell.chunk, dayCell.emp);
        inner = (
          <div className="pm-ts-day-value-wrap">
            <span
              className={
                dayMark !== " " ? MONTH_DAY_MAIN_VALUE_CLASS : "pm-ts-day-empty"
              }
            >
              {dayMark}
            </span>
          </div>
        );
      }
      return (
        <td
          style={cellStyle}
          className={`${THIN_BODY_BORDER_CLASS} ${
            isLeaveCell ? "pm-ts-leave-cell" : ""
          } ${MONTH_DAY_MAIN_CELL_CLASS} ${
            isLeaveCell
              ? getAttendanceLeaveTypeEmphasisCellClassName(main.leaveRaw)
              : dayCell.baseBg
          } ${subrowEdgeClass} ${blockStartClass} ${dayCellInteractCls}`}
          {...dayCellInteract}
        >
          {inner}
        </td>
      );
    }

    const coeffTxt = formatPayrollMonthlyCoeffSubrowDayCell({
      emp: dayCell.emp,
      ch: dayCell.chunk,
      sr,
      coeffMap: dayCell.coeffMap,
      main: dayCell.main,
    });
    const show = coeffTxt != null && String(coeffTxt).trim() !== "";
    return (
      <td
        style={cellStyle}
        className={`${THIN_BODY_BORDER_CLASS} pm-ts-day-cell pm-ts-data-cell text-center align-middle ${dayCell.baseBg} ${subrowEdgeClass} ${blockStartClass} ${dayCellInteractCls}`}
        {...dayCellInteract}
      >
        {show ? (
          <div className="pm-ts-day-value-wrap">
            <span className="pm-ts-coeff-value">{coeffTxt}</span>
          </div>
        ) : (
          <div className="pm-ts-day-value-wrap">
            <span className="pm-ts-day-empty"> </span>
          </div>
        )}
      </td>
    );
  },
);

const PayrollMonthlyTimesheetDetailCells = memo(
  function PayrollMonthlyTimesheetDetailCells({
    rowId,
    sr,
    detailValues,
    isLastSub,
    subrowEdgeClass,
    blockStartClass,
  }) {
    return detailValues.map((v, idx) => {
      const { groupIndex: group, colInBlock } =
        resolveMonthlyDetailGroupAndCol(idx);
      const groupBg = payrollMonthlyTimesheetDetailGroupBodyClass(group);
      return (
        <td
          key={`detail-${rowId}-${sr.key}-${idx}`}
          style={{
            ...monthDetailCellStyle(idx),
            ...(isLastSub ? { borderBottom: "2px solid #000" } : null),
          }}
          className={`${THIN_BODY_BORDER_CLASS} ${groupBg} ${subrowEdgeClass} ${
            colInBlock === 0 ? STRONG_BORDER_LEFT_CLASS : ""
          } ${blockStartClass} pm-ts-data-cell pm-ts-detail-cell text-center font-bold text-slate-900 dark:text-slate-100`}
        >
          {v}
        </td>
      );
    });
  },
);

const PayrollMonthlyTimesheetEmployeeBlock = memo(
  function PayrollMonthlyTimesheetEmployeeBlock({
    rowId,
    empBlockIdx,
    rep,
    rowDays,
    summaries,
    loading,
    user,
    userRole,
    userDepartments,
    openDayCellEditor,
    tlPage,
    fmtHours = null,
  }) {
    const sttDisp = empBlockIdx + 1;
    const employeeStripe =
      empBlockIdx % 2 === 0
        ? "bg-white dark:bg-slate-900"
        : "bg-slate-50 dark:bg-slate-900/80";

    const detailValuesBySubrow = useMemo(
      () =>
        buildMonthlyDetailMatrixForEmployee(summaries, {
          fmtHours,
        }),
      [summaries, fmtHours],
    );

    return (
      <>
        {PAYROLL_MONTHLY_SUBROWS.map((sr, si) => {
          const isLastSub = si === PAYROLL_MONTHLY_SUBROWS.length - 1;
          const isFirstSub = si === 0;
          const subrowEdgeClass = isLastSub ? STRONG_BORDER_BOTTOM_CLASS : "";
          const blockStartClass =
            isFirstSub && empBlockIdx > 0 ? "!border-t-0" : "";
          return (
            <tr
              key={`${rowId}-${sr.key}`}
              className={`pm-ts-row ${si === 0 ? "pm-ts-row--main" : "pm-ts-row--coeff"} ${employeeStripe} hover:bg-slate-50/70 dark:hover:bg-slate-800/35`}
            >
              {si === 0 ? (
                <td
                  rowSpan={PAYROLL_MONTHLY_SUBROWS.length}
                  style={stickyColStyle(0)}
                  className={`${STICKY_TD_BASE_CLASS} ${stickyColClass(0)} text-center font-semibold tabular-nums ${STRONG_BORDER_BOTTOM_CLASS}`}
                >
                  {sttDisp}
                </td>
              ) : null}
              {si === 0 ? (
                <td
                  rowSpan={PAYROLL_MONTHLY_SUBROWS.length}
                  style={stickyColStyle(1)}
                  className={`${STICKY_TD_BASE_CLASS} ${stickyColClass(1)} pm-ts-name-col text-center align-middle leading-tight ${STRONG_BORDER_BOTTOM_CLASS}`}
                  title={rep?.hoVaTen ?? ""}
                >
                  <div className="pm-ts-name-cell">{rep?.hoVaTen ?? "—"}</div>
                </td>
              ) : null}
              <td
                style={{
                  ...stickyColStyle(2),
                  ...(isLastSub ? { borderBottom: "2px solid #000" } : null),
                }}
                className={`${STICKY_TD_BASE_CLASS} ${stickyColClass(2)} pm-ts-sticky-data-cell pm-ts-data-cell pm-ts-mnv-cell text-center ${subrowEdgeClass} ${blockStartClass}`}
                title={rep?.mnv ?? ""}
              >
                {rep?.mnv ? rep.mnv : "—"}
              </td>
              <td
                style={{
                  ...stickyColStyle(3),
                  ...(isLastSub ? { borderBottom: "2px solid #000" } : null),
                }}
                className={`${STICKY_TD_BASE_CLASS} ${stickyColClass(3)} pm-ts-sticky-data-cell pm-ts-data-cell pm-ts-bp-cell text-center ${subrowEdgeClass} ${blockStartClass}`}
                title={rep?.boPhan ?? ""}
              >
                {rep?.boPhan ? rep.boPhan : "—"}
              </td>
              <td
                style={{
                  ...stickyColStyle(4),
                  ...(isLastSub ? { borderBottom: "2px solid #000" } : null),
                }}
                className={`${STICKY_TD_BASE_CLASS} ${stickyColClass(4)} pm-ts-sticky-data-cell pm-ts-data-cell pm-ts-coeff-col-cell text-center ${subrowEdgeClass} ${blockStartClass}`}
              >
                {sr.coeff == null ? "\u00a0" : Number(sr.coeff).toFixed(1)}
              </td>
              {rowDays.map((dayCell) => (
                <PayrollMonthlyTimesheetDayCell
                  key={dayCell.dateKey}
                  dayCell={dayCell}
                  rowId={rowId}
                  rep={rep}
                  sr={sr}
                  loading={loading}
                  user={user}
                  userRole={userRole}
                  userDepartments={userDepartments}
                  isLastSub={isLastSub}
                  subrowEdgeClass={subrowEdgeClass}
                  blockStartClass={blockStartClass}
                  openDayCellEditor={openDayCellEditor}
                  tlPage={tlPage}
                />
              ))}
              <PayrollMonthlyTimesheetDetailCells
                rowId={rowId}
                sr={sr}
                detailValues={detailValuesBySubrow[si]}
                isLastSub={isLastSub}
                subrowEdgeClass={subrowEdgeClass}
                blockStartClass={blockStartClass}
              />
            </tr>
          );
        })}
      </>
    );
  },
  payrollMonthlyEmployeeBlockPropsEqual,
);

/**
 * Modal: lưới theo dõi cả tháng — dữ liệu mỗi ngày qua `buildPayrollMonthDayChunkFromRaw`
 * (cùng pipeline bảng lương: merge + `payrollEarlyOtPaperwork` trên dòng).
 */
export default function PayrollMonthlyTimesheetModal({
  open,
  onClose,
  anchorDateKey,
  displayLocale = "vi-VN",
  tlPage,
  searchTerm = "",
  departmentFilter = "",
  /** Danh sách BP trên trang lương (`PayrollSalaryCalculator`) — đồng bộ ô «Tất cả bộ phận». */
  payrollDepartmentOptions,
  /** Gọi khi đổi BP trong modal — giữ một state với `departmentFilter` trên trang lương. */
  onDepartmentFilterChange,
  workHoursFilter: workHoursFilterProp,
  leaveTypeFilter: leaveTypeFilterProp,
  overtimeFilter: overtimeFilterProp,
  shortHoursFilter: shortHoursFilterProp,
  onWorkHoursFilterChange,
  onLeaveTypeFilterChange,
  onOvertimeFilterChange,
  onShortHoursFilterChange,
  normalizeDepartment = (v) =>
    String(v || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase(),
  /** Mở form điểm danh khi bấm ô ngày — cùng quyền với bảng lương. */
  user = null,
  userRole = null,
  userDepartments = null,
  onAlert,
  /** Danh sách NV ngày đang chọn trên trang lương (fallback khi mở form). */
  employees = [],
  /** Firebase root — `attendance` (mặc định) hoặc `koreanAttendance`. */
  attendanceRootPath = "attendance",
}) {
  const [localNameFilter, setLocalNameFilter] = useState("");
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [internalWorkHoursFilter, setInternalWorkHoursFilter] = useState(
    PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
  );
  const [internalLeaveTypeFilter, setInternalLeaveTypeFilter] = useState(
    PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
  );
  const [internalOvertimeFilter, setInternalOvertimeFilter] = useState(
    PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL,
  );
  const [internalShortHoursFilter, setInternalShortHoursFilter] = useState(
    PAYROLL_SHORT_HOURS_FILTER.ALL,
  );
  const workHoursFilter =
    workHoursFilterProp ?? internalWorkHoursFilter;
  const leaveTypeFilter =
    leaveTypeFilterProp ?? internalLeaveTypeFilter;
  const overtimeFilter =
    overtimeFilterProp ?? internalOvertimeFilter;
  const shortHoursFilter =
    shortHoursFilterProp ?? internalShortHoursFilter;
  const setWorkHoursFilter =
    onWorkHoursFilterChange ?? setInternalWorkHoursFilter;
  const setLeaveTypeFilter =
    onLeaveTypeFilterChange ?? setInternalLeaveTypeFilter;
  const setOvertimeFilter =
    onOvertimeFilterChange ?? setInternalOvertimeFilter;
  const setShortHoursFilter =
    onShortHoursFilterChange ?? setInternalShortHoursFilter;
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [headerRowTops, setHeaderRowTops] = useState(
    MONTH_HEADER_ROW_TOPS_DEFAULT,
  );
  const [timesheetZoomIdx, setTimesheetZoomIdx] = useState(
    readStoredTimesheetZoomIdx,
  );
  const tableWrapRef = useRef(null);
  const tableBodyScrollRef = useRef(null);
  const [dayCellFormOpen, setDayCellFormOpen] = useState(false);
  const [dayCellFormDate, setDayCellFormDate] = useState("");
  const [dayCellFormInitial, setDayCellFormInitial] = useState(null);
  const [dayCellFormEmployees, setDayCellFormEmployees] = useState([]);
  const [viewMonthFirstKey, setViewMonthFirstKey] = useState(() =>
    getFirstDayOfMonthKey(anchorDateKey),
  );

  const monthRange = useMemo(() => {
    const first = getFirstDayOfMonthKey(viewMonthFirstKey);
    const last = getLastDayOfMonthKey(viewMonthFirstKey);
    const keys = enumerateDateKeysInclusive(first, last);
    return { first, last, keys };
  }, [viewMonthFirstKey]);

  const monthTitle = useMemo(() => {
    const d = parseLocalDateKey(monthRange.first);
    if (!d) return viewMonthFirstKey;
    return d.toLocaleDateString(displayLocale, {
      month: "long",
      year: "numeric",
    });
  }, [monthRange.first, viewMonthFirstKey, displayLocale]);

  useEffect(() => {
    if (!open) return;
    setViewMonthFirstKey(getFirstDayOfMonthKey(anchorDateKey));
  }, [open, anchorDateKey]);

  useEffect(() => {
    if (!open) return;
    setDayCellFormOpen(false);
    setDayCellFormDate("");
    setDayCellFormInitial(null);
    setDayCellFormEmployees([]);
  }, [open, viewMonthFirstKey]);

  useEffect(() => {
    if (!open) return;
    const initial = String(departmentFilter ?? "").trim();
    setSelectedDepartments(initial ? [initial] : []);
    if (workHoursFilterProp === undefined) {
      setInternalWorkHoursFilter(PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL);
      setInternalLeaveTypeFilter(PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL);
      setInternalOvertimeFilter(PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL);
      setInternalShortHoursFilter(PAYROLL_SHORT_HOURS_FILTER.ALL);
    }
  }, [open, departmentFilter, workHoursFilterProp]);

  const isKoreanTimesheetSource = isKoreanAttendanceRoot(attendanceRootPath);
  const monthlyDetailFmtHours = isKoreanTimesheetSource
    ? fmtPayrollMonthlySummaryHoursCell
    : null;
  const timesheetTitleKey = isKoreanTimesheetSource
    ? "koreanMonthlyTimesheetTitle"
    : "monthlyTimesheetTitle";
  const timesheetTitleDefault = isKoreanTimesheetSource
    ? "KOREAN TIMESHEET - Bảng chấm công tháng"
    : "Bảng chấm công tháng";

  const timesheetZoom = TIMESHEET_ZOOM_LEVELS[timesheetZoomIdx];

  const bumpTimesheetZoom = useCallback((delta) => {
    setTimesheetZoomIdx((i) => {
      const n = Math.max(
        0,
        Math.min(TIMESHEET_ZOOM_LEVELS.length - 1, i + delta),
      );
      try {
        window.localStorage.setItem(TIMESHEET_ZOOM_STORAGE_KEY, String(n));
      } catch {
        /* ignore */
      }
      return n;
    });
  }, []);

  const resetTimesheetZoom = useCallback(() => {
    setTimesheetZoomIdx(TIMESHEET_ZOOM_DEFAULT_IDX);
    try {
      window.localStorage.setItem(
        TIMESHEET_ZOOM_STORAGE_KEY,
        String(TIMESHEET_ZOOM_DEFAULT_IDX),
      );
    } catch {
      /* ignore */
    }
  }, []);

  const {
    dayChunks,
    displayDayChunks,
    loading,
    loadingMore,
    isGridBusy,
    isDisplayStale,
    error,
    setError,
    loadMonth,
  } = usePayrollMonthDayChunks({
    monthKeys: monthRange.keys,
    attendanceRootPath,
    tlPage,
    emptyMessageKey: isKoreanTimesheetSource
      ? "koreanMonthlyTimesheetEmpty"
      : "monthlyTimesheetEmpty",
    emptyMessageDefault: isKoreanTimesheetSource
      ? "Không có dữ liệu điểm danh Korean Timesheet trong tháng này."
      : "Không có dữ liệu điểm danh nào trong tháng này.",
  });

  useEffect(() => {
    if (!open) return;
    void loadMonth();
  }, [open, loadMonth]);

  usePayrollMonthModalScrollLock(open);

  useEffect(() => {
    if (open) return;
    setDayCellFormOpen(false);
    setDayCellFormDate("");
    setDayCellFormInitial(null);
    setDayCellFormEmployees([]);
  }, [open]);

  const { sortedIds, repById, chunkByDate } =
    usePayrollMonthEmployeeIndex(displayDayChunks);

  const summaryRepById = useMemo(
    () => enrichPayrollMonthRepByIdWithMasterEmployees(repById, employees),
    [repById, employees],
  );

  const anchorDayMeta = useMemo(() => {
    const ch = chunkByDate.get(monthRange.first);
    return {
      isOffDay: Boolean(ch?.isOffDay),
      isHolidayDay: Boolean(ch?.isHolidayDay),
      isCompensatoryDay: Boolean(ch?.isCompensatoryDay),
    };
  }, [monthRange.first, chunkByDate]);

  const tlAttendance = useCallback(
    (key, defaultValue, options = {}) =>
      tlPage(key, defaultValue, options),
    [tlPage],
  );

  const handleOffHolidayDaysSaved = useCallback(() => {
    void loadMonth();
  }, [loadMonth]);

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
      const dayEmp = resolvePayrollMonthDayEmployee(ch, rowId, rep);
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
    const set = new Set();
    if (Array.isArray(payrollDepartmentOptions)) {
      for (const raw of payrollDepartmentOptions) {
        const d = String(raw ?? "").trim();
        if (d) set.add(d);
      }
    }
    sortedIds.forEach((id) => {
      const rep = repById.get(id);
      const d = String(rep?.boPhan ?? "").trim();
      if (d) set.add(d);
      for (const dept of rep?.boPhanAll ?? []) {
        const t = String(dept ?? "").trim();
        if (t) set.add(t);
      }
    });
    return [...set].sort((a, b) => a.localeCompare(b, "vi"));
  }, [sortedIds, repById, payrollDepartmentOptions]);

  const effectiveSearchTerm = localNameFilter || searchTerm || "";

  const needsPresenceFlags = needsPayrollMonthTimesheetPresenceFlags({
    workHoursFilter,
    leaveTypeFilter,
    overtimeFilter,
    shortHoursFilter,
  });

  const needsWorkHoursSummary =
    workHoursFilter !== PAYROLL_TIMESHEET_PRESENCE_FILTER.ALL;

  const presenceFlagsById = useMemo(() => {
    if (!needsPresenceFlags) return null;
    return buildPayrollMonthTimesheetFlagsById({
      monthKeys: monthRange.keys,
      chunkByDate,
      sortedIds,
      repById,
      resolveWorkHours: needsWorkHoursSummary,
    });
  }, [
    needsPresenceFlags,
    needsWorkHoursSummary,
    monthRange.keys,
    chunkByDate,
    sortedIds,
    repById,
  ]);

  const presenceFilterState = useMemo(
    () => ({
      workHoursFilter,
      leaveTypeFilter,
      overtimeFilter,
      shortHoursFilter,
    }),
    [workHoursFilter, leaveTypeFilter, overtimeFilter, shortHoursFilter],
  );

  const filteredIds = useMemo(
    () =>
      filterPayrollMonthTimesheetRowIds({
        sortedIds,
        repById,
        searchTerm: effectiveSearchTerm,
        departmentFilters: selectedDepartments,
        normalizeDepartment,
        needsPresenceFlags,
        presenceFlagsById,
        presenceFilters: presenceFilterState,
      }),
    [
      sortedIds,
      repById,
      effectiveSearchTerm,
      selectedDepartments,
      normalizeDepartment,
      needsPresenceFlags,
      presenceFlagsById,
      presenceFilterState,
    ],
  );

  const { monthlySummaryById, isSummariesBusy, summaryProgress, summaryCacheRef } =
    usePayrollMonthSummaries({
      enabled: open && !loading && !isDisplayStale,
      monthKeys: monthRange.keys,
      chunkByDate,
      filteredIds,
      repById: summaryRepById,
    });

  const isGridFullyBusy = isGridBusy || isSummariesBusy;

  const gridOverlayCopy = useMemo(
    () =>
      buildPayrollMonthGridOverlayCopy({
        tlPage,
        loadingMore,
        isDisplayStale,
        isSummariesBusy,
        summaryProgress,
      }),
    [tlPage, loadingMore, isDisplayStale, isSummariesBusy, summaryProgress],
  );

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
          isSunday: parsedDate?.getDay() === 0,
          chunk,
          headerBg: payrollMonthlyTimesheetDayHeaderBgClass(parsedDate, chunk),
          bodyBg: payrollMonthlyTimesheetDayBodyBgClass(parsedDate, chunk),
        };
      }),
    [monthRange.keys, chunkByDate],
  );

  const monthDayMetaFingerprint = useMemo(
    () =>
      monthDayMeta
        .map(
          (meta) =>
            `${meta.dateKey}:${meta.chunk?.employees?.length ?? 0}:${meta.bodyBg}`,
        )
        .join("|"),
    [monthDayMeta],
  );

  const dayCellsCacheRef = useRef({ fp: "", map: new Map() });

  const getEmployeeRowDays = useCallback(
    (rowId) => {
      const rep = repById.get(rowId);
      if (dayCellsCacheRef.current.fp !== monthDayMetaFingerprint) {
        dayCellsCacheRef.current = { fp: monthDayMetaFingerprint, map: new Map() };
      }
      let rowDays = dayCellsCacheRef.current.map.get(rowId);
      if (!rowDays) {
        rowDays = buildPayrollMonthEmployeeDayCells({
          monthDayMeta,
          rep,
          rowId,
        });
        dayCellsCacheRef.current.map.set(rowId, rowDays);
      }
      return rowDays;
    },
    [monthDayMeta, monthDayMetaFingerprint, repById],
  );

  const shouldVirtualizeTimesheetBody =
    filteredIds.length >= MONTHLY_TIMESHEET_VIRTUAL_THRESHOLD;

  const empBlockVirtualizer = useVirtualizer({
    count: shouldVirtualizeTimesheetBody ? filteredIds.length : 0,
    getScrollElement: () => tableBodyScrollRef.current,
    estimateSize: () =>
      payrollMonthlyEmpBlockScrollHeight(
        TIMESHEET_ZOOM_CSS_OK ? timesheetZoom : 1,
      ),
    measureElement: (el) => el?.getBoundingClientRect().height ?? 0,
    overscan: MONTHLY_TIMESHEET_VIRTUAL_OVERSCAN,
    getItemKey: (index) => filteredIds[index] ?? index,
  });

  useLayoutEffect(() => {
    if (!open || !shouldVirtualizeTimesheetBody || isGridFullyBusy) return;
    empBlockVirtualizer.measure();
  }, [
    open,
    shouldVirtualizeTimesheetBody,
    filteredIds.length,
    timesheetZoomIdx,
    monthRange.keys.length,
    isGridFullyBusy,
  ]);

  const timesheetTotalColCount = payrollMonthlyTimesheetTotalColCount(
    monthRange.keys.length,
  );

  const stickyColsTotalWidth = useMemo(
    () => STICKY_COL_WIDTHS.reduce((sum, w) => sum + w, 0),
    [],
  );
  const monthDaysWidth = monthRange.keys.length * MONTH_DAY_COL_WIDTH;
  const modalMonthViewportWidth = stickyColsTotalWidth + monthDaysWidth + 320;
  const tableViewportHeight = 184 + PAYROLL_MONTHLY_SUBROWS.length * 24 * 4;

  useEffect(() => {
    if (!open) return;
    const computeHeaderTops = () => {
      const root = tableWrapRef.current;
      if (!root) return;
      const rows = root.querySelectorAll("thead tr");
      if (!rows || rows.length < 3) return;
      const h1 = rows[0].getBoundingClientRect().height || 0;
      const h2 = rows[1].getBoundingClientRect().height || 0;
      const nextTops = {
        row1: 0,
        row2: Math.round(h1),
        row3: Math.round(h1 + h2),
      };
      setHeaderRowTops((prev) =>
        prev.row2 === nextTops.row2 && prev.row3 === nextTops.row3
          ? prev
          : nextTops,
      );
    };
    computeHeaderTops();
    const rafId = window.requestAnimationFrame(computeHeaderTops);
    window.addEventListener("resize", computeHeaderTops);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", computeHeaderTops);
    };
  }, [
    open,
    monthRange.keys.length,
    filteredIds.length,
    loading,
    loadingMore,
    timesheetZoomIdx,
  ]);

  const detailHeadersByGroup = useMemo(
    () => buildPayrollMonthlyTimesheetDetailHeadersByGroup(tlPage),
    [tlPage],
  );

  const buildExportIds = useCallback(
    (exportDepartments) =>
      filterPayrollMonthTimesheetRowIds({
        sortedIds,
        repById,
        searchTerm: effectiveSearchTerm,
        departmentFilters: exportDepartments,
        normalizeDepartment,
        needsPresenceFlags,
        presenceFlagsById,
        presenceFilters: presenceFilterState,
      }),
    [
      sortedIds,
      repById,
      effectiveSearchTerm,
      normalizeDepartment,
      needsPresenceFlags,
      presenceFlagsById,
      presenceFilterState,
    ],
  );

  const handleExportExcel = useCallback(
    async (exportDepartments) => {
      const exportIds = buildExportIds(exportDepartments);
      if (!exportIds.length) {
        setError(
          tlPage(
            "exportDepartmentFilteredEmpty",
            "Không có nhân viên thuộc bộ phận đã chọn trong khoảng đã chọn.",
          ),
        );
        return;
      }
      try {
        const missingSummaryIds = exportIds.filter(
          (id) => !monthlySummaryById.has(id),
        );
        let exportSummaryById = monthlySummaryById;
        if (missingSummaryIds.length > 0) {
          const extraSummaries = await computePayrollMonthSummariesForIds({
            monthKeys: monthRange.keys,
            chunkByDate,
            ids: missingSummaryIds,
            repById: summaryRepById,
            cache: summaryCacheRef.current,
          });
          if (extraSummaries?.size) {
            exportSummaryById = new Map(monthlySummaryById);
            for (const [id, summary] of extraSummaries) {
              exportSummaryById.set(id, summary);
            }
          }
        }

        const buf = await writePayrollMonthlyTimesheetWorkbook({
          tlPage,
          monthKeys: monthRange.keys,
          chunkByDate,
          filteredIds: exportIds,
          repById,
          summaryById: exportSummaryById,
          detailHeaders: detailHeadersByGroup,
          koreanTimesheetRules: isKoreanTimesheetSource,
        });
        const blob = new Blob([buf], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const d = new Date();
        const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(
          2,
          "0",
        )}${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(
          2,
          "0",
        )}${String(d.getMinutes()).padStart(2, "0")}`;
        a.href = url;
        const deptSuffix =
          payrollExportDepartmentFilenameSuffix(exportDepartments);
        a.download = `BangChamCongThang_${stamp}${deptSuffix}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        setExportModalOpen(false);
      } catch (e) {
        setError(
          tlPage(
            "monthlyTimesheetExportError",
            "Không xuất được Excel: {{error}}",
            {
              error: e?.message || String(e),
            },
          ),
        );
      }
    },
    [
      buildExportIds,
      chunkByDate,
      detailHeadersByGroup,
      monthlySummaryById,
      monthRange.keys,
      summaryRepById,
      summaryCacheRef,
      tlPage,
      isKoreanTimesheetSource,
    ],
  );

  const handleExportFromModal = useCallback(
    async (_from, _to, exportDepartments) => {
      setExportBusy(true);
      try {
        await handleExportExcel(exportDepartments);
      } finally {
        setExportBusy(false);
      }
    },
    [handleExportExcel],
  );

  const virtualEmpItems = shouldVirtualizeTimesheetBody
    ? empBlockVirtualizer.getVirtualItems()
    : [];
  const tbodyPadTop =
    shouldVirtualizeTimesheetBody && virtualEmpItems.length > 0
      ? virtualEmpItems[0].start
      : 0;
  const tbodyPadBottom =
    shouldVirtualizeTimesheetBody && virtualEmpItems.length > 0
      ? empBlockVirtualizer.getTotalSize() -
        virtualEmpItems[virtualEmpItems.length - 1].end
      : 0;

  if (!open) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 flex flex-col overflow-hidden overscroll-none bg-black/50 p-2 backdrop-blur-[1px] sm:p-4"
        style={{ zIndex: "var(--z-modal-backdrop, 1200)" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payroll-monthly-timesheet-title"
      >
        <div
          className="mx-auto flex w-full flex-col overflow-hidden rounded-xl border border-indigo-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900"
          style={{
            maxWidth: `min(calc(100vw - 1rem), ${modalMonthViewportWidth}px)`,
            maxHeight: "calc(100vh - 1rem)",
          }}
        >
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2 dark:border-slate-700">
            <div className="min-w-0">
              <h2
                id="payroll-monthly-timesheet-title"
                className="truncate text-sm font-extrabold uppercase tracking-wide text-white sm:text-base"
              >
                {tlPage(timesheetTitleKey, timesheetTitleDefault)}
                {` (${monthTitle})`}
              </h2>
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
                className="rounded-lg border-2 border-white/80 bg-white px-3 py-1 text-xs font-bold text-indigo-700 shadow-sm hover:bg-indigo-50"
              >
                {tlPage("monthlyTimesheetClose", "Đóng")}
              </button>
            </div>
          </div>

          <div className="min-h-0 flex flex-1 flex-col p-2 sm:p-3">
            <div className="pm-ts-toolbar mb-2 flex flex-wrap items-center justify-end gap-2 rounded-lg border border-indigo-200 bg-gradient-to-r from-indigo-50 via-white to-sky-50 px-2 py-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
              <div className="mr-auto flex shrink-0 flex-wrap items-center gap-2">
                <AttendanceOffHolidayDaysControl
                  user={user}
                  userRole={userRole}
                  selectedDate={monthRange.first}
                  setSelectedDate={() => {}}
                  isOffDay={anchorDayMeta.isOffDay}
                  isHolidayDay={anchorDayMeta.isHolidayDay}
                  isCompensatoryDay={anchorDayMeta.isCompensatoryDay}
                  tl={tlAttendance}
                  attendanceRootPath={attendanceRootPath}
                  showDateInput={false}
                  elevatedOverlay
                  onSaved={handleOffHolidayDaysSaved}
                  className="shrink-0"
                />
                <PayrollMonthNavigator
                  monthFirstKey={monthRange.first}
                  onMonthFirstKeyChange={setViewMonthFirstKey}
                  disabled={loading && !displayDayChunks.length}
                  tlPage={tlPage}
                />
              </div>
              <input
                type="text"
                value={localNameFilter}
                onChange={(e) => setLocalNameFilter(e.target.value)}
                placeholder={tlPage(
                  "monthlyTimesheetFilterNamePlaceholder",
                  "Lọc theo tên / MNV / bộ phận",
                )}
                className="w-[220px] rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <PayrollTimesheetPresenceFiltersMenu
                workHoursFilter={workHoursFilter}
                leaveTypeFilter={leaveTypeFilter}
                overtimeFilter={overtimeFilter}
                shortHoursFilter={shortHoursFilter}
                onWorkHoursFilterChange={setWorkHoursFilter}
                onLeaveTypeFilterChange={setLeaveTypeFilter}
                onOvertimeFilterChange={setOvertimeFilter}
                onShortHoursFilterChange={setShortHoursFilter}
                tl={tlPage}
                disabled={isGridFullyBusy}
              />
              <PayrollDepartmentMultiSelect
                options={departmentOptions}
                selected={selectedDepartments}
                onChange={setSelectedDepartments}
                disabled={isGridFullyBusy}
                allLabel={tlPage("monthlyTimesheetDeptAll", "Tất cả bộ phận")}
                selectedLabel={tlPage(
                  "exportDepartmentSelected",
                  "Đã chọn {{count}}/{{total}} bộ phận",
                )}
                selectAllLabel={tlPage(
                  "exportDepartmentSelectAll",
                  "Chọn tất cả",
                )}
                clearLabel={tlPage("exportDepartmentClear", "Bỏ chọn")}
                hint={tlPage(
                  "exportDepartmentHint",
                  "Không chọn = xuất tất cả bộ phận",
                )}
              />
              {TIMESHEET_ZOOM_CSS_OK ? (
                <div
                  className="flex flex-wrap items-center gap-0.5 rounded-md border border-slate-300 bg-white/90 px-1 py-0.5 shadow-sm dark:border-slate-600 dark:bg-slate-800/80"
                  title={tlPage(
                    "monthlyTimesheetZoomHint",
                    "Thu nhỏ để xem tổng quan, phóng to để đọc rõ ô từng ngày. Cỡ chữ được lưu trên trình duyệt.",
                  )}
                >
                  <span className="hidden pl-0.5 pr-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:inline dark:text-slate-400">
                    {tlPage("monthlyTimesheetZoomLabel", "Cỡ lưới")}
                  </span>
                  <button
                    type="button"
                    className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-sm font-bold leading-none text-slate-700 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                    onClick={() => bumpTimesheetZoom(-1)}
                    disabled={timesheetZoomIdx <= 0}
                    aria-label={tlPage(
                      "monthlyTimesheetZoomOut",
                      "Thu nhỏ lưới",
                    )}
                  >
                    −
                  </button>
                  <span className="min-w-[2.75rem] select-none text-center text-[11px] font-extrabold tabular-nums text-slate-800 dark:text-slate-100">
                    {Math.round(timesheetZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-sm font-bold leading-none text-slate-700 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                    onClick={() => bumpTimesheetZoom(1)}
                    disabled={
                      timesheetZoomIdx >= TIMESHEET_ZOOM_LEVELS.length - 1
                    }
                    aria-label={tlPage(
                      "monthlyTimesheetZoomIn",
                      "Phóng to lưới",
                    )}
                  >
                    +
                  </button>
                  {timesheetZoomIdx !== TIMESHEET_ZOOM_DEFAULT_IDX ? (
                    <button
                      type="button"
                      className="ml-0.5 rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-800 hover:bg-indigo-100 dark:border-indigo-500/50 dark:bg-indigo-950/50 dark:text-indigo-200 dark:hover:bg-indigo-900/60"
                      onClick={resetTimesheetZoom}
                    >
                      {tlPage("monthlyTimesheetZoomReset", "Mặc định")}
                    </button>
                  ) : null}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setExportModalOpen(true)}
                disabled={
                  isGridFullyBusy ||
                  !sortedIds.length ||
                  !displayDayChunks.length
                }
                className="rounded-md border border-emerald-300 bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 shadow-sm hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {tlPage("monthlyTimesheetExportExcel", "Xuất Excel")}
              </button>
            </div>
            <div
              ref={tableBodyScrollRef}
              className="pm-ts-scroll min-h-0 overflow-auto"
              style={{
                height: `min(calc(100vh - 11.5rem), ${tableViewportHeight}px)`,
              }}
            >
              {loading && !displayDayChunks.length ? (
                <PayrollMonthGridLoadingOverlay
                  active
                  mode="inline"
                  message={tlPage(
                    "monthlyTimesheetLoading",
                    "Đang tải dữ liệu...",
                  )}
                />
              ) : error && !displayDayChunks.length ? (
                <p className="py-8 text-center text-sm font-semibold text-red-600 dark:text-red-400">
                  {error}
                </p>
              ) : (
                <div
                  ref={tableWrapRef}
                  className="pm-ts-table-wrap relative inline-block min-w-full align-middle"
                  style={{
                    "--pm-ts-day-cell-size": `${MONTH_DAY_COL_WIDTH}px`,
                    ...(TIMESHEET_ZOOM_CSS_OK ? { zoom: timesheetZoom } : {}),
                  }}
                >
                  <PayrollMonthGridLoadingOverlay
                    active={isGridFullyBusy && displayDayChunks.length > 0}
                    message={gridOverlayCopy.message}
                    subtitle={gridOverlayCopy.subtitle}
                  />
                  <table
                    className={`pm-ts-table w-max min-w-full border-collapse text-left text-slate-900 dark:text-slate-100 ${STRONG_BORDER_CLASS}`}
                  >
                    <thead className="pm-ts-thead">
                      <tr className="bg-slate-100 dark:bg-slate-800">
                        {[0, 1, 2, 3, 4].map((ci) => (
                          <th
                            key={`h1-${ci}`}
                            rowSpan={3}
                            style={{
                              ...stickyColStyle(ci),
                              ...monthHeaderStickyStyle(
                                headerRowTops.row1,
                                180 - ci,
                              ),
                            }}
                            className={`${STICKY_TH_BASE_CLASS} ${stickyColClass(ci)} text-center align-middle`}
                          >
                            {ci === 3
                              ? tlPage("monthlyTimesheetColDept", "BP")
                              : ci === 4
                                ? tlPage("monthlyTimesheetColCoeff", "Hệ số TC")
                                : ci === 0
                                  ? tlPage("monthlyTimesheetColStt", "STT")
                                  : ci === 1
                                    ? tlPage(
                                        "monthlyTimesheetColName",
                                        "Họ và tên",
                                      )
                                    : tlPage("monthlyTimesheetColMnv", "MNV")}
                          </th>
                        ))}
                        <th
                          colSpan={monthRange.keys.length}
                          style={monthHeaderStickyStyle(headerRowTops.row1, 90)}
                          className={`${THIN_HEAD_BORDER_CLASS} pm-ts-banner-head bg-slate-200 px-1 py-1.5 text-center font-extrabold uppercase tracking-wide text-slate-900 dark:bg-slate-700 dark:text-slate-100`}
                        >
                          {tlPage(
                            "monthlyTimesheetDaysInMonth",
                            "Ngày trong tháng",
                          )}
                        </th>
                        <th
                          colSpan={MONTH_DETAIL_TOTAL_COLS_PER_BLOCK}
                          style={monthHeaderStickyStyle(headerRowTops.row1, 90)}
                          className={`${THIN_HEAD_BORDER_CLASS} ${STRONG_BORDER_LEFT_CLASS} pm-ts-banner-head bg-slate-200 px-1 py-1.5 text-center font-extrabold text-slate-900 dark:bg-slate-700 dark:text-slate-100`}
                        >
                          {tlPage(
                            "monthlyRuleTotalTitle",
                            "THỜI GIAN LÀM VIỆC",
                          )}
                        </th>
                        <th
                          colSpan={MONTH_DETAIL_PHASE_COLS_PER_BLOCK}
                          style={monthHeaderStickyStyle(headerRowTops.row1, 90)}
                          className={`${THIN_HEAD_BORDER_CLASS} ${STRONG_BORDER_LEFT_CLASS} pm-ts-banner-head bg-slate-200 px-1 py-1.5 text-center font-extrabold text-slate-900 dark:bg-slate-700 dark:text-slate-100`}
                        >
                          {tlPage(
                            "monthlyRuleTrialTitle",
                            "THỜI GIAN THỬ VIỆC",
                          )}
                        </th>
                        <th
                          colSpan={MONTH_DETAIL_PHASE_COLS_PER_BLOCK}
                          style={monthHeaderStickyStyle(headerRowTops.row1, 90)}
                          className={`${THIN_HEAD_BORDER_CLASS} ${STRONG_BORDER_LEFT_CLASS} pm-ts-banner-head bg-slate-200 px-1 py-1.5 text-center font-extrabold text-slate-900 dark:bg-slate-700 dark:text-slate-100`}
                        >
                          {tlPage(
                            "monthlyRuleOfficialTitle",
                            "THỜI GIAN HỢP ĐỒNG",
                          )}
                        </th>
                      </tr>
                      <tr>
                        {monthDayMeta.map((dayMeta) => {
                          return (
                            <th
                              key={dayMeta.dateKey}
                              rowSpan={2}
                              style={{
                                ...monthDayCellStyle(),
                                ...monthHeaderStickyStyle(
                                  headerRowTops.row2,
                                  85,
                                ),
                              }}
                              className={`${THIN_HEAD_BORDER_CLASS} ${NO_TOP_BORDER_CLASS} pm-ts-day-header px-1 py-1.5 text-center ${dayMeta.headerBg}`}
                            >
                              <div className="pm-ts-header-day">
                                {String(dayMeta.dayOfMonth).padStart(2, "0")}
                              </div>
                              <div
                                className={`pm-ts-header-wd ${dayMeta.isSunday ? "pm-ts-header-wd--sun" : ""}`}
                              >
                                {dayMeta.weekdayLabel}
                              </div>
                            </th>
                          );
                        })}
                        {DETAIL_GROUP_KEYS.flatMap((groupKey) => {
                          const groupBg =
                            payrollMonthlyTimesheetDetailGroupHeaderClass(
                              groupKey,
                            );
                          const isTotal = groupKey === "total";
                          const workdayColSpan = isTotal
                            ? MONTH_DETAIL_WORKDAY_COL_COUNT
                            : MONTH_DETAIL_PHASE_WORKDAY_COL_COUNT;
                          return [
                            <th
                              key={`${groupKey}-workday`}
                              colSpan={workdayColSpan}
                              style={monthHeaderStickyStyle(
                                headerRowTops.row2,
                                85,
                              )}
                              className={`${THIN_HEAD_BORDER_CLASS} ${NO_TOP_BORDER_CLASS} pm-ts-detail-group-head ${groupBg} ${STRONG_BORDER_LEFT_CLASS} px-1 py-1 text-center font-extrabold uppercase tracking-wide text-slate-900 dark:text-slate-100`}
                            >
                              {tlPage(
                                "monthlyRuleGroupWorkday",
                                "NGÀY LÀM VIỆC",
                              )}
                            </th>,
                            <th
                              key={`${groupKey}-ot`}
                              colSpan={MONTH_DETAIL_OT_COL_COUNT}
                              style={monthHeaderStickyStyle(
                                headerRowTops.row2,
                                85,
                              )}
                              className={`${THIN_HEAD_BORDER_CLASS} ${NO_TOP_BORDER_CLASS} pm-ts-detail-group-head ${groupBg} px-1 py-1 text-center font-extrabold uppercase tracking-wide text-slate-900 dark:text-slate-100`}
                            >
                              {tlPage("monthlyRuleGroupOt", "TĂNG CA (Hrs)")}
                            </th>,
                            ...(MONTH_DETAIL_SATS_COL_COUNT > 0
                              ? [
                                  <th
                                    key={`${groupKey}-sats`}
                                    colSpan={MONTH_DETAIL_SATS_COL_COUNT}
                                    style={monthHeaderStickyStyle(
                                      headerRowTops.row2,
                                      85,
                                    )}
                                    className={`${THIN_HEAD_BORDER_CLASS} ${NO_TOP_BORDER_CLASS} pm-ts-detail-group-head ${groupBg} px-1 py-1 text-center font-extrabold uppercase tracking-wide text-slate-900 dark:text-slate-100`}
                                  >
                                    SAT.S
                                  </th>,
                                ]
                              : []),
                          ];
                        })}
                      </tr>
                      <tr>
                        {DETAIL_GROUP_KEYS.map((groupKey) => {
                          const headers =
                            detailHeadersByGroup[groupKey] ??
                            detailHeadersByGroup.total;
                          return headers.map((h, idx) => (
                            <th
                              key={`${groupKey}-${h}`}
                              style={{
                                ...monthDetailCellStyle(idx),
                                ...monthHeaderStickyStyle(
                                  headerRowTops.row3,
                                  80,
                                ),
                              }}
                              className={`${THIN_HEAD_BORDER_CLASS} ${NO_TOP_BORDER_CLASS} pm-ts-detail-col-head ${payrollMonthlyTimesheetDetailGroupHeaderClass(groupKey)} ${idx === 0 ? STRONG_BORDER_LEFT_CLASS : ""} px-1 py-1 text-center font-bold text-slate-900 dark:text-slate-100`}
                            >
                              {h}
                            </th>
                          ));
                        })}
                      </tr>
                    </thead>
                    {shouldVirtualizeTimesheetBody ? (
                      <>
                        {tbodyPadTop > 0 ? (
                          <tbody aria-hidden className="pointer-events-none">
                            <tr>
                              <td
                                colSpan={timesheetTotalColCount}
                                style={{
                                  height: tbodyPadTop,
                                  padding: 0,
                                  border: "none",
                                  lineHeight: 0,
                                }}
                              />
                            </tr>
                          </tbody>
                        ) : null}
                        {virtualEmpItems.map((vi) => {
                          const rowId = filteredIds[vi.index];
                          return (
                            <tbody
                              key={rowId}
                              ref={empBlockVirtualizer.measureElement}
                              data-index={vi.index}
                              className="pm-ts-emp-block"
                            >
                              <PayrollMonthlyTimesheetEmployeeBlock
                                rowId={rowId}
                                empBlockIdx={vi.index}
                                rep={repById.get(rowId)}
                                rowDays={getEmployeeRowDays(rowId)}
                                summaries={monthlySummaryById.get(rowId)}
                                loading={loading}
                                user={user}
                                userRole={userRole}
                                userDepartments={userDepartments}
                                openDayCellEditor={openDayCellEditor}
                                tlPage={tlPage}
                                fmtHours={monthlyDetailFmtHours}
                              />
                            </tbody>
                          );
                        })}
                        {tbodyPadBottom > 0 ? (
                          <tbody aria-hidden className="pointer-events-none">
                            <tr>
                              <td
                                colSpan={timesheetTotalColCount}
                                style={{
                                  height: tbodyPadBottom,
                                  padding: 0,
                                  border: "none",
                                  lineHeight: 0,
                                }}
                              />
                            </tr>
                          </tbody>
                        ) : null}
                      </>
                    ) : (
                      <tbody>
                        {filteredIds.map((rowId, idx) => (
                          <PayrollMonthlyTimesheetEmployeeBlock
                            key={rowId}
                            rowId={rowId}
                            empBlockIdx={idx}
                            rep={repById.get(rowId)}
                            rowDays={getEmployeeRowDays(rowId)}
                            summaries={monthlySummaryById.get(rowId)}
                            loading={loading}
                            user={user}
                            userRole={userRole}
                            userDepartments={userDepartments}
                            openDayCellEditor={openDayCellEditor}
                            tlPage={tlPage}
                            fmtHours={monthlyDetailFmtHours}
                          />
                        ))}
                      </tbody>
                    )}
                  </table>
                  {error && displayDayChunks.length ? (
                    <p className="mt-2 text-center text-xs text-amber-700 dark:text-amber-300">
                      {error}
                    </p>
                  ) : null}
                  {!filteredIds.length && displayDayChunks.length ? (
                    <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-300">
                      {tlPage(
                        "monthlyTimesheetNoRowsAfterFilter",
                        "Không có nhân viên nào khớp bộ lọc tìm kiếm / bộ phận.",
                      )}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {exportModalOpen ? (
      <PayrollRangeExcelExportModal
        open
        onDismiss={() => {
          if (!exportBusy) setExportModalOpen(false);
        }}
        onExport={handleExportFromModal}
        todayKey={monthRange.first}
        departmentsOnly
        monthTitle={monthTitle}
        departmentOptions={departmentOptions}
        initialSelectedDepartments={selectedDepartments}
        exporting={exportBusy}
        title={tlPage(
          "monthlyTimesheetExportModalTitle",
          "Xuất Excel bảng chấm công tháng",
        )}
        hint={tlPage(
          "monthlyTimesheetExportModalHint",
          "Chọn một hoặc nhiều bộ phận cần xuất. Không chọn = xuất tất cả bộ phận.",
        )}
        monthSectionLabel={tlPage("exportMonthSectionLabel", "Tháng xuất")}
        departmentLabel={tlPage("exportDepartmentLabel", "Bộ phận")}
        departmentHint={tlPage(
          "exportDepartmentHint",
          "Không chọn = xuất tất cả bộ phận",
        )}
        departmentAllLabel={tlPage("exportDepartmentAll", "Tất cả bộ phận")}
        departmentSelectedLabel={tlPage(
          "exportDepartmentSelected",
          "Đã chọn {{count}}/{{total}} bộ phận",
        )}
        selectAllDepartmentsLabel={tlPage(
          "exportDepartmentSelectAll",
          "Chọn tất cả",
        )}
        clearDepartmentsLabel={tlPage("exportDepartmentClear", "Bỏ chọn")}
        exportLabel={tlPage("exportRangeSubmit", "Xuất Excel")}
        cancelLabel={tlPage("exportRangeCancel", "Hủy")}
      />
      ) : null}
      {dayCellFormOpen ? (
      <AttendanceEmployeeFormModal
        open
        onClose={() => {
          setDayCellFormOpen(false);
          setDayCellFormInitial(null);
        }}
        initialRecord={dayCellFormInitial}
        selectedDate={dayCellFormDate}
        employees={
          dayCellFormEmployees.length > 0 ? dayCellFormEmployees : employees
        }
        user={user}
        userRole={userRole}
        userDepartments={userDepartments}
        onAlert={onAlert}
        onSaved={() => void loadMonth()}
        attendanceRootPath={attendanceRootPath}
        dayIsCompensatory={Boolean(
          dayCellFormDate &&
          chunkByDate.get(dayCellFormDate)?.isCompensatoryDay,
        )}
        dayIsOffDay={Boolean(
          dayCellFormDate && chunkByDate.get(dayCellFormDate)?.isOffDay,
        )}
        dayIsHolidayDay={Boolean(
          dayCellFormDate && chunkByDate.get(dayCellFormDate)?.isHolidayDay,
        )}
      />
      ) : null}
    </>,
    document.body,
  );
}
