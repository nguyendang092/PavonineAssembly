import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toPng } from "html-to-image";
import LoadingBlock from "@/components/ui/LoadingBlock";
import { db, ref, set } from "@/services/firebase";
import { useUser } from "@/contexts/UserContext";
import { isAdminAccess } from "@/config/authRoles";
import { usePerformanceYearData } from "./usePerformanceYearData";
import {
  getCurrentWeek,
  createTeamTemplate,
  canAddTeamName,
  isRemovableTeam,
} from "@/utils/performanceChartData";
import {
  PerformanceYearSidebar,
  PerformanceDataTable,
  PerformanceBarChartCard,
  buildChartRows,
} from "./PerformanceChartParts";
import "./dashboard.css";

function ymdStamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

export default function PerformanceChart() {
  const { t } = useTranslation();
  const { user, userRole } = useUser();
  const canEdit = isAdminAccess(user, userRole);

  const [selectedYear, setSelectedYear] = useState(() =>
    new Date().getFullYear(),
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");

  const { setYearDataStore, data, setData, loading } =
    usePerformanceYearData(selectedYear);

  const chartRef = useRef(null);
  const cardRef = useRef(null);

  const currentCalendarYear = new Date().getFullYear();
  const currentWeekNumber = getCurrentWeek(selectedYear);

  const years = useMemo(() => {
    const list = [];
    for (let y = 2021; y <= currentCalendarYear + 1; y++) {
      list.push(y);
    }
    return list;
  }, [currentCalendarYear]);

  const chartRows = useMemo(
    () => buildChartRows(data, currentWeekNumber),
    [data, currentWeekNumber],
  );

  useEffect(() => {
    setHasUnsavedChanges(false);
    setNewTeamName("");
  }, [selectedYear]);

  const handleAddTeam = useCallback(() => {
    if (!isAdminAccess(user, userRole)) return;
    const check = canAddTeamName(selectedYear, newTeamName, data);
    if (!check.ok) {
      if (check.reason === "empty") {
        alert("Nhập tên team.");
      } else if (check.reason === "base") {
        alert("Team này đã có trong danh sách mặc định.");
      } else if (check.reason === "duplicate") {
        alert("Team đã tồn tại trong bảng.");
      }
      return;
    }
    setData((prev) => [...prev, createTeamTemplate(check.name)]);
    setNewTeamName("");
    setHasUnsavedChanges(true);
  }, [user, userRole, selectedYear, newTeamName, data, setData]);

  const handleRemoveTeam = useCallback(
    (index) => {
      if (!isAdminAccess(user, userRole)) return;
      const row = data[index];
      if (!row || !isRemovableTeam(selectedYear, row.team)) return;
      if (
        !confirm(
          `Xóa team "${row.team}"? Dữ liệu tuần của team sẽ bị bỏ. Bấm Lưu để cập nhật Firebase.`,
        )
      )
        return;
      setData((prev) => prev.filter((_, i) => i !== index));
      setHasUnsavedChanges(true);
    },
    [user, userRole, data, selectedYear, setData],
  );

  const downloadChartAsSVG = useCallback(() => {
    const container = chartRef.current;
    if (!container) return;
    const svg = container.querySelector("svg");
    if (!svg) return;

    let svgString = new XMLSerializer().serializeToString(svg);
    if (!svgString.startsWith("<?xml")) {
      svgString = `<?xml version="1.0" encoding="UTF-8"?>\n${svgString}`;
    }
    const blob = new Blob([svgString], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.download = `performance-chart-${ymdStamp()}.svg`;
    a.href = url;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const downloadChartAsPNG = useCallback(() => {
    const node = cardRef.current;
    if (!node) return;
    toPng(node, {
      backgroundColor: "#ffffff",
      pixelRatio: Math.max(2, window.devicePixelRatio || 1),
      cacheBust: true,
      filter: (n) => !(n.dataset && n.dataset.noExport === "true"),
    })
      .then((dataUrl) => {
        const a = document.createElement("a");
        a.download = `performance-chart-${ymdStamp()}.png`;
        a.href = dataUrl;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch((err) => {
        console.error("Export PNG failed:", err);
      });
  }, []);

  const handleChange = useCallback(
    (index, field, value) => {
      if (!isAdminAccess(user, userRole)) return;
      setData((prev) => {
        const updated = [...prev];
        if (field === "target") {
          updated[index] = {
            ...updated[index],
            target: Number(value),
          };
        } else if (field.startsWith("W")) {
          updated[index] = {
            ...updated[index],
            weeks: {
              ...updated[index].weeks,
              [field]: Number(value),
            },
          };
        }
        return updated;
      });
      setHasUnsavedChanges(true);
    },
    [user, userRole, setData],
  );

  const handleSaveData = useCallback(async () => {
    if (!isAdminAccess(user, userRole)) {
      alert("Chỉ tài khoản admin mới có quyền lưu dữ liệu.");
      return;
    }
    setSaving(true);
    try {
      const yearRef = ref(db, `performanceData/${selectedYear}`);
      await set(yearRef, data);
      setYearDataStore((prev) => ({
        ...prev,
        [selectedYear]: data,
      }));
      setHasUnsavedChanges(false);
      alert("✅ Đã lưu dữ liệu thành công!");
    } catch (error) {
      console.error("Error saving to Firebase:", error);
      alert("❌ Lỗi khi lưu dữ liệu!");
    } finally {
      setSaving(false);
    }
  }, [user, userRole, selectedYear, data, setYearDataStore]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#eef4ff] dark:bg-slate-950 md:flex-row">
      <PerformanceYearSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        years={years}
        selectedYear={selectedYear}
        onSelectYear={setSelectedYear}
        currentCalendarYear={currentCalendarYear}
      />

      <button
        type="button"
        onClick={() => setSidebarOpen((o) => !o)}
        aria-expanded={sidebarOpen}
        aria-label={t("workplaceChart.toggleSidebar")}
        className="dashboard-no-print fixed left-4 top-20 z-50 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-md transition hover:bg-slate-50 hover:shadow-lg focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
      >
        {sidebarOpen ? "✕" : "☰"}
      </button>

      <div
        className={`dashboard-print-fill flex-1 overflow-hidden p-2 transition-all duration-300 md:p-4 ${
          sidebarOpen ? "ml-72" : "ml-0"
        }`}
      >
        {loading ? (
          <div className="flex h-full min-h-[40vh] items-center justify-center">
            <LoadingBlock
              size="lg"
              message={t("loading.loading")}
              textClassName="text-lg font-semibold text-blue-700 dark:text-blue-300"
            />
          </div>
        ) : (
          <div className="mx-auto flex h-full max-w-7xl flex-col">
            <header className="dashboard-report-surface mb-3 rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-3 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900/90 md:mb-4 md:px-6 md:py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-700 dark:text-sky-400">
                {t("performanceChart.sidebarSubtitle")}
              </p>
              <h1 className="mt-1 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50 md:text-2xl">
                {t("performanceChart.pageTitle", { year: selectedYear })}
              </h1>
              <p className="mx-auto mt-1 max-w-2xl text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                {t("performanceChart.pageSubtitle")}
              </p>
            </header>

            <PerformanceDataTable
              data={data}
              currentWeekNumber={currentWeekNumber}
              selectedYear={selectedYear}
              canEdit={canEdit}
              hasUnsavedChanges={hasUnsavedChanges}
              saving={saving}
              onSave={handleSaveData}
              onChangeCell={handleChange}
              newTeamName={newTeamName}
              onNewTeamNameChange={setNewTeamName}
              onAddTeam={handleAddTeam}
              onRemoveTeam={handleRemoveTeam}
            />

            <PerformanceBarChartCard
              cardRef={cardRef}
              chartRef={chartRef}
              chartRows={chartRows}
              onDownloadPng={downloadChartAsPNG}
              onDownloadSvg={downloadChartAsSVG}
            />
          </div>
        )}
      </div>
    </div>
  );
}
