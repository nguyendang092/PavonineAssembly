import { useLayoutEffect } from "react";
import { lockAppMainScrollForModal } from "@/utils/appScroll";
import { freezeWorkplaceChartLayout } from "../lib/workplaceChartLayoutGuard";

/** Tránh layout shift / Chart.js resize khi mở modal chi tiết sản lượng. */
export function useWorkplaceDetailModalLayoutGuard(isOpen) {
  useLayoutEffect(() => {
    if (!isOpen) return undefined;

    // Cố định canvas trước khi khóa overflow — tránh biểu đồ nhảy layout.
    const releaseCharts = freezeWorkplaceChartLayout();
    const releaseScroll = lockAppMainScrollForModal({
      modalSelector: ".wpm-backdrop--nested",
    });

    return () => {
      releaseScroll();
      releaseCharts();
    };
  }, [isOpen]);
}
