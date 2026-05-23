import React, { memo } from "react";
import { getAttendanceColWidthPercents } from "./gridLayout";

function AttendanceTableColgroup({
  showRowModalActions,
  columnPlan = "full",
  tableVariant = "attendance",
}) {
  const widths = getAttendanceColWidthPercents(
    showRowModalActions,
    columnPlan,
    tableVariant,
  );
  return (
    <colgroup>
      {widths.map((w, i) => (
        <col key={i} style={{ width: `${w}%` }} />
      ))}
    </colgroup>
  );
}

export default memo(AttendanceTableColgroup);
