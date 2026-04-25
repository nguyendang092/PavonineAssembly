import React from "react";

function AttendanceSearchActionsBar({
  searchTerm,
  onSearchChange,
  searchPlaceholder,
  layout = "three",
  showSearchOnDesktop = true,
  children,
}) {
  const mobileGridClass =
    layout === "two"
      ? "grid-cols-2"
      : layout === "one"
        ? "grid-cols-1"
        : "grid-cols-3";
  const desktopSearchClass = showSearchOnDesktop ? "sm:block" : "sm:hidden";

  return (
    <div
      className={`grid w-full min-w-0 ${mobileGridClass} items-center gap-1 sm:flex sm:w-auto sm:shrink-0 sm:justify-end sm:overflow-x-auto sm:whitespace-nowrap`}
    >
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => onSearchChange?.(e.target.value)}
        placeholder={searchPlaceholder}
        className={`h-8 w-full min-w-0 rounded-md border px-2 text-sm focus:ring-2 focus:ring-blue-200 ${desktopSearchClass} sm:w-48`}
      />
      {children}
    </div>
  );
}

export default AttendanceSearchActionsBar;
