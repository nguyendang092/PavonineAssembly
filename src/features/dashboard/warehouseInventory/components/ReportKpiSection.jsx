import React, { memo, useMemo } from "react";
import KpiCard from "./KpiCard";
import FiltersAndTableSection from "./FiltersAndTableSection";
import { formatSignedQty, signedDeltaClass } from "../lib/formatDelta";
import { summarizeStructuredRowsByMonth } from "../lib/filterStructuredRows";
import { InventoryQtyCell, InventoryWonCell } from "./InventoryValueCells";

function formatRate(rate) {
  if (rate == null) return "—";
  return `${(rate * 100).toLocaleString("vi-VN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function MonthDashboard({ tl, months, monthFilter, setMonthFilter }) {
  const metrics = [
    {
      key: "actual",
      label: tl("monthDashActual", "Thực tế EA"),
      render: (m) => <InventoryQtyCell value={m.actual} fractionDigits={2} />,
    },
    {
      key: "sys",
      label: tl("monthDashSys", "Hệ thống EA"),
      render: (m) => <InventoryQtyCell value={m.sys} fractionDigits={2} />,
    },
    {
      key: "gap",
      label: tl("monthDashGap", "GAP EA"),
      className: (m) => signedDeltaClass(m.monthlyDiff),
      render: (m) => (
        <InventoryQtyCell value={m.monthlyDiff} delta fractionDigits={2} />
      ),
    },
    {
      key: "rate",
      label: tl("qtyDiffRateLabel", "Tỉ lệ lệch"),
      render: (m) => formatRate(m.qtyDiffRate),
    },
    {
      key: "gapAmt",
      label: tl("gapAmountLabel", "Tiền GAP"),
      className: (m) => signedDeltaClass(m.gapAmount),
      render: (m) => <InventoryWonCell value={m.gapAmount} signed />,
    },
    {
      key: "amount",
      label: tl("colAmount", "Tiền"),
      render: (m) => <InventoryWonCell value={m.amountActual} />,
    },
  ];

  return (
    <div className="wah-inv-month-dash">
      <div className="wah-inv-month-dash__head">
        <p className="wah-inv-month-dash__title">
          {tl("monthDashTitle", "Dashboard theo tháng")}
        </p>
        <p className="wah-inv-month-dash__hint">
          {tl(
            "monthDashHint",
            "Mỗi cột một tháng — cùng hàng để so sánh.",
          )}
        </p>
      </div>
      <div className="wah-inv-month-dash__scroll">
        <table className="wah-inv-month-dash__table">
          <colgroup>
            <col className="wah-inv-month-dash__col-metric" />
            {months.map((m) => (
              <col key={m.monthKey} className="wah-inv-month-dash__col-month" />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="wah-inv-month-dash__metric" scope="col">
                {tl("monthDashMetric", "Chỉ số")}
              </th>
              {months.map((m) => {
                const active = monthFilter === m.monthKey;
                return (
                  <th key={m.monthKey} className="wah-inv-month-dash__col" scope="col">
                    <button
                      type="button"
                      className={`wah-inv-month-dash__month${active ? " wah-inv-month-dash__month--on" : ""}`}
                      onClick={() =>
                        setMonthFilter(active ? "" : m.monthKey)
                      }
                    >
                      {m.month}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric) => (
              <tr key={metric.key}>
                <th scope="row" className="wah-inv-month-dash__metric">
                  {metric.label}
                </th>
                {months.map((m) => (
                  <td
                    key={`${metric.key}-${m.monthKey}`}
                    className={`wah-inv-month-dash__val ${metric.className?.(m) ?? ""}`.trim()}
                  >
                    {metric.render(m)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ReportKpiSection({
  tl,
  structuredSummary,
  tableSectionProps,
}) {
  const { monthCompareMode, monthFilter, setMonthFilter, compareMonthKeys } =
    tableSectionProps;
  const monthCompareNeedsPick =
    monthCompareMode && (compareMonthKeys?.length ?? 0) < 2;
  const comparing = Boolean(monthCompareMode && !monthCompareNeedsPick);
  const monthSummaries = useMemo(
    () =>
      summarizeStructuredRowsByMonth(
        tableSectionProps.filteredStructuredRows,
      ),
    [tableSectionProps.filteredStructuredRows],
  );

  return (
    <section className="wah-inv-report">
      <FiltersAndTableSection
        {...tableSectionProps}
        kpi={
          monthCompareNeedsPick ? null : comparing ? (
            <div className="wah-inv-kpi-grid">
              <KpiCard
                label={tl("kpiDeltaActual", "Δ thực tế")}
                hint={tl("kpiHintDelta", "Cuối − đầu")}
                value={formatSignedQty(structuredSummary.actual)}
                tone="emerald"
              />
              <KpiCard
                label={tl("kpiDeltaSys", "Δ hệ thống")}
                hint={tl("kpiHintDelta", "Cuối − đầu")}
                value={formatSignedQty(structuredSummary.sys)}
                tone="sky"
              />
              <KpiCard
                label={tl("kpiDeltaGap", "Δ GAP")}
                hint={tl("kpiHintDelta", "Cuối − đầu")}
                value={formatSignedQty(structuredSummary.monthlyDiff)}
                tone="rose"
              />
              <KpiCard
                label={tl("kpiDeltaAmount", "Δ tiền")}
                hint={tl("kpiHintDelta", "Cuối − đầu")}
                value={
                  <InventoryWonCell
                    value={structuredSummary.amountActual}
                    signed
                  />
                }
                tone="emerald"
              />
              <KpiCard
                label={tl("kpiChangedShare", "Mã đổi SL")}
                hint={tl("kpiHintChanged", "Có đổi số lượng")}
                value={`${structuredSummary.changedQtyRows ?? 0}/${structuredSummary.rows}`}
                tone="violet"
              />
            </div>
          ) : monthSummaries.length ? (
            <MonthDashboard
              tl={tl}
              months={monthSummaries}
              monthFilter={monthFilter}
              setMonthFilter={setMonthFilter}
            />
          ) : null
        }
      />
    </section>
  );
}

export default memo(ReportKpiSection);
