import { memo } from "react";
import { FiMoon, FiSun } from "react-icons/fi";
import NavbarMobile from "./NavbarMobile";

function NavbarMobileDrawer({
  open,
  onClose,
  theme,
  toggleTheme,
  t,
  menuCtx,
  onSignIn,
  onSignOut,
}) {
  return (
    <div id="mobile-menu" className={open ? "active" : ""}>
      <span
        id="hamburger-cross"
        role="button"
        tabIndex={0}
        aria-label={t("navbar.closeMobileMenu", "Đóng menu")}
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClose();
          }
        }}
      >
        ✕
      </span>
      <div className="mobile-menu-toolbar">
        <button
          type="button"
          onClick={toggleTheme}
          className="theme-toggle-btn"
          title={
            theme === "dark"
              ? t("navbar.themeSwitchToLight")
              : t("navbar.themeSwitchToDark")
          }
          aria-label={
            theme === "dark"
              ? t("navbar.themeSwitchToLight")
              : t("navbar.themeSwitchToDark")
          }
        >
          {theme === "dark" ? (
            <FiSun size={20} strokeWidth={2} />
          ) : (
            <FiMoon size={20} strokeWidth={2} />
          )}
        </button>
      </div>
      <NavbarMobile
        menuCtx={menuCtx}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
      />
    </div>
  );
}

export default memo(NavbarMobileDrawer);
