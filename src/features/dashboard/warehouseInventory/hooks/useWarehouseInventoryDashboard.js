import { useMemo, useState, useCallback, useEffect, useDeferredValue } from "react";
import { useTranslation } from "react-i18next";
import { db, ref, get, set } from "@/services/firebase";
import {
  WAREHOUSE_INV_LATEST_PATH,
  WAREHOUSE_INV_TABLE_PAGE_SIZE,
  WAREHOUSE_INV_TABLE_PAGE_SIZE_OPTIONS,
} from "../lib/constants";
import {
  computeWarehouseInventoryStats,
  dominantMonthLabel,
  parseWarehouseInventoryFile,
} from "../lib/parse";
import { buildStructuredMonthCodeRows } from "../lib/buildStructuredRows";
import { buildTwoMonthCompareRows } from "../lib/buildTwoMonthCompareRows";
import {
  filterAndSortStructuredRows,
  summarizeStructuredRows,
} from "../lib/filterStructuredRows";
import {
  DASHBOARD_QUERY_CACHE_TTL_MS,
  getCached,
  invalidateCached,
  setCached,
  WAREHOUSE_INVENTORY_SNAPSHOT_CACHE_KEY,
} from "@/utils/queryCache";

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
  const [monthCompareMode, setMonthCompareMode] = useState(false);
  const [monthCompareFrom, setMonthCompareFrom] = useState("");
  const [monthCompareTo, setMonthCompareTo] = useState("");
  const [codeSearch, setCodeSearch] = useState("");
  const deferredCodeSearch = useDeferredValue(codeSearch);
  const [hideZeroMonthlyDiff, setHideZeroMonthlyDiff] = useState(false);
  const [hideZeroActualQty, setHideZeroActualQty] = useState(true);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(WAREHOUSE_INV_TABLE_PAGE_SIZE);
  const [hasTriedCloudLoad, setHasTriedCloudLoad] = useState(false);
  const [isRevalidatingCloud, setIsRevalidatingCloud] = useState(false);

  const applyCloudSnapshot = useCallback((payload) => {
    const cloudRows = Array.isArray(payload?.rows) ? payload.rows : [];
    setRows(cloudRows);
    setFileName(String(payload?.fileName ?? "").trim() || "Cloud Snapshot");
    setWhFilter("");
    return cloudRows.length > 0;
  }, []);

  const loadLatestSnapshotFromCloud = useCallback(
    async ({ force = false } = {}) => {
      const cached = !force
        ? getCached(
            WAREHOUSE_INVENTORY_SNAPSHOT_CACHE_KEY,
            DASHBOARD_QUERY_CACHE_TTL_MS,
          )
        : null;

      if (cached?.data) {
        applyCloudSnapshot(cached.data);
        if (cached.isFresh) return true;
        setIsRevalidatingCloud(true);
      } else {
        setLoading(true);
      }

      try {
        const snap = await get(ref(db, WAREHOUSE_INV_LATEST_PATH));
        const payload = snap?.val?.() ?? snap.val();
        const normalized = {
          rows: Array.isArray(payload?.rows) ? payload.rows : [],
          fileName: String(payload?.fileName ?? "").trim() || "Cloud Snapshot",
        };
        setCached(WAREHOUSE_INVENTORY_SNAPSHOT_CACHE_KEY, normalized);
        return applyCloudSnapshot(normalized);
      } catch (err) {
        console.error("loadLatestSnapshotFromCloud failed:", err);
        return Boolean(cached?.data?.rows?.length);
      } finally {
        setLoading(false);
        setIsRevalidatingCloud(false);
      }
    },
    [applyCloudSnapshot],
  );

  const refreshCloudSnapshot = useCallback(() => {
    invalidateCached(WAREHOUSE_INVENTORY_SNAPSHOT_CACHE_KEY);
    void loadLatestSnapshotFromCloud({ force: true });
  }, [loadLatestSnapshotFromCloud]);

  useEffect(() => {
    setTablePage(1);
  }, [
    whFilter,
    categoryFilter,
    monthFilter,
    monthCompareMode,
    monthCompareFrom,
    monthCompareTo,
    deferredCodeSearch,
    hideZeroMonthlyDiff,
    hideZeroActualQty,
    tablePageSize,
  ]);

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

  const compareSourceRows = useMemo(() => {
    if (!monthCompareMode || !monthCompareFrom || !monthCompareTo) return [];
    return buildTwoMonthCompareRows(
      structuredMonthCodeRows,
      monthCompareFrom,
      monthCompareTo,
    );
  }, [
    structuredMonthCodeRows,
    monthCompareMode,
    monthCompareFrom,
    monthCompareTo,
  ]);

  const filteredStructuredRows = useMemo(
    () =>
      filterAndSortStructuredRows(
        monthCompareMode ? compareSourceRows : structuredMonthCodeRows,
        {
          whFilter,
          categoryFilter,
          monthFilter: monthCompareMode ? "" : monthFilter,
          codeSearch: deferredCodeSearch,
          hideZeroMonthlyDiff,
          hideZeroActualQty,
        },
      ),
    [
      structuredMonthCodeRows,
      compareSourceRows,
      monthCompareMode,
      whFilter,
      categoryFilter,
      monthFilter,
      deferredCodeSearch,
      hideZeroMonthlyDiff,
      hideZeroActualQty,
    ],
  );

  const structuredSummary = useMemo(
    () => summarizeStructuredRows(filteredStructuredRows),
    [filteredStructuredRows],
  );

  const tableTotalPages = Math.max(
    1,
    Math.ceil(filteredStructuredRows.length / tablePageSize),
  );

  useEffect(() => {
    setTablePage((p) => Math.min(Math.max(1, p), tableTotalPages));
  }, [tableTotalPages]);

  const pagedStructuredRows = useMemo(() => {
    const start = (tablePage - 1) * tablePageSize;
    return filteredStructuredRows.slice(start, start + tablePageSize);
  }, [filteredStructuredRows, tablePage, tablePageSize]);

  const codeDiffSoftScale = useMemo(() => {
    const maxAbs = filteredStructuredRows.reduce(
      (mx, r) => Math.max(mx, Math.abs(r.gapAmount ?? 0)),
      0,
    );
    return maxAbs > 0 ? maxAbs : 1;
  }, [filteredStructuredRows]);

  const warehouseOptions = useMemo(() => {
    const keys = new Set();
    for (const r of rows) {
      const w = String(r.whCode ?? r.warehouseName ?? "").trim();
      if (w) keys.add(w);
    }
    return [...keys].sort((a, b) => a.localeCompare(b, "vi"));
  }, [rows]);

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
    isRevalidatingCloud,
    refreshCloudSnapshot,
    whFilter,
    setWhFilter,
    categoryFilter,
    setCategoryFilter,
    monthFilter,
    setMonthFilter,
    monthCompareMode,
    setMonthCompareMode,
    monthCompareFrom,
    setMonthCompareFrom,
    monthCompareTo,
    setMonthCompareTo,
    codeSearch,
    setCodeSearch,
    hideZeroMonthlyDiff,
    setHideZeroMonthlyDiff,
    hideZeroActualQty,
    setHideZeroActualQty,
    tablePage,
    setTablePage,
    tablePageSize,
    setTablePageSize,
    tablePageSizeOptions: WAREHOUSE_INV_TABLE_PAGE_SIZE_OPTIONS,
    stats,
    structuredSummary,
    filteredStructuredRows,
    pagedStructuredRows,
    tableTotalPages,
    categoryOptions,
    monthTableOptions,
    warehouseOptions,
    codeDiffSoftScale,
    handleFile,
    clearData,
  };
}
