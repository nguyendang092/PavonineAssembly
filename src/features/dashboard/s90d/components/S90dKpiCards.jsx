import React, { useMemo } from "react";
import { useProductionReportContext } from "../../productionReport/ProductionReportContext";
import { useReportT } from "../../productionReport/useReportTranslation";
import { buildProductCodeYieldItems } from "../lib/s90dChartData";
import { formatS90dYieldPct, resolveS90dTotalYieldPct } from "../lib/s90dDisplayUtils";

function formatQty(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function formatPct(value) {
  if (value == null || value === "") return "0.0%";
  return `${Number(value).toLocaleString("vi-VN")}%`;
}

function S90dYieldRing({ yieldPct, label, sublabel, isValid = true }) {
  if (!isValid || yieldPct == null) {
    return (
      <div className="s90d-kpi-card s90d-kpi-card--yield s90d-kpi-card--yield-invalid">
        <div className="s90d-kpi-ring s90d-kpi-ring--invalid">
          <div className="s90d-kpi-ring-inner">
            <strong>—</strong>
          </div>
        </div>
        {label ? <p className="s90d-kpi-product-code">{label}</p> : null}
        <p className="s90d-kpi-label">{sublabel}</p>
      </div>
    );
  }

  const ringPct = Math.min(100, Math.max(0, Number(yieldPct) || 0));

  return (
    <div className="s90d-kpi-card s90d-kpi-card--yield">
      <div
        className="s90d-kpi-ring"
        style={{
          background: `conic-gradient(#22c55e ${ringPct * 3.6}deg, #e2e8f0 0)`,
        }}
      >
        <div className="s90d-kpi-ring-inner">
          <strong>{formatS90dYieldPct(yieldPct, "0.0%")}</strong>
        </div>
      </div>
      {label ? <p className="s90d-kpi-product-code">{label}</p> : null}
      <p className="s90d-kpi-label">{sublabel}</p>
    </div>
  );
}

export default function S90dKpiCards({
  totalRow,
  processDetails = null,
  showProductYieldBreakdown = true,
}) {
  const rt = useReportT();
  const {
    fixedBoardSpecs,
    fixedBoardSpecsAllProcesses,
    processes,
    usesProductSubCodes,
    defaultProductCode,
  } = useProductionReportContext();

  const productYieldItems = useMemo(
    () =>
      buildProductCodeYieldItems(processDetails, {
        boardSpecs: fixedBoardSpecs,
        processes,
        requireFullProcessChain: fixedBoardSpecsAllProcesses,
        usesProductSubCodes,
        defaultProductCode,
      }),
    [
      processDetails,
      fixedBoardSpecs,
      fixedBoardSpecsAllProcesses,
      processes,
      usesProductSubCodes,
      defaultProductCode,
    ],
  );

  const showProductYieldCharts =
    showProductYieldBreakdown && productYieldItems.length >= 2;
  const aggregateYieldPct = resolveS90dTotalYieldPct(totalRow);
  const aggregateYieldValid = aggregateYieldPct != null;
  const ngRatePct = totalRow?.ngRatePct ?? null;

  return (
    <div
      className={`s90d-kpi-grid${
        showProductYieldCharts ? " s90d-kpi-grid--product-yields" : ""
      }`}
    >
      {showProductYieldCharts ? (
        <div className="s90d-kpi-yield-row">
          {productYieldItems.map((item) => (
            <S90dYieldRing
              key={`${item.parentProductCode ?? item.productCode}-${item.codeSlot ?? "all"}`}
              yieldPct={item.yieldPct}
              label={item.label}
              sublabel={rt("kpiAvgYield", "Hiệu suất")}
              isValid={item.isValid}
            />
          ))}
        </div>
      ) : (
        <S90dYieldRing
          yieldPct={aggregateYieldPct}
          sublabel={rt("kpiAvgYield", "Hiệu suất")}
          isValid={aggregateYieldValid}
        />
      )}

      <div className="s90d-kpi-card s90d-kpi-card--total">
        <p className="s90d-kpi-title">
          {rt("kpiTotalQty", "Tổng số lượng")}
        </p>
        <p className="s90d-kpi-value">{formatQty(totalRow?.totalQty)}</p>
      </div>

      <div className="s90d-kpi-card s90d-kpi-card--ok">
        <p className="s90d-kpi-title">
          {rt("kpiOkQty", "Số lượng đạt")}
        </p>
        <p className="s90d-kpi-value">{formatQty(totalRow?.okQty)}</p>
      </div>

      <div className="s90d-kpi-card s90d-kpi-card--ng">
        <p className="s90d-kpi-title">
          {rt("kpiNgQty", "Số lượng NG")}
        </p>
        <p className="s90d-kpi-value s90d-kpi-value--ng">
          {formatQty(totalRow?.ngQty)}
        </p>
      </div>

      <div className="s90d-kpi-card s90d-kpi-card--rate">
        <p className="s90d-kpi-title">
          {rt("kpiNgRate", "Tỷ lệ NG")}
        </p>
        <p className="s90d-kpi-value s90d-kpi-value--rate">
          {ngRatePct == null ? "—" : formatPct(ngRatePct)}
        </p>
      </div>
    </div>
  );
}

