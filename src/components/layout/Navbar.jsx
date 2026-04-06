/* Đây là component hiển thị navbar */
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";
import SignIn from "../../SignIn";
import ChangePasswordModal from "../modals/ChangePasswordModal";
import { useTranslation } from "react-i18next";
import { menuConfig } from "../../config/menuConfig";
import { isAdminAccess } from "../../config/authRoles";
import "./navbar.css";

export default function Navbar({ user, setUser, userRole }) {
  const { t, i18n } = useTranslation();
  const [language, setLanguage] = useState(i18n.language || "vi");
  const [activeLeaderKey, setActiveLeaderKey] = useState("bieudo");
  const location = useLocation();

  // Đồng bộ activeLeaderKey với route
  useEffect(() => {
    let foundKey = null;
    for (const item of menuConfig) {
      if (item.type === "dropdown" && item.children) {
        for (const child of item.children) {
          if (child.path === location.pathname) {
            foundKey = child.key;
            break;
          }
        }
      } else if (item.path === location.pathname) {
        foundKey = item.key;
      }
      if (foundKey) break;
    }
    if (foundKey) setActiveLeaderKey(foundKey);
  }, [location.pathname]);

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
                                                              <Link
                                                                to={leaf.path}
                                                                onClick={() => {
                                                                  setActiveLeaderKey(
                                                                    leaf.key,
                                                                  );
                                                                  closeMobileMenu();
                                                                }}
                                                              >
                                                                {t(leaf.label)}
                                                              </Link>
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
                                                  <Link
                                                    to={deepChild.path}
                                                    onClick={() => {
                                                      setActiveLeaderKey(
                                                        deepChild.key,
                                                      );
                                                      closeMobileMenu();
                                                    }}
                                                  >
                                                    {t(deepChild.label)}
                                                  </Link>
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
                                      <Link
                                        to={subChild.path}
                                        onClick={() => {
                                          setActiveLeaderKey(subChild.key);
                                          closeMobileMenu();
                                        }}
                                      >
                                        {t(subChild.label)}
                                      </Link>
                                    </li>
                                  );
                                })}
                              </ul>
                            </li>
                          );
                        }
                        return (
                          <li key={child.key}>
                            <Link
                              to={child.path}
                              onClick={() => {
                                setActiveLeaderKey(child.key);
                                closeMobileMenu();
                              }}
                            >
                              {t(child.label)}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              }
              return (
                <li key={item.key}>
                  <Link
                    to={item.path}
                    onClick={() => {
                      setActiveLeaderKey(item.key);
                      closeMobileMenu();
                    }}
                  >
                    {t(item.label)}
                  </Link>
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
                                                            <Link
                                                              to={leaf.path}
                                                              onClick={() => {
                                                                setActiveLeaderKey(
                                                                  leaf.key,
                                                                );
                                                              }}
                                                            >
                                                              {t(leaf.label)}
                                                            </Link>
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
                                                <Link
                                                  to={deepSub.path}
                                                  onClick={() => {
                                                    setActiveLeaderKey(
                                                      deepSub.key,
                                                    );
                                                  }}
                                                >
                                                  {t(deepSub.label)}
                                                </Link>
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      </li>
                                    );
                                  }
                                  return (
                                    <li key={sub.key}>
                                      <Link
                                        to={sub.path}
                                        onClick={() => {
                                          setActiveLeaderKey(sub.key);
                                        }}
                                      >
                                        {t(sub.label)}
                                      </Link>
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
                            <Link
                              to={child.path}
                              onClick={() => {
                                setActiveLeaderKey(child.key);
                              }}
                            >
                              {t(child.label)}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              }

              return (
                <li key={item.key}>
                  <Link
                    to={item.path}
                    onClick={() => setActiveLeaderKey(item.key)}
                  >
                    {t(item.label)}
                  </Link>
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
