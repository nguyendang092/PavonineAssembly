import React from "react";
import { useTranslation } from "react-i18next";
import { formatMoldNumberCompact } from "../lib/moldUtils";

export default function MoldKpiCards({ summary }) {
  const { t } = useTranslation();

  const cards = [
    {
      key: "total",
      tone: "steel",
      label: t("moldManager.kpiTotal", "Tổng số khuôn"),
      value: `${summary.total} ${t("moldManager.kpiUnit", "bộ")}`,
      meta: t("moldManager.kpiTotalMeta", "Đăng ký trong hệ thống"),
    },
    {
      key: "inUse",
      tone: "ok",
      label: t("moldManager.kpiInUse", "Đang sử dụng"),
      value: `${summary.inUse} / ${summary.total}`,
      meta: t("moldManager.kpiInUseMeta", "{{pct}}% đang vận hành", {
        pct: summary.utilizationPct,
      }),
      metaClass: "mold-kpi-meta--up",
    },
    {
      key: "maintenance",
      tone: "warn",
      label: t("moldManager.kpiMaintenance", "Cần bảo trì"),
      value: `${summary.maintenance} ${t("moldManager.kpiUnit", "bộ")}`,
      meta:
        summary.overThreshold > 0
          ? t("moldManager.kpiMaintenanceAlert", "▲ {{count}} vượt ngưỡng SHOT", {
              count: summary.overThreshold,
            })
          : t("moldManager.kpiMaintenanceOk", "Trong ngưỡng an toàn"),
      metaClass: summary.overThreshold > 0 ? "mold-kpi-meta--warn" : "",
    },
    {
      key: "shots",
      tone: "ink",
      label: t("moldManager.kpiTotalShots", "Tổng SHOT lũy kế"),
      value: formatMoldNumberCompact(summary.totalShots),
      meta: t("moldManager.kpiShotsMeta", "Cập nhật theo bản ghi"),
    },
  ];

  return (
    <div className="mold-kpi-grid">
      {cards.map((card) => (
        <article
          key={card.key}
          className={`mold-kpi-card mold-kpi-card--${card.tone}`}
        >
          <span className="mold-kpi-rivet" aria-hidden="true" />
          <p className="mold-kpi-label">{card.label}</p>
          <p className="mold-kpi-value">{card.value}</p>
          <p className={`mold-kpi-meta ${card.metaClass ?? ""}`.trim()}>
            {card.meta}
          </p>
        </article>
      ))}
    </div>
  );
}
