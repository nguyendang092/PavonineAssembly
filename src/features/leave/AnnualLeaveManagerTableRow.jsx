import { memo } from "react";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import {
  formatAnnualLeaveDecimal,
  formatAnnualLeaveDisplayDate,
} from "./annualLeaveCalculated";
import AnnualLeaveUsageDetailTrigger from "./AnnualLeaveUsageDetailTrigger";
import AnnualLeaveAdjustmentCell from "./AnnualLeaveAdjustmentCell";
import {
  annualLeaveDeptPillStyle,
  annualLeaveEmployeeAvatarStyle,
  annualLeaveHeatmapCellStyle,
  resolveAnnualLeaveBalanceStatus,
} from "./annualLeaveManagerTheme";
import {
  annualLeaveStickyColClass,
  annualLeaveTableRowClass,
} from "./annualLeaveTableStyles";

const tdBase = "annual-leave-td text-center tabular-nums";

function hasAnnualLeaveMonthUsage(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function AnnualLeaveManagerTableRow({
  row,
  raw,
  index,
  year,
  throughDateKey,
  monthValues = [],
  canManage = false,
  adjustmentSaving = false,
  onAdjustmentSave,
  attendanceUsageReady = false,
  attendanceAccrualReady = false,
}) {
  const sticky = (colIndex) =>
    annualLeaveStickyColClass(colIndex, { rowIndex: index });
  const balanceStatus = resolveAnnualLeaveBalanceStatus(row);
  const deptName = row[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT];
  const deptStyle = annualLeaveDeptPillStyle(deptName);
  const fullName = row[ANNUAL_LEAVE_EMP.FULL_NAME];
  const avatarStyle = annualLeaveEmployeeAvatarStyle(fullName, deptName);

  return (
    <tr className={annualLeaveTableRowClass(index)}>
      <td className={`${tdBase} annual-leave-cell-stt ${sticky(0)}`}>
        {row.rowNo ?? index + 1}
      </td>
      <td className={`${tdBase} ${sticky(1)}`}>
        <div className="annual-leave-mnv-stack">
          <span className="annual-leave-mnv-stack__primary whitespace-nowrap">
            {row[ANNUAL_LEAVE_EMP.MNV_PREFIX]}
          </span>
          {row[ANNUAL_LEAVE_EMP.MNV_SUFFIX] ? (
            <span className="annual-leave-mnv-stack__suffix whitespace-nowrap">
              {row[ANNUAL_LEAVE_EMP.MNV_SUFFIX]}
            </span>
          ) : null}
        </div>
      </td>
      <td className={`${tdBase} ${sticky(2)}`}>
        <div className="annual-leave-name-row">
          <span
            className="annual-leave-employee-avatar"
            style={{
              backgroundColor: avatarStyle.backgroundColor,
              color: avatarStyle.color,
            }}
            aria-hidden
          >
            {avatarStyle.initials}
          </span>
          <div className="annual-leave-mnv-stack">
            <span className="annual-leave-mnv-stack__primary annual-leave-cell-name">
              {fullName}
            </span>
            <span className="annual-leave-mnv-stack__suffix whitespace-nowrap">
              {formatAnnualLeaveDisplayDate(row[ANNUAL_LEAVE_EMP.DATE_OF_BIRTH])}
            </span>
          </div>
        </div>
      </td>
      <td className={tdBase}>
        {deptName ? (
          <span
            className="annual-leave-dept-pill"
            style={{
              backgroundColor: deptStyle.bg,
              color: deptStyle.text,
            }}
          >
            {deptName}
          </span>
        ) : null}
      </td>
      <td className={`${tdBase} annual-leave-cell-sub`}>
        {formatAnnualLeaveDisplayDate(row[ANNUAL_LEAVE_EMP.START_WORKING_DATE], {
          fullYear: true,
        })}
      </td>
      <td
        className={`${tdBase} font-semibold${
          !attendanceAccrualReady ? " annual-leave-cell--pending" : ""
        }`}
      >
        {formatAnnualLeaveDecimal(row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR])}
      </td>
      <td
        className={`${tdBase} font-semibold${
          !attendanceUsageReady ? " annual-leave-cell--pending" : ""
        }`}
      >
        {formatAnnualLeaveDecimal(row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED])}
      </td>
      <td
        className={`${tdBase}${
          !attendanceUsageReady ? " annual-leave-cell--pending" : ""
        }`}
      >
        <span
          className={`annual-leave-balance-tag annual-leave-balance-tag--${balanceStatus}`}
        >
          {formatAnnualLeaveDecimal(row[ANNUAL_LEAVE_EMP.BALANCE])}
        </span>
      </td>
      {monthValues.map((value, monthIdx) => {
        const heatmapStyle = annualLeaveHeatmapCellStyle(value);
        return (
          <td
            key={monthIdx}
            className={`${tdBase} annual-leave-month-cell min-w-[4.25rem] whitespace-nowrap${
              !attendanceUsageReady ? " annual-leave-cell--pending" : ""
            }`}
            style={heatmapStyle ?? undefined}
          >
            {hasAnnualLeaveMonthUsage(value) ? (
              formatAnnualLeaveDecimal(value)
            ) : (
              <span className="annual-leave-month-empty" aria-hidden="true">
                -
              </span>
            )}
          </td>
        );
      })}
      {canManage ? (
        <td className={`${tdBase} annual-leave-td-action`}>
          <AnnualLeaveAdjustmentCell
            row={row}
            raw={raw}
            saving={adjustmentSaving}
            onSave={onAdjustmentSave}
          />
        </td>
      ) : null}
      <td className={`${tdBase} annual-leave-td-action`}>
        <div className="flex items-center justify-center">
          <AnnualLeaveUsageDetailTrigger
            managerRow={row}
            year={year}
            throughDateKey={throughDateKey}
            className="annual-leave-inline-detail-btn--manager"
          />
        </div>
      </td>
    </tr>
  );
}

function areAnnualLeaveManagerTableRowPropsEqual(prev, next) {
  return (
    prev.row === next.row &&
    prev.raw === next.raw &&
    prev.index === next.index &&
    prev.year === next.year &&
    prev.throughDateKey === next.throughDateKey &&
    prev.monthValues === next.monthValues &&
    prev.canManage === next.canManage &&
    prev.adjustmentSaving === next.adjustmentSaving &&
    prev.onAdjustmentSave === next.onAdjustmentSave &&
    prev.attendanceUsageReady === next.attendanceUsageReady &&
    prev.attendanceAccrualReady === next.attendanceAccrualReady
  );
}

export default memo(AnnualLeaveManagerTableRow, areAnnualLeaveManagerTableRowPropsEqual);
