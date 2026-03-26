import React, {
  useEffect,
  useState,
  useLayoutEffect,
  useMemo,
  Suspense,
  lazy,
} from "react";
// firebase for global data fetching
import { db, ref, onValue } from "./services/firebase";
import Toast from "./components/common/Toast";
import Navbar from "./components/layout/Navbar";
import BackToTop from "./components/common/BackToTop";
import Footer from "./components/layout/Footer";
import "./config/i18n";
import { UserContext } from "./contexts/UserContext";
import { useLoading } from "./contexts/LoadingContext";
import { routeConfig } from "./config/menuConfig";
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
const AttendanceDashboardContainer = lazy(
  () => import("./components/attendance/AttendanceDashboardContainer"),
);
const AttendanceTable = lazy(
  () => import("./components/attendance/AttendanceTable"),
);
const SeasonalStaffAttendance = lazy(
  () => import("./components/attendance/SeasonalStaffAttendance"),
);
const Downloads = lazy(() => import("./components/common/Downloads"));
const UserDepartmentManager = lazy(
  () => import("./components/employee/UserDepartmentManager"),
);
const MaintenanceChecklist = lazy(
  () => import("./components/maintenance/MaintenanceChecklist"),
);
const DriverLogbook = lazy(
  () => import("./components/logistics/DriverLogbook"),
);

const App = () => {
  // Bỏ logic tự động chuyển về /normal khi refresh
  // useEffect(() => {
  //   if (
  //     window.location.pathname !== "/normal" &&
  //     window.location.pathname !== "/"
  //   ) {
  //     window.location.replace("/normal");
  //   }
  // }, []);
  const [toastMessage, setToastMessage] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const [user, setUser] = useState(null);
  const { setLoading } = useLoading();

  // departments the currently logged in user has access to
  const [userDepartments, setUserDepartments] = useState([]);

  useEffect(() => {
    setLoading(true);
    const loginData = localStorage.getItem("userLogin");
    if (loginData) {
      const { email, name, expire } = JSON.parse(loginData);
      if (Date.now() < expire) {
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
    setTimeout(() => setLoading(false), 800);
  }, []);

  // load departments for the logged-in user
  useEffect(() => {
    if (!user?.email) {
      setUserDepartments([]);
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
        } else {
          setUserDepartments([]);
        }
      } else {
        setUserDepartments([]);
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

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Chọn hiệu ứng theo mùa ở đây, ví dụ: 'snow' hoặc 'newyear'
  const [seasonEffect, setSeasonEffect] = useState("snow"); // hoặc 'newyear'

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
      AttendanceDashboard: <AttendanceDashboardContainer />,
      AttendanceTable: <AttendanceTable />,
      SeasonalStaffAttendance: <SeasonalStaffAttendance />,
      Downloads: <Downloads />,
      MaintenanceChecklist: <MaintenanceChecklist />,
      DriverLogbook: <DriverLogbook />,
      UserDepartmentManager: <UserDepartmentManager />,
      Employ: <Employ showToast={showToast} />,
    }),
    [],
  );

  return (
    <UserContext.Provider value={{ user, setUser }}>
      <Router>
        {/* Hiệu ứng mùa: tuyết rơi hoặc Happy New Year */}
        {/* <SeasonEffect effect={seasonEffect} /> */}
        <div className="min-h-screen flex flex-col bg-gray-50">
          {/* Navbar cố định */}
          <div
            className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
              isScrolled
                ? "bg-white/30 backdrop-blur-md shadow-md"
                : "bg-transparent"
            }`}
          >
            <Navbar user={user} setUser={setUser} />
          </div>

          {/* Nội dung chính */}
          <div className="pt-16 overflow-hidden flex-1">
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

          {/* Toast */}
          <Toast message={toastMessage} onClose={() => setToastMessage("")} />

          {/* Nút scroll to top - luôn hiển thị */}
          <BackToTop alwaysVisible bottom={24} right={24} />
        </div>
      </Router>
    </UserContext.Provider>
  );
};

export default App;
