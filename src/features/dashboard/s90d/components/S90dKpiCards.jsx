import React from "react";
import { useTranslation } from "react-i18next";

function formatQty(value) {
  return Number(value || 0).toLocaleString("vi-VN");
}

function formatPct(value) {
  if (value == null || value === "") return "0.0%";
  return `${Number(value).toLocaleString("vi-VN")}%`;
}

export default function S90dKpiCards({ totalRow }) {
  const { t } = useTranslation();
  const yieldPct = totalRow?.yieldPct ?? 0;
  const ringPct = Math.min(100, Math.max(0, Number(yieldPct) || 0));

  return (
    <div className="s90d-kpi-grid">
      <div className="s90d-kpi-card s90d-kpi-card--yield">
        <div
          className="s90d-kpi-ring"
          style={{
            background: `conic-gradient(#22c55e ${ringPct * 3.6}deg, #e2e8f0 0)`,
          }}
        >
          <div className="s90d-kpi-ring-inner">
            <strong>{formatPct(yieldPct)}</strong>
          </div>
        </div>
        <p className="s90d-kpi-label">
          {t("s90dReport.kpiAvgYield", "Hiệu suất")}
        </p>
      </div>

      <div className="s90d-kpi-card s90d-kpi-card--total">
        <p className="s90d-kpi-title">
          {t("s90dReport.kpiTotalQty", "Tổng số lượng")}
        </p>
        <p className="s90d-kpi-value">{formatQty(totalRow?.totalQty)}</p>
      </div>

      <div className="s90d-kpi-card s90d-kpi-card--ok">
        <p className="s90d-kpi-title">
          {t("s90dReport.kpiOkQty", "Số lượng đạt")}
        </p>
        <p className="s90d-kpi-value">{formatQty(totalRow?.okQty)}</p>
      </div>

      <div className="s90d-kpi-card s90d-kpi-card--ng">
        <p className="s90d-kpi-title">
          {t("s90dReport.kpiNgQty", "Số lượng NG")}
        </p>
        <p className="s90d-kpi-value s90d-kpi-value--ng">
          {formatQty(totalRow?.ngQty)}
        </p>
      </div>

      <div className="s90d-kpi-card s90d-kpi-card--rate">
        <p className="s90d-kpi-title">
          {t("s90dReport.kpiNgRate", "Tỷ lệ NG")}
        </p>
        <p className="s90d-kpi-value s90d-kpi-value--rate">
          {formatPct(totalRow?.ngRatePct)}
        </p>
      </div>
    </div>
  );
}
