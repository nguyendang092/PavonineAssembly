import React from "react";

/**
 * Employee roster screen — design tokens (Tailwind).
 * Spacing: 3–6 scale (12–24px), Typography: xs/sm/base/lg, Colors: slate + semantic accents.
 */
export const rosterUi = {
  page: "min-h-screen w-full bg-slate-50",
  container:
    "mx-auto w-full max-w-[min(100vw-1.25rem,1600px)] px-3 py-6 sm:px-5 sm:py-8",
  card: "overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm shadow-slate-200/50",
  sectionHeader:
    "border-b border-slate-100 bg-white px-4 py-4 sm:px-6 sm:py-5",
  sectionMuted: "border-b border-slate-100 bg-slate-50/80 px-4 py-4 sm:px-6 sm:py-5",
  label:
    "mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500",
  input:
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/[0.07]",
  inputReadonly: "cursor-default bg-slate-50 text-slate-800",
  tableWrap: "overflow-x-auto",
  table: "min-w-[1100px] w-full border-collapse text-sm",
  th: "whitespace-nowrap px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 first:pl-5 last:pr-5 sm:px-4",
  td: "border-t border-slate-100 px-3 py-2.5 align-middle text-slate-700 first:pl-5 last:pr-5 sm:px-4",
  tdMono: "tabular-nums text-slate-600",
};

const btnBase =
  "inline-flex shrink-0 items-center justify-center gap-2 font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45";

const btnSizes = {
  sm: "h-9 rounded-lg px-3 text-xs",
  md: "h-10 rounded-lg px-4 text-sm",
};

const btnVariants = {
  primary:
    "bg-slate-900 text-white shadow-sm hover:bg-slate-800 focus-visible:ring-slate-500",
  secondary:
    "border border-slate-200 bg-white text-slate-800 shadow-sm hover:bg-slate-50 focus-visible:ring-slate-300",
  accent:
    "bg-teal-600 text-white shadow-sm hover:bg-teal-700 focus-visible:ring-teal-500",
  dangerGhost:
    "border border-red-200/80 bg-white text-red-700 shadow-sm hover:bg-red-50 focus-visible:ring-red-300",
  ghost: "text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-300",
};

/**
 * @param {{ as?: React.ElementType; variant?: keyof typeof btnVariants; size?: keyof typeof btnSizes; className?: string } & Record<string, unknown>} props
 */
export function RosterButton({
  as: Comp = "button",
  variant = "primary",
  size = "md",
  className = "",
  ...props
}) {
  const extra =
    Comp === "button" && props.type === undefined ? { type: "button" } : {};
  return (
    <Comp
      {...extra}
      {...props}
      className={`${btnBase} ${btnSizes[size]} ${btnVariants[variant]} ${className}`}
    />
  );
}

export function RosterField({ label, htmlFor, children, className = "" }) {
  return (
    <div className={className}>
      {label ? (
        <label htmlFor={htmlFor} className={rosterUi.label}>
          {label}
        </label>
      ) : null}
      {children}
    </div>
  );
}

export function RosterToast({ alert }) {
  if (!alert?.show) return null;
  const tone =
    alert.type === "success"
      ? "border-emerald-200/80 bg-emerald-600 text-white"
      : alert.type === "info"
        ? "border-slate-200 bg-slate-800 text-white"
        : "border-red-200 bg-red-600 text-white";
  return (
    <div
      className="fixed right-3 top-3 z-[60] max-w-[min(100vw-1.5rem,22rem)] sm:right-5 sm:top-5"
      role="status"
    >
      <div
        className={`rounded-xl border px-4 py-3 text-sm font-medium shadow-lg shadow-slate-900/10 ${tone}`}
      >
        {alert.message}
      </div>
    </div>
  );
}

export function RosterModal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="roster-modal-title"
    >
      <div className="absolute inset-0 bg-slate-900/45" aria-hidden />
      <div className="relative z-10 flex max-h-[min(92dvh,880px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/25 sm:max-w-2xl sm:rounded-2xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <h2
            id="roster-modal-title"
            className="text-lg font-semibold tracking-tight text-slate-900"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xl leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function RosterMenu({ open, children }) {
  if (!open) return null;
  return (
    <div
      className="absolute right-0 top-full z-50 mt-1.5 min-w-[13rem] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-200/80"
      role="menu"
    >
      {children}
    </div>
  );
}

export function RosterMenuItem({ children, className = "", ...props }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`flex w-full items-center px-3 py-2.5 text-left text-sm font-medium text-slate-800 transition hover:bg-slate-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
