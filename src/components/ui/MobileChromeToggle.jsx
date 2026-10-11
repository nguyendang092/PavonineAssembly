import { useTranslation } from "react-i18next";
import { useMobileChromeCollapse } from "@/hooks/useMobileChromeCollapse";

export default function MobileChromeToggle() {
  const { t } = useTranslation();
  const { collapsed, isMobile, toggle } = useMobileChromeCollapse();

  if (!isMobile) return null;

  const label = collapsed
    ? t("common.expandChrome", "Mở thanh cố định")
    : t("common.collapseChrome", "Thu nhỏ thanh cố định");

  return (
    <button
      type="button"
      className="mobile-chrome-toggle"
      onClick={toggle}
      aria-pressed={collapsed}
      aria-label={label}
      title={label}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        aria-hidden
      >
        {collapsed ? (
          <path d="M6 15l6-6 6 6" />
        ) : (
          <path d="M6 9l6 6 6-6" />
        )}
      </svg>
    </button>
  );
}
