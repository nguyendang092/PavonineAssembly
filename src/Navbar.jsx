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
      <nav className="bg-gradient-to-r from-blue-100 via-purple-100 to-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-700 shadow-md">
        <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
          <a
            href="http://www.pavonine.net/en/"
            className="flex items-center space-x-3"
          >
            <img
              src="/picture/logo/logo_pavo.jpg"
              className="h-10 w-auto rounded-full shadow-md"
              alt={t("navbar.logoAlt")}
            />
          </a>

          <div className="flex md:order-2  md:space-x-1 items-center relative">
            {/* User info or Sign In/Up */}
            {user ? (
              <>
                <div className="relative inline-block text-left mr-2">
                  <button
                    onClick={() => setUserDropdownOpen((v) => !v)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-200 to-purple-200 text-blue-900 font-semibold text-xs shadow hover:shadow-lg border border-blue-300 focus:outline-none transition-all duration-150 user-dropdown-btn"
                  >
                    <span className="flex w-7 h-7 rounded-full bg-blue-400 text-white items-center justify-center font-bold text-base shadow-md">
                      {user.name
                        ? user.name[0].toUpperCase()
                        : user.email[0].toUpperCase()}
                    </span>
                    <span className="truncate max-w-[90px]">
                      {user.name || user.email}
                    </span>
                    <svg
                      className={`w-4 h-4 ml-1 transition-transform ${
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
                        className="flex items-center gap-2 w-full text-left px-5 py-3 text-sm text-blue-700 hover:bg-blue-50 font-medium transition-all duration-100"
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
                        className="flex items-center gap-2 w-full text-left px-5 py-3 text-sm text-red-600 hover:bg-red-50 font-medium border-t border-gray-100 transition-all duration-100"
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
                  className="px-2 mx-2 py-2 rounded bg-white border border-blue-400 text-blue-700 font-semibold hover:bg-blue-50 shadow-sm text-xs"
                  style={{ minWidth: 70 }}
                >
                  {t("navbar.dangNhap")}
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
              className="flex items-center space-x-1 cursor-pointer focus:outline-none text-gray-700 dark:text-gray-300"
            >
              <span
                className="w-8 h-8 rounded-full border border-gray-300 dark:border-gray-600 bg-cover bg-center"
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
              className="inline-flex items-center p-2 w-10 h-10 justify-center text-sm text-gray-600 rounded-lg md:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              aria-controls="navbar-cta"
              aria-expanded={isOpen}
            >
              <span className="sr-only">Open main menu</span>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24">
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
            className={`items-center justify-between w-full md:flex md:w-auto md:order-1 transition-all duration-300 ease-in-out ${
              isOpen ? "block animate-fade-in" : "hidden"
            }`}
            id="navbar-cta"
          >
            <ul className="flex flex-col font-medium p-4 md:p-0 mt-4 border border-gray-100 rounded-lg bg-white shadow-md md:shadow-none md:space-x-6 md:flex-row md:mt-0 md:border-0 md:bg-transparent dark:bg-gray-900">
              {menuConfig.map((item) => {
                if (item.type === "dropdown") {
                  const isOpen = !!dropdownOpen[item.key];
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
                        className={`flex items-center py-2 px-4 md:px-3 rounded-md transition-all duration-200 font-semibold text-sm uppercase ${
                          item.children.some((c) => c.key === activeLeaderKey)
                            ? "bg-blue-100 text-blue-700 font-semibold underline underline-offset-4"
                            : "text-gray-800 hover:text-blue-600 hover:bg-blue-50"
                        } dark:text-white dark:hover:text-blue-300`}
                        type="button"
                        aria-haspopup="true"
                        aria-expanded={isOpen}
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
                          className="inline w-4 h-4 ml-1"
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
                      {isOpen && (
                        <div
                          className="absolute left-0 mt-2 w-36 bg-white border rounded shadow-lg z-50"
                          style={{ minWidth: 120 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {item.children.map((child) => (
                            child.children ? (
                              <div key={child.key} className="relative group">
                                <button
                                  className={`block w-full text-left px-4 py-2 hover:bg-blue-50 uppercase text-xs ${
                                    activeLeaderKey === child.key
                                      ? "bg-blue-100 text-blue-700"
                                      : ""
                                  } flex items-center justify-between`}
                                  tabIndex={0}
                                >
                                  {t(child.label)}
                                  <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                                </button>
                                <div className="absolute left-full top-0 mt-0 ml-0 w-36 bg-white border rounded shadow-lg z-50 hidden group-hover:block group-focus:block" style={{ minWidth: 120 }}>
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
                                }}
                                className={`block w-full text-left px-4 py-2 hover:bg-blue-50 uppercase text-xs ${
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
                          ))}
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
                      className={`block py-2 px-4 md:px-3 rounded-md transition-all duration-200 font-semibold text-sm uppercase ${
                        item.key === activeLeaderKey
                          ? "bg-blue-100 text-blue-700 font-semibold underline underline-offset-4"
                          : "text-gray-800 hover:text-blue-600 hover:bg-blue-50"
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
