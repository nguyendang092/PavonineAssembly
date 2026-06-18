import LoadingBlock from "@/components/ui/LoadingBlock";

/**
 * Overlay / inline loading cho lưới tháng và bảng giờ công ngày.
 * `mode="overlay"` — phủ trên vùng bảng (giữ layout, tránh giật khi render).
 */
export default function PayrollMonthGridLoadingOverlay({
  active,
  message,
  subtitle,
  mode = "overlay",
  className = "",
}) {
  if (!active) return null;

  if (mode === "inline") {
    return (
      <div
        className={`flex min-h-[12rem] items-center justify-center py-8 ${className}`}
        aria-busy="true"
        aria-live="polite"
      >
        <LoadingBlock message={message} subtitle={subtitle} size="md" />
      </div>
    );
  }

  return (
    <div
      className={`payroll-month-grid-loading-overlay absolute inset-0 z-[200] flex items-center justify-center bg-white/80 backdrop-blur-[2px] dark:bg-slate-900/85 ${className}`}
      aria-busy="true"
      aria-live="polite"
    >
      <LoadingBlock
        message={message}
        subtitle={subtitle}
        size="md"
        className="py-4"
      />
    </div>
  );
}
