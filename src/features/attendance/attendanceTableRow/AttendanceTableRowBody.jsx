import React, { memo } from "react";
import {
  formatAttendanceLeaveTypeColumnForEmployee,
  formatAttendanceTimeInColumnDisplay,
  getAttendanceLeaveTypeColorClassNameForEmployee,
} from "../attendanceGioVaoTypeOptions";
import { formatPayrollTableWorkingHoursCell } from "../attendanceWorkingHours";
import {
  formatPayrollTableHolidayNightWorkingCellFromEmp,
  formatPayrollTableDayShiftOvertimeCellFromEmp,
  formatPayrollTableHolidayDayWorkingCellFromEmp,
  formatPayrollTableNightShiftOffDayWorkingCellFromEmp,
  formatPayrollTableNightShiftOvertimeCellFromEmp,
  formatPayrollTableNightShiftWorkingCellFromEmp,
  formatPayrollTableOffDayTcCellFromEmp,
  formatPayrollTableTotalDayGcCellFromEmp,
  formatPayrollTableTotalNightGcCellFromEmp,
} from "@/features/payroll/payrollTableOtCells";
import { employeeRegimeWorkingHoursFlags } from "../employeeRegime";
import AttendanceOffHolidayCellContent from "./AttendanceOffHolidayCellContent";
import {
  attendanceRowCheckHighlightClassName,
  isBoPhanChuaDung,
  isHoVaTenYellowHighlight,
  isLeaveTypeCheckHighlight,
} from "../attendanceDayMeta";
import {
  ATTENDANCE_EMP,
  pickAttendanceEmployeeDayFields,
} from "../attendanceEmployeeFields";
import { resolveAttendanceDisplayStt } from "../attendanceSeasonalStt";
import {
  formatAttendanceGenderDisplay,
  isAttendanceFemaleGioiTinh,
} from "../attendanceGender";
import { payrollDash } from "./payrollDash";
import { PAYROLL_EMPTY_CELL, ATTENDANCE_EMPTY_CELL } from "./constants";
import {
  getAttendanceGridColumnStart,
  attendanceGridCellStyle,
  cellClsForAttendanceTable,
} from "./gridLayout";
import { cellClsForGrid } from "./cellClassNames";
import { formatAnnualLeaveDecimal } from "@/features/leave/annualLeaveCalculated";
import { getDisplayAnnualLeaveBalanceForAttendance } from "@/features/leave/annualLeaveBalanceLookup";
import AnnualLeaveUsageDetailTrigger from "@/features/leave/AnnualLeaveUsageDetailTrigger";
import { propsAreEqual } from "./propsAreEqual";

function AttendanceTableRow({
  emp,
  idx,
  virtualRow,
  showRowModalActions,
  columnPlan = "full",
  user,
  canEdit,
  tl,
  t,
  onEdit,
  onDelete,
  canDeleteRow = true,
  measureElementRef,
  gridTemplateColumns,
  isOffDay = false,
  isHolidayDay = false,
  isCompensatoryDay = false,
  tableVariant = "attendance",
  isSeasonalAttendance = false,
  isKoreanAttendance = false,
  attendanceDateKey = null,
  annualLeaveBalanceByMnv = {},
  annualLeaveYear = new Date().getFullYear(),
  annualLeaveYearData = null,
  annualLeaveThroughDateKey = null,
  annualLeaveAttendanceRootPath = "attendance",
}) {
  const isPayroll = tableVariant === "payroll";
  const payrollOffLike =
    isOffDay || isHolidayDay || (isCompensatoryDay && !isKoreanAttendance);
  const strictOffDay = isOffDay || (isCompensatoryDay && !isKoreanAttendance);
  const payrollDayCtx = {
    isOffDay,
    isHolidayDay,
    isCompensatoryDay,
    koreanTimesheetRules: isKoreanAttendance,
    dateKey: attendanceDateKey,
  };
  const {
    includeTapVuInWorkingHours,
    includeThaiSanInWorkingHours,
    includeTaiXeInWorkingHours,
    includeTaiXeTongInWorkingHours,
  } = employeeRegimeWorkingHoursFlags(emp);
  const isMinimal = columnPlan === "minimal";
  /** Giờ vào/ra + ca — cùng cỡ ô dữ liệu với Điểm danh */
  const payrollTimeShiftFont = isMinimal
    ? "text-[10px] md:text-sm"
    : "text-[11px] md:text-sm";
  const isGrid = virtualRow != null;
  const showJoinWorkStatusDeptBlock = columnPlan === "full";
  const showDeptColumn = columnPlan === "full" || columnPlan === "compact";
  const showAnnualLeaveColumn =
    !isMinimal &&
    getAttendanceGridColumnStart(
      "annualLeaveBalance",
      columnPlan,
      showRowModalActions,
      tableVariant,
    ) != null;
  const Row = isGrid ? "div" : "tr";
  const Cell = isGrid ? "div" : "td";
  const cellCls = (s) => {
    const base = isGrid
      ? cellClsForGrid(true, s, isMinimal)
      : cellClsForAttendanceTable(s);
    return `${base} h-9 leading-none`;
  };

  const showDeptWrongFlag = !isPayroll && isBoPhanChuaDung(emp.boPhanChuaDung);
  const deptWrongFlagHint = tl("boPhanChuaDungFlag", "Bộ phận chưa đúng");
  const hoVaTenYellowBg = isHoVaTenYellowHighlight(
    emp[ATTENDANCE_EMP.NAME_YELLOW_BG],
  );
  const leaveTypeCheckHighlight = isLeaveTypeCheckHighlight(
    emp[ATTENDANCE_EMP.LEAVE_TYPE_CHECK],
  );
  const rowCheckHighlightClass = attendanceRowCheckHighlightClassName({
    otCheck: hoVaTenYellowBg,
    leaveTypeCheck: leaveTypeCheckHighlight,
  });
  const deptWrongFlagEl = showDeptWrongFlag ? (
    <span
      className="pointer-events-none absolute right-0.5 top-1/2 z-[1] inline-block shrink-0 -translate-y-1/2 text-xs leading-none text-red-600"
      aria-hidden="true"
    >
      🚩
    </span>
  ) : null;
  const deptLabel = String(payrollDash(emp.boPhan, isPayroll) ?? "").trim();

  const gcs = (key) =>
    getAttendanceGridColumnStart(
      key,
      columnPlan,
      showRowModalActions,
      tableVariant,
    );

  const dayFields = pickAttendanceEmployeeDayFields(emp);

  const gioVaoTrimmed =
    dayFields.timeIn != null && String(dayFields.timeIn).trim() !== ""
      ? String(dayFields.timeIn).trim()
      : "";
  const timeInCol = formatAttendanceTimeInColumnDisplay(gioVaoTrimmed);
  const leaveTypeCol = formatAttendanceLeaveTypeColumnForEmployee(emp);
  const leaveTypeColorClass =
    getAttendanceLeaveTypeColorClassNameForEmployee(emp);
  const annualLeaveBalanceRaw = getDisplayAnnualLeaveBalanceForAttendance(
    emp,
    annualLeaveBalanceByMnv,
  );
  const annualLeaveBalanceCol =
    annualLeaveBalanceRaw != null &&
    Number.isFinite(Number(annualLeaveBalanceRaw))
      ? formatAnnualLeaveDecimal(annualLeaveBalanceRaw)
      : isPayroll
        ? PAYROLL_EMPTY_CELL
        : ATTENDANCE_EMPTY_CELL;
  const caLamViecTrimmed =
    dayFields.shiftCode != null && String(dayFields.shiftCode).trim() !== ""
      ? String(dayFields.shiftCode).trim()
      : "";

  const rowStyle = isGrid
    ? {
        display: "grid",
        gridTemplateColumns,
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        boxSizing: "border-box",
        height: `${virtualRow.size}px`,
        minHeight: "36px",
        transform: `translateY(${virtualRow.start}px)`,
        alignItems: "center",
      }
    : undefined;

  return (
    <Row
      ref={measureElementRef}
      data-index={virtualRow != null ? virtualRow.index : undefined}
      style={rowStyle}
      role={isGrid ? "row" : undefined}
      className={`h-9 transition-colors border-b border-slate-100 dark:border-slate-700/40 ${
        rowCheckHighlightClass
          ? rowCheckHighlightClass
          : `${idx % 2 === 0 ? "bg-blue-100 dark:bg-slate-800" : "bg-white dark:bg-slate-900"} hover:bg-blue-200 dark:hover:bg-slate-700/80`
      }`}
    >
      {!isMinimal ? (
        <Cell
          role={isGrid ? "cell" : undefined}
          style={attendanceGridCellStyle(isGrid, gcs("stt"))}
          className={cellCls(
            "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center font-bold text-gray-700",
          )}
        >
          {resolveAttendanceDisplayStt(emp, idx + 1, isSeasonalAttendance)}
        </Cell>
      ) : null}
      <Cell
        role={isGrid ? "cell" : undefined}
        style={attendanceGridCellStyle(isGrid, gcs("mnv"))}
        className={cellCls(
          `${isMinimal ? "px-0.5" : "px-1"} md:px-1.5 py-px ${isMinimal ? "text-[10px]" : "text-[11px]"} md:text-sm text-center font-bold text-blue-600 whitespace-nowrap`,
        )}
      >
        {payrollDash(emp.mnv, isPayroll)}
      </Cell>
      {!isMinimal ? (
        <Cell
          role={isGrid ? "cell" : undefined}
          style={attendanceGridCellStyle(isGrid, gcs("mvt"))}
          className={cellCls(
            "hidden md:table-cell px-1 md:px-1.5 py-px text-sm text-center font-semibold text-gray-700",
          )}
        >
          {payrollDash(emp.mvt, isPayroll)}
        </Cell>
      ) : null}
      <Cell
        role={isGrid ? "cell" : undefined}
        style={attendanceGridCellStyle(isGrid, gcs("fullName"))}
        className={cellCls(
          `${isMinimal ? "px-0.5" : "px-1"} md:px-2 py-px ${
            isMinimal
              ? "text-[9px] overflow-hidden text-ellipsis whitespace-nowrap"
              : isPayroll
                ? "text-[11px] md:text-sm whitespace-normal break-words leading-snug"
                : "text-[11px] overflow-hidden text-ellipsis whitespace-nowrap md:text-sm"
          } text-left md:text-center font-bold text-gray-800 leading-tight`,
        )}
        title={String(payrollDash(emp.hoVaTen, isPayroll) ?? "")}
      >
        {payrollDash(emp.hoVaTen, isPayroll)}
      </Cell>
      {!isMinimal ? (
        <Cell
          role={isGrid ? "cell" : undefined}
          style={attendanceGridCellStyle(isGrid, gcs("gender"))}
          className={cellCls(
            "hidden md:table-cell px-1 md:px-1.5 py-px text-sm text-center",
          )}
        >
          {isPayroll && !String(emp.gioiTinh ?? "").trim() ? (
            <span className="text-gray-500 tabular-nums">
              {PAYROLL_EMPTY_CELL}
            </span>
          ) : (
            <span
              className={`inline-flex items-center justify-center px-1.5 py-px text-[10px] font-bold leading-none rounded-full ${
                (
                  isSeasonalAttendance
                    ? isAttendanceFemaleGioiTinh(emp.gioiTinh)
                    : emp.gioiTinh === "YES"
                )
                  ? "bg-pink-100 text-pink-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {isSeasonalAttendance
                ? formatAttendanceGenderDisplay(emp.gioiTinh, {
                    female: tl("femaleLabel", "Nữ"),
                    male: tl("maleLabel", "Nam"),
                  })
                : payrollDash(emp.gioiTinh, isPayroll)}
            </span>
          )}
        </Cell>
      ) : null}
      {showJoinWorkStatusDeptBlock ? (
        <>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(isGrid, gcs("joinDate"))}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-sm text-center font-semibold text-gray-700",
            )}
          >
            {payrollDash(emp.ngayVaoLam, isPayroll)}
          </Cell>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(isGrid, gcs("workStatus"))}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-sm text-center font-semibold tabular-nums text-gray-700 whitespace-nowrap",
            )}
          >
            {payrollDash(emp.ngayHopDong, isPayroll)}
          </Cell>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(isGrid, gcs("deptCode"))}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-sm text-center font-bold text-gray-700",
            )}
          >
            {payrollDash(emp.maBoPhan, isPayroll)}
          </Cell>
        </>
      ) : null}
      {showDeptColumn ? (
        <Cell
          role={isGrid ? "cell" : undefined}
          style={attendanceGridCellStyle(isGrid, gcs("dept"))}
          className={cellCls(
            isKoreanAttendance
              ? `relative hidden md:table-cell px-1.5 md:px-2 py-px text-sm text-center font-semibold text-gray-700 whitespace-nowrap${showDeptWrongFlag ? " pr-4" : ""}`
              : `relative hidden md:table-cell min-w-0 overflow-hidden px-1.5 md:px-2 py-px text-sm text-center font-semibold text-gray-700${showDeptWrongFlag ? " pr-4" : ""}`,
          )}
          title={
            showDeptWrongFlag
              ? `${deptLabel} — ${deptWrongFlagHint}`
              : deptLabel || undefined
          }
        >
          <span
            className={
              isKoreanAttendance ? "block" : "block min-w-0 truncate"
            }
          >
            {deptLabel}
          </span>
          {deptWrongFlagEl}
        </Cell>
      ) : null}
      {showAnnualLeaveColumn ? (
        <Cell
          role={isGrid ? "cell" : undefined}
          style={attendanceGridCellStyle(isGrid, gcs("annualLeaveBalance"))}
          className={cellCls(
            "hidden md:table-cell px-1 md:px-1.5 py-px text-sm text-center font-semibold tabular-nums text-gray-700 dark:text-slate-200",
          )}
          title={tl(
            "annualLeaveBalanceHint",
            "Số phép còn lại (BALANCE) từ Quản lý phép năm — khớp theo MNV.",
          )}
        >
          <span className="annual-leave-balance-cell inline-flex items-center justify-center gap-0.5 min-w-0">
            <span>{annualLeaveBalanceCol}</span>
            <AnnualLeaveUsageDetailTrigger
              emp={emp}
              year={annualLeaveYear}
              yearData={annualLeaveYearData}
              attendanceRootPath={annualLeaveAttendanceRootPath}
              throughDateKey={annualLeaveThroughDateKey}
            />
          </span>
        </Cell>
      ) : null}
      <Cell
        role={isGrid ? "cell" : undefined}
        style={attendanceGridCellStyle(isGrid, gcs("timeIn"))}
        className={cellCls(
          `min-w-0 ${isMinimal ? "px-0.5" : "px-1"} md:px-1.5 py-px ${payrollTimeShiftFont} text-center`,
        )}
        title={tl(
          "timeInColumnHint",
          "Giờ vào dạng HH:MM — chỉnh sửa qua nút Sửa khi được phép.",
        )}
      >
        {timeInCol ? (
          <span
            className={
              isPayroll
                ? `font-bold ${payrollTimeShiftFont} text-green-600`
                : isMinimal
                  ? "font-bold text-[10px] md:text-base text-green-600"
                  : "font-bold text-xs md:text-base text-green-600"
            }
          >
            {timeInCol}
          </span>
        ) : canEdit && isPayroll ? (
          <span
            className="text-gray-500 italic text-xs"
            title={tl(
              "gioVaoEditOnlyViaModalHint",
              "Chưa nhập giờ vào — mở form qua nút Sửa (cột thao tác).",
            )}
          >
            {tl("emptyUseEditButton", PAYROLL_EMPTY_CELL)}
          </span>
        ) : canEdit && !isPayroll ? (
          <span
            className="tabular-nums font-semibold text-gray-600"
            title={tl(
              "gioVaoEditOnlyViaModalHint",
              "Chưa có giờ vào — chỉnh sửa qua nút Sửa (cột thao tác).",
            )}
          >
            {ATTENDANCE_EMPTY_CELL}
          </span>
        ) : user ? (
          <span className="text-gray-400 italic text-xs">
            {tl("cannotEdit", "Không được phép chỉnh sửa")}
          </span>
        ) : (
          <span className="text-gray-400 italic">{PAYROLL_EMPTY_CELL}</span>
        )}
      </Cell>
      {!isMinimal ? (
        <Cell
          role={isGrid ? "cell" : undefined}
          style={attendanceGridCellStyle(isGrid, gcs("timeOut"))}
          className={cellCls(
            `hidden md:table-cell px-1 md:px-1.5 py-px ${payrollTimeShiftFont} text-center min-w-0`,
          )}
        >
          <span
            className={
              isPayroll
                ? `text-red-600 font-bold ${payrollTimeShiftFont}`
                : "text-red-600 font-bold text-xs md:text-base"
            }
          >
            {payrollDash(dayFields.timeOut, isPayroll)}
          </span>
        </Cell>
      ) : null}
      <Cell
        role={isGrid ? "cell" : undefined}
        style={attendanceGridCellStyle(isGrid, gcs("leaveType"))}
        className={cellCls(
          `min-w-0 ${isMinimal ? "px-0.5" : "px-1"} md:px-1.5 py-px ${payrollTimeShiftFont} text-center`,
        )}
        title={tl(
          "leaveTypeColumnHint",
          "Loại phép / trạng thái chấm công — chỉnh sửa qua nút Sửa khi được phép.",
        )}
      >
        {leaveTypeCol ? (
          <span
            className={
              isPayroll
                ? `font-bold ${payrollTimeShiftFont} ${leaveTypeColorClass}`
                : isMinimal
                  ? `font-bold text-[10px] md:text-base ${leaveTypeColorClass}`
                  : `font-bold text-xs md:text-base ${leaveTypeColorClass}`
            }
          >
            {leaveTypeCol}
          </span>
        ) : isPayroll ? (
          <span
            className="text-gray-500 tabular-nums"
            title={
              canEdit
                ? tl(
                    "leaveTypeEditViaModalHint",
                    "Loại phép — mở form qua nút Sửa (cột thao tác).",
                  )
                : undefined
            }
          >
            {PAYROLL_EMPTY_CELL}
          </span>
        ) : canEdit ? (
          <span
            className="tabular-nums font-semibold text-gray-600"
            title={tl(
              "leaveTypeEditViaModalHint",
              "Chưa có loại phép — chỉnh sửa qua nút Sửa (cột thao tác).",
            )}
          >
            {ATTENDANCE_EMPTY_CELL}
          </span>
        ) : user ? (
          <span className="text-gray-400 italic text-xs">
            {tl("cannotEdit", "Không được phép chỉnh sửa")}
          </span>
        ) : (
          <span className="text-gray-400 italic">{PAYROLL_EMPTY_CELL}</span>
        )}
      </Cell>
      <Cell
        role={isGrid ? "cell" : undefined}
        style={attendanceGridCellStyle(isGrid, gcs("shift"))}
        className={cellCls(
          `hidden md:table-cell px-px md:px-0.5 py-px ${payrollTimeShiftFont} text-center min-w-0`,
        )}
      >
        {caLamViecTrimmed ? (
          <span
            className={
              isPayroll
                ? `text-blue-600 font-bold ${payrollTimeShiftFont}`
                : isMinimal
                  ? "text-blue-600 font-bold text-[10px] md:text-base"
                  : "text-blue-600 font-bold text-xs md:text-base"
            }
          >
            {caLamViecTrimmed}
          </span>
        ) : canEdit && isPayroll ? (
          <span
            className="text-gray-500 italic text-xs"
            title={tl(
              "shiftEditOnlyViaModalHint",
              "Chưa chọn ca — mở form qua nút Sửa (cột thao tác).",
            )}
          >
            {tl("emptyUseEditButton", PAYROLL_EMPTY_CELL)}
          </span>
        ) : canEdit && !isPayroll ? (
          <span
            className="tabular-nums font-semibold text-gray-600"
            title={tl(
              "shiftEditViaModalHint",
              "Chưa chọn ca — chỉnh sửa qua nút Sửa (cột thao tác).",
            )}
          >
            {ATTENDANCE_EMPTY_CELL}
          </span>
        ) : user ? (
          <span className="text-gray-400 italic text-xs">
            {tl("cannotEdit", "Không được phân quyền")}
          </span>
        ) : (
          <span className="text-gray-400 italic">
            {isPayroll ? PAYROLL_EMPTY_CELL : "--"}
          </span>
        )}
      </Cell>
      {!isPayroll && !isMinimal ? (
        <Cell
          role={isGrid ? "cell" : undefined}
          style={attendanceGridCellStyle(isGrid, gcs("offDay"))}
          className={cellCls(
            "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center min-w-0 font-bold text-slate-800 dark:text-slate-100",
          )}
          title={tl(
            "offDayColumnHint",
            "Khi ngày được đánh dấu «Ngày off» trên Điểm danh: hiển thị OFF.",
          )}
        >
          <AttendanceOffHolidayCellContent
            isPayroll={false}
            isMinimal={isMinimal}
            payrollTimeShiftFont={payrollTimeShiftFont}
            kind="off"
            active={isOffDay}
          />
        </Cell>
      ) : null}
      {!isPayroll && !isMinimal ? (
        <Cell
          role={isGrid ? "cell" : undefined}
          style={attendanceGridCellStyle(isGrid, gcs("holidayDay"))}
          className={cellCls(
            "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center min-w-0 font-bold text-slate-800 dark:text-slate-100",
          )}
          title={tl(
            "holidayDayColumnHint",
            "Khi ngày được đánh dấu «Ngày lễ» trên Điểm danh: hiển thị HOLIDAY.",
          )}
        >
          <AttendanceOffHolidayCellContent
            isPayroll={false}
            isMinimal={isMinimal}
            payrollTimeShiftFont={payrollTimeShiftFont}
            kind="holiday"
            active={isHolidayDay}
          />
        </Cell>
      ) : null}
      {isPayroll && !isMinimal ? (
        <>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(isGrid, gcs("offDay"))}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center min-w-0 font-bold text-slate-800 dark:text-slate-100",
            )}
            title={tl(
              "offDayColumnHint",
              "Khi ngày được đánh dấu «Ngày off» trên Điểm danh: hiển thị OFF.",
            )}
          >
            <AttendanceOffHolidayCellContent
              isPayroll
              isMinimal={isMinimal}
              payrollTimeShiftFont={payrollTimeShiftFont}
              kind="off"
              active={isOffDay}
            />
          </Cell>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(isGrid, gcs("holidayDay"))}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center min-w-0 font-bold text-slate-800 dark:text-slate-100",
            )}
            title={tl(
              "holidayDayColumnHint",
              "Khi ngày được đánh dấu «Ngày lễ» trên Điểm danh: hiển thị HOLIDAY.",
            )}
          >
            <AttendanceOffHolidayCellContent
              isPayroll
              isMinimal={isMinimal}
              payrollTimeShiftFont={payrollTimeShiftFont}
              kind="holiday"
              active={isHolidayDay}
            />
          </Cell>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(isGrid, gcs("workingHours"))}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center min-w-0 bg-amber-50/90 dark:bg-amber-950/25",
            )}
            title={tl(
              "payrollWorkingHoursHint",
              "Ngày thường: giờ công theo giờ vào–ra. Ngày «Ngày off» (Điểm danh): cột này «-»; cùng quy tắc giờ công hiển thị ở TC off.",
            )}
          >
            <span className="font-bold tabular-nums text-amber-900 dark:text-amber-100">
              {formatPayrollTableWorkingHoursCell(
                dayFields.timeIn,
                dayFields.timeOut,
                payrollOffLike,
                dayFields.shiftCode,
                dayFields.leaveType,
                includeTapVuInWorkingHours,
                includeThaiSanInWorkingHours,
                includeTaiXeInWorkingHours,
                includeTaiXeTongInWorkingHours,
              )}
            </span>
          </Cell>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(
              isGrid,
              gcs("dayShiftOvertimeHours"),
            )}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center min-w-0 bg-orange-50/90 dark:bg-orange-950/25",
            )}
            title={tl(
              "dayShiftOvertimeHoursHint",
              "Ca ngày: giờ ra sau 17:30. Ca đêm: «-» (xem TC ca đêm).",
            )}
          >
            <span className="font-bold tabular-nums text-orange-900 dark:text-orange-100">
              {formatPayrollTableDayShiftOvertimeCellFromEmp(
                emp,
                payrollDayCtx,
              )}
            </span>
          </Cell>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(isGrid, gcs("offDayOvertimeHours"))}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center min-w-0 bg-violet-50/90 dark:bg-violet-950/25",
            )}
            title={tl(
              "payrollOffDayTcHint",
              "Khi «Ngày off» và ca ngày: Giờ công BT + TC chiều/giấy gộp một ô; cột Giờ TC là «-».",
            )}
          >
            <span className="font-bold tabular-nums text-violet-900 dark:text-violet-100">
              {formatPayrollTableOffDayTcCellFromEmp(emp, payrollDayCtx)}
            </span>
          </Cell>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(
              isGrid,
              gcs("holidayDayWorkingHours"),
            )}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center min-w-0 bg-green-100/90 dark:bg-green-950/30",
            )}
            title={tl(
              "payrollHolidayDayWorkingHoursHint",
              "Khi «Ngày lễ» và ca ngày: Giờ công BT + TC gộp một ô; cột Giờ TC là «-».",
            )}
          >
            <span className="font-bold tabular-nums text-green-950 dark:text-green-100">
              {formatPayrollTableHolidayDayWorkingCellFromEmp(
                emp,
                payrollDayCtx,
              )}
            </span>
          </Cell>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(isGrid, gcs("payrollTotalGcDay"))}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center min-w-0 bg-sky-100/90 dark:bg-sky-950/30",
            )}
            title={tl(
              "payrollTotalGcDayHint",
              "Tổng khối ngày: Giờ công + Giờ TC; ngày off/lễ ca ngày ≈ một cột TC off/GC lễ đã gộp (cột Giờ TC «-»); không gồm cột ca đêm.",
            )}
          >
            <span className="font-bold tabular-nums text-sky-950 dark:text-sky-100">
              {formatPayrollTableTotalDayGcCellFromEmp(emp, payrollDayCtx)}
            </span>
          </Cell>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(
              isGrid,
              gcs("nightShiftWorkingHours"),
            )}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center min-w-0 bg-teal-50/90 dark:bg-teal-950/25",
            )}
            title={tl(
              "nightShiftWorkingHoursHint",
              "Ca đêm: từ giờ vào đến mốc 05:00 (cùng ngày nếu vào trước 05:00, không thì 05:00 hôm sau), tối đa 8 giờ.",
            )}
          >
            <span className="font-bold tabular-nums text-teal-900 dark:text-teal-100">
              {formatPayrollTableNightShiftWorkingCellFromEmp(
                emp,
                payrollDayCtx,
              )}
            </span>
          </Cell>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(
              isGrid,
              gcs("nightShiftOvertimeHours"),
            )}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center min-w-0 bg-fuchsia-50/90 dark:bg-fuchsia-950/25",
            )}
            title={tl(
              "nightShiftOvertimeHoursHint",
              "Ca đêm: phần làm sau mốc 05:00 — cứ 30 phút = 0,5 giờ TC.",
            )}
          >
            <span className="font-bold tabular-nums text-fuchsia-900 dark:text-fuchsia-100">
              {formatPayrollTableNightShiftOvertimeCellFromEmp(
                emp,
                payrollDayCtx,
              )}
            </span>
          </Cell>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(
              isGrid,
              gcs("nightShiftOffDayWorkingHours"),
            )}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center min-w-0 bg-emerald-50/90 dark:bg-emerald-950/25",
            )}
            title={tl(
              "nightShiftOffDayWorkingHoursHint",
              "Khi «Ngày off» và ca đêm: GC + TC ca đêm gộp (cùng quy tắc mốc 05:00 như ngày thường); cột TC ca đêm «-». Ngày không off thì trống.",
            )}
          >
            <span className="font-bold tabular-nums text-emerald-900 dark:text-emerald-100">
              {formatPayrollTableNightShiftOffDayWorkingCellFromEmp(
                emp,
                payrollDayCtx,
              )}
            </span>
          </Cell>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(
              isGrid,
              gcs("holidayNightWorkingHours"),
            )}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center min-w-0 bg-lime-100/90 dark:bg-lime-950/35",
            )}
            title={tl(
              "payrollHolidayNightWorkingHoursHint",
              "Khi «Ngày lễ» và ca đêm: GC + TC ca đêm gộp; cột TC ca đêm «-»; cột GC ca đêm «-».",
            )}
          >
            <span className="font-bold tabular-nums text-lime-950 dark:text-lime-100">
              {formatPayrollTableHolidayNightWorkingCellFromEmp(
                emp,
                payrollDayCtx,
              )}
            </span>
          </Cell>
          <Cell
            role={isGrid ? "cell" : undefined}
            style={attendanceGridCellStyle(isGrid, gcs("payrollTotalGcNight"))}
            className={cellCls(
              "hidden md:table-cell px-1 md:px-1.5 py-px text-xs md:text-sm text-center min-w-0 bg-indigo-100/90 dark:bg-indigo-950/30",
            )}
            title={tl(
              "payrollTotalGcNightHint",
              "Tổng khối ca đêm: GC + TC; ngày off/lễ ca đêm gộp một số (cột TC ca đêm «-»).",
            )}
          >
            <span className="font-bold tabular-nums text-indigo-950 dark:text-indigo-100">
              {formatPayrollTableTotalNightGcCellFromEmp(emp, payrollDayCtx)}
            </span>
          </Cell>
        </>
      ) : null}
      {showRowModalActions && (
        <Cell
          role={isGrid ? "cell" : undefined}
          style={attendanceGridCellStyle(isGrid, gcs("actions"))}
          className={cellCls(
            `${isMinimal ? "px-0" : "px-1"} md:px-1 text-center min-w-0 hidden md:table-cell`,
          )}
        >
          {canEdit ? (
            <div className="flex items-center justify-center gap-0.5 md:gap-2">
              <button
                type="button"
                onClick={() => onEdit(emp)}
                className="px-1 py-0.5 md:px-2 md:py-1 bg-blue-500 text-white rounded text-[9px] md:text-xs font-medium hover:bg-blue-600 transition-all shadow-sm hover:shadow-md"
                title="Chỉnh sửa"
              >
                ✏️
              </button>
              {canDeleteRow ? (
                <button
                  type="button"
                  onClick={() => onDelete(emp.id)}
                  className="px-1 py-0.5 md:px-2 md:py-1 bg-red-500 text-white rounded text-[9px] md:text-xs font-medium hover:bg-red-600 transition-all shadow-sm hover:shadow-md"
                  title="Xóa"
                >
                  🗑️
                </button>
              ) : null}
            </div>
          ) : (
            <span className="text-gray-300 text-xs">
              {isPayroll ? PAYROLL_EMPTY_CELL : "—"}
            </span>
          )}
        </Cell>
      )}
    </Row>
  );
}

export default memo(AttendanceTableRow, propsAreEqual);
