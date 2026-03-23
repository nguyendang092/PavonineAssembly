import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactDOM from "react-dom";
import "./NotificationBell.css";

// NotificationBell: Hiển thị chuông thông báo nổi, có badge số lượng và popup nội dung tùy ý
export default function NotificationBell({
  count = 0,
  children,
  title,
  onExport,
  exportLabel,
  inline = false,
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const body = document.body;
    const currentCount = Number(body.dataset.popupLockCount || "0");

    if (currentCount === 0) {
      body.dataset.popupLockOverflow = body.style.overflow || "";
      body.dataset.popupLockTouchAction = body.style.touchAction || "";
      body.style.overflow = "hidden";
      body.style.touchAction = "none";
    }

    body.dataset.popupLockCount = String(currentCount + 1);

    return () => {
      const count = Number(body.dataset.popupLockCount || "1");
      const nextCount = Math.max(0, count - 1);

      if (nextCount === 0) {
        body.style.overflow = body.dataset.popupLockOverflow || "";
        body.style.touchAction = body.dataset.popupLockTouchAction || "";
        delete body.dataset.popupLockCount;
        delete body.dataset.popupLockOverflow;
        delete body.dataset.popupLockTouchAction;
      } else {
        body.dataset.popupLockCount = String(nextCount);
      }
    };
  }, [open]);

  const titleDisplay = title || t("notificationBell.defaultTitle");
  const labelDisplay = exportLabel || t("notificationBell.defaultExport");

  // Bell button (fixed, floating)
  const bellButton = (
    <button
      className={`noti-bell-trigger ${
        inline ? "noti-bell-trigger--inline" : "noti-bell-trigger--floating"
      }`}
      title={titleDisplay}
      onClick={() => setOpen((o) => !o)}
    >
      <span role="img" aria-label="bell" className="noti-bell-icon">
        🔔
      </span>
      {count > 0 && <span className="noti-bell-badge">{count}</span>}
    </button>
  );

  // Popup content (centered, modern, scrollable)
  const popup = (
    <>
      <div className="noti-bell-overlay" onClick={() => setOpen(false)} />
      <div className="noti-bell-popup">
        <div className="noti-bell-shell">
          <div className="noti-bell-header">
            <div className="noti-bell-title">{titleDisplay}</div>
            <div className="noti-bell-header-actions">
              <button
                onClick={onExport}
                className="noti-bell-btn noti-bell-btn--export"
              >
                {labelDisplay}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="noti-bell-btn noti-bell-btn--close"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="noti-bell-content">
            {children || (
              <div className="noti-bell-empty">
                {t("notificationBell.noNotifications")}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div>
      {inline ? bellButton : ReactDOM.createPortal(bellButton, document.body)}
      {open && ReactDOM.createPortal(popup, document.body)}
    </div>
  );
}
