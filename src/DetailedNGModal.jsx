import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { logUserAction } from "./userLog";
import { ref, get } from "firebase/database";
import { db } from "./firebase";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from "chart.js";
import { useUser } from "./UserContext";

// Utility functions
function getCurrentWeekNumber() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = (now - start + (start.getTimezoneOffset() - now.getTimezoneOffset()) * 60000) / 86400000;
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

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function DetailedNGModal({ isOpen, onClose, area, week }) {
  const { t } = useTranslation();
  const { user } = useUser();
  const [selectedArea, setSelectedArea] = useState(area || "Press");
  const [selectedWeek, setSelectedWeek] = useState(week || getCurrentWeekNumber().toString());
  const [selectedDate, setSelectedDate] = useState(getYesterday());
  const [selectedModel, setSelectedModel] = useState("");
  const [areas, setAreas] = useState([]);
  const [allDetailData, setAllDetailData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);

  // Fetch area list
  useEffect(() => {
    get(ref(db, "details")).then(snapshot => {
      if (snapshot.exists()) setAreas(Object.keys(snapshot.val()));
    });
  }, []);

  // Khi prop week thay đổi thì đồng bộ state, nhưng nếu user chọn ngày thì bỏ qua week
  const [ignoreWeekProp, setIgnoreWeekProp] = useState(false);
  const [viewWholeWeek, setViewWholeWeek] = useState(true); // true: xem tuần, false: xem ngày

  // Khi prop week thay đổi và chưa chọn ngày mới, đồng bộ week
  useEffect(() => {
    if (week && !ignoreWeekProp) setSelectedWeek(week);
  }, [week, ignoreWeekProp]);

  // Khi user chọn ngày mới, nếu đang ở chế độ xem ngày thì bỏ qua prop week và set lại week theo ngày
  useEffect(() => {
    if (selectedDate && !viewWholeWeek) {
      setSelectedWeek(getWeekNumber(selectedDate).toString());
      setIgnoreWeekProp(true);
    }
  }, [selectedDate, viewWholeWeek]);

  // Fetch detail data: theo tuần hoặc theo ngày tùy chế độ
  useEffect(() => {
    if (!isOpen || !selectedArea) return;
    let isMounted = true;
    setLoading(true);
    if (viewWholeWeek && week && !ignoreWeekProp) {
      // Fetch all data for the selected area and week
      get(ref(db, `ng/${selectedArea}/${week}`)).then(snapshot => {
        if (!isMounted) return;
        const details = [];
        if (snapshot.exists()) {
          const reworkData = snapshot.val();
          for (const rework in reworkData) {
            const dayData = reworkData[rework];
            for (const day in dayData) {
              if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
              const modelData = dayData[day];
              for (const model in modelData) {
                let quantity = 0, notes = "";
                if (typeof modelData[model] === "object" && modelData[model] !== null) {
                  if (typeof modelData[model].Day === "object" && modelData[model].Day !== null) {
                    quantity = modelData[model].Day.quantity ?? 0;
                    notes = modelData[model].Day.reason ?? "";
                  } else {
                    quantity = modelData[model].Day ?? 0;
                  }
                } else if (typeof modelData[model] === "number") {
                  quantity = modelData[model];
                }
                if (quantity > 0) {
                  details.push({ model, date: day, quantity, week, rework, area: selectedArea, notes });
                }
              }
            }
          }
        }
        setAllDetailData(details);
        setLoading(false);
      });
    } else if (selectedDate) {
      // Fetch for the selected date
      get(ref(db, `ng/${selectedArea}`)).then(snapshot => {
        if (!isMounted) return;
        const details = [];
        if (snapshot.exists()) {
          const weekData = snapshot.val();
          for (const weekKey in weekData) {
            const reworkData = weekData[weekKey];
            for (const rework in reworkData) {
              const dayData = reworkData[rework];
              for (const day in dayData) {
                if (day !== selectedDate || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
                const modelData = dayData[day];
                for (const model in modelData) {
                  let quantity = 0, notes = "";
                  if (typeof modelData[model] === "object" && modelData[model] !== null) {
                    if (typeof modelData[model].Day === "object" && modelData[model].Day !== null) {
                      quantity = modelData[model].Day.quantity ?? 0;
                      notes = modelData[model].Day.reason ?? "";
                    } else {
                      quantity = modelData[model].Day ?? 0;
                    }
                  } else if (typeof modelData[model] === "number") {
                    quantity = modelData[model];
                  }
                  if (quantity > 0) {
                    details.push({ model, date: day, quantity, week: weekKey, rework, area: selectedArea, notes });
                  }
                }
              }
            }
          }
        }
        setAllDetailData(details);
        setLoading(false);
      });
    }
    return () => { isMounted = false; };
  }, [selectedArea, selectedDate, isOpen, week, ignoreWeekProp, viewWholeWeek]);

  // Filtered data (memoized)
  const filteredData = useMemo(() =>
    allDetailData.filter(item => item.model.toLowerCase().includes(selectedModel.toLowerCase())),
    [allDetailData, selectedModel]
  );

  // Chart data (memoized)
  const chartData = useMemo(() => ({
    labels: filteredData.map(item => item.model),
    datasets: [
      {
        label: t("detailedNGModal.outputLabel"),
        data: filteredData.map(item => item.quantity),
        backgroundColor: "#7dd3fc",
      },
    ],
  }), [filteredData, t]);

  // Reset state when modal closes, log when opens
  useEffect(() => {
    if (!isOpen) {
      setAllDetailData([]);
      setSelectedModel("");
      setVisibleCount(10);
    } else if (user && user.email) {
      logUserAction(
        user.email,
        "view_detail_output",
        `Xem chi tiết sản lượng khu vực: ${selectedArea}, tuần: ${selectedWeek}`
      );
    }
  }, [isOpen, selectedWeek]);

  // Export Excel handler
  const handleExportExcel = useCallback(() => {
    if (!filteredData.length) return;
    const ws = XLSX.utils.json_to_sheet(
      filteredData.map(item => ({
        [t("detailedNGModal.area")]: selectedArea,
        [t("detailedNGModal.model")]: item.model,
        [t("detailedNGModal.date")]: item.date,
        [t("detailedNGModal.quantity")]: item.quantity,
        [t("detailedNGModal.ngReason")]: item.notes || "",
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Details-NG");
    XLSX.writeFile(wb, `detailsNG_${selectedArea}_${selectedDate}.xlsx`);
  }, [filteredData, selectedArea, selectedDate, t]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-[#e6ecf3] bg-opacity-90 flex justify-center items-center z-50">
      <div className="bg-[#f7fafc] w-[90vw] h-[90vh] p-4 rounded-2xl shadow-2xl flex flex-col border border-[#cbd5e1]">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1 text-center">
            <h2 className="text-xl font-bold uppercase inline-block text-[#334155] tracking-wide">
              {t("detailedNGModal.title")}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-red-500 text-base font-bold ml-auto transition"
          >
            {t("detailedNGModal.close")}
          </button>
        </div>

        {/* Bộ lọc */}
        {/* Bộ lọc + Nút xuất Excel: sang trọng, hiện đại (glassmorphism, gradient, icon) */}
  <div className="flex flex-col gap-2 mb-4 px-4 pt-2 pb-3 rounded-2xl shadow border border-[#e0e7ef] bg-white/70 backdrop-blur-sm w-full max-w-2xl mx-auto">
    <div className="flex items-center gap-2">
      <input
        id="view-whole-week"
        type="checkbox"
        checked={viewWholeWeek}
        onChange={e => {
          setViewWholeWeek(e.target.checked);
          if (e.target.checked) {
            setIgnoreWeekProp(false);
          }
        }}
        className="accent-sky-500 w-4 h-4"
      />
      <label htmlFor="view-whole-week" className="text-sm text-sky-800 font-semibold cursor-pointer select-none">
        {t("detailedNGModal.viewWholeWeek") || "Xem toàn bộ tuần này"}
      </label>
    </div>
    <div className="flex flex-wrap gap-2">
      <div className="flex flex-col min-w-[120px] flex-1">
        <label className="text-xs text-gray-600 mb-1 font-semibold" htmlFor="area-select">{t("detailedNGModal.area")}</label>
        <select
          id="area-select"
          value={selectedArea}
          onChange={(e) => setSelectedArea(e.target.value)}
          className="border border-gray-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-sky-400 text-gray-800 text-sm"
        >
          {areas.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col min-w-[120px] flex-1">
        <label className="text-xs text-gray-600 mb-1 font-semibold" htmlFor="date-input">{t("detailedNGModal.date")}</label>
        <input
          id="date-input"
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-sky-400 text-gray-800 text-sm"
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
        <label className="text-xs text-gray-600 mb-1 font-semibold" htmlFor="model-search">{t("detailedNGModal.model")}</label>
        <input
          id="model-search"
          type="text"
          placeholder={t("detailedNGModal.searchModel")}
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="border border-gray-300 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-sky-400 text-gray-800 text-sm"
        />
      </div>
      <div className="flex flex-col justify-end min-w-fit flex-1 items-end">
        <button
          onClick={handleExportExcel}
          className="flex items-center gap-1 bg-gradient-to-r from-[#7dd3fc] to-[#38bdf8] hover:from-[#bae6fd] hover:to-[#0ea5e9] text-[#334155] font-bold py-1 px-3 rounded-lg shadow transition-all duration-150 text-sm whitespace-nowrap min-w-fit"
          style={{ boxShadow: '0 2px 8px 0 rgba(56,189,248,0.10)' }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" /></svg>
          <span className="whitespace-nowrap">{t("detailedNGModal.exportExcel")}</span>
        </button>
      </div>
    </div>
  </div>

        {/* Nội dung chính: Biểu đồ + bảng */}
        <div className="flex flex-1 overflow-hidden">
          <div className="w-2/3 pr-4 h-full">
            {chartData && chartData.labels.length > 0 ? (
              <Bar
                data={chartData}
                options={{
                  indexAxis: "y",
                  responsive: true,
                  maintainAspectRatio: false,
                  elements: {
                    bar: {
                      borderRadius: 10,
                      borderWidth: 0,
                    },
                  },
                  scales: {
                    x: {
                      beginAtZero: true,
                      ticks: {
                        color: "#334155",
                        font: { weight: "bold", size: 11 },
                      },
                      grid: { display: false },
                      max: chartData.datasets[0]?.data?.length ? Math.max(...chartData.datasets[0].data) + 50 : undefined,
                    },
                    y: {
                      ticks: {
                        color: "#334155",
                        font: { weight: "bold", size: 11 },
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
                      color: "#334155",
                      font: { weight: "bold", size: 11 },
                      formatter: (value) => value.toLocaleString(),
                    },
                  },
                }}
              />
            ) : loading ? (
              <p className="text-center text-gray-500 italic">{t("detailedNGModal.loadingChart")}</p>
            ) : (
              <p>{t("detailedNGModal.noChartData")}</p>
            )}
          </div>
          {/* Bảng chi tiết (1/3) */}
          <div className="w-1/3 overflow-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#cbd5e1] text-[#334155]">
                  <th className="border-b p-1 text-center font-semibold">
                    {t("detailedNGModal.area")}
                  </th>
                  <th className="border-b p-1 text-center font-semibold">
                    {t("detailedNGModal.model")}
                  </th>
                  <th className="border-b p-1 text-center font-semibold">
                    {t("detailedNGModal.date")}
                  </th>
                  <th className="border-b p-1 text-center font-semibold">
                    {t("detailedNGModal.quantity")}
                  </th>
                  <th className="border-b p-1 text-center font-semibold">
                    {t("detailedNGModal.ngReason")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredData.slice(0, visibleCount).map((item, i) => (
                  <tr
                    key={i}
                    className={i % 2 === 0 ? "bg-white" : "bg-[#f1f5f9]"}
                  >
                    <td className="border-b p-1 text-center text-[#334155] font-medium">
                      {selectedArea}
                    </td>
                    <td className="border-b p-1 text-center text-[#334155] font-medium">
                      {item.model}
                    </td>
                    <td className="border-b p-1 text-center text-[#334155] font-medium">
                      {item.date}
                    </td>
                    <td className="border-b p-1 text-center text-[#334155] font-medium">
                      {item.quantity.toLocaleString()}
                    </td>
                    <td className="border-b p-1 text-center text-[#334155] font-medium">
                      {item.notes || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredData.length > visibleCount && (
              <button
                onClick={() => {
                  setVisibleCount(visibleCount + 10);
                  if (user && user.email) {
                    logUserAction(
                      user.email,
                      "view_more_detail_output",
                      t("detailedNGModal.logViewMore", {
                        area: selectedArea,
                        date: selectedDate,
                      })
                    );
                  }
                }}
                className="mt-2 w-full bg-gradient-to-r from-[#7dd3fc] to-[#38bdf8] hover:from-[#bae6fd] hover:to-[#0ea5e9] active:from-[#0ea5e9] active:to-[#0369a1] text-[#334155] font-bold py-1 rounded-xl shadow-md transition-all duration-150"
              >
                {t("detailedNGModal.viewMore")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}