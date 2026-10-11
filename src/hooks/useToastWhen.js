import { useEffect, useRef } from "react";
import { showToast } from "@/components/ui/toast";

/**
 * Toast khi `value` đổi sang chuỗi khác rỗng.
 * `stickyKey`: cùng một sự kiện (vd. lỗi ngày tải) không bắn lại khi count đổi.
 */
export function useToastWhen(value, type = "error", stickyKey) {
  const lastRef = useRef("");
  useEffect(() => {
    const text = String(value ?? "").trim();
    const identity =
      stickyKey != null && String(stickyKey) !== ""
        ? String(stickyKey)
        : text;
    if (!text) {
      lastRef.current = "";
      return undefined;
    }
    if (identity === lastRef.current) return undefined;
    lastRef.current = identity;
    showToast({ type, message: text });
    return undefined;
  }, [value, type, stickyKey]);
}
