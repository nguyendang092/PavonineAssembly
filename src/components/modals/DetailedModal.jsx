import React, { useEffect, useState } from "react";
import * as XLSX from "@e965/xlsx";
import { useTranslation } from "react-i18next";
import LoadingBlock from "@/components/ui/LoadingBlock";
import { logUserAction } from "@/utils/userLog";
import { ref, get, child } from "firebase/database";
import { db } from "@/services/firebase";
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
const CHART_PAGE_SIZE = 15;
const TABLE_PAGE_SIZE = 19;

function parseYmdToLocalDate(dateStr) {
  const [year, month, day] = String(dateStr)
    .split("-")
    .map((part) => Number(part));
  return new Date(year, (month || 1) - 1, day || 1);
}

function formatLocalYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getYesterdayLocalYmd() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return formatLocalYmd(date);
}

function getWeekNumber(dateStr) {
  const date = parseYmdToLocalDate(dateStr);
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

function getStartOfWeek(dateStr) {
  const date = parseYmdToLocalDate(dateStr);
  const dayOfWeek = date.getDay();
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  return formatLocalYmd(startOfWeek);
}
import { useUser } from "@/contexts/UserContext";

export default function DetailedModal({ isOpen, onClose, area }) {
  const { t } = useTranslation();
  const { user } = useUser();
  const [selectedArea, setSelectedArea] = useState(area || "Assembly");
  const [selectedModel, setSelectedModel] = useState("");
  const [areas, setAreas] = useState([]);
  const [allDetailData, setAllDetailData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const [chartPage, setChartPage] = useState(1);
  const [forceFetch, setForceFetch] = useState(0); // trigger fetchData khi mở modal
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(getYesterdayLocalYmd());

  const currentWeekStart = getStartOfWeek(selectedDate);
  const currentWeekNumber = getWeekNumber(selectedDate);
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
    if (!selectedArea) return;
    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      // Lọc đúng theo ngày được chọn (không gom cả tuần).
      const targetDate = selectedDate;

      const areaRef = ref(db, `details/${selectedArea}`);
      const snapshot = await get(areaRef);
      if (!isMounted) return;

      const modelMap = new Map(); // Dùng map để cộng dồn sản lượng

      if (snapshot.exists()) {
        const weekData = snapshot.val();
        for (const weekKey in weekData) {
          const models = weekData[weekKey];
          for (const model in models) {
            const modelData = models[model];
            if (modelData[targetDate]) {
              const quantity = modelData[targetDate];
              if (modelMap.has(model)) {
                modelMap.set(model, modelMap.get(model) + quantity);
              } else {
                modelMap.set(model, quantity);
              }
            }
          }
        }
      }

      // Chuyển map thành array details
      const details = Array.from(modelMap, ([model, quantity]) => ({
        model,
        quantity,
        date: targetDate,
      }));

      setAllDetailData(details);
      setLoading(false);
    };
    fetchData();
    return () => {
      isMounted = false;
    };
  }, [selectedArea, selectedDate, forceFetch]);
  const filteredData = allDetailData
    .filter((item) =>
      item.model.toLowerCase().includes(selectedModel.toLowerCase()),
    )
    .sort((a, b) => b.quantity - a.quantity);
  const totalChartPages = Math.max(
    1,
    Math.ceil(filteredData.length / CHART_PAGE_SIZE),
  );
  const pagedChartRows = filteredData.slice(
    (chartPage - 1) * CHART_PAGE_SIZE,
    chartPage * CHART_PAGE_SIZE,
  );
  const totalTablePages = Math.max(
    1,
    Math.ceil(filteredData.length / TABLE_PAGE_SIZE),
  );
  const pagedTableRows = filteredData.slice(
    (tablePage - 1) * TABLE_PAGE_SIZE,
    tablePage * TABLE_PAGE_SIZE,
  );

  // Xuất Excel toàn bộ dữ liệu đang lọc
  const handleExportExcel = () => {
    if (!filteredData.length) return;
    const ws = XLSX.utils.json_to_sheet(
      filteredData.map((item) => ({
        [t("detailedModal.area")]: selectedArea,
        [t("detailedModal.model")]: item.model,
        [t("detailedModal.date")]: item.date,
        [t("detailedModal.quantity")]: item.quantity,
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Details");
    XLSX.writeFile(wb, `details_${selectedArea}_week${currentWeekNumber}.xlsx`);
  };
  const chartData = {
    labels: pagedChartRows.map((item) => item.model),
    datasets: [
      {
        label: "Sản lượng",
        data: pagedChartRows.map((item) => item.quantity),
        backgroundColor: "#7dd3fc",
      },
    ],
  };
  useEffect(() => {
    setChartPage(1);
    setTablePage(1);
  }, [selectedArea, selectedModel, selectedYear, selectedDate]);
  useEffect(() => {
    setChartPage((prev) => Math.min(prev, totalChartPages));
  }, [totalChartPages]);
  useEffect(() => {
    setTablePage((prev) => Math.min(prev, totalTablePages));
  }, [totalTablePages]);
  useEffect(() => {
    if (!isOpen) {
      setAllDetailData([]);
      setSelectedModel("");
      setTablePage(1);
      setChartPage(1);
      setSelectedDate(getYesterdayLocalYmd());
    } else {
      // Reset selectedArea về prop area mỗi lần mở modal
      setSelectedArea(area || "Assembly");
      setSelectedDate(getYesterdayLocalYmd());
      setForceFetch((f) => f + 1); // trigger fetchData lại kể cả khi selectedArea không đổi
      // Ghi log khi mở modal chi tiết sản lượng
      if (user && user.email) {
        logUserAction(
          user.email,
          "view_detail_output",
          `Xem chi tiết sản lượng khu vực: ${
            area || "Assembly"
          }, tuần ${currentWeekNumber}`,
        );
      }
    }
  }, [isOpen, area]);

  // Khóa cuộn nền khi modal mở để tránh scroll lọt ra ngoài.
  useEffect(() => {
    if (!isOpen) return undefined;

    const scrollRoot = document.getElementById("app-main-scroll");
    const prevMainOverflow = scrollRoot?.style.overflow ?? "";
    const prevBodyOverflow = document.body.style.overflow;

    if (scrollRoot) scrollRoot.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      if (scrollRoot) scrollRoot.style.overflow = prevMainOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-4">
      <div className="relative flex min-h-0 max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-300/90 bg-slate-100 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-300/80 bg-gradient-to-b from-slate-200/95 to-slate-100 px-4 py-3 dark:border-slate-800 dark:from-slate-950 dark:to-slate-950 sm:px-5">
          <div className="min-w-0">
            <h2 className="text-base font-bold uppercase text-slate-900 dark:text-slate-50 sm:text-lg">
              {t("detailedModal.title")}
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
              {t("detailedModal.area")}: {selectedArea || "-"} · Tuần{" "}
              {currentWeekNumber}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-600 transition hover:bg-slate-300/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            aria-label={t("detailedModal.close")}
          >
            ✕
          </button>
        </div>

        <div className="shrink-0 border-b border-slate-300/80 bg-slate-50/90 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/95 sm:px-5">
          <div className="grid grid-cols-1 gap-2 xl:grid-cols-6">
            <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 xl:col-span-5 xl:grid-cols-5">
              <div className="flex min-w-0 flex-col">
              <label
                className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
                htmlFor="year-select"
              >
                Năm
              </label>
              <select
                id="year-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/35 dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-100"
              >
                {Array.from(
                  { length: 5 },
                  (_, i) => new Date().getFullYear() - i,
                ).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              </div>

              <div className="flex min-w-0 flex-col">
              <label
                className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
                htmlFor="date-filter"
              >
                Ngày
              </label>
              <input
                id="date-filter"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/35 dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-100"
              />
              </div>

              <div className="flex min-w-0 flex-col">
              <label
                className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
                htmlFor="area-select"
              >
                {t("detailedModal.area")}
              </label>
              <select
                id="area-select"
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/35 dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-100"
              >
                {areas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              </div>

              <div className="flex min-w-0 flex-col">
              <label className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Tuần hiện tại
              </label>
              <div className="rounded-lg border border-slate-300/80 bg-slate-100 px-2.5 py-2 text-xs text-slate-700 dark:border-slate-700/90 dark:bg-slate-800/90 dark:text-slate-200">
                Tuần {currentWeekNumber} ({currentWeekStart})
              </div>
              </div>

              <div className="flex min-w-0 flex-col">
              <label
                className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300"
                htmlFor="model-search"
              >
                {t("detailedModal.model")}
              </label>
              <input
                id="model-search"
                type="text"
                placeholder={t("detailedModal.searchModel")}
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="rounded-lg border border-slate-300/80 bg-slate-50/90 px-2.5 py-2 text-xs text-slate-800 shadow-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/35 dark:border-slate-700/90 dark:bg-slate-900/95 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              </div>
            </div>

            <div className="flex min-w-0 items-end xl:justify-end">
              <button
                onClick={handleExportExcel}
                className="inline-flex h-[34px] w-full items-center justify-center rounded-lg bg-emerald-600 px-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 xl:w-auto"
              >
                {t("detailedModal.exportExcel")}
              </button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 bg-slate-200/35 px-4 py-3 dark:bg-black/35 sm:px-5">
          {loading ? (
            <div className="flex h-full min-h-[220px] items-center justify-center">
              <LoadingBlock
                size="sm"
                message={t("loading.loading")}
                textClassName="text-sm text-slate-500 dark:text-slate-400"
                gapClassName="gap-2"
                className="py-6"
              />
            </div>
          ) : (
            <div className="grid h-full min-h-0 grid-cols-1 gap-3 xl:grid-cols-5">
              <div className="flex h-[640px] min-h-[640px] max-h-[640px] flex-col overflow-hidden rounded-xl bg-slate-100/95 p-3 dark:bg-slate-900/95 xl:col-span-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    Top model theo sản lượng (trang {chartPage}/
                    {totalChartPages})
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setChartPage((p) => Math.max(1, p - 1))}
                      disabled={chartPage === 1}
                      className="rounded-md border border-slate-300/90 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Trước
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setChartPage((p) => Math.min(totalChartPages, p + 1))
                      }
                      disabled={chartPage === totalChartPages}
                      className="rounded-md border border-slate-300/90 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Sau
                    </button>
                  </div>
                </div>
                <div className="relative min-h-0 flex-1">
                  {chartData && chartData.labels.length > 0 ? (
                    <Bar
                      style={{ height: "100%" }}
                      data={{
                        ...chartData,
                        datasets: chartData.datasets.map((ds) => ({
                          ...ds,
                          backgroundColor: "rgba(109, 40, 217, 0.92)",
                          borderWidth: 0,
                          hoverBackgroundColor: "rgba(91, 33, 182, 0.96)",
                        })),
                      }}
                      options={{
                        indexAxis: "y",
                        responsive: true,
                        maintainAspectRatio: false,
                        layout: {
                          padding: { top: 8, right: 14, bottom: 4, left: 2 },
                        },
                        elements: {
                          bar: {
                            borderRadius: 8,
                            borderSkipped: false,
                          },
                        },
                        scales: {
                          x: {
                            beginAtZero: true,
                            ticks: {
                              color: "#1e293b",
                              font: { weight: "400", size: 10 },
                              callback: (value) =>
                                Number(value).toLocaleString(),
                            },
                            grid: {
                              display: false,
                            },
                            border: { display: false },
                            max: (() => {
                              if (
                                !chartData ||
                                !chartData.datasets ||
                                chartData.datasets.length === 0
                              )
                                return undefined;
                              const maxVal = Math.max(
                                ...chartData.datasets[0].data,
                              );
                              return (
                                maxVal + Math.max(25, Math.round(maxVal * 0.08))
                              );
                            })(),
                          },
                          y: {
                            ticks: {
                              color: "#0f172a",
                              font: { weight: "400", size: 10 },
                              callback: (value) => {
                                const label = chartData.labels?.[value] || "";
                                return label.length > 22
                                  ? `${label.slice(0, 22)}...`
                                  : label;
                              },
                            },
                            grid: { display: false },
                            border: { display: false },
                          },
                        },
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            backgroundColor: "rgba(15, 23, 42, 0.96)",
                            titleColor: "#e2e8f0",
                            bodyColor: "#f8fafc",
                            borderColor: "rgba(192, 132, 252, 0.6)",
                            borderWidth: 1,
                            padding: 10,
                            displayColors: false,
                            callbacks: {
                              title: (items) => items?.[0]?.label || "",
                              label: (context) =>
                                `Sản lượng: ${(context.parsed.x || 0).toLocaleString()}`,
                            },
                          },
                          datalabels: {
                            anchor: "end",
                            align: "end",
                            color: "#0f172a",
                            clamp: true,
                            offset: 2,
                            font: { weight: "400", size: 10 },
                            formatter: (value) => value.toLocaleString(),
                          },
                        },
                      }}
                    />
                  ) : (
                    <p className="py-6 text-center text-sm text-slate-600 dark:text-slate-400">
                      {t("detailedModal.noChartData")}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex h-[640px] min-h-[640px] max-h-[640px] min-w-0 flex-col overflow-hidden rounded-xl border border-slate-300/85 bg-slate-100/95 dark:border-slate-700/90 dark:bg-slate-900/95 xl:col-span-2">
                <div className="flex items-center justify-between border-b border-slate-300/80 px-3 py-2 dark:border-slate-700/80">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    Bảng model (trang {tablePage}/{totalTablePages})
                  </p>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                      disabled={tablePage === 1}
                      className="rounded-md border border-slate-300/90 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Trước
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setTablePage((p) => Math.min(totalTablePages, p + 1))
                      }
                      disabled={tablePage === totalTablePages}
                      className="rounded-md border border-slate-300/90 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Sau
                    </button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-auto">
                  <table className="w-full table-fixed border-collapse text-left text-xs text-slate-700 dark:text-slate-200">
                    <thead>
                      <tr className="uppercase">
                        <th className="sticky top-0 z-[1] w-[72px] bg-slate-200/90 px-3 py-2 text-[10px] font-semibold tracking-wide text-slate-700 dark:bg-slate-900/95 dark:text-slate-300">
                          {t("detailedModal.area")}
                        </th>
                        <th className="sticky top-0 z-[1] bg-slate-200/90 px-3 py-2 text-[10px] font-semibold tracking-wide text-slate-700 dark:bg-slate-900/95 dark:text-slate-300">
                          {t("detailedModal.model")}
                        </th>
                        <th className="sticky top-0 z-[1] w-[128px] bg-slate-200/90 px-3 py-2 text-[10px] font-semibold tracking-wide text-slate-700 dark:bg-slate-900/95 dark:text-slate-300">
                          {t("detailedModal.date")}
                        </th>
                        <th className="sticky top-0 z-[1] w-[84px] bg-slate-200/90 px-3 py-2 text-right text-[10px] font-semibold tracking-wide text-slate-800 dark:bg-slate-900/95 dark:text-slate-200">
                          {t("detailedModal.quantity")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedTableRows.map((item, i) => (
                        <tr
                          key={`${item.model}-${tablePage}-${i}`}
                          className="border-b border-slate-100/90 text-[11px] transition hover:bg-sky-50/50 dark:border-slate-700 dark:hover:bg-slate-800/50"
                        >
                          <td className="px-3 py-1.5">{selectedArea}</td>
                          <td
                            className="px-3 py-1.5 truncate"
                            title={item.model}
                          >
                            {item.model}
                          </td>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            {item.date}
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums font-medium text-slate-800 dark:text-slate-100">
                            {item.quantity.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
