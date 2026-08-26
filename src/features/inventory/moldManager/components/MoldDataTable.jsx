import React, { useMemo, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { MOLD_PAGE_SIZE } from "../lib/moldConstants";
import {
  useHrTableRowVirtualizer,
  HrVirtualTableSpacerRow,
  shouldHrTableVirtualize,
} from "@/hooks/hrTableVirtualization.jsx";
import { MOLD_STATUS_OPTIONS } from "../lib/moldConstants";
import {
  getMoldStatus,
  getMoldStatusHint,
  getShotProgress,
  isShotNearMaintenance,
  parseShotCount,
  resolveTypeStyle,
} from "../lib/moldMetrics";
import { formatMoldNumber, getImagePath } from "../lib/moldUtils";
import MoldRowActionsMenu from "./MoldRowActionsMenu";

function HighlightText({ text, query }) {
  const display = text ?? "—";
  const q = String(query ?? "").trim();
  if (!q) return display;

  const lower = String(display).toLowerCase();
  const qLower = q.toLowerCase();
  const parts = [];
  let start = 0;
  let idx = lower.indexOf(qLower, start);
  let key = 0;

  while (idx !== -1) {
    if (idx > start) parts.push(String(display).slice(start, idx));
    parts.push(
      <mark key={key++} className="mold-hl">
        {String(display).slice(idx, idx + q.length)}
      </mark>,
    );
    start = idx + q.length;
    idx = lower.indexOf(qLower, start);
  }
  if (start < String(display).length) parts.push(String(display).slice(start));
  return <>{parts}</>;
}

function MoldStatusBadge({ status, t }) {
  const labels = {
    active: t("moldManager.statusActive", "Đang dùng"),
    maintenance: t("moldManager.statusMaintenance", "Bảo trì"),
    stopped: t("moldManager.statusStopped", "Ngừng dùng"),
  };

  return (
    <span className={`mold-status mold-status--${status}`}>
      <span className="mold-status-dot" aria-hidden="true" />
      {labels[status] ?? status}
    </span>
  );
}

function formatStatusHint(hint, t) {
  if (!hint?.key) return "";
  const defaults = {
    statusHintManual: "Thiết lập thủ công",
    statusHintActive: "SHOT trong ngưỡng an toàn",
    statusHintStopped: "Vị trí / ghi chú ngưng dùng",
    statusHintShotWarn: "SHOT ≥ {{pct}}% ngưỡng 1M",
    statusHintShotCritical: "SHOT ≥ {{pct}}% — cần bảo trì",
  };
  return t(`moldManager.${hint.key}`, defaults[hint.key] ?? hint.key, {
    pct: hint.pct,
  });
}

function MoldStatusCell({ mold, status, canEdit, onStatusChange, t }) {
  const hint = getMoldStatusHint(mold);
  const hintText = formatStatusHint(hint, t);
  const storedValue = String(mold?.Status ?? "").trim().toLowerCase();

  if (!canEdit) {
    return (
      <div className="mold-status-cell">
        <MoldStatusBadge status={status} t={t} />
        {hintText ? <span className="mold-status-hint">{hintText}</span> : null}
      </div>
    );
  }

  return (
    <div className="mold-status-cell">
      <select
        className={`mold-status-select mold-status-select--${status}`}
        value={storedValue}
        onChange={(e) => onStatusChange?.(mold.id, e.target.value)}
        aria-label={t("moldManager.colStatus", "Trạng thái")}
      >
        {MOLD_STATUS_OPTIONS.map((opt) => (
          <option key={opt.value || "auto"} value={opt.value}>
            {t(`moldManager.${opt.labelKey}`, opt.labelKey)}
          </option>
        ))}
      </select>
      {hintText ? <span className="mold-status-hint">{hintText}</span> : null}
    </div>
  );
}

function MoldPagination({ page, totalPages, onPageChange, t }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const maxButtons = 5;
  let start = Math.max(1, page - 2);
  let end = Math.min(totalPages, start + maxButtons - 1);
  start = Math.max(1, end - maxButtons + 1);

  for (let i = start; i <= end; i += 1) pages.push(i);

  return (
    <div className="mold-pagination">
      <button
        type="button"
        className="mold-page-btn"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label={t("moldManager.prevPage", "Trang trước")}
      >
        ‹
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          className={`mold-page-btn${p === page ? " mold-page-btn--active" : ""}`}
          onClick={() => onPageChange(p)}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        className="mold-page-btn"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label={t("moldManager.nextPage", "Trang sau")}
      >
        ›
      </button>
    </div>
  );
}

export default function MoldDataTable({
  molds,
  searchTerm,
  page,
  onPageChange,
  user,
  failedImages,
  onImageZoom,
  onImageError,
  onViewDetail,
  onEdit,
  onRequestDelete,
  onStatusChange,
}) {
  const { t } = useTranslation();
  const scrollRef = useRef(null);
  const shouldVirtualize = shouldHrTableVirtualize(molds.length);

  const totalPages = Math.max(1, Math.ceil(molds.length / MOLD_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const pageRows = useMemo(() => {
    if (shouldVirtualize) return molds;
    const start = (safePage - 1) * MOLD_PAGE_SIZE;
    return molds.slice(start, start + MOLD_PAGE_SIZE);
  }, [molds, safePage, shouldVirtualize]);

  const getVirtualItemKey = useCallback(
    (index) => molds[index]?.id ?? index,
    [molds],
  );

  const { virtualItems, paddingTop, paddingBottom } = useHrTableRowVirtualizer({
    rowCount: molds.length,
    enabled: shouldVirtualize,
    scrollRef,
    estimateRowHeight: 56,
    getItemKey: getVirtualItemKey,
  });

  const displayRows = useMemo(() => {
    if (!shouldVirtualize) return pageRows;
    return virtualItems
      .map((item) => molds[item.index])
      .filter(Boolean);
  }, [molds, pageRows, shouldVirtualize, virtualItems]);

  const rangeStart = molds.length
    ? shouldVirtualize
      ? 1
      : (safePage - 1) * MOLD_PAGE_SIZE + 1
    : 0;
  const rangeEnd = shouldVirtualize
    ? molds.length
    : Math.min(safePage * MOLD_PAGE_SIZE, molds.length);

  const renderMoldRow = (mold) => {
    const shots = parseShotCount(mold);
    const progress = getShotProgress(shots);
    const status = getMoldStatus(mold);
    const typeStyle = resolveTypeStyle(mold.Type);
    const imagePath = getImagePath(mold.NamePlate);
    const imageKey = `${mold.id}-NamePlate`;

    return (
      <tr key={mold.id}>
        <td className="mold-cell-mono">{mold.No ?? "—"}</td>
        <td className="mold-cell-model">
          <strong>
            <HighlightText text={mold.Model} query={searchTerm} />
          </strong>
          <span>
            <HighlightText text={mold["Production Name"]} query={searchTerm} />
          </span>
        </td>
        <td>
          <span className="mold-code-badge">
            <HighlightText text={mold["Mold Code"]} query={searchTerm} />
          </span>
        </td>
        <td className="mold-cell-mono">
          <HighlightText text={mold["Asset No."]} query={searchTerm} />
        </td>
        <td className="mold-cell-mono">{mold["Mold Size (W*D*H)"] || "—"}</td>
        <td className="mold-cell-mono">{mold["Tooling Weight"] || "—"}</td>
        <td>
          <div>{mold.Location || "—"}</div>
          {mold.Type ? (
            <span className={`mold-type-pill mold-type-pill--${typeStyle}`}>
              {mold.Type}
            </span>
          ) : null}
        </td>
        <td className="mold-cell-mono">
          <HighlightText text={mold["Pavonine Model"]} query={searchTerm} />
        </td>
        <td className="mold-shot-cell">
          <div className="mold-shot-value">{formatMoldNumber(shots)}</div>
          <div className="mold-shot-bar" aria-hidden="true">
            <div
              className={`mold-shot-bar-fill${
                isShotNearMaintenance(shots) ? " mold-shot-bar-fill--warn" : ""
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </td>
        <td>
          <MoldStatusCell
            mold={mold}
            status={status}
            canEdit={Boolean(user)}
            onStatusChange={onStatusChange}
            t={t}
          />
        </td>
        <td>
          {imagePath && !failedImages.has(imageKey) ? (
            <img
              src={imagePath}
              alt={t("moldManager.columns.namePlate")}
              className="mold-thumb"
              loading="lazy"
              onClick={() =>
                onImageZoom({
                  show: true,
                  src: imagePath,
                  alt: mold["Mold Code"],
                })
              }
              onError={() => onImageError(imageKey)}
            />
          ) : (
            <span className="mold-thumb mold-thumb--empty">—</span>
          )}
        </td>
        <td>
          <MoldRowActionsMenu
            canMutate={Boolean(user)}
            onView={() => onViewDetail(mold)}
            onEdit={() => onEdit(mold.id)}
            onDelete={() => onRequestDelete(mold.id)}
          />
        </td>
      </tr>
    );
  };

  return (
    <div className="mold-table-shell">
      <div className="mold-table-headbar">
        <h2 className="mold-table-headbar-title">
          {t("moldManager.tableTitle", "Bảng khuôn — Pavonine")}
        </h2>
        <span className="mold-table-headbar-meta">
          {molds.length} {t("moldManager.tableRows", "dòng")}
          {shouldVirtualize
            ? ` · ${t("moldManager.virtualScroll", "cuộn ảo")}`
            : ` · ${t("moldManager.tablePage", "trang {{current}}/{{total}}", {
                current: safePage,
                total: totalPages,
              })}`}
        </span>
      </div>

      <div
        ref={shouldVirtualize ? scrollRef : null}
        className={`mold-table-wrap${shouldVirtualize ? " hr-table-virtual-scroll" : ""}`}
      >
        <table className="mold-table">
          <thead>
            <tr>
              <th>{t("moldManager.columns.no")}</th>
              <th>{t("moldManager.colModelProduct", "Model / Sản phẩm")}</th>
              <th>{t("moldManager.columns.moldCode")}</th>
              <th>{t("moldManager.columns.assetNo")}</th>
              <th>{t("moldManager.columns.moldSize")}</th>
              <th>{t("moldManager.columns.toolingWeight")}</th>
              <th>{t("moldManager.colLocationType", "Vị trí / Loại")}</th>
              <th>{t("moldManager.columns.pavonineModel")}</th>
              <th>{t("moldManager.columns.shotCounter")}</th>
              <th>{t("moldManager.colStatus", "Trạng thái")}</th>
              <th>{t("moldManager.colImage", "Ảnh")}</th>
              <th>{t("moldManager.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {shouldVirtualize ? (
              <>
                <HrVirtualTableSpacerRow colSpan={12} heightPx={paddingTop} />
                {displayRows.map((mold) => renderMoldRow(mold))}
                <HrVirtualTableSpacerRow colSpan={12} heightPx={paddingBottom} />
              </>
            ) : (
              pageRows.map((mold) => renderMoldRow(mold))
            )}
            {!molds.length ? (
              <tr>
                <td colSpan={12} style={{ textAlign: "center", padding: "32px" }}>
                  {t("moldManager.noResults", "Không có bản ghi phù hợp.")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mold-table-foot">
        <span className="mold-table-foot-info">
          {t("moldManager.showingRows", "Hiển thị {{from}}–{{to}} / {{total}} dòng", {
            from: rangeStart,
            to: rangeEnd,
            total: molds.length,
          })}
        </span>
        {!shouldVirtualize ? (
          <MoldPagination
            page={safePage}
            totalPages={totalPages}
            onPageChange={onPageChange}
            t={t}
          />
        ) : null}
      </div>
    </div>
  );
}
