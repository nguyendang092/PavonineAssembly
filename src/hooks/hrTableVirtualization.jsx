import { useLayoutEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

/** Ngưỡng bật virtual scroll — đồng bộ với Payroll Month Grid philosophy (tránh render hàng trăm DOM). */
export const HR_TABLE_VIRTUAL_THRESHOLD = 50;

/** Overscan vừa đủ scroll nhanh (~8 hàng), không render dư quá nhiều. */
export const HR_TABLE_VIRTUAL_OVERSCAN = 8;

export const HR_TABLE_VIRTUAL_MAX_HEIGHT = "min(70vh, 720px)";

export function shouldHrTableVirtualize(rowCount) {
  return (Number(rowCount) || 0) >= HR_TABLE_VIRTUAL_THRESHOLD;
}

/**
 * Virtualizer hàng bảng HR — pattern @tanstack/react-virtual giống Payroll Month Grid.
 */
export function useHrTableRowVirtualizer({
  rowCount,
  enabled,
  scrollRef,
  estimateRowHeight = 40,
  overscan = HR_TABLE_VIRTUAL_OVERSCAN,
  getItemKey,
}) {
  const shouldVirtualize = enabled && shouldHrTableVirtualize(rowCount);

  const virtualizer = useVirtualizer({
    count: shouldVirtualize ? rowCount : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateRowHeight,
    overscan,
    getItemKey,
  });

  useLayoutEffect(() => {
    if (!shouldVirtualize) return;
    virtualizer.measure();
  }, [shouldVirtualize, rowCount, virtualizer]);

  const virtualItems = shouldVirtualize ? virtualizer.getVirtualItems() : [];
  const paddingTop =
    shouldVirtualize && virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    shouldVirtualize && virtualItems.length > 0
      ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0;

  return {
    shouldVirtualize,
    virtualizer,
    virtualItems,
    paddingTop,
    paddingBottom,
  };
}

/** Spacer `<tr>` cho tbody virtual — giữ chiều cao scroll tổng. */
export function HrVirtualTableSpacerRow({ colSpan, heightPx }) {
  if (!heightPx || heightPx <= 0) return null;
  return (
    <tr aria-hidden="true" className="hr-vt-spacer">
      <td
        colSpan={colSpan}
        style={{
          height: heightPx,
          padding: 0,
          border: 0,
          lineHeight: 0,
        }}
      />
    </tr>
  );
}
