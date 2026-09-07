import React, { memo } from "react";
import KpiCard from "./KpiCard";
import FiltersAndTableSection from "./FiltersAndTableSection";
import { formatKRW } from "../lib/parse";

function ReportKpiSection({
  tl,
  fileName,
  stats,
  structuredSummary,
  tableSectionProps,
}) {
  const { monthCompareMode } = tableSectionProps;

  return (
    <section className="wah-inv-shell">
      <div className="wah-inv-meta-bar">
        <p>
          <strong>{tl("fileLabel", "File")}:</strong>{" "}
          <code>{fileName || "—"}</code>
          <span className="mx-2 opacity-40">|</span>
          <strong>{tl("period", "Kỳ")}:</strong> {stats.periodLabel}
        </p>
        <span className="wah-inv-badge">
          {tl("comparisonRowsCount", "{{count}} dòng", {
            count: structuredSummary.rows,
          })}
        </span>
      </div>

      {monthCompareMode ? (
        <div className="wah-inv-compare-banner">
          {tl(
            "monthCompareModeHint",
            "Chế độ so sánh: chọn 2 tháng — bảng hiển thị chênh lệch (tháng sau − tháng trước) cho mã trùng khớp.",
          )}
        </div>
      ) : null}

      <div className="wah-inv-kpi-grid">
        <KpiCard
          label={tl("colActualQty", "SL thực tế")}
          value={structuredSummary.actual.toLocaleString("vi-VN", {
            maximumFractionDigits: 4,
          })}
          tone="amber"
        />
        <KpiCard
          label={tl("colSystemQtyKr", "SL hệ thống")}
          value={structuredSummary.sys.toLocaleString("vi-VN", {
            maximumFractionDigits: 4,
          })}
          tone="slate"
        />
        <KpiCard
          label={tl("colMonthlyDiffKr", "GAP")}
          value={structuredSummary.monthlyDiff.toLocaleString("vi-VN", {
            maximumFractionDigits: 4,
          })}
          tone="rose"
        />
        <KpiCard
          label={tl("gapAmountLabel", "Số tiền GAP")}
          value={formatKRW(structuredSummary.gapAmount)}
          tone="emerald"
        />
        <KpiCard
          label={tl("qtyDiffRateLabel", "Tỉ lệ chênh lệch")}
          value={
            structuredSummary.qtyDiffRate == null
              ? "—"
              : `${(structuredSummary.qtyDiffRate * 100).toLocaleString(
                  "vi-VN",
                  {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  },
                )}%`
          }
          tone="slate"
        />
      </div>

      <FiltersAndTableSection {...tableSectionProps} />
    </section>
  );
}

export default memo(ReportKpiSection);
