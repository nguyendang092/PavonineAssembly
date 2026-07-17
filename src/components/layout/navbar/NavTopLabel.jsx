import { memo } from "react";
import { FiBarChart2 } from "react-icons/fi";

function NavTopLabel({ itemKey, children }) {
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
