import React, {
  useEffect,
  useState,
  useLayoutEffect,
  useMemo,
  useRef,
  Suspense,
  lazy,
} from "react";
import { createPortal } from "react-dom";
// firebase for global data fetching
import { db, ref, onValue } from "@/services/firebase";
import MyAccessSummary from "@/components/ui/MyAccessSummary";
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
} from "react-router-dom";
import "@/styles/App.css";
import LoadingBlock from "@/components/ui/LoadingBlock";

const WorkplaceChart = lazy(
  () => import("@/features/dashboard/WorkplaceChart"),
);
const NGWorkplaceChart = lazy(
  () => import("@/features/dashboard/NGWorkplaceChart"),
);
const CertificateGenerator1 = lazy(
  () => import("@/components/ui/CertificateGenerator1"),
);
const CertificateGenerator2 = lazy(
  () => import("@/components/ui/CertificateGenerator2"),
);
const HonorBoard = lazy(() => import("@/features/employee/HonorBoard"));
const TemperatureMonitor = lazy(
  () => import("@/components/ui/TemperatureMonitor"),
);
const MoldManager = lazy(() => import("@/features/inventory/MoldManager"));
const PerformanceChart = lazy(
  () => import("@/features/dashboard/PerformanceChart"),
);
const QRCodeGenerator = lazy(
  () => import("@/components/ui/QRCodeGenerator"),
);
const AttendanceList = lazy(
  () => import("@/features/attendance/AttendanceList"),
);
const SeasonalStaffAttendance = lazy(
  () => import("@/features/attendance/SeasonalStaffAttendance"),
);
const Downloads = lazy(() => import("@/components/ui/Downloads"));
const UserDepartmentManager = lazy(
  () => import("@/features/employee/UserDepartmentManager"),
);
const InternalAnnouncements = lazy(
  () => import("@/features/employee/InternalAnnouncements"),
);
const InternalAnnouncementsLogin = lazy(
  () => import("@/features/employee/InternalAnnouncementsLogin"),
);
const AllEmployeesManager = lazy(
  () => import("@/features/employee/AllEmployeesManager"),
);
const ResignedEmployeesManager = lazy(
  () => import("@/features/employee/ResignedEmployeesManager"),
);
const LoginRoute = lazy(() => import("@/auth/LoginRoute"));

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
      if (
        typeof expire !== "number" ||
        !Number.isFinite(expire) ||
        Date.now() >= expire
      ) {
        localStorage.removeItem("userLogin");
        setUser(null);
        if (window.location.pathname !== "/login") {
          window.location.replace("/login");
        }
        return undefined;
      }
      const delay = expire - Date.now();
      timerId = window.setTimeout(() => {
        localStorage.removeItem("userLogin");
        setUser(null);
        if (window.location.pathname !== "/login") {
          window.location.replace("/login");
        }
      }, delay);
    } catch {
      localStorage.removeItem("userLogin");
      setUser(null);
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
      setIsScrolled(el.scrollTop > 100);
    };
    handleScroll();
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  const routeElements = useMemo(
    () => ({
      WorkplaceChart: <WorkplaceChart />,
      NGWorkplaceChart: <NGWorkplaceChart />,
      CertificateGenerator1: <CertificateGenerator1 />,
      CertificateGenerator2: <CertificateGenerator2 />,
      HonorBoard: <HonorBoard />,
      TemperatureMonitor: <TemperatureMonitor />,
      MoldManager: <MoldManager />,
      PerformanceChart: <PerformanceChart />,
      QRCodeGenerator: <QRCodeGenerator />,
      AttendanceList: <AttendanceList />,
      SeasonalStaffAttendance: <SeasonalStaffAttendance />,
      Downloads: <Downloads />,
      UserDepartmentManager: <UserDepartmentManager />,
      InternalAnnouncements: <InternalAnnouncements />,
      AllEmployeesManager: <AllEmployeesManager />,
      ResignedEmployeesManager: <ResignedEmployeesManager />,
    }),
    [],
  );

  return (
    <UserContext.Provider value={userContextValue}>
      <Router>
        <div className="min-h-screen flex flex-col bg-gray-50 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100">
          {/* Navbar cố định */}
          <div
            className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
              isScrolled
                ? "bg-white/80 shadow-md backdrop-blur-md dark:bg-slate-900/85"
                : "bg-transparent"
            }`}
          >
            <Navbar user={user} setUser={setUser} userRole={userRole} />
          </div>

          {/* Nội dung chính */}
          <div
            id="app-main-scroll"
            ref={mainScrollRef}
            className="pt-16 flex-1 min-h-0 overflow-x-hidden overflow-y-auto"
          >
            {user ? <MyAccessSummary variant="compact" /> : null}
            <Suspense
              fallback={
                <LoadingBlock className="min-h-[60vh]" />
              }
            >
              <Routes>
                <Route path="/login" element={<LoginRoute />} />
                <Route
                  path="/email/login"
                  element={<InternalAnnouncementsLogin />}
                />
                {routeConfig
                  .filter((r) => !PUBLIC_ROUTE_PATHS.has(r.path))
                  .map((r) => {
                    const element = routeElements[r.element];
                    return element ? (
                      <Route
                        key={r.path}
                        path={r.path}
                        element={
                          <ProtectedRoute>{element}</ProtectedRoute>
                        }
                      />
                    ) : null;
                  })}
                <Route
                  path="*"
                  element={
                    <ProtectedRoute>
                      <Navigate to="/" replace />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </Suspense>
          </div>

          {/* Footer */}
          <Footer />

          {/* Portal ra body + z cao để không bị footer / layer khác che; cuộn theo mainScrollRef */}
          {createPortal(
            <div className="pointer-events-auto fixed bottom-6 right-6 z-[9999] flex items-center gap-1.5">
              <BackToBottom
                alwaysVisible
                inline
                scrollContainerRef={mainScrollRef}
              />
              <BackToTop
                alwaysVisible
                inline
                scrollContainerRef={mainScrollRef}
              />
            </div>,
            document.body,
          )}
        </div>
      </Router>
    </UserContext.Provider>
  );
};

export default App;
