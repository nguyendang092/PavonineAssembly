import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { FiDownload } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { useProductionReportContext } from "../../productionReport/ProductionReportContext";
import { useReportT } from "../../productionReport/useReportTranslation";
import {
  buildMonthDailyRollup,
  pickDefaultDailyDateKey,
  resolveNgRateTone,
} from "../lib/buildS90dDailyRollup";
import { formatShortDateLabel } from "../lib/s90dDisplayUtils";
import S90dKpiCards from "./S90dKpiCards";
import S90dSummaryProcessTable from "./S90dSummaryProcessTable";

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

async function waitForPaint() {
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
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

  const tableDateLabel = isTotalView ? monthDisplayLabel : selectedDateLabel;
  const tableProductCode =
    activeSummary?.productCode || defaultProductCode;

  const handleDownloadBoardImage = useCallback(async () => {
    if (!boardExportRef.current || !activeSummary?.hasData || exportingImage) return;

    setExportingImage(true);

    let scrollEl = null;
    let prevOverflow = "";
    let prevOverflowX = "";
    let prevOverflowY = "";

    try {
      await waitForPaint();

      scrollEl = boardExportRef.current.querySelector(
        ".s90d-table-wrap--board",
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
          <header className="s90d-board-head s90d-board-head--compact">
            <div className="s90d-board-head-main">
              <h3 className="s90d-board-title">
                {rt("boardTitle", "BẢNG SẢN LƯỢNG")}
                <span className="s90d-board-badge">
                  {isTotalView
                    ? rt("totalBoardTitle", "Bảng tổng hợp tháng")
                    : rt("dailyBoardTitle", "Bảng sản lượng S90D theo ngày")}
                </span>
              </h3>
            </div>

            <div className="s90d-board-head-actions">
              <div className="s90d-board-meta s90d-board-meta--inline-row">
                <div className="s90d-meta-chip">
                  <span className="s90d-meta-label">
                    {isTotalView
                      ? rt("metaMonthYear", "Tháng/Năm")
                      : rt("metaDate", "Ngày")}
                  </span>
                  <strong>{tableDateLabel}</strong>
                </div>
                <div className="s90d-meta-chip">
                  <span className="s90d-meta-label">
                    {rt("metaProductCode", "Mã hàng")}
                  </span>
                  <strong>{tableProductCode}</strong>
                </div>
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
              </div>
            </div>
          </header>

          {activeSummary.hasData ? (
            <>
              <S90dKpiCards
                totalRow={activeSummary.totalRow}
                processDetails={processDetails}
              />
              <S90dSummaryProcessTable
                processDetails={processDetails}
                totalRow={activeSummary.totalRow}
                percentRow={activeSummary.percentRow}
                dateLabel={tableDateLabel}
                productCode={tableProductCode}
              />
            </>
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
