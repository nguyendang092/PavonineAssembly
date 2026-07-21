import React, { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { S90D_DEFECT_COLUMNS } from "../lib/s90dDefectColumns";
import { isHighDefectCell } from "../lib/buildS90dSummary";
import { formatS90dDefectQty } from "../lib/buildS90dDailySummary";
import { isLateShiftSlot } from "../lib/s90dShiftSlots";
import {
  formatShiftLineLabel,
  formatShortDateLabel,
} from "../lib/s90dDisplayUtils";
import S90dBilingualHeader from "./S90dBilingualHeader";
import S90dDefectCellEditor from "./S90dDefectCellEditor";
import S90dDefectImageThumbs from "./S90dDefectImageThumbs";
import S90dKpiCards from "./S90dKpiCards";

const INFO_COL_COUNT = 5;
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
  dateKey = "",
  boardId = "",
  process = "",
  shiftSlot = "",
  isPercent,
  highlight,
  totalNgQty,
  useDash,
  editable = false,
  onQtyChange,
  onImageChange,
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
        imageUrl={imageUrl}
        defectKey={defectKey}
        dateKey={dateKey}
        boardId={boardId}
        process={process}
        shiftSlot={shiftSlot}
        onQtyChange={onQtyChange}
        onImageChange={onImageChange}
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
  dateKey = "",
  boardId = "",
  onProductCodeChange,
  onShiftFieldChange,
}) {
  const isTotal = row.isTotal;
  const isPercent = row.isPercent;
  const canEdit = editable && !isTotal && !isPercent;

  const trClass = isTotal
    ? "s90d-row-total"
    : isPercent
      ? "s90d-row-percent"
      : "s90d-row-shift";

  const processLabel = isTotal
    ? t("s90dReport.totalLabel", "Kế")
    : isPercent
      ? ""
      : t(`areas.${row.process}`, { defaultValue: row.process });

  const classificationLabel = isTotal
    ? t("s90dReport.totalLabel", "Kế")
    : isPercent
      ? ""
      : row.classification
        ? t(`areas.${row.classification}`, {
            defaultValue: row.classification,
          })
        : processLabel;

  let dateCell = shortDate;
  let lineCell = formatShiftLineLabel(row.shiftSlot);

  if (isTotal) {
    dateCell = shortDate;
    lineCell = `${t("s90dReport.totalLabel", "Kế")}/${t("s90dReport.tabTotal", "Tổng")}`;
  } else if (isPercent) {
    dateCell = "";
    lineCell = t("s90dReport.defectRateRowLabel", "Tỷ lệ theo tổng SL →");
  }

  return (
    <tr className={trClass}>
      <td className="s90d-sticky-col s90d-col-date">{dateCell}</td>
      <td className="s90d-col-line">{lineCell}</td>
      <td className="s90d-col-product" title={isPercent ? undefined : row.productCode}>
        {canEdit ? (
          <input
            type="text"
            className="s90d-cell-input s90d-cell-input--text"
            value={row.productCode ?? ""}
            onChange={(e) => onProductCodeChange?.(e.target.value)}
          />
        ) : (
          isPercent ? "" : row.productCode
        )}
      </td>
      <td className="s90d-process s90d-col-process">{processLabel}</td>
      <td className="s90d-col-class">{classificationLabel}</td>
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
        ) : (
          isPercent ? "" : formatQty(row.okQty, false, useDash)
        )}
      </td>
      <td className={`s90d-num s90d-col-ng ${isTotal ? "s90d-ng-total" : ""}`}>
        {isPercent ? "" : formatQty(row.ngQty, false, useDash)}
      </td>
      <td className="s90d-num s90d-col-yield">
        {isPercent ? "" : formatPct(row.yieldPct, useDash)}
      </td>
      <td className={`s90d-num s90d-col-ng-rate ${isTotal ? "s90d-ng-total" : ""}`}>
        {isPercent ? "" : formatPct(row.ngRatePct, useDash)}
      </td>
      {S90D_DEFECT_COLUMNS.map(({ key }) => (
        <DefectCell
          key={key}
          defectKey={key}
          dateKey={dateKey}
          boardId={boardId}
          process={row.process}
          shiftSlot={row.shiftSlot}
          qty={row.defects[key] ?? 0}
          imageUrl={row.defectImages?.[key] ?? ""}
          isPercent={isPercent}
          useDash={useDash && !isPercent}
          editable={canEdit}
          onQtyChange={
            canEdit ? (value) => onShiftFieldChange?.(key, value) : undefined
          }
          onImageChange={canEdit ? onShiftFieldChange : undefined}
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

export default function S90dProcessShiftTable({
  processSummary,
  dateKey = "",
  boardId = "",
  boardLabel = "",
  boardIndex = 1,
  boardCount = 1,
  useDash = true,
  editable = false,
  onProductCodeChange,
  onShiftFieldChange,
  onRemoveBoard,
}) {
  const { t } = useTranslation();
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
      dateKey={dateKey}
      boardId={boardId}
      onProductCodeChange={onProductCodeChange}
      onShiftFieldChange={
        row.isTotal || row.isPercent
          ? undefined
          : (field, value) => onShiftFieldChange?.(row.shiftSlot, field, value)
      }
    />
  );

  return (
    <article className="s90d-board-card">
      <header className="s90d-board-head">
        <div className="s90d-board-head-main">
          <h3 className="s90d-board-title">
            {t("s90dReport.boardTitle", "Bảng theo dõi chất lượng sản xuất")}
            <span className="s90d-board-badge">{processLabel}</span>
            {boardCount > 1 ? (
              <span className="s90d-board-badge s90d-board-badge--table">
                {boardLabel ||
                  t("s90dReport.boardLabelN", "Bảng {{n}}", { n: boardIndex })}
              </span>
            ) : null}
          </h3>
          <p className="s90d-board-subtitle">
            {t(
              "s90dReport.boardSubtitle",
              "Theo dõi số lượng, hiệu suất và lỗi theo từng ca sản xuất",
            )}
          </p>
        </div>

        <div className="s90d-board-head-actions">
          {onRemoveBoard ? (
            <button
              type="button"
              className="s90d-remove-board-btn"
              onClick={onRemoveBoard}
            >
              {t("s90dReport.removeBoard", "Xóa bảng")}
            </button>
          ) : null}

          <div className="s90d-board-meta">
          <div className="s90d-meta-item">
            <span className="s90d-meta-label">
              {t("s90dReport.metaDate", "Ngày")}
            </span>
            <strong>{shortDate}</strong>
          </div>
          <div className="s90d-meta-item">
            <span className="s90d-meta-label">
              {t("s90dReport.metaProductCode", "Mã hàng")}
            </span>
            {editable ? (
              <input
                type="text"
                className="s90d-meta-input"
                value={productCode}
                onChange={(e) => onProductCodeChange?.(e.target.value)}
              />
            ) : (
              <strong>{productCode}</strong>
            )}
          </div>
          <div className="s90d-meta-item">
            <span className="s90d-meta-label">
              {t("s90dReport.metaProcess", "Công đoạn")}
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
              ? t(
                  "s90dReport.collapseLateShifts",
                  "Ẩn ca 22~24 trở xuống",
                )
              : t(
                  "s90dReport.expandLateShifts",
                  "Hiện ca 22~24, 00~03, 03~05, 05~08",
                )}
          </button>
        </div>
      ) : null}

      <div className="s90d-table-wrap s90d-table-wrap--board">
        <table className="s90d-board-table s90d-process-table-layout">
          <thead>
            <tr className="s90d-head-group">
              <th colSpan={INFO_COL_COUNT} className="s90d-head-group-shift">
                {t("s90dReport.groupShiftInfo", "Thông tin ca")}
              </th>
              <th colSpan={QTY_COL_COUNT} className="s90d-head-group-qty">
                {t("s90dReport.groupQtyYield", "Số lượng & hiệu suất")}
              </th>
              <th
                colSpan={S90D_DEFECT_COLUMNS.length}
                className="s90d-head-group-defect"
              >
                {t("s90dReport.groupDefects", "Chi tiết lỗi")}
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
                <S90dBilingualHeader ko="상품 코드" vi="Mã hàng" />
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
}
