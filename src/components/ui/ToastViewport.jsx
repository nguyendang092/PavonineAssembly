import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiInfo,
  FiX,
  FiXCircle,
} from "react-icons/fi";
import { dismissToast, subscribeToasts } from "./toast";
import "./toastViewport.css";

const ICONS = {
  success: FiCheckCircle,
  error: FiXCircle,
  warning: FiAlertTriangle,
  info: FiInfo,
};

function ToastViewport() {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const titles = {
    success: t("toast.success", { defaultValue: "Thành công" }),
    error: t("toast.error", { defaultValue: "Lỗi" }),
    warning: t("toast.warning", { defaultValue: "Cảnh báo" }),
    info: t("toast.info", { defaultValue: "Thông báo" }),
  };

  useEffect(() => subscribeToasts(setItems), []);

  if (typeof document === "undefined" || items.length === 0) return null;

  return createPortal(
    <div className="app-toast-viewport" aria-live="polite" aria-relevant="additions">
      {items.map((item) => {
        const Icon = ICONS[item.type] || FiInfo;
        return (
          <div
            key={item.id}
            className={`app-toast app-toast--${item.type}`}
            role={item.type === "error" ? "alert" : "status"}
          >
            <Icon className="app-toast__icon" aria-hidden="true" />
            <div className="app-toast__body">
              <p className="app-toast__title">{titles[item.type] || titles.info}</p>
              <p className="app-toast__message">{item.message}</p>
            </div>
            <button
              type="button"
              className="app-toast__close"
              aria-label={t("toast.close", { defaultValue: "Đóng thông báo" })}
              onClick={() => dismissToast(item.id)}
            >
              <FiX aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}

export default ToastViewport;
