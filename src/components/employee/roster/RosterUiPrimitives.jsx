import React from "react";
import AlertMessage from "../../common/AlertMessage";

/**
 * Employee roster — tokens đồng bộ với AttendanceList (card trắng + viền trên xanh,
 * input h-9, bảng gradient xanh, hover hàng blue-50 / zebra gray-50).
 */
export const rosterUi = {
  page: "min-h-screen w-full bg-gray-50",
  container:
    "mx-auto w-full max-w-[min(100vw-1.25rem,1600px)] px-4 py-6 md:px-8 md:py-8 transition-all duration-300",
  /** Trang danh sách NV: full viewport, padding giống AttendanceList. */
  containerFull:
    "mx-auto w-full max-w-none p-4 md:p-8 transition-all duration-300",
  card: "overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md border-t-4 border-blue-600",
  sectionHeader: "border-b border-gray-200 bg-white px-4 py-4 sm:px-6 sm:py-5",
  sectionMuted: "border-b border-gray-200 bg-gray-50 px-4 py-4 sm:px-6 sm:py-5",
  label:
    "mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-600",
  input:
    "w-full rounded-md border border-gray-300 bg-white h-9 px-3 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200",
  inputReadonly: "cursor-default bg-gray-50 text-gray-800",
  tableWrap: "overflow-x-auto",
  /** Khung bảng giống AttendanceList: border + rounded + shadow. */
  tableWrapNoScroll:
    "w-full max-w-full overflow-x-hidden rounded-lg border border-gray-200 shadow-sm",
  table: "min-w-[1100px] w-full border-collapse text-sm",
  /** Full width, table-fixed — nội dung co theo cột. */
  tableFluid: "w-full max-w-full table-fixed border-collapse text-sm",
  /** Trong thead gradient xanh (đặt class nền lên <thead>). */
  th: "whitespace-normal break-words px-2 py-2.5 text-center align-middle text-[10px] font-extrabold uppercase tracking-wider text-white sm:px-3 sm:py-3.5 sm:text-xs",
  td: "min-w-0 border-t border-gray-200 px-2 py-2 align-middle text-center break-words text-sm text-gray-700 first:pl-2 last:pr-2 sm:px-3 sm:py-2.5 sm:first:pl-3 sm:last:pr-3",
  tdMono: "tabular-nums text-gray-600",
};

const btnBase =
  "inline-flex shrink-0 items-center justify-center gap-2 font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45";

const btnSizes = {
  sm: "h-9 rounded-md px-3 text-xs",
  md: "h-9 rounded-md px-4 text-sm",
};

const btnVariants = {
  primary:
    "bg-blue-600 text-white shadow-sm hover:bg-blue-700 focus-visible:ring-blue-500",
  secondary:
    "border border-gray-300 bg-white text-gray-800 shadow-sm hover:bg-gray-50 focus-visible:ring-blue-300",
  accent:
    "bg-blue-600 text-white shadow-sm hover:bg-blue-700 focus-visible:ring-blue-500",
  dangerGhost:
    "border border-red-200/80 bg-white text-red-700 shadow-sm hover:bg-red-50 focus-visible:ring-red-300",
  ghost: "text-gray-600 hover:bg-gray-100 focus-visible:ring-gray-300",
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
  return <AlertMessage alert={alert} />;
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
      <div className="absolute inset-0 bg-black/50" aria-hidden />
      <div className="relative z-10 flex max-h-[min(92dvh,880px)] w-full max-w-lg flex-col overflow-hidden rounded-t-lg border border-gray-200 bg-white shadow-2xl sm:max-w-2xl sm:rounded-lg">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 sm:px-6">
          <h2
            id="roster-modal-title"
            className="text-lg font-semibold tracking-tight text-gray-900"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xl leading-none text-gray-400 transition hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
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
      className="absolute right-0 top-full z-50 mt-1.5 min-w-[13rem] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
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
      className={`flex w-full items-center px-3 py-2.5 text-left text-sm font-medium text-gray-800 transition hover:bg-blue-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
