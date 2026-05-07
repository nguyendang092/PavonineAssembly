import { useCallback, useEffect, useState } from "react";

const SUPPRESS_MS = 700;

/**
 * Sau khi click link desktop: tắt hover-dropdown tạm thời (giữ behavior cũ).
 */
export function useDesktopDropdownSuppress(closeUserMenu) {
  const [suppressUntil, setSuppressUntil] = useState(0);
  const suppressed = suppressUntil > Date.now();

  useEffect(() => {
    if (!suppressUntil) return undefined;
    const remaining = suppressUntil - Date.now();
    if (remaining <= 0) {
      setSuppressUntil(0);
      return undefined;
    }
    const timer = setTimeout(() => setSuppressUntil(0), remaining);
    return () => clearTimeout(timer);
  }, [suppressUntil]);

  const handleDesktopNavClick = useCallback(() => {
    setSuppressUntil(Date.now() + SUPPRESS_MS);
    closeUserMenu?.();
  }, [closeUserMenu]);

  return { suppressed, handleDesktopNavClick };
}
