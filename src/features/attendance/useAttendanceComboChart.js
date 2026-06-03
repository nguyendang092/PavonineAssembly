import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  startTransition,
} from "react";
import {
  CHART_ORDER_KIND,
  persistChartOrder,
  applyOrderToAttendanceRows,
} from "@/utils/chartOrderStorage";
import {
  normalizeTextValue,
  getAttendanceComboFlags,
} from "./attendanceComboStats";
import {
  COMBO_CHART_METRIC_KEYS,
  COMBO_STAT_LABEL_DEFAULTS,
  attendanceProductionDeptMatchKey,
  applyProductionStatsRowOrder,
  resolveComboChartDepartmentLabel,
} from "./attendanceComboChartConfig";

/**
 * Dữ liệu + hiệu ứng lazy cho modal biểu đồ combo (tách khỏi AttendanceList).
 */
export function useAttendanceComboChart({
  deferredFilteredEmployees,
  comboDashboardGroup,
  comboProductionDeptOrder,
  setComboProductionDeptOrder,
  comboChartDeptOrder,
  userEmailKey,
  showComboChartModal,
  comboChartBodyReady,
  setComboChartBodyReady,
  comboChartCardsVisibleCount,
  setComboChartCardsVisibleCount,
  comboStatDetailKey,
  setComboStatDetailKey,
  normalizeDepartment,
  tl,
}) {
  const comboProductionDeptCatalog = useMemo(() => {
    if (!showComboChartModal) return [];
    const byMk = new Map();
    for (const emp of deferredFilteredEmployees) {
      const label = normalizeTextValue(emp.boPhan);
      if (!label) continue;
      const mk = attendanceProductionDeptMatchKey(
        normalizeDepartment,
        emp.boPhan,
      );
      if (!mk) continue;
      if (!byMk.has(mk)) byMk.set(mk, { matchKey: mk, label });
    }
    return Array.from(byMk.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "vi", { sensitivity: "base" }),
    );
  }, [deferredFilteredEmployees, normalizeDepartment, showComboChartModal]);

  const deferredFilteredForComboStats = useMemo(() => {
    if (!showComboChartModal) return [];
    if (comboDashboardGroup !== "production") return deferredFilteredEmployees;
    const catalogKeys = new Set(
      comboProductionDeptCatalog.map((c) => c.matchKey),
    );
    if (comboProductionDeptOrder.length === 0) {
      return deferredFilteredEmployees.filter((emp) => {
        const mk = attendanceProductionDeptMatchKey(
          normalizeDepartment,
          emp.boPhan,
        );
        return mk && catalogKeys.has(mk);
      });
    }
    const allow = new Set(comboProductionDeptOrder);
    return deferredFilteredEmployees.filter((emp) => {
      const mk = attendanceProductionDeptMatchKey(
        normalizeDepartment,
        emp.boPhan,
      );
      return mk && allow.has(mk);
    });
  }, [
    deferredFilteredEmployees,
    comboDashboardGroup,
    comboProductionDeptOrder,
    comboProductionDeptCatalog,
    normalizeDepartment,
    showComboChartModal,
  ]);

  const effectiveProductionDeptOrderForSort = useMemo(
    () =>
      comboProductionDeptOrder.length > 0
        ? comboProductionDeptOrder
        : comboProductionDeptCatalog.map((c) => c.matchKey),
    [comboProductionDeptOrder, comboProductionDeptCatalog],
  );

  const comboProductionDeptRankByMk = useMemo(() => {
    const m = new Map();
    effectiveProductionDeptOrderForSort.forEach((mk, i) => {
      m.set(mk, i + 1);
    });
    return m;
  }, [effectiveProductionDeptOrderForSort]);

  const getComboProductionDeptChartRank = useCallback(
    (departmentLabel) => {
      const mk = attendanceProductionDeptMatchKey(
        normalizeDepartment,
        departmentLabel,
      );
      if (!mk) return null;
      return comboProductionDeptRankByMk.get(mk) ?? null;
    },
    [comboProductionDeptRankByMk, normalizeDepartment],
  );

  const persistComboProductionDeptOrder = useCallback(
    (keys) => {
      const list = Array.isArray(keys)
        ? keys.filter((x) => typeof x === "string")
        : [];
      setComboProductionDeptOrder(list);
      void persistChartOrder(
        userEmailKey,
        CHART_ORDER_KIND.COMBO_PRODUCTION_DEPT_ORDER,
        list,
      );
    },
    [userEmailKey, setComboProductionDeptOrder],
  );

  const comboChartData = useMemo(() => {
    if (!showComboChartModal) return [];
    const map = new Map();
    const emptyMetrics = () =>
      Object.fromEntries(COMBO_CHART_METRIC_KEYS.map((k) => [k, 0]));
    deferredFilteredForComboStats.forEach((emp) => {
      const flags = getAttendanceComboFlags(emp);
      const department = resolveComboChartDepartmentLabel(
        normalizeDepartment,
        emp.boPhan,
        tl("unknownDepartment", "Chưa phân bộ phận"),
      );
      const row = map.get(department) || {
        department,
        total: 0,
        ...emptyMetrics(),
      };
      row.total += 1;
      for (const k of COMBO_CHART_METRIC_KEYS) {
        if (flags[k]) row[k] += 1;
      }
      map.set(department, row);
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [deferredFilteredForComboStats, normalizeDepartment, tl, showComboChartModal]);

  const comboChartDataOrdered = useMemo(() => {
    if (!showComboChartModal) return [];
    if (comboDashboardGroup !== "production") {
      return applyOrderToAttendanceRows(comboChartData, comboChartDeptOrder);
    }
    return applyProductionStatsRowOrder(
      comboChartData,
      effectiveProductionDeptOrderForSort,
      normalizeDepartment,
    );
  }, [
    comboChartData,
    comboChartDeptOrder,
    comboDashboardGroup,
    effectiveProductionDeptOrderForSort,
    normalizeDepartment,
    showComboChartModal,
  ]);

  const comboDashboardStats = useMemo(() => {
    if (!showComboChartModal) {
      const zero = () =>
        Object.fromEntries(COMBO_CHART_METRIC_KEYS.map((k) => [k, 0]));
      return { total: 0, ...zero() };
    }
    const zero = () =>
      Object.fromEntries(COMBO_CHART_METRIC_KEYS.map((k) => [k, 0]));
    const stats = comboChartData.reduce(
      (acc, row) => {
        acc.total += row.total;
        for (const k of COMBO_CHART_METRIC_KEYS) {
          acc[k] += row[k];
        }
        return acc;
      },
      { total: 0, ...zero() },
    );
    return stats;
  }, [comboChartData, showComboChartModal]);

  const comboChartRowsVisible = useMemo(
    () => comboChartDataOrdered.slice(0, comboChartCardsVisibleCount),
    [comboChartDataOrdered, comboChartCardsVisibleCount],
  );

  const comboStatEmployeesByKey = useMemo(() => {
    if (!showComboChartModal) {
      return {
        total: [],
        ...Object.fromEntries(COMBO_CHART_METRIC_KEYS.map((k) => [k, []])),
      };
    }
    const list = deferredFilteredForComboStats;
    const buckets = {
      total: [...list],
      ...Object.fromEntries(COMBO_CHART_METRIC_KEYS.map((k) => [k, []])),
    };
    for (const emp of list) {
      const f = getAttendanceComboFlags(emp);
      for (const k of COMBO_CHART_METRIC_KEYS) {
        if (f[k]) buckets[k].push(emp);
      }
    }
    return buckets;
  }, [deferredFilteredForComboStats, showComboChartModal]);

  const comboStatLabelByKey = useMemo(() => {
    const fromKeys = Object.fromEntries(
      COMBO_CHART_METRIC_KEYS.map((k) => [
        k,
        tl(k, COMBO_STAT_LABEL_DEFAULTS[k]),
      ]),
    );
    return {
      total: tl("totalEmployees", "Tổng số nhân viên"),
      ...fromKeys,
    };
  }, [tl]);

  useEffect(() => {
    if (!showComboChartModal) {
      setComboStatDetailKey(null);
      setComboChartBodyReady(false);
      setComboChartCardsVisibleCount(0);
      return;
    }
    setComboChartBodyReady(false);
    setComboChartCardsVisibleCount(0);
    let cancelled = false;
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        startTransition(() => {
          if (!cancelled) setComboChartBodyReady(true);
        });
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [
    showComboChartModal,
    comboDashboardGroup,
    setComboStatDetailKey,
    setComboChartBodyReady,
    setComboChartCardsVisibleCount,
  ]);

  useLayoutEffect(() => {
    if (!showComboChartModal || !comboChartBodyReady) return;
    const total = comboChartDataOrdered.length;
    if (total === 0) {
      setComboChartCardsVisibleCount(0);
      return undefined;
    }
    const batch = 6;
    let count = Math.min(batch, total);
    setComboChartCardsVisibleCount(count);
    if (count >= total) return undefined;
    let cancelled = false;
    const ric =
      typeof window !== "undefined" && window.requestIdleCallback
        ? window.requestIdleCallback.bind(window)
        : (cb) => setTimeout(cb, 48);
    const tick = () => {
      if (cancelled) return;
      count = Math.min(count + batch, total);
      setComboChartCardsVisibleCount(count);
      if (count < total) ric(tick, { timeout: 120 });
    };
    ric(tick, { timeout: 120 });
    return () => {
      cancelled = true;
    };
  }, [
    showComboChartModal,
    comboChartBodyReady,
    comboChartDataOrdered,
    setComboChartCardsVisibleCount,
  ]);

  useEffect(() => {
    if (!showComboChartModal) return;
    const html = document.documentElement;
    const body = document.body;
    const mainScroll = document.getElementById("app-main-scroll");
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevMainOverflow = mainScroll?.style.overflow ?? "";
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    if (mainScroll) mainScroll.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      if (mainScroll) mainScroll.style.overflow = prevMainOverflow;
    };
  }, [showComboChartModal]);

  useEffect(() => {
    if (!comboStatDetailKey) return;
    const onKey = (e) => {
      if (e.key === "Escape") setComboStatDetailKey(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [comboStatDetailKey, setComboStatDetailKey]);

  useEffect(() => {
    if (!showComboChartModal || !comboStatDetailKey) return;
    const s = comboDashboardStats;
    const key = comboStatDetailKey;
    const n =
      key === "total"
        ? s.total
        : Object.prototype.hasOwnProperty.call(s, key)
          ? s[key]
          : -1;
    if (n === 0) setComboStatDetailKey(null);
  }, [
    showComboChartModal,
    comboStatDetailKey,
    comboDashboardStats,
    setComboStatDetailKey,
  ]);

  return {
    comboProductionDeptCatalog,
    getComboProductionDeptChartRank,
    persistComboProductionDeptOrder,
    comboChartData,
    comboChartDataOrdered,
    comboDashboardStats,
    comboChartRowsVisible,
    comboStatEmployeesByKey,
    comboStatLabelByKey,
  };
}
