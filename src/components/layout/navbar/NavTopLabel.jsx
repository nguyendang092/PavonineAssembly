import { memo } from "react";
import { FiBarChart2, FiBell } from "react-icons/fi";

function NavTopLabel({ itemKey, children }) {
  if (itemKey === "internalAnnouncements") {
    return (
      <span className="nav-link-label nav-link-label--announce">
        <FiBell size={14} strokeWidth={2.25} aria-hidden />
        {children}
      </span>
    );
  }
  if (itemKey === "reports") {
    return (
      <span className="nav-link-label nav-link-label--reports">
        <FiBarChart2 size={14} strokeWidth={2.25} aria-hidden />
        {children}
      </span>
    );
  }
  return children;
}

export default memo(NavTopLabel);
