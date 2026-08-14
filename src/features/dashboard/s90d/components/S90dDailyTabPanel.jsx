import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { FiDownload } from "react-icons/fi";
import { useTranslation } from "react-i18next";import { useProductionReportContext } from "../../productionReport/ProductionReportContext";
import { useReportT } from "../../productionReport/useReportTranslation";
import {
  buildMonthDailyRollup,
  pickDefaultDailyDateKey,
  resolveNgRateTone,
} from "../lib/buildS90dDailyRollup";
import {
  formatS90dDailyNg,
  formatS90dDailyPct,
  formatS90dDailyQty,
} from "../lib/buildS90dDailySummary";
import { formatShortDateLabel } from "../lib/s90dDisplayUtils";
import { S90D_DEFECT_COLUMNS } from "../lib/s90dDefectColumns";
import S90dBilingualHeader from "./S90dBilingualHeader";
import S90dKpiCards from "./S90dKpiCards";

function formatQty(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function formatPct(value) {
  if (value == null || value === "") return "0%";
  return `${Number(value).toLocaleString("vi-VN")}%`;
}

function sanitizeExportSegment(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function buildBoardExportFilename({
  reportCode,
  isTotalView,
  selectedDateKey,
  monthDisplayLabel,
  productCode,
}) {
  const prefix = sanitizeExportSegment(reportCode) || "S90D";
  const code = sanitizeExportSegment(productCode) || prefix;
  if (isTotalView) {
    const month = sanitizeExportSegment(monthDisplayLabel) || "Thang";
    return `${prefix}_Tong_${month}_${code}.png`;
  }
  const date = sanitizeExportSegment(selectedDateKey) || "Ngay";
  return `${prefix}_${date}_${code}.png`;
}

function NgRatePill({ value, emphasize = false }) {
  const tone = resolveNgRateTone(value);
  return (
    <span
      className={`s90d-daily-ng-pill s90d-daily-ng-pill--${tone}${
        emphasize ? " s90d-daily-ng-pill--emphasis" : ""
      }`}
    >
      {formatPct(value)}
    </span>
  );
}

function S90dDailyMonthStats({ rollup }) {
  const rt = useReportT();
  const { t } = useTranslation();

  return (
    <div className="s90d-daily-month-stats">
      <article className="s90d-daily-stat-card s90d-daily-stat-card--total">
        <p className="s90d-daily-stat-label">
          {rt("dailyMonthCumulative", "Lũy kế tháng")}
        </p>
        <p className="s90d-daily-stat-value">{formatQty(rollup.monthTotalQty)}</p>
        <p className="s90d-daily-stat-hint">
          {rt("dailyMonthActiveDays", "{{count}} ngày đã nhập", {
            count: rollup.activeDays,
          })}
        </p>
      </article>

      <article className="s90d-daily-stat-card s90d-daily-stat-card--ng">
        <p className="s90d-daily-stat-label">
          {rt("dailyMonthNgTotal", "Tổng NG lũy kế")}
        </p>
        <p className="s90d-daily-stat-value s90d-daily-stat-value--ng">
          {formatQty(rollup.monthNgQty)}
        </p>
        <p className="s90d-daily-stat-hint">
          {rt("dailyMonthTopNgLine", "Line NG nhiều nhất: {{process}}", {
            process: t(`areas.${rollup.topNgProcess}`, {
              defaultValue: rollup.topNgProcess,
            }),
          })}
        </p>
      </article>

      <article className="s90d-daily-stat-card s90d-daily-stat-card--rate">
        <p className="s90d-daily-stat-label">
          {rt("dailyMonthAvgNgRate", "Tỷ lệ NG bình quân")}
        </p>
        <p className="s90d-daily-stat-value s90d-daily-stat-value--rate">
          {formatPct(rollup.avgNgRate)}
        </p>
        <p className="s90d-daily-stat-hint">
          {rt("dailyMonthNgTarget", "Mục tiêu < {{target}}%", {
            target: rollup.ngTargetPct.toLocaleString("vi-VN"),
          })}
        </p>
      </article>
    </div>
  );
}

function S90dDailyDateStrip({ monthDailySummaries, selectedDateKey, onSelect }) {
  const rt = useReportT();

  return (
    <div className="s90d-daily-date-strip-wrap">
      <div className="s90d-daily-date-strip-head">
        <p className="s90d-daily-date-strip-label">
          {rt("dailyPickDateLabel", "Chọn ngày xem chi tiết")}
        </p>
        <p className="s90d-daily-date-strip-legend">
          {rt("dailyDateColorLegend", "Màu = tỷ lệ NG trong ngày đó")}
        </p>
      </div>

      <div className="s90d-daily-date-strip" role="listbox" aria-label={rt("dailyPickDateLabel", "Chọn ngày xem chi tiết")}>
        {monthDailySummaries.map((daily) => {
          const ngRatePct = daily.totalRow?.ngRatePct ?? 0;
          const tone = daily.hasData ? resolveNgRateTone(ngRatePct) : "empty";
          const isSelected = daily.dateKey === selectedDateKey;

          return (
            <button
              key={daily.dateKey}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={`s90d-daily-date-chip s90d-daily-date-chip--${tone}${
                isSelected ? " s90d-daily-date-chip--active" : ""
              }`}
              onClick={() => onSelect(daily.dateKey)}
            >
              <span className="s90d-daily-date-chip-date">
                {formatShortDateLabel(daily.dateKey)}
              </span>
              <span className="s90d-daily-date-chip-rate">
                {daily.hasData ? formatPct(ngRatePct) : "—"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ProcessMetricCells({ row, isSubRow = false, parentHighlight = false }) {
  const yieldClass = parentHighlight ? " s90d-daily-process-qty--alert" : "";

  return (
    <>
      <td
        className={`s90d-daily-process-qty${isSubRow ? " s90d-daily-process-qty--sub" : ""}${
          parentHighlight ? " s90d-daily-process-qty--strong" : ""
        }`}
      >
        {formatS90dDailyQty(row.totalQty)}
      </td>
      <td className="s90d-daily-process-qty">{formatS90dDailyQty(row.okQty)}</td>
      <td className={`s90d-daily-process-qty${yieldClass}`}>
        {formatS90dDailyPct(row.yieldPct)}
      </td>
      <td className="s90d-daily-process-qty s90d-daily-process-qty--ng">
        {formatS90dDailyNg(row.ngQty)}
      </td>
      <td className="s90d-daily-process-rate">
        <NgRatePill value={row.ngRatePct} />
      </td>
    </>
  );
}

function BoardRateCell({ boardRow }) {
  return (
    <td className="s90d-daily-process-rate">
      <NgRatePill value={boardRow.ngRatePct} />
    </td>
  );
}

function BoardSubHeaderRow({ rt }) {
  return (
    <tr className="s90d-daily-board-header-row">
      <td className="s90d-daily-board-header-cell">
        <S90dBilingualHeader
          ko="상품 코드"
          vi={rt("metaProductCode", "Mã hàng")}
          koBelow
        />
      </td>
      <td className="s90d-daily-board-header-cell">
        <S90dBilingualHeader
          ko="총수량"
          vi={rt("dailyTotalQtyCol", "Tổng SL")}
          koBelow
        />
      </td>
      <td className="s90d-daily-board-header-cell">
        <S90dBilingualHeader
          ko="양품수량"
          vi={rt("dailyOkQtyCol", "SL đạt")}
          koBelow
        />
      </td>
      <td className="s90d-daily-board-header-cell">
        <S90dBilingualHeader
          ko="수율"
          vi={rt("dailyYieldCol", "Hiệu suất")}
          koBelow
        />
      </td>
      <td className="s90d-daily-board-header-cell">
        <S90dBilingualHeader
          ko="불량수량"
          vi={rt("dailyNgQtyCol", "SL NG")}
          koBelow
        />
      </td>
      <td className="s90d-daily-board-header-cell">
        <S90dBilingualHeader
          ko="불량율"
          vi={rt("dailyNgRateCol", "Tỷ lệ NG")}
          koBelow
        />
      </td>
    </tr>
  );
}

function calcDefectRatePct(qty, totalQty) {
  if (!totalQty) return 0;
  return Math.round((Number(qty) / Number(totalQty)) * 1000) / 10;
}

function getDefectEntries(row) {
  if (!row?.defects) return [];

  const totalQty = row.totalQty ?? 0;

  return S90D_DEFECT_COLUMNS.map(({ key, ko, vi, shortVi }) => {
    const qty = row.defects[key] ?? 0;
    if (!Number(qty)) return null;

    return {
      key,
      ko,
      viLabel: shortVi || vi,
      qty,
      ngRatePct: calcDefectRatePct(qty, totalQty),
    };
  }).filter(Boolean);
}

function buildExpandableProcessIds(processDetails) {
  const ids = new Set();

  processDetails.forEach((detail) => {
    const { process, processRow, boardRows, boardCount } = detail;
    const hasMultipleBoards =
      (boardCount ?? boardRows.length) >= 2 || boardRows.length >= 2;
    const defectEntries = hasMultipleBoards ? [] : getDefectEntries(processRow);

    if (hasMultipleBoards || defectEntries.length > 0) {
      ids.add(process);
    }
  });

  return ids;
}

function buildExpandableBoardIds(processDetails) {
  const ids = new Set();

  processDetails.forEach(({ boardRows, boardCount }) => {
    const hasMultipleBoards =
      (boardCount ?? boardRows.length) >= 2 || boardRows.length >= 2;
    if (!hasMultipleBoards) return;

    boardRows.forEach((boardRow) => {
      if (getDefectEntries(boardRow).length > 0) {
        ids.add(boardRow.boardId);
      }
    });
  });

  return ids;
}

async function waitForPaint() {
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function getBoardDisplayName(boardRow) {
  const productCode = String(boardRow?.productCode ?? "").trim();
  if (productCode && productCode !== "S90D") return productCode;
  return String(boardRow?.label ?? productCode ?? "S90D").trim() || "S90D";
}

function BoardExpandedSection({
  boardRows,
  process,
  isExpanded,
  expandedBoardIds,
  onToggleBoard,
  rt,
}) {
  if (!isExpanded || boardRows.length < 2) return null;

  return (
    <>
      <BoardSubHeaderRow rt={rt} />
      {boardRows.map((boardRow) => {
        const boardDefects = getDefectEntries(boardRow);
        const displayName = getBoardDisplayName(boardRow);
        const isBoardExpanded = expandedBoardIds.has(boardRow.boardId);

        return (
          <React.Fragment key={`${process}-${boardRow.boardId}`}>
            <tr className="s90d-daily-process-row s90d-daily-process-row--sub s90d-daily-process-row--board">
              <td className="s90d-daily-process-name s90d-daily-process-name--board">
                <div className="s90d-daily-board-name-inner">
                  <span className="s90d-daily-tree-hook" aria-hidden="true">
                    ↳
                  </span>
                  {boardDefects.length > 0 ? (
                    <button
                      type="button"
                      className={`s90d-daily-process-toggle s90d-daily-board-row-toggle${
                        isBoardExpanded ? " s90d-daily-process-toggle--open" : ""
                      }`}
                      aria-expanded={isBoardExpanded}
                      aria-label={rt(
                        "dailyToggleBoardDefects",
                        "Mở chi tiết lỗi {{product}}",
                        { product: displayName },
                      )}
                      onClick={() => onToggleBoard(boardRow.boardId)}
                    >
                      ▶
                    </button>
                  ) : (
                    <span
                      className="s90d-daily-board-toggle-spacer"
                      aria-hidden="true"
                    />
                  )}
                  <span className="s90d-daily-board-product-name">
                    {displayName}
                  </span>
                </div>
              </td>
              <td className="s90d-daily-process-qty s90d-daily-process-qty--sub">
                {formatS90dDailyQty(boardRow.totalQty)}
              </td>
              <td className="s90d-daily-process-qty">
                {formatS90dDailyQty(boardRow.okQty)}
              </td>
              <td className="s90d-daily-process-qty">
                {formatS90dDailyPct(boardRow.yieldPct)}
              </td>
              <td className="s90d-daily-process-qty s90d-daily-process-qty--ng">
                {formatS90dDailyNg(boardRow.ngQty)}
              </td>
              <BoardRateCell boardRow={boardRow} />
            </tr>
            {isBoardExpanded && boardDefects.length > 0 ? (
              <DefectDetailRows
                defects={boardDefects}
                rowKeyPrefix={`${process}-${boardRow.boardId}`}
              />
            ) : null}
          </React.Fragment>
        );
      })}
    </>
  );
}

function DefectDetailRows({ defects, rowKeyPrefix }) {
  return defects.map((defect) => (
    <tr
      key={`${rowKeyPrefix}-defect-${defect.key}`}
      className="s90d-daily-process-row s90d-daily-process-row--sub s90d-daily-process-row--defect"
    >
      <td className="s90d-daily-process-name s90d-daily-process-name--sub s90d-daily-process-name--defect-detail">
        <span className="s90d-daily-defect-label">
          <S90dBilingualHeader ko={defect.ko} vi={defect.viLabel} />
        </span>
      </td>
      <td className="s90d-daily-process-qty s90d-daily-process-qty--sub">—</td>
      <td className="s90d-daily-process-qty s90d-daily-process-qty--sub">—</td>
      <td className="s90d-daily-process-qty s90d-daily-process-qty--sub">—</td>
      <td className="s90d-daily-process-qty s90d-daily-process-qty--ng">
        {formatS90dDailyNg(defect.qty)}
      </td>
      <td className="s90d-daily-process-rate">
        <NgRatePill value={defect.ngRatePct} />
      </td>
    </tr>
  ));
}

function S90dDailyProcessTable({
  processDetails = [],
  totalRow,
  expandAllForExport = false,
}) {
  const rt = useReportT();
  const { t } = useTranslation();
  const [expandedProcesses, setExpandedProcesses] = useState(() => new Set());
  const [expandedBoardIds, setExpandedBoardIds] = useState(() => new Set());

  const allExpandedProcesses = useMemo(
    () => buildExpandableProcessIds(processDetails),
    [processDetails],
  );
  const allExpandedBoards = useMemo(
    () => buildExpandableBoardIds(processDetails),
    [processDetails],
  );

  const activeExpandedProcesses = expandAllForExport
    ? allExpandedProcesses
    : expandedProcesses;
  const activeExpandedBoardIds = expandAllForExport
    ? allExpandedBoards
    : expandedBoardIds;
  const toggleProcess = (process) => {
    setExpandedProcesses((prev) => {
      const next = new Set(prev);
      if (next.has(process)) next.delete(process);
      else next.add(process);
      return next;
    });
  };

  const toggleBoard = (boardId) => {
    setExpandedBoardIds((prev) => {
      const next = new Set(prev);
      if (next.has(boardId)) next.delete(boardId);
      else next.add(boardId);
      return next;
    });
  };

  return (
    <div className="s90d-daily-process-table-wrap">
      {!expandAllForExport ? (
        <p className="s90d-daily-process-hint">
          {rt(
            "dailyProcessExpandHint",
            "Bấm ▶ ở đầu mỗi dòng để mở chi tiết lỗi của công đoạn đó",
          )}
        </p>
      ) : null}

      <div className="s90d-daily-process-table-scroll">        <table className="s90d-daily-process-table">
          <colgroup>
            <col className="s90d-daily-col-process" />
            <col className="s90d-daily-col-metric" />
            <col className="s90d-daily-col-metric" />
            <col className="s90d-daily-col-metric" />
            <col className="s90d-daily-col-metric" />
            <col className="s90d-daily-col-metric" />
          </colgroup>
          <thead>
            <tr>
              <th>
                <S90dBilingualHeader
                  ko="공정"
                  vi={rt("dailyProcessCol", "Công đoạn")}
                  koBelow
                />
              </th>
              <th>
                <S90dBilingualHeader
                  ko="총수량"
                  vi={rt("dailyTotalQtyCol", "Tổng SL")}
                  koBelow
                />
              </th>
              <th>
                <S90dBilingualHeader
                  ko="양품수량"
                  vi={rt("dailyOkQtyCol", "SL đạt")}
                  koBelow
                />
              </th>
              <th>
                <S90dBilingualHeader
                  ko="수율"
                  vi={rt("dailyYieldCol", "Hiệu suất")}
                  koBelow
                />
              </th>
              <th>
                <S90dBilingualHeader
                  ko="불량수량"
                  vi={rt("dailyNgQtyCol", "SL NG")}
                  koBelow
                />
              </th>
              <th>
                <S90dBilingualHeader
                  ko="불량율"
                  vi={rt("dailyNgRateCol", "Tỷ lệ NG")}
                  koBelow
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {processDetails.map((detail) => {
              const { process, processRow, boardRows, boardCount } = detail;
              const hasMultipleBoards =
                (boardCount ?? boardRows.length) >= 2 || boardRows.length >= 2;
              const isExpanded = activeExpandedProcesses.has(process);              const processLabel = t(`areas.${process}`, { defaultValue: process });
              const defectEntries = hasMultipleBoards
                ? []
                : getDefectEntries(processRow);
              const hasExpandableContent =
                hasMultipleBoards || defectEntries.length > 0;

              return (
                <React.Fragment key={process}>
                  <tr
                    className={`s90d-daily-process-row s90d-daily-process-row--main${
                      isExpanded && hasMultipleBoards
                        ? " s90d-daily-process-row--expanded-parent"
                        : ""
                    }`}
                    data-process={process}
                  >
                    <td className="s90d-daily-process-name">
                      <div className="s90d-daily-process-name-inner">
                        <button
                          type="button"
                          className={`s90d-daily-process-toggle${
                            isExpanded ? " s90d-daily-process-toggle--open" : ""
                          }${!hasExpandableContent ? " s90d-daily-process-toggle--muted" : ""}`}
                          aria-expanded={isExpanded}
                          aria-label={rt("dailyToggleProcess", "Mở chi tiết {{process}}", {
                            process: processLabel,
                          })}
                          onClick={() => toggleProcess(process)}
                        >
                          ▶
                        </button>
                        <span className="s90d-daily-process-dot" data-process={process} />
                        <span className="s90d-daily-process-label">{processLabel}</span>
                        {hasMultipleBoards ? (
                          <span className="s90d-daily-process-board-badge">
                            {rt("dailyBoardCountBadge", "{{count}} mã hàng", {
                              count: boardCount ?? boardRows.length,
                            })}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <ProcessMetricCells
                      row={processRow}
                      parentHighlight={
                        hasMultipleBoards &&
                        Number(processRow.ngRatePct) > 0
                      }
                    />
                  </tr>

                  <BoardExpandedSection
                    boardRows={boardRows}
                    process={process}
                    isExpanded={isExpanded}
                    expandedBoardIds={activeExpandedBoardIds}                    onToggleBoard={toggleBoard}
                    rt={rt}
                  />

                  {isExpanded && !hasMultipleBoards && defectEntries.length > 0 ? (
                    <DefectDetailRows
                      defects={defectEntries}
                      rowKeyPrefix={process}
                    />
                  ) : null}

                  {isExpanded &&
                  !hasMultipleBoards &&
                  defectEntries.length === 0 ? (
                    <tr className="s90d-daily-process-row s90d-daily-process-row--sub s90d-daily-process-row--empty">
                      <td
                        colSpan={6}
                        className="s90d-daily-process-empty-detail"
                      >
                        {rt("dailyNoDefectDetail", "Không có lỗi chi tiết cho công đoạn này.")}
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}

            <tr className="s90d-daily-process-row s90d-daily-process-row--total">
              <td className="s90d-daily-process-name">
                <strong>{rt("totalLabel", "TOTAL")}</strong>
              </td>
              <td className="s90d-daily-process-qty">
                <strong>{formatQty(totalRow?.totalQty)}</strong>
              </td>
              <td className="s90d-daily-process-qty">
                <strong>{formatQty(totalRow?.okQty)}</strong>
              </td>
              <td className="s90d-daily-process-qty">
                <strong>{formatPct(totalRow?.yieldPct)}</strong>
              </td>
              <td className="s90d-daily-process-qty s90d-daily-process-qty--ng">
                <strong>{formatQty(totalRow?.ngQty)}</strong>
              </td>
              <td className="s90d-daily-process-rate">
                <NgRatePill value={totalRow?.ngRatePct} emphasize />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function S90dDailyTabPanel({
  monthDailySummaries = [],
  variant = "daily",
  grandTotalSummary = null,
  monthDisplayLabel = "",
}) {
  const rt = useReportT();
  const { defaultProductCode } = useProductionReportContext();
  const isTotalView = variant === "total";
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    pickDefaultDailyDateKey(monthDailySummaries),
  );
  const [exportingImage, setExportingImage] = useState(false);
  const [expandAllForExport, setExpandAllForExport] = useState(false);
  const boardExportRef = useRef(null);
  const rollup = useMemo(
    () => buildMonthDailyRollup(monthDailySummaries),
    [monthDailySummaries],
  );

  useEffect(() => {
    if (isTotalView) return;
    setSelectedDateKey((current) => {
      if (monthDailySummaries.some((daily) => daily.dateKey === current)) {
        return current;
      }
      return pickDefaultDailyDateKey(monthDailySummaries);
    });
  }, [isTotalView, monthDailySummaries]);

  const selectedSummary = useMemo(
    () =>
      monthDailySummaries.find((daily) => daily.dateKey === selectedDateKey) ??
      null,
    [monthDailySummaries, selectedDateKey],
  );

  const activeSummary = isTotalView ? grandTotalSummary : selectedSummary;

  const processDetails = useMemo(() => {
    if (activeSummary?.processDetails?.length) {
      return activeSummary.processDetails;
    }
    return (activeSummary?.processRows ?? []).map((processRow) => ({
      process: processRow.process,
      processRow,
      boardRows: [],
      boardCount: 1,
    }));
  }, [activeSummary]);

  const selectedDateLabel = selectedSummary
    ? formatShortDateLabel(selectedSummary.dateKey, selectedSummary.dateLabel)
    : "";

  const handleDownloadBoardImage = useCallback(async () => {
    if (!boardExportRef.current || !activeSummary?.hasData || exportingImage) return;

    setExportingImage(true);
    setExpandAllForExport(true);

    let scrollEl = null;
    let prevOverflow = "";
    let prevOverflowX = "";
    let prevOverflowY = "";

    try {
      await waitForPaint();

      scrollEl = boardExportRef.current.querySelector(
        ".s90d-daily-process-table-scroll",
      );
      if (scrollEl) {
        prevOverflow = scrollEl.style.overflow;
        prevOverflowX = scrollEl.style.overflowX;
        prevOverflowY = scrollEl.style.overflowY;
        scrollEl.style.overflow = "visible";
        scrollEl.style.overflowX = "visible";
        scrollEl.style.overflowY = "visible";
      }

      await waitForPaint();

      const dataUrl = await toPng(boardExportRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        filter: (node) => {
          if (!(node instanceof Element)) return true;
          return !node.classList.contains("dashboard-no-print");
        },
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = buildBoardExportFilename({
        reportCode: defaultProductCode,
        isTotalView,
        selectedDateKey,
        monthDisplayLabel,
        productCode: activeSummary.productCode || defaultProductCode,
      });
      link.click();
    } catch {
      window.alert(
        rt("boardImageExportError", "Không thể tải hình bảng sản lượng."),
      );
    } finally {
      if (scrollEl) {
        scrollEl.style.overflow = prevOverflow;
        scrollEl.style.overflowX = prevOverflowX;
        scrollEl.style.overflowY = prevOverflowY;
      }
      setExpandAllForExport(false);
      setExportingImage(false);
    }
  }, [    activeSummary,
    defaultProductCode,
    exportingImage,
    isTotalView,
    monthDisplayLabel,
    rt,
    selectedDateKey,
  ]);

  return (
    <div className="s90d-daily-dashboard">
      <S90dDailyMonthStats rollup={rollup} />

      {!isTotalView ? (
        <S90dDailyDateStrip
          monthDailySummaries={monthDailySummaries}
          selectedDateKey={selectedDateKey}
          onSelect={setSelectedDateKey}
        />
      ) : null}

      {activeSummary ? (
        <article
          ref={boardExportRef}
          className="s90d-board-card s90d-daily-detail-card"
        >
          <header className="s90d-board-head s90d-board-head--title-row">
            <div className="s90d-board-title-row s90d-daily-detail-head">
              <h3 className="s90d-board-title-text">
                {isTotalView
                  ? rt("totalBoardTitle", "Bảng tổng hợp tháng")
                  : rt("dailyBoardTitle", "Bảng sản lượng S90D theo ngày")}
              </h3>
              <div className="s90d-meta-item s90d-meta-item--inline">
                <span className="s90d-meta-label">
                  {isTotalView
                    ? rt("metaMonthYear", "Tháng/Năm")
                    : rt("metaDate", "Ngày")}
                </span>
                <strong>
                  {isTotalView ? monthDisplayLabel : selectedDateLabel}
                </strong>
              </div>
              <div className="s90d-meta-item s90d-meta-item--inline">
                <span className="s90d-meta-label">
                  {rt("metaProductCode", "Mã hàng")}
                </span>
                <strong>
                  {activeSummary.productCode || defaultProductCode}
                </strong>
              </div>
              <div className="s90d-daily-detail-actions">
                <button
                  type="button"
                  className="s90d-image-btn dashboard-no-print"
                  disabled={!activeSummary.hasData || exportingImage}
                  onClick={handleDownloadBoardImage}
                >
                  <FiDownload className="s90d-btn-icon" aria-hidden="true" />
                  <span>
                    {exportingImage
                      ? rt("boardImageExporting", "Đang tải…")
                      : rt("downloadBoardImage", "Tải hình")}
                  </span>
                </button>
              </div>            </div>
          </header>

          {activeSummary.hasData ? (
            <>
              <S90dKpiCards
                totalRow={activeSummary.totalRow}
                processDetails={processDetails}
              />
              <S90dDailyProcessTable
                processDetails={processDetails}
                totalRow={activeSummary.totalRow}
                expandAllForExport={expandAllForExport}
              />            </>
          ) : (
            <div className="s90d-daily-empty-day">
              {rt(
                isTotalView ? "totalEmptyHint" : "dailyEmptyDayHint",
                isTotalView
                  ? "Chưa có số liệu tháng này. Mở tab công đoạn để nhập."
                  : "Chưa có số liệu cho ngày này. Mở tab công đoạn để nhập.",
              )}
            </div>
          )}
        </article>
      ) : null}
    </div>
  );
}
