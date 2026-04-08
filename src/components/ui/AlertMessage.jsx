import React, { useEffect, useMemo } from "react";

const toneClass = (type) => {
  switch (type) {
    case "success":
      return "bg-green-100 text-green-800 border border-green-300";
    case "error":
      return "bg-red-100 text-red-800 border border-red-300";
    case "info":
      return "bg-gray-100 text-gray-800 border border-gray-300";
    case "neutral":
    default:
      return "bg-slate-900/90 text-white border border-slate-700";
  }
};

/**
 * Thông báo nổi thống nhất (top-center).
 * - `alert={{ show, type, message }}` — type: success | error | info | neutral
 * - Hoặc `message` + `onClose` (kiểu toast cũ, tự ẩn sau 3s khi có onClose)
 */
function AlertMessage({ alert: alertProp, message, onClose }) {
  const alert = useMemo(() => {
    if (alertProp != null) return alertProp;
    return {
      show: Boolean(message),
      type: "neutral",
      message: message || "",
    };
  }, [alertProp, message]);

  useEffect(() => {
    if (!onClose || !alert?.show) return;
    const timer = setTimeout(() => onClose(), 3000);
    return () => clearTimeout(timer);
  }, [alert?.show, alert?.message, onClose]);

  if (!alert?.show || !String(alert.message ?? "").trim()) return null;

  const type = alert.type || "neutral";

  return (
    <div
      className="fixed top-6 left-1/2 z-[100] flex max-w-[min(100vw-2rem,28rem)] -translate-x-1/2 justify-center px-3"
      role="status"
      aria-live="polite"
    >
      <div
        className={`rounded px-4 py-2 text-center text-sm font-semibold shadow transition-all duration-300 ${toneClass(type)}`}
      >
        {alert.message}
      </div>
    </div>
  );
}

export default AlertMessage;
