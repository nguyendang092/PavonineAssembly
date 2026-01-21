/* Đây là component hiển thị navbar */
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";
import SignIn from "../../SignIn";
import ChangePasswordModal from "../modals/ChangePasswordModal";
import { useTranslation } from "react-i18next";
import { menuConfig } from "../../config/menuConfig";
import "./navbar.css";

export default function Navbar({ user, setUser }) {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
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
  // Dropdown state động cho tất cả dropdown
  const [dropdownOpen, setDropdownOpen] = useState({});
  const dropdownTimers = useRef({});

  const flagMap = {
    vi: "https://flagcdn.com/w40/vn.png",
    ko: "https://flagcdn.com/w40/kr.png",
  };

  const toggleMenu = () => setIsOpen(!isOpen);
  const navigate = useNavigate();
  const handleSelect = (key, path) => {
    setActiveLeaderKey(key);
    setIsOpen(false);
    if (path) navigate(path);
  };

  const [signInOpen, setSignInOpen] = useState(false);
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [langPopupOpen, setLangPopupOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileDropdowns, setMobileDropdowns] = useState({});

  const handleChangeLanguage = (lang) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
    setLangPopupOpen(false);
  };

  const handleSignIn = () => setSignInOpen(true);

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

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

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

  // Đóng lang popup khi click ngoài
  useEffect(() => {
    if (!langPopupOpen) return;
    const handleClick = (e) => {
      if (!e.target.closest(".lang-selector")) setLangPopupOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [langPopupOpen]);

  // Lock scroll when mobile menu open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  // Hàm mở/đóng dropdown động
  const openDropdown = (key) => {
    if (dropdownTimers.current[key]) clearTimeout(dropdownTimers.current[key]);
    setDropdownOpen((prev) => ({ ...prev, [key]: true }));
  };
  const closeDropdown = (key) => {
    if (dropdownTimers.current[key]) clearTimeout(dropdownTimers.current[key]);
    dropdownTimers.current[key] = setTimeout(() => {
      setDropdownOpen((prev) => ({ ...prev, [key]: false }));
    }, 300);
  };

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
                                            (deepChild) => (
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
                                            ),
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
                      handleSelect(item.key);
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
                if (
                  item.adminOnly &&
                  (!user || user.email !== "admin@gmail.com")
                )
                  return null;

                return (
                  <li key={item.key}>
                    <button type="button">
                      {t(item.label)}
                      <span className="dropdown-arrow">▼</span>
                    </button>
                    <ul className="dropdown-menu">
                      {item.children.map((child) => {
                        if (child.type === "nested" && child.children) {
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
                                          {sub.children.map((deepSub) => (
                                            <li key={deepSub.key}>
                                              <Link
                                                to={deepSub.path}
                                                onClick={() => {
                                                  setActiveLeaderKey(
                                                    deepSub.key,
                                                  );
                                                  setIsOpen(false);
                                                }}
                                              >
                                                {t(deepSub.label)}
                                              </Link>
                                            </li>
                                          ))}
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
                                          setIsOpen(false);
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
                        if (
                          child.adminOnly &&
                          (!user || user.email !== "admin@gmail.com")
                        )
                          return null;

                        return (
                          <li key={child.key}>
                            <Link
                              to={child.path}
                              onClick={() => {
                                setActiveLeaderKey(child.key);
                                setIsOpen(false);
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
                  <Link to={item.path} onClick={() => handleSelect(item.key)}>
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
                <span>{user.name || user.email}</span>
                <span>▼</span>
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
            <div
              className="flag-icon"
              style={{ backgroundImage: `url(${flagMap[language]})` }}
              onClick={() => setLangPopupOpen(!langPopupOpen)}
            />
            {langPopupOpen && (
              <div className="lang-popup">
                {Object.entries(flagMap).map(([langKey, flagUrl]) => (
                  <div
                    key={langKey}
                    className={`flag-icon ${
                      language === langKey ? "active" : ""
                    }`}
                    style={{ backgroundImage: `url(${flagUrl})` }}
                    onClick={() => handleChangeLanguage(langKey)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
