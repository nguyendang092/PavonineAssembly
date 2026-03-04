import React, { useEffect, useState, useLayoutEffect } from "react";
import SeasonEffect from "./components/common/SeasonEffect";
// firebase for global data fetching
import { db, ref, onValue } from "./services/firebase";
import Employ from "./components/employee/Employ";
import Toast from "./components/common/Toast";
import Navbar from "./components/layout/Navbar";
import TemperatureMonitor from "./components/common/TemperatureMonitor";
import BackToTop from "./components/common/BackToTop";
import Footer from "./components/layout/Footer";
import "./config/i18n";
import WorkplaceChart from "./components/dashboard/WorkplaceChart";
import ModelProductionChart from "./components/dashboard/ModelProductionChart";
import { UserContext } from "./contexts/UserContext";
import NGWorkplaceChart from "./components/dashboard/NGWorkplaceChart";
import { useLoading } from "./contexts/LoadingContext";
import CertificateGenerator1 from "./components/common/CertificateGenerator1";
import CertificateGenerator2 from "./components/common/CertificateGenerator2";
import HonorBoard from "./components/employee/HonorBoard";
import Metandeco from "./components/common/Metandeco";
import { routeConfig } from "./config/menuConfig";
import MoldManager from "./components/inventory/MoldManager";
import PerformanceChart from "./components/dashboard/PerformanceChart";
import QRCodeGenerator from "./components/common/QRCodeGenerator";
import AttendanceList from "./components/attendance/AttendanceList";
import AttendanceDashboardContainer from "./components/attendance/AttendanceDashboardContainer";
import AttendanceTable from "./components/attendance/AttendanceTable";
import SeasonalStaffAttendance from "./components/attendance/SeasonalStaffAttendance";
import Downloads from "./components/common/Downloads";
import UserDepartmentManager from "./components/employee/UserDepartmentManager";
import MaintenanceChecklist from "./components/maintenance/MaintenanceChecklist";
import DriverLogbook from "./components/logistics/DriverLogbook";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import "./styles/App.css";

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
  // maintenance tasks belonging to those departments
  const [deptTasks, setDeptTasks] = useState([]);
  // whether the popup has been shown
  const [showDeptPopup, setShowDeptPopup] = useState(false);

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

  // reset popup whenever user logs in/out so it can show again
  useEffect(() => {
    setShowDeptPopup(false);
  }, [user]);

  // when departments change, read maintenance tasks and show popup/toast
  useEffect(() => {
    if (!userDepartments || userDepartments.length === 0) {
      setDeptTasks([]);
      return;
    }
    const tasksRef = ref(db, "maintenance");
    const unsubscribe = onValue(tasksRef, (snapshot) => {
      const data = snapshot.val();
      console.log("[maintenance watch] userDepartments", userDepartments);
      if (data && typeof data === "object") {
        const arr = Object.entries(data).map(([id, t]) => ({ id, ...t }));
        const relevant = arr.filter((t) => {
          if (!t.department) return false;
          const taskDept = (t.department || "").trim().toLowerCase();
          return (
            !t.completed &&
            userDepartments.some(
              (d) => (d || "").trim().toLowerCase() === taskDept,
            )
          );
        });
        console.log("[maintenance watch] relevant tasks", relevant);
        setDeptTasks(relevant);
        if (relevant.length > 0 && !showDeptPopup) {
          // display once when tasks exist
          setShowDeptPopup(true);
          setToastMessage(
            `⚠️ Có ${relevant.length} công việc bảo trì cho bộ phận của bạn. Vào trang Bảo trì để kiểm tra.`,
          );
        }
      } else {
        setDeptTasks([]);
      }
    });
    return () => unsubscribe();
  }, [userDepartments, showDeptPopup]);

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
            {/* department-specific maintenance popup */}
            {showDeptPopup && deptTasks.length > 0 && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white p-6 rounded-2xl max-w-lg w-full">
                  <h3 className="text-xl font-bold mb-4">
                    📌 Công việc bảo trì dành cho bộ phận của bạn
                  </h3>
                  <ul className="list-disc pl-5 text-left mb-4 max-h-64 overflow-auto">
                    {deptTasks.map((t) => (
                      <li key={t.id}>{t.name}</li>
                    ))}
                  </ul>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowDeptPopup(false)}
                      className="mt-2 px-4 py-2 bg-gray-400 text-white rounded-xl hover:bg-gray-500"
                    >
                      Đóng
                    </button>
                    <button
                      onClick={() => {
                        setShowDeptPopup(false);
                        window.location.href = "/maintenance";
                      }}
                      className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
                    >
                      Xem chi tiết
                    </button>
                  </div>
                </div>
              </div>
            )}
            <Routes>
              <Route path="/" element={<Navigate to="/normal" replace />} />
              {routeConfig.map((r) => {
                let Element;
                switch (r.element) {
                  case "WorkplaceChart":
                    Element = WorkplaceChart;
                    break;
                  case "NGWorkplaceChart":
                    Element = NGWorkplaceChart;
                    break;
                  case "ModelProductionChart":
                    Element = ModelProductionChart;
                    break;
                  // case "Metandeco":
                  //   Element = Metandeco;
                  //   break;
                  case "CertificateGenerator1":
                    Element = CertificateGenerator1;
                    break;
                  case "CertificateGenerator2":
                    Element = CertificateGenerator2;
                    break;
                  case "HonorBoard":
                    Element = HonorBoard;
                    break;
                  case "TemperatureMonitor":
                    Element = TemperatureMonitor;
                    break;
                  case "MoldManager":
                    Element = MoldManager;
                    break;
                  case "PerformanceChart":
                    Element = PerformanceChart;
                    break;
                  case "QRCodeGenerator":
                    Element = QRCodeGenerator;
                    break;
                  case "AttendanceList":
                    Element = AttendanceList;
                    break;
                  case "AttendanceDashboard":
                    Element = AttendanceDashboardContainer;
                    break;
                  case "AttendanceTable":
                    Element = AttendanceTable;
                    break;
                  case "SeasonalStaffAttendance":
                    Element = SeasonalStaffAttendance;
                    break;
                  case "Downloads":
                    Element = Downloads;
                    break;
                  case "MaintenanceChecklist":
                    Element = MaintenanceChecklist;
                    break;
                  case "DriverLogbook":
                    Element = DriverLogbook;
                    break;
                  // case "Inventory":
                  //   Element = Inventory;
                  //   break;
                  case "UserDepartmentManager":
                    Element = UserDepartmentManager;
                    break;
                  case "Employ":
                    Element = (props) => (
                      <Employ {...props} showToast={showToast} />
                    );
                    break;
                  default:
                    Element = null;
                }
                return Element ? (
                  <Route key={r.path} path={r.path} element={<Element />} />
                ) : null;
              })}
              <Route path="*" element={<Navigate to="/normal" replace />} />
            </Routes>
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
