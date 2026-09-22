import { memo } from "react";
import MobileMenuTop from "./MobileMenuTree";

function NavbarMobile({ menuCtx, onSignIn, onSignOut }) {
  const { t, user } = menuCtx;
  return (
    <>
      <div className="mobile-nav-items">
        <MobileMenuTop menuConfig={menuCtx.menuConfig} ctx={menuCtx} />
      </div>
      <div className="mobile-nav-footer">
        {user ? (
          <button type="button" className="mobile-nav-button" onClick={onSignOut}>
            {t("navbar.logOut")}
          </button>
        ) : (
          <button type="button" className="mobile-nav-button" onClick={onSignIn}>
            {t("navbar.dangNhap")}
          </button>
        )}
      </div>
    </>
  );
}

export default memo(NavbarMobile);
