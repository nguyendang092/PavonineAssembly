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
  S90D_ALL_DAYS_KEY,
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
  isAllDaysView,
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
  if (isAllDaysView) {
    const month = sanitizeExportSegment(monthDisplayLabel) || "Thang";
    return `${prefix}_Tat_ca_${month}_${code}.png`;
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

function resolveProcessDetails(summary) {
  if (summary?.processDetails?.length) {
    return summary.processDetails;
  }
  return (summary?.processRows ?? []).map((processRow) => ({
    process: processRow.process,
    processRow,
    boardRows: [],
    boardCount: 1,
  }));
}

function S90dDailyDateStrip({
  monthDailySummaries,
  selectedDateKey,
  onSelect,
  monthAvgNgRate = 0,
  hasAnyDayData = false,
}) {
  const rt = useReportT();
  const isAllDaysSelected = selectedDateKey === S90D_ALL_DAYS_KEY;

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

      <div
        className="s90d-daily-date-strip"
        role="listbox"
        aria-label={rt("dailyPickDateLabel", "Chọn ngày xem chi tiết")}
      >
        <button
          type="button"
          role="option"
          aria-selected={isAllDaysSelected}
          className={`s90d-daily-date-chip s90d-daily-date-chip--${
            hasAnyDayData ? resolveNgRateTone(monthAvgNgRate) : "empty"
          }${isAllDaysSelected ? " s90d-daily-date-chip--active" : ""}`}
          onClick={() => onSelect(S90D_ALL_DAYS_KEY)}
        >
          <span className="s90d-daily-date-chip-date">
            {rt("dailyAllDays", "Tất cả")}
          </span>
          <span className="s90d-daily-date-chip-rate">
            {hasAnyDayData ? formatPct(monthAvgNgRate) : "—"}
          </span>
        </button>
        {monthDailySummaries.map((daily) => {
          const ngRatePct = daily.totalRow?.ngRatePct ?? 0;
          const tone = daily.hasData ? resolveNgRateTone(ngRatePct) : "empty";
          const isSelected =
            !isAllDaysSelected && daily.dateKey === selectedDateKey;

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

function S90dDailyBoardCard({
  summary,
  isTotalView = false,
  monthDisplayLabel = "",
  selectedDateKey = "",
  isAllDaysView = false,
  defaultProductCode,
  rt,
}) {
  const boardExportRef = useRef(null);
  const [exportingImage, setExportingImage] = useState(false);
  const processDetails = useMemo(
    () => resolveProcessDetails(summary),
    [summary],
  );
  const dateLabel = isTotalView
    ? monthDisplayLabel
    : formatShortDateLabel(summary?.dateKey, summary?.dateLabel);
  const productCode = summary?.productCode || defaultProductCode;
  const hasData = Boolean(summary?.hasData);

  const handleDownloadBoardImage = useCallback(async () => {
    if (!boardExportRef.current || !hasData || exportingImage) return;

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
        isAllDaysView,
        selectedDateKey: summary?.dateKey || selectedDateKey,
        monthDisplayLabel,
        productCode,
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
  }, [
    defaultProductCode,
    exportingImage,
    hasData,
    isAllDaysView,
    isTotalView,
    monthDisplayLabel,
    productCode,
    rt,
    selectedDateKey,
    summary?.dateKey,
  ]);

  if (!summary) return null;

  return (
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
              <strong>{dateLabel}</strong>
            </div>
            <div className="s90d-meta-chip">
              <span className="s90d-meta-label">
                {rt("metaProductCode", "Mã hàng")}
              </span>
              <strong>{productCode}</strong>
            </div>
          </div>
          <div className="s90d-daily-detail-actions">
            <button
              type="button"
              className="s90d-image-btn dashboard-no-print"
              disabled={!hasData || exportingImage}
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

      {hasData ? (
        <>
          <S90dKpiCards
            totalRow={summary.totalRow}
            processDetails={processDetails}
            showProductYieldBreakdown={false}
          />
          <S90dSummaryProcessTable
            processDetails={processDetails}
            totalRow={summary.totalRow}
            percentRow={summary.percentRow}
            dateLabel={dateLabel}
            productCode={productCode}
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
  );
}

export default function S90dDailyTabPanel({
  monthDailySummaries = [],
  variant = "daily",
  grandTotalSummary = null,
  monthDisplayLabel = "",
  productSections = null,
}) {
  const rt = useReportT();
  const { defaultProductCode } = useProductionReportContext();
  const isTotalView = variant === "total";
  const [selectedDateKey, setSelectedDateKey] = useState(() =>
    pickDefaultDailyDateKey(monthDailySummaries),
  );
  const rollup = useMemo(
    () => buildMonthDailyRollup(monthDailySummaries),
    [monthDailySummaries],
  );

  useEffect(() => {
    if (isTotalView) return;
    setSelectedDateKey((current) => {
      if (current === S90D_ALL_DAYS_KEY) return current;
      if (monthDailySummaries.some((daily) => daily.dateKey === current)) {
        return current;
      }
      return pickDefaultDailyDateKey(monthDailySummaries);
    });
  }, [isTotalView, monthDailySummaries]);

  const isAllDaysView =
    !isTotalView && selectedDateKey === S90D_ALL_DAYS_KEY;

  const selectedSummary = useMemo(
    () =>
      isAllDaysView
        ? null
        : monthDailySummaries.find((daily) => daily.dateKey === selectedDateKey) ??
          null,
    [isAllDaysView, monthDailySummaries, selectedDateKey],
  );

  const activeSummary = isTotalView
    ? grandTotalSummary
    : isAllDaysView
      ? null
      : selectedSummary;

  const daysWithData = useMemo(
    () => monthDailySummaries.filter((daily) => daily.hasData),
    [monthDailySummaries],
  );

  const renderBoardContent = () => {
    if (productSections?.length) {
      if (isTotalView) {
        return (
          <div className="s90d-daily-product-stack">
            {productSections.map((section) => (
              <S90dDailyBoardCard
                key={section.productCode}
                summary={section.grandTotalSummary}
                isTotalView
                monthDisplayLabel={monthDisplayLabel}
                defaultProductCode={section.productCode}
                rt={rt}
              />
            ))}
          </div>
        );
      }

      if (isAllDaysView) {
        if (!daysWithData.length) {
          return (
            <div className="s90d-daily-empty-day">
              {rt(
                "dailyEmptyDayHint",
                "Chưa có số liệu cho ngày này. Mở tab công đoạn để nhập.",
              )}
            </div>
          );
        }

        return (
          <div className="s90d-daily-all-days-stack">
            {daysWithData.map((daily) => (
              <div
                key={daily.dateKey}
                className="s90d-daily-day-product-group"
              >
                {productSections.map((section) => {
                  const summary = section.monthDailySummaries.find(
                    (item) => item.dateKey === daily.dateKey,
                  );
                  return (
                    <S90dDailyBoardCard
                      key={`${daily.dateKey}-${section.productCode}`}
                      summary={summary}
                      defaultProductCode={section.productCode}
                      rt={rt}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        );
      }

      return (
        <div className="s90d-daily-product-stack">
          {productSections.map((section) => {
            const summary = section.monthDailySummaries.find(
              (item) => item.dateKey === selectedDateKey,
            );
            return (
              <S90dDailyBoardCard
                key={section.productCode}
                summary={summary}
                selectedDateKey={selectedDateKey}
                defaultProductCode={section.productCode}
                rt={rt}
              />
            );
          })}
        </div>
      );
    }

    if (isAllDaysView) {
      if (!daysWithData.length) {
        return (
          <div className="s90d-daily-empty-day">
            {rt(
              "dailyEmptyDayHint",
              "Chưa có số liệu cho ngày này. Mở tab công đoạn để nhập.",
            )}
          </div>
        );
      }

      return (
        <div className="s90d-daily-all-days-stack">
          {daysWithData.map((daily) => (
            <S90dDailyBoardCard
              key={daily.dateKey}
              summary={daily}
              defaultProductCode={defaultProductCode}
              rt={rt}
            />
          ))}
        </div>
      );
    }

    if (activeSummary || isTotalView) {
      return (
        <S90dDailyBoardCard
          summary={activeSummary}
          isTotalView={isTotalView}
          monthDisplayLabel={monthDisplayLabel}
          selectedDateKey={selectedDateKey}
          defaultProductCode={defaultProductCode}
          rt={rt}
        />
      );
    }

    return null;
  };

  return (
    <div className="s90d-daily-dashboard">
      <S90dDailyMonthStats rollup={rollup} />

      {!isTotalView ? (
        <S90dDailyDateStrip
          monthDailySummaries={monthDailySummaries}
          selectedDateKey={selectedDateKey}
          onSelect={setSelectedDateKey}
          monthAvgNgRate={rollup.avgNgRate}
          hasAnyDayData={rollup.activeDays > 0}
        />
      ) : null}

      {renderBoardContent()}
    </div>
  );
}
