import { useEffect, useMemo, useRef } from "react";
import { showToast } from "./toast";

function mapAlertType(type) {
  if (type === "success" || type === "error" || type === "warning") return type;
  return "info";
}

/**
 * Cầu nối thông báo cũ → Toast góc màn hình.
 * `alert={{ show, type, message }}` hoặc `message` + `onClose`.
 */
function AlertMessage({
  alert: alertProp,
  message,
  onClose,
  autoHideMs,
}) {
  const alert = useMemo(() => {
    if (alertProp != null) return alertProp;
    return {
      show: Boolean(message),
      type: "info",
      message: message || "",
    };
  }, [alertProp, message]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const alertText = String(alert?.message ?? "").trim();
  const shouldShow = Boolean(alert?.show) && Boolean(alertText);

  useEffect(() => {
    if (!shouldShow) return undefined;
    showToast({
      type: mapAlertType(alert?.type),
      message: alertText,
      duration: autoHideMs,
    });
    onCloseRef.current?.();
    return undefined;
  }, [shouldShow, alertText, alert?.type, autoHideMs]);

  return null;
}

export default AlertMessage;
