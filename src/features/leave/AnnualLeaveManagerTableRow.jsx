import { memo } from "react";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import {
  formatAnnualLeaveDecimal,
  formatAnnualLeaveDisplayDate,
} from "./annualLeaveCalculated";

function AnnualLeaveManagerTableRow({
  row,
  index,
  viewDetailLabel,
  viewUsageTitle,
  onViewDetail,
}) {
  return (
    <tr>
      <td className="annual-leave-col-no">{row.rowNo ?? index + 1}</td>
      <td className="annual-leave-col-code">
        {row[ANNUAL_LEAVE_EMP.MNV_PREFIX]}
      </td>
      <td className="annual-leave-col-code">
        {row[ANNUAL_LEAVE_EMP.MNV_SUFFIX]}
      </td>
      <td className="annual-leave-name">{row[ANNUAL_LEAVE_EMP.FULL_NAME]}</td>
      <td className="annual-leave-col-date">
        {formatAnnualLeaveDisplayDate(row[ANNUAL_LEAVE_EMP.DATE_OF_BIRTH])}
      </td>
      <td className="annual-leave-dept">
        {row[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT]}
      </td>
      <td className="annual-leave-col-date">
        {formatAnnualLeaveDisplayDate(row[ANNUAL_LEAVE_EMP.START_WORKING_DATE], {
          fullYear: true,
        })}
      </td>
      <td className="annual-leave-col-num">
        {row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]}
      </td>
      <td className="annual-leave-dash">
        {row[ANNUAL_LEAVE_EMP.BONUS_ANNUAL_LEAVE_ENV]
          ? row[ANNUAL_LEAVE_EMP.BONUS_ANNUAL_LEAVE_ENV]
          : "-"}
      </td>
      <td className="annual-leave-dash">
        {row[ANNUAL_LEAVE_EMP.COMPENSATORY_DAY_OFF]
          ? row[ANNUAL_LEAVE_EMP.COMPENSATORY_DAY_OFF]
          : "-"}
      </td>
      <td className="annual-leave-col-num annual-leave-total">
        {formatAnnualLeaveDecimal(row[ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE])}
      </td>
      <td className="annual-leave-col-num annual-leave-used">
        {formatAnnualLeaveDecimal(row[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED])}
      </td>
      <td className="annual-leave-balance">
        {formatAnnualLeaveDecimal(row[ANNUAL_LEAVE_EMP.BALANCE])}
      </td>
      <td className="annual-leave-col-detail">
        <button
          type="button"
          className="annual-leave-detail-btn"
          onClick={() => onViewDetail(row)}
          title={viewUsageTitle}
        >
          {viewDetailLabel}
        </button>
      </td>
    </tr>
  );
}

export default memo(AnnualLeaveManagerTableRow);
