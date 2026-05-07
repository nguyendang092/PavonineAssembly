import { memo } from "react";
import MobileMenuTop from "./MobileMenuTree";

function NavbarMobile({ menuCtx, onSignIn, onSignOut }) {
  const { t, user } = menuCtx;
  return (
    <>
      <div className="mobile-nav-items">
        <MobileMenuTop menuConfig={menuCtx.menuConfig} ctx={menuCtx} />
      </div>
      {user ? (
        <div className="mobile-nav-button">
          <div className="anim-layer" />
          <a href="#" onClick={onSignOut}>
            {t("navbar.logOut")}
          </a>
        </div>
      ) : (
        <div className="mobile-nav-button">
          <div className="anim-layer" />
          <a href="#" onClick={onSignIn}>
            {t("navbar.dangNhap")}
          </a>
        </div>
      )}
    </>
  );
}

export default memo(NavbarMobile);
