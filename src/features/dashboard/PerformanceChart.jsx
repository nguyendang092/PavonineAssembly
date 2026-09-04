import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import LoadingBlock from "@/components/ui/LoadingBlock";
import { db, ref, set } from "@/services/firebase";
import { useUserIdentity, useUserPermissions } from "@/contexts/UserContext";
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
  PerformanceKpiCards,
  PerformanceDataTable,
  PerformanceBarChartCard,
  buildChartRows,
} from "./PerformanceChartParts";
import { PERF_THEME } from "./performanceChartTheme";
import "./performanceChart.css";

function ymdStamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}${mm}${dd}`;
}

export default function PerformanceChart() {
  const { t } = useTranslation();
  const { user } = useUserIdentity();
  const { userRole } = useUserPermissions();
  const canEdit = isAdminAccess(user, userRole);

  const [selectedYear, setSelectedYear] = useState(() =>
    new Date().getFullYear(),
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");

  const { setYearDataStore, data, setData, loading, isRefreshing, refresh } =
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
    void import("html-to-image")
      .then(({ toPng }) =>
        toPng(node, {
          backgroundColor: PERF_THEME.bg,
          pixelRatio: Math.max(2, window.devicePixelRatio || 1),
          cacheBust: true,
          filter: (n) => !(n.dataset && n.dataset.noExport === "true"),
        }),
      )
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
    <div className="perf-board">
      <button
        type="button"
        className="perf-board__mobile-toggle dashboard-no-print"
        onClick={() => setSidebarOpen((o) => !o)}
        aria-expanded={sidebarOpen}
        aria-label={t("workplaceChart.toggleSidebar", "Menu năm")}
      >
        {sidebarOpen ? "✕" : "☰"}
      </button>

      <PerformanceYearSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        years={years}
        selectedYear={selectedYear}
        onSelectYear={setSelectedYear}
        currentCalendarYear={currentCalendarYear}
      />

      <div className="perf-board__main">
        {loading && data.length === 0 ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <LoadingBlock
              size="lg"
              message={t("loading.loading")}
              textClassName="text-lg font-semibold text-[#3FA9E0]"
            />
          </div>
        ) : (
          <>
            <header className="perf-board__topbar">
              <div className="perf-board__topbar-copy">
                <p className="perf-board__eyebrow">
                  {t("performanceChart.sidebarSubtitle")}
                </p>
                <h1 className="perf-board__title">
                  {t("performanceChart.pageTitle", { year: selectedYear })}
                </h1>
                <p className="perf-board__lead">
                  {t("performanceChart.pageSubtitle")}
                </p>
              </div>
              <div className="perf-board__topbar-actions dashboard-no-print">
                <button
                  type="button"
                  onClick={refresh}
                  disabled={loading && data.length === 0}
                  aria-busy={isRefreshing}
                  className="perf-board__btn perf-board__btn--ghost"
                >
                  {isRefreshing
                    ? t("performanceChart.refreshing", "Đang làm mới…")
                    : t("performanceChart.refresh", "Làm mới")}
                </button>
              </div>
            </header>

            <PerformanceKpiCards
              data={data}
              currentWeekNumber={currentWeekNumber}
            />

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
          </>
        )}
      </div>
    </div>
  );
}
