import React, { memo } from "react";
import { useTranslation } from "react-i18next";
import { useReportT } from "../../productionReport/useReportTranslation";
import { ASSEMBLY_PROCESS } from "../lib/s90dManualEntryReportConfig";
import { S90D_DEFECT_COLUMNS } from "../lib/s90dDefectColumns";
import {
  aggregateBoardRowsByProductGroup,
  formatS90dDefectQty,
  formatS90dYieldPct,
  formatShortDateLabel,
  isHighDefectCell,
  resolveS90dTotalYieldPct,
} from "../lib/s90dDisplayUtils";
import S90dBilingualHeader from "./S90dBilingualHeader";
import S90dDefectImageThumbs from "./S90dDefectImageThumbs";

const INFO_COL_COUNT_BASE = 4;
const QTY_COL_COUNT = 5;

function resolveClassificationCell({ processLabel, isTotal, isPercent, rt }) {
  if (isPercent) return "";
  if (isTotal) return rt("totalLabel", "TOTAL");
  return processLabel;
}

function formatQty(value, isPercentRow) {
  if (isPercentRow) {
    return value > 0 ? `${value}%` : "0%";
  }
  if (!Number(value)) return "-";
  return Number(value || 0).toLocaleString("vi-VN");
}

function formatPct(value) {
  if (value == null || value === "") return "-";
  return `${Number(value).toLocaleString("vi-VN")}%`;
}

function DefectCell({
  qty,
  imageUrl = "",
  defectKey,
  isPercent,
  highlight,
  totalNgQty,
}) {
  const showPink = !isPercent && isHighDefectCell(qty, totalNgQty);
  const className = [
    "s90d-num",
    "s90d-defect-cell",
    highlight || showPink ? "s90d-cell-alert" : "",
    isPercent ? "s90d-cell-percent" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <td className={className}>
      <div className="s90d-defect-cell-display">
        <span>{formatS90dDefectQty(qty, isPercent)}</span>
        <S90dDefectImageThumbs
          imageMap={{ [defectKey]: imageUrl }}
          defectKey={defectKey}
          isPercent={isPercent}
        />
      </div>
    </td>
  );
}

const SummaryProcessRow = memo(function SummaryProcessRow({
  row,
  dateLabel,
  processLabel,
  totalNgQty,
  isBoardSubRow = false,
}) {
  const rt = useReportT();
  const isTotal = row.isTotal;
  const isPercent = row.isPercent;

  const trClass = isTotal
    ? "s90d-row-total"
    : isPercent
      ? "s90d-row-percent"
      : isBoardSubRow
        ? "s90d-row-shift s90d-row-board-sub"
        : "s90d-row-shift";

  let dateCell = dateLabel;
  let productCell = row.productCode ?? "";
  let processCell = processLabel;

  if (isTotal) {
    processCell = rt("totalLabel", "TOTAL");
  } else if (isPercent) {
    dateCell = "";
    productCell = rt("defectRateRowLabel", "Tỷ lệ theo tổng SL →");
    processCell = "";
  } else if (isBoardSubRow) {
    dateCell = "";
    productCell = String(row.productCode ?? row.label ?? "").trim();
    processCell = processLabel;
  }

  const classificationCell = resolveClassificationCell({
    processLabel,
    isTotal,
    isPercent,
    rt,
  });
  const displayYieldPct = isTotal ? resolveS90dTotalYieldPct(row) : row.yieldPct;

  return (
    <tr className={trClass}>
      <td className="s90d-sticky-col s90d-col-date">{dateCell}</td>
      <td className="s90d-col-product s90d-col-product--full">
        {productCell}
      </td>
      <td className="s90d-process s90d-col-process">{processCell}</td>
      <td className="s90d-col-classification">{classificationCell}</td>
      <td className="s90d-num s90d-col-total-qty">
        {isPercent ? "" : formatQty(row.totalQty, false)}
      </td>
      <td className="s90d-num s90d-col-ok">
        {isPercent ? "" : formatQty(row.okQty, false)}
      </td>
      <td className={`s90d-num s90d-col-ng ${isTotal ? "s90d-ng-total" : ""}`}>
        {isPercent ? "" : formatQty(row.ngQty, false)}
      </td>
      <td className="s90d-num s90d-col-yield">
        {isPercent ? "" : formatS90dYieldPct(displayYieldPct, "-")}
      </td>
      <td className={`s90d-num s90d-col-ng-rate ${isTotal ? "s90d-ng-total" : ""}`}>
        {isPercent ? "" : formatPct(row.ngRatePct)}
      </td>
      {S90D_DEFECT_COLUMNS.map(({ key }) => (
        <DefectCell
          key={key}
          defectKey={key}
          qty={row.defects?.[key] ?? 0}
          imageUrl={row.defectImages?.[key] ?? ""}
          isPercent={isPercent}
          highlight={
            !isPercent &&
            isTotal &&
            (key === "scratch" || key === "dent") &&
            (row.defects?.[key] ?? 0) > 0
          }
          totalNgQty={totalNgQty}
        />
      ))}
    </tr>
  );
});

function resolveSummaryProcessDetails(summary) {
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

function renderSummaryProcessDetailRows({
  processDetails,
  dateLabel,
  productCode,
  totalNgQty,
  t,
  keyPrefix = "",
}) {
  return processDetails.flatMap((detail) => {
    const { process, processRow, boardRows = [] } = detail;
    const processLabel = t(`areas.${process}`, { defaultValue: process });
    const aggregatedBoardRows = aggregateBoardRowsByProductGroup(boardRows);
    const hasMultipleBoards =
      process !== ASSEMBLY_PROCESS && aggregatedBoardRows.length >= 2;
    const summaryRow = {
      ...processRow,
      productCode: productCode || processRow.productCode,
    };
    const rowKeyPrefix = keyPrefix ? `${keyPrefix}-` : "";

    return (
      <React.Fragment key={`${rowKeyPrefix}${process}`}>
        <SummaryProcessRow
          row={summaryRow}
          dateLabel={dateLabel}
          processLabel={processLabel}
          totalNgQty={totalNgQty}
        />
        {hasMultipleBoards
          ? aggregatedBoardRows.map((boardRow) => (
              <SummaryProcessRow
                key={`${rowKeyPrefix}${process}-${boardRow.boardId}`}
                row={{
                  ...boardRow,
                  defects: boardRow.defects ?? {},
                  defectImages: boardRow.defectImages ?? {},
                }}
                dateLabel={dateLabel}
                processLabel={processLabel}
                totalNgQty={totalNgQty}
                isBoardSubRow
              />
            ))
          : null}
      </React.Fragment>
    );
  });
}

export default function S90dSummaryProcessTable({
  processDetails = [],
  dailySummaries = null,
  totalRow = null,
  percentRow = null,
  dateLabel = "",
  productCode = "",
}) {
  const { t } = useTranslation();
  const rt = useReportT();
  const infoColCount = INFO_COL_COUNT_BASE;
  const totalNgQty = totalRow?.ngQty ?? 0;

  return (
    <div className="s90d-table-wrap s90d-table-wrap--board s90d-table-wrap--summary">
      <table className="s90d-board-table s90d-process-table-layout s90d-summary-process-table">
        <thead>
          <tr className="s90d-head-group">
            <th colSpan={infoColCount} className="s90d-head-group-shift">
              {rt("groupProductInfo", "Thông tin mã hàng")}
            </th>
            <th colSpan={QTY_COL_COUNT} className="s90d-head-group-qty">
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
            <th className="s90d-sticky-col s90d-col-date s90d-head-shift">
              <S90dBilingualHeader ko="일자" vi="Ngày" />
            </th>
            <th className="s90d-head-shift s90d-col-product s90d-col-product--full">
              <S90dBilingualHeader ko="상품 코드" vi="Mã hàng" />
            </th>
            <th className="s90d-head-shift s90d-col-process">
              <S90dBilingualHeader ko="공정" vi="Công đoạn" />
            </th>
            <th className="s90d-head-shift s90d-col-classification">
              <S90dBilingualHeader ko="분류" vi="Phân loại" />
            </th>
            <th className="s90d-head-qty s90d-head-total-qty">
              <S90dBilingualHeader ko="총수량" vi="Tổng SL" />
            </th>
            <th className="s90d-head-qty s90d-head-ok">
              <S90dBilingualHeader ko="양품수량" vi="SL đạt" />
            </th>
            <th className="s90d-head-qty s90d-head-ng">
              <S90dBilingualHeader ko="불량수량" vi="SL NG" />
            </th>
            <th className="s90d-head-qty">
              <S90dBilingualHeader ko="수율" vi="Hiệu suất" />
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
          {dailySummaries?.length
            ? dailySummaries.flatMap((daily) => {
                if (!daily.hasData) return [];
                const dayDateLabel = formatShortDateLabel(
                  daily.dateKey,
                  daily.dateLabel,
                );
                const dayProductCode = productCode || daily.productCode;
                return renderSummaryProcessDetailRows({
                  processDetails: resolveSummaryProcessDetails(daily),
                  dateLabel: dayDateLabel,
                  productCode: dayProductCode,
                  totalNgQty,
                  t,
                  keyPrefix: daily.dateKey,
                });
              })
            : renderSummaryProcessDetailRows({
                processDetails,
                dateLabel,
                productCode,
                totalNgQty,
                t,
              })}
          {totalRow ? (
            <SummaryProcessRow
              row={totalRow}
              dateLabel={dateLabel}
              processLabel=""
              totalNgQty={totalNgQty}
            />
          ) : null}
          {percentRow ? (
            <SummaryProcessRow
              row={percentRow}
              dateLabel={dateLabel}
              processLabel=""
              totalNgQty={totalNgQty}
            />
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
