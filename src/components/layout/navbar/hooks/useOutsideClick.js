import { useEffect } from "react";

/**
 * Đóng UI khi click không nằm trong rootRef (hoặc ignoreSelector khớp target).
 */
export function useOutsideClick(enabled, rootRef, onOutside, ignoreSelector) {
  useEffect(() => {
    if (!enabled || !rootRef?.current) return undefined;
    const handler = (e) => {
      const root = rootRef.current;
      if (!root || root.contains(e.target)) return;
      if (ignoreSelector && e.target.closest?.(ignoreSelector)) return;
      onOutside();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [enabled, onOutside, rootRef, ignoreSelector]);
}
