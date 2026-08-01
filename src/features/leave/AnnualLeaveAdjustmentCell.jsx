import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import {
  formatAnnualLeaveDecimal,
  parseAnnualLeaveAdjustment,
} from "./annualLeaveCalculated";

function formatAdjustmentDraft(value) {
  const n = parseAnnualLeaveAdjustment(value);
  if (n === 0) return "";
  return formatAnnualLeaveDecimal(n);
}

function AnnualLeaveAdjustmentCell({
  row,
  raw,
  saving = false,
  onSave,
}) {
  const { t } = useTranslation();
  const stored = row?.[ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_ADJUSTMENT];
  const [draft, setDraft] = useState(() => formatAdjustmentDraft(stored));

  useEffect(() => {
    setDraft(formatAdjustmentDraft(stored));
  }, [stored, row?.id]);

  const dirty = useMemo(() => {
    return (
      parseAnnualLeaveAdjustment(draft) !== parseAnnualLeaveAdjustment(stored)
    );
  }, [draft, stored]);

  const handleCancel = useCallback(() => {
    setDraft(formatAdjustmentDraft(stored));
  }, [stored]);

  const handleSave = useCallback(async () => {
    if (!dirty || saving) return;
    await onSave?.(row?.id, parseAnnualLeaveAdjustment(draft), raw);
  }, [dirty, draft, onSave, raw, row?.id, saving]);

  return (
    <div className="annual-leave-adjustment-cell">
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        disabled={saving}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && dirty) {
            event.preventDefault();
            void handleSave();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            handleCancel();
          }
        }}
        className="annual-leave-adjustment-input rounded border border-violet-300/80 bg-white text-center font-semibold tabular-nums text-black outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-400 disabled:opacity-60 dark:border-violet-700 dark:bg-slate-900 dark:text-slate-100"
        title={t("annualLeave.adjustmentHint", {
          defaultValue:
            "Nhập +1 hoặc -1 để cộng/trừ phép năm hiện tại.",
        })}
        aria-label={t("annualLeave.adjustmentColumn", {
          defaultValue: "Điều chỉnh phép năm",
        })}
      />
      {dirty ? (
        <div className="annual-leave-adjustment-actions">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="annual-leave-adjustment-btn annual-leave-adjustment-btn-save"
            title={t("annualLeave.adjustmentSave", { defaultValue: "Lưu" })}
            aria-label={t("annualLeave.adjustmentSave", { defaultValue: "Lưu" })}
          >
            ✓
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleCancel}
            className="annual-leave-adjustment-btn annual-leave-adjustment-btn-cancel"
            title={t("annualLeave.adjustmentCancel", {
              defaultValue: "Hủy",
            })}
            aria-label={t("annualLeave.adjustmentCancel", {
              defaultValue: "Hủy",
            })}
          >
            ✕
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default memo(AnnualLeaveAdjustmentCell);
