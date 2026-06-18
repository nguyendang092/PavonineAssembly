import { useEffect } from "react";

/** Khóa scroll trang khi modal lưới tháng mở (`#app-main-scroll` + body). */
export function usePayrollMonthModalScrollLock(open) {
  useEffect(() => {
    if (!open) return undefined;
    const html = document.documentElement;
    const body = document.body;
    const mainScroll = document.getElementById("app-main-scroll");
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevMainOverflow = mainScroll?.style.overflow ?? "";
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    if (mainScroll) mainScroll.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      if (mainScroll) mainScroll.style.overflow = prevMainOverflow;
    };
  }, [open]);
}

/**
 * message / subtitle cho overlay lưới tháng (tải, render deferred, tổng hợp).
 */
export function buildPayrollMonthGridOverlayCopy({
  tlPage,
  loadingMore = false,
  isDisplayStale = false,
  isSummariesBusy = false,
  summaryProgress = null,
}) {
  const message =
    isSummariesBusy && summaryProgress
      ? tlPage(
          "monthlyTimesheetSummariesProgress",
          "Đang tính tổng hợp tháng… ({{done}}/{{total}})",
          {
            done: summaryProgress.done,
            total: summaryProgress.total,
          },
        )
      : loadingMore
        ? tlPage(
            "monthlyTimesheetLoadingMore",
            "Đang tải thêm dữ liệu của tháng…",
          )
        : tlPage("monthlyTimesheetLoading", "Đang tải dữ liệu điểm danh…");

  const subtitle =
    isDisplayStale && !loadingMore && !isSummariesBusy
      ? tlPage("monthlyTimesheetRendering", "Đang cập nhật lưới…")
      : undefined;

  return { message, subtitle };
}
