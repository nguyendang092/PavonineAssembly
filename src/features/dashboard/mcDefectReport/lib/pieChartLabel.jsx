import React from "react";
import { MC_DEFECT_CHART_TEXT } from "./constants";
import { formatMcDefectPercent } from "./dataAggregations";

/** Nhãn % trên lát donut — ẩn lát quá nhỏ để tránh chồng chữ. */
export function renderMcDefectErrorTypePieLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  payload,
}) {
  const pct = Number(payload?.percent ?? 0);
  if (pct < 4) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      fill={MC_DEFECT_CHART_TEXT}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={10}
      fontWeight={700}
    >
      {formatMcDefectPercent(pct)}
    </text>
  );
}
