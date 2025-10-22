/* Đây là component hiển thị navbar */
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";
import SignIn from "./SignIn";
import ChangePasswordModal from "./ChangePasswordModal";
import { useTranslation } from "react-i18next";
import { menuConfig } from "./menuConfig";
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

  const [langPopupOpen, setLangPopupOpen] = useState(false);

  const handleChangeLanguage = (lang) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
    setLangPopupOpen(false);
  };

  // Modal state for SignIn
  const [signInOpen, setSignInOpen] = useState(false);
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

  const [changePwOpen, setChangePwOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  // Đã chuyển dropdown sang state động, các state/timer cũ không còn cần thiết
  // Đóng dropdown user khi click ngoài
  useEffect(() => {
    if (!userDropdownOpen) return;
    const handleClick = (e) => {
      if (!e.target.closest(".user-dropdown-btn")) setUserDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [userDropdownOpen]);

  // Lock scroll when mobile menu open
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isOpen]);

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
      {/* Backdrop for mobile menu */}
      {isOpen && (
        <div
          className="fixed left-0 right-0 bottom-0 top-16 z-30 bg-black/30 md:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden
        />
      )}
      {signInOpen && (
        <SignIn
          onSignIn={handleSignInSuccess}
          onClose={() => setSignInOpen(false)}
        />
      )}
      {changePwOpen && (
        <ChangePasswordModal onClose={() => setChangePwOpen(false)} />
      )}
      <nav className="sticky top-0 z-50 bg-white/70 dark:bg-gray-900/70 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 shadow-sm antialiased">
        <div className="w-full flex items-center justify-between mx-auto pl-2 pr-2 py-2 sm:pl-3 sm:pr-3 md:pl-4 md:pr-4 md:py-3 flex-nowrap gap-1 sm:gap-2">
          <a
            href="http://www.pavonine.net/en/"
            className="flex items-center min-w-0 shrink-0"
          >
            <img
              src="/picture/logo/logo_pavo.jpg"
              className="h-7 sm:h-8 md:h-9 lg:h-10 w-auto rounded-full shadow-md"
              alt={t("navbar.logoAlt")}
            />
          </a>

          <div className="flex lg:order-2 items-center relative gap-1 sm:gap-2 md:gap-3 whitespace-nowrap shrink-0">
            {/* User info or Sign In/Up */}
            {user ? (
              <>
                <div className="relative inline-block text-left">
                  <button
                    onClick={() => setUserDropdownOpen((v) => !v)}
                    className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-gradient-to-r from-blue-200 to-purple-200 text-blue-900 font-semibold text-xs tracking-wide shadow hover:shadow-lg border border-blue-300 focus:outline-none transition-all duration-150 user-dropdown-btn"
                  >
                    <span className="flex w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-400 text-white items-center justify-center font-bold text-sm sm:text-base shadow-md">
                      {user.name
                        ? user.name[0].toUpperCase()
                        : user.email[0].toUpperCase()}
                    </span>
                    <span className="hidden sm:inline truncate max-w-[80px] md:max-w-[120px]">
                      {user.name || user.email}
                    </span>
                    <svg
                      className={`w-3 h-3 sm:w-4 sm:h-4 ml-0.5 sm:ml-1 transition-transform ${
                        userDropdownOpen ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  {userDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in user-dropdown-btn">
                      <button
                        onClick={() => {
                          setChangePwOpen(true);
                          setUserDropdownOpen(false);
                        }}
                        className="flex items-center gap-2 w-full text-left px-5 py-3 text-sm text-blue-700 hover:bg-blue-50 font-medium tracking-wide transition-all duration-100"
                      >
                        <svg
                          className="w-5 h-5 text-blue-500"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 11c0-1.657 1.343-3 3-3s3 1.343 3 3-1.343 3-3 3-3-1.343-3-3zm0 0V7m0 4v4m0 0H8m4 0h4"
                          />
                        </svg>
                        {t("navbar.changePassword")}
                      </button>
                      <button
                        onClick={() => {
                          handleSignOut();
                          setUserDropdownOpen(false);
                        }}
                        className="flex items-center gap-2 w-full text-left px-5 py-3 text-sm text-red-600 hover:bg-red-50 font-medium tracking-wide border-t border-gray-100 transition-all duration-100"
                      >
                        <svg
                          className="w-5 h-5 text-red-500"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4a2 2 0 012 2v1"
                          />
                        </svg>
                        {t("navbar.logOut")}
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={handleSignIn}
                  className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-white border border-blue-400 text-blue-700 font-semibold tracking-wide hover:bg-blue-50 shadow-sm text-xs min-w-[50px] sm:min-w-[70px]"
                >
                  <span className="hidden xs:inline">
                    {t("navbar.dangNhap")}
                  </span>
                  <span className="xs:hidden">👤</span>
                </button>
                {/* <button
                  onClick={handleSignUp}
                  className="px-1 py-1 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 shadow-sm text-xs"
                  style={{ minWidth: 70 }}
                >
                  Đăng ký
                </button> */}
              </>
            )}

            {/* Language Selector */}
            <button
              onClick={() => setLangPopupOpen(!langPopupOpen)}
              aria-label="Select language"
              title={language === "vi" ? "Tiếng Việt" : "한국어"}
              className="flex items-center space-x-1 cursor-pointer focus:outline-none text-gray-700 dark:text-gray-300 hover:opacity-90 shrink-0"
            >
              <span
                className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 rounded-full border border-gray-300 dark:border-gray-600 bg-cover bg-center shrink-0"
                style={{ backgroundImage: `url(${flagMap[language]})` }}
              />
            </button>

            {langPopupOpen && (
              <div className="absolute right-0 mt-10 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 p-2 flex space-x-3 z-50">
                {Object.entries(flagMap).map(([langKey, flagUrl]) => (
                  <button
                    key={langKey}
                    onClick={() => handleChangeLanguage(langKey)}
                    title={langKey === "vi" ? "Tiếng Việt" : "한국어"}
                    className={`w-8 h-8 rounded-full cursor-pointer border-2 ${
                      language === langKey
                        ? "border-blue-500"
                        : "border-transparent"
                    }`}
                    style={{
                      backgroundImage: `url(${flagUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                ))}
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={toggleMenu}
              type="button"
              className="inline-flex items-center p-1.5 sm:p-2 w-8 h-8 sm:w-10 sm:h-10 justify-center text-sm text-gray-600 rounded-lg lg:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shrink-0"
              aria-controls="navbar-cta"
              aria-expanded={isOpen}
            >
              <span className="sr-only">Open main menu</span>
              <svg
                className="w-5 h-5 sm:w-6 sm:h-6"
                fill="none"
                viewBox="0 0 24 24"
              >
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>

          {/* Navigation */}
          <div
            className={`items-center justify-center w-full transition-all duration-300 ease-in-out ${
              isOpen
                ? "fixed left-0 right-0 top-16 z-40 bg-white border-b shadow-lg lg:static lg:bg-transparent lg:border-0 lg:shadow-none"
                : "hidden lg:flex lg:flex-1 lg:min-w-0 lg:order-1"
            } lg:flex lg:flex-1 lg:min-w-0 lg:order-1`}
            id="navbar-cta"
          >
            <ul className="flex flex-row flex-wrap items-center justify-center gap-2 font-medium tracking-wide p-2 sm:p-3 lg:p-0 mt-2 border border-gray-100 rounded-xl bg-white/80 backdrop-blur shadow-md lg:shadow-none lg:gap-3 xl:gap-4 lg:flex-nowrap lg:mt-0 lg:border-0 lg:bg-transparent dark:bg-gray-900/80">
              {menuConfig.map((item) => {
                if (item.type === "dropdown") {
                  const isDropdownOpen = !!dropdownOpen[item.key];
                  const openFn = () => openDropdown(item.key);
                  const closeFn = () => closeDropdown(item.key);
                  if (
                    item.adminOnly &&
                    (!user || user.email !== "admin@gmail.com")
                  )
                    return null;
                  return (
                    <li
                      key={item.key}
                      className="relative"
                      onMouseEnter={openFn}
                      onMouseLeave={closeFn}
                      onFocus={openFn}
                      onBlur={closeFn}
                      tabIndex={0}
                    >
                      <button
                        className={`group inline-flex items-center rounded-full px-3 py-1.5 md:px-3 transition-all duration-200 ease-out font-medium text-sm ${
                          item.children.some((c) => c.key === activeLeaderKey)
                            ? "bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 shadow-sm"
                            : "text-gray-800 hover:text-blue-700 hover:shadow-md hover:-translate-y-0.5 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50"
                        } dark:text-white dark:hover:text-blue-300`}
                        type="button"
                        aria-haspopup="true"
                        aria-expanded={isDropdownOpen}
                        onClick={(e) => {
                          // Toggle dropdown on mobile (no hover)
                          if (
                            window &&
                            window.matchMedia &&
                            !window.matchMedia("(min-width: 768px)").matches
                          ) {
                            e.preventDefault();
                            setDropdownOpen((prev) => ({
                              ...prev,
                              [item.key]: !prev[item.key],
                            }));
                          }
                        }}
                        disabled={
                          item.adminOnly &&
                          (!user || user.email !== "admin@gmail.com")
                        }
                        style={
                          item.adminOnly &&
                          (!user || user.email !== "admin@gmail.com")
                            ? { opacity: 0.5, cursor: "not-allowed" }
                            : {}
                        }
                      >
                        {t(item.label)}
                        <svg
                          className="inline w-4 h-4 ml-1 transition-transform duration-200 group-hover:translate-y-[-1px]"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                      {isDropdownOpen && (
                        <div
                          className="absolute left-0 mt-2 w-36 bg-white border rounded shadow-lg z-50"
                          style={{ minWidth: 120 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {item.children.map((child) =>
                            child.children ? (
                              <div key={child.key} className="relative group">
                                <button
                                  className={`block w-full text-left px-4 py-2 rounded-md transition-all duration-150 hover:bg-blue-50 hover:text-blue-700 hover:pl-5 text-xs ${
                                    activeLeaderKey === child.key
                                      ? "bg-blue-100 text-blue-700"
                                      : ""
                                  } flex items-center justify-between`}
                                  tabIndex={0}
                                >
                                  {t(child.label)}
                                  <svg
                                    className="w-3 h-3 ml-1 transition-transform duration-150 group-hover:translate-x-0.5"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M19 9l-7 7-7-7"
                                    />
                                  </svg>
                                </button>
                                <div
                                  className="absolute left-full top-0 mt-0 ml-0 w-36 bg-white border rounded shadow-lg z-50 hidden group-hover:block group-focus:block"
                                  style={{ minWidth: 120 }}
                                >
                                  {child.children.map((sub) => (
                                    <Link
                                      key={sub.key}
                                      to={sub.path}
                                      onClick={() => {
                                        setActiveLeaderKey(sub.key);
                                        setDropdownOpen((prev) => ({
                                          ...prev,
                                          [item.key]: false,
                                        }));
                                        setIsOpen(false);
                                      }}
                                      className={`block w-full text-left px-4 py-2 hover:bg-blue-50 uppercase text-xs ${
                                        activeLeaderKey === sub.key
                                          ? "bg-blue-100 text-blue-700"
                                          : ""
                                      }`}
                                      tabIndex={0}
                                    >
                                      {t(sub.label)}
                                    </Link>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <Link
                                key={child.key}
                                to={child.path}
                                onClick={() => {
                                  setActiveLeaderKey(child.key);
                                  setDropdownOpen((prev) => ({
                                    ...prev,
                                    [item.key]: false,
                                  }));
                                  setIsOpen(false);
                                }}
                                className={`block w-full text-left px-4 py-2 rounded-md transition-all duration-150 hover:bg-blue-50 hover:text-blue-700 hover:pl-5 text-xs ${
                                  activeLeaderKey === child.key
                                    ? "bg-blue-100 text-blue-700"
                                    : ""
                                }`}
                                tabIndex={0}
                                style={
                                  item.adminOnly &&
                                  (!user || user.email !== "admin@gmail.com")
                                    ? { opacity: 0.5, cursor: "not-allowed" }
                                    : {}
                                }
                                disabled={
                                  item.adminOnly &&
                                  (!user || user.email !== "admin@gmail.com")
                                }
                              >
                                {t(child.label)}
                              </Link>
                            )
                          )}
                        </div>
                      )}
                    </li>
                  );
                }
                // Link thường
                return (
                  <li key={item.key}>
                    <Link
                      to={item.path}
                      onClick={() => handleSelect(item.key)}
                      className={`inline-flex items-center rounded-full px-3 py-1.5 md:px-3 transition-all duration-200 ease-out font-medium text-sm ${
                        item.key === activeLeaderKey
                          ? "bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 shadow-sm"
                          : "text-gray-800 hover:text-blue-700 hover:shadow-md hover:-translate-y-0.5 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50"
                      } dark:text-white dark:hover:text-blue-300`}
                    >
                      {t(item.label)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </nav>
      <style>{`.dropdown-open > div { display: block !important; }`}</style>
    </>
  );
}
