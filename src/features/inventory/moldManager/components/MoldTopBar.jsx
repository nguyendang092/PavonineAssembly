import React from "react";
import { FiDownload, FiPlus } from "react-icons/fi";
import { useTranslation } from "react-i18next";

function RulerIcon() {
  return (
    <svg
      className="mold-topbar-ruler"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect x="3" y="8" width="18" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
      {[6, 9, 12, 15, 18].map((x) => (
        <line
          key={x}
          x1={x}
          y1="8"
          x2={x}
          y2={x % 3 === 0 ? 12 : 10}
          stroke="currentColor"
          strokeWidth="1.2"
        />
      ))}
    </svg>
  );
}

export default function MoldTopBar({
  subtitle,
  onExport,
  onAddNew,
  showAddButton,
}) {
  const { t } = useTranslation();

  return (
    <header className="mold-topbar">
      <div className="mold-topbar-title-wrap">
        <RulerIcon />
        <div>
          <h1 className="mold-topbar-title">{t("moldManager.title")}</h1>
          {subtitle ? <p className="mold-topbar-subtitle">{subtitle}</p> : null}
        </div>
      </div>

      <div className="mold-topbar-actions">
        <button type="button" className="mold-btn mold-btn--ghost" onClick={onExport}>
          <FiDownload size={14} aria-hidden="true" />
          {t("moldManager.exportExcel")}
        </button>
        {showAddButton ? (
          <button type="button" className="mold-btn mold-btn--primary" onClick={onAddNew}>
            <FiPlus size={14} aria-hidden="true" />
            {t("moldManager.addNewLabel", "Thêm khuôn mới")}
          </button>
        ) : null}
      </div>
    </header>
  );
}
