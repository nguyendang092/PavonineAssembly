import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getAuth, signOut } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { menuConfig } from "@/config/menuConfig";
import { isAdminAccess } from "@/config/authRoles";
import { useTheme } from "@/contexts/ThemeContext";
import { lazyImport } from "@/utils/lazyImport";
import NavbarDesktop from "./NavbarDesktop";
import NavbarMobileDrawer from "./NavbarMobileDrawer";
import NavbarTools from "./NavbarTools";
import { useNavbarHeight } from "./hooks/useNavbarHeight";
import { useLockBodyScroll } from "./hooks/useLockBodyScroll";
import { useDesktopDropdownSuppress } from "./hooks/useDesktopDropdownSuppress";
import { useMobileMenu } from "./hooks/useMobileMenu";
import { getNavbarUserDisplayName, getNavbarUserRoleLabel } from "./userDisplay";
import "../navbar.css";

const LANGUAGE_OPTIONS_UPPER = {
  vi: "TIẾNG VIỆT",
  ko: "한국어",
};

const SignIn = lazyImport(() => import("@/auth/SignIn"));
const ChangePasswordModal = lazyImport(
  () => import("@/components/modals/ChangePasswordModal"),
);

export default function Navbar({ user, setUser, userRole }) {
  const { theme, toggleTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [language, setLanguage] = useState(() =>
    i18n.language?.startsWith("ko") ? "ko" : "vi",
  );
  const [signInOpen, setSignInOpen] = useState(false);
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const navbarMeasureRef = useRef(null);

  const {
    mobileMenuOpen,
    toggleMobileMenu,
    closeMobileMenu,
    mobileDropdowns,
    toggleMobileDropdown,
  } = useMobileMenu(menuConfig);

  const closeUserMenu = useCallback(() => setUserDropdownOpen(false), []);

  const { suppressed: desktopDropdownSuppressed, handleDesktopNavClick } =
    useDesktopDropdownSuppress(closeUserMenu);

  useNavbarHeight(navbarMeasureRef);
  useLockBodyScroll(mobileMenuOpen);

  const handleChangeLanguage = useCallback(
    (lang) => {
      setLanguage(lang);
      i18n.changeLanguage(lang);
      localStorage.setItem("appLanguage", lang);
    },
    [i18n],
  );

  useEffect(() => {
    const syncLanguage = (lng) => {
      setLanguage(lng?.startsWith("ko") ? "ko" : "vi");
    };
    syncLanguage(i18n.language);
    i18n.on("languageChanged", syncLanguage);
    return () => i18n.off("languageChanged", syncLanguage);
  }, [i18n]);

  const handleSignIn = useCallback(() => {
    closeMobileMenu();
    setSignInOpen(true);
  }, [closeMobileMenu]);

  const handleSignInSuccess = useCallback(
    (userInfo) => {
      if (setUser) setUser(userInfo);
      setSignInOpen(false);
    },
    [setUser],
  );

  const handleSignOut = useCallback(async () => {
    try {
      await signOut(getAuth());
    } catch {
      /* ignore */
    }
    localStorage.removeItem("userLogin");
    if (setUser) setUser(null);
    closeMobileMenu();
    setUserDropdownOpen(false);
    navigate("/login", { replace: true });
  }, [setUser, navigate, closeMobileMenu]);

  const showAdminOnlyMenu = Boolean(user && isAdminAccess(user, userRole));

  const navbarUserDisplayName = useMemo(
    () => getNavbarUserDisplayName(user),
    [user],
  );

  const navbarUserRoleLabel = useMemo(
    () => getNavbarUserRoleLabel(user, userRole),
    [user, userRole],
  );

  const navbarUserFullLabel = useMemo(
    () => (user ? String(user.name ?? "").trim() || user.email || "" : ""),
    [user],
  );

  const menuCtx = useMemo(
    () => ({
      menuConfig,
      t,
      user,
      showAdminOnlyMenu,
      handleDesktopNavClick,
      closeMobileMenu,
      toggleMobileDropdown,
      mobileDropdowns,
    }),
    [
      t,
      user,
      showAdminOnlyMenu,
      handleDesktopNavClick,
      closeMobileMenu,
      toggleMobileDropdown,
      mobileDropdowns,
    ],
  );

  const toolsRegionLabel = t(
    "navbar.toolsRegion",
    "Ngôn ngữ, giao diện và tài khoản",
  );

  return (
    <>
      <Suspense fallback={null}>
        {signInOpen ? (
          <SignIn
            onSignIn={handleSignInSuccess}
            onClose={() => setSignInOpen(false)}
          />
        ) : null}
        {changePwOpen ? (
          <ChangePasswordModal onClose={() => setChangePwOpen(false)} />
        ) : null}
      </Suspense>

      <NavbarMobileDrawer
        open={mobileMenuOpen}
        onClose={closeMobileMenu}
        theme={theme}
        toggleTheme={toggleTheme}
        t={t}
        menuCtx={menuCtx}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />

      <nav ref={navbarMeasureRef} className="navbar">
        <div className="nav-logo">
          <Link to="/" className="nav-logo-text" aria-label={t("navbar.home", "Trang chủ")}>
            Pavonine
          </Link>
        </div>

        <div
          id="hamburger-menu"
          role="button"
          tabIndex={0}
          aria-label={t("navbar.openMobileMenu", "Mở menu")}
          aria-expanded={mobileMenuOpen}
          onClick={toggleMobileMenu}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleMobileMenu();
            }
          }}
        >
          ☰
        </div>

        <NavbarDesktop
          desktopDropdownSuppressed={desktopDropdownSuppressed}
          menuCtx={menuCtx}
        />

        <NavbarTools
          theme={theme}
          toggleTheme={toggleTheme}
          language={language}
          languageOptions={LANGUAGE_OPTIONS_UPPER}
          onChangeLanguage={handleChangeLanguage}
          t={t}
          toolsRegionLabel={toolsRegionLabel}
          user={user}
          userDropdownOpen={userDropdownOpen}
          setUserDropdownOpen={setUserDropdownOpen}
          navbarUserDisplayName={navbarUserDisplayName}
          navbarUserRoleLabel={navbarUserRoleLabel}
          navbarUserFullLabel={navbarUserFullLabel}
          showAdminOnlyMenu={showAdminOnlyMenu}
          onChangePassword={() => setChangePwOpen(true)}
          onSignOut={handleSignOut}
          onSignIn={handleSignIn}
        />
      </nav>
    </>
  );
}
