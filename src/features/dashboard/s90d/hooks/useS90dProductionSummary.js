import { useCallback, useEffect, useMemo, useState } from "react";
import { get, ref } from "firebase/database";
import { db } from "@/services/firebase";
import { WORKPLACE_PRODUCTION_PATHS_S90D } from "../../workplace/workplaceProductionPaths";
import {
  buildS90dSummary,
  listWeekKeysFromBarData,
} from "../lib/buildS90dSummary";
import {
  buildEmptyDailySummary,
  buildS90dMonthDailySummaries,
  formatS90dMonthLabel,
  listCurrentMonthDateKeys,
} from "../lib/buildS90dDailySummary";
import { buildS90dAllProcessShiftSummaries } from "../lib/buildS90dProcessShiftSummary";
import {
  buildEmptyProcessShiftSummaries,
  getS90dDemoAllProcessShiftSummaries,
  getS90dDemoDailySummary,
  getS90dDemoSummary,
} from "../lib/s90dDemoSummary";

export function useS90dProductionSummary() {
  const [barData, setBarData] = useState(null);
  const [ngData, setNgData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedWeek, setSelectedWeek] = useState("");

  const monthReferenceDate = useMemo(() => new Date(), []);
  const monthLabel = useMemo(
    () => formatS90dMonthLabel(monthReferenceDate),
    [monthReferenceDate],
  );
  const monthDayKeys = useMemo(
    () => listCurrentMonthDateKeys(monthReferenceDate),
    [monthReferenceDate],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [barSnap, ngSnap] = await Promise.all([
        get(ref(db, WORKPLACE_PRODUCTION_PATHS_S90D.barRoot)),
        get(ref(db, WORKPLACE_PRODUCTION_PATHS_S90D.ngRoot)),
      ]);
      const nextBar = barSnap.exists() ? barSnap.val() : {};
      const nextNg = ngSnap.exists() ? ngSnap.val() : {};
      setBarData(nextBar);
      setNgData(nextNg);

      const weeks = listWeekKeysFromBarData(nextBar);
      setSelectedWeek((prev) =>
        prev && weeks.includes(prev) ? prev : weeks[0] ?? "",
      );
    } catch (err) {
      setError(err?.message || "Không tải được dữ liệu Firebase");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const weekOptions = useMemo(
    () => listWeekKeysFromBarData(barData ?? {}),
    [barData],
  );

  const liveSummary = useMemo(
    () =>
      buildS90dSummary({
        barData,
        ngData,
        weekKey: selectedWeek,
      }),
    [barData, ngData, selectedWeek],
  );

  const liveMonthDailySummaries = useMemo(
    () =>
      buildS90dMonthDailySummaries({
        barData,
        ngData,
        referenceDate: monthReferenceDate,
      }),
    [barData, ngData, monthReferenceDate],
  );

  const isDemo = !liveSummary.hasData;

  const summary = useMemo(
    () => (liveSummary.hasData ? liveSummary : getS90dDemoSummary()),
    [liveSummary],
  );

  const monthDailySummaries = useMemo(() => {
    if (!isDemo) {
      return liveMonthDailySummaries.map((daily) => {
        const base = daily.hasData
          ? daily
          : buildEmptyDailySummary(daily.dateKey);
        return {
          ...base,
          processShiftSummaries: buildS90dAllProcessShiftSummaries({
            barData,
            ngData,
            dateKey: base.dateKey,
            dateLabel: base.dateLabel,
          }),
        };
      });
    }

    return monthDayKeys.map((dateKey, index) => {
      const daily =
        index === 0
          ? getS90dDemoDailySummary(dateKey)
          : buildEmptyDailySummary(dateKey);
      return {
        ...daily,
        processShiftSummaries:
          index === 0
            ? getS90dDemoAllProcessShiftSummaries(dateKey)
            : buildEmptyProcessShiftSummaries(daily.dateLabel),
      };
    });
  }, [isDemo, liveMonthDailySummaries, monthDayKeys, barData, ngData]);

  const weekProcessShiftSummaries = useMemo(() => {
    const weekLabel = selectedWeek
      ? selectedWeek.replace("_", " / ")
      : "TOTAL";
    if (!isDemo) {
      return buildS90dAllProcessShiftSummaries({
        barData,
        ngData,
        weekKey: selectedWeek,
        dateLabel: weekLabel,
      });
    }
    return getS90dDemoAllProcessShiftSummaries("2026-07-01").map((item) => ({
      ...item,
      dateLabel: weekLabel,
    }));
  }, [isDemo, barData, ngData, selectedWeek]);

  return {
    loading,
    error,
    selectedWeek,
    setSelectedWeek,
    weekOptions,
    monthLabel,
    monthDayKeys,
    summary,
    monthDailySummaries,
    weekProcessShiftSummaries,
    isDemo,
    reload: loadData,
  };
}
