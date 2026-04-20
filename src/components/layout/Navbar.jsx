/* Đây là component hiển thị navbar */
import {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  useMemo,
} from "react";
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

/** className cho <li> nav cấp 1 có pill (siết margin/padding nhẹ). */
function navTopItemLiClass(itemKey, baseClass) {
  const pill =
    itemKey === "internalAnnouncements" || itemKey === "reports"
      ? "nav-item-top-pill"
      : "";
  return [baseClass, pill].filter(Boolean).join(" ");
}

/** Bọc nhãn nav cấp 1 (Bản tin / Báo cáo) để áp dụng pill gọn, nổi bật. */
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

/** Cắt chuỗi theo số ký tự (Unicode), thêm … nếu dài. */
function truncateDisplay(str, maxChars) {
  const s = String(str ?? "").trim();
  if (!s) return "";
  const chars = Array.from(s);
  if (chars.length <= maxChars) return s;
  return `${chars.slice(0, Math.max(0, maxChars - 1)).join("")}…`;
}

/**
 * Nhãn user gọn trên navbar: tên riêng (từ cuối nếu có họ tên),
 * không có tên thì phần trước @ của email (rút gọn).
 */
function getNavbarUserDisplayShort(user) {
  if (!user) return "";
  const name = String(user.name ?? "").trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    const piece =
      parts.length >= 2 ? parts[parts.length - 1] : (parts[0] ?? name);
    return truncateDisplay(piece, 10);
  }
  const email = String(user.email ?? "");
  const at = email.indexOf("@");
  const local = at > 0 ? email.slice(0, at) : email;
  return truncateDisplay(local, 12);
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
  const [desktopDropdownSuppressUntil, setDesktopDropdownSuppressUntil] =
    useState(0);
  const navbarMeasureRef = useRef(null);

  /** Đồng bộ chiều cao navbar → `--app-navbar-height` để nội dung dưới không bị che khi menu xuống dòng. */
  useLayoutEffect(() => {
    const el = navbarMeasureRef.current;
    if (!el) return undefined;

    const apply = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (h > 0) {
        document.documentElement.style.setProperty(
          "--app-navbar-height",
          `${h}px`,
        );
      }
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, []);

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

  const desktopDropdownSuppressed =
    desktopDropdownSuppressUntil > Date.now();

  useEffect(() => {
    if (!desktopDropdownSuppressUntil) return undefined;
    const remaining = desktopDropdownSuppressUntil - Date.now();
    if (remaining <= 0) {
      setDesktopDropdownSuppressUntil(0);
      return undefined;
    }
    const timer = setTimeout(() => {
      setDesktopDropdownSuppressUntil(0);
    }, remaining);
    return () => clearTimeout(timer);
  }, [desktopDropdownSuppressUntil]);

  const handleDesktopNavClick = () => {
    // Chặn hover mở lại ngay sau click để dropdown tự đóng mượt và dứt khoát.
    setDesktopDropdownSuppressUntil(Date.now() + 700);
    setUserDropdownOpen(false);
  };

  const showAdminOnlyMenu = Boolean(user && isAdminAccess(user, userRole));

  const navbarUserDisplayShort = useMemo(
    () => getNavbarUserDisplayShort(user),
    [user],
  );

  const navbarUserFullLabel = useMemo(
    () => (user ? String(user.name ?? "").trim() || user.email || "" : ""),
    [user],
  );

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
                  <li
                    key={item.key}
                    className={navTopItemLiClass(item.key, "mobile-dropdown")}
                  >
                    <button
                      className="mobile-dropdown-toggle"
                      onClick={() => toggleMobileDropdown(item.key)}
                    >
                      <span>
                        <NavTopLabel itemKey={item.key}>
                          {t(item.label)}
                        </NavTopLabel>
                      </span>
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
                <li key={item.key} className={navTopItemLiClass(item.key)}>
                  <RouterNavLink
                    to={item.path}
                    onClick={() => closeMobileMenu()}
                  >
                    <NavTopLabel itemKey={item.key}>
                      {t(item.label)}
                    </NavTopLabel>
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
      <nav ref={navbarMeasureRef} className="navbar">
        <div className="nav-logo">
          <a href="http://www.pavonine.net/en/">
            <img
              src="/picture/logo/logo_pavo.jpg"
              alt={t("navbar.logoAlt")}
            />
          </a>
        </div>

        {/* Hamburger Menu Button */}
        <div id="hamburger-menu" onClick={toggleMobileMenu}>
          ☰
        </div>

        <div
          className={`nav-items ${desktopDropdownSuppressed ? "nav-items--suppress-dropdown" : ""}`}
        >
          <ul>
            {menuConfig.map((item) => {
              if (item.type === "dropdown") {
                if (item.adminOnly && !showAdminOnlyMenu) return null;

                return (
                  <li
                    key={item.key}
                    className={navTopItemLiClass(item.key, "nav-li-has-dropdown")}
                  >
                    <button type="button">
                      <NavTopLabel itemKey={item.key}>
                        {t(item.label)}
                      </NavTopLabel>
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
                                                              onClick={
                                                                handleDesktopNavClick
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
                                              <li key={deepSub.key}>
                                                <RouterNavLink
                                                  to={deepSub.path}
                                                  onClick={
                                                    handleDesktopNavClick
                                                  }
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
                                        onClick={handleDesktopNavClick}
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
                              onClick={handleDesktopNavClick}
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
                <li key={item.key} className={navTopItemLiClass(item.key)}>
                  <RouterNavLink
                    to={item.path}
                    onClick={handleDesktopNavClick}
                  >
                    <NavTopLabel itemKey={item.key}>
                      {t(item.label)}
                    </NavTopLabel>
                  </RouterNavLink>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="user-controls">
          <div
            className="navbar-tools"
            aria-label={t(
              "navbar.toolsRegion",
              "Ngôn ngữ, giao diện và tài khoản",
            )}
          >
            <div className="lang-selector">
              <label className="sr-only" htmlFor="navbar-lang-select">
                {t("navbar.language")}
              </label>
              <select
                id="navbar-lang-select"
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
              <div className="user-dropdown-wrapper">
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
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                >
                  <span className="user-avatar" aria-hidden>
                    {user.name
                      ? Array.from(user.name.trim())[0]?.toUpperCase() ?? "?"
                      : Array.from(user.email)[0]?.toUpperCase() ?? "?"}
                  </span>
                  <span className="user-name-text">{navbarUserDisplayShort}</span>
                </button>
                {userDropdownOpen && (
                  <div className="user-dropdown-menu">
                    <button
                      type="button"
                      onClick={() => {
                        setChangePwOpen(true);
                        setUserDropdownOpen(false);
                      }}
                    >
                      🔑 {t("navbar.changePassword")}
                    </button>
                    <button
                      type="button"
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
              <div className="nav-button nav-button--toolbar">
                <div className="anim-layer" />
                <a href="#" onClick={handleSignIn}>
                  {t("navbar.dangNhap")}
                </a>
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
