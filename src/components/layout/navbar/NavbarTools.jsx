import { memo } from "react";
import { FiGlobe, FiMoon, FiSun } from "react-icons/fi";
import NavbarUserMenu from "./NavbarUserMenu";

function NavbarTools({
  theme,
  toggleTheme,
  language,
  languageOptions,
  onChangeLanguage,
  t,
  toolsRegionLabel,
  user,
  userDropdownOpen,
  setUserDropdownOpen,
  navbarUserDisplayName,
  navbarUserRoleLabel,
  navbarUserFullLabel,
  showAdminOnlyMenu,
  onChangePassword,
  onSignOut,
  onSignIn,
}) {
  return (
    <div className="user-controls">
      <div className="navbar-tools" aria-label={toolsRegionLabel}>
        <div className="lang-selector">
          <label className="sr-only" htmlFor="navbar-lang-select">
            {t("navbar.language")}
          </label>
          <div className="lang-selector-wrap">
            <FiGlobe size={15} strokeWidth={2} aria-hidden className="lang-selector-icon" />
            <select
              id="navbar-lang-select"
              value={language}
              onChange={(e) => onChangeLanguage(e.target.value)}
              className="language-dropdown"
            >
              {Object.entries(languageOptions).map(([langKey, langLabel]) => (
                <option key={langKey} value={langKey}>
                  {langLabel}
                </option>
              ))}
            </select>
          </div>
        </div>

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
            <FiSun size={18} strokeWidth={2} />
          ) : (
            <FiMoon size={18} strokeWidth={2} />
          )}
        </button>

        <span className="navbar-tools-divider" aria-hidden />

        {user ? (
          <NavbarUserMenu
            user={user}
            userDropdownOpen={userDropdownOpen}
            setUserDropdownOpen={setUserDropdownOpen}
            navbarUserDisplayName={navbarUserDisplayName}
            navbarUserRoleLabel={navbarUserRoleLabel}
            navbarUserFullLabel={navbarUserFullLabel}
            showAdminOnlyMenu={showAdminOnlyMenu}
            t={t}
            onChangePassword={onChangePassword}
            onSignOut={onSignOut}
          />
        ) : (
          <div className="nav-button nav-button--toolbar">
            <div className="anim-layer" />
            <a href="#" onClick={onSignIn}>
              {t("navbar.dangNhap")}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(NavbarTools);
