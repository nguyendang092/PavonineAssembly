import { memo } from "react";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import {
  formatAnnualLeaveDecimal,
  formatAnnualLeaveDisplayDate,
} from "./annualLeaveCalculated";
import AnnualLeaveUsageDetailTrigger from "./AnnualLeaveUsageDetailTrigger";
import { annualLeaveTableRowClass } from "./annualLeaveTableStyles";

const tdNum =
  "px-1 md:px-1.5 py-px text-[11px] md:text-sm text-center font-semibold tabular-nums text-gray-700 dark:text-slate-200";

function AnnualLeaveManagerTableRow({
  row,
  index,
  year,
  throughDateKey,
}) {
  return (
    <tr className={annualLeaveTableRowClass(index)}>
      <td className="px-1 md:px-1.5 py-px text-xs md:text-sm text-center font-bold text-gray-700 dark:text-slate-200">
        {row.rowNo ?? index + 1}
      </td>
      <td className="px-1 md:px-1.5 py-px text-[11px] md:text-sm text-center font-bold text-blue-600 whitespace-nowrap dark:text-blue-400">
        {row[ANNUAL_LEAVE_EMP.MNV_PREFIX]}
      </td>
      <td className="px-1 md:px-1.5 py-px text-sm text-center font-semibold text-gray-700 dark:text-slate-200">
        {row[ANNUAL_LEAVE_EMP.MNV_SUFFIX]}
      </td>
      <td
        className="px-1 md:px-2 py-px text-[11px] md:text-sm text-left md:text-center font-bold text-gray-800 leading-tight dark:text-slate-100"
        title={String(row[ANNUAL_LEAVE_EMP.FULL_NAME] ?? "")}
      >
        {row[ANNUAL_LEAVE_EMP.FULL_NAME]}
      </td>
      <td className={tdNum}>
        {formatAnnualLeaveDisplayDate(row[ANNUAL_LEAVE_EMP.DATE_OF_BIRTH])}
      </td>
      <td
        className="px-1 md:px-1.5 py-px text-[11px] md:text-sm text-center font-semibold text-gray-700 dark:text-slate-200"
        title={String(row[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT] ?? "")}
      >
        <span className="block min-w-0 truncate">
          {row[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT]}
        </span>
      </td>
      <td className={tdNum}>
        {formatAnnualLeaveDisplayDate(row[ANNUAL_LEAVE_EMP.START_WORKING_DATE], {
          fullYear: true,
        })}
      </td>
      <td className={tdNum}>
        {row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]}
      </td>
      <td className="px-1 md:px-1.5 py-px text-[11px] md:text-sm text-center font-semibold text-gray-500 tabular-nums dark:text-slate-400">
        {row[ANNUAL_LEAVE_EMP.BONUS_ANNUAL_LEAVE_ENV]
          ? row[ANNUAL_LEAVE_EMP.BONUS_ANNUAL_LEAVE_ENV]
          : "—"}
      </td>
      <td className="px-1 md:px-1.5 py-px text-[11px] md:text-sm text-center font-semibold text-gray-500 tabular-nums dark:text-slate-400">
        {row[ANNUAL_LEAVE_EMP.COMPENSATORY_DAY_OFF]
          ? row[ANNUAL_LEAVE_EMP.COMPENSATORY_DAY_OFF]
          : "—"}
      </td>
      <td className={`${tdNum} font-bold`}>
        {formatAnnualLeaveDecimal(row[ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE])}
      </td>
      <td className={`${tdNum} font-bold text-sky-700 dark:text-sky-300`}>
        {formatAnnualLeaveDecimal(row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED])}
      </td>
      <td className={`${tdNum} font-bold`}>
        {formatAnnualLeaveDecimal(row[ANNUAL_LEAVE_EMP.BALANCE])}
      </td>
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

export default memo(AnnualLeaveManagerTableRow);
