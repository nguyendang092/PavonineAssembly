import { useState, useEffect } from "react";
import { db, ref, onValue } from "@/services/firebase";
import { deriveRowsForYear } from "@/utils/performanceChartData";

const FB_PATH = "performanceData";

/**
 * Đồng bộ `performanceData` từ RTDB + derive rows theo `selectedYear`.
 * Một nguồn để tránh đóng `selectedYear` cũ trong listener Firebase.
 */
export function usePerformanceYearData(selectedYear) {
  const [yearDataStore, setYearDataStore] = useState({});
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(() =>
    deriveRowsForYear(selectedYear, null),
  );

  useEffect(() => {
    const performanceRef = ref(db, FB_PATH);
    const unsub = onValue(performanceRef, (snapshot) => {
      setYearDataStore(snapshot.val() || {});
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const rows = deriveRowsForYear(selectedYear, yearDataStore[selectedYear]);
    setData(rows);
  }, [selectedYear, yearDataStore]);

  return { setYearDataStore, data, setData, loading };
}
