import { useState, useEffect, useCallback } from "react";
import { db, ref, get } from "@/services/firebase";
import { useFirebaseValue } from "@/hooks/useFirebaseValue";
import {
  DASHBOARD_QUERY_CACHE_TTL_MS,
  getCached,
  invalidateCached,
  setCached,
  PERFORMANCE_CHART_STORE_CACHE_KEY,
} from "@/utils/queryCache";
import { deriveRowsForYear } from "@/utils/performanceChartData";

const FB_PATH = "performanceData";

/**
 * Đồng bộ `performanceData` từ RTDB + derive rows theo `selectedYear`.
 * Cache liên trang: hiển thị snapshot cũ ngay, listener cập nhật ngầm.
 */
export function usePerformanceYearData(selectedYear) {
  const cachedInit = getCached(
    PERFORMANCE_CHART_STORE_CACHE_KEY,
    DASHBOARD_QUERY_CACHE_TTL_MS,
  );
  const [yearDataStore, setYearDataStore] = useState(
    () => cachedInit?.data ?? {},
  );
  const [data, setData] = useState(() =>
    deriveRowsForYear(selectedYear, cachedInit?.data?.[selectedYear]),
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: remoteStore, loading: listenerLoading } =
    useFirebaseValue(FB_PATH);

  const hasCachedStore =
    cachedInit?.data && Object.keys(cachedInit.data).length > 0;
  const loading = listenerLoading && !hasCachedStore;

  useEffect(() => {
    if (remoteStore === undefined) return;
    const store = remoteStore || {};
    setYearDataStore(store);
    setCached(PERFORMANCE_CHART_STORE_CACHE_KEY, store);
  }, [remoteStore]);

  useEffect(() => {
    const rows = deriveRowsForYear(selectedYear, yearDataStore[selectedYear]);
    setData(rows);
  }, [selectedYear, yearDataStore]);

  const refresh = useCallback(() => {
    invalidateCached(PERFORMANCE_CHART_STORE_CACHE_KEY);
    setIsRefreshing(true);
    void get(ref(db, FB_PATH))
      .then((snapshot) => {
        const store = snapshot.val() || {};
        setYearDataStore(store);
        setCached(PERFORMANCE_CHART_STORE_CACHE_KEY, store);
      })
      .finally(() => {
        setIsRefreshing(false);
      });
  }, []);

  return {
    setYearDataStore,
    data,
    setData,
    loading,
    isRefreshing,
    refresh,
  };
}
