import React from "react";

const TONES = {
  slate: "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
  amber:
    "border-amber-300/80 bg-gradient-to-br from-amber-50 to-white dark:border-amber-800 dark:from-amber-950/80 dark:to-slate-900",
  emerald:
    "border-emerald-300/80 bg-gradient-to-br from-emerald-50 to-white dark:border-emerald-800 dark:from-emerald-950/70 dark:to-slate-900",
  rose: "border-rose-300/80 bg-gradient-to-br from-rose-50 to-white dark:border-rose-800 dark:from-rose-950/70 dark:to-slate-900",
};

export default function KpiCard({ label, value, sub, tone = "slate" }) {
  return (
    <div
      className={`dashboard-report-surface rounded-lg border p-3 shadow-sm ${TONES[tone] ?? TONES.slate}`}
    >
      <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-1.5 text-xl font-black tabular-nums text-slate-900 dark:text-slate-50">
        {value}
      </p>
      {sub ? (
        <p className="mt-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">
          {sub}
        </p>
      ) : null}
    </div>
  );
}
