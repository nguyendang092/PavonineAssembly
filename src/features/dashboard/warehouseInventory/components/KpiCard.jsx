import React from "react";

const TONE_CLASS = {
  slate: "wah-inv-kpi--slate",
  amber: "wah-inv-kpi--amber",
  emerald: "wah-inv-kpi--emerald",
  rose: "wah-inv-kpi--rose",
  sky: "wah-inv-kpi--sky",
  violet: "wah-inv-kpi--violet",
};

export default function KpiCard({ label, value, hint, tone = "slate" }) {
  return (
    <div className={`wah-inv-kpi ${TONE_CLASS[tone] ?? TONE_CLASS.slate}`}>
      <p className="wah-inv-kpi__label">{label}</p>
      <p className="wah-inv-kpi__value">{value}</p>
      {hint ? <p className="wah-inv-kpi__hint">{hint}</p> : null}
    </div>
  );
}
