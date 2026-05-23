import React, { memo } from "react";
import KpiCard from "./KpiCard";
import OverviewChartsSection from "./OverviewChartsSection";
import FiltersAndTableSection from "./FiltersAndTableSection";
import { formatKRW } from "../lib/parse";

/** KPI + biểu đồ + bộ lọc + bảng (khi đã có dữ liệu). */
function ReportKpiSection({
  tl,
  fileName,
  stats,
  structuredSummary,
  chartSectionProps,
  tableSectionProps,
}) {
  return (
    <>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {tl("fileLabel", "파일")}:
          </span>{" "}
          <span className="font-mono text-xs">{fileName || "—"}</span>
          {" · "}
          <span className="font-semibold">{tl("period", "Kỳ")}:</span>{" "}
          {stats.periodLabel}
        </p>
      </div>

      <div className="dashboard-report-surface mb-3 rounded-lg border border-indigo-200/80 bg-gradient-to-br from-indigo-50/90 to-white p-3 dark:border-indigo-900/60 dark:from-indigo-950/40 dark:to-slate-900">
        <h2 className="text-base font-black uppercase tracking-wide text-indigo-950 dark:text-indigo-100">
          {tl(
            "structuredTableTitle",
            "Bảng báo cáo theo cấu trúc tháng × mã",
          )}
        </h2>

        <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            label={tl("colActualQty", "실사수량")}
            value={structuredSummary.actual.toLocaleString("vi-VN", {
              maximumFractionDigits: 4,
            })}
            tone="amber"
          />
          <KpiCard
            label={tl("colSystemQtyKr", "SL 전산수량")}
            value={structuredSummary.sys.toLocaleString("vi-VN", {
              maximumFractionDigits: 4,
            })}
            tone="slate"
          />
          <KpiCard
            label={tl("colMonthlyDiffKr", "월별 차이")}
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

        <OverviewChartsSection {...chartSectionProps} />
        <FiltersAndTableSection {...tableSectionProps} />
      </div>
    </>
  );
}

export default memo(ReportKpiSection);
