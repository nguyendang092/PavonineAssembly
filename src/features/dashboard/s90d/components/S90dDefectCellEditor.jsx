import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import AttendanceFormImageUploadField from "@/features/attendance/AttendanceFormImageUploadField";
import { S90D_DEFECT_IMAGE_FIELD_PREFIX } from "../lib/s90dDefectImages";
import { buildS90dDefectImageUploadPrefix } from "../lib/s90dManualEntriesFirebase";

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
  const tl = useCallback(
    (key, defaultValue, options = {}) => {
      if (key === "imgbbChooseImage") {
        return t("s90dReport.defectUploadImage", "Ảnh", options);
      }
      if (key === "imgbbViewImage") {
        return t("s90dReport.defectViewImage", "Xem", options);
      }
      if (key === "imgbbRemoveImage") {
        return t("s90dReport.defectRemoveImage", "Xóa", options);
      }
      return t(`attendanceList.${key}`, { defaultValue, ...options });
    },
    [t],
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
          uploadNamePrefix={buildS90dDefectImageUploadPrefix({
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
