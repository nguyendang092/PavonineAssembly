import { useEffect } from "react";

/** Đóng menu dropdown khi cuộn trang/bảng — trừ khi cuộn bên trong panel menu. */
export function useCloseDropdownOnScroll(open, panelRef, onClose) {
  useEffect(() => {
    if (!open) return;
    const onScroll = (event) => {
      const target = event.target;
      if (target instanceof Node && panelRef.current?.contains(target)) {
        return;
      }
      onClose();
    };
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [open, panelRef, onClose]);
}
