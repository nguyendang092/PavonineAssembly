import { memo } from "react";

function AttendanceSearchActionsBar({
  searchTerm,
  onSearchChange,
  searchPlaceholder,
  children,
}) {
  return (
    <div className="grid w-full min-w-0 grid-cols-3 items-center gap-1 sm:flex sm:w-auto sm:shrink-0 sm:items-center sm:justify-end sm:gap-1.5 sm:overflow-x-auto sm:whitespace-nowrap">
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => onSearchChange?.(e.target.value)}
        placeholder={searchPlaceholder}
        className="h-8 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 sm:block sm:w-48 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      />
      {children}
    </div>
  );
}

export default memo(AttendanceSearchActionsBar);
