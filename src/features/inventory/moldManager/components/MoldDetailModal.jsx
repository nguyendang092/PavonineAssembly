import React, { useMemo } from "react";
import { FiEdit2, FiX } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { MOLD_SHOT_MAINTENANCE_THRESHOLD } from "../lib/moldConstants";
import {
  getMoldStatus,
  getShotMaintenanceDisplay,
  parseShotCount,
  resolveTypeStyle,
} from "../lib/moldMetrics";
import { formatMoldNumber, getImagePath } from "../lib/moldUtils";

function DetailField({ label, value, wide = false, mono = false }) {
  const display = value != null && String(value).trim() !== "" ? value : "—";
  return (
    <div className={`mold-detail-field${wide ? " mold-detail-field--wide" : ""}`}>
      <span className="mold-detail-field-label">{label}</span>
      <strong className={mono ? "mold-detail-field-value mold-detail-field-value--mono" : "mold-detail-field-value"}>
        {display}
      </strong>
    </div>
  );
}

function DetailSection({ title, children }) {
  return (
    <section className="mold-detail-section">
      <header className="mold-detail-section-head">
        <h3>{title}</h3>
      </header>
      <div className="mold-detail-section-grid">{children}</div>
    </section>
  );
}

function MediaCard({ label, imagePath, alt, onZoom, emptyLabel }) {
  return (
    <div className="mold-detail-media">
      <span className="mold-detail-field-label">{label}</span>
      {imagePath ? (
        <button
          type="button"
          className="mold-detail-media-frame mold-detail-media-frame--clickable"
          onClick={() => onZoom?.({ show: true, src: imagePath, alt })}
        >
          <img src={imagePath} alt={alt} loading="lazy" />
        </button>
      ) : (
        <div className="mold-detail-media-frame mold-detail-media-frame--empty">
          <span>{emptyLabel}</span>
        </div>
      )}
    </div>
  );
}

export default function MoldDetailModal({
  mold,
  onClose,
  onEdit,
  canEdit = false,
  onImageZoom,
}) {
  const { t } = useTranslation();

  const status = useMemo(() => getMoldStatus(mold), [mold]);
  const shots = useMemo(() => parseShotCount(mold), [mold]);
  const shotDisplay = useMemo(
    () => getShotMaintenanceDisplay(shots, MOLD_SHOT_MAINTENANCE_THRESHOLD),
    [shots],
  );
  const typeStyle = resolveTypeStyle(mold?.Type);
  const namePlatePath = getImagePath(mold?.NamePlate);
  const processPath = getImagePath(mold?.Process);
  const pmPath = getImagePath(mold?.["PM Image"]);

  const statusLabel = {
    active: t("moldManager.statusActive", "Đang dùng"),
    maintenance: t("moldManager.statusMaintenance", "Bảo trì"),
    stopped: t("moldManager.statusStopped", "Ngừng dùng"),
  }[status];

  const moldsPerProduct = mold?.["Molds per Product"];
  const moldsPerProductDisplay =
    moldsPerProduct != null && String(moldsPerProduct).trim() !== ""
      ? `${moldsPerProduct} ${t("moldManager.kpiUnit", "bộ")}`
      : "—";

  const updatedLabel = mold?.Date
    ? mold.Date
    : new Date().toLocaleDateString("vi-VN");

  return (
    <div className="mold-modal-backdrop mold-detail-backdrop" onClick={onClose}>
      <div
        className="mold-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mold-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mold-detail-hero">
          <div className="mold-detail-hero-text">
            <p className="mold-detail-eyebrow">
              {t("moldManager.detailEyebrow", "Hồ sơ khuôn")}
            </p>
            <h2 id="mold-detail-title" className="mold-detail-title">
              {t("moldManager.viewDetailLabel", "Xem chi tiết")}
            </h2>
          </div>
          <div className="mold-detail-hero-actions">
            {mold?.["Mold Code"] ? (
              <span className="mold-detail-code-badge">{mold["Mold Code"]}</span>
            ) : null}
            <button
              type="button"
              className="mold-detail-close"
              onClick={onClose}
              aria-label={t("moldManager.close")}
            >
              <FiX size={18} />
            </button>
          </div>
        </header>

        <div className="mold-detail-statusbar">
          <span className={`mold-detail-status mold-detail-status--${status}`}>
            <span className="mold-detail-status-dot" aria-hidden="true" />
            {statusLabel}
          </span>
          {mold?.Type ? (
            <span className={`mold-detail-type mold-detail-type--${typeStyle}`}>
              <span className="mold-detail-type-dot" aria-hidden="true" />
              {mold.Type}
            </span>
          ) : null}
        </div>

        <div className="mold-detail-body">
          <div className="mold-detail-main">
            <DetailSection title={t("moldManager.detailGeneral", "Thông tin chung")}>
              <DetailField
                label={t("moldManager.columns.subsidiary", "Chi nhánh")}
                value={mold?.Subsidiary}
              />
              <DetailField
                label={t("moldManager.columns.model", "Model")}
                value={mold?.Model}
              />
              <DetailField
                label={t("moldManager.columns.productionName", "Tên sản phẩm")}
                value={mold?.["Production Name"]}
                wide
              />
              <DetailField
                label={t("moldManager.columns.moldCode", "Mã khuôn")}
                value={mold?.["Mold Code"]}
                mono
              />
              <DetailField
                label={t("moldManager.columns.assetNo", "Số tài sản")}
                value={mold?.["Asset No."]}
                mono
              />
            </DetailSection>

            <DetailSection
              title={t("moldManager.detailTechnical", "Thông số kỹ thuật")}
            >
              <DetailField
                label={t("moldManager.detailSizeLabel", "Kích thước (W×D×H)")}
                value={
                  mold?.["Mold Size (W*D*H)"]
                    ? `${mold["Mold Size (W*D*H)"]} mm`
                    : "—"
                }
                mono
              />
              <DetailField
                label={t("moldManager.columns.toolingWeight", "Trọng lượng")}
                value={
                  mold?.["Tooling Weight"]
                    ? `${mold["Tooling Weight"]} kg`
                    : "—"
                }
                mono
              />
              <DetailField
                label={t("moldManager.columns.location", "Vị trí")}
                value={mold?.Location}
              />
              <DetailField
                label={t("moldManager.columns.date", "Ngày tạo")}
                value={mold?.Date}
                mono
              />
              <DetailField
                label={t("moldManager.columns.pavonineModel", "Code")}
                value={mold?.["Pavonine Model"]}
                mono
              />
              <DetailField
                label={t("moldManager.detailMoldCount", "Số khuôn")}
                value={moldsPerProductDisplay}
              />
            </DetailSection>

            <DetailSection
              title={t("moldManager.detailProcessPm", "Quy trình / PM khuôn")}
            >
              <MediaCard
                label={t("moldManager.columns.process", "Quy trình")}
                imagePath={processPath}
                alt={t("moldManager.columns.process")}
                onZoom={onImageZoom}
                emptyLabel="—"
              />
              <MediaCard
                label={t("moldManager.columns.pmImage", "PM khuôn")}
                imagePath={pmPath}
                alt={t("moldManager.columns.pmImage")}
                onZoom={onImageZoom}
                emptyLabel="—"
              />
            </DetailSection>
          </div>

          <aside className="mold-detail-aside">
            <div className="mold-detail-shot-card">
              <p className="mold-detail-shot-label">
                {t("moldManager.detailShotTotal", "SHOT lũy kế")}
              </p>
              <p className="mold-detail-shot-value">
                {formatMoldNumber(shotDisplay.shots)}
              </p>
              <p className="mold-detail-shot-meta">
                {t("moldManager.detailShotThreshold", "{{pct}}% ngưỡng bảo trì ({{threshold}} shot)", {
                  pct: shotDisplay.pct,
                  threshold: formatMoldNumber(shotDisplay.threshold),
                })}
              </p>
              <div className="mold-detail-shot-bar" aria-hidden="true">
                <div
                  className="mold-detail-shot-bar-fill"
                  style={{ width: `${shotDisplay.pct}%` }}
                />
              </div>
            </div>

            <div className="mold-detail-template">
              <span className="mold-detail-field-label">
                {t("moldManager.columns.namePlate", "Template")}
              </span>
              {namePlatePath ? (
                <button
                  type="button"
                  className="mold-detail-template-frame mold-detail-template-frame--clickable"
                  onClick={() =>
                    onImageZoom?.({
                      show: true,
                      src: namePlatePath,
                      alt: mold?.["Mold Code"] || "Template",
                    })
                  }
                >
                  <img
                    src={namePlatePath}
                    alt={t("moldManager.columns.namePlate")}
                    loading="lazy"
                  />
                </button>
              ) : (
                <div className="mold-detail-template-frame mold-detail-template-frame--empty">
                  <span>{t("moldManager.detailNoTemplate", "Chưa có template")}</span>
                </div>
              )}
            </div>
          </aside>
        </div>

        <footer className="mold-detail-foot">
          <p className="mold-detail-foot-meta">
            {t("moldManager.detailFootMeta", "STT #{{no}} · Cập nhật lần cuối {{date}}", {
              no: String(mold?.No ?? "—").padStart(3, "0"),
              date: updatedLabel,
            })}
          </p>
          <div className="mold-detail-foot-actions">
            <button type="button" className="mold-btn mold-btn--ghost" onClick={onClose}>
              {t("moldManager.close")}
            </button>
            {canEdit ? (
              <button type="button" className="mold-btn mold-btn--primary" onClick={onEdit}>
                <FiEdit2 size={14} aria-hidden="true" />
                {t("moldManager.editLabel", "Sửa thông tin")}
              </button>
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  );
}
