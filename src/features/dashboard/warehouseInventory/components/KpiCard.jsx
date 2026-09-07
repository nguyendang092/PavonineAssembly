import React from "react";

const TONE_CLASS = {
  slate: "wah-inv-kpi--slate",
  amber: "wah-inv-kpi--amber",
  emerald: "wah-inv-kpi--emerald",
  rose: "wah-inv-kpi--rose",
};

export default function KpiCard({ label, value, sub, tone = "slate" }) {
  return (
    <div className={`wah-inv-kpi ${TONE_CLASS[tone] ?? TONE_CLASS.slate}`}>
      <p className="wah-inv-kpi__label">{label}</p>
      <p className="wah-inv-kpi__value">{value}</p>
      {sub ? (
        <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {sub}
        </p>
      ) : null}
    </div>
  );
}
