import { useLayoutEffect, useState } from "react";
import { ATTENDANCE_FILTER_DROPDOWN_HEIGHT_PX } from "./attendanceListShared";

function attachPlacementListeners(update) {
  update();
  window.addEventListener("scroll", update, true);
  window.addEventListener("resize", update);
  return () => {
    window.removeEventListener("scroll", update, true);
    window.removeEventListener("resize", update);
  };
}

/** Menu bộ lọc (portal fixed). */
export function useAttendanceFilterDropdownPlacement(open, anchorRef) {
  const [placement, setPlacement] = useState(null);
  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    const update = () => {
      const btn = anchorRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const w = Math.min(288, window.innerWidth - 16);
      let left =
        window.innerWidth < 640
          ? Math.max(8, Math.min(r.left, window.innerWidth - w - 8))
          : Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
      const top = r.bottom + 6;
      const maxAvail = Math.max(120, window.innerHeight - top - 12);
      const maxHeight = Math.min(ATTENDANCE_FILTER_DROPDOWN_HEIGHT_PX, maxAvail);
      setPlacement({ top, left, width: w, maxHeight });
    };
    return attachPlacementListeners(update);
  }, [open, anchorRef]);
  return placement;
}

function useToolbarMenuPlacement(open, anchorRef, onAutoClose, options = {}) {
  const { maxWidth = 288, closeIfHidden = true } = options;
  const [placement, setPlacement] = useState(null);
  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    const update = () => {
      const btn = anchorRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      if (closeIfHidden && r.width <= 0 && r.height <= 0) {
        setPlacement(null);
        onAutoClose?.();
        return;
      }
      const w = Math.min(maxWidth, window.innerWidth - 16);
      let left =
        window.innerWidth < 640
          ? Math.max(8, Math.min(r.left, window.innerWidth - w - 8))
          : Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
      const top = r.bottom + 6;
      const maxHeight = Math.max(160, window.innerHeight - top - 12);
      setPlacement({ top, left, width: w, maxHeight });
    };
    return attachPlacementListeners(update);
  }, [open, anchorRef, maxWidth, closeIfHidden, onAutoClose]);
  return placement;
}

export function useAttendanceActionDropdownPlacement(
  open,
  anchorRef,
  onAutoClose,
) {
  return useToolbarMenuPlacement(open, anchorRef, onAutoClose);
}

export function useAttendancePrintDropdownPlacement(
  open,
  anchorRef,
  onAutoClose,
) {
  return useToolbarMenuPlacement(open, anchorRef, onAutoClose);
}

/** Menu OFF / lễ / nghỉ bù. */
export function useAttendanceOffHolidayDropdownPlacement(open, anchorRef, onAutoClose) {
  const [placement, setPlacement] = useState(null);
  useLayoutEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    const update = () => {
      const btn = anchorRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      if (r.width <= 0 && r.height <= 0) {
        setPlacement(null);
        onAutoClose?.();
        return;
      }
      const w = Math.min(368, window.innerWidth - 16);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
      const top = r.bottom + 8;
      const maxHeight = Math.max(200, window.innerHeight - top - 12);
      setPlacement({ top, left, width: w, maxHeight });
    };
    return attachPlacementListeners(update);
  }, [open, anchorRef, onAutoClose]);
  return placement;
}
