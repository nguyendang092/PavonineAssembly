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
import { db, ref, onValue } from "./services/firebase";
import AlertMessage from "./components/common/AlertMessage";
import Navbar from "./components/layout/Navbar";
import BackToTop from "./components/common/BackToTop";
import BackToBottom from "./components/common/BackToBottom";
import Footer from "./components/layout/Footer";
import "./config/i18n";
import { UserContext } from "./contexts/UserContext";
import { useLoading } from "./contexts/LoadingContext";
import { routeConfig } from "./config/menuConfig";
import { inferRoleFromMapping, isAdminOrHR, ROLES } from "./config/authRoles";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import "./styles/App.css";

const WorkplaceChart = lazy(
  () => import("./components/dashboard/WorkplaceChart"),
);
const NGWorkplaceChart = lazy(
  () => import("./components/dashboard/NGWorkplaceChart"),
);
const CertificateGenerator1 = lazy(
  () => import("./components/common/CertificateGenerator1"),
);
const CertificateGenerator2 = lazy(
  () => import("./components/common/CertificateGenerator2"),
);
const HonorBoard = lazy(() => import("./components/employee/HonorBoard"));
const TemperatureMonitor = lazy(
  () => import("./components/common/TemperatureMonitor"),
);
const Employ = lazy(() => import("./components/employee/Employ"));
const MoldManager = lazy(() => import("./components/inventory/MoldManager"));
const PerformanceChart = lazy(
  () => import("./components/dashboard/PerformanceChart"),
);
const QRCodeGenerator = lazy(
  () => import("./components/common/QRCodeGenerator"),
);
const AttendanceList = lazy(
  () => import("./components/attendance/AttendanceList"),
);
const SeasonalStaffAttendance = lazy(
  () => import("./components/attendance/SeasonalStaffAttendance"),
);
const Downloads = lazy(() => import("./components/common/Downloads"));
const UserDepartmentManager = lazy(
  () => import("./components/employee/UserDepartmentManager"),
);
const AllEmployeesManager = lazy(
  () => import("./components/employee/AllEmployeesManager"),
);
const ResignedEmployeesManager = lazy(
  () => import("./components/employee/ResignedEmployeesManager"),
);
const App = () => {
  const [toastMessage, setToastMessage] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const [user, setUser] = useState(null);
  const { setLoading } = useLoading();

  // departments the currently logged in user has access to
  const [userDepartments, setUserDepartments] = useState([]);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    setLoading(true);
    try {
      const loginData = localStorage.getItem("userLogin");
      if (loginData) {
        const { email, name, expire } = JSON.parse(loginData);
        if (
          email &&
          typeof expire === "number" &&
          Number.isFinite(expire) &&
          Date.now() < expire
        ) {
          setUser({ email, name });
          setTimeout(() => {
            localStorage.removeItem("userLogin");
            setUser(null);
          }, expire - Date.now());
        } else {
          localStorage.removeItem("userLogin");
          setUser(null);
        }
      }
    } catch {
      localStorage.removeItem("userLogin");
      setUser(null);
    }
    setTimeout(() => setLoading(false), 800);
  }, []);

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

  const showToast = (message) => {
    setToastMessage(message);
  };

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /** Vùng cuộn chính (không phải window) — dùng cho BackToTop / BackToBottom */
  const mainScrollRef = useRef(null);

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
      AllEmployeesManager: <AllEmployeesManager />,
      ResignedEmployeesManager: <ResignedEmployeesManager />,
      Employ: <Employ showToast={showToast} />,
    }),
    [],
  );

  return (
    <UserContext.Provider value={{ user, setUser, userDepartments, userRole }}>
      <Router>
        <div className="min-h-screen flex flex-col bg-gray-50">
          {/* Navbar cố định */}
          <div
            className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
              isScrolled
                ? "bg-white/30 backdrop-blur-md shadow-md"
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
            <Suspense
              fallback={
                <div className="h-[60vh] flex items-center justify-center text-gray-500 text-lg">
                  Loading...
                </div>
              }
            >
              <Routes>
                <Route path="/" element={<Navigate to="/normal" replace />} />
                {routeConfig.map((r) => {
                  const element = routeElements[r.element];
                  return element ? (
                    <Route key={r.path} path={r.path} element={element} />
                  ) : null;
                })}
                <Route path="*" element={<Navigate to="/normal" replace />} />
              </Routes>
            </Suspense>
          </div>

          {/* Footer */}
          <Footer />

          <AlertMessage
            message={toastMessage}
            onClose={() => setToastMessage("")}
          />

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
