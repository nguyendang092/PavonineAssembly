import { memo } from "react";
import NavbarMobile from "./NavbarMobile";

function NavbarMobileDrawer({
  open,
  onClose,
  t,
  menuCtx,
  onSignIn,
  onSignOut,
}) {
  return (
    <>
      <button
        type="button"
        className={`mobile-menu-overlay${open ? " active" : ""}`}
        aria-label={t("navbar.closeMobileMenu", "Đóng menu")}
        aria-hidden={!open}
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        id="mobile-menu"
        className={open ? "active" : ""}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-label={t("navbar.menu", "Menu")}
      >
        <div className="mobile-menu-header">
          <p className="mobile-menu-title">{t("navbar.menu", "Menu")}</p>
          <button
            type="button"
            id="hamburger-cross"
            aria-label={t("navbar.closeMobileMenu", "Đóng menu")}
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <NavbarMobile
          menuCtx={menuCtx}
          onSignIn={onSignIn}
          onSignOut={onSignOut}
        />
      </div>
    </>
  );
}

export default memo(NavbarMobileDrawer);
