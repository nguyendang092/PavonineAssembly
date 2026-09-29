import { useMemo, useState, useCallback, useEffect, useDeferredValue, useRef } from "react";
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
import {
  mergeWarehouseInventoryRows,
  removeWarehouseInventoryRowsByMonth,
} from "../lib/mergeWarehouseInventoryRows";
import { buildStructuredMonthCodeRows } from "../lib/buildStructuredRows";
import { buildMultiMonthCompareRows } from "../lib/buildTwoMonthCompareRows";
import { yearFromMonthKey } from "../lib/parse";
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
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [whFilter, setWhFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [monthCompareMode, setMonthCompareMode] = useState(false);
  const [compareMonthKeys, setCompareMonthKeys] = useState([]);
  const [codeSearch, setCodeSearch] = useState("");
  const deferredCodeSearch = useDeferredValue(codeSearch);
  const [hideZeroMonthlyDiff, setHideZeroMonthlyDiff] = useState(true);
  const [hideZeroActualQty, setHideZeroActualQty] = useState(true);
  const [qtySort, setQtySort] = useState("desc");
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
    yearFilter,
    monthCompareMode,
    compareMonthKeys,
    deferredCodeSearch,
    hideZeroMonthlyDiff,
    hideZeroActualQty,
    tablePageSize,
    qtySort,
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

  const yearOptions = useMemo(() => {
    const years = new Set();
    for (const m of monthTableOptions) {
      const y = yearFromMonthKey(m.value);
      if (y) years.add(y);
    }
    return [...years].sort((a, b) => b.localeCompare(a));
  }, [monthTableOptions]);

  const monthOptionsForYear = useMemo(() => {
    if (!yearFilter) return monthTableOptions;
    return monthTableOptions.filter(
      (m) => yearFromMonthKey(m.value) === yearFilter,
    );
  }, [monthTableOptions, yearFilter]);

  useEffect(() => {
    if (!yearFilter) return;
    if (monthFilter && yearFromMonthKey(monthFilter) !== yearFilter) {
      setMonthFilter("");
    }
    setCompareMonthKeys((keys) =>
      keys.filter((k) => yearFromMonthKey(k) === yearFilter),
    );
  }, [yearFilter, monthFilter]);

  const toggleCompareMonth = useCallback((monthKey) => {
    const key = String(monthKey ?? "").trim();
    if (!key) return;
    setCompareMonthKeys((keys) => {
      if (keys.includes(key)) return keys.filter((k) => k !== key);
      return [...keys, key].sort((a, b) => a.localeCompare(b));
    });
  }, []);

  const compareSourceRows = useMemo(() => {
    if (!monthCompareMode) return [];
    return buildMultiMonthCompareRows(
      structuredMonthCodeRows,
      compareMonthKeys,
    );
  }, [structuredMonthCodeRows, monthCompareMode, compareMonthKeys]);

  const filteredStructuredRows = useMemo(
    () =>
      filterAndSortStructuredRows(
        monthCompareMode ? compareSourceRows : structuredMonthCodeRows,
        {
          whFilter,
          categoryFilter,
          monthFilter: monthCompareMode ? "" : monthFilter,
          yearFilter: monthCompareMode ? "" : yearFilter,
          codeSearch: deferredCodeSearch,
          hideZeroMonthlyDiff,
          hideZeroActualQty,
          qtySort,
        },
      ),
    [
      structuredMonthCodeRows,
      compareSourceRows,
      monthCompareMode,
      whFilter,
      categoryFilter,
      monthFilter,
      yearFilter,
      deferredCodeSearch,
      hideZeroMonthlyDiff,
      hideZeroActualQty,
      qtySort,
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
    const maxAbs = filteredStructuredRows.reduce((mx, r) => {
      const value = monthCompareMode
        ? Math.abs(r.actualQty ?? 0)
        : Math.abs(r.gapAmount ?? 0);
      return Math.max(mx, value);
    }, 0);
    return maxAbs > 0 ? maxAbs : 1;
  }, [filteredStructuredRows, monthCompareMode]);

  const warehouseOptions = useMemo(() => {
    const keys = new Set();
    for (const r of rows) {
      const w = String(r.whCode ?? r.warehouseName ?? "").trim();
      if (w) keys.add(w);
    }
    return [...keys].sort((a, b) => a.localeCompare(b, "vi"));
  }, [rows]);

  const persistSnapshot = useCallback(async (nextRows, nextFileName) => {
    const name = String(nextFileName ?? "").trim() || "Cloud Snapshot";
    setRows(nextRows);
    setFileName(name);
    setCached(WAREHOUSE_INVENTORY_SNAPSHOT_CACHE_KEY, {
      rows: nextRows,
      fileName: name,
    });
    try {
      await set(ref(db, WAREHOUSE_INV_LATEST_PATH), {
        savedAt: new Date().toISOString(),
        fileName: name,
        rows: nextRows,
      });
    } catch (saveErr) {
      console.error("saveLatestSnapshotToCloud failed:", saveErr);
    }
  }, []);

  const handleFile = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setError("");
      setLoading(true);
      try {
        const parsed = await parseWarehouseInventoryFile(file);
        const merged = mergeWarehouseInventoryRows(rowsRef.current, parsed.rows);
        await persistSnapshot(merged, file.name);
        setWhFilter("");
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
      } finally {
        setLoading(false);
      }
    },
    [persistSnapshot, tl],
  );

  const deleteMonth = useCallback(
    async (monthKey) => {
      const key = String(monthKey ?? "").trim();
      if (!key) return;
      const label =
        monthTableOptions.find((m) => m.value === key)?.label ?? key;
      const ok = window.confirm(
        tl("deleteMonthConfirm", "Xóa toàn bộ dữ liệu tháng {{month}}?", {
          month: label,
        }),
      );
      if (!ok) return;
      setError("");
      setLoading(true);
      try {
        const next = removeWarehouseInventoryRowsByMonth(rowsRef.current, key);
        await persistSnapshot(next, fileName);
        setMonthFilter((m) => (m === key ? "" : m));
        setCompareMonthKeys((keys) => keys.filter((k) => k !== key));
      } finally {
        setLoading(false);
      }
    },
    [fileName, monthTableOptions, persistSnapshot, tl],
  );
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
    yearFilter,
    setYearFilter,
    yearOptions,
    monthOptionsForYear,
    monthCompareMode,
    setMonthCompareMode,
    compareMonthKeys,
    setCompareMonthKeys,
    toggleCompareMonth,
    codeSearch,
    setCodeSearch,
    hideZeroMonthlyDiff,
    setHideZeroMonthlyDiff,
    hideZeroActualQty,
    setHideZeroActualQty,
    qtySort,
    setQtySort,
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
    deleteMonth,
  };
}
