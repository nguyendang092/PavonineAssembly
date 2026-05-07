import { memo } from "react";
import { FiMoon, FiSun } from "react-icons/fi";
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
  navbarUserDisplayShort,
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

        <span className="navbar-tools-divider" aria-hidden />

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
            navbarUserDisplayShort={navbarUserDisplayShort}
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
