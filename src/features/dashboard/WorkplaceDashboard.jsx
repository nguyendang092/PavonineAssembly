/**
 * Dashboard sản lượng: `mode="normal"` (/normal) và `mode="ng"` (/ng).
 * Hai luồng UI/dữ liệu tách trong `WorkplaceProductionView` và `WorkplaceNGView`.
 */
import React, { useState, useEffect, useRef, useMemo } from "react";
import * as XLSX from "@e965/xlsx";
import { Chart, Bar } from "react-chartjs-2";
import {
  FiUpload,
  FiCalendar,
  FiLayers,
  FiTrendingUp,
  FiAlertTriangle,
  FiActivity,
  FiTable,
  FiX,
} from "react-icons/fi";
import { useTranslation } from "react-i18next";
import DetailedNGModal from "@/components/modals/DetailedNGModal";
import DetailedModal from "@/components/modals/DetailedModal";
import { useUser } from "@/contexts/UserContext";
import { logUserAction } from "@/utils/userLog";
import Sidebar from "@/components/layout/Sidebar";
import {
  Chart as ChartJS,
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
} from "chart.js";
import { format, parseISO, getISOWeek } from "date-fns";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { getDatabase, ref, update, get } from "firebase/database";
import { db } from "@/services/firebase"; // đường dẫn tới file cấu hình firebase của bạn
import LoadingBlock from "@/components/ui/LoadingBlock";
import { uploadNgFaultyExcel } from "./ngWorkplaceUpload";
import "./dashboard.css";

ChartJS.register(
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
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

/** Lượng đạt (không gồm NG) theo ngày — đồng bộ logic CNC / ca. */
function dayNormalTotal(area, dayArr, idx) {
  if (!dayArr?.[idx]) return 0;
  const { Day, Night } = dayArr[idx];
  if (area === "CNC") {
    return (Day?.normal ?? 0) + (Day?.rework ?? 0);
  }
  return (
    (Day?.normal ?? 0) +
    (Night?.normal ?? 0) +
    (Day?.rework ?? 0) +
    (Night?.rework ?? 0)
  );
}

/** Tổng NG theo ngày. */
function dayNGTotal(area, dayArr, idx) {
  if (!dayArr?.[idx]) return 0;
  const { Day, Night } = dayArr[idx];
  if (area === "CNC") {
    return (Day?.ng_normal ?? 0) + (Day?.ng_rework ?? 0);
  }
  return (
    (Day?.ng_normal ?? 0) +
    (Night?.ng_normal ?? 0) +
    (Day?.ng_rework ?? 0) +
    (Night?.ng_rework ?? 0)
  );
}

function formatDayLabelShort(d) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(d))) {
    try {
      return format(parseISO(d), "dd/MM");
    } catch {
      return d;
    }
  }
  try {
    return format(parseISO(d), "dd/MM");
  } catch {
    return String(d).slice(0, 10);
  }
}

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
        ctx.font = "600 10px system-ui, sans-serif";
        ctx.fillStyle = "#334155";
        ctx.textBaseline = "middle";
        const x = bar.x + 10;
        const y = bar.y + bar.height / 8;
        ctx.fillText(`${shortName}: ${value.toLocaleString()}`, x, y);
        ctx.restore();
      });
    });
  },
};

function WorkplaceProductionView() {
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
  const [dataTableOpen, setDataTableOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isReadingTotalFile, setIsReadingTotalFile] = useState(false);
  const [isReadingDetailFile, setIsReadingDetailFile] = useState(false);
  const [isUploadingTotal, setIsUploadingTotal] = useState(false);
  const [isUploadingDetail, setIsUploadingDetail] = useState(false);
  const totalFileInputRef = useRef(null);
  const detailFileInputRef = useRef(null);

  useEffect(() => {
    if (!dataTableOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setDataTableOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dataTableOpen]);

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
      map[area].some(({ Day, Night }) => {
        const ok = Day.normal + Day.rework + Night.normal + Night.rework;
        const ng =
          (Day.ng_normal ?? 0) +
          (Day.ng_rework ?? 0) +
          (Night.ng_normal ?? 0) +
          (Night.ng_rework ?? 0);
        return ok > 0 || ng > 0;
      }),
    );
    const labels = days.map((d) => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
      try {
        const dateObj = parseISO(d);
        return format(dateObj, "yyyy-MM-dd");
      } catch {
        return d;
      }
    });
    setChartData({ labels, areas: filteredAreas });
  }, [selectedWeek, weekData]);
  const exportToExcel = () => {
    if (!chartData?.labels?.length) return;
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

  const dashboardStats = useMemo(() => {
    if (!chartData?.labels?.length || !Object.keys(dataMap).length) {
      return {
        totalGood: 0,
        totalNG: 0,
        grandTotal: 0,
        areaCount: 0,
        dayCount: 0,
      };
    }
    let totalNormal = 0;
    let totalNGSum = 0;
    Object.entries(dataMap).forEach(([area, dayArr]) => {
      chartData.labels.forEach((_, idx) => {
        const { Day, Night } = dayArr[idx] || { Day: {}, Night: {} };
        let normal;
        let ng;
        if (area === "CNC") {
          normal = Day.normal;
          ng = Day.ng_normal + Day.ng_rework;
        } else {
          normal = Day.normal + Night.normal;
          ng =
            Day.ng_normal + Night.ng_normal + Day.ng_rework + Night.ng_rework;
        }
        totalNormal += normal;
        totalNGSum += ng;
      });
    });
    return {
      totalGood: totalNormal,
      totalNG: totalNGSum,
      grandTotal: totalNormal + totalNGSum,
      areaCount: Object.keys(dataMap).length,
      dayCount: chartData.labels.length,
    };
  }, [chartData, dataMap]);

  const weekMeta = useMemo(() => {
    if (!selectedWeek) return { weekNum: "", year: "" };
    const [w, y] = selectedWeek.split("_");
    return { weekNum: w, year: y };
  }, [selectedWeek]);

  const areaComboDataByArea = useMemo(() => {
    if (!chartData?.labels?.length || !chartData?.areas?.length) return {};
    const out = {};
    chartData.areas.forEach((area) => {
      const dayArr = dataMap[area];
      const labels = chartData.labels;
      const normals = labels.map((_, idx) => dayNormalTotal(area, dayArr, idx));
      const ngs = labels.map((_, idx) => dayNGTotal(area, dayArr, idx));
      const shortLabels = labels.map(formatDayLabelShort);
      out[area] = {
        labels: shortLabels,
        datasets: [
          {
            type: "bar",
            label: t("workplaceChart.comboBarLabel"),
            data: normals,
            backgroundColor: "rgba(14, 165, 233, 0.78)",
            borderColor: "rgb(2, 132, 199)",
            borderWidth: 0,
            borderRadius: 3,
            borderSkipped: false,
            maxBarThickness: 26,
            yAxisID: "y",
          },
          {
            type: "line",
            label: t("workplaceChart.comboLineLabel"),
            data: ngs,
            borderColor: "rgb(225, 29, 72)",
            backgroundColor: "rgba(225, 29, 72, 0.04)",
            tension: 0.35,
            pointRadius: 2,
            pointHoverRadius: 4,
            pointBackgroundColor: "rgb(225, 29, 72)",
            pointBorderColor: "#fff",
            pointBorderWidth: 1,
            yAxisID: "y1",
            borderWidth: 2,
            fill: false,
          },
        ],
      };
    });
    return out;
  }, [chartData, dataMap, t]);

  const comboChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 420, easing: "easeOutCubic" },
      interaction: { mode: "index", intersect: false },
      layout: {
        padding: { top: 2, right: 4, bottom: 0, left: 2 },
      },
      plugins: {
        legend: {
          position: "bottom",
          align: "center",
          labels: {
            boxWidth: 8,
            boxHeight: 8,
            padding: 10,
            usePointStyle: true,
            pointStyle: "rectRounded",
            font: { size: 10, weight: "500", family: "system-ui, sans-serif" },
            color: "#475569",
          },
        },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.92)",
          titleFont: { size: 11, weight: "600" },
          bodyFont: { size: 11 },
          padding: 10,
          cornerRadius: 8,
          displayColors: true,
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed.y;
              const num = typeof v === "number" ? v : 0;
              return ` ${ctx.dataset.label}: ${num.toLocaleString()}`;
            },
          },
        },
        datalabels: { display: false },
      },
      scales: {
        x: {
          border: { display: false },
          grid: {
            display: true,
            color: "rgba(148, 163, 184, 0.18)",
            drawTicks: false,
          },
          ticks: {
            maxRotation: 0,
            minRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
            font: { size: 9, weight: "500" },
            color: "#64748b",
            padding: 4,
          },
        },
        y: {
          type: "linear",
          position: "left",
          title: { display: false },
          border: { display: false },
          grid: {
            color: "rgba(148, 163, 184, 0.22)",
            lineWidth: 1,
          },
          ticks: {
            font: { size: 9, weight: "500" },
            color: "#64748b",
            padding: 6,
            maxTicksLimit: 5,
          },
          beginAtZero: true,
        },
        y1: {
          type: "linear",
          position: "right",
          title: { display: false },
          border: { display: false },
          grid: { drawOnChartArea: false },
          ticks: {
            font: { size: 9, weight: "500" },
            color: "#94a3b8",
            padding: 6,
            maxTicksLimit: 5,
          },
          beginAtZero: true,
        },
      },
    }),
    [t],
  );

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/60">
      <button
        type="button"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-expanded={sidebarOpen}
        aria-label={t("workplaceChart.toggleSidebar")}
        className="dashboard-no-print fixed left-4 top-20 z-50 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-md transition hover:bg-slate-50 hover:shadow-lg focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
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
              {t("workplaceChart.year")}
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
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
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
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
      <div
        className={`dashboard-print-fill flex flex-1 flex-col min-h-0 px-3 sm:px-5 pb-3 transition-all duration-300 ${
          sidebarOpen ? "ml-72" : "ml-0"
        }`}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="dashboard-report-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-300/90 bg-slate-100 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="shrink-0 border-b border-slate-300/80 bg-gradient-to-b from-slate-200/95 to-slate-100 px-4 pt-4 pb-3 dark:border-slate-800 dark:from-slate-950 dark:to-slate-950">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-400">
                    {t("workplaceChart.dashboardBadge")}
                  </p>
                  <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl dark:text-slate-50">
                    {t("workplaceChart.dashboardTitle")}
                  </h1>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-600 dark:text-slate-400">
                    {t("workplaceChart.dashboardSubtitle")}
                  </p>
                </div>
                {weekMeta.weekNum ? (
                  <div className="shrink-0 sm:text-right">
                    <span className="inline-flex items-center rounded-full border border-slate-300/80 bg-slate-50/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm tabular-nums dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-200">
                      {t("workplaceChart.weekPeriod", {
                        week: weekMeta.weekNum,
                        year: weekMeta.year,
                      })}
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 shadow-sm dark:border-slate-700/90 dark:bg-slate-900/95">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    <FiTrendingUp
                      className="shrink-0 text-emerald-600 dark:text-emerald-400"
                      size={14}
                    />
                    {t("workplaceChart.kpiTotalGood")}
                  </div>
                  <p className="mt-0.5 text-base font-bold tabular-nums leading-tight text-slate-900 dark:text-slate-50">
                    {dashboardStats.totalGood.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 shadow-sm dark:border-slate-700/90 dark:bg-slate-900/95">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    <FiAlertTriangle
                      className="shrink-0 text-rose-600 dark:text-rose-400"
                      size={14}
                    />
                    {t("workplaceChart.kpiTotalNG")}
                  </div>
                  <p className="mt-0.5 text-base font-bold tabular-nums leading-tight text-slate-900 dark:text-slate-50">
                    {dashboardStats.totalNG.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 shadow-sm dark:border-slate-700/90 dark:bg-slate-900/95">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    <FiLayers
                      className="shrink-0 text-indigo-600 dark:text-indigo-400"
                      size={14}
                    />
                    {t("workplaceChart.kpiAreas")}
                  </div>
                  <p className="mt-0.5 text-base font-bold tabular-nums leading-tight text-slate-900 dark:text-slate-50">
                    {dashboardStats.areaCount}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 shadow-sm dark:border-slate-700/90 dark:bg-slate-900/95">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    <FiCalendar
                      className="shrink-0 text-sky-600 dark:text-sky-400"
                      size={14}
                    />
                    {t("workplaceChart.kpiDays")}
                  </div>
                  <p className="mt-0.5 text-base font-bold tabular-nums leading-tight text-slate-900 dark:text-slate-50">
                    {dashboardStats.dayCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-300/80 bg-slate-200/35 px-4 py-2 dark:border-slate-800 dark:bg-black/20">
              <div className="min-w-0 flex-1">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-200">
                  {t("workplaceChart.chartSectionTitle")}
                </h2>
                <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-400">
                  {t("workplaceChart.chartSectionHint")}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDataTableOpen(true)}
                  disabled={!chartData?.labels?.length}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-sky-600 dark:hover:bg-sky-500"
                >
                  <FiTable size={14} strokeWidth={2.5} />
                  {t("workplaceChart.openDataTable")}
                </button>
                {chartData?.areas?.length ? (
                  <span className="inline-flex items-baseline gap-1.5 rounded-md border border-slate-300/80 bg-slate-50/90 px-2.5 py-1 text-[11px] font-medium text-slate-600 tabular-nums dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-300">
                    <span className="text-slate-600 dark:text-slate-400">
                      {t("workplaceChart.grandTotal")}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-50">
                      {dashboardStats.grandTotal.toLocaleString()}
                    </span>
                  </span>
                ) : null}
              </div>
            </div>

            {chartData?.areas?.length ? (
              <div className="min-h-[200px] flex-1 overflow-y-auto bg-slate-200/35 p-3 dark:bg-black/35 sm:p-5">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {chartData.areas.map((area) => {
                    const combo = areaComboDataByArea[area];
                    if (!combo) return null;
                    return (
                      <div
                        key={area}
                        className="flex flex-col rounded-xl border border-slate-300/85 bg-slate-50 p-2 shadow-[0_1px_3px_rgba(15,23,42,0.08)] dark:border-slate-700/90 dark:bg-slate-900/90"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2 border-b border-slate-200/90 pb-1.5 dark:border-slate-700/80">
                          <h3 className="truncate text-[11px] font-bold uppercase tracking-wide text-slate-800 dark:text-slate-50">
                            {t(`areas.${area}`)}
                          </h3>
                          <span className="shrink-0 rounded bg-slate-200/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {t("workplaceChart.panelLabel")}
                          </span>
                        </div>
                        <div className="relative h-[200px] w-full sm:h-[200px] xl:h-[250px]">
                          <Chart
                            type="bar"
                            data={combo}
                            options={comboChartOptions}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center bg-slate-200/35 px-4 py-10 dark:bg-black/35">
                <p className="max-w-sm text-center text-sm text-slate-600 dark:text-slate-400">
                  {t("workplaceChart.pleaseSelectExcel")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {dataTableOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="workplace-data-table-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setDataTableOpen(false)}
            aria-label={t("workplaceChart.closeDataTable")}
          />
          <div
            className="relative z-10 flex min-h-0 max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-300/90 bg-slate-100 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-300/80 bg-gradient-to-b from-slate-200/95 to-slate-100 px-4 py-3 dark:border-slate-800 dark:from-slate-950 dark:to-slate-950 sm:px-5">
              <div className="min-w-0">
                <h2
                  id="workplace-data-table-title"
                  className="text-base font-bold text-slate-900 dark:text-slate-50 sm:text-lg"
                >
                  {t("workplaceChart.tableSectionTitle")}
                </h2>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
                  {t("workplaceChart.tableSectionHint")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDataTableOpen(false)}
                className="shrink-0 rounded-lg p-2 text-slate-600 transition hover:bg-slate-300/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label={t("workplaceChart.closeDataTable")}
              >
                <FiX size={20} strokeWidth={2} />
              </button>
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-b border-slate-300/80 bg-slate-50/90 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/95 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex rounded-lg border border-slate-300/80 bg-slate-100/90 p-0.5 text-[11px] font-semibold dark:border-slate-700/90 dark:bg-slate-950/80">
                <button
                  type="button"
                  onClick={() => setTableView("detailed")}
                  className={`rounded-md px-2.5 py-1.5 transition sm:px-3 ${
                    tableView === "detailed"
                      ? "bg-slate-50 text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  }`}
                >
                  {t("workplaceChart.viewDetailed")}
                </button>
                <button
                  type="button"
                  onClick={() => setTableView("summary")}
                  className={`rounded-md px-2.5 py-1.5 transition sm:px-3 ${
                    tableView === "summary"
                      ? "bg-slate-50 text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  }`}
                >
                  {t("workplaceChart.viewSummary")}
                </button>
              </div>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="w-full rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/35 dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-100 sm:max-w-[220px]"
              >
                <option value="">{t("workplaceChart.selectArea")}</option>
                {Object.keys(dataMap).map((area) => (
                  <option key={area} value={area}>
                    {t(`areas.${area}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-200/35 px-4 py-3 dark:bg-black/35 sm:px-5">
              {chartData ? (
                tableView === "detailed" ? (
                  <>
                    <div className="overflow-x-auto rounded-xl border border-slate-300/85 dark:border-slate-700/90">
                      <table className="w-full min-w-[520px] border-collapse text-left text-xs text-slate-700 dark:text-slate-200">
                        <thead>
                          <tr className="uppercase">
                            <th className="sticky top-0 z-[1] bg-slate-200/90 px-3 py-2 text-[10px] font-semibold tracking-wide text-slate-700 dark:bg-slate-900/95 dark:text-slate-300">
                              {t("workplaceChart.areaDay")}
                            </th>
                            <th className="sticky top-0 z-[1] bg-slate-200/90 px-3 py-2 text-right text-[10px] font-semibold tracking-wide text-slate-700 dark:bg-slate-900/95 dark:text-slate-300">
                              {t("workplaceChart.normal")}
                            </th>
                            <th className="sticky top-0 z-[1] bg-slate-200/90 px-3 py-2 text-right text-[10px] font-semibold tracking-wide text-slate-700 dark:bg-slate-900/95 dark:text-slate-300">
                              {t("workplaceChart.ngColumn")}
                            </th>
                            <th className="sticky top-0 z-[1] bg-slate-200/90 px-3 py-2 text-right text-[10px] font-semibold tracking-wide text-slate-800 dark:bg-slate-900/95 dark:text-slate-200">
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
                                  <tr className="bg-slate-200/80 text-[11px] font-semibold uppercase text-slate-800 dark:bg-slate-900/90 dark:text-slate-100">
                                    <td className="px-3 py-2">
                                      {t(`areas.${area}`)}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums">
                                      {totalNormal.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums">
                                      {totalNG.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular-nums">
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
                                        className="border-b border-slate-100/90 text-[11px] text-slate-600 transition hover:bg-sky-50/50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/50"
                                      >
                                        <td className="pl-8 pr-3 py-1.5 text-slate-600 dark:text-slate-400">
                                          {label}
                                        </td>
                                        <td className="px-3 py-1.5 text-right tabular-nums">
                                          {normal.toLocaleString()}
                                        </td>
                                        <td className="px-3 py-1.5 text-right tabular-nums">
                                          {ng.toLocaleString()}
                                        </td>
                                        <td className="px-3 py-1.5 text-right tabular-nums font-medium text-slate-800 dark:text-slate-100">
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
                    </div>
                    <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-300/80 pt-3 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() =>
                          openDetailModal("Assembly", getCurrentWeekNumber())
                        }
                        className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700"
                      >
                        {t("workplaceChart.viewDetail")}
                      </button>

                      <button
                        type="button"
                        onClick={exportToExcel}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                      >
                        {t("workplaceChart.exportExcel")}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-300/85 dark:border-slate-700/90">
                    <table className="w-full min-w-[520px] border-collapse text-left text-xs text-slate-700 dark:text-slate-200">
                      <thead>
                        <tr className="uppercase">
                          <th className="border-b border-slate-300/80 bg-slate-200/90 px-3 py-2 text-[10px] font-semibold tracking-wide text-slate-700 dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-300">
                            {t("workplaceChart.area")}
                          </th>
                          <th className="border-b border-slate-300/80 bg-slate-200/90 px-3 py-2 text-right text-[10px] font-semibold tracking-wide text-slate-700 dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-300">
                            {t("workplaceChart.normal")}
                          </th>
                          <th className="border-b border-slate-300/80 bg-slate-200/90 px-3 py-2 text-right text-[10px] font-semibold tracking-wide text-slate-700 dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-300">
                            {t("workplaceChart.rework")}
                          </th>
                          <th className="border-b border-slate-300/80 bg-slate-200/90 px-3 py-2 text-right text-[10px] font-semibold tracking-wide text-slate-800 dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-200">
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
                              className="border-b border-slate-100 text-[11px] font-medium text-slate-800 transition hover:bg-slate-50/90 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800/80"
                            >
                              <td className="px-3 py-2">
                                {t(`areas.${area}`)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {totalNormal.toLocaleString()}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {totalRework.toLocaleString()}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums font-semibold">
                                {(totalNormal + totalRework).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                <p className="py-6 text-center text-sm text-slate-600 dark:text-slate-400">
                  {t("workplaceChart.noData")}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      <DetailedModal
        isOpen={isModalOpen}
        onClose={closeDetailModal}
        area={modalArea}
      />
    </div>
  );
}

function WorkplaceNGView() {
  const { user } = useUser();
  const { t } = useTranslation();
  const [chartData, setChartData] = useState(null);
  const [selectedArea, setSelectedArea] = useState("");
  const [selectedWeek, setSelectedWeek] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [weekData, setWeekData] = useState({});
  const [dataMap, setDataMap] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalArea, setModalArea] = useState("");
  const [showTable, setShowTable] = useState(window.innerWidth >= 1520);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);

  // Theo dõi kích thước màn hình
  useEffect(() => {
    const handleResize = () => {
      setShowTable(window.innerWidth >= 1520);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const ngDashboardStats = useMemo(() => {
    if (!chartData?.labels?.length) {
      return {
        totalNormal: 0,
        totalRework: 0,
        grandTotal: 0,
        areaCount: 0,
        dayCount: 0,
      };
    }
    let totalNormal = 0;
    let totalRework = 0;
    Object.values(dataMap).forEach((dayObj) => {
      chartData.labels.forEach((label) => {
        const d = dayObj[label] || { normal: 0, rework: 0 };
        totalNormal += d.normal;
        totalRework += d.rework;
      });
    });
    return {
      totalNormal,
      totalRework,
      grandTotal: totalNormal + totalRework,
      areaCount: Object.keys(dataMap).length,
      dayCount: chartData.labels.length,
    };
  }, [chartData, dataMap]);

  // Hàm đóng modal chi tiết
  const closeDetailModal = () => {
    setIsModalOpen(false);
    setModalArea("");
  };
  const parseYearFromDay = (dayStr) => {
    if (!dayStr) return null;
    const parsed = new Date(dayStr);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getFullYear();
  };

  // Tối ưu: chỉ load dữ liệu cho tuần được chọn, lọc theo năm chọn
  useEffect(() => {
    setDataLoading(true);
    const fetchData = async () => {
      try {
        const ngRef = ref(db, "ng");
        const snapshot = await get(ngRef);
        if (!snapshot.exists()) {
          setChartData(null);
          setDataMap({});
          setWeekData({});
          setDataLoading(false);
          return;
        }
        const ngData = snapshot.val();

        // Lấy danh sách tuần duy nhất trong năm đã chọn
        const weekSet = new Set();
        for (const workplace in ngData) {
          for (const week in ngData[workplace]) {
            let hasDayInYear = false;
            for (const rework in ngData[workplace][week]) {
              for (const day in ngData[workplace][week][rework]) {
                const year = parseYearFromDay(day);
                if (year === selectedYear) {
                  hasDayInYear = true;
                  break;
                }
              }
              if (hasDayInYear) break;
            }
            if (hasDayInYear) weekSet.add(week);
          }
        }
        let weekList = Array.from(weekSet);
        // Sort tuần theo số (tăng dần)
        weekList = weekList.sort((a, b) => Number(a) - Number(b));

        setWeekData(
          weekList.reduce((acc, w) => {
            acc[w] = true;
            return acc;
          }, {})
        );

        const currentWeek = getCurrentWeekNumber();

        // Khi đổi năm hoặc chưa có tuần chọn, chọn tuần hợp lệ trong năm
        if (!selectedWeek || !weekList.includes(selectedWeek)) {
          if (weekList.includes(currentWeek.toString())) {
            setSelectedWeek(currentWeek.toString());
            setDataLoading(false);
            return;
          }
          const previousWeek = currentWeek - 1;
          if (weekList.includes(previousWeek.toString())) {
            setSelectedWeek(previousWeek.toString());
            setDataLoading(false);
            return;
          }
          if (weekList.length > 0) {
            setSelectedWeek(weekList[weekList.length - 1]);
            setDataLoading(false);
            return;
          }
          setSelectedWeek("");
          setDataLoading(false);
          return;
        }

        // Nếu đã có selectedWeek, build dữ liệu cho tuần đó
        const rows = [];
        for (const workplace in ngData) {
          if (!ngData[workplace][selectedWeek]) continue;
          for (const rework in ngData[workplace][selectedWeek]) {
            for (const day in ngData[workplace][selectedWeek][rework]) {
              const year = parseYearFromDay(day);
              if (year !== selectedYear) continue;
              for (const model in ngData[workplace][selectedWeek][rework][
                day
              ]) {
                for (const shift in ngData[workplace][selectedWeek][rework][
                  day
                ][model]) {
                  const qty =
                    ngData[workplace][selectedWeek][rework][day][model][shift];
                  rows.push({
                    workplace,
                    week: selectedWeek,
                    rework,
                    day,
                    model,
                    shift,
                    qty,
                  });
                }
              }
            }
          }
        }
        // Chuẩn bị dataMap cho bảng tổng
        const map = {};
        rows.forEach((row) => {
          if (!map[row.workplace]) map[row.workplace] = {};
          if (!map[row.workplace][row.day])
            map[row.workplace][row.day] = { normal: 0, rework: 0 };
          let value = row.qty;
          if (typeof value === "object" && value !== null) {
            value = value.quantity ?? 0;
          }
          if (row.rework === "Rework") {
            map[row.workplace][row.day].rework += Number(value) || 0;
          } else {
            map[row.workplace][row.day].normal += Number(value) || 0;
          }
        });
        setDataMap(map);

        // Chuẩn bị dữ liệu cho biểu đồ
        const workplaces = Object.keys(map);
        let days = Array.from(new Set(rows.map((r) => r.day))).sort();

        // Loại bỏ ngày chủ nhật ("Chủ nhật" hoặc "Sunday")
        days = days.filter((day) => {
          const lower = day.toLowerCase();
          return lower !== "chủ nhật" && lower !== "sunday";
        });

        const datasets = workplaces.map((workplace, i) => ({
          label: workplace,
          data: days.map(
            (day) =>
              (map[workplace][day]?.normal || 0) +
              (map[workplace][day]?.rework || 0)
          ),
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
        }));

        setChartData({ labels: days, datasets });
      } catch (err) {
        setChartData(null);
        setDataMap({});
        setWeekData({});
        console.error("Lỗi load dữ liệu NG:", err);
      }
      setDataLoading(false);
    };
    fetchData();
  }, [selectedWeek, selectedYear]);

  const uploadFromExcel = (file, user) =>
    uploadNgFaultyExcel(file, {
      db,
      user,
      logUserAction,
      onLoading: setDataLoading,
    });

  // Handle khi người dùng chọn file
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPendingFile(file);
  };

  const openDetailModal = () => {
    const fallbackArea = selectedArea || Object.keys(dataMap)[0] || "";
    if (!fallbackArea) return;
    setModalArea(fallbackArea);
    setIsModalOpen(true);
  };

  const exportToExcel = () => {
    if (!chartData) {
      alert(t("workplaceNGChart.noData"));
      return;
    }

    const headers = ["Khu vực", "Ngày", "Normal", "Rework", "Tổng"];
    const rows = [];

    Object.entries(dataMap)
      .filter(([area]) => selectedArea === "" || selectedArea === area)
      .forEach(([area, dayObj]) => {
        chartData.labels.forEach((label) => {
          const { normal = 0, rework = 0 } = dayObj[label] || {};
          const total = normal + rework;
          if (total === 0) return;
          rows.push([area, label, normal, rework, total]);
        });
      });

    if (rows.length === 0) {
      alert(t("workplaceNGChart.noData"));
      return;
    }

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "NG Data");
    XLSX.writeFile(workbook, `ng_data_week_${selectedWeek || "all"}.xlsx`);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/60 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 lg:flex-row">
      <button
        type="button"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-expanded={sidebarOpen}
        aria-label={t("workplaceNGChart.toggleSidebar")}
        className="dashboard-no-print fixed left-4 top-20 z-50 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-md transition hover:bg-slate-50 hover:shadow-lg focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
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
              {t("workplaceNGChart.menuTitle")}
            </h2>
          </div>

          {/* Year selection — cùng pattern với chế độ sản lượng */}
          <div>
            <label className="mb-2 block text-sm font-medium text-white">
              {t("workplaceNGChart.year")}
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
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
                  {t("workplaceNGChart.selectWeek")}
                </label>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                >
                  {Object.keys(weekData)
                    .filter((week) => {
                      if (!chartData || !chartData.labels) return true;
                      const days = chartData.labels.map((label) =>
                        label.toLowerCase()
                      );
                      return (
                        !days.includes("chủ nhật") && !days.includes("sunday")
                      );
                    })
                    .map((week) => (
                      <option key={week} value={week}>
                        {t("workplaceNGChart.week")} {week}
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
              {t("workplaceNGChart.uploadData")}
            </p>
            <div className="flex items-center justify-between gap-2 bg-white/10 rounded-lg p-2">
              <label
                htmlFor="file-upload-total"
                className="cursor-pointer p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                title="Chọn file"
              >
                <FiUpload size={16} />
              </label>
              <span className="text-white text-xs font-medium flex-1 text-center">
                {pendingFile?.name || t("workplaceNGChart.chooseExceltotal")}
              </span>
              <button
                onClick={() => {
                  if (!pendingFile) {
                    alert(t("workplaceNGChart.pleaseSelectExcel"));
                    return;
                  }
                  uploadFromExcel(pendingFile, user);
                }}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-1 rounded-lg text-xs font-medium hover:from-blue-700 hover:to-purple-700 transition"
              >
                {t("workplaceNGChart.uploadFirebase")}
              </button>
              <input
                id="file-upload-total"
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
        )}
      </Sidebar>

      <main
        className={`dashboard-print-fill flex min-h-0 flex-1 flex-col px-3 pb-3 transition-all duration-300 sm:px-5 ${
          sidebarOpen ? "ml-72" : "ml-0"
        }`}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="dashboard-report-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-300/90 bg-slate-100 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="shrink-0 border-b border-slate-300/80 bg-gradient-to-b from-slate-200/95 to-slate-100 px-4 pb-3 pt-4 dark:border-slate-800 dark:from-slate-950 dark:to-slate-950">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-700 dark:text-rose-400">
                    {t("workplaceNGChart.dashboardBadge")}
                  </p>
                  <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-xl">
                    {t("workplaceNGChart.dashboardTitle")}
                  </h1>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-slate-600 dark:text-slate-400">
                    {t("workplaceNGChart.dashboardSubtitle")}
                  </p>
                </div>
                {selectedWeek ? (
                  <div className="shrink-0 sm:text-right">
                    <span className="inline-flex items-center rounded-full border border-slate-300/80 bg-slate-50/90 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm tabular-nums dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-200">
                      {t("workplaceNGChart.weekPeriod", {
                        week: selectedWeek,
                        year: selectedYear,
                      })}
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 shadow-sm dark:border-slate-700/90 dark:bg-slate-900/95">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    <FiAlertTriangle
                      className="shrink-0 text-rose-600 dark:text-rose-400"
                      size={14}
                    />
                    {t("workplaceNGChart.kpiTotalNG")}
                  </div>
                  <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900 dark:text-slate-50">
                    {ngDashboardStats.grandTotal.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 shadow-sm dark:border-slate-700/90 dark:bg-slate-900/95">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    <FiActivity
                      className="shrink-0 text-amber-600 dark:text-amber-400"
                      size={14}
                    />
                    {t("workplaceNGChart.kpiNormalNG")}
                  </div>
                  <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900 dark:text-slate-50">
                    {ngDashboardStats.totalNormal.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 shadow-sm dark:border-slate-700/90 dark:bg-slate-900/95">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    <FiActivity
                      className="shrink-0 text-orange-600 dark:text-orange-400"
                      size={14}
                    />
                    {t("workplaceNGChart.kpiReworkNG")}
                  </div>
                  <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900 dark:text-slate-50">
                    {ngDashboardStats.totalRework.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 shadow-sm dark:border-slate-700/90 dark:bg-slate-900/95">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    <FiLayers
                      className="shrink-0 text-indigo-600 dark:text-indigo-400"
                      size={14}
                    />
                    {t("workplaceNGChart.kpiAreas")}
                  </div>
                  <p className="mt-0.5 text-base font-bold tabular-nums text-slate-900 dark:text-slate-50">
                    {ngDashboardStats.areaCount}
                  </p>
                </div>
              </div>
              <p className="mt-2 flex items-center justify-center gap-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400 sm:justify-start">
                <FiCalendar
                  className="shrink-0 text-sky-600 dark:text-sky-400"
                  size={12}
                />
                {t("workplaceNGChart.kpiDays")}:{" "}
                <span className="tabular-nums text-slate-700 dark:text-slate-300">
                  {ngDashboardStats.dayCount}
                </span>
              </p>
            </div>

            <div className="shrink-0 border-b border-slate-300/80 bg-slate-200/35 px-4 py-2 dark:border-slate-800 dark:bg-black/20">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-200">
                {t("workplaceNGChart.chartSectionTitle")}
              </h2>
              <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-400">
                {t("workplaceNGChart.chartSectionHint")}
              </p>
            </div>

            <div className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-hidden bg-slate-200/35 p-3 dark:bg-black/35 lg:flex-row lg:gap-4 lg:p-4">
              {dataLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/80 backdrop-blur-[1px] dark:bg-slate-950/80">
                  <LoadingBlock />
                </div>
              )}
              <section className="relative flex min-h-[280px] flex-1 flex-col overflow-hidden rounded-xl border border-slate-300/85 bg-white shadow-sm dark:border-slate-700/90 dark:bg-slate-900/90 lg:min-h-0 lg:basis-[62%]">
                <div className="relative min-h-[260px] flex-1 lg:min-h-0">
                  {chartData ? (
                    <div className="absolute inset-0 p-2 sm:p-3">
                      <Bar
                        data={chartData}
                        options={{
                          indexAxis: "y",
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { display: false, position: "bottom" },
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
                          layout: { padding: 8 },
                          scales: {
                            x: {
                              beginAtZero: true,
                              stacked: false,
                              barPercentage: 0.22,
                              categoryPercentage: 0.55,
                              grid: {
                                display: true,
                                color: "rgba(148, 163, 184, 0.2)",
                              },
                              ticks: {
                                color: "#64748b",
                                font: { weight: "600", size: 11 },
                              },
                              border: { display: false },
                            },
                            y: {
                              ticks: {
                                callback(value) {
                                  const label = this.getLabelForValue(value);
                                  return label.length > 15
                                    ? `${label.slice(0, 15)}…`
                                    : label;
                                },
                                font: { size: 11, weight: "600" },
                                color: "#64748b",
                                autoSkip: true,
                                maxTicksLimit: 20,
                              },
                              grid: {
                                display: true,
                                color: "rgba(148, 163, 184, 0.25)",
                                lineWidth: 1,
                              },
                              border: { display: false },
                            },
                          },
                        }}
                        plugins={[ChartDataLabels, extraLabelPlugin]}
                        height={null}
                      />
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center px-4">
                      <p className="max-w-sm text-center text-sm text-slate-600 dark:text-slate-400">
                        {t("workplaceNGChart.pleaseSelectExcel")}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {showTable ? (
                <section className="flex max-h-[55vh] w-full flex-col overflow-y-auto rounded-xl border border-slate-300/85 bg-slate-50 p-4 shadow-sm dark:border-slate-700/90 dark:bg-slate-900/90 sm:p-5 lg:max-h-none lg:min-h-0 lg:basis-[38%] lg:max-w-xl">
                  <div className="mb-3 flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-slate-50 sm:text-base">
                      {t("workplaceNGChart.outputByArea")}
                    </h3>
                    <select
                      value={selectedArea}
                      onChange={(e) => setSelectedArea(e.target.value)}
                      className="w-full min-w-[140px] rounded-lg border border-slate-300/80 bg-white px-2.5 py-2 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 sm:w-auto"
                    >
                      <option value="">
                        {t("workplaceNGChart.selectArea")}
                      </option>
                      {Object.keys(dataMap).map((area) => (
                        <option key={area} value={area}>
                          {t(`areas.${area}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  {chartData ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[320px] border-collapse text-left text-xs text-slate-700 dark:text-slate-200 sm:text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-100 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300 sm:text-xs">
                            <th className="px-2 py-2">
                              {t("workplaceNGChart.areaDay")}
                            </th>
                            <th className="px-2 py-2 text-right">
                              {t("workplaceNGChart.normal")}
                            </th>
                            <th className="px-2 py-2 text-right">
                              {t("workplaceNGChart.rework")}
                            </th>
                            <th className="px-2 py-2 text-right font-bold">
                              {t("workplaceNGChart.total")}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(dataMap)
                            .filter(
                              ([area]) =>
                                selectedArea === "" || selectedArea === area,
                            )
                            .map(([area, dayObj]) => {
                              let totalNormal = 0;
                              let totalRework = 0;
                              chartData.labels.forEach((day) => {
                                const d = dayObj[day] || {
                                  normal: 0,
                                  rework: 0,
                                };
                                totalNormal += d.normal;
                                totalRework += d.rework;
                              });
                              return (
                                <React.Fragment key={area}>
                                  <tr className="bg-slate-200/90 text-[11px] font-semibold uppercase text-slate-800 dark:bg-slate-800/90 dark:text-slate-100">
                                    <td className="px-2 py-2">
                                      {t(`areas.${area}`)}
                                    </td>
                                    <td className="px-2 py-2 text-right tabular-nums">
                                      {totalNormal.toLocaleString()}
                                    </td>
                                    <td className="px-2 py-2 text-right tabular-nums">
                                      {totalRework.toLocaleString()}
                                    </td>
                                    <td className="px-2 py-2 text-right tabular-nums">
                                      {(
                                        totalNormal + totalRework
                                      ).toLocaleString()}
                                    </td>
                                  </tr>
                                  {chartData.labels.map((label) => {
                                    const d = dayObj[label] || {
                                      normal: 0,
                                      rework: 0,
                                    };
                                    const total = d.normal + d.rework;
                                    if (total === 0) return null;
                                    return (
                                      <tr
                                        key={label}
                                        className="border-b border-slate-100 text-slate-700 dark:border-slate-800 dark:text-slate-300"
                                      >
                                        <td className="py-1.5 pl-6">
                                          {label}
                                        </td>
                                        <td className="px-2 py-1.5 text-right tabular-nums">
                                          {d.normal.toLocaleString()}
                                        </td>
                                        <td className="px-2 py-1.5 text-right tabular-nums">
                                          {d.rework.toLocaleString()}
                                        </td>
                                        <td className="px-2 py-1.5 text-right tabular-nums">
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
                      <div className="mt-4 flex flex-col justify-end gap-2 sm:flex-row sm:gap-3">
                        <button
                          type="button"
                          onClick={openDetailModal}
                          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
                        >
                          {t("workplaceNGChart.viewDetail")}
                        </button>
                        <button
                          type="button"
                          onClick={exportToExcel}
                          disabled={!chartData}
                          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {t("workplaceNGChart.exportExcel")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                      {t("workplaceNGChart.noData")}
                    </p>
                  )}
                </section>
              ) : null}
            </div>
          </div>
        </div>
      </main>
      <DetailedNGModal
        isOpen={isModalOpen}
        onClose={closeDetailModal}
        area={modalArea}
      />
    </div>
  );
}

export default function WorkplaceDashboard({ mode = "normal" }) {
  if (mode === "ng") return <WorkplaceNGView />;
  return <WorkplaceProductionView />;
}

