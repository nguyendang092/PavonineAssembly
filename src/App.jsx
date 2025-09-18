import React, { useEffect, useState, useLayoutEffect } from "react";
import Employ from "./Employ";
import Toast from "./Toast";
import Navbar from "./Navbar";
import TemperatureMonitor from "./TemperatureMonitor";
import { FaArrowCircleUp } from "react-icons/fa";
import "./i18n";
import WorkplaceChart from "./WorkplaceChart";
import ModelProductionChart from "./ModelProductionChart";
import { UserContext } from "./UserContext";
import NGWorkplaceChart from "./NGWorkplaceChart";
import { useLoading } from "./LoadingContext";
import CertificateGenerator1 from "./CertificateGenerator1";
import CertificateGenerator2 from "./CertificateGenerator2";
import Metandeco from "./Metandeco";
import { routeConfig } from "./menuConfig";
import MoldManager from "./MoldManager";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import "./App.css";

const App = () => {
  // Khi F5 (refresh) ở bất kỳ trang nào, tự động chuyển về trang chủ /normal
  useEffect(() => {
    if (window.location.pathname !== "/normal" && window.location.pathname !== "/") {
      window.location.replace("/normal");
    }
  }, []);
  const [toastMessage, setToastMessage] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const [user, setUser] = useState(null);
  const { setLoading } = useLoading();

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

  return (
    <UserContext.Provider value={{ user, setUser }}>
      <Router>
        <div>
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
          <div className="pt-16 overflow-hidden">
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
                  case "Metandeco":
                    Element = Metandeco;
                    break;
                  case "CertificateGenerator1":
                    Element = CertificateGenerator1;
                    break;
                  case "CertificateGenerator2":
                    Element = CertificateGenerator2;
                    break;
                  case "TemperatureMonitor":
                    Element = TemperatureMonitor;
                    break;
                  case "MoldManager":
  Element = MoldManager;
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

          {/* Toast */}
          <Toast message={toastMessage} onClose={() => setToastMessage("")} />

          {/* Nút scroll to top */}
          {isScrolled && (
            <button
              onClick={scrollToTop}
              className="fixed bottom-6 right-6 z-50 text-blue-600 hover:text-white bg-white hover:bg-blue-600 rounded-full shadow-lg p-3 transition duration-300"
            >
              <FaArrowCircleUp size={24} />
            </button>
          )}
        </div>
      </Router>
    </UserContext.Provider>
  );
};

export default App;
