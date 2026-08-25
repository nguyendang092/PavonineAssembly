import { useState, useEffect } from "react";
import { useFirebaseValue } from "@/hooks/useFirebaseValue";
import { deriveRowsForYear } from "@/utils/performanceChartData";

const FB_PATH = "performanceData";

/**
 * Đồng bộ `performanceData` từ RTDB + derive rows theo `selectedYear`.
 * Một nguồn để tránh đóng `selectedYear` cũ trong listener Firebase.
 */
export function usePerformanceYearData(selectedYear) {
  const { data: remoteStore, loading } = useFirebaseValue(FB_PATH);
  const [yearDataStore, setYearDataStore] = useState({});
  const [data, setData] = useState(() =>
    deriveRowsForYear(selectedYear, null),
  );

  useEffect(() => {
    setYearDataStore(remoteStore || {});
  }, [remoteStore]);

  useEffect(() => {
    const rows = deriveRowsForYear(selectedYear, yearDataStore[selectedYear]);
    setData(rows);
  }, [selectedYear, yearDataStore]);

  return { setYearDataStore, data, setData, loading };
}
