import React, { useEffect, useMemo, useRef, useState } from "react";

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
 * Thông báo nổi thống nhất (top-center), tự ẩn sau `autoHideMs` (mặc định 3s).
 * - `alert={{ show, type, message }}` — type: success | error | info | neutral
 * - `onClose` — đồng bộ state cha (khuyến nghị: `() => setAlert(a => ({ ...a, show: false }))`)
 * - Hoặc `message` + `onClose` (kiểu toast cũ)
 */
function AlertMessage({
  alert: alertProp,
  message,
  onClose,
  autoHideMs = 3000,
}) {
  const alert = useMemo(() => {
    if (alertProp != null) return alertProp;
    return {
      show: Boolean(message),
      type: "neutral",
      message: message || "",
    };
  }, [alertProp, message]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [visible, setVisible] = useState(false);
  const alertText = String(alert?.message ?? "").trim();
  const shouldShow = Boolean(alert?.show) && Boolean(alertText);

  useEffect(() => {
    if (!shouldShow || autoHideMs <= 0) {
      setVisible(false);
      return undefined;
    }

    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      onCloseRef.current?.();
    }, autoHideMs);

    return () => clearTimeout(timer);
  }, [shouldShow, alert?.message, alert?.type, autoHideMs]);

  if (!visible || !alertText) return null;

  const type = alert.type || "neutral";

  const handleDismiss = () => {
    setVisible(false);
    onCloseRef.current?.();
  };

  return (
    <div
      className="fixed top-6 left-1/2 flex max-w-[min(100vw-2rem,28rem)] -translate-x-1/2 justify-center px-3"
      style={{ zIndex: "var(--z-toast, 1300)" }}
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        onClick={handleDismiss}
        className={`cursor-pointer rounded px-4 py-2 text-center text-sm font-semibold shadow transition-all duration-300 ${toneClass(type)}`}
      >
        {alertText}
      </button>
    </div>
  );
}

export default AlertMessage;
