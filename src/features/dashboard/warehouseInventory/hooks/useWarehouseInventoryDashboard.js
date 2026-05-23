import { useMemo, useState, useCallback, useEffect, useDeferredValue } from "react";
import { useTranslation } from "react-i18next";
import { db, ref, get, set } from "@/services/firebase";
import {
  WAREHOUSE_INV_CHART_COLORS,
  WAREHOUSE_INV_LATEST_PATH,
  WAREHOUSE_INV_TABLE_PAGE_SIZE,
} from "../lib/constants";
import {
  computeWarehouseInventoryStats,
  dominantMonthLabel,
  parseWarehouseInventoryFile,
} from "../lib/parse";
import { buildStructuredMonthCodeRows } from "../lib/buildStructuredRows";
import {
  filterAndSortStructuredRows,
  summarizeStructuredRows,
} from "../lib/filterStructuredRows";
import { makeWarehouseInvAmountBarGradient } from "../lib/chartBarGradient";

export function useWarehouseInventoryDashboard() {
  const { t } = useTranslation();
  const tl = useCallback(
    (key, defaultValue, opts) =>
      t(`warehouseDashboard.${key}`, { defaultValue, ...opts }),
    [t],
  );

  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [whFilter, setWhFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [codeSearch, setCodeSearch] = useState("");
  const deferredCodeSearch = useDeferredValue(codeSearch);
  const [hideZeroMonthlyDiff, setHideZeroMonthlyDiff] = useState(false);
  const [hideZeroActualQty, setHideZeroActualQty] = useState(false);
  const [softSortMode, setSoftSortMode] = useState("month");
  const [tablePage, setTablePage] = useState(1);
  const [hasTriedCloudLoad, setHasTriedCloudLoad] = useState(false);

  // Khi đổi mode "soft", reset về trang 1 để người dùng thấy thay đổi ngay.
  useEffect(() => {
    setTablePage(1);
  }, [softSortMode]);

  const loadLatestSnapshotFromCloud = useCallback(async () => {
    try {
      const snap = await get(ref(db, WAREHOUSE_INV_LATEST_PATH));
      const payload = snap?.val?.();
      const cloudRows = Array.isArray(payload?.rows) ? payload.rows : [];
      if (cloudRows.length === 0) return false;
      setRows(cloudRows);
      setFileName(String(payload?.fileName ?? "").trim() || "Cloud Snapshot");
      setWhFilter("");
      return true;
    } catch (err) {
      console.error("loadLatestSnapshotFromCloud failed:", err);
      return false;
    }
  }, []);

  useEffect(() => {
    if (hasTriedCloudLoad) return;
    setHasTriedCloudLoad(true);
    loadLatestSnapshotFromCloud();
  }, [hasTriedCloudLoad, loadLatestSnapshotFromCloud]);

  const filteredRows = useMemo(() => {
    if (!whFilter) return rows;
    return rows.filter(
      (r) => String(r.whCode ?? r.warehouseName ?? "").trim() === whFilter,
    );
  }, [rows, whFilter]);

  const stats = useMemo(
    () => computeWarehouseInventoryStats(filteredRows),
    [filteredRows],
  );

  const fallbackMonthForRows = useMemo(() => {
    const d = dominantMonthLabel(filteredRows);
    if (d) return d;
    const pl = String(stats.periodLabel ?? "").trim();
    if (pl && !pl.includes("·")) return pl;
    return "";
  }, [filteredRows, stats.periodLabel]);

  const analysisRows = useMemo(() => {
    if (filteredRows.length === 0) return [];
    return filteredRows.map((r) => ({
      ...r,
      month: String(r.month ?? "").trim() || fallbackMonthForRows,
    }));
  }, [filteredRows, fallbackMonthForRows]);

  const structuredMonthCodeRows = useMemo(
    () => buildStructuredMonthCodeRows(analysisRows),
    [analysisRows],
  );

  const categoryOptions = useMemo(() => {
    const s = new Set();
    for (const r of structuredMonthCodeRows) s.add(r.category);
    return [...s].sort((a, b) => a.localeCompare(b, "vi"));
  }, [structuredMonthCodeRows]);

  const monthTableOptions = useMemo(() => {
    const map = new Map();
    for (const r of structuredMonthCodeRows) {
      if (!map.has(r.monthKey)) map.set(r.monthKey, r.month);
    }
    return [...map.entries()]
      .sort(([a], [b]) => String(a).localeCompare(String(b)))
      .map(([value, label]) => ({ value, label }));
  }, [structuredMonthCodeRows]);

  const filteredStructuredRows = useMemo(
    () =>
      filterAndSortStructuredRows(structuredMonthCodeRows, {
        whFilter,
        categoryFilter,
        monthFilter,
        codeSearch: deferredCodeSearch,
        hideZeroMonthlyDiff,
        hideZeroActualQty,
        softSortMode,
      }),
    [
      structuredMonthCodeRows,
      whFilter,
      categoryFilter,
      monthFilter,
      deferredCodeSearch,
      hideZeroMonthlyDiff,
      hideZeroActualQty,
      softSortMode,
    ],
  );

  const structuredSummary = useMemo(
    () => summarizeStructuredRows(filteredStructuredRows),
    [filteredStructuredRows],
  );

  const WAREHOUSE_INV_TABLE_PAGE_SIZE = 100;
  const tableTotalPages = Math.max(
    1,
    Math.ceil(filteredStructuredRows.length / WAREHOUSE_INV_TABLE_PAGE_SIZE),
  );

  useEffect(() => {
    setTablePage((p) => Math.min(Math.max(1, p), tableTotalPages));
  }, [tableTotalPages]);

  const pagedStructuredRows = useMemo(() => {
    const start = (tablePage - 1) * WAREHOUSE_INV_TABLE_PAGE_SIZE;
    return filteredStructuredRows.slice(start, start + WAREHOUSE_INV_TABLE_PAGE_SIZE);
  }, [filteredStructuredRows, tablePage]);

  const codeDiffSoftScale = useMemo(() => {
    const maxAbs = filteredStructuredRows.reduce(
      (mx, r) => Math.max(mx, Math.abs(r.codeDelta ?? 0)),
      0,
    );
    return maxAbs > 0 ? maxAbs : 1;
  }, [filteredStructuredRows]);

  const overviewTopCodeDiffChart = useMemo(() => {
    const map = new Map();
    for (const r of filteredStructuredRows) {
      if (!map.has(r.code)) map.set(r.code, 0);
      map.set(r.code, (map.get(r.code) || 0) + (r.monthlyDiff ?? 0));
    }
    const top = [...map.entries()]
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 15);
    return {
      labels: top.map(([code]) =>
        code === "∅" ? tl("codeEmptyLabel", "(코드 없음)") : code,
      ),
      datasets: [
        {
          label: tl("topCodeByGapLabel", "코드별 GAP"),
          data: top.map(([, v]) => v),
          backgroundColor: top.map(([, v]) =>
            v >= 0 ? "rgba(37,99,235,0.88)" : "rgba(220,38,38,0.88)",
          ),
          borderColor: top.map(([, v]) =>
            v >= 0 ? "rgba(219,234,254,0.98)" : "rgba(254,226,226,0.98)",
          ),
          borderWidth: 2,
          borderRadius: 10,
          borderSkipped: false,
        },
      ],
    };
  }, [filteredStructuredRows, tl]);

  /**
   * TOP mã có «tiền chênh lệch» lớn nhất (theo |gapAmount|) — bar ngang. Dùng
   * |gapAmount| để cột luôn mọc trái → phải; gradient indigo / hồng đỏ tăng độ
   * sang trọng. Giá trị có dấu giữ trong `signedValues` để tooltip / datalabel
   * hiển thị âm/dương.
   */
  const overviewTopCodeAmountChart = useMemo(() => {
    const map = new Map();
    for (const r of filteredStructuredRows) {
      const amt = typeof r.gapAmount === "number" ? r.gapAmount : 0;
      if (!map.has(r.code)) map.set(r.code, 0);
      map.set(r.code, (map.get(r.code) || 0) + amt);
    }
    const top = [...map.entries()]
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 15);
    const signedValues = top.map(([, v]) => v);

    return {
      labels: top.map(([code]) =>
        code === "∅" ? tl("codeEmptyLabel", "(코드 없음)") : code,
      ),
      signedValues,
      datasets: [
        {
          label: tl("topCodeByAmountLabel", "Tiền chênh lệch theo mã"),
          data: signedValues.map((v) => Math.abs(v)),
          signedValues,
          backgroundColor: (ctx) =>
            makeWarehouseInvAmountBarGradient(ctx.chart, signedValues[ctx.dataIndex] < 0),
          hoverBackgroundColor: (ctx) =>
            makeWarehouseInvAmountBarGradient(ctx.chart, signedValues[ctx.dataIndex] < 0),
          borderColor: signedValues.map((v) =>
            v >= 0 ? "rgba(67, 56, 202, 0.95)" : "rgba(159, 18, 57, 0.95)",
          ),
          borderWidth: 1.5,
          borderRadius: 10,
          borderSkipped: false,
          maxBarThickness: 30,
        },
      ],
    };
  }, [filteredStructuredRows, tl]);

  const overviewTopCodeAmountChartHeightPx = useMemo(() => {
    const n = overviewTopCodeAmountChart.labels.length;
    if (n === 0) return 180;
    return Math.min(420, Math.max(180, 36 + n * 24));
  }, [overviewTopCodeAmountChart.labels.length]);

  const warehouseOptions = useMemo(() => {
    const keys = new Set();
    for (const r of rows) {
      const w = String(r.whCode ?? r.warehouseName ?? "").trim();
      if (w) keys.add(w);
    }
    return [...keys].sort((a, b) => a.localeCompare(b, "vi"));
  }, [rows]);

  const statusChart = useMemo(() => {
    const labels = [...stats.statusCounts.keys()];
    const values = labels.map((k) => stats.statusCounts.get(k) || 0);
    return {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: labels.map(
            (_, i) => `${WAREHOUSE_INV_CHART_COLORS[i % WAREHOUSE_INV_CHART_COLORS.length]}dd`,
          ),
          borderWidth: 3,
          borderColor: "#ffffff",
          hoverBorderWidth: 3,
          hoverOffset: 6,
        },
      ],
    };
  }, [stats.statusCounts]);

  const whBar = useMemo(() => {
    const entries = [...stats.warehouseValue.entries()]
      .filter(([k]) => k && k !== "—")
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    const labels = entries.map(([k]) => k);
    const data = entries.map(([, v]) => v);
    return {
      labels,
      datasets: [
        {
          label: tl("chartWhValue", "재고금액(실사)"),
          data,
          backgroundColor: "#64748b",
          borderColor: "#475569",
          borderWidth: 1,
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 32,
        },
      ],
    };
  }, [stats.warehouseValue, tl]);

  const whBarChartHeightPx = useMemo(() => {
    const n = whBar.labels.length;
    if (n === 0) return 180;
    return Math.min(300, Math.max(180, 36 + n * 24));
  }, [whBar.labels.length]);

  const handleFile = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setError("");
      setLoading(true);
      try {
        const parsed = await parseWarehouseInventoryFile(file);
        setRows(parsed.rows);
        setFileName(file.name);
        setWhFilter("");
        try {
          await set(ref(db, WAREHOUSE_INV_LATEST_PATH), {
            savedAt: new Date().toISOString(),
            fileName: file.name,
            rows: parsed.rows,
          });
        } catch (saveErr) {
          console.error("saveLatestSnapshotToCloud failed:", saveErr);
        }
      } catch (err) {
        console.error(err);
        const code = err instanceof Error ? err.message : "";
        if (code === "MISSING_ACTUAL_COLUMN") {
          setError(
            tl(
              "errorMissingActual",
              "«THỰC TẾ»/실사수량 열을 찾을 수 없습니다. 파일 헤더를 확인하세요.",
            ),
          );
        } else if (code === "EMPTY_SHEET") {
          setError(tl("errorEmpty", "Sheet trống hoặc không có dữ liệu."));
        } else {
          setError(
            tl(
              "errorParse",
              "파일을 읽을 수 없습니다. 올바른 .xlsx 형식을 선택하세요.",
            ),
          );
        }
        setRows([]);
        setFileName("");
      } finally {
        setLoading(false);
      }
    },
    [tl],
  );

  const clearData = useCallback(() => {
    setRows([]);
    setFileName("");
    setError("");
    setWhFilter("");
  }, []);
  return {
    tl,
    rows,
    fileName,
    error,
    loading,
    whFilter,
    setWhFilter,
    categoryFilter,
    setCategoryFilter,
    monthFilter,
    setMonthFilter,
    codeSearch,
    setCodeSearch,
    hideZeroMonthlyDiff,
    setHideZeroMonthlyDiff,
    hideZeroActualQty,
    setHideZeroActualQty,
    softSortMode,
    setSoftSortMode,
    tablePage,
    setTablePage,
    stats,
    structuredSummary,
    filteredStructuredRows,
    pagedStructuredRows,
    tableTotalPages,
    categoryOptions,
    monthTableOptions,
    warehouseOptions,
    statusChart,
    whBar,
    whBarChartHeightPx,
    overviewTopCodeDiffChart,
    overviewTopCodeAmountChart,
    overviewTopCodeAmountChartHeightPx,
    codeDiffSoftScale,
    handleFile,
    clearData,
  };
}
