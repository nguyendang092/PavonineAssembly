import React, { memo } from "react";
import KpiCard from "./KpiCard";
import FiltersAndTableSection from "./FiltersAndTableSection";
import { formatKRW } from "../lib/parse";
import { formatSignedKRW, formatSignedQty } from "../lib/formatDelta";

function ReportKpiSection({
  tl,
  structuredSummary,
  tableSectionProps,
}) {
  const { monthCompareMode } = tableSectionProps;
  const monthCompareNeedsPick =
    monthCompareMode &&
    (!tableSectionProps.monthCompareFrom ||
      !tableSectionProps.monthCompareTo);
  const comparing = Boolean(monthCompareMode && !monthCompareNeedsPick);

  return (
    <section className="wah-inv-report">
      <FiltersAndTableSection
        {...tableSectionProps}
        kpi={
          monthCompareNeedsPick ? null : (
            <div className="wah-inv-kpi-grid">
              <KpiCard
                label={
                  comparing
                    ? tl("kpiDeltaActual", "Δ thực tế")
                    : tl("colActualQty", "Thực tế")
                }
                hint={
                  comparing
                    ? tl("kpiHintDelta", "Sau − trước")
                    : tl("kpiHintActual", "Số lượng kiểm kê")
                }
                value={
                  comparing
                    ? formatSignedQty(structuredSummary.actual)
                    : structuredSummary.actual.toLocaleString("vi-VN", {
                        maximumFractionDigits: 4,
                      })
                }
                tone={comparing ? "emerald" : "amber"}
              />
              <KpiCard
                label={
                  comparing
                    ? tl("kpiDeltaSys", "Δ hệ thống")
                    : tl("colSystemQtyKr", "Hệ thống")
                }
                hint={
                  comparing
                    ? tl("kpiHintDelta", "Sau − trước")
                    : tl("kpiHintSys", "Số trên sổ")
                }
                value={
                  comparing
                    ? formatSignedQty(structuredSummary.sys)
                    : structuredSummary.sys.toLocaleString("vi-VN", {
                        maximumFractionDigits: 4,
                      })
                }
                tone="sky"
              />
              <KpiCard
                label={
                  comparing
                    ? tl("kpiDeltaGap", "Δ GAP")
                    : tl("colMonthlyDiffKr", "GAP")
                }
                hint={
                  comparing
                    ? tl("kpiHintDelta", "Sau − trước")
                    : tl("kpiHintGap", "Thực tế − hệ thống")
                }
                value={
                  comparing
                    ? formatSignedQty(structuredSummary.monthlyDiff)
                    : structuredSummary.monthlyDiff.toLocaleString("vi-VN", {
                        maximumFractionDigits: 4,
                      })
                }
                tone="rose"
              />
              <KpiCard
                label={
                  comparing
                    ? tl("kpiDeltaAmount", "Δ tiền")
                    : tl("gapAmountLabel", "Tiền GAP")
                }
                hint={
                  comparing
                    ? tl("kpiHintDelta", "Sau − trước")
                    : tl("kpiHintGapAmt", "Giá trị chênh")
                }
                value={
                  comparing
                    ? formatSignedKRW(structuredSummary.amountActual)
                    : formatKRW(structuredSummary.gapAmount)
                }
                tone="emerald"
              />
              <KpiCard
                label={
                  comparing
                    ? tl("kpiChangedShare", "Mã đổi SL")
                    : tl("qtyDiffRateLabel", "Tỉ lệ lệch")
                }
                hint={
                  comparing
                    ? tl("kpiHintChanged", "Có đổi số lượng")
                    : tl("kpiHintRate", "Dòng GAP ≠ 0")
                }
                value={
                  comparing
                    ? `${structuredSummary.changedQtyRows ?? 0}/${structuredSummary.rows}`
                    : structuredSummary.qtyDiffRate == null
                      ? "—"
                      : `${(structuredSummary.qtyDiffRate * 100).toLocaleString(
                          "vi-VN",
                          {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          },
                        )}%`
                }
                tone="violet"
              />
            </div>
          )
        }
      />
    </section>
  );
}

export default memo(ReportKpiSection);
