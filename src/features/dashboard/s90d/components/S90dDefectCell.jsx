import { formatS90dDefectQty, formatS90dQtyCell, isHighDefectCell } from "../lib/s90dDisplayUtils";
import S90dDefectCellEditor from "./S90dDefectCellEditor";
import S90dDefectImageThumbs from "./S90dDefectImageThumbs";

export default function S90dDefectCell({
  qty,
  imageUrl = "",
  defectKey,
  isPercent,
  highlight,
  totalNgQty,
  useDash,
  editable = false,
  onQtyChange,
}) {
  const showPink = !isPercent && isHighDefectCell(qty, totalNgQty);
  const className = [
    "s90d-num",
    "s90d-defect-cell",
    highlight || showPink ? "s90d-cell-alert" : "",
    isPercent ? "s90d-cell-percent" : "",
    editable && !isPercent ? "s90d-defect-cell--editable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (editable && !isPercent) {
    return (
      <S90dDefectCellEditor
        qty={qty}
        onQtyChange={onQtyChange}
        className={className}
      />
    );
  }

  const display = useDash
    ? formatS90dDefectQty(qty, isPercent)
    : formatS90dQtyCell(qty, isPercent, false);
  return (
    <td className={className}>
      <div className="s90d-defect-cell-display">
        <span>{display}</span>
        <S90dDefectImageThumbs
          imageMap={{ [defectKey]: imageUrl }}
          defectKey={defectKey}
          isPercent={isPercent}
        />
      </div>
    </td>
  );
}
