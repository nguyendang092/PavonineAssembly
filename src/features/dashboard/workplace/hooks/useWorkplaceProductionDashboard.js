import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import * as XLSX from "@e965/xlsx";
import { useTranslation } from "react-i18next";
import { ref, update, get } from "firebase/database";
import { db } from "@/services/firebase";
import { useUser } from "@/contexts/UserContext";
import { logUserAction } from "@/utils/userLog";
import { uploadNgFaultyExcel } from "../../ngWorkplaceUpload";
import {
  hydrateChartOrder,
  persistChartOrder,
  applySavedKeyOrder,
  moveKeyBefore,
} from "@/utils/chartOrderStorage";
import { barSnapshotToRows, sanitizeFirebaseKey } from "../lib/barFirebase";
import { buildWeekDataFromRows } from "../lib/processExcelData";
import { buildChartFromWeekRows } from "../lib/buildChartFromWeekRows";
import { dayNormalTotal, dayNGTotal, formatDayLabelShort } from "../lib/dayTotals";
import { exportProductionToExcel } from "../lib/exportProductionExcel";
import { getCurrentWeekNumber } from "../lib/constants";
import { DEFAULT_WORKPLACE_PRODUCTION_PATHS } from "../workplaceProductionPaths";

/**
 * State + effects + handlers sản lượng workplace — logic giữ nguyên WorkplaceDashboard.
 * @param {import("../workplaceProductionPaths").WorkplaceProductionPaths} [pathsConfig]
 */
export function useWorkplaceProductionDashboard(
  pathsConfig = DEFAULT_WORKPLACE_PRODUCTION_PATHS,
) {
  const { user } = useUser();
  const { t } = useTranslation();
  const userEmailKey = useMemo(
    () => user?.email?.trim().toLowerCase() || "anonymous",
    [user?.email],
  );

  const [workplaceAreaOrder, setWorkplaceAreaOrder] = useState([]);
  const [workplaceDragOverArea, setWorkplaceDragOverArea] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalArea, setModalArea] = useState("");
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
  const [pendingNgFaultyFile, setPendingNgFaultyFile] = useState(null);
  const [isUploadingNgFaulty, setIsUploadingNgFaulty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const order = await hydrateChartOrder(
        userEmailKey,
        pathsConfig.chartOrderKind,
      );
      if (!cancelled) setWorkplaceAreaOrder(order);
    })();
    return () => {
      cancelled = true;
    };
  }, [userEmailKey, pathsConfig.chartOrderKind]);

  useEffect(() => {
    if (!dataTableOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setDataTableOpen(false);
    };
    window.addEventListener("keydown", onKey);

    const scrollRoot = document.getElementById("app-main-scroll");
    const prevMainOverflow = scrollRoot?.style.overflow ?? "";
    const prevBodyOverflow = document.body.style.overflow;
    if (scrollRoot) scrollRoot.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      if (scrollRoot) scrollRoot.style.overflow = prevMainOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, [dataTableOpen]);

  const processExcelData = useCallback((data, filterYear) => {
    const { grouped, selectedWeekKey } = buildWeekDataFromRows(data, filterYear);
    setWeekData(grouped);
    setSelectedWeek(selectedWeekKey);
  }, []);

  useEffect(() => {
    const loadDataFromFirebase = async () => {
      try {
        const barRef = ref(db, pathsConfig.barRoot);
        const snapshot = await get(barRef);
        if (!snapshot.exists()) {
          return;
        }
        const barData = snapshot.val();
        const rows = barSnapshotToRows(barData);
        setRawData(rows);
        processExcelData(rows, selectedYear);
      } catch (error) {
        console.error("Lỗi load dữ liệu Firebase:", error);
        alert("Lỗi load dữ liệu Firebase: " + error.message);
      }
    };
    loadDataFromFirebase();
  }, [selectedYear, processExcelData, pathsConfig.barRoot]);

  const openDetailModal = useCallback((area) => {
    setDataTableOpen(false);
    setModalArea(area);
    setIsModalOpen(true);
  }, []);

  const closeDetailModal = useCallback(() => setIsModalOpen(false), []);

  const uploadToFirebase = useCallback(
    async (data) => {
      if (isUploadingTotal) return;
      setIsUploadingTotal(true);

      try {
        if (user && user.email) {
          await logUserAction(
            user.email,
            "upload_total_output",
            `Upload tổng sản lượng tuần ${selectedWeek}`,
          );
        }

        const chunkSize = 500;

        for (let i = 0; i < data.length; i += chunkSize) {
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

            const safeWorkplaceName = sanitizeFirebaseKey(WorkplaceName);
            const pathGood = `${pathsConfig.barRoot}/${safeWorkplaceName}/${Week}/${ReworkorNot}/${time_monthday}/${WorkingLight}/Total_Good`;
            const pathNG = `${pathsConfig.barRoot}/${safeWorkplaceName}/${Week}/${ReworkorNot}/${time_monthday}/${WorkingLight}/Total_NG`;
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
    },
    [isUploadingTotal, selectedWeek, user, pathsConfig.barRoot],
  );

  const handleFileUpload = useCallback(
    async (e) => {
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
    },
    [isReadingTotalFile, processExcelData, selectedYear],
  );

  const handleDetailUpload = useCallback(
    async (e) => {
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
    },
    [isReadingDetailFile],
  );

  const handleDetailUploadToFirebase = useCallback(async () => {
    if (!detailData) {
      alert("❗ Vui lòng chọn file chi tiết trước khi upload.");
      return;
    }
    if (isUploadingDetail) return;

    setIsUploadingDetail(true);

    try {
      const chunkSize = 500;
      let hasValidData = false;

      for (let i = 0; i < detailData.length; i += chunkSize) {
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

          const safeArea = sanitizeFirebaseKey(area);
          const safeModel = sanitizeFirebaseKey(model);
          const path = `${pathsConfig.detailsRoot}/${safeArea}/${week}/${safeModel}/${date}`;
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
  }, [detailData, isUploadingDetail, selectedWeek, user, pathsConfig.detailsRoot]);

  useEffect(() => {
    const { chartData: nextChart, dataMap: nextMap } = buildChartFromWeekRows(
      selectedWeek,
      weekData,
    );
    setChartData(nextChart);
    setDataMap(nextMap);
  }, [selectedWeek, weekData]);

  const exportToExcel = useCallback(() => {
    exportProductionToExcel({
      chartData,
      dataMap,
      selectedArea,
      selectedWeek,
    });
  }, [chartData, dataMap, selectedArea, selectedWeek]);

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
      chartData.labels.forEach((_label, idx) => {
        totalNormal += dayNormalTotal(area, dayArr, idx);
        totalNGSum += dayNGTotal(area, dayArr, idx);
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
            order: 1,
            backgroundColor: "rgba(14, 165, 233, 0.82)",
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
            order: 2,
            borderColor: "rgb(225, 29, 72)",
            backgroundColor: "rgba(225, 29, 72, 0.06)",
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: "rgb(225, 29, 72)",
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            yAxisID: "y1",
            borderWidth: 3,
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
        padding: { top: 16, right: 4, bottom: 0, left: 2 },
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
        workplaceComboLineOnTop: true,
        datalabels: {
          display: (ctx) => {
            const v = Number(ctx.dataset.data[ctx.dataIndex]);
            return Number.isFinite(v) && v > 0;
          },
          anchor: (ctx) => (ctx.dataset.type === "line" ? "center" : "end"),
          align: (ctx) => (ctx.dataset.type === "line" ? "top" : "end"),
          offset: (ctx) => (ctx.dataset.type === "line" ? 5 : 2),
          clamp: true,
          color: (ctx) =>
            ctx.dataset.type === "line"
              ? "rgb(225, 29, 72)"
              : "rgb(2, 132, 199)",
          font: { size: 9, weight: "700" },
          formatter: (value) => {
            const n = Number(value);
            return Number.isFinite(n) && n > 0 ? n.toLocaleString() : "";
          },
        },
      },
      scales: {
        x: {
          border: { display: false },
          grid: { display: false, drawTicks: false },
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
          grid: { display: false },
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
          grid: { display: false, drawOnChartArea: false },
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

  const chartAreasOrdered = useMemo(() => {
    if (!chartData?.areas?.length) return [];
    return applySavedKeyOrder(
      chartData.areas,
      workplaceAreaOrder,
      (a, b) =>
        String(a).localeCompare(String(b), undefined, { sensitivity: "base" }),
    );
  }, [chartData?.areas, workplaceAreaOrder]);

  const handleWorkplaceAreaReorder = useCallback(
    (fromArea, toArea) => {
      if (!fromArea || !toArea || fromArea === toArea) return;
      const base = chartData?.areas || [];
      const ordered = applySavedKeyOrder(
        base,
        workplaceAreaOrder,
        (a, b) =>
          String(a).localeCompare(String(b), undefined, { sensitivity: "base" }),
      );
      const next = moveKeyBefore(ordered, fromArea, toArea);
      setWorkplaceAreaOrder(next);
      void persistChartOrder(
        userEmailKey,
        pathsConfig.chartOrderKind,
        next,
      );
    },
    [chartData?.areas, workplaceAreaOrder, userEmailKey, pathsConfig.chartOrderKind],
  );

  const handleNgFaultyUpload = useCallback(() => {
    if (isUploadingNgFaulty) return;
    if (!pendingNgFaultyFile) {
      alert(t("workplaceChart.pleaseSelectNgExcel"));
      return;
    }
    uploadNgFaultyExcel(pendingNgFaultyFile, {
      db,
      user,
      logUserAction,
      onLoading: setIsUploadingNgFaulty,
      ngRoot: pathsConfig.ngRoot,
    })
      .then(() => setPendingNgFaultyFile(null))
      .catch(() => {});
  }, [isUploadingNgFaulty, pendingNgFaultyFile, t, user, pathsConfig.ngRoot]);

  const handleTotalUploadClick = useCallback(() => {
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
  }, [
    isUploadingTotal,
    isReadingTotalFile,
    rawData,
    uploadToFirebase,
    t,
  ]);

  return {
    t,
    user,
    workplaceDragOverArea,
    setWorkplaceDragOverArea,
    isModalOpen,
    modalArea,
    closeDetailModal,
    selectedArea,
    setSelectedArea,
    weekData,
    selectedWeek,
    setSelectedWeek,
    selectedYear,
    setSelectedYear,
    chartData,
    dataMap,
    tableView,
    setTableView,
    dataTableOpen,
    setDataTableOpen,
    sidebarOpen,
    setSidebarOpen,
    isReadingTotalFile,
    isReadingDetailFile,
    isUploadingTotal,
    isUploadingDetail,
    totalFileInputRef,
    detailFileInputRef,
    pendingNgFaultyFile,
    setPendingNgFaultyFile,
    isUploadingNgFaulty,
    handleFileUpload,
    handleDetailUpload,
    handleDetailUploadToFirebase,
    openDetailModal,
    exportToExcel,
    dashboardStats,
    weekMeta,
    areaComboDataByArea,
    comboChartOptions,
    chartAreasOrdered,
    handleWorkplaceAreaReorder,
    handleNgFaultyUpload,
    handleTotalUploadClick,
    getCurrentWeekNumber,
    detailData,
    rawData,
    uploadToFirebase,
  };
}
