/* Đây là component hiển thị navbar */
import { useState, useEffect, useRef } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";
import { FiMoon, FiSun } from "react-icons/fi";
import SignIn from "@/auth/SignIn";
import ChangePasswordModal from "@/components/modals/ChangePasswordModal";
import { useTranslation } from "react-i18next";
import { menuConfig } from "@/config/menuConfig";
import { isAdminAccess } from "@/config/authRoles";
import { useTheme } from "@/contexts/ThemeContext";
import "./navbar.css";

/** Link menu với trạng thái active khớp URL (kể cả `/email` ↔ `/email/login`). */
function RouterNavLink({ to, onClick, children }) {
  const location = useLocation();
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) => {
        const active =
          isActive ||
          (to === "/email" && location.pathname === "/email/login");
        return active ? "navbar-link-active" : undefined;
      }}
      onClick={onClick}
    >
      {children}
    </NavLink>
  );
}

export default function Navbar({ user, setUser, userRole }) {
  const { theme, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const [language, setLanguage] = useState(i18n.language || "vi");
  const languageOptions = {
    vi: "Tiếng Việt",
    ko: "한국어",
  };

  const navigate = useNavigate();
  const [signInOpen, setSignInOpen] = useState(false);
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileDropdowns, setMobileDropdowns] = useState({});

  const handleChangeLanguage = (lang) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem("appLanguage", lang);
  };

  useEffect(() => {
    const syncLanguage = (lng) => {
      const normalizedLanguage = lng?.startsWith("ko") ? "ko" : "vi";
      setLanguage(normalizedLanguage);
    };

    syncLanguage(i18n.language);
    i18n.on("languageChanged", syncLanguage);

    return () => {
      i18n.off("languageChanged", syncLanguage);
    };
  }, [i18n]);

  const handleSignIn = () => {
    closeMobileMenu();
    setSignInOpen(true);
  };

  const handleSignInSuccess = (userInfo) => {
    if (setUser) setUser(userInfo);
    setSignInOpen(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut(getAuth());
    } catch {}
    localStorage.removeItem("userLogin");
    if (setUser) setUser(null);
    closeMobileMenu();
    setUserDropdownOpen(false);
    navigate("/login", { replace: true });
  };

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setMobileDropdowns({});
  };

  const toggleMobileDropdown = (key) => {
    setMobileDropdowns((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const showAdminOnlyMenu = Boolean(user && isAdminAccess(user, userRole));

  // Đóng dropdown user khi click ngoài
  useEffect(() => {
    if (!userDropdownOpen) return;
    const handleClick = (e) => {
      if (!e.target.closest(".user-dropdown-wrapper"))
        setUserDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [userDropdownOpen]);

  // Lock scroll when mobile menu open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  return (
    <>
      {signInOpen && (
        <SignIn
          onSignIn={handleSignInSuccess}
          onClose={() => setSignInOpen(false)}
        />
      )}
      {changePwOpen && (
        <ChangePasswordModal onClose={() => setChangePwOpen(false)} />
      )}

      {/* Mobile Menu */}
      <div id="mobile-menu" className={mobileMenuOpen ? "active" : ""}>
        <span id="hamburger-cross" onClick={closeMobileMenu}>
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
        <div className="mobile-nav-items">
          <ul>
            {menuConfig.map((item) => {
              if (item.type === "dropdown") {
                return (
                  <li key={item.key} className="mobile-dropdown">
                    <button
                      className="mobile-dropdown-toggle"
                      onClick={() => toggleMobileDropdown(item.key)}
                    >
                      <span>{t(item.label)}</span>
                      <span
                        className={`mobile-arrow ${mobileDropdowns[item.key] ? "open" : ""}`}
                      >
                        ▼
                      </span>
                    </button>
                    <ul
                      className={`mobile-dropdown-content ${mobileDropdowns[item.key] ? "open" : ""}`}
                    >
                      {item.children.map((child) => {
                        if (child.adminOnly && !showAdminOnlyMenu) return null;
                        if (child.type === "nested" && child.children) {
                          return (
                            <li
                              key={child.key}
                              className="mobile-nested-dropdown"
                            >
                              <button
                                className="mobile-dropdown-toggle nested"
                                onClick={() => toggleMobileDropdown(child.key)}
                              >
                                <span>{t(child.label)}</span>
                                <span
                                  className={`mobile-arrow ${mobileDropdowns[child.key] ? "open" : ""}`}
                                >
                                  ▼
                                </span>
                              </button>
                              <ul
                                className={`mobile-dropdown-content ${mobileDropdowns[child.key] ? "open" : ""}`}
                              >
                                {child.children.map((subChild) => {
                                  if (subChild.adminOnly && !showAdminOnlyMenu)
                                    return null;
                                  if (
                                    subChild.type === "nested" &&
                                    subChild.children
                                  ) {
                                    return (
                                      <li
                                        key={subChild.key}
                                        className="mobile-nested-dropdown"
                                      >
                                        <button
                                          className="mobile-dropdown-toggle nested"
                                          onClick={() =>
                                            toggleMobileDropdown(subChild.key)
                                          }
                                        >
                                          <span>{t(subChild.label)}</span>
                                          <span
                                            className={`mobile-arrow ${mobileDropdowns[subChild.key] ? "open" : ""}`}
                                          >
                                            ▼
                                          </span>
                                        </button>
                                        <ul
                                          className={`mobile-dropdown-content ${mobileDropdowns[subChild.key] ? "open" : ""}`}
                                        >
                                          {subChild.children.map(
                                            (deepChild) => {
                                              if (
                                                deepChild.adminOnly &&
                                                !showAdminOnlyMenu
                                              )
                                                return null;
                                              if (
                                                deepChild.type === "nested" &&
                                                deepChild.children
                                              ) {
                                                return (
                                                  <li
                                                    key={deepChild.key}
                                                    className="mobile-nested-dropdown"
                                                  >
                                                    <button
                                                      className="mobile-dropdown-toggle nested"
                                                      onClick={() =>
                                                        toggleMobileDropdown(
                                                          deepChild.key,
                                                        )
                                                      }
                                                    >
                                                      <span>
                                                        {t(deepChild.label)}
                                                      </span>
                                                      <span
                                                        className={`mobile-arrow ${mobileDropdowns[deepChild.key] ? "open" : ""}`}
                                                      >
                                                        ▼
                                                      </span>
                                                    </button>
                                                    <ul
                                                      className={`mobile-dropdown-content ${mobileDropdowns[deepChild.key] ? "open" : ""}`}
                                                    >
                                                      {deepChild.children.map(
                                                        (leaf) => {
                                                          if (
                                                            leaf.adminOnly &&
                                                            !showAdminOnlyMenu
                                                          )
                                                            return null;
                                                          return (
                                                            <li key={leaf.key}>
                                                              <RouterNavLink
                                                                to={leaf.path}
                                                                onClick={() =>
                                                                  closeMobileMenu()
                                                                }
                                                              >
                                                                {t(leaf.label)}
                                                              </RouterNavLink>
                                                            </li>
                                                          );
                                                        },
                                                      )}
                                                    </ul>
                                                  </li>
                                                );
                                              }
                                              return (
                                                <li key={deepChild.key}>
                                                  <RouterNavLink
                                                    to={deepChild.path}
                                                    onClick={() =>
                                                      closeMobileMenu()
                                                    }
                                                  >
                                                    {t(deepChild.label)}
                                                  </RouterNavLink>
                                                </li>
                                              );
                                            },
                                          )}
                                        </ul>
                                      </li>
                                    );
                                  }
                                  return (
                                    <li key={subChild.key}>
                                      <RouterNavLink
                                        to={subChild.path}
                                        onClick={() => closeMobileMenu()}
                                      >
                                        {t(subChild.label)}
                                      </RouterNavLink>
                                    </li>
                                  );
                                })}
                              </ul>
                            </li>
                          );
                        }
                        return (
                          <li key={child.key}>
                            <RouterNavLink
                              to={child.path}
                              onClick={() => closeMobileMenu()}
                            >
                              {t(child.label)}
                            </RouterNavLink>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              }
              return (
                <li key={item.key}>
                  <RouterNavLink
                    to={item.path}
                    onClick={() => closeMobileMenu()}
                  >
                    {t(item.label)}
                  </RouterNavLink>
                </li>
              );
            })}
          </ul>
        </div>
        {user ? (
          <div className="mobile-nav-button">
            <div className="anim-layer"></div>
            <a href="#" onClick={handleSignOut}>
              {t("navbar.logOut")}
            </a>
          </div>
        ) : (
          <div className="mobile-nav-button">
            <div className="anim-layer"></div>
            <a href="#" onClick={handleSignIn}>
              {t("navbar.dangNhap")}
            </a>
          </div>
        )}
      </div>

      {/* Desktop Navbar */}
      <nav className="navbar">
        <div className="nav-logo">
          <a href="http://www.pavonine.net/en/">
            <img
              src="/picture/logo/logo_pavo.jpg"
              alt={t("navbar.logoAlt")}
              style={{ height: "40px" }}
            />
          </a>
        </div>

        {/* Hamburger Menu Button */}
        <div id="hamburger-menu" onClick={toggleMobileMenu}>
          ☰
        </div>

        <div className="nav-items">
          <ul>
            {menuConfig.map((item) => {
              if (item.type === "dropdown") {
                if (item.adminOnly && !showAdminOnlyMenu) return null;

                return (
                  <li key={item.key}>
                    <button type="button">
                      {t(item.label)}
                      <span className="dropdown-arrow">▼</span>
                    </button>
                    <ul className="dropdown-menu">
                      {item.children.map((child) => {
                        if (child.type === "nested" && child.children) {
                          if (child.adminOnly && !showAdminOnlyMenu) return null;
                          return (
                            <li key={child.key} className="nested-dropdown">
                              <button type="button">
                                {t(child.label)}
                                <span className="dropdown-arrow">→</span>
                              </button>
                              <ul className="nested-dropdown-menu dropdown-menu">
                                {child.children.map((sub) => {
                                  if (sub.type === "nested" && sub.children) {
                                    return (
                                      <li
                                        key={sub.key}
                                        className="nested-dropdown"
                                      >
                                        <button type="button">
                                          {t(sub.label)}
                                          <span className="dropdown-arrow">
                                            →
                                          </span>
                                        </button>
                                        <ul className="nested-dropdown-menu dropdown-menu">
                                          {sub.children.map((deepSub) => {
                                            if (
                                              deepSub.adminOnly &&
                                              !showAdminOnlyMenu
                                            )
                                              return null;
                                            if (
                                              deepSub.type === "nested" &&
                                              deepSub.children
                                            ) {
                                              return (
                                                <li
                                                  key={deepSub.key}
                                                  className="nested-dropdown"
                                                >
                                                  <button type="button">
                                                    {t(deepSub.label)}
                                                    <span className="dropdown-arrow">
                                                      →
                                                    </span>
                                                  </button>
                                                  <ul className="nested-dropdown-menu dropdown-menu">
                                                    {deepSub.children.map(
                                                      (leaf) => {
                                                        if (
                                                          leaf.adminOnly &&
                                                          !showAdminOnlyMenu
                                                        )
                                                          return null;
                                                        return (
                                                          <li key={leaf.key}>
                                                            <RouterNavLink
                                                              to={leaf.path}
                                                            >
                                                              {t(leaf.label)}
                                                            </RouterNavLink>
                                                          </li>
                                                        );
                                                      },
                                                    )}
                                                  </ul>
                                                </li>
                                              );
                                            }
                                            return (
                                              <li key={deepSub.key}>
                                                <RouterNavLink
                                                  to={deepSub.path}
                                                >
                                                  {t(deepSub.label)}
                                                </RouterNavLink>
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      </li>
                                    );
                                  }
                                  return (
                                    <li key={sub.key}>
                                      <RouterNavLink
                                        to={sub.path}
                                      >
                                        {t(sub.label)}
                                      </RouterNavLink>
                                    </li>
                                  );
                                })}
                              </ul>
                            </li>
                          );
                        }
                        if (child.adminOnly && !showAdminOnlyMenu) return null;

                        return (
                          <li key={child.key}>
                            <RouterNavLink
                              to={child.path}
                            >
                              {t(child.label)}
                            </RouterNavLink>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              }

              return (
                <li key={item.key}>
                  <RouterNavLink
                    to={item.path}
                  >
                    {t(item.label)}
                  </RouterNavLink>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="user-controls">
          {/* User Dropdown */}
          {user ? (
            <div className="user-dropdown-wrapper">
              <button
                className="user-dropdown-btn"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              >
                <span className="user-avatar">
                  {user.name
                    ? user.name[0].toUpperCase()
                    : user.email[0].toUpperCase()}
                </span>
                <span className="user-name-text">
                  {user.name || user.email}
                </span>
                <span className="user-dropdown-arrow">▼</span>
              </button>
              {userDropdownOpen && (
                <div className="user-dropdown-menu">
                  <button
                    onClick={() => {
                      setChangePwOpen(true);
                      setUserDropdownOpen(false);
                    }}
                  >
                    🔑 {t("navbar.changePassword")}
                  </button>
                  <button
                    onClick={() => {
                      handleSignOut();
                      setUserDropdownOpen(false);
                    }}
                  >
                    🚪 {t("navbar.logOut")}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="nav-button">
              <div className="anim-layer"></div>
              <a href="#" onClick={handleSignIn}>
                {t("navbar.dangNhap")}
              </a>
            </div>
          )}

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

          {/* Language Selector */}
          <div className="lang-selector">
            <select
              value={language}
              onChange={(e) => handleChangeLanguage(e.target.value)}
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
      </nav>
    </>
  );
}
