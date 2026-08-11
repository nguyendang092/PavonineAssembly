import React, { memo } from "react";
import { useTranslation } from "react-i18next";
import { useProductionReportContext } from "../../productionReport/ProductionReportContext";
import { useReportT } from "../../productionReport/useReportTranslation";
import { S90D_DEFECT_COLUMNS } from "../lib/s90dDefectColumns";
import { isHighDefectCell } from "../lib/buildS90dSummary";
import {
  formatS90dDailyNg,
  formatS90dDailyPct,
  formatS90dDailyQty,
  formatS90dDefectQty,
} from "../lib/buildS90dDailySummary";
import { formatShortDateLabel } from "../lib/s90dDisplayUtils";
import S90dBilingualHeader from "./S90dBilingualHeader";
import S90dDefectImageThumbs from "./S90dDefectImageThumbs";
import S90dKpiCards from "./S90dKpiCards";

const INFO_COL_COUNT = 4;
const DAILY_QTY_COL_COUNT = 6;

function formatQty(value, isPercentRow, useDash) {
  if (isPercentRow) {
    return value > 0 ? `${value}%` : "0%";
  }
  if (useDash && !Number(value)) return "-";
  return Number(value || 0).toLocaleString("vi-VN");
}

function formatPct(value, useDash) {
  if (value == null || value === "") return useDash ? "" : "0%";
  return `${Number(value).toLocaleString("vi-VN")}%`;
}

function DefectCell({
  qty,
  isPercent,
  highlight,
  totalNgQty,
  useDash,
  defectImages,
  defectKey,
  emphasizeNonZero = false,
}) {
  const display = useDash
    ? formatS90dDefectQty(qty, isPercent)
    : formatQty(qty, isPercent, false);
  const showPink = !isPercent && isHighDefectCell(qty, totalNgQty);
  const isNonZeroQty = !isPercent && Number(qty) > 0;
  const className = [
    "s90d-num",
    "s90d-defect-cell",
    highlight || showPink ? "s90d-cell-alert" : "",
    isPercent ? "s90d-cell-percent" : "",
    emphasizeNonZero && isNonZeroQty ? "s90d-defect-cell--nonzero" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <td className={className}>
      <div className="s90d-defect-cell-display">
        <span
          className={
            emphasizeNonZero && isNonZeroQty ? "s90d-defect-qty-strong" : undefined
          }
        >
          {display}
        </span>
        <S90dDefectImageThumbs
          imageMap={defectImages}
          defectKey={defectKey}
          isPercent={isPercent}
        />
      </div>
    </td>
  );
}

const SummaryRow = memo(function SummaryRow({
  row,
  shortDate,
  lineLabel,
  totalNgQty,
  t,
  variant,
}) {
  const rt = useReportT();
  const isTotal = row.isTotal;
  const isPercent = row.isPercent;
  const isDaily = variant === "daily";

  const trClass = isTotal
    ? "s90d-row-total"
    : isPercent
      ? "s90d-row-percent"
      : "s90d-row-shift";

  const processLabel = isTotal
    ? rt("totalLabel", "TOTAL")
    : isPercent
      ? ""
      : t(`areas.${row.process}`, { defaultValue: row.process });

  const classificationLabel = isTotal
    ? rt("totalLabel", "TOTAL")
    : isPercent
      ? ""
      : row.classification
        ? t(`areas.${row.classification}`, {
            defaultValue: row.classification,
          })
        : processLabel;

  const formatMainQty = isDaily ? formatS90dDailyQty : formatQty;
  const formatMainPct = isDaily ? formatS90dDailyPct : formatPct;
  const formatMainNg = isDaily
    ? formatS90dDailyNg
    : (v) => formatQty(v, false, false);

  let dateCell = isPercent ? "" : shortDate;
  let lineCell = isPercent
    ? rt("defectRateRowLabel", "Tỷ lệ theo tổng SL →")
    : isTotal
      ? `${rt("totalLabel", "TOTAL")}/${rt("tabTotal", "Tổng")}`
      : lineLabel;

  return (
    <tr className={trClass}>
      <td className="s90d-sticky-col s90d-col-date">{dateCell}</td>
      <td className="s90d-col-line">{lineCell}</td>
      <td className="s90d-process s90d-col-process">{processLabel}</td>
      <td className="s90d-col-class">{classificationLabel}</td>
      <td className="s90d-num s90d-col-total-qty">
        {isPercent ? "" : formatMainQty(row.totalQty)}
      </td>
      <td className="s90d-num s90d-col-ok">
        {isPercent ? "" : formatMainQty(row.okQty)}
      </td>
      <td className="s90d-num s90d-col-yield">
        {isPercent ? "" : formatMainPct(row.yieldPct)}
      </td>
      <td className="s90d-num s90d-col-cumul">
        {isPercent ? "" : formatMainPct(row.cumulativeYieldPct)}
      </td>
      <td className={`s90d-num s90d-col-ng ${isTotal ? "s90d-ng-total" : ""}`}>
        {isPercent ? "" : formatMainNg(row.ngQty)}
      </td>
      <td
        className={`s90d-num s90d-col-ng-rate ${isTotal ? "s90d-ng-total" : ""}`}
      >
        {isPercent ? "" : formatMainPct(row.ngRatePct)}
      </td>
      {S90D_DEFECT_COLUMNS.map(({ key }) => (
        <DefectCell
          key={key}
          defectKey={key}
          defectImages={row.defectImages}
          qty={row.defects[key] ?? 0}
          isPercent={isPercent}
          useDash={isDaily && !isPercent}
          emphasizeNonZero={!isDaily && !isPercent}
          highlight={
            !isPercent &&
            (row.defects[key] ?? 0) > 0 &&
            ((isTotal && (key === "scratch" || key === "dent")) ||
              (!isTotal &&
                row.process === "ASSEMBLY" &&
                (key === "scratch" || key === "dent")))
          }
          totalNgQty={totalNgQty}
        />
      ))}
    </tr>
  );
});

export default function S90dSummaryTable({
  summary,
  variant = "total",
  dateLabel: dateLabelProp,
  dateKey = "",
  monthLabel = "",
}) {
  const { t } = useTranslation();
  const rt = useReportT();
  const { defaultProductCode } = useProductionReportContext();
  const isDaily = variant === "daily";
  const dateLabel =
    dateLabelProp ?? summary.dateLabel ?? rt("dateTotal", "TOTAL");
  const shortDate = isDaily
    ? formatShortDateLabel(
        dateKey,
        dateLabel.replace(/월\s*/g, "/").replace(/일/g, ""),
      )
    : monthLabel || rt("dateTotal", "TOTAL");
  const lineLabel = summary?.productCode || defaultProductCode;
  const totalRow = summary.totalRow;
  const totalNgQty = totalRow?.ngQty ?? 0;

  const rows = [...summary.processRows, totalRow, summary.percentRow].filter(
    Boolean,
  );

  const boardTitle = isDaily
    ? rt("dailyBoardTitle", "Bảng tổng hợp theo ngày")
    : rt("totalBoardTitle", "Bảng tổng hợp tháng");

  return (
    <article className="s90d-board-card s90d-board-card--summary">
      <header className="s90d-board-head s90d-board-head--title-row">
        <div className="s90d-board-title-row">
          <h3 className="s90d-board-title-text">{boardTitle}</h3>
          <div className="s90d-board-title-meta">
            <div className="s90d-meta-item s90d-meta-item--inline">
              <span className="s90d-meta-label">
                {isDaily
                  ? rt("metaDate", "Ngày")
                  : rt("metaMonthYear", "Tháng/Năm")}
              </span>
              <strong>{shortDate}</strong>
            </div>
            <div className="s90d-meta-item s90d-meta-item--inline">
              <span className="s90d-meta-label">
                {rt("metaProductCode", "Mã hàng")}
              </span>
              <strong>{lineLabel}</strong>
            </div>
          </div>
        </div>
      </header>

      <S90dKpiCards totalRow={totalRow} />

      <div className="s90d-table-wrap s90d-table-wrap--board">
        <table className="s90d-board-table s90d-summary-table-layout">
          <thead>
            <tr className="s90d-head-group">
              <th colSpan={INFO_COL_COUNT} className="s90d-head-group-shift">
                {rt("groupShiftInfo", "Thông tin ca")}
              </th>
              <th colSpan={DAILY_QTY_COL_COUNT} className="s90d-head-group-qty">
                {rt("groupQtyYield", "Số lượng & hiệu suất")}
              </th>
              <th
                colSpan={S90D_DEFECT_COLUMNS.length}
                className="s90d-head-group-defect"
              >
                {rt("groupDefects", "Chi tiết lỗi")}
              </th>
            </tr>
            <tr className="s90d-head-cols">
              <th className="s90d-sticky-col s90d-head-shift">
                <S90dBilingualHeader ko="일자" vi="Ngày" />
              </th>
              <th className="s90d-head-shift">
                <S90dBilingualHeader ko="line 구분" vi="Line" />
              </th>
              <th className="s90d-head-shift">
                <S90dBilingualHeader ko="공정" vi="Công đoạn" />
              </th>
              <th className="s90d-head-shift">
                <S90dBilingualHeader ko="구분" vi="Phân loại" />
              </th>
              <th className="s90d-head-qty s90d-head-total-qty">
                <S90dBilingualHeader ko="총수량" vi="Tổng SL" />
              </th>
              <th className="s90d-head-qty s90d-head-ok">
                <S90dBilingualHeader ko="양품수량" vi="SL đạt" />
              </th>
              <th className="s90d-head-qty">
                <S90dBilingualHeader ko="수율" vi="Hiệu suất" />
              </th>
              <th className="s90d-head-qty">
                <S90dBilingualHeader ko="직진율" vi="Tích lũy" />
              </th>
              <th className="s90d-head-qty s90d-head-ng">
                <S90dBilingualHeader ko="불량수량" vi="SL NG" />
              </th>
              <th className="s90d-head-qty s90d-head-ng-rate">
                <S90dBilingualHeader ko="불량율" vi="Tỷ lệ NG" />
              </th>
              {S90D_DEFECT_COLUMNS.map(({ key, ko, vi }) => (
                <th key={key} className="s90d-head-defect">
                  <S90dBilingualHeader ko={ko} vi={vi} wrap />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <SummaryRow
                key={`${dateLabel}-${row.process}`}
                row={row}
                shortDate={shortDate}
                lineLabel={lineLabel}
                totalNgQty={totalNgQty}
                t={t}
                variant={variant}
              />
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
