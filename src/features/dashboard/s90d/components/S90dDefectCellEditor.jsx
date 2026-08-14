import React from "react";

export default function S90dDefectCellEditor({
  qty,
  onQtyChange,
  className = "",
}) {
  return (
    <td className={className}>
      <input
        type="number"
        min="0"
        step="1"
        className="s90d-cell-input s90d-cell-input--defect"
        value={qty || ""}
        onChange={(e) => onQtyChange?.(e.target.value)}
      />
    </td>
  );
}
