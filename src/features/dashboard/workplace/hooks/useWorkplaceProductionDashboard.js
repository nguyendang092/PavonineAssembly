import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import * as XLSX from "@e965/xlsx";
import { useTranslation } from "react-i18next";
import { ref, update, get } from "firebase/database";
import { db } from "@/services/firebase";
import { useUserIdentity } from "@/contexts/UserContext";
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
import { getCurrentWeekNumber } from "../lib/constants";
import { DEFAULT_WORKPLACE_PRODUCTION_PATHS } from "../workplaceProductionPaths";
import {
  buildWorkplaceAreaMetrics,
  resolveWorkplaceAreaTheme,
  resolveWorkplaceNgLineTheme,
} from "../lib/workplaceAreaTheme";

/**
 * State + effects + handlers sản lượng workplace — logic giữ nguyên WorkplaceDashboard.
 * @param {import("../workplaceProductionPaths").WorkplaceProductionPaths} [pathsConfig]
 */
export function useWorkplaceProductionDashboard(
  pathsConfig = DEFAULT_WORKPLACE_PRODUCTION_PATHS,
) {
  const { user } = useUserIdentity();
  const { t } = useTranslation();
  const userEmailKey = useMemo(
    () => user?.email?.trim().toLowerCase() || "anonymous",
    [user?.email],
  );

  const [workplaceAreaOrder, setWorkplaceAreaOrder] = useState([]);
  const [workplaceDragOverArea, setWorkplaceDragOverArea] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalArea, setModalArea] = useState("");
  const [weekData, setWeekData] = useState({});
  const [selectedWeek, setSelectedWeek] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [chartData, setChartData] = useState(null);
  const [dataMap, setDataMap] = useState({});
  const [rawData, setRawData] = useState(null);
  const [isReadingTotalFile, setIsReadingTotalFile] = useState(false);
  const [isReadingDetailFile, setIsReadingDetailFile] = useState(false);
  const [isUploadingTotal, setIsUploadingTotal] = useState(false);
  const [isUploadingDetail, setIsUploadingDetail] = useState(false);
  const [isUploadingNgFaulty, setIsUploadingNgFaulty] = useState(false);
  const totalFileInputRef = useRef(null);
  const detailFileInputRef = useRef(null);
  const ngFaultyFileInputRef = useRef(null);

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

  const openDetailModal = useCallback(
    (area) => {
      setModalArea(area || chartData?.areas?.[0] || "Assembly");
      setIsModalOpen(true);
    },
    [chartData?.areas],
  );

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
      const file = e.target.files?.[0];
      if (!file) return;
      if (isReadingTotalFile || isUploadingTotal) return;

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
        await uploadToFirebase(jsonData);
        alert(t("workplaceChart.uploadSuccess"));
      } catch (err) {
        alert(
          t("workplaceChart.uploadError") + (err?.message || "Không thể xử lý file"),
        );
      } finally {
        setIsReadingTotalFile(false);
        if (e.target) e.target.value = "";
      }
    },
    [
      isReadingTotalFile,
      isUploadingTotal,
      processExcelData,
      selectedYear,
      uploadToFirebase,
      t,
    ],
  );

  const persistDetailRowsToFirebase = useCallback(
    async (rows) => {
      if (isUploadingDetail) return;
      if (!rows?.length) {
        throw new Error("File Excel không có dữ liệu");
      }

      setIsUploadingDetail(true);

      try {
        const chunkSize = 500;
        let hasValidData = false;

        for (let i = 0; i < rows.length; i += chunkSize) {
          await new Promise((resolve) => setTimeout(resolve, 0));

          const chunk = rows.slice(i, i + chunkSize);
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
          throw new Error("Không có dữ liệu hợp lệ để upload");
        }

        if (user && user.email) {
          await logUserAction(
            user.email,
            "upload_detail_output",
            `Upload chi tiết sản lượng tuần ${selectedWeek}`,
          );
        }
      } finally {
        setIsUploadingDetail(false);
      }
    },
    [isUploadingDetail, selectedWeek, user, pathsConfig.detailsRoot],
  );

  const handleDetailUpload = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (isReadingDetailFile || isUploadingDetail) return;

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
        await persistDetailRowsToFirebase(jsonData);
        alert(t("workplaceChart.uploadSuccess"));
      } catch (err) {
        alert(
          t("workplaceChart.uploadError") + (err?.message || "Không thể xử lý file"),
        );
      } finally {
        setIsReadingDetailFile(false);
        if (e.target) e.target.value = "";
      }
    },
    [isReadingDetailFile, isUploadingDetail, persistDetailRowsToFirebase, t],
  );

  const handleNgFaultyFileUpload = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (isUploadingNgFaulty) return;

      try {
        await uploadNgFaultyExcel(file, {
          db,
          user,
          logUserAction,
          onLoading: setIsUploadingNgFaulty,
          ngRoot: pathsConfig.ngRoot,
        });
      } catch {
        // uploadNgFaultyExcel đã hiển thị alert lỗi
      } finally {
        if (e.target) e.target.value = "";
      }
    },
    [isUploadingNgFaulty, user, pathsConfig.ngRoot],
  );

  useEffect(() => {
    const { chartData: nextChart, dataMap: nextMap } = buildChartFromWeekRows(
      selectedWeek,
      weekData,
    );
    setChartData(nextChart);
    setDataMap(nextMap);
  }, [selectedWeek, weekData]);

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

  const areaMetricsByArea = useMemo(
    () =>
      buildWorkplaceAreaMetrics(
        chartData,
        dataMap,
        dayNormalTotal,
        dayNGTotal,
        formatDayLabelShort,
      ),
    [chartData, dataMap],
  );

  const areaComboDataByArea = useMemo(() => {
    if (!chartData?.labels?.length || !chartData?.areas?.length) return {};
    const ngLine = resolveWorkplaceNgLineTheme();
    const barValueDatalabels = {
      display: false,
      anchor: "end",
      align: "bottom",
      offset: -16,
      clip: false,
      color: "#111827",
      font: {
        size: 12,
        weight: "600",
        family: '"Inter", "Segoe UI", ui-sans-serif, system-ui, sans-serif',
      },
    };
    const out = {};
    chartData.areas.forEach((area) => {
      const dayArr = dataMap[area];
      const labels = chartData.labels;
      const normals = labels.map((_, idx) => dayNormalTotal(area, dayArr, idx));
      const ngs = labels.map((_, idx) => dayNGTotal(area, dayArr, idx));
      const shortLabels = labels.map(formatDayLabelShort);
      const theme = resolveWorkplaceAreaTheme(area);
      out[area] = {
        labels: shortLabels,
        datasets: [
          {
            type: "bar",
            label: t("workplaceChart.comboBarLabel"),
            data: normals,
            order: 1,
            backgroundColor: theme.bar,
            borderColor: theme.barBorder,
            borderWidth: 0,
            borderRadius: 4,
            borderSkipped: false,
            maxBarThickness: 28,
            yAxisID: "y",
            datalabels: barValueDatalabels,
          },
          {
            type: "line",
            label: t("workplaceChart.comboLineLabel"),
            data: ngs,
            order: 2,
            borderColor: ngLine.color,
            backgroundColor: ngLine.fill,
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: ngLine.color,
            pointBorderColor: "#fff",
            pointBorderWidth: 2,
            yAxisID: "y1",
            borderWidth: 2.5,
            fill: false,
            datalabels: {
              display: false,
            },
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
      transitions: {
        resize: {
          animation: {
            duration: 0,
          },
        },
      },
      interaction: { mode: "index", intersect: false },
      layout: {
        padding: { top: 42, right: 4, bottom: 8, left: 2 },
      },
      plugins: {
        legend: {
          position: "bottom",
          align: "center",
          labels: {
            boxWidth: 8,
            boxHeight: 8,
            padding: 6,
            usePointStyle: true,
            pointStyle: "rectRounded",
            font: {
              size: 10,
              weight: "500",
              family: '"Inter", ui-sans-serif, system-ui, sans-serif',
            },
            color: "#64748b",
          },
          padding: { top: 6, bottom: 0 },
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
            if (ctx.dataset.type === "line") return false;
            const v = Number(ctx.dataset.data[ctx.dataIndex]);
            return Number.isFinite(v) && v > 0;
          },
          clamp: false,
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
            font: {
              size: 11,
              weight: "700",
              family: '"IBM Plex Mono", ui-monospace, monospace',
            },
            color: "#0f172a",
            padding: 14,
          },
        },
        y: {
          type: "linear",
          position: "left",
          title: { display: false },
          border: { display: false },
          grid: { display: false },
          ticks: {
            font: {
              size: 9,
              weight: "500",
              family: '"IBM Plex Mono", ui-monospace, monospace',
            },
            color: "#64748b",
            padding: 6,
            maxTicksLimit: 5,
          },
          beginAtZero: true,
          grace: "12%",
        },
        y1: {
          type: "linear",
          position: "right",
          title: { display: false },
          border: { display: false },
          grid: { display: false, drawOnChartArea: false },
          ticks: {
            display: false,
          },
          beginAtZero: true,
          grace: "12%",
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

  return {
    t,
    user,
    workplaceDragOverArea,
    setWorkplaceDragOverArea,
    isModalOpen,
    modalArea,
    closeDetailModal,
    weekData,
    selectedWeek,
    setSelectedWeek,
    selectedYear,
    setSelectedYear,
    chartData,
    dataMap,
    isReadingTotalFile,
    isReadingDetailFile,
    isUploadingTotal,
    isUploadingDetail,
    isUploadingNgFaulty,
    totalFileInputRef,
    detailFileInputRef,
    ngFaultyFileInputRef,
    handleFileUpload,
    handleDetailUpload,
    handleNgFaultyFileUpload,
    openDetailModal,
    dashboardStats,
    weekMeta,
    areaComboDataByArea,
    areaMetricsByArea,
    comboChartOptions,
    chartAreasOrdered,
    handleWorkplaceAreaReorder,
    getCurrentWeekNumber,
  };
}
