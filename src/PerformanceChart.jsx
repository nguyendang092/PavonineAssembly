import React, { useState, useRef, useEffect } from "react";
import { toPng } from "html-to-image";
import { db, ref, onValue, set } from "./firebase";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from "recharts";

const initialData = [
  { team: "PRESS", target: 58, total: 21, currentWeek: 0 },
  { team: "MC", target: 173, total: 150, currentWeek: 0 },
  { team: "HAIRLINE", target: 92, total: 6, currentWeek: 0 },
  { team: "ANODIZING", target: 69, total: 13, currentWeek: 0 },
  { team: "ASSEMBLY", target: 127, total: 21, currentWeek: 0 },
  { team: "QC", target: 150, total: 63, currentWeek: 0 },
  { team: "지원부서", target: 35, total: 7, currentWeek: 0 },
];

export default function PerformanceChart() {
  const chartRef = useRef(null);
  const cardRef = useRef(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [yearDataStore, setYearDataStore] = useState({});
  const [loading, setLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Data cho năm đã chọn - bắt đầu với dữ liệu trống
  const emptyData = [
    { team: "PRESS", target: 0, total: 0, currentWeek: 0 },
    { team: "MC", target: 0, total: 0, currentWeek: 0 },
    { team: "HAIRLINE", target: 0, total: 0, currentWeek: 0 },
    { team: "ANODIZING", target: 0, total: 0, currentWeek: 0 },
    { team: "ASSEMBLY", target: 0, total: 0, currentWeek: 0 },
    { team: "QC", target: 0, total: 0, currentWeek: 0 },
    { team: "지원부서", target: 0, total: 0, currentWeek: 0 },
  ];

  const [data, setData] = useState(emptyData);

  // Load dữ liệu từ Firebase khi component mount
  useEffect(() => {
    const performanceRef = ref(db, "performanceData");
    const unsubscribe = onValue(performanceRef, (snapshot) => {
      const firebaseData = snapshot.val();
      if (firebaseData) {
        setYearDataStore(firebaseData);
        // Load data cho năm đã chọn nếu có
        if (firebaseData[selectedYear]) {
          setData(firebaseData[selectedYear]);
        } else {
          // Nếu chưa có data cho năm này, dùng emptyData
          setData(emptyData);
        }
      } else {
        // Firebase chưa có data gì, dùng emptyData
        setData(emptyData);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Cập nhật data khi chuyển năm (chỉ load từ Firebase, không tạo mới)
  useEffect(() => {
    if (yearDataStore[selectedYear]) {
      setData(yearDataStore[selectedYear]);
    } else {
      // Nếu chưa có data cho năm này, dùng emptyData
      setData(emptyData);
    }
    setHasUnsavedChanges(false);
  }, [selectedYear, yearDataStore]);

  // Tính số tuần hiện tại trong năm (dựa trên năm đã chọn)
  const getCurrentWeek = (year) => {
    const now = new Date();
    const targetYear = year || now.getFullYear();

    // Nếu là năm hiện tại, tính tuần hiện tại
    if (targetYear === now.getFullYear()) {
      const startOfYear = new Date(targetYear, 0, 1);
      const pastDaysOfYear = (now - startOfYear) / 86400000;
      return Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);
    }

    // Nếu là năm trong quá khứ, trả về tuần 52 (coi như cả năm)
    if (targetYear < now.getFullYear()) {
      return 52;
    }

    // Nếu là năm tương lai, trả về tuần 1
    return 1;
  };

  const currentWeekNumber = getCurrentWeek(selectedYear);
  const currentYear = new Date().getFullYear();

  // Tạo danh sách năm (từ 2020 đến năm hiện tại + 2)
  const years = [];
  for (let year = 2020; year <= currentYear + 2; year++) {
    years.push(year);
  }

  // Download chart as SVG
  const downloadChartAsSVG = () => {
    const container = chartRef.current;
    if (!container) return;
    const svg = container.querySelector("svg");
    if (!svg) return;

    const serializer = new XMLSerializer();
    let svgString = serializer.serializeToString(svg);
    // Ensure proper XML header
    if (!svgString.startsWith("<?xml")) {
      svgString = `<?xml version="1.0" encoding="UTF-8"?>\n` + svgString;
    }
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    a.download = `performance-chart-${yyyy}${mm}${dd}.svg`;
    a.href = url;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Download full chart card (title + chart) as PNG via html-to-image
  const downloadChartAsPNG = () => {
    const node = cardRef.current;
    if (!node) return;
    toPng(node, {
      backgroundColor: "#ffffff",
      pixelRatio: Math.max(2, window.devicePixelRatio || 1),
      cacheBust: true,
      filter: (n) => {
        if (n.dataset && n.dataset.noExport === "true") return false;
        return true;
      },
    })
      .then((dataUrl) => {
        const a = document.createElement("a");
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, "0");
        const dd = String(now.getDate()).padStart(2, "0");
        a.download = `performance-chart-${yyyy}${mm}${dd}.png`;
        a.href = dataUrl;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch((err) => {
        console.error("Export PNG failed:", err);
      });
  };

  const handleChange = (index, field, value) => {
    const updated = [...data];
    updated[index][field] = Number(value);
    setData(updated);
    setHasUnsavedChanges(true);
  };

  // Hàm lưu dữ liệu vào Firebase
  const handleSaveData = async () => {
    setSaving(true);
    try {
      const performanceRef = ref(db, "performanceData");
      const updatedStore = {
        ...yearDataStore,
        [selectedYear]: data,
      };
      await set(performanceRef, updatedStore);
      setYearDataStore(updatedStore);
      setHasUnsavedChanges(false);
      // Hiển thị thông báo thành công
      alert("✅ Đã lưu dữ liệu thành công!");
    } catch (error) {
      console.error("Error saving to Firebase:", error);
      alert("❌ Lỗi khi lưu dữ liệu!");
    } finally {
      setSaving(false);
    }
  };

  // Tính phần trăm total vs target
  const calculatePercentage = (total, target) => {
    if (target === 0) return 0;
    return ((total / target) * 100).toFixed(1);
  };

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 overflow-hidden flex">
      {/* Sidebar */}
      <div
        className={`bg-white border-r border-gray-200 shadow-lg transition-all duration-300 ${
          sidebarOpen ? "w-56" : "w-0"
        } overflow-hidden flex-shrink-0`}
      >
        <div className="h-full flex flex-col p-4">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <span>📅</span>
              <span>년도 선택</span>
            </h2>
            <p className="text-[10px] text-gray-500">Select Year</p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2">
            {years.map((year) => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                  selectedYear === year
                    ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{year}</span>
                  {year === currentYear && (
                    <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">
                      현재
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Toggle Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute top-4 left-4 z-10 bg-white border border-gray-300 rounded-lg p-2 shadow-md hover:shadow-lg transition-all hover:bg-gray-50"
        title={sidebarOpen ? "닫기" : "열기"}
      >
        <span className="text-lg">{sidebarOpen ? "◀" : "▶"}</span>
      </button>

      {/* Main Content */}
      <div className="flex-1 p-4 overflow-hidden">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600 font-semibold">데이터 로딩 중...</p>
              <p className="text-gray-400 text-sm">
                Loading data from Firebase
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto h-full flex flex-col">
            {/* Header */}
            <div className="text-center mb-4">
              <div className="inline-block">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-1">
                  개선 제안현황 ({selectedYear})
                </h1>
                <p className="text-xs text-gray-500 tracking-wide">
                  Improvement Dashboard
                </p>
              </div>
            </div>

            {/* Bảng nhập liệu */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden mb-4 border border-gray-100 flex-shrink-0">
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2 flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                  <span>📊</span>
                  <span>데이터 입력 테이블</span>
                </h3>
                <button
                  onClick={handleSaveData}
                  disabled={!hasUnsavedChanges || saving}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    hasUnsavedChanges && !saving
                      ? "bg-white text-indigo-600 hover:bg-gray-100 shadow-md"
                      : "bg-white/20 text-white/50 cursor-not-allowed"
                  }`}
                  title={
                    hasUnsavedChanges
                      ? "Lưu dữ liệu vào Firebase"
                      : "Không có thay đổi"
                  }
                >
                  {saving ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      <span>저장 중...</span>
                    </>
                  ) : (
                    <>
                      <span>💾</span>
                      <span>저장</span>
                      {hasUnsavedChanges && (
                        <span className="text-[10px] bg-red-500 text-white px-1 rounded-full">
                          ●
                        </span>
                      )}
                    </>
                  )}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-50 to-slate-50">
                      <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-700 uppercase tracking-wider border-b border-indigo-200">
                        TEAM
                      </th>
                      <th className="px-3 py-2 text-center text-[10px] font-bold text-gray-700 uppercase tracking-wider border-b border-indigo-200">
                        TARGET
                      </th>
                      <th className="px-3 py-2 text-center text-[10px] font-bold text-gray-700 uppercase tracking-wider border-b border-indigo-200">
                        TOTAL (W1~W{currentWeekNumber - 1}/{selectedYear})
                      </th>
                      <th className="px-3 py-2 text-center text-[10px] font-bold text-gray-700 uppercase tracking-wider border-b border-indigo-200">
                        % TOTAL/TARGET
                      </th>
                      <th className="px-3 py-2 text-center text-[10px] font-bold text-gray-700 uppercase tracking-wider border-b border-indigo-200">
                        WEEK {currentWeekNumber - 1}/{selectedYear}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.map((row, i) => (
                      <tr
                        key={i}
                        className="hover:bg-indigo-50/50 transition-all duration-200"
                      >
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-800">
                            {row.team}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            value={row.target}
                            onChange={(e) =>
                              handleChange(i, "target", e.target.value)
                            }
                            className="w-16 px-2 py-1 text-center text-xs border border-gray-200 rounded focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 transition-all outline-none font-medium text-gray-700"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            value={row.total}
                            onChange={(e) =>
                              handleChange(i, "total", e.target.value)
                            }
                            className="w-16 px-2 py-1 text-center text-xs border border-gray-200 rounded focus:border-purple-400 focus:ring-1 focus:ring-purple-200 transition-all outline-none font-medium text-gray-700"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="inline-flex items-center gap-1">
                            <div
                              className={`px-2 py-1 rounded-full font-bold text-[11px] ${
                                calculatePercentage(row.total, row.target) >=
                                100
                                  ? "bg-gradient-to-r from-green-400 to-emerald-500 text-white shadow-sm"
                                  : calculatePercentage(
                                      row.total,
                                      row.target
                                    ) >= 75
                                  ? "bg-gradient-to-r from-yellow-400 to-orange-400 text-white shadow-sm"
                                  : "bg-gradient-to-r from-rose-400 to-pink-500 text-white shadow-sm"
                              }`}
                            >
                              {calculatePercentage(row.total, row.target)}%
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            value={row.currentWeek}
                            onChange={(e) =>
                              handleChange(i, "currentWeek", e.target.value)
                            }
                            className="w-16 px-2 py-1 text-center text-xs border border-gray-200 rounded focus:border-pink-400 focus:ring-1 focus:ring-pink-200 transition-all outline-none font-medium text-gray-700"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Biểu đồ */}
            <div
              ref={cardRef}
              className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100"
            >
              <div className="bg-gradient-to-r from-pink-500 to-rose-600 px-4 py-2 flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                  <span>📈</span>
                  <span>성과 비교 차트</span>
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={downloadChartAsPNG}
                    data-no-export="true"
                    className="text-white/90 hover:text-white bg-white/20 hover:bg-white/30 border border-white/30 rounded px-2 py-1 text-[11px] font-semibold transition"
                    title="Tải ảnh PNG"
                  >
                    ⬇️ PNG
                  </button>
                  <button
                    onClick={downloadChartAsSVG}
                    data-no-export="true"
                    className="text-white/90 hover:text-white bg-white/20 hover:bg-white/30 border border-white/30 rounded px-2 py-1 text-[11px] font-semibold transition"
                    title="Tải ảnh SVG"
                  >
                    ⬇️ SVG
                  </button>
                </div>
              </div>

              <div
                ref={chartRef}
                className="h-96 bg-gradient-to-br from-slate-50 to-indigo-50 rounded-lg p-4"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.map((row) => ({
                      ...row,
                      percentage: parseFloat(
                        calculatePercentage(row.total, row.target)
                      ),
                    }))}
                    margin={{ top: 30, right: 30, left: 20, bottom: 20 }}
                    barGap={6}
                    barCategoryGap={15}
                  >
                    <defs>
                      <linearGradient
                        id="colorTarget"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#10b981"
                          stopOpacity={0.9}
                        />
                        <stop
                          offset="95%"
                          stopColor="#059669"
                          stopOpacity={0.9}
                        />
                      </linearGradient>
                      <linearGradient
                        id="colorTotal"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#6366f1"
                          stopOpacity={0.9}
                        />
                        <stop
                          offset="95%"
                          stopColor="#4f46e5"
                          stopOpacity={0.9}
                        />
                      </linearGradient>
                      <linearGradient
                        id="colorPercentage"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#f59e0b"
                          stopOpacity={0.9}
                        />
                        <stop
                          offset="95%"
                          stopColor="#d97706"
                          stopOpacity={0.9}
                        />
                      </linearGradient>
                      <linearGradient
                        id="colorWeek"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#ec4899"
                          stopOpacity={0.9}
                        />
                        <stop
                          offset="95%"
                          stopColor="#db2777"
                          stopOpacity={0.9}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#e2e8f0"
                      strokeOpacity={0.5}
                    />
                    <XAxis
                      dataKey="team"
                      tick={{ fill: "#1e293b", fontSize: 12, fontWeight: 700 }}
                      axisLine={{ stroke: "#cbd5e1" }}
                    />
                    <YAxis
                      tick={{ fill: "#1e293b", fontSize: 12, fontWeight: 700 }}
                      axisLine={{ stroke: "#cbd5e1" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(255, 255, 255, 0.95)",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        padding: "8px",
                      }}
                      labelStyle={{
                        fontWeight: "bold",
                        color: "#1e293b",
                        marginBottom: "4px",
                        fontSize: "11px",
                      }}
                      itemStyle={{ padding: "2px 0", fontSize: "10px" }}
                    />
                    <Legend
                      wrapperStyle={{
                        paddingTop: "8px",
                        fontSize: "10px",
                        fontWeight: 600,
                      }}
                      iconType="circle"
                    />
                    <Bar
                      dataKey="target"
                      fill="url(#colorTarget)"
                      name="🎯 Target"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={50}
                    >
                      <LabelList
                        dataKey="target"
                        position="top"
                        style={{
                          fill: "#059669",
                          fontWeight: "bold",
                          fontSize: 12,
                        }}
                      />
                    </Bar>
                    <Bar
                      dataKey="total"
                      fill="url(#colorTotal)"
                      name="📊 Total"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={50}
                    >
                      <LabelList
                        dataKey="total"
                        position="top"
                        style={{
                          fill: "#4f46e5",
                          fontWeight: "bold",
                          fontSize: 12,
                        }}
                      />
                    </Bar>
                    <Bar
                      dataKey="percentage"
                      fill="url(#colorPercentage)"
                      name="📈 % Achievement"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={50}
                    >
                      <LabelList
                        dataKey="percentage"
                        position="top"
                        formatter={(value) => `${value}%`}
                        style={{
                          fill: "#d97706",
                          fontWeight: "bold",
                          fontSize: 12,
                        }}
                      />
                    </Bar>
                    <Bar
                      dataKey="currentWeek"
                      fill="url(#colorWeek)"
                      name="⭐ Current Week"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={50}
                    >
                      <LabelList
                        dataKey="currentWeek"
                        position="top"
                        style={{
                          fill: "#db2777",
                          fontWeight: "bold",
                          fontSize: 12,
                        }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
