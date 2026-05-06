import React, { useMemo, useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  BarController,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
  PieController,
  LineElement,
  LineController,
  PointElement,
} from "chart.js";
import { Doughnut, Bar, Line } from "react-chartjs-2";
import { FiUpload, FiRefreshCw, FiPrinter, FiFilter } from "react-icons/fi";
import ChartDataLabels from "chartjs-plugin-datalabels";
import {
  buildMonthCodeGapPivot,
  computeWarehouseInventoryStats,
  dominantMonthLabel,
  formatKRW,
  normalizeMonthSortKey,
  parseWarehouseInventoryFile,
} from "./warehouseInventoryDashboardParse";
import { db, ref, get, set } from "@/services/firebase";
import "./dashboard.css";

ChartJS.register(
  ArcElement,
  BarElement,
  BarController,
  CategoryScale,
  LinearScale,
  PieController,
  LineElement,
  LineController,
  PointElement,
  Tooltip,
  Legend,
  ChartDataLabels,
);

ChartJS.defaults.plugins.datalabels = {
  ...(ChartJS.defaults.plugins.datalabels ?? {}),
  display: false,
};

function KpiCard({ label, value, sub, tone = "slate" }) {
  const tones = {
    slate: "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900",
    amber:
      "border-amber-300/80 bg-gradient-to-br from-amber-50 to-white dark:border-amber-800 dark:from-amber-950/80 dark:to-slate-900",
    emerald:
      "border-emerald-300/80 bg-gradient-to-br from-emerald-50 to-white dark:border-emerald-800 dark:from-emerald-950/70 dark:to-slate-900",
    rose: "border-rose-300/80 bg-gradient-to-br from-rose-50 to-white dark:border-rose-800 dark:from-rose-950/70 dark:to-slate-900",
  };
  return (
    <div
      className={`dashboard-report-surface rounded-lg border p-3 shadow-sm ${tones[tone]}`}
    >
      <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-1.5 text-xl font-black tabular-nums text-slate-900 dark:text-slate-50">
        {value}
      </p>
      {sub ? (
        <p className="mt-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">
          {sub}
        </p>
      ) : null}
    </div>
  );
}

const CHART_COLORS = [
  "#0ea5e9",
  "#22c55e",
  "#eab308",
  "#f97316",
  "#a855f7",
  "#ec4899",
  "#64748b",
  "#14b8a6",
];
const WAREHOUSE_INV_LATEST_PATH = "warehouseInventoryDashboard/latestSnapshot";

export default function WarehouseInventoryDashboard() {
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
  const [hideZeroMonthlyDiff, setHideZeroMonthlyDiff] = useState(false);
  const [hideZeroActualQty, setHideZeroActualQty] = useState(false);
  const [softSortMode, setSoftSortMode] = useState("month");
  const [tablePage, setTablePage] = useState(1);
  const [baseMonthKey, setBaseMonthKey] = useState("");
  const [compareMonthKey, setCompareMonthKey] = useState("");
  const [varianceLimit, setVarianceLimit] = useState(30);
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

  const gapPivot = useMemo(
    () => buildMonthCodeGapPivot(analysisRows),
    [analysisRows],
  );

  const monthGapBar = useMemo(
    () => ({
      labels: gapPivot.months.map((m) => m.display),
      datasets: [
        {
          label: tl("monthBarSignedTotal", "총 GAP(부호 포함)"),
          data: gapPivot.monthTotalsSigned,
          backgroundColor: "rgba(249,115,22,0.82)",
          borderRadius: 6,
        },
      ],
    }),
    [gapPivot.months, gapPivot.monthTotalsSigned, tl],
  );

  const codesForTrendLines = useMemo(() => {
    if (gapPivot.months.length === 0) return [];
    return [...gapPivot.pivotRows]
      .sort(
        (a, b) => Math.abs(b.swingSigned ?? 0) - Math.abs(a.swingSigned ?? 0),
      )
      .slice(0, 8);
  }, [gapPivot.pivotRows, gapPivot.months.length]);

  const codeGapLineChart = useMemo(
    () => ({
      labels: gapPivot.months.map((m) => m.display),
      datasets: codesForTrendLines.map((pr, idx) => ({
        label: pr.code === "∅" ? tl("codeEmptyLabel", "(코드 없음)") : pr.code,
        data: gapPivot.months.map(({ sortKey }) => {
          const cell = pr.byMonth[sortKey];
          return cell && cell.n > 0 ? cell.signedSum : null;
        }),
        borderColor: CHART_COLORS[idx % CHART_COLORS.length],
        backgroundColor: "transparent",
        tension: 0.25,
        spanGaps: true,
      })),
    }),
    [codesForTrendLines, gapPivot.months, tl],
  );

  const monthOptions = useMemo(
    () => gapPivot.months.map((m) => ({ value: m.sortKey, label: m.display })),
    [gapPivot.months],
  );

  useEffect(() => {
    if (monthOptions.length === 0) {
      setBaseMonthKey("");
      setCompareMonthKey("");
      return;
    }
    const first = monthOptions[0]?.value ?? "";
    const last = monthOptions[monthOptions.length - 1]?.value ?? "";
    setBaseMonthKey((prev) =>
      monthOptions.some((m) => m.value === prev) ? prev : first,
    );
    setCompareMonthKey((prev) =>
      monthOptions.some((m) => m.value === prev) ? prev : last,
    );
  }, [monthOptions]);

  const monthComparisonRows = useMemo(() => {
    if (!baseMonthKey || !compareMonthKey || baseMonthKey === compareMonthKey) {
      return [];
    }
    const rows2 = gapPivot.pivotRows.map((pr) => {
      const base = pr.byMonth[baseMonthKey];
      const compare = pr.byMonth[compareMonthKey];
      const baseN = base?.n ?? 0;
      const compareN = compare?.n ?? 0;
      const basePresent = baseN > 0;
      const comparePresent = compareN > 0;
      const baseSigned = base?.signedSum ?? 0;
      const compareSigned = compare?.signedSum ?? 0;
      const baseAbs = base?.absSum ?? 0;
      const compareAbs = compare?.absSum ?? 0;
      const baseValue = base?.vdSum ?? 0;
      const compareValue = compare?.vdSum ?? 0;
      const deltaSigned = compareSigned - baseSigned;
      const deltaAbs = compareAbs - baseAbs;
      const deltaValue = compareValue - baseValue;
      return {
        code: pr.code,
        item: pr.item,
        baseN,
        compareN,
        basePresent,
        comparePresent,
        baseSigned,
        compareSigned,
        baseAbs,
        compareAbs,
        deltaSigned,
        deltaAbs,
        deltaValue,
      };
    });
    rows2.sort((a, b) => Math.abs(b.deltaSigned) - Math.abs(a.deltaSigned));
    return rows2;
  }, [gapPivot.pivotRows, baseMonthKey, compareMonthKey]);

  const comparisonMissingMonthCount = useMemo(
    () =>
      monthComparisonRows.filter((r) => !r.basePresent || !r.comparePresent)
        .length,
    [monthComparisonRows],
  );

  const highVarianceRows = useMemo(
    () =>
      monthComparisonRows.filter(
        (r) => Math.abs(r.deltaSigned) >= Number(varianceLimit || 0),
      ),
    [monthComparisonRows, varianceLimit],
  );

  const highVarianceBar = useMemo(() => {
    const top = highVarianceRows.slice(0, 12);
    return {
      labels: top.map((r) =>
        r.code === "∅" ? tl("codeEmptyLabel", "(코드 없음)") : r.code,
      ),
      datasets: [
        {
          label: tl("highVarianceBarLabel", "|Δ Gap|"),
          data: top.map((r) => Math.abs(r.deltaSigned)),
          backgroundColor: "rgba(220,38,38,0.72)",
          borderRadius: 6,
        },
      ],
    };
  }, [highVarianceRows, tl]);

  const structuredMonthCodeRows = useMemo(() => {
    const grouped = new Map();
    for (const r of analysisRows) {
      const whCodeOnly = String(r.whCode ?? "").trim();
      const whNameOnly = String(r.warehouseName ?? "").trim();
      const whFilterKey =
        String(r.whCode ?? r.warehouseName ?? "").trim() || "—";
      const category = String(r.category ?? "").trim() || "—";
      const code = String(r.code ?? "").trim() || "∅";
      const monthRaw = String(r.month ?? "").trim() || "—";
      const monthNorm = normalizeMonthSortKey(monthRaw);
      const monthLabel = monthNorm.display || monthRaw || "—";
      const monthKey = monthNorm.sortKey || monthLabel;
      const key = `${whFilterKey}__${category}__${monthKey}__${code}`;
      const actualQty =
        typeof r.actualQty === "number" && Number.isFinite(r.actualQty)
          ? r.actualQty
          : 0;
      const sysQty =
        typeof r.sysQty === "number" && Number.isFinite(r.sysQty)
          ? r.sysQty
          : 0;
      const amtActual =
        typeof r.amountActual === "number" && Number.isFinite(r.amountActual)
          ? r.amountActual
          : 0;
      if (!grouped.has(key)) {
        grouped.set(key, {
          whCode: whCodeOnly || "—",
          warehouseName: whNameOnly || "—",
          whFilterKey,
          category,
          month: monthLabel,
          monthKey,
          code,
          actualQty: 0,
          sysQty: 0,
          amountActual: 0,
          monthlyDiff: 0,
          statusSet: new Set(),
          unitSet: new Set(),
        });
      }
      const row = grouped.get(key);
      if (row.whCode === "—" && whCodeOnly) row.whCode = whCodeOnly;
      if (row.warehouseName === "—" && whNameOnly)
        row.warehouseName = whNameOnly;
      const statusCell = String(r.status ?? "").trim();
      if (statusCell) row.statusSet.add(statusCell);
      const unitCell = String(r.unit ?? "").trim();
      if (unitCell) row.unitSet.add(unitCell);
      row.actualQty += actualQty;
      row.sysQty += sysQty;
      row.amountActual += amtActual;
      row.monthlyDiff = row.actualQty - row.sysQty;
    }

    // 코드별 월 증감(실사수량): 직전 데이터가 있는 월과 비교
    // (예: 02와 04만 있고 03이 없으면 04는 02와 비교).
    const actualByKeyMonth = new Map();
    for (const g of grouped.values()) {
      const k = `${g.whFilterKey}__${g.category}__${g.code}`;
      if (!actualByKeyMonth.has(k)) actualByKeyMonth.set(k, new Map());
      actualByKeyMonth.get(k).set(g.monthKey, g.actualQty ?? 0);
    }
    const prevActualByKeyMonth = new Map();
    for (const [k, m] of actualByKeyMonth.entries()) {
      const monthsSorted = [...m.keys()].sort((a, b) =>
        String(a).localeCompare(String(b)),
      );
      for (let i = 0; i < monthsSorted.length; i += 1) {
        const monthKey = monthsSorted[i];
        const prevKey = i > 0 ? monthsSorted[i - 1] : null;
        const prevActual = prevKey ? (m.get(prevKey) ?? 0) : null;
        prevActualByKeyMonth.set(`${k}__${monthKey}`, prevActual);
      }
    }

    const rows = [...grouped.values()].map((g) => {
      const statuses = [...g.statusSet].sort((a, b) =>
        a.localeCompare(b, "vi"),
      );
      const units = [...g.unitSet].sort((a, b) => a.localeCompare(b, "vi"));
      const rest = { ...g };
      delete rest.statusSet;
      delete rest.unitSet;
      const k = `${g.whFilterKey}__${g.category}__${g.code}`;
      const prevActual =
        prevActualByKeyMonth.get(`${k}__${g.monthKey}`) ?? null;
      return {
        ...rest,
        status: statuses.length ? statuses.join(", ") : "—",
        unit: units.length ? units.join(", ") : "—",
        // 코드별 월 증감: 현재 월 실사수량 - 직전(가장 가까운) 월 실사수량
        codeDelta: prevActual == null ? 0 : (g.actualQty ?? 0) - prevActual,
        hasPrevMonth: prevActual != null,
      };
    });

    rows.sort((a, b) => {
      if (a.monthKey !== b.monthKey)
        return a.monthKey.localeCompare(b.monthKey);
      if (a.whFilterKey !== b.whFilterKey)
        return a.whFilterKey.localeCompare(b.whFilterKey, "vi");
      if (a.whCode !== b.whCode) return a.whCode.localeCompare(b.whCode, "vi");
      if (a.warehouseName !== b.warehouseName)
        return a.warehouseName.localeCompare(b.warehouseName, "vi");
      if (a.category !== b.category)
        return a.category.localeCompare(b.category, "vi");
      if (a.code !== b.code) return a.code.localeCompare(b.code, "vi");
      if (a.status !== b.status) return a.status.localeCompare(b.status, "vi");
      return a.unit.localeCompare(b.unit, "vi");
    });
    return rows;
  }, [analysisRows]);

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

  const filteredStructuredRows = useMemo(() => {
    const search = codeSearch.trim().toLowerCase();
    const baseRows = structuredMonthCodeRows.filter((r) => {
      if (whFilter && r.whFilterKey !== whFilter) return false;
      if (categoryFilter && r.category !== categoryFilter) return false;
      if (monthFilter && r.monthKey !== monthFilter) return false;
      if (hideZeroMonthlyDiff && Math.abs(r.monthlyDiff) < 1e-9) return false;
      if (hideZeroActualQty && Math.abs(r.actualQty) < 1e-9) return false;
      if (!search) return true;
      return (
        String(r.code).toLowerCase().includes(search) ||
        String(r.category).toLowerCase().includes(search) ||
        String(r.whCode).toLowerCase().includes(search) ||
        String(r.warehouseName ?? "")
          .toLowerCase()
          .includes(search) ||
        String(r.status ?? "")
          .toLowerCase()
          .includes(search) ||
        String(r.unit ?? "")
          .toLowerCase()
          .includes(search)
      );
    });
    const compareByNatural = (a, b) => {
      if (a.monthKey !== b.monthKey) {
        return String(a.monthKey).localeCompare(String(b.monthKey));
      }
      if (a.whFilterKey !== b.whFilterKey) {
        return a.whFilterKey.localeCompare(b.whFilterKey, "vi");
      }
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category, "vi");
      }
      if (a.whCode !== b.whCode) return a.whCode.localeCompare(b.whCode, "vi");
      if (a.warehouseName !== b.warehouseName) {
        return a.warehouseName.localeCompare(b.warehouseName, "vi");
      }
      return 0;
    };
    if (softSortMode === "abs_desc") {
      return [...baseRows].sort(
        (a, b) =>
          Math.abs(b.codeDelta) - Math.abs(a.codeDelta) ||
          b.codeDelta - a.codeDelta ||
          compareByNatural(a, b) ||
          0,
      );
    }
    if (softSortMode === "pos_desc") {
      return [...baseRows].sort(
        (a, b) =>
          b.codeDelta - a.codeDelta ||
          Math.abs(b.codeDelta) - Math.abs(a.codeDelta) ||
          compareByNatural(a, b) ||
          0,
      );
    }
    if (softSortMode === "neg_asc") {
      return [...baseRows].sort(
        (a, b) =>
          a.codeDelta - b.codeDelta ||
          Math.abs(b.codeDelta) - Math.abs(a.codeDelta) ||
          compareByNatural(a, b) ||
          0,
      );
    }
    if (softSortMode === "month") {
      return [...baseRows].sort(
        (a, b) =>
          compareByNatural(a, b) ||
          a.code.localeCompare(b.code, "vi") ||
          a.status.localeCompare(b.status, "vi") ||
          a.unit.localeCompare(b.unit, "vi"),
      );
    }
    return baseRows;
  }, [
    structuredMonthCodeRows,
    whFilter,
    categoryFilter,
    monthFilter,
    hideZeroMonthlyDiff,
    hideZeroActualQty,
    codeSearch,
    softSortMode,
  ]);

  const structuredSummary = useMemo(() => {
    let actual = 0;
    let sys = 0;
    let monthlyDiff = 0;
    let codeDiff = 0;
    for (const r of filteredStructuredRows) {
      actual += r.actualQty;
      sys += r.sysQty;
      monthlyDiff += r.monthlyDiff;
      codeDiff += r.codeDelta;
    }
    return {
      rows: filteredStructuredRows.length,
      actual,
      sys,
      monthlyDiff,
      codeDiff,
    };
  }, [filteredStructuredRows]);

  const TABLE_PAGE_SIZE = 100;
  const tableTotalPages = Math.max(
    1,
    Math.ceil(filteredStructuredRows.length / TABLE_PAGE_SIZE),
  );

  useEffect(() => {
    setTablePage((p) => Math.min(Math.max(1, p), tableTotalPages));
  }, [tableTotalPages]);

  const pagedStructuredRows = useMemo(() => {
    const start = (tablePage - 1) * TABLE_PAGE_SIZE;
    return filteredStructuredRows.slice(start, start + TABLE_PAGE_SIZE);
  }, [filteredStructuredRows, tablePage]);

  const codeDiffSoftScale = useMemo(() => {
    const maxAbs = filteredStructuredRows.reduce(
      (mx, r) => Math.max(mx, Math.abs(r.codeDelta ?? 0)),
      0,
    );
    return maxAbs > 0 ? maxAbs : 1;
  }, [filteredStructuredRows]);

  const overviewMonthChart = useMemo(() => {
    const monthMap = new Map();
    for (const r of filteredStructuredRows) {
      if (!monthMap.has(r.monthKey)) {
        monthMap.set(r.monthKey, {
          label: r.month,
          monthlyDiff: 0,
          codeDiff: 0,
        });
      }
      const m = monthMap.get(r.monthKey);
      m.monthlyDiff += r.monthlyDiff;
      m.codeDiff += r.codeDelta;
    }
    const rows = [...monthMap.entries()]
      .sort(([a], [b]) => String(a).localeCompare(String(b)))
      .map(([, v]) => v);
    return {
      labels: rows.map((r) => r.label),
      datasets: [
        {
          label: tl("colMonthlyDiffKr", "월별 차이"),
          data: rows.map((r) => r.monthlyDiff),
          borderColor: "#7c3aed",
          backgroundColor: "rgba(124, 58, 237, 0.14)",
          borderWidth: 3,
          fill: true,
          yAxisID: "y",
          tension: 0.35,
          pointRadius: 6,
          pointHoverRadius: 9,
          pointBackgroundColor: "#ffffff",
          pointBorderColor: "#7c3aed",
          pointBorderWidth: 2,
        },
        {
          label: tl("colCodeMonthSwingKr", "코드별 월 증감 (실사수량)"),
          data: rows.map((r) => r.codeDiff),
          borderColor: "#059669",
          backgroundColor: "rgba(5, 150, 105, 0.13)",
          borderWidth: 3,
          fill: true,
          yAxisID: "y1",
          tension: 0.35,
          pointRadius: 6,
          pointHoverRadius: 9,
          pointBackgroundColor: "#ffffff",
          pointBorderColor: "#059669",
          pointBorderWidth: 2,
        },
      ],
    };
  }, [filteredStructuredRows, tl]);

  const overviewTopCodeDiffChart = useMemo(() => {
    const map = new Map();
    for (const r of filteredStructuredRows) {
      if (!map.has(r.code)) map.set(r.code, 0);
      map.set(r.code, (map.get(r.code) || 0) + r.codeDelta);
    }
    const top = [...map.entries()]
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 12);
    return {
      labels: top.map(([code]) =>
        code === "∅" ? tl("codeEmptyLabel", "(코드 없음)") : code,
      ),
      datasets: [
        {
          label: tl("colCodeMonthSwingKr", "코드별 월 증감 (실사수량)"),
          data: top.map(([, v]) => v),
          backgroundColor: top.map(([, v]) =>
            v >= 0 ? "rgba(220,38,38,0.88)" : "rgba(37,99,235,0.88)",
          ),
          borderColor: top.map(([, v]) =>
            v >= 0 ? "rgba(254,226,226,0.98)" : "rgba(219,234,254,0.98)",
          ),
          borderWidth: 2,
          borderRadius: 10,
          borderSkipped: false,
        },
      ],
    };
  }, [filteredStructuredRows, tl]);

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
            (_, i) => `${CHART_COLORS[i % CHART_COLORS.length]}dd`,
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

  const printPage = useCallback(() => window.print(), []);

  return (
    <div className="dashboard-print-fill w-full px-2 py-3 sm:px-3">
      <header className="dashboard-no-print mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl uppercase">
            {tl("pageTitle", "창고 재고 보고서")}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-xs font-bold text-white shadow hover:bg-sky-500">
            <FiUpload className="text-lg" aria-hidden />
            {tl("uploadBtn", "엑셀 파일 선택")}
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFile}
              disabled={loading}
            />
          </label>
          {rows.length > 0 ? (
            <>
              <button
                type="button"
                onClick={clearData}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <FiRefreshCw /> {tl("clearBtn", "데이터 초기화")}
              </button>
              <button
                type="button"
                onClick={printPage}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                <FiPrinter /> {tl("printBtn", "In")}
              </button>
            </>
          ) : null}
        </div>
      </header>

      {error ? (
        <div
          className="dashboard-no-print mb-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <p className="dashboard-no-print text-sm font-medium text-slate-600 dark:text-slate-400">
          {tl("loading", "파일을 읽는 중…")}
        </p>
      ) : null}

      {rows.length === 0 && !loading ? (
        <div className="dashboard-no-print rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/80 p-10 text-center dark:border-slate-600 dark:bg-slate-900/40">
          <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
            {tl("emptyTitle", "Chưa có dữ liệu")}
          </p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {tl(
              "emptyHint",
              "ERP/엑셀에서 재고 보고서를 내보낸 뒤 컬럼 헤더(THỰC TẾ, STATUS, 창고/창고코드, 재고금액…)를 유지하고 «엑셀 파일 선택»을 눌러주세요.",
            )}
          </p>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {tl("fileLabel", "파일")}:
              </span>{" "}
              <span className="font-mono text-xs">{fileName || "—"}</span>
              {" · "}
              <span className="font-semibold">{tl("period", "Kỳ")}:</span>{" "}
              {stats.periodLabel}
            </p>
          </div>

          <div className="dashboard-report-surface mb-3 rounded-lg border border-indigo-200/80 bg-gradient-to-br from-indigo-50/90 to-white p-3 dark:border-indigo-900/60 dark:from-indigo-950/40 dark:to-slate-900">
            <h2 className="text-base font-black uppercase tracking-wide text-indigo-950 dark:text-indigo-100">
              {tl(
                "structuredTableTitle",
                "Bảng báo cáo theo cấu trúc tháng × mã",
              )}
            </h2>

            <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label={tl("colActualQty", "실사수량")}
                value={structuredSummary.actual.toLocaleString("vi-VN", {
                  maximumFractionDigits: 4,
                })}
                tone="amber"
              />
              <KpiCard
                label={tl("colSystemQtyKr", "SL 전산수량")}
                value={structuredSummary.sys.toLocaleString("vi-VN", {
                  maximumFractionDigits: 4,
                })}
                tone="slate"
              />
              <KpiCard
                label={tl("colMonthlyDiffKr", "월별 차이")}
                value={structuredSummary.monthlyDiff.toLocaleString("vi-VN", {
                  maximumFractionDigits: 4,
                })}
                tone="rose"
              />
              <KpiCard
                label={tl("colCodeDiffKr", "코드별 차이")}
                value={structuredSummary.codeDiff.toLocaleString("vi-VN", {
                  maximumFractionDigits: 4,
                })}
                tone="emerald"
              />
            </div>

            <div className="mt-6 space-y-4 border-t border-indigo-200/60 pt-5 dark:border-indigo-900/70">
              <div className="flex flex-col gap-2 border-l-4 border-indigo-500 pl-4 sm:flex-row sm:items-end sm:justify-between dark:border-indigo-400">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">
                    {tl("overviewVisualBadge", "Nhận định báo cáo")}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-12">
                <div className="flex flex-col gap-4 lg:col-span-4">
                  <div className="dashboard-chart-panel rounded-2xl border-2 border-indigo-300/55 bg-gradient-to-br from-white via-indigo-50/40 to-white p-4 dark:border-indigo-800 dark:from-slate-900 dark:via-indigo-950/40 dark:to-slate-900">
                    <h4 className="text-xs font-black uppercase tracking-wide text-indigo-950 dark:text-indigo-100">
                      {tl("chartStatusTitle", "STATUS별 (행 수)")}
                    </h4>
                    <p className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-600 dark:text-slate-400">
                      {tl(
                        "overviewStatusHint",
                        "Tỉ lệ hàng theo trạng thái ERP — trạng thái lệch thường nên giải thích trước khi kết luận tồn an toàn.",
                      )}
                    </p>
                    <div className="mt-3">
                      <div className="wah-inv-chart-inner h-[228px]">
                        {statusChart.labels.length > 0 ? (
                          <Doughnut
                            data={statusChart}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              cutout: "56%",
                              layout: {
                                padding: {
                                  top: 4,
                                  bottom: 10,
                                  left: 4,
                                  right: 4,
                                },
                              },
                              plugins: {
                                legend: {
                                  position: "bottom",
                                  labels: {
                                    boxWidth: 12,
                                    boxHeight: 12,
                                    padding: 14,
                                    font: {
                                      size: 11,
                                      weight: "700",
                                    },
                                    color: "#475569",
                                  },
                                },
                                tooltip: {
                                  callbacks: {
                                    label: (ctx) => {
                                      const t = ctx.label ?? "";
                                      const v = ctx.parsed ?? 0;
                                      const sum = ctx.dataset.data.reduce(
                                        (a, b) => a + b,
                                        0,
                                      );
                                      const pct =
                                        sum > 0
                                          ? ((v / sum) * 100).toFixed(1)
                                          : "0";
                                      return `${t}: ${v} (${pct}%)`;
                                    },
                                  },
                                },
                                datalabels: {
                                  display: (ctx) => {
                                    const raw = ctx.dataset.data[ctx.dataIndex];
                                    const n = Number(raw);
                                    return Number.isFinite(n) && n > 0;
                                  },
                                  backgroundColor: "rgba(255,255,255,0.96)",
                                  borderColor: "rgba(99,102,241,0.65)",
                                  borderWidth: 2,
                                  borderRadius: 12,
                                  padding: {
                                    top: 6,
                                    right: 9,
                                    bottom: 6,
                                    left: 9,
                                  },
                                  color: "#312e81",
                                  font: { size: 11, weight: "800" },
                                  formatter: (value, ctx) => {
                                    const arr = ctx.chart.data.datasets[0].data;
                                    const sum = arr.reduce(
                                      (a, b) => Number(a) + Number(b),
                                      0,
                                    );
                                    const pct =
                                      sum > 0
                                        ? Math.round(
                                            (Number(value) / sum) * 100,
                                          )
                                        : 0;
                                    return `${Number(value).toLocaleString(
                                      "vi-VN",
                                    )}\n${pct}%`;
                                  },
                                },
                              },
                            }}
                          />
                        ) : (
                          <p className="flex h-full items-center justify-center text-center text-xs font-medium text-slate-500">
                            {tl(
                              "overviewChartEmpty",
                              "STATUS 데이터가 부족합니다.",
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="dashboard-chart-panel rounded-xl border border-slate-200 bg-slate-50/90 p-4 dark:border-slate-600 dark:bg-slate-900/85">
                    <h4 className="text-xs font-black uppercase tracking-wide text-slate-800 dark:text-slate-100">
                      {tl("chartWhTitle", "상위 창고 - 재고금액(실사)")}
                    </h4>
                    <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-600 dark:text-slate-400">
                      {tl(
                        "overviewWhHint",
                        "Kho nào đang «ôm» nhiều giá trị tồn thực tế — ưu tiên kiểm soát khi có chênh lệch.",
                      )}
                    </p>
                    <div className="mt-3">
                      <div
                        className="wah-inv-chart-inner wah-inv-wh-bar-minimal"
                        style={{ height: whBarChartHeightPx }}
                      >
                        {whBar.labels.length > 0 ? (
                          <Bar
                            data={whBar}
                            options={{
                              indexAxis: "y",
                              responsive: true,
                              maintainAspectRatio: false,
                              layout: {
                                padding: {
                                  top: 4,
                                  bottom: 4,
                                  left: 2,
                                  right: 188,
                                },
                              },
                              datasets: {
                                bar: {
                                  categoryPercentage: 0.78,
                                  barPercentage: 0.92,
                                },
                              },
                              plugins: {
                                legend: { display: false },
                                tooltip: {
                                  titleFont: { size: 12, weight: "700" },
                                  bodyFont: { size: 12, weight: "600" },
                                  padding: 4,
                                  callbacks: {
                                    title: (items) =>
                                      items[0]?.label != null
                                        ? String(items[0].label)
                                        : "",
                                    label: (ctx) =>
                                      `${ctx.dataset.label ?? ""}: ${formatKRW(
                                        Number(ctx.parsed.x),
                                      )}`,
                                  },
                                },
                                datalabels: {
                                  display: (ctx) =>
                                    Number.isFinite(
                                      Number(ctx.dataset.data[ctx.dataIndex]),
                                    ) &&
                                    Number(ctx.dataset.data[ctx.dataIndex]) !==
                                      0,
                                  anchor: "end",
                                  align: "end",
                                  offset: 10,
                                  clamp: false,
                                  clip: false,
                                  textAlign: "end",
                                  backgroundColor: (ctx) =>
                                    document.documentElement.classList.contains(
                                      "dark",
                                    )
                                      ? "#334155"
                                      : "#f1f5f9",
                                  padding: {
                                    top: 3,
                                    right: 7,
                                    bottom: 3,
                                    left: 7,
                                  },
                                  color: (ctx) =>
                                    document.documentElement.classList.contains(
                                      "dark",
                                    )
                                      ? "#f8fafc"
                                      : "#1e293b",
                                  font: { size: 10, weight: "700" },
                                  formatter: (v) => formatKRW(Number(v)),
                                },
                              },
                              scales: {
                                x: {
                                  beginAtZero: true,
                                  grid: {
                                    display: false,
                                    drawTicks: false,
                                  },
                                  border: {
                                    display: false,
                                  },
                                  ticks: {
                                    maxTicksLimit: 7,
                                    font: { size: 11, weight: "600" },
                                    color: "#64748b",
                                    callback: (v) => formatKRW(Number(v)),
                                  },
                                },
                                y: {
                                  grid: { display: false },
                                  border: { display: false },
                                  ticks: {
                                    autoSkip: false,
                                    maxRotation: 0,
                                    font: { size: 11, weight: "600" },
                                    color: "#475569",
                                    padding: 10,
                                    callback: (_tickVal, idx) => {
                                      const label = String(
                                        whBar.labels[idx] ?? "",
                                      );
                                      return label.length > 22
                                        ? `${label.slice(0, 20)}…`
                                        : label;
                                    },
                                  },
                                },
                              },
                            }}
                          />
                        ) : (
                          <p className="flex h-full items-center justify-center text-center text-xs font-medium text-slate-500">
                            {tl(
                              "overviewWhChartEmpty",
                              "창고/금액 데이터가 부족합니다.",
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 lg:col-span-8">
                  <div className="dashboard-chart-panel rounded-2xl border-2 border-indigo-300/55 bg-gradient-to-br from-white via-amber-50/25 to-white p-4 dark:border-indigo-800 dark:from-slate-900 dark:via-amber-950/20 dark:to-slate-900">
                    <h4 className="text-xs font-black uppercase tracking-wide text-indigo-950 dark:text-indigo-100">
                      {tl(
                        "overviewMonthChartTitle",
                        "Tổng quan chênh lệch theo tháng",
                      )}
                    </h4>
                    <p className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-600 dark:text-slate-400">
                      {tl(
                        "overviewMonthTrendHint",
                        "Theo dữ liệu đang lọc: đường tím = tổng 월별 차이 (trục trái), đường xanh lá = tổng 코드별 차이 (trục phải).",
                      )}
                    </p>
                    <div className="mt-3">
                      <div className="wah-inv-chart-inner h-[268px]">
                        <Line
                          data={overviewMonthChart}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            interaction: { mode: "index", intersect: false },
                            layout: {
                              padding: {
                                top: 18,
                                bottom: 12,
                                left: 6,
                                right: 10,
                              },
                            },
                            plugins: {
                              legend: {
                                position: "bottom",
                                labels: {
                                  boxWidth: 14,
                                  padding: 16,
                                  font: { size: 11, weight: "700" },
                                  color: "#475569",
                                },
                              },
                              datalabels: {
                                display: (ctx) =>
                                  ctx.dataset.data[ctx.dataIndex] != null &&
                                  Number.isFinite(
                                    Number(ctx.dataset.data[ctx.dataIndex]),
                                  ),
                                align: (ctx) =>
                                  ctx.datasetIndex === 0 ? "top" : "bottom",
                                anchor: "center",
                                offset: (ctx) =>
                                  ctx.datasetIndex === 0 ? -14 : 14,
                                borderRadius: 10,
                                padding: {
                                  top: 5,
                                  right: 8,
                                  bottom: 5,
                                  left: 8,
                                },
                                borderWidth: 0,
                                font: { size: 10, weight: "800" },
                                color: "#ffffff",
                                backgroundColor: (ctx) =>
                                  ctx.datasetIndex === 0
                                    ? "rgba(124,58,237,0.94)"
                                    : "rgba(5,150,105,0.94)",
                                formatter: (value) =>
                                  Number(value).toLocaleString("vi-VN", {
                                    maximumFractionDigits: 2,
                                  }),
                              },
                            },
                            scales: {
                              x: {
                                grid: { display: false },
                                ticks: {
                                  font: { size: 10, weight: "700" },
                                  color: "#475569",
                                },
                              },
                              y: {
                                type: "linear",
                                position: "left",
                                grid: { display: false },
                                ticks: {
                                  font: { size: 10, weight: "600" },
                                  color: "#6d28d9",
                                  callback: (v) =>
                                    Number(v).toLocaleString("vi-VN"),
                                },
                              },
                              y1: {
                                type: "linear",
                                position: "right",
                                grid: { display: false },
                                ticks: {
                                  font: { size: 10, weight: "600" },
                                  color: "#047857",
                                  callback: (v) =>
                                    Number(v).toLocaleString("vi-VN"),
                                },
                              },
                            },
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="dashboard-chart-panel rounded-2xl border-2 border-indigo-300/55 bg-gradient-to-br from-white via-rose-50/25 to-white p-4 dark:border-indigo-800 dark:from-slate-900 dark:via-rose-950/25 dark:to-slate-900">
                    <h4 className="text-xs font-black uppercase tracking-wide text-indigo-950 dark:text-indigo-100">
                      {tl(
                        "overviewTopCodeChartTitle",
                        "Top CODE có 코드별 차이 lớn nhất",
                      )}
                    </h4>
                    <div className="mt-3">
                      <div className="wah-inv-chart-inner h-[268px]">
                        <Bar
                          data={overviewTopCodeDiffChart}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            layout: {
                              padding: {
                                top: 16,
                                bottom: 8,
                                left: 4,
                                right: 6,
                              },
                            },
                            plugins: {
                              legend: { display: false },
                              datalabels: {
                                display: true,
                                anchor: "end",
                                align: "top",
                                offset: 6,
                                borderRadius: 10,
                                padding: {
                                  top: 5,
                                  right: 8,
                                  bottom: 5,
                                  left: 8,
                                },
                                borderWidth: 1,
                                borderColor: "rgba(255,255,255,0.55)",
                                font: { size: 10, weight: "800" },
                                color: "#ffffff",
                                backgroundColor: (ctx) => {
                                  const v = Number(
                                    ctx.dataset.data[ctx.dataIndex],
                                  );
                                  return v >= 0
                                    ? "rgba(185,28,28,0.94)"
                                    : "rgba(29,78,216,0.94)";
                                },
                                formatter: (v) =>
                                  Number(v).toLocaleString("vi-VN", {
                                    maximumFractionDigits: 2,
                                  }),
                              },
                            },
                            scales: {
                              x: {
                                grid: { display: false },
                                ticks: {
                                  font: { size: 9, weight: "700" },
                                  color: "#475569",
                                  maxRotation: 42,
                                  minRotation: 0,
                                },
                              },
                              y: {
                                grid: { display: false },
                                ticks: {
                                  font: { size: 10, weight: "600" },
                                  color: "#64748b",
                                  callback: (v) =>
                                    Number(v).toLocaleString("vi-VN"),
                                },
                              },
                            },
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="dashboard-no-print mt-6 rounded-2xl border-2 border-indigo-400/55 bg-gradient-to-br from-white via-indigo-50/80 to-violet-50/70 p-4 dark:border-indigo-500/40 dark:from-slate-950 dark:via-indigo-950/50 dark:to-violet-950/35">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-indigo-200/70 pb-3 dark:border-indigo-800/80">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white">
                    <FiFilter
                      className="h-[1.125rem] w-[1.125rem]"
                      aria-hidden
                    />
                  </span>
                  <div>
                    <p className="text-[13px] font-black uppercase tracking-wide text-indigo-950 dark:text-indigo-100">
                      {tl("filtersSectionTitle", "Bộ lọc báo cáo")}
                    </p>
                    <p className="text-[11px] font-semibold text-indigo-800/85 dark:text-indigo-200/80">
                      {tl(
                        "filtersSectionHint",
                        "기간과 조건을 선택하면 KPI, 차트, 표가 필터 기준으로 함께 갱신됩니다.",
                      )}
                    </p>
                  </div>
                </div>
                <div className="rounded-full border-2 border-emerald-300/90 bg-emerald-50 px-4 py-1.5 text-center text-xs font-black tabular-nums text-emerald-900 dark:border-emerald-600/60 dark:bg-emerald-950/80 dark:text-emerald-100">
                  {tl("comparisonRowsCount", "{{count}} dòng", {
                    count: structuredSummary.rows,
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="group rounded-xl border border-indigo-200/90 bg-white/95 p-3 transition hover:border-indigo-400 dark:border-slate-600 dark:bg-slate-900/95 dark:hover:border-indigo-500">
                  <label className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-indigo-900 dark:text-indigo-100">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-indigo-500"
                      aria-hidden
                    />
                    {tl("filterWh", "창고 필터")}
                  </label>
                  <select
                    value={whFilter}
                    onChange={(ev) => setWhFilter(ev.target.value)}
                    className="wah-inv-filter-control w-full cursor-pointer rounded-lg border-2 border-slate-200 bg-slate-50/80 px-3 py-2 text-xs font-bold text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400"
                  >
                    <option value="">{tl("filterWhAll", "전체")}</option>
                    {warehouseOptions.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="group rounded-xl border border-indigo-200/90 bg-white/95 p-3 transition hover:border-indigo-400 dark:border-slate-600 dark:bg-slate-900/95 dark:hover:border-indigo-500">
                  <label className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-indigo-900 dark:text-indigo-100">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-violet-500"
                      aria-hidden
                    />
                    {tl("colCategoryKr", "구분")}
                  </label>
                  <select
                    value={categoryFilter}
                    onChange={(ev) => setCategoryFilter(ev.target.value)}
                    className="wah-inv-filter-control w-full cursor-pointer rounded-lg border-2 border-slate-200 bg-slate-50/80 px-3 py-2 text-xs font-bold text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400"
                  >
                    <option value="">{tl("filterAll", "전체")}</option>
                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="group rounded-xl border border-indigo-200/90 bg-white/95 p-3 transition hover:border-indigo-400 dark:border-slate-600 dark:bg-slate-900/95 dark:hover:border-indigo-500">
                  <label className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-indigo-900 dark:text-indigo-100">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-sky-500"
                      aria-hidden
                    />
                    Month
                  </label>
                  <select
                    value={monthFilter}
                    onChange={(ev) => setMonthFilter(ev.target.value)}
                    className="wah-inv-filter-control w-full cursor-pointer rounded-lg border-2 border-slate-200 bg-slate-50/80 px-3 py-2 text-xs font-bold text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400"
                  >
                    <option value="">{tl("filterAll", "전체")}</option>
                    {monthTableOptions.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="group rounded-xl border border-indigo-200/90 bg-white/95 p-3 transition hover:border-indigo-400 dark:border-slate-600 dark:bg-slate-900/95 dark:hover:border-indigo-500">
                  <label className="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-indigo-900 dark:text-indigo-100">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-amber-500"
                      aria-hidden
                    />
                    CODE
                  </label>
                  <input
                    value={codeSearch}
                    onChange={(ev) => setCodeSearch(ev.target.value)}
                    placeholder={tl("searchCodePlaceholder", "CODE 입력...")}
                    className="wah-inv-filter-control w-full rounded-lg border-2 border-slate-200 bg-slate-50/80 px-3 py-2 text-xs font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400"
                  />
                </div>
              </div>

              <div className="mt-4 border-t border-indigo-200/60 pt-3 dark:border-indigo-800/70">
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl border border-indigo-200/70 bg-white/70 p-3 dark:border-indigo-800/70 dark:bg-slate-900/40">
                    <p className="mb-2.5 flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-indigo-900 dark:text-indigo-100">
                      <span
                        className="inline-block h-px w-4 bg-gradient-to-r from-indigo-500 to-violet-500"
                        aria-hidden
                      />
                      {tl("filtersHideLabel", "불필요한 행 숨기기")}
                    </p>
                    <div className="flex flex-wrap gap-2.5">
                      <label
                        className={`flex cursor-pointer items-center gap-2.5 rounded-xl border-2 px-3.5 py-2 text-xs font-bold transition focus-within:ring-4 focus-within:ring-indigo-500/25 ${
                          hideZeroMonthlyDiff
                            ? "border-indigo-500 bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
                            : "border-slate-200/90 bg-white text-slate-800 hover:border-indigo-300 hover:bg-indigo-50/90 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={hideZeroMonthlyDiff}
                          onChange={(e) =>
                            setHideZeroMonthlyDiff(e.target.checked)
                          }
                          className={`h-4 w-4 shrink-0 rounded-md border-2 focus:ring-offset-0 ${
                            hideZeroMonthlyDiff
                              ? "border-white/70 bg-white/20 text-white accent-white"
                              : "border-slate-300 accent-indigo-600 dark:border-slate-500"
                          }`}
                        />
                        {tl("hideZeroMonthlyDiff", "GAP = 0 숨기기")}
                      </label>
                      <label
                        className={`flex cursor-pointer items-center gap-2.5 rounded-xl border-2 px-3.5 py-2 text-xs font-bold transition focus-within:ring-4 focus-within:ring-indigo-500/25 ${
                          hideZeroActualQty
                            ? "border-indigo-500 bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
                            : "border-slate-200/90 bg-white text-slate-800 hover:border-indigo-300 hover:bg-indigo-50/90 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={hideZeroActualQty}
                          onChange={(e) =>
                            setHideZeroActualQty(e.target.checked)
                          }
                          className={`h-4 w-4 shrink-0 rounded-md border-2 focus:ring-offset-0 ${
                            hideZeroActualQty
                              ? "border-white/70 bg-white/20 text-white accent-white"
                              : "border-slate-300 accent-indigo-600 dark:border-slate-500"
                          }`}
                        />
                        {tl("hideZeroActualQty", "실사수량 = 0 숨기기")}
                      </label>
                    </div>
                  </div>

                  <div className="rounded-xl border border-indigo-200/70 bg-white/70 p-3 dark:border-indigo-800/70 dark:bg-slate-900/40">
                    <p className="mb-2.5 flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-indigo-900 dark:text-indigo-100">
                      <span
                        className="inline-block h-px w-4 bg-gradient-to-r from-indigo-500 to-violet-500"
                        aria-hidden
                      />
                      {tl("softSortSectionTitle", "Sắp xếp")}
                    </p>
                    <div className="flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        onClick={() => setSoftSortMode("abs_desc")}
                        className={`rounded-xl border-2 px-3.5 py-2 text-xs font-bold transition ${
                          softSortMode === "abs_desc"
                            ? "border-indigo-500 bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
                            : "border-slate-200/90 bg-white text-slate-800 hover:border-indigo-300 hover:bg-indigo-50/90 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40"
                        }`}
                      >
                        {tl("codeDiffSoftTop", "절대값 정렬")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSoftSortMode("pos_desc")}
                        className={`rounded-xl border-2 px-3.5 py-2 text-xs font-bold transition ${
                          softSortMode === "pos_desc"
                            ? "border-indigo-500 bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
                            : "border-slate-200/90 bg-white text-slate-800 hover:border-indigo-300 hover:bg-indigo-50/90 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40"
                        }`}
                      >
                        {tl("codeDiffSoftPositive", "큰값 -> 작은값")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSoftSortMode("neg_asc")}
                        className={`rounded-xl border-2 px-3.5 py-2 text-xs font-bold transition ${
                          softSortMode === "neg_asc"
                            ? "border-indigo-500 bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
                            : "border-slate-200/90 bg-white text-slate-800 hover:border-indigo-300 hover:bg-indigo-50/90 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40"
                        }`}
                      >
                        {tl("codeDiffSoftNegative", "작은값 -> 큰값")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border-2 border-indigo-400/55 bg-gradient-to-br from-white via-indigo-50/70 to-violet-50/60 dark:border-indigo-500/40 dark:from-slate-950 dark:via-indigo-950/45 dark:to-violet-950/30">
              <div className="overflow-x-auto">
                <table className="wah-inv-data-table min-w-[1640px] w-full border-collapse text-center text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b-2 border-indigo-400/90 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 text-white dark:border-indigo-500 dark:from-indigo-700 dark:via-violet-700 dark:to-indigo-700">
                      <th className="whitespace-nowrap px-2 py-2.5 text-[11px] font-black uppercase tracking-wide text-white/95">
                        {tl("colWarehouseCode", "창고 (Mã kho)")}
                      </th>
                      <th className="whitespace-nowrap px-2 py-2.5 text-[11px] font-black uppercase tracking-wide text-white/95">
                        {tl("colWarehouse", "창고")}
                      </th>
                      <th className="whitespace-nowrap px-2 py-2.5 text-[11px] font-black uppercase tracking-wide text-white/95">
                        {tl("colCategoryKr", "구분")}
                      </th>
                      <th className="whitespace-nowrap px-2 py-2.5 text-[11px] font-black uppercase tracking-wide text-white/95">
                        Month
                      </th>
                      <th className="whitespace-nowrap px-2 py-2.5 text-[11px] font-black uppercase tracking-wide text-white/95">
                        CODE
                      </th>
                      <th className="whitespace-nowrap px-2 py-2.5 text-[11px] font-black uppercase tracking-wide text-cyan-100">
                        {tl("colStatus", "상태")}
                      </th>
                      <th className="whitespace-nowrap px-2 py-2.5 text-[11px] font-black uppercase tracking-wide text-sky-100">
                        {tl("colUnit", "단위")}
                      </th>
                      <th className="whitespace-nowrap px-2 py-2.5 text-[11px] font-black uppercase tracking-wide text-amber-100">
                        {tl("colActualQty", "실사수량")}
                      </th>
                      <th className="whitespace-nowrap px-2 py-2.5 text-[11px] font-black uppercase tracking-wide text-white/95">
                        {tl("colSystemQtyKr", "SL 전산수량")}
                      </th>
                      <th className="whitespace-nowrap px-2 py-2.5 text-[11px] font-black uppercase tracking-wide text-amber-200">
                        {tl("colMonthlyDiffKr", "GAP")}
                      </th>
                      <th className="whitespace-nowrap px-2 py-2.5 text-[11px] font-black uppercase tracking-wide text-rose-100">
                        {tl("colCodeMonthSwingKr", "월별 차이")}
                      </th>
                      <th className="whitespace-nowrap px-2 py-2.5 text-[11px] font-black uppercase tracking-wide text-emerald-100">
                        {tl("colInventoryAmountPhysicalKr", "재고금액(실사)")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white/90 dark:bg-slate-950/75">
                    {pagedStructuredRows.map((r, idx) => (
                      <tr
                        key={`${r.whCode}-${r.warehouseName}-${r.category}-${r.monthKey}-${r.code}-${tablePage}-${idx}`}
                        className="border-b border-indigo-100/90 transition-colors hover:bg-indigo-100/55 dark:border-indigo-900/50 dark:hover:bg-indigo-900/45"
                        style={{
                          backgroundColor: (() => {
                            const ratio = Math.min(
                              1,
                              Math.abs(r.codeDelta ?? 0) / codeDiffSoftScale,
                            );
                            const alpha = 0.06 + ratio * 0.16;
                            if ((r.codeDelta ?? 0) > 0) {
                              return `rgba(254, 226, 226, ${alpha})`;
                            }
                            if ((r.codeDelta ?? 0) < 0) {
                              return `rgba(219, 234, 254, ${alpha})`;
                            }
                            return idx % 2 === 0
                              ? "rgba(255,255,255,0.8)"
                              : "rgba(238,242,255,0.45)";
                          })(),
                        }}
                      >
                        <td className="px-2 py-1.5 font-mono text-xs font-bold text-indigo-950 dark:text-indigo-100">
                          {r.whCode}
                        </td>
                        <td
                          className="max-w-[220px] truncate px-2 py-1.5 text-slate-800 dark:text-slate-200"
                          title={
                            r.warehouseName !== "—"
                              ? String(r.warehouseName)
                              : undefined
                          }
                        >
                          {r.warehouseName}
                        </td>
                        <td className="px-2 py-1.5 text-slate-800 dark:text-slate-200">
                          {r.category}
                        </td>
                        <td className="px-2 py-1.5 font-semibold text-indigo-900 dark:text-indigo-200">
                          {r.month}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-slate-800 dark:text-slate-200">
                          {r.code === "∅"
                            ? tl("codeEmptyLabel", "(코드 없음)")
                            : r.code}
                        </td>
                        <td
                          className="max-w-[160px] truncate px-2 py-1.5 text-[11px] font-semibold text-cyan-900 dark:text-cyan-200"
                          title={
                            r.status !== "—" ? String(r.status) : undefined
                          }
                        >
                          {r.status}
                        </td>
                        <td
                          className="max-w-[100px] truncate px-2 py-1.5 text-[11px] font-semibold text-sky-900 dark:text-sky-200"
                          title={r.unit !== "—" ? String(r.unit) : undefined}
                        >
                          {r.unit}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums font-semibold text-amber-900 dark:text-amber-200">
                          {r.actualQty.toLocaleString("vi-VN", {
                            maximumFractionDigits: 4,
                          })}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums text-slate-800 dark:text-slate-200">
                          {r.sysQty.toLocaleString("vi-VN", {
                            maximumFractionDigits: 4,
                          })}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums font-bold text-orange-700 dark:text-orange-400">
                          {r.monthlyDiff.toLocaleString("vi-VN", {
                            maximumFractionDigits: 4,
                          })}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums font-bold text-rose-700 dark:text-rose-400">
                          {r.codeDelta.toLocaleString("vi-VN", {
                            maximumFractionDigits: 4,
                          })}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                          {formatKRW(r.amountActual ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-indigo-200/80 bg-white/85 px-3 py-2 text-[11px] font-bold text-indigo-950 dark:border-indigo-800/90 dark:bg-slate-950/85 dark:text-indigo-100">
                <span className="tabular-nums">
                  {tl(
                    "tablePageSummary",
                    "페이지 {{page}}/{{total}} · {{count}}행",
                    {
                      page: tablePage,
                      total: tableTotalPages,
                      count: filteredStructuredRows.length,
                    },
                  )}
                </span>
                <div className="dashboard-no-print flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                    disabled={tablePage <= 1}
                    className="rounded-lg border-2 border-indigo-400/70 bg-white px-3 py-1 text-[11px] font-black text-indigo-800 shadow-sm transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-indigo-500 dark:bg-indigo-950/80 dark:text-indigo-100 dark:hover:bg-indigo-900"
                  >
                    {tl("paginationPrev", "이전")}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setTablePage((p) => Math.min(tableTotalPages, p + 1))
                    }
                    disabled={tablePage >= tableTotalPages}
                    className="rounded-lg border-2 border-indigo-400/70 bg-white px-3 py-1 text-[11px] font-black text-indigo-800 shadow-sm transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-45 dark:border-indigo-500 dark:bg-indigo-950/80 dark:text-indigo-100 dark:hover:bg-indigo-900"
                  >
                    {tl("paginationNext", "다음")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
