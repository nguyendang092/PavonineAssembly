import React, {
  useEffect,
  useState,
  useLayoutEffect,
  useMemo,
  useRef,
  Suspense,
} from "react";
import { createPortal } from "react-dom";
// firebase for global data fetching
import { db, ref, onValue } from "@/services/firebase";
import Navbar from "@/components/layout/Navbar";
import BackToTop from "@/components/ui/BackToTop";
import BackToBottom from "@/components/ui/BackToBottom";
import Footer from "@/components/layout/Footer";
import "@/config/i18n";
import { UserContext } from "@/contexts/UserContext";
import ProtectedRoute from "@/auth/ProtectedRoute";
import { routeConfig, PUBLIC_ROUTE_PATHS } from "@/config/menuConfig";
import { inferRoleFromMapping, isAdminOrHR, ROLES } from "@/config/authRoles";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import LoadingBlock from "@/components/ui/LoadingBlock";
import { lazyImport } from "@/utils/lazyImport";
const AttendanceList = lazyImport(
  () => import("@/features/attendance/AttendanceList"),
);
const SeasonalStaffAttendance = lazyImport(
  () => import("@/features/attendance/SeasonalStaffAttendance"),
);
const PayrollSalaryCalculator = lazyImport(
  () => import("@/features/payroll/PayrollSalaryCalculator"),
);
const AnnualLeaveManager = lazyImport(
  () => import("@/features/leave/AnnualLeaveManager"),
);
const KoreanTimesheetPage = lazyImport(
  () => import("@/features/attendance/KoreanTimesheetPage"),
);

const WorkplaceDashboardNormal = lazyImport(
  () => import("@/features/dashboard/WorkplaceDashboardNormal"),
);
const CertificateGenerator1 = lazyImport(
  () => import("@/components/ui/CertificateGenerator1"),
);
const CertificateGenerator2 = lazyImport(
  () => import("@/components/ui/CertificateGenerator2"),
);
const HonorBoard = lazyImport(() => import("@/features/employee/HonorBoard"));
const TemperatureMonitor = lazyImport(
  () => import("@/components/ui/TemperatureMonitor"),
);
const MoldManager = lazyImport(
  () => import("@/features/inventory/MoldManager"),
);
const PerformanceChart = lazyImport(
  () => import("@/features/dashboard/PerformanceChart"),
);
const QRCodeGenerator = lazyImport(
  () => import("@/components/ui/QRCodeGenerator"),
);
const WarehouseInventoryDashboard = lazyImport(
  () => import("@/features/dashboard/warehouseInventory"),
);
const MCDefectReportDashboard = lazyImport(
  () => import("@/features/dashboard/mcDefectReport"),
);
const Downloads = lazyImport(() => import("@/components/ui/Downloads"));
const UserDepartmentManager = lazyImport(
  () => import("@/features/employee/UserDepartmentManager"),
);
const PermissionCatalogPage = lazyImport(
  () => import("@/features/admin/PermissionCatalogPage"),
);
const InternalAnnouncements = lazyImport(
  () => import("@/features/employee/InternalAnnouncements"),
);
const InternalAnnouncementsLogin = lazyImport(
  () => import("@/features/employee/InternalAnnouncementsLogin"),
);
const LoginRoute = lazyImport(() => import("@/auth/LoginRoute"));
const NotFoundPage = lazyImport(() => import("@/components/ui/NotFoundPage"));

const AUTH_PATHS = new Set(["/login", "/email/login"]);
const NAVBAR_SCROLLED_CLASS =
  "bg-indigo-100/90 backdrop-blur-md border-b border-indigo-200 shadow-md dark:bg-slate-900/85 dark:border-slate-700";
const ROUTE_COMPONENTS = {
  WorkplaceDashboardNormal,
  CertificateGenerator1,
  CertificateGenerator2,
  HonorBoard,
  TemperatureMonitor,
  MoldManager,
  PerformanceChart,
  QRCodeGenerator,
  WarehouseInventoryDashboard,
  MCDefectReportDashboard,
  AttendanceList,
  SeasonalStaffAttendance,
  PayrollSalaryCalculator,
  AnnualLeaveManager,
  KoreanTimesheetPage,
  Downloads,
  UserDepartmentManager,
  PermissionCatalogPage,
  InternalAnnouncements,
};

function clearSessionAndRedirectToLogin(setUser) {
  localStorage.removeItem("userLogin");
  setUser(null);
  if (window.location.pathname !== "/login") {
    window.location.replace("/login");
  }
}

function ScrollActionPortal({ scrollContainerRef }) {
  const { pathname } = useLocation();
  if (AUTH_PATHS.has(pathname)) return null;

  return createPortal(
    <div
      className="pointer-events-auto fixed bottom-2 right-6 flex items-center gap-1.5"
      style={{ zIndex: "var(--z-scroll-actions)" }}
    >
      <BackToBottom
        alwaysVisible
        inline
        scrollContainerRef={scrollContainerRef}
      />
      <BackToTop alwaysVisible inline scrollContainerRef={scrollContainerRef} />
    </div>,
    document.body,
  );
}

function NavbarShell({ isScrolled, user, setUser, userRole }) {
  const { pathname } = useLocation();
  if (AUTH_PATHS.has(pathname)) return null;
  return (
    <div
      className={`fixed top-0 left-0 w-full transition-all duration-300 ${
        isScrolled ? NAVBAR_SCROLLED_CLASS : "bg-transparent"
      }`}
      style={{ zIndex: "var(--z-navbar)" }}
    >
      <Navbar user={user} setUser={setUser} userRole={userRole} />
    </div>
  );
}

function MainScrollShell({ mainScrollRef, children }) {
  const { pathname } = useLocation();
  const hideNavbar = AUTH_PATHS.has(pathname);
  return (
    <div
      id="app-main-scroll"
      ref={mainScrollRef}
      className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto"
      style={{
        paddingTop: hideNavbar ? "0px" : "var(--app-navbar-height, 4rem)",
      }}
    >
      {children}
    </div>
  );
}

function readSessionUser() {
  try {
    const loginData = localStorage.getItem("userLogin");
    if (!loginData) return null;
    const { email, name, expire } = JSON.parse(loginData);
    if (
      email &&
      typeof expire === "number" &&
      Number.isFinite(expire) &&
      Date.now() < expire
    ) {
      return { email, name };
    }
    localStorage.removeItem("userLogin");
  } catch {
    localStorage.removeItem("userLogin");
  }
  return null;
}

const App = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [user, setUser] = useState(() => readSessionUser());

  // departments the currently logged in user has access to
  const [userDepartments, setUserDepartments] = useState([]);
  const [userRole, setUserRole] = useState(null);

  /** Vùng cuộn chính — dùng cho navbar shadow + BackToTop / BackToBottom */
  const mainScrollRef = useRef(null);

  const userContextValue = useMemo(
    () => ({ user, setUser, userDepartments, userRole }),
    [user, userDepartments, userRole],
  );

  useEffect(() => {
    setUser(readSessionUser());
  }, []);

  useEffect(() => {
    if (!user?.email) return undefined;

    let timerId;
    try {
      const loginData = localStorage.getItem("userLogin");
      if (!loginData) {
        setUser(null);
        return undefined;
      }
      const { expire } = JSON.parse(loginData);
      if (typeof expire !== "number" || !Number.isFinite(expire)) {
        clearSessionAndRedirectToLogin(setUser);
        return undefined;
      }
      if (Date.now() >= expire) {
        clearSessionAndRedirectToLogin(setUser);
        return undefined;
      }
      const delay = expire - Date.now();
      timerId = window.setTimeout(() => {
        clearSessionAndRedirectToLogin(setUser);
      }, delay);
    } catch {
      clearSessionAndRedirectToLogin(setUser);
    }

    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [user]);

  // load departments + role for the logged-in user
  useEffect(() => {
    if (!user?.email) {
      setUserDepartments([]);
      setUserRole(null);
      return;
    }
    const userDeptsRef = ref(db, "userDepartments");
    const unsubscribe = onValue(userDeptsRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === "object") {
        const mapping = Object.values(data).find((m) => {
          if (!m.email || !user.email) return false;
          return (
            m.email.trim().toLowerCase() === user.email.trim().toLowerCase()
          );
        });
        if (mapping) {
          const depts =
            mapping.departments ||
            (mapping.department ? [mapping.department] : []);
          setUserDepartments(depts);
          let role = inferRoleFromMapping({ ...mapping, departments: depts });
          if (isAdminOrHR(user)) role = ROLES.ADMIN;
          setUserRole(role);
        } else {
          setUserDepartments([]);
          setUserRole(isAdminOrHR(user) ? ROLES.ADMIN : ROLES.STAFF);
        }
      } else {
        setUserDepartments([]);
        setUserRole(isAdminOrHR(user) ? ROLES.ADMIN : ROLES.STAFF);
      }
    });
    return () => unsubscribe();
  }, [user]);

  useLayoutEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return undefined;
    el.scrollTo({ top: 0, behavior: "auto" });
    const handleScroll = () => {
      // Bật nền navbar sớm để người dùng luôn thấy phân tách.
      const scrolled =
        (el?.scrollTop ?? 0) > 4 ||
        (window.scrollY ?? window.pageYOffset ?? 0) > 4;
      setIsScrolled(scrolled);
    };
    handleScroll();
    el.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <UserContext.Provider value={userContextValue}>
      <Router>
        <div className="min-h-screen flex flex-col bg-gray-50 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
          <NavbarShell
            isScrolled={isScrolled}
            user={user}
            setUser={setUser}
            userRole={userRole}
          />

          <MainScrollShell mainScrollRef={mainScrollRef}>
            <Suspense fallback={<LoadingBlock className="min-h-[60vh]" />}>
              <Routes>
                <Route path="/login" element={<LoginRoute />} />
                <Route
                  path="/email/login"
                  element={<InternalAnnouncementsLogin />}
                />
                <Route
                  path="/ng"
                  element={
                    <ProtectedRoute>
                      <Navigate to="/normal" replace />
                    </ProtectedRoute>
                  }
                />
                {/* Alias: link cũ / bookmark sai → đúng trang điểm danh */}
                <Route
                  path="/attendance-table"
                  element={
                    <ProtectedRoute>
                      <Navigate to="/attendance-list" replace />
                    </ProtectedRoute>
                  }
                />
                {routeConfig
                  .filter((r) => !PUBLIC_ROUTE_PATHS.has(r.path))
                  .map((r) => {
                    const RouteComponent = ROUTE_COMPONENTS[r.element];
                    return RouteComponent ? (
                      <Route
                        key={r.path}
                        path={r.path}
                        element={
                          <ProtectedRoute>
                            <RouteComponent />
                          </ProtectedRoute>
                        }
                      />
                    ) : null;
                  })}
                <Route
                  path="*"
                  element={
                    <ProtectedRoute>
                      <NotFoundPage />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </Suspense>
          </MainScrollShell>

          {/* Footer */}
          <Footer />

          <ScrollActionPortal scrollContainerRef={mainScrollRef} />
        </div>
      </Router>
    </UserContext.Provider>
  );
};

export default App;
