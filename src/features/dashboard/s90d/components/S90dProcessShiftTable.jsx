import React, { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useReportT } from "../../productionReport/useReportTranslation";
import { S90D_DEFECT_COLUMNS } from "../lib/s90dDefectColumns";
import {
  formatS90dDefectQty,
  formatS90dYieldPct,
  formatShiftLineLabel,
  formatShortDateLabel,
  formatS90dTypeSlotLabel,
  isHighDefectCell,
  resolveS90dTotalYieldPct,
} from "../lib/s90dDisplayUtils";
import { isLateShiftSlot } from "../lib/s90dShiftSlots";
import S90dBilingualHeader from "./S90dBilingualHeader";
import S90dDefectCellEditor from "./S90dDefectCellEditor";
import S90dDefectImageThumbs from "./S90dDefectImageThumbs";
import S90dKpiCards from "./S90dKpiCards";

const INFO_COL_COUNT_BASE = 4;
const QTY_COL_COUNT = 5;

function formatQty(value, isPercentRow, useDash) {
  if (isPercentRow) {
    return value > 0 ? `${value}%` : "0%";
  }
  if (useDash && !Number(value)) return "-";
  return Number(value || 0).toLocaleString("vi-VN");
}

function formatPct(value, useDash) {
  if (value == null || value === "") return useDash ? "-" : "0%";
  return `${Number(value).toLocaleString("vi-VN")}%`;
}

function DefectCell({
  qty,
  imageUrl = "",
  defectKey,
  isPercent,
  highlight,
  totalNgQty,
  useDash,
  editable = false,
  onQtyChange,
}) {
  const showPink = !isPercent && isHighDefectCell(qty, totalNgQty);
  const className = [
    "s90d-num",
    "s90d-defect-cell",
    highlight || showPink ? "s90d-cell-alert" : "",
    isPercent ? "s90d-cell-percent" : "",
    editable && !isPercent ? "s90d-defect-cell--editable" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (editable && !isPercent) {
    return (
      <S90dDefectCellEditor
        qty={qty}
        onQtyChange={onQtyChange}
        className={className}
      />
    );
  }

  const display = useDash
    ? formatS90dDefectQty(qty, isPercent)
    : formatQty(qty, isPercent, false);
  return (
    <td className={className}>
      <div className="s90d-defect-cell-display">
        <span>{display}</span>
        <S90dDefectImageThumbs
          imageMap={{ [defectKey]: imageUrl }}
          defectKey={defectKey}
          isPercent={isPercent}
        />
      </div>
    </td>
  );
}

const ShiftRow = memo(function ShiftRow({
  row,
  shortDate,
  totalNgQty,
  t,
  useDash,
  editable = false,
  onShiftFieldChange,
  showCodeSlotColumn = false,
  defaultCodeSlot = null,
}) {
  const rt = useReportT();
  const isTotal = row.isTotal;
  const isPercent = row.isPercent;
  const canEdit = editable && !isTotal && !isPercent;

  const trClass = isTotal
    ? "s90d-row-total"
    : isPercent
      ? "s90d-row-percent"
      : "s90d-row-shift";

  const processLabel = isTotal
    ? rt("totalLabel", "TOTAL")
    : isPercent
      ? ""
      : rt(`areas.${row.process}`, { defaultValue: row.process });

  const classificationLabel = isTotal
    ? rt("totalLabel", "TOTAL")
    : isPercent
      ? ""
      : row.classification
        ? rt(`areas.${row.classification}`, {
            defaultValue: row.classification,
          })
        : processLabel;

  const processCellLabel =
    !isPercent && classificationLabel && classificationLabel !== processLabel
      ? `${processLabel} / ${classificationLabel}`
      : processLabel;

  let dateCell = shortDate;
  let lineCell = formatShiftLineLabel(row.shiftSlot);

  if (isTotal) {
    dateCell = shortDate;
    lineCell = `${rt("totalLabel", "TOTAL")}/${rt("tabTotal", "Tổng")}`;
  } else if (isPercent) {
    dateCell = "";
    lineCell = rt("defectRateRowLabel", "Tỷ lệ theo tổng SL →");
  }

  const codeSlot = row.codeSlot ?? defaultCodeSlot;
  const codeSlotLabel =
    showCodeSlotColumn && !isPercent && codeSlot
      ? formatS90dTypeSlotLabel(codeSlot)
      : "";

  return (
    <tr className={trClass}>
      <td className="s90d-sticky-col s90d-col-date">{dateCell}</td>
      <td className="s90d-col-line">{lineCell}</td>
      <td
        className="s90d-col-product"
        title={isPercent ? undefined : row.productCode}
      >
        {isPercent ? "" : row.productCode}
      </td>
      {showCodeSlotColumn ? (
        <td
          className={`s90d-col-code-slot${
            codeSlot === "D"
              ? " s90d-col-code-slot--d"
              : codeSlot === "E"
                ? " s90d-col-code-slot--e"
                : ""
          }`}
        >
          {codeSlotLabel}
        </td>
      ) : null}
      <td className="s90d-process s90d-col-process">
        {isPercent ? "" : processCellLabel}
      </td>
      <td className="s90d-num s90d-col-total-qty">
        {isPercent ? "" : formatQty(row.totalQty, false, useDash)}
      </td>
      <td className="s90d-num s90d-col-ok">
        {canEdit ? (
          <input
            type="number"
            min="0"
            step="1"
            className="s90d-cell-input s90d-cell-input--qty"
            value={row.okQty || ""}
            onChange={(e) => onShiftFieldChange?.("okQty", e.target.value)}
          />
        ) : isPercent ? (
          ""
        ) : (
          formatQty(row.okQty, false, useDash)
        )}
      </td>
      <td className={`s90d-num s90d-col-ng ${isTotal ? "s90d-ng-total" : ""}`}>
        {isPercent ? "" : formatQty(row.ngQty, false, useDash)}
      </td>
      <td className="s90d-num s90d-col-yield">
        {isPercent
          ? ""
          : formatS90dYieldPct(
              isTotal ? resolveS90dTotalYieldPct(row) : row.yieldPct,
              useDash ? "-" : "0%",
            )}
      </td>
      <td
        className={`s90d-num s90d-col-ng-rate ${isTotal ? "s90d-ng-total" : ""}`}
      >
        {isPercent ? "" : formatPct(row.ngRatePct, useDash)}
      </td>
      {S90D_DEFECT_COLUMNS.map(({ key }) => (
        <DefectCell
          key={key}
          defectKey={key}
          qty={row.defects[key] ?? 0}
          imageUrl={row.defectImages?.[key] ?? ""}
          isPercent={isPercent}
          useDash={useDash && !isPercent}
          editable={canEdit}
          onQtyChange={
            canEdit ? (value) => onShiftFieldChange?.(key, value) : undefined
          }
          highlight={
            !isPercent &&
            isTotal &&
            (key === "scratch" || key === "dent") &&
            (row.defects[key] ?? 0) > 0
          }
          totalNgQty={totalNgQty}
        />
      ))}
    </tr>
  );
});

export default memo(function S90dProcessShiftTable({
  processSummary,
  dateKey = "",
  boardLabel = "",
  boardIndex = 1,
  boardCount = 1,
  useDash = true,
  editable = false,
  onShiftFieldChange,
}) {
  const { t } = useTranslation();
  const rt = useReportT();
  const [lateShiftsExpanded, setLateShiftsExpanded] = useState(false);
  const totalRow = processSummary.totalRow;
  const totalNgQty = totalRow?.ngQty ?? 0;
  const processLabel = t(`areas.${processSummary.process}`, {
    defaultValue: processSummary.process,
  });
  const shortDate = formatShortDateLabel(
    dateKey,
    processSummary.dateLabel?.replace(/월\s*/g, "/").replace(/일/g, "") ?? "",
  );
  const productCode =
    processSummary.shiftRows?.[0]?.productCode ??
    totalRow?.productCode ??
    "S90D";
  const displayProductCode = boardLabel || productCode;
  const codeSlot = processSummary.codeSlot;
  const showCodeSlotColumn = codeSlot === "D" || codeSlot === "E";
  const infoColCount = INFO_COL_COUNT_BASE + (showCodeSlotColumn ? 1 : 0);
  const tableTitle =
    boardLabel ||
    (codeSlot
      ? `${productCode} · ${formatS90dTypeSlotLabel(codeSlot)}`
      : productCode);

  const { primaryShiftRows, lateShiftRows } = useMemo(() => {
    const primary = [];
    const late = [];
    for (const row of processSummary.shiftRows ?? []) {
      if (isLateShiftSlot(row.shiftSlot)) {
        late.push(row);
      } else {
        primary.push(row);
      }
    }
    return { primaryShiftRows: primary, lateShiftRows: late };
  }, [processSummary.shiftRows]);

  const renderShiftRow = (row) => (
    <ShiftRow
      key={`${processSummary.process}-${row.shiftSlot}`}
      row={row}
      shortDate={shortDate}
      totalNgQty={totalNgQty}
      t={t}
      useDash={useDash}
      editable={editable}
      onShiftFieldChange={
        row.isTotal || row.isPercent
          ? undefined
          : (field, value) => onShiftFieldChange?.(row.shiftSlot, field, value)
      }
      showCodeSlotColumn={showCodeSlotColumn}
      defaultCodeSlot={codeSlot}
    />
  );

  return (
    <article
      className={`s90d-board-card${
        codeSlot === "D"
          ? " s90d-board-card--coded"
          : codeSlot === "E"
            ? " s90d-board-card--codee"
            : ""
      }`}
    >
      <header className="s90d-board-head s90d-board-head--compact">
        <div className="s90d-board-head-main">
          <h3 className="s90d-board-title">
            {rt("boardTitle", "BẢNG SẢN LƯỢNG")}
            <span className="s90d-board-badge">{processLabel}</span>
            <span className="s90d-board-badge s90d-board-badge--table">
              {tableTitle}
            </span>
            {boardCount > 1 ? (
              <span className="s90d-board-badge s90d-board-badge--index">
                {boardIndex}/{boardCount}
              </span>
            ) : null}
          </h3>
        </div>

        <div className="s90d-board-head-actions">
          <div className="s90d-board-meta s90d-board-meta--inline-row">
            <div className="s90d-meta-chip">
              <span className="s90d-meta-label">{rt("metaDate", "Ngày")}</span>
              <strong>{shortDate}</strong>
            </div>
            <div className="s90d-meta-chip">
              <span className="s90d-meta-label">
                {rt("metaProductCode", "Mã hàng")}
              </span>
              <strong>{displayProductCode}</strong>
            </div>
            {codeSlot ? (
              <div className="s90d-meta-chip">
                <span className="s90d-meta-label">
                  {formatS90dTypeSlotLabel(codeSlot)}
                </span>
                <strong>{formatS90dTypeSlotLabel(codeSlot)}</strong>
              </div>
            ) : null}
            <div className="s90d-meta-chip">
              <span className="s90d-meta-label">
                {rt("metaProcess", "Công đoạn")}
              </span>
              <strong>{processLabel}</strong>
            </div>
          </div>
        </div>
      </header>

      <S90dKpiCards totalRow={totalRow} />

      {lateShiftRows.length > 0 ? (
        <div className="s90d-table-toolbar">
          <button
            type="button"
            className="s90d-expand-shifts-btn"
            aria-expanded={lateShiftsExpanded}
            onClick={() => setLateShiftsExpanded((expanded) => !expanded)}
          >
            {lateShiftsExpanded
              ? rt("collapseLateShifts", "Ẩn ca 22~24 trở xuống")
              : rt("expandLateShifts", "Hiện ca 22~24, 00~03, 03~05, 05~08")}
          </button>
        </div>
      ) : null}

      <div className="s90d-table-wrap s90d-table-wrap--board">
        <table className="s90d-board-table s90d-process-table-layout">
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
              <th className="s90d-sticky-col s90d-head-shift">
                <S90dBilingualHeader ko="일자" vi="Ngày" />
              </th>
              <th className="s90d-head-shift">
                <S90dBilingualHeader ko="line 구분" vi="Line" />
              </th>
              <th className="s90d-head-shift s90d-col-product">
                <S90dBilingualHeader ko="모델명" vi="Mã hàng" />
              </th>
              {showCodeSlotColumn ? (
                <th className="s90d-head-shift s90d-col-code-slot">
                  <S90dBilingualHeader ko="타입" vi="Type" />
                </th>
              ) : null}
              <th className="s90d-head-shift s90d-col-process">
                <S90dBilingualHeader ko="공정" vi="Công đoạn" />
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
            {primaryShiftRows.map(renderShiftRow)}
            {lateShiftsExpanded ? lateShiftRows.map(renderShiftRow) : null}
            {totalRow ? renderShiftRow(totalRow) : null}
            {processSummary.percentRow
              ? renderShiftRow(processSummary.percentRow)
              : null}
          </tbody>
        </table>
      </div>
    </article>
  );
});
