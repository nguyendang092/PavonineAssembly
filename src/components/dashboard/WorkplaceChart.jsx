/* Đây là component hiển thị biểu đồ sản lượng */
import React, { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { Bar } from "react-chartjs-2";
import { FiUpload } from "react-icons/fi"; // import biểu tượng upload
import { useTranslation } from "react-i18next";
import DetailedModal from "../modals/DetailedModal";
import { useUser } from "../../contexts/UserContext";
import { logUserAction } from "../../utils/userLog";
import Sidebar from "../layout/Sidebar";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
} from "chart.js";
import { format, parseISO, getISOWeek } from "date-fns";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { getDatabase, ref, update, get } from "firebase/database";
import { db } from "../../services/firebase"; // đường dẫn tới file cấu hình firebase của bạn
ChartJS.register(
  BarElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
  ChartDataLabels,
);
const getCurrentWeekNumber = () => {
  const today = new Date();
  const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
  const pastDaysOfYear = (today - firstDayOfYear) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};

const extraLabelPlugin = {
  id: "extraLabelPlugin",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      const label = dataset.label || "";
      const shortName = label.length > 40 ? label.slice(0, 3) : label;
      meta.data.forEach((bar, index) => {
        const value = dataset.data[index];
        if (!bar || value === 0) return;
        ctx.save();
        ctx.font = "bold 10px Arial";
        ctx.fillStyle = "#000";
        ctx.textBaseline = "middle";
        const x = bar.x + 10;
        const y = bar.y + bar.height / 8;
        ctx.fillText(`${shortName}: ${value.toLocaleString()}`, x, y);
        ctx.restore();
      });
    });
  },
};
export default function WorkplaceChart() {
  const { user } = useUser();
  const [detailData, setDetailData] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalArea, setModalArea] = useState("");
  const { t } = useTranslation();
  const [selectedArea, setSelectedArea] = useState("");
  const [weekData, setWeekData] = useState({});
  const [selectedWeek, setSelectedWeek] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [chartData, setChartData] = useState(null);
  const [dataMap, setDataMap] = useState({});
  const [tableView, setTableView] = useState("detailed");
  const [rawData, setRawData] = useState(null);
  const [showTable, setShowTable] = useState(window.innerWidth >= 1520);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isReadingTotalFile, setIsReadingTotalFile] = useState(false);
  const [isReadingDetailFile, setIsReadingDetailFile] = useState(false);
  const [isUploadingTotal, setIsUploadingTotal] = useState(false);
  const [isUploadingDetail, setIsUploadingDetail] = useState(false);
  const totalFileInputRef = useRef(null);
  const detailFileInputRef = useRef(null);

  // Theo dõi kích thước màn hình
  useEffect(() => {
    const handleResize = () => {
      setShowTable(window.innerWidth >= 1520);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Load dữ liệu từ Firebase khi component mount hoặc khi year thay đổi
  useEffect(() => {
    const loadDataFromFirebase = async () => {
      try {
        const barRef = ref(db, "bar");
        const snapshot = await get(barRef);
        if (!snapshot.exists()) {
          // Nếu Firebase chưa có dữ liệu thì thôi, đợi upload
          return;
        }
        const barData = snapshot.val();
        // Chuyển dữ liệu từ Firebase về dạng mảng giống dữ liệu Excel
        const rows = [];
        for (const workplaceName in barData) {
          const weeks = barData[workplaceName];
          for (const weekKey in weeks) {
            const reworks = weeks[weekKey];
            for (const reworkKey in reworks) {
              const days = reworks[reworkKey];
              for (const dayKey in days) {
                const shifts = days[dayKey];
                // Sửa đoạn này: lặp qua từng shiftKey trong shifts
                for (const shiftKey in shifts) {
                  const shiftData = shifts[shiftKey];
                  let totalGood = 0,
                    totalNG = 0;
                  if (typeof shiftData === "object" && shiftData !== null) {
                    totalGood =
                      shiftData.Total_Good ?? shiftData.Total_Product ?? 0;
                    totalNG = shiftData.Total_NG ?? 0;
                  } else {
                    totalGood = shiftData ?? 0;
                    totalNG = 0;
                  }
                  rows.push({
                    Week: weekKey,
                    WorkplaceName: workplaceName,
                    ReworkorNot: reworkKey,
                    time_monthday: dayKey,
                    WorkingLight: shiftKey,
                    Total_Good: totalGood,
                    Total_NG: totalNG,
                  });
                }
              }
            }
          }
        }

        setRawData(rows);
        processExcelData(rows, selectedYear); // Pass selectedYear vào
      } catch (error) {
        console.error("Lỗi load dữ liệu Firebase:", error);
        alert("Lỗi load dữ liệu Firebase: " + error.message);
      }
    };
    loadDataFromFirebase();
  }, [selectedYear]); // Re-run khi selectedYear thay đổi
  const openDetailModal = (area) => {
    setModalArea(area);
    setIsModalOpen(true);
  };
  const closeDetailModal = () => setIsModalOpen(false);
  const uploadToFirebase = async (data) => {
    if (isUploadingTotal) return;
    setIsUploadingTotal(true);

    // Ghi log upload tổng sản lượng
    try {
      if (user && user.email) {
        await logUserAction(
          user.email,
          "upload_total_output",
          `Upload tổng sản lượng tuần ${selectedWeek}`,
        );
      }

      const sanitizeKey = (key) =>
        String(key ?? "").replace(/[.#$/\[\]]/g, "_");
      const chunkSize = 500;

      for (let i = 0; i < data.length; i += chunkSize) {
        // Yield to browser between chunks so UI remains responsive.
        await new Promise((resolve) => setTimeout(resolve, 0));

        const chunk = data.slice(i, i + chunkSize);
        const updates = {};

        chunk.forEach((row) => {
          const {
            Week,
            WorkplaceName,
            ReworkorNot,
            time_monthday,
            WorkingLight,
            Total_Good,
            Total_NG,
          } = row;

          if (
            !Week ||
            !WorkplaceName ||
            !ReworkorNot ||
            !time_monthday ||
            !WorkingLight
          ) {
            return;
          }

          const safeWorkplaceName = sanitizeKey(WorkplaceName);
          const pathGood = `bar/${safeWorkplaceName}/${Week}/${ReworkorNot}/${time_monthday}/${WorkingLight}/Total_Good`;
          const pathNG = `bar/${safeWorkplaceName}/${Week}/${ReworkorNot}/${time_monthday}/${WorkingLight}/Total_NG`;
          updates[pathGood] = Number(Total_Good) || 0;
          updates[pathNG] = Number(Total_NG) || 0;
        });

        if (Object.keys(updates).length > 0) {
          await update(ref(db), updates);
        }
      }
    } finally {
      setIsUploadingTotal(false);
    }
  };
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (isReadingTotalFile) return;

    setIsReadingTotalFile(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames?.[0];
      if (!sheetName) {
        throw new Error("File Excel không có sheet");
      }

      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet);
      setRawData(jsonData);
      processExcelData(jsonData, selectedYear);
    } catch (err) {
      alert("❌ Lỗi khi đọc file: " + (err?.message || "Không thể đọc file"));
    } finally {
      setIsReadingTotalFile(false);
      if (e.target) e.target.value = "";
    }
  };
  const handleDetailUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (isReadingDetailFile) return;

    setIsReadingDetailFile(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames?.[0];
      if (!sheetName) {
        throw new Error("File Excel không có sheet");
      }

      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet);
      setDetailData(jsonData);
      alert("📁 Đã đọc file chi tiết, sẵn sàng upload.");
    } catch (err) {
      alert("❌ Lỗi khi đọc file: " + (err?.message || "Không thể đọc file"));
    } finally {
      setIsReadingDetailFile(false);
      if (e.target) e.target.value = "";
    }
  };
  const handleDetailUploadToFirebase = async () => {
    if (!detailData) {
      alert("❗ Vui lòng chọn file chi tiết trước khi upload.");
      return;
    }
    if (isUploadingDetail) return;

    setIsUploadingDetail(true);

    try {
      const sanitizeKey = (key) =>
        String(key ?? "").replace(/[.#$/\[\]]/g, "_");
      const chunkSize = 500;
      let hasValidData = false;

      for (let i = 0; i < detailData.length; i += chunkSize) {
        // Yield to browser between chunks so UI remains responsive.
        await new Promise((resolve) => setTimeout(resolve, 0));

        const chunk = detailData.slice(i, i + chunkSize);
        const updates = {};

        chunk.forEach((row, index) => {
          const model = row["ItemCode"];
          const area = row["WorkplaceName"];
          const week = row["Week"];
          const date = row["ProductionEfficiencyDate"];
          const total = row["GoodProductEfficiency"];

          if (!model || !area || !week || !date) {
            console.warn(`⚠️ Bỏ qua dòng ${i + index + 2}: thiếu dữ liệu`, {
              model,
              area,
              week,
              date,
            });
            return;
          }

          const safeArea = sanitizeKey(area);
          const safeModel = sanitizeKey(model);
          const path = `details/${safeArea}/${week}/${safeModel}/${date}`;
          const totalValue = Number(total);
          updates[path] = Number.isNaN(totalValue) ? 0 : totalValue;
          hasValidData = true;
        });

        if (Object.keys(updates).length > 0) {
          await update(ref(db), updates);
        }
      }

      if (!hasValidData) {
        alert("❌ Không có dữ liệu hợp lệ để upload.");
        return;
      }

      // Ghi log upload chi tiết sản lượng
      if (user && user.email) {
        await logUserAction(
          user.email,
          "upload_detail_output",
          `Upload chi tiết sản lượng tuần ${selectedWeek}`,
        );
      }
      alert("✅ Upload chi tiết thành công!");
      setDetailData(null);
    } catch (error) {
      alert("❌ Lỗi khi upload: " + error.message);
    } finally {
      setIsUploadingDetail(false);
    }
  };
  const processExcelData = (data, filterYear) => {
    const grouped = {};

    // Lọc dữ liệu từ Excel/Firebase: lấy Year từ dòng hoặc tính toán từ dayKey
    data.forEach((row) => {
      let year = filterYear;
      // Nếu dữ liệu có trường Year thì dùng, nếu không thì kiểm tra từ dayKey
      if (row.Year) {
        year = Number(row.Year);
      } else if (row.time_monthday) {
        // Thử parse năm từ format ngày (nếu có)
        try {
          const date = parseISO(row.time_monthday);
          year = date.getFullYear();
        } catch (e) {
          year = filterYear;
        }
      }

      // Chỉ lấy dữ liệu của năm được chọn
      if (year !== filterYear) return;

      const week = Number(row["Week"]);
      const weekYear = `${week}_${year}`;

      if (!grouped[weekYear]) grouped[weekYear] = [];
      grouped[weekYear].push(row);
    });

    setWeekData(grouped);
    const today = new Date();
    const currentWeek = getCurrentWeekNumber();

    // Kiểm tra xem hôm nay là thứ mấy (0=CN, 1=Thứ 2, ...)
    const dayOfWeek = today.getDay();

    // Nếu hôm nay là thứ 2 (dayOfWeek === 1) thì lấy tuần trước
    let defaultWeek = currentWeek;
    if (dayOfWeek === 1) {
      defaultWeek = currentWeek - 1;
    }

    const defaultWeekKey = `${defaultWeek}_${filterYear}`;

    // Nếu tuần này hoặc tuần trước đó không có dữ liệu, thì fallback
    const weekKeys = Object.keys(grouped)
      .filter((k) => k.endsWith(`_${filterYear}`))
      .sort();

    let selectedWeekKey = defaultWeekKey;
    if (!grouped[defaultWeekKey] && weekKeys.length > 0) {
      selectedWeekKey = weekKeys[weekKeys.length - 1]; // Chọn tuần cuối cùng có dữ liệu
    }

    setSelectedWeek(selectedWeekKey);
  };

  useEffect(() => {
    if (!selectedWeek || !weekData[selectedWeek]) {
      setChartData(null);
      setDataMap({});
      return;
    }

    // Parse selectedWeek để lấy tuần số và năm
    const [weekNum, year] = selectedWeek.split("_");
    const currentYear = new Date().getFullYear();

    const rows = weekData[selectedWeek].filter((r) => {
      if (!r.time_monthday) return false;
      try {
        const date = parseISO(r.time_monthday);
        const dateYear = date.getFullYear();
        const dateWeek = getISOWeek(date);
        // Filter theo tuần số và năm
        return dateWeek.toString() === weekNum && dateYear.toString() === year;
      } catch {
        return false;
      }
    });
    const daysSet = new Set();
    rows.forEach((r) => r.time_monthday && daysSet.add(r.time_monthday));
    const days = Array.from(daysSet).sort((a, b) => new Date(a) - new Date(b));
    const areaSet = new Set();
    rows.forEach((r) => r.WorkplaceName && areaSet.add(r.WorkplaceName));
    const areas = Array.from(areaSet);
    const map = {};
    areas.forEach((area) => {
      map[area] = days.map(() => ({
        Day: { normal: 0, rework: 0, ng_normal: 0, ng_rework: 0 },
        Night: { normal: 0, rework: 0, ng_normal: 0, ng_rework: 0 },
      }));
    });
    rows.forEach((row) => {
      const dayIndex = days.indexOf(row.time_monthday);
      const area = row.WorkplaceName;
      const shift = row.WorkingLight || "Day";
      const val = Number(row.Total_Good) || 0;
      const ngVal = Number(row.Total_NG) || 0;
      const type = row.ReworkorNot === "Rework" ? "rework" : "normal";
      const ngType = "ng_" + type;

      if (dayIndex !== -1 && map[area]) {
        // Chỉ lấy giá trị cuối cùng, không cộng dồn
        map[area][dayIndex][shift][type] = val;
        map[area][dayIndex][shift][ngType] = ngVal;
      }
    });
    if (map["CNC"]) {
      for (let i = 0; i < days.length; i++) {
        const currentDay = map["CNC"][i].Day;
        const nextNight =
          i + 1 < days.length
            ? map["CNC"][i + 1].Night
            : { normal: 0, rework: 0 };
        currentDay.normal += nextNight.normal;
        currentDay.rework += nextNight.rework;
      }
    }
    setDataMap(map);
    const filteredAreas = areas.filter((area) =>
      map[area].some(
        ({ Day, Night }) =>
          Day.normal + Day.rework + Night.normal + Night.rework > 0,
      ),
    );
    const datasets = filteredAreas.map((area, i) => {
      let dataArr;
      if (area === "CNC") {
        dataArr = map[area].map(({ Day }) => Day.normal + Day.rework);
      } else {
        dataArr = map[area].map(
          ({ Day, Night }) =>
            Day.normal +
            Day.rework +
            Night.normal +
            Night.rework +
            Day.ng_normal +
            Day.ng_rework +
            Night.ng_normal +
            Night.ng_rework,
        );
      }
      return {
        label: area,
        data: dataArr,
        backgroundColor: [
          "#4e79a7",
          "#f28e2c",
          "#e15759",
          "#76b7b2",
          "#59a14f",
          "#edc949",
          "#af7aa1",
          "#ff9da7",
          "#9c755f",
          "#bab0ab",
        ][i % 10],
        borderRadius: 6,
      };
    });
    const labels = days.map((d) => {
      // Nếu d đã là yyyy-mm-dd thì giữ nguyên, nếu không thì chuyển về yyyy-mm-dd
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
      try {
        const dateObj = parseISO(d);
        return format(dateObj, "yyyy-MM-dd");
      } catch {
        return d;
      }
    });
    setChartData({ labels, datasets });
  }, [selectedWeek, weekData]);
  const exportToExcel = () => {
    const headers = ["Khu vực", "Ngày", "Normal", "Rework", "Tổng"];
    const rows = [];
    Object.entries(dataMap)
      .filter(([area]) => selectedArea === "" || selectedArea === area)
      .forEach(([area, dayArr]) => {
        dayArr.forEach((dayData, idx) => {
          const label = chartData.labels[idx];
          let normal, rework;
          if (area === "CNC") {
            normal = dayData.Day.normal;
            rework = dayData.Day.rework;
          } else {
            normal = dayData.Day.normal + dayData.Night.normal;
            rework = dayData.Day.rework + dayData.Night.rework;
          }
          const total = normal + rework;
          if (total === 0) return;
          rows.push([area, label, normal, rework, total]);
        });
      });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sản lượng chi tiết");
    XLSX.writeFile(wb, `san_luong_chi_tiet_tuan_${selectedWeek}.xlsx`);
  };
  return (
    <div
      className="flex flex-col lg:flex-row h-screen overflow-hidden"
      style={{ backgroundColor: "#eef4ff" }}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed left-4 top-20 z-50 w-12 h-12 flex items-center justify-center rounded-full shadow-lg bg-black text-white hover:bg-gray-900 transition"
      >
        {sidebarOpen ? "✕" : "☰"}
      </button>

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        className="!space-y-0"
      >
        <div className="space-y-4">
          <div className="text-center">
            <h2 className="text-lg lg:text-2xl font-bold text-white mb-3 uppercase">
              {t("workplaceChart.menuTitle")}
            </h2>
          </div>

          {/* Year Selection */}
          <div>
            <label className="block text-white font-medium mb-2 text-sm">
              Năm
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full bg-white text-gray-900 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[2026, 2025, 2024, 2023].map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <div>
            {Object.keys(weekData).length > 0 && (
              <>
                <label className="block text-white font-medium mb-2 text-sm">
                  {t("workplaceChart.selectWeek")}
                </label>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  className="w-full bg-white text-gray-900 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {Object.keys(weekData).map((week) => (
                    <option key={week} value={week}>
                      {week} {t("workplaceChart.week")}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>

        {/* Upload section */}
        {user && (
          <div className="space-y-3">
            <p className="uppercase text-sm text-white tracking-wide">
              {t("workplaceChart.uploadData")}
            </p>
            <div className="flex items-center justify-between gap-2 bg-white/10 rounded-lg p-2">
              <label
                htmlFor="file-upload-total"
                className={`p-2 text-white rounded-lg ${
                  isReadingTotalFile || isUploadingTotal
                    ? "cursor-not-allowed bg-slate-400"
                    : "cursor-pointer bg-blue-500 hover:bg-blue-600"
                }`}
                title="Chọn file"
              >
                <FiUpload size={16} />
              </label>
              <span className="text-white text-xs font-medium flex-1 text-center">
                {t("workplaceChart.chooseExceltotal")}
              </span>
              <button
                onClick={() => {
                  if (isUploadingTotal || isReadingTotalFile) return;
                  if (!rawData) {
                    alert(t("workplaceChart.pleaseSelectExcel"));
                    return;
                  }
                  uploadToFirebase(rawData)
                    .then(() => alert("✅ Upload dữ liệu thành công!"))
                    .catch((error) =>
                      alert(t("workplaceChart.uploadError") + error.message),
                    );
                }}
                disabled={isUploadingTotal || isReadingTotalFile}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:from-blue-700 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploadingTotal
                  ? "Đang upload..."
                  : t("workplaceChart.uploadFirebase")}
              </button>
              <input
                ref={totalFileInputRef}
                id="file-upload-total"
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                disabled={isReadingTotalFile || isUploadingTotal}
                className="hidden"
              />
            </div>

            <div className="flex items-center justify-between gap-2 bg-white/10 rounded-lg p-2">
              <label
                htmlFor="file-upload-detail"
                className={`p-2 text-white rounded-lg ${
                  isReadingDetailFile || isUploadingDetail
                    ? "cursor-not-allowed bg-slate-400"
                    : "cursor-pointer bg-blue-500 hover:bg-blue-600"
                }`}
                title="Chọn file"
              >
                <FiUpload size={16} />
              </label>
              <span className="text-white text-xs font-medium flex-1 text-center">
                {t("workplaceChart.chooseExceldetail")}
              </span>
              <button
                onClick={handleDetailUploadToFirebase}
                disabled={
                  !detailData || isUploadingDetail || isReadingDetailFile
                }
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:from-blue-700 hover:to-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploadingDetail
                  ? "Đang upload..."
                  : t("workplaceChart.uploadFirebase")}
              </button>
              <input
                ref={detailFileInputRef}
                id="file-upload-detail"
                type="file"
                accept=".xlsx, .xls"
                onChange={handleDetailUpload}
                disabled={isReadingDetailFile || isUploadingDetail}
                className="hidden"
              />
            </div>
          </div>
        )}
      </Sidebar>
      {/* Chart và bảng tổng */}
      <div
        className={`flex-1 flex flex-col lg:flex-row gap-3 sm:gap-6 px-2 sm:px-4 transition-all duration-300 ${
          sidebarOpen ? "ml-72" : "ml-0"
        }`}
        style={{ minHeight: 0, overflow: "hidden" }}
      >
        {/* Chart */}
        <div
          className="flex-1 lg:flex-[7] bg-white rounded-xl shadow-lg px-4 max-h-[65vh] lg:max-h-[93vh]"
          style={{
            minHeight: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {chartData ? (
            <div
              className="relative flex-1"
              style={{
                minHeight: 0,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
              >
                <Bar
                  data={chartData}
                  options={{
                    indexAxis: "y",
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (context) => {
                            const label = context.dataset.label || "";
                            const val = context.parsed.x || 0;
                            return `${label}: ${val.toLocaleString()}`;
                          },
                        },
                      },
                      datalabels: { display: false },
                    },
                    layout: {
                      padding: 0,
                    },
                    scales: {
                      x: {
                        beginAtZero: true,
                        stacked: false,
                        barPercentage: 0.2,
                        categoryPercentage: 0.5,
                        grid: { display: false, color: "#000" },
                        ticks: {
                          color: "#000",
                          font: { weight: "bold", size: 15 },
                        },
                      },
                      y: {
                        ticks: {
                          callback: function (value) {
                            const label = this.getLabelForValue(value);
                            return label.length > 15
                              ? label.slice(0, 15) + "..."
                              : label;
                          },
                          font: { size: 15, weight: "bold" },
                          color: "#000",
                          autoSkip: true,
                          maxTicksLimit: 20,
                        },
                        grid: {
                          display: true,
                          color: "#000",
                          lineWidth: 0.8,
                        },
                      },
                    },
                  }}
                  plugins={[ChartDataLabels, extraLabelPlugin]}
                  height={null}
                />
              </div>
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <p className="text-gray-500">
                {t("workplaceChart.pleaseSelectExcel")}
              </p>
            </div>
          )}
        </div>
        {/* Bảng tổng - Hiển thị khi màn hình >= 1520px */}
        {showTable && (
          <div
            className="flex flex-col bg-white rounded-xl shadow-lg p-3 overflow-y-auto"
            style={{
              flex: "4",
              minWidth: "280px",
              maxHeight: "93vh",
            }}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2 gap-2">
              <h3 className="text-base sm:text-xl font-bold uppercase px-1 sm:px-2">
                {t("workplaceChart.outputByArea")}
              </h3>

              <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                <select
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                  className="border border-gray-300 rounded-md px-2 py-1 text-xs sm:text-sm focus:outline-none flex-1 sm:flex-none"
                  style={{ minWidth: 100 }}
                >
                  <option value="">{t("workplaceChart.selectArea")}</option>
                  {Object.keys(dataMap).map((area) => (
                    <option key={area} value={area}>
                      {t(`areas.${area}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {chartData ? (
              tableView === "detailed" ? (
                <>
                  <table
                    className="min-w-full text-left border-collapse table-auto text-sm"
                    style={{ fontSize: "0.875rem", lineHeight: 1.2 }}
                  >
                    <thead>
                      <tr className="uppercase">
                        <th className="border-b pb-1" style={{ width: "35%" }}>
                          {t("workplaceChart.areaDay")}
                        </th>
                        <th
                          className="border-b pb-1 text-right"
                          style={{ width: "25%" }}
                        >
                          {t("workplaceChart.normal")}
                        </th>
                        <th
                          className="border-b pb-1 text-right"
                          style={{ width: "20%" }}
                        >
                          NG
                        </th>
                        <th
                          className="border-b pb-1 text-right font-bold"
                          style={{ width: "20%" }}
                        >
                          {t("workplaceChart.total")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(dataMap)
                        .filter(
                          ([area]) =>
                            selectedArea === "" || selectedArea === area,
                        )
                        .map(([area, dayArr]) => {
                          let totalNormal = 0;
                          let totalNG = 0;
                          chartData.labels.forEach((_, idx) => {
                            const { Day, Night } = dayArr[idx] || {
                              Day: {},
                              Night: {},
                            };
                            let normal, ng;
                            if (area === "CNC") {
                              normal = Day.normal;
                              ng = Day.ng_normal + Day.ng_rework;
                            } else {
                              normal = Day.normal + Night.normal;
                              ng =
                                Day.ng_normal +
                                Night.ng_normal +
                                Day.ng_rework +
                                Night.ng_rework;
                            }
                            totalNormal += normal;
                            totalNG += ng;
                          });
                          return (
                            <React.Fragment key={area}>
                              <tr
                                className="bg-gray-200 font-semibold uppercase"
                                style={{ fontSize: "0.9rem" }}
                              >
                                <td style={{ padding: "6px 8px" }}>
                                  {t(`areas.${area}`)}
                                </td>
                                <td
                                  className="text-right"
                                  style={{ padding: "6px 8px" }}
                                >
                                  {totalNormal.toLocaleString()}
                                </td>
                                <td
                                  className="text-right"
                                  style={{ padding: "6px 8px" }}
                                >
                                  {totalNG.toLocaleString()}
                                </td>
                                <td
                                  className="text-right"
                                  style={{ padding: "6px 8px" }}
                                >
                                  {(totalNormal + totalNG).toLocaleString()}
                                </td>
                              </tr>
                              {chartData.labels.map((label, idx) => {
                                const { Day, Night } = dayArr[idx] || {
                                  Day: {
                                    normal: 0,
                                    ng_normal: 0,
                                    ng_rework: 0,
                                  },
                                  Night: {
                                    normal: 0,
                                    ng_normal: 0,
                                    ng_rework: 0,
                                  },
                                };
                                let normal, ng;
                                if (area === "CNC") {
                                  normal = Day.normal;
                                  ng = Day.ng_normal + Day.ng_rework;
                                } else {
                                  normal = Day.normal + Night.normal;
                                  ng =
                                    Day.ng_normal +
                                    Night.ng_normal +
                                    Day.ng_rework +
                                    Night.ng_rework;
                                }
                                const total = normal + ng; // Tổng = good + NG
                                if (total === 0) return null;
                                return (
                                  <tr
                                    key={idx}
                                    className="text-gray-700"
                                    style={{ fontSize: "0.8rem" }}
                                  >
                                    <td
                                      style={{
                                        paddingLeft: 32,
                                        paddingTop: 2,
                                        paddingBottom: 2,
                                      }}
                                    >
                                      {label}
                                    </td>
                                    <td
                                      className="text-right"
                                      style={{
                                        paddingTop: 2,
                                        paddingBottom: 2,
                                      }}
                                    >
                                      {normal.toLocaleString()}
                                    </td>
                                    <td
                                      className="text-right"
                                      style={{
                                        paddingTop: 2,
                                        paddingBottom: 2,
                                      }}
                                    >
                                      {ng.toLocaleString()}
                                    </td>
                                    <td
                                      className="text-right"
                                      style={{
                                        paddingTop: 2,
                                        paddingBottom: 2,
                                      }}
                                    >
                                      {total.toLocaleString()}
                                    </td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                    </tbody>
                  </table>
                  {/* Nút xuất Excel */}
                  <div className="mt-4 flex justify-end gap-3">
                    <button
                      onClick={() =>
                        openDetailModal("Assembly", getCurrentWeekNumber())
                      }
                      className="bg-blue-600 text-white px-4 py-2 rounded font-bold"
                    >
                      {t("workplaceChart.viewDetail")}
                    </button>

                    <button
                      onClick={exportToExcel}
                      className="font-bold text-white px-3 py-2 bg-green-600 rounded hover:bg-green-700"
                    >
                      {t("workplaceChart.exportExcel")}
                    </button>
                  </div>
                </>
              ) : (
                // summary view: bảng đơn giản tổng mỗi khu vực
                <table
                  className="min-w-full text-left border-collapse table-auto text-sm"
                  style={{ fontSize: "0.875rem", lineHeight: 1.2 }}
                >
                  <thead>
                    <tr>
                      <th className="border-b pb-1" style={{ width: "40%" }}>
                        {t("workplaceChart.area")}
                      </th>
                      <th
                        className="border-b pb-1 text-right"
                        style={{ width: "20%" }}
                      >
                        {t("workplaceChart.normal")}
                      </th>
                      <th
                        className="border-b pb-1 text-right"
                        style={{ width: "20%" }}
                      >
                        {t("workplaceChart.rework")}
                      </th>
                      <th
                        className="border-b pb-1 text-right font-bold"
                        style={{ width: "20%" }}
                      >
                        {t("workplaceChart.total")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(dataMap).map(([area, dayArr]) => {
                      let totalNormal = 0;
                      let totalRework = 0;
                      dayArr.forEach(({ Day, Night }, idx) => {
                        let normal = Day.normal;
                        let rework = Day.rework;
                        if (area === "CNC") {
                          const nextNight =
                            idx + 1 < dayArr.length
                              ? dayArr[idx + 1].Night
                              : { normal: 0, rework: 0 };
                          normal += nextNight.normal;
                          rework += nextNight.rework;
                        } else {
                          normal += Night.normal;
                          rework += Night.rework;
                        }
                        totalNormal += normal;
                        totalRework += rework;
                      });
                      return (
                        <tr
                          key={area}
                          className="font-semibold"
                          style={{ fontSize: "1rem" }}
                        >
                          <td style={{ padding: "6px 8px" }}>{area}</td>
                          <td
                            className="text-right"
                            style={{ padding: "6px 8px" }}
                          >
                            {totalNormal.toLocaleString()}
                          </td>
                          <td
                            className="text-right"
                            style={{ padding: "6px 8px" }}
                          >
                            {totalRework.toLocaleString()}
                          </td>
                          <td
                            className="text-right"
                            style={{ padding: "6px 8px" }}
                          >
                            {(totalNormal + totalRework).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            ) : (
              <p>{t("workplaceChart.noData")}</p>
            )}
          </div>
        )}
      </div>
      <DetailedModal
        isOpen={isModalOpen}
        onClose={closeDetailModal}
        area={modalArea}
      />
    </div>
  );
}
