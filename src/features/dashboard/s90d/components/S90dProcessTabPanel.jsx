import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useProductionReportContext } from "../../productionReport/ProductionReportContext";
import { useReportT } from "../../productionReport/useReportTranslation";
import S90dProcessShiftTable from "./S90dProcessShiftTable";
import { buildProcessShiftSummaryFromManual } from "../lib/buildS90dFromManual";
import {
  clampDateKeyToMonth,
  formatS90dDailyDateLabel,
  formatS90dPickerDateLabel,
  pickDefaultDateKey,
} from "../lib/s90dDateUtils";
import {
  createEmptyProcessDayEntry,
  resolveProcessBoards,
  updateProcessMonthShiftField,
} from "../lib/s90dManualEntries";
import { filterSpecsBySummaryViewGroup } from "../lib/s90dManualEntryReportConfig";
import { useS90dInputCellNav } from "./useS90dInputCellNav";

const ProcessBoardCard = memo(function ProcessBoardCard({
  board,
  summary,
  process,
  selectedDateKey,
  boardIndex,
  boardCount,
  onShiftFieldChange,
}) {
  return (
    <div
      className="s90d-daily-card"
      id={`s90d-${process.toLowerCase()}-${selectedDateKey}-${board.id}`}
    >
      <S90dProcessShiftTable
        processSummary={summary}
        dateKey={selectedDateKey}
        boardLabel={board.label || board.productCode}
        boardIndex={boardIndex}
        boardCount={boardCount}
        editable
        onShiftFieldChange={onShiftFieldChange}
      />
    </div>
  );
});

export default function S90dProcessTabPanel({
  process,
  monthKey,
  monthDayKeys,
  processSyncRevision = 0,
  getProcessEntry,
  onSave,
  saving = false,
  saveProcessDraft,
  loadProcessDraft,
  clearProcessDraft,
  viewGroup = "",
  onDirtyChange,
  saveRef,
}) {
  const { t } = useTranslation();
  const rt = useReportT();
  const { defaultProductCode, usesFixedBoardSpecs = false } =
    useProductionReportContext();
  const [localByDate, setLocalByDate] = useState({});
  const [isDirty, setIsDirty] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    pickDefaultDateKey(monthDayKeys),
  );
  const navRootRef = useRef(null);
  const dirtyDateKeysRef = useRef(new Set());
  useS90dInputCellNav(navRootRef);

  const processLabel = t(`areas.${process}`, { defaultValue: process });
  const monthMinDate = monthDayKeys[0] ?? "";
  const monthMaxDate = monthDayKeys[monthDayKeys.length - 1] ?? "";
  const selectedDateIndex = monthDayKeys.indexOf(selectedDateKey);

  const hydrateDayEntry = useCallback(
    (dateKey) => {
      const entry = getProcessEntry(dateKey, process);
      if (usesFixedBoardSpecs) {
        return {
          boards: resolveProcessBoards(entry, process, defaultProductCode),
        };
      }

      return {
        boards: resolveProcessBoards(entry, process, defaultProductCode).map(
          (board) => ({
            ...board,
            productCode:
              String(board.productCode ?? "").trim() === "S90D"
                ? defaultProductCode
                : board.productCode,
          }),
        ),
      };
    },
    [defaultProductCode, getProcessEntry, process, usesFixedBoardSpecs],
  );

  useEffect(() => {
    const draft = loadProcessDraft?.(process, monthKey);
    if (draft?.localByDate && Object.keys(draft.localByDate).length) {
      setLocalByDate(draft.localByDate);
      setSelectedDateKey(
        draft.selectedDateKey || pickDefaultDateKey(monthDayKeys),
      );
      dirtyDateKeysRef.current = new Set(Object.keys(draft.localByDate));
      setIsDirty(true);
      return;
    }

    dirtyDateKeysRef.current = new Set();
    setLocalByDate({});
    setIsDirty(false);
    setSelectedDateKey(pickDefaultDateKey(monthDayKeys));
  }, [loadProcessDraft, monthDayKeys, monthKey, process]);

  useEffect(() => {
    setLocalByDate((prev) => {
      if (isDirty && prev[selectedDateKey]) return prev;
      return {
        ...prev,
        [selectedDateKey]: hydrateDayEntry(selectedDateKey),
      };
    });
  }, [hydrateDayEntry, isDirty, processSyncRevision, selectedDateKey]);

  useEffect(() => {
    setSelectedDateKey((prev) => clampDateKeyToMonth(prev, monthDayKeys));
  }, [monthDayKeys]);

  useEffect(() => {
    if (!isDirty || !saveProcessDraft) return undefined;

    const timer = window.setTimeout(() => {
      saveProcessDraft(process, monthKey, {
        localByDate,
        selectedDateKey,
        savedAt: Date.now(),
      });
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [
    isDirty,
    localByDate,
    monthKey,
    process,
    saveProcessDraft,
    selectedDateKey,
  ]);

  const selectedDayEntry =
    localByDate[selectedDateKey] ??
    createEmptyProcessDayEntry(process, defaultProductCode);
  const selectedBoards = useMemo(
    () => resolveProcessBoards(selectedDayEntry, process, defaultProductCode),
    [defaultProductCode, process, selectedDayEntry],
  );

  const visibleBoards = useMemo(
    () => filterSpecsBySummaryViewGroup(selectedBoards, viewGroup),
    [selectedBoards, viewGroup],
  );

  const boardSummaries = useMemo(
    () =>
      visibleBoards.map((board) => ({
        board,
        summary: buildProcessShiftSummaryFromManual({
          boardEntry: board,
          process,
          dateLabel: formatS90dDailyDateLabel(selectedDateKey),
        }),
      })),
    [process, visibleBoards, selectedDateKey],
  );

  const updateShiftField = useCallback(
    (boardId, shiftSlot, field, value) => {
      setIsDirty(true);
      dirtyDateKeysRef.current.add(selectedDateKey);
      setLocalByDate((prev) =>
        updateProcessMonthShiftField(
          prev,
          selectedDateKey,
          process,
          boardId,
          shiftSlot,
          field,
          value,
          defaultProductCode,
        ),
      );
    },
    [defaultProductCode, process, selectedDateKey],
  );

  const shiftHandlers = useMemo(() => {
    const handlers = new Map();
    for (const board of visibleBoards) {
      handlers.set(board.id, (shiftSlot, field, value) => {
        updateShiftField(board.id, shiftSlot, field, value);
      });
    }
    return handlers;
  }, [updateShiftField, visibleBoards]);

  const handleSave = useCallback(async () => {
    if (!isDirty || saving) return;
    const payload = {};
    for (const dateKey of dirtyDateKeysRef.current) {
      if (localByDate[dateKey] !== undefined) {
        payload[dateKey] = localByDate[dateKey];
      }
    }
    const toSave = Object.keys(payload).length ? payload : localByDate;
    try {
      await onSave?.(toSave);
      dirtyDateKeysRef.current = new Set();
      setIsDirty(false);
      clearProcessDraft?.(process, monthKey);
    } catch {
      // Giữ trạng thái chưa lưu nếu Firebase lỗi.
    }
  }, [clearProcessDraft, isDirty, localByDate, monthKey, onSave, process, saving]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    return () => onDirtyChange?.(false);
  }, [onDirtyChange]);

  useEffect(() => {
    if (!saveRef) return undefined;
    saveRef.current = handleSave;
    return () => {
      saveRef.current = null;
    };
  }, [handleSave, saveRef]);

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
      ref={navRootRef}
      className="s90d-report-section"
      role="tabpanel"
      aria-label={processLabel}
    >
      <div className="s90d-process-toolbar dashboard-no-print">
        <label className="s90d-process-date-field">
          {rt("processDateFilter", "Chọn ngày")}
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
            aria-label={rt("processPrevDay", "Ngày trước")}
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
            aria-label={rt("processNextDay", "Ngày sau")}
          >
            ›
          </button>
        </div>
      </div>

      <div className="s90d-daily-grid">
        {boardSummaries.map(({ board, summary }, index) => (
          <ProcessBoardCard
            key={board.id}
            board={board}
            summary={summary}
            process={process}
            selectedDateKey={selectedDateKey}
            boardIndex={index + 1}
            boardCount={visibleBoards.length}
            onShiftFieldChange={shiftHandlers.get(board.id)}
          />
        ))}
      </div>
    </section>
  );
}
