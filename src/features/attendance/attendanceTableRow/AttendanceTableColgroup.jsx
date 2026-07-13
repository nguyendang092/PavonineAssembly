import React, { memo } from "react";
import { getAttendanceColWidthPercents } from "./gridLayout";

function AttendanceTableColgroup({
  showRowModalActions,
  columnPlan = "full",
  tableVariant = "attendance",
  layoutOptions = {},
}) {
  const widths = getAttendanceColWidthPercents(
    showRowModalActions,
    columnPlan,
    tableVariant,
    layoutOptions,
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
