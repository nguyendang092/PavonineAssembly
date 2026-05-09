import { memo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useOutsideClick } from "./hooks/useOutsideClick";

function NavbarUserMenu({
  user,
  userDropdownOpen,
  setUserDropdownOpen,
  navbarUserDisplayShort,
  navbarUserFullLabel,
  showAdminOnlyMenu,
  t,
  onChangePassword,
  onSignOut,
}) {
  const navigate = useNavigate();
  const wrapperRef = useRef(null);

  const closeMenu = useCallback(() => setUserDropdownOpen(false), []);

  useOutsideClick(userDropdownOpen, wrapperRef, closeMenu);

  const initial =
    user?.name?.trim?.() && user.name.trim().length > 0
      ? Array.from(user.name.trim())[0]?.toUpperCase?.() ?? "?"
      : Array.from(user.email ?? "")[0]?.toUpperCase?.() ?? "?";

  return (
    <div className="user-dropdown-wrapper" ref={wrapperRef}>
      <button
        type="button"
        className="user-dropdown-btn user-dropdown-btn--compact"
        title={navbarUserFullLabel}
        aria-expanded={userDropdownOpen}
        aria-haspopup="menu"
        aria-label={
          navbarUserFullLabel
            ? `${t("navbar.userMenu", "Tài khoản")}: ${navbarUserFullLabel}`
            : t("navbar.userMenu", "Tài khoản")
        }
        onClick={() => setUserDropdownOpen((o) => !o)}
      >
        <span className="user-avatar" aria-hidden>
          {initial}
        </span>
        <span className="user-name-text">{navbarUserDisplayShort}</span>
      </button>
      {userDropdownOpen ? (
        <div className="user-dropdown-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onChangePassword();
              setUserDropdownOpen(false);
            }}
          >
            🔑 {t("navbar.changePassword")}
          </button>
          {showAdminOnlyMenu ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                navigate("/user-department");
                setUserDropdownOpen(false);
              }}
            >
              🔐 {t("navbar.userDepartment")}
            </button>
          ) : null}
          {showAdminOnlyMenu ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                navigate("/permission-catalog");
                setUserDropdownOpen(false);
              }}
            >
              📋 {t("navbar.permissionCatalog", "Phân quyền & chức năng")}
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onSignOut();
              setUserDropdownOpen(false);
            }}
          >
            🚪 {t("navbar.logOut")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default memo(NavbarUserMenu);
