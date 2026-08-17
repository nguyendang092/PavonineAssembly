import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FiMaximize2, FiMinimize2, FiX } from "react-icons/fi";
import { useTranslation } from "react-i18next";

export default function MoldImageLightbox({ src, alt, onClose }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!src) return null;

  return createPortal(
    <div
      className={`mold-modal-backdrop mold-image-lightbox${
        expanded ? " mold-image-lightbox--expanded" : ""
      }`}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="mold-image-lightbox-panel"
        role="dialog"
        aria-modal="true"
        aria-label={alt || t("moldManager.imagePreview", "Xem ảnh")}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mold-image-lightbox-toolbar">
          <p className="mold-image-lightbox-title">{alt || t("moldManager.imagePreview", "Xem ảnh")}</p>
          <div className="mold-image-lightbox-actions">
            <button
              type="button"
              className="mold-image-lightbox-btn"
              onClick={() => setExpanded((v) => !v)}
              title={
                expanded
                  ? t("moldManager.imageCollapse", "Thu nhỏ")
                  : t("moldManager.imageExpand", "Xem đầy đủ")
              }
              aria-label={
                expanded
                  ? t("moldManager.imageCollapse", "Thu nhỏ")
                  : t("moldManager.imageExpand", "Xem đầy đủ")
              }
            >
              {expanded ? <FiMinimize2 size={16} /> : <FiMaximize2 size={16} />}
            </button>
            <button
              type="button"
              className="mold-image-lightbox-btn mold-image-lightbox-btn--close"
              onClick={onClose}
              title={t("moldManager.close")}
              aria-label={t("moldManager.close")}
            >
              <FiX size={18} />
            </button>
          </div>
        </header>
        <div className="mold-image-lightbox-body">
          <img src={src} alt={alt || ""} className="mold-image-lightbox-img" />
        </div>
      </div>
    </div>,
    document.body,
  );
}
