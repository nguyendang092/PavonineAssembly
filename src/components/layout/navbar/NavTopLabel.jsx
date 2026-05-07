import { memo } from "react";

function NavTopLabel({ itemKey, children }) {
  const variant =
    itemKey === "internalAnnouncements"
      ? "announce"
      : itemKey === "reports"
        ? "reports"
        : null;
  if (!variant) return children;
  return (
    <span className={`nav-link-label nav-link-label--${variant}`}>
      {children}
    </span>
  );
}

export default memo(NavTopLabel);
