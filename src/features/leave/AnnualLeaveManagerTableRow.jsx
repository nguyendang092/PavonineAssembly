import { memo } from "react";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import {
  formatAnnualLeaveDecimal,
  formatAnnualLeaveDisplayDate,
} from "./annualLeaveCalculated";
import AnnualLeaveUsageDetailTrigger from "./AnnualLeaveUsageDetailTrigger";
import AnnualLeaveAdjustmentCell from "./AnnualLeaveAdjustmentCell";
import {
  annualLeaveStickyColClass,
  annualLeaveTableRowClass,
} from "./annualLeaveTableStyles";

const tdNum =
  "px-1 md:px-1.5 py-px text-[11px] md:text-sm text-center font-semibold tabular-nums text-black dark:text-slate-200";

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
}) {
  const sticky = (colIndex) =>
    annualLeaveStickyColClass(colIndex, { rowIndex: index });

  return (
    <tr className={annualLeaveTableRowClass(index)}>
      <td className={`px-1 md:px-1.5 py-px text-[11px] md:text-sm text-center font-bold text-black dark:text-slate-200 ${sticky(0)}`}>
        {row.rowNo ?? index + 1}
      </td>
      <td className={`px-1 md:px-1.5 py-px text-[11px] md:text-sm text-center font-bold text-black whitespace-nowrap dark:text-slate-200 ${sticky(1)}`}>
        {row[ANNUAL_LEAVE_EMP.MNV_PREFIX]}
      </td>
      <td className={`px-1 md:px-1.5 py-px text-[11px] md:text-sm text-center font-semibold text-black dark:text-slate-200 ${sticky(2)}`}>
        {row[ANNUAL_LEAVE_EMP.MNV_SUFFIX]}
      </td>
      <td
        className={`px-1 md:px-2 py-px text-[11px] md:text-sm text-center font-bold text-black leading-tight dark:text-slate-100 ${sticky(3)}`}
      >
        {row[ANNUAL_LEAVE_EMP.FULL_NAME]}
      </td>
      <td className={`${tdNum} ${sticky(4)}`}>
        {formatAnnualLeaveDisplayDate(row[ANNUAL_LEAVE_EMP.DATE_OF_BIRTH])}
      </td>
      <td
        className={`px-1 md:px-1.5 py-px text-[11px] md:text-sm text-center font-semibold text-black dark:text-slate-200 ${sticky(5)}`}
      >
        {row[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT]}
      </td>
      <td className={`${tdNum} ${sticky(6)}`}>
        {formatAnnualLeaveDisplayDate(row[ANNUAL_LEAVE_EMP.START_WORKING_DATE], {
          fullYear: true,
        })}
      </td>
      <td className={`${tdNum} ${sticky(7)}`}>
        {row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]}
      </td>
      <td className={`${tdNum} font-bold ${sticky(8)}`}>
        {formatAnnualLeaveDecimal(row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED])}
      </td>
      <td className={`${tdNum} font-bold ${sticky(9)}`}>
        {formatAnnualLeaveDecimal(row[ANNUAL_LEAVE_EMP.BALANCE])}
      </td>
      {monthValues.map((value, monthIdx) => (
        <td
          key={monthIdx}
          className={`${tdNum} annual-leave-month-cell min-w-[4.25rem] whitespace-nowrap${
            hasAnnualLeaveMonthUsage(value)
              ? " annual-leave-month-cell-used"
              : ""
          }`}
        >
          {hasAnnualLeaveMonthUsage(value) ? (
            formatAnnualLeaveDecimal(value)
          ) : (
            <span className="annual-leave-month-empty" aria-hidden="true">
              -
            </span>
          )}
        </td>
      ))}
      {canManage ? (
        <td className="px-1 md:px-1.5 py-px text-center">
          <AnnualLeaveAdjustmentCell
            row={row}
            raw={raw}
            saving={adjustmentSaving}
            onSave={onAdjustmentSave}
          />
        </td>
      ) : null}
      <td className="px-1 md:px-1.5 py-px text-center">
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
    prev.onAdjustmentSave === next.onAdjustmentSave
  );
}

export default memo(AnnualLeaveManagerTableRow, areAnnualLeaveManagerTableRowPropsEqual);
