import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import AttendanceFormImageUploadField from "@/features/attendance/AttendanceFormImageUploadField";
import { useProductionReportContext } from "../../productionReport/ProductionReportContext";
import { useReportT } from "../../productionReport/useReportTranslation";
import { S90D_DEFECT_IMAGE_FIELD_PREFIX } from "../lib/s90dDefectImages";

export default function S90dDefectCellEditor({
  qty,
  imageUrl = "",
  defectKey,
  dateKey = "",
  boardId = "",
  process = "",
  shiftSlot = "",
  onQtyChange,
  onImageChange,
  className = "",
}) {
  const { t } = useTranslation();
  const rt = useReportT();
  const { buildDefectImageUploadPrefix } = useProductionReportContext();
  const tl = useCallback(
    (key, defaultValue, options = {}) => {
      if (key === "imgbbChooseImage") {
        return rt("defectUploadImage", "Ảnh", options);
      }
      if (key === "imgbbViewImage") {
        return rt("defectViewImage", "Xem", options);
      }
      if (key === "imgbbRemoveImage") {
        return rt("defectRemoveImage", "Xóa", options);
      }
      if (key.startsWith("imgbb")) {
        return rt(key, defaultValue, options);
      }
      return t(`attendanceList.${key}`, { defaultValue, ...options });
    },
    [rt, t],
  );

  const url = String(imageUrl ?? "").trim();

  return (
    <td className={className}>
      <div className="s90d-defect-cell-editor">
        <input
          type="number"
          min="0"
          step="1"
          className="s90d-cell-input s90d-cell-input--defect"
          value={qty || ""}
          onChange={(e) => onQtyChange?.(e.target.value)}
        />
        <AttendanceFormImageUploadField
          hideLabel
          compact
          hidePreview
          hideEmptyHint
          className="s90d-defect-img-upload"
          value={url}
          onChange={(uploadedUrl) =>
            onImageChange?.(
              `${S90D_DEFECT_IMAGE_FIELD_PREFIX}${defectKey}`,
              uploadedUrl,
            )
          }
          uploadNamePrefix={buildDefectImageUploadPrefix({
            dateKey,
            boardId,
            process,
            shiftSlot,
            defectKey,
          })}
          tl={tl}
        />
      </div>
    </td>
  );
}
