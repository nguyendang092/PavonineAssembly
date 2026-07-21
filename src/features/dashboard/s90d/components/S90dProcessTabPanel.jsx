import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import S90dProcessShiftTable from "./S90dProcessShiftTable";
import { buildProcessShiftSummaryFromManual } from "../lib/buildS90dFromManual";
import {
  clampDateKeyToMonth,
  formatS90dDailyDateLabel,
  formatS90dPickerDateLabel,
  pickDefaultDateKey,
} from "../lib/s90dDateUtils";
import {
  addProcessMonthBoard,
  createEmptyDayProcessEntry,
  removeProcessMonthBoard,
  resolveProcessBoards,
  updateProcessMonthProductCode,
  updateProcessMonthShiftField,
} from "../lib/s90dManualEntries";

export default function S90dProcessTabPanel({
  process,
  monthDayKeys,
  storeRevision = 0,
  getProcessEntry,
  onSave,
  saving = false,
}) {
  const { t } = useTranslation();
  const [localByDate, setLocalByDate] = useState({});
  const [isDirty, setIsDirty] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    pickDefaultDateKey(monthDayKeys),
  );

  const processLabel = t(`areas.${process}`, { defaultValue: process });
  const monthMinDate = monthDayKeys[0] ?? "";
  const monthMaxDate = monthDayKeys[monthDayKeys.length - 1] ?? "";
  const selectedDateIndex = monthDayKeys.indexOf(selectedDateKey);

  useEffect(() => {
    const slice = Object.fromEntries(
      monthDayKeys.map((dateKey) => [dateKey, getProcessEntry(dateKey, process)]),
    );
    setLocalByDate(slice);
    setIsDirty(false);
  }, [process, monthDayKeys, storeRevision, getProcessEntry]);

  useEffect(() => {
    setSelectedDateKey((prev) => clampDateKeyToMonth(prev, monthDayKeys));
  }, [monthDayKeys]);

  const selectedDayEntry = localByDate[selectedDateKey] ?? createEmptyDayProcessEntry();
  const selectedBoards = useMemo(
    () => resolveProcessBoards(selectedDayEntry),
    [selectedDayEntry],
  );

  const boardSummaries = useMemo(
    () =>
      selectedBoards.map((board) => ({
        board,
        summary: buildProcessShiftSummaryFromManual({
          boardEntry: board,
          process,
          dateLabel: formatS90dDailyDateLabel(selectedDateKey),
        }),
      })),
    [process, selectedBoards, selectedDateKey],
  );

  const updateProductCode = useCallback((boardId, productCode) => {
    setIsDirty(true);
    setLocalByDate((prev) =>
      updateProcessMonthProductCode(prev, selectedDateKey, boardId, productCode),
    );
  }, [selectedDateKey]);

  const updateShiftField = useCallback(
    (boardId, shiftSlot, field, value) => {
      setIsDirty(true);
      setLocalByDate((prev) =>
        updateProcessMonthShiftField(
          prev,
          selectedDateKey,
          process,
          boardId,
          shiftSlot,
          field,
          value,
        ),
      );
    },
    [process, selectedDateKey],
  );

  const handleAddBoard = useCallback(() => {
    setIsDirty(true);
    setLocalByDate((prev) =>
      addProcessMonthBoard(
        prev,
        selectedDateKey,
        t("s90dReport.boardLabelN", "Bảng {{n}}", {
          n: resolveProcessBoards(prev[selectedDateKey]).length + 1,
        }),
      ),
    );
  }, [selectedDateKey, t]);

  const handleRemoveBoard = useCallback(
    (boardId) => {
      if (selectedBoards.length <= 1) return;
      setIsDirty(true);
      setLocalByDate((prev) =>
        removeProcessMonthBoard(prev, selectedDateKey, boardId),
      );
    },
    [selectedBoards.length, selectedDateKey],
  );

  const handleSave = useCallback(async () => {
    if (!isDirty || saving) return;
    try {
      await onSave?.(localByDate);
      setIsDirty(false);
    } catch {
      // Giữ trạng thái chưa lưu nếu Firebase lỗi.
    }
  }, [isDirty, saving, localByDate, onSave]);

  const goToAdjacentDay = useCallback(
    (direction) => {
      if (selectedDateIndex < 0) return;
      const nextIndex = selectedDateIndex + direction;
      if (nextIndex < 0 || nextIndex >= monthDayKeys.length) return;
      setSelectedDateKey(monthDayKeys[nextIndex]);
    },
    [monthDayKeys, selectedDateIndex],
  );

  return (
    <section
      className="s90d-report-section"
      role="tabpanel"
      aria-label={processLabel}
    >
      <div className="s90d-process-toolbar dashboard-no-print">
        <label className="s90d-process-date-field">
          {t("s90dReport.processDateFilter", "Chọn ngày")}
          <input
            type="date"
            className="s90d-process-date-input"
            value={selectedDateKey}
            min={monthMinDate}
            max={monthMaxDate}
            onChange={(e) =>
              setSelectedDateKey(clampDateKeyToMonth(e.target.value, monthDayKeys))
            }
          />
        </label>

        <div className="s90d-process-date-nav">
          <button
            type="button"
            className="s90d-process-date-nav-btn"
            disabled={selectedDateIndex <= 0}
            onClick={() => goToAdjacentDay(-1)}
            aria-label={t("s90dReport.processPrevDay", "Ngày trước")}
          >
            ‹
          </button>
          <span className="s90d-process-date-label">
            {formatS90dPickerDateLabel(selectedDateKey)}
            {monthDayKeys.length > 0
              ? ` (${selectedDateIndex + 1}/${monthDayKeys.length})`
              : ""}
          </span>
          <button
            type="button"
            className="s90d-process-date-nav-btn"
            disabled={
              selectedDateIndex < 0 || selectedDateIndex >= monthDayKeys.length - 1
            }
            onClick={() => goToAdjacentDay(1)}
            aria-label={t("s90dReport.processNextDay", "Ngày sau")}
          >
            ›
          </button>
        </div>

        <button
          type="button"
          className="s90d-add-board-btn"
          onClick={handleAddBoard}
        >
          {t("s90dReport.addBoard", "Thêm bảng")}
        </button>

        <button
          type="button"
          className={`s90d-save-btn${isDirty ? " s90d-save-btn--dirty" : ""}`}
          disabled={!isDirty || saving}
          onClick={handleSave}
        >
          {saving
            ? t("s90dReport.savingManual", "Đang lưu…")
            : t("s90dReport.saveManual", "Lưu")}
        </button>
      </div>

      <div className="s90d-daily-grid">
        {boardSummaries.map(({ board, summary }, index) => (
          <div
            key={board.id}
            className="s90d-daily-card"
            id={`s90d-${process.toLowerCase()}-${selectedDateKey}-${board.id}`}
          >
            <S90dProcessShiftTable
              processSummary={summary}
              dateKey={selectedDateKey}
              boardId={board.id}
              boardLabel={
                board.label ||
                t("s90dReport.boardLabelN", "Bảng {{n}}", { n: index + 1 })
              }
              boardIndex={index + 1}
              boardCount={selectedBoards.length}
              editable
              onProductCodeChange={(productCode) =>
                updateProductCode(board.id, productCode)
              }
              onShiftFieldChange={(shiftSlot, field, value) =>
                updateShiftField(board.id, shiftSlot, field, value)
              }
              onRemoveBoard={
                selectedBoards.length > 1
                  ? () => handleRemoveBoard(board.id)
                  : undefined
              }
            />
          </div>
        ))}
      </div>
    </section>
  );
}
