import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { useTranslation } from "react-i18next";
import { logUserAction } from "./userLog";
import { ref, get, child } from "firebase/database";
import { db } from "./firebase";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);
function getCurrentWeekNumber() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff =
    (now -
      start +
      (start.getTimezoneOffset() - now.getTimezoneOffset()) * 60000) /
    86400000;
  return Math.ceil((diff + start.getDay() + 1) / 7);
}
function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}
function getWeekNumber(dateStr) {
  const date = new Date(dateStr);
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}
import { useUser } from "./UserContext";

export default function DetailedModal({ isOpen, onClose, area }) {
  const { t } = useTranslation();
  const { user } = useUser();
  const [selectedArea, setSelectedArea] = useState(area || "Assembly");
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeekNumber().toString());
  const [selectedDate, setSelectedDate] = useState(getYesterday());
  const [selectedModel, setSelectedModel] = useState("");
  const [areas, setAreas] = useState([]);
  const [allDetailData, setAllDetailData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const [forceFetch, setForceFetch] = useState(0); // trigger fetchData khi mở modal
  useEffect(() => {
    const fetchAreas = async () => {
      const snapshot = await get(ref(db, "details"));
      if (snapshot.exists()) {
        setAreas(Object.keys(snapshot.val()));
      }
    };
    fetchAreas();
  }, []);
  useEffect(() => {
    if (selectedDate) {
      const weekNum = getWeekNumber(selectedDate);
      setSelectedWeek(weekNum.toString());
    }
  }, [selectedDate]);
  useEffect(() => {
    if (!selectedArea || !selectedDate) return;
    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      // Lấy toàn bộ tuần của area, lọc đúng ngày đã chọn
      const areaRef = ref(db, `details/${selectedArea}`);
      const snapshot = await get(areaRef);
      if (!isMounted) return;
      const details = [];
      if (snapshot.exists()) {
        const weekData = snapshot.val();
        for (const weekKey in weekData) {
          const models = weekData[weekKey];
          for (const model in models) {
            const modelData = models[model];
            if (modelData[selectedDate]) {
              const quantity = modelData[selectedDate];
              details.push({ model, date: selectedDate, quantity });
            }
          }
        }
      }
      setAllDetailData(details);
      setLoading(false);
    };
    fetchData();
    return () => {
      isMounted = false;
    };
  }, [selectedArea, selectedDate, forceFetch]);
  const filteredData = allDetailData
    .filter((item) => item.model.toLowerCase().includes(selectedModel.toLowerCase()))
    .sort((a, b) => b.quantity - a.quantity);

  // Xuất Excel toàn bộ dữ liệu đang lọc
  const handleExportExcel = () => {
    if (!filteredData.length) return;
    const ws = XLSX.utils.json_to_sheet(
      filteredData.map((item) => ({
        [t("detailedModal.area")]: selectedArea,
        [t("detailedModal.model")]: item.model,
        [t("detailedModal.date")]: item.date,
        [t("detailedModal.quantity")]: item.quantity,
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Details");
    XLSX.writeFile(wb, `details_${selectedArea}_${selectedDate}.xlsx`);
  };
  const chartData = {
    labels: filteredData.map((item) => item.model),
    datasets: [
      {
        label: "Sản lượng",
        data: filteredData.map((item) => item.quantity),
        backgroundColor: "#7dd3fc",
      },
    ],
  };
  useEffect(() => {
    if (!isOpen) {
      setAllDetailData([]);
      setSelectedModel("");
      setVisibleCount(10);
    } else {
      // Reset selectedArea về prop area mỗi lần mở modal
      setSelectedArea(area || "Assembly");
      setForceFetch(f => f + 1); // trigger fetchData lại kể cả khi selectedArea không đổi
      // Ghi log khi mở modal chi tiết sản lượng
      if (user && user.email) {
        logUserAction(
          user.email,
          "view_detail_output",
          `Xem chi tiết sản lượng khu vực: ${area || "Assembly"}, ngày: ${selectedDate}`
        );
      }
    }
  }, [isOpen, area]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white w-[90vw] h-[90vh] p-4 rounded shadow-lg flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1 text-center">
            <h2 className="text-xl font-bold uppercase inline-block">
              {t("detailedModal.title")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-red-500 text-base font-bold ml-auto"
          >
            {t("detailedModal.close")}
          </button>
        </div>

        {/* Bộ lọc nhỏ gọn giống DetailedNGModal */}
        <div className="flex flex-col gap-2 mb-4 px-4 pt-2 pb-3 rounded-2xl shadow border border-[#e0e7ef] bg-white/70 backdrop-blur-sm w-full max-w-2xl mx-auto">
          <div className="flex flex-wrap gap-2">
            <div className="flex flex-col min-w-[120px] flex-1">
              <label className="text-xs text-gray-600 mb-1 font-semibold" htmlFor="area-select">{t("detailedModal.area")}</label>
              <select
                id="area-select"
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 text-sm"
              >
                {areas.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col min-w-[120px] flex-1">
              <label className="text-xs text-gray-600 mb-1 font-semibold" htmlFor="date-input">{t("detailedModal.date")}</label>
              <input
                id="date-input"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 text-sm"
              />
            </div>
            <div className="flex flex-col min-w-[90px] flex-1">
              <label className="text-xs text-gray-600 mb-1 font-semibold" htmlFor="week-select">Tuần</label>
              <select
                id="week-select"
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1 bg-white text-gray-800 text-sm cursor-not-allowed opacity-60"
                disabled
              >
                {Array.from({ length: 52 }, (_, i) => i + 1).map((w) => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col min-w-[120px] flex-1">
              <label className="text-xs text-gray-600 mb-1 font-semibold" htmlFor="model-search">{t("detailedModal.model")}</label>
              <input
                id="model-search"
                type="text"
                placeholder={t("detailedModal.searchModel")}
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 text-sm"
              />
            </div>
            <div className="flex flex-col justify-end min-w-fit flex-1 items-end">
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1 bg-gradient-to-r from-[#7dd3fc] to-[#38bdf8] hover:from-[#bae6fd] hover:to-[#0ea5e9] text-[#334155] font-bold py-1 px-3 rounded-lg shadow transition-all duration-150 text-sm whitespace-nowrap min-w-fit"
                style={{ boxShadow: '0 2px 8px 0 rgba(56,189,248,0.10)' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" /></svg>
                <span className="whitespace-nowrap">{t("detailedModal.exportExcel")}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Nội dung chính: Biểu đồ + bảng */}
        <div className="flex flex-1 overflow-hidden">
          <div className="w-2/3 pr-4 h-full">
            {chartData && chartData.labels.length > 0 ? (
              <Bar
                data={{
                  ...chartData,
                  datasets: chartData.datasets.map((ds) => ({
                    ...ds,
                    backgroundColor: "rgba(255,105,180,0.7)", // màu hồng
                    borderWidth: 0, // bỏ viền
                  })),
                }}
                options={{
                  indexAxis: "y",
                  responsive: true,
                  maintainAspectRatio: false,
                  elements: {
                    bar: {
                      borderRadius: 10, // bo tròn góc
                      borderWidth: 0, // không border
                    },
                  },
                  scales: {
                    x: {
                      beginAtZero: true,
                      ticks: {
                        color: "#000",
                        font: { weight: "bold", size: 10 },
                      },
                      grid: { display: false },
                      max: (() => {
                        // Lấy max data trong datasets[0].data rồi cộng thêm 50
                        if (
                          !chartData ||
                          !chartData.datasets ||
                          chartData.datasets.length === 0
                        )
                          return undefined;
                        const maxVal = Math.max(...chartData.datasets[0].data);
                        return maxVal + 50;
                      })(),
                    },
                    y: {
                      ticks: {
                        color: "#000",
                        font: { weight: "bold", size: 10 },
                      },
                      grid: { display: false },
                    },
                  },
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (context) => {
                          const val = context.parsed.x || 0;
                          return val.toLocaleString();
                        },
                      },
                    },
                    datalabels: {
                      anchor: "end",
                      align: "end",
                      color: "#000",
                      font: { weight: "bold", size: 10 },
                      formatter: (value) => value.toLocaleString(),
                    },
                  },
                }}
              />
            ) : loading ? (
              <p className="text-center text-gray-500 italic">{t("detailedModal.loadingChart")}</p>
            ) : (
              <p>{t("detailedModal.noChartData")}</p>
            )}
          </div>
          {/* Bảng chi tiết (1/3) */}
          <div className="w-1/3 overflow-auto">
            {loading ? (
              <p className="text-center text-gray-500 italic">{t("detailedModal.loadingData")}</p>
            ) : (
              <>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="border-b p-1 text-center">{t("detailedModal.area")}</th>
                      <th className="border-b p-1 text-center">{t("detailedModal.model")}</th>
                      <th className="border-b p-1 text-center">{t("detailedModal.date")}</th>
                      <th className="border-b p-1 text-center">{t("detailedModal.quantity")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.slice(0, visibleCount).map((item, i) => (
                      <tr key={i}>
                        <td className="border-b p-1 text-center">{selectedArea}</td>
                        <td className="border-b p-1 text-center">{item.model}</td>
                        <td className="border-b p-1 text-center">{item.date}</td>
                        <td className="border-b p-1 text-center">
                          {item.quantity.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredData.length > visibleCount && (
                  <button
                    onClick={() => {
                      setVisibleCount(visibleCount + 10);
                      // Ghi log khi người dùng xem thêm dữ liệu
                      if (user && user.email) {
                        logUserAction(
                          user.email,
                          "view_more_detail_output",
                          t("detailedModal.logViewMore", { area: selectedArea, date: selectedDate })
                        );
                      }
                    }}
                    className="mt-2 w-full bg-blue-500 hover:bg-blue-700 py-1 rounded font-bold text-white"
                  >
                    {t("detailedModal.viewMore")}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
