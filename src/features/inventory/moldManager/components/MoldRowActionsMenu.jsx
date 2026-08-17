import React, { useEffect, useRef, useState } from "react";
import { FiMoreHorizontal } from "react-icons/fi";
import { useTranslation } from "react-i18next";

export default function MoldRowActionsMenu({
  onView,
  onEdit,
  onDelete,
  canMutate,
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (event) => {
      if (!wrapRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div className="mold-actions-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`mold-actions-btn${open ? " mold-actions-btn--open" : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("moldManager.actions")}
        onClick={() => setOpen((v) => !v)}
      >
        <FiMoreHorizontal size={16} />
      </button>

      {open ? (
        <div className="mold-actions-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onView();
            }}
          >
            {t("moldManager.viewDetailLabel", "Xem chi tiết")}
          </button>
          {canMutate ? (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onEdit();
                }}
              >
                {t("moldManager.editLabel", "Sửa thông tin")}
              </button>
              <div className="mold-actions-menu-divider" role="separator" />
              <button
                type="button"
                role="menuitem"
                className="mold-actions-menu--danger"
                onClick={() => {
                  setOpen(false);
                  onDelete();
                }}
              >
                {t("moldManager.deleteLabel", "Xóa khuôn")}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
