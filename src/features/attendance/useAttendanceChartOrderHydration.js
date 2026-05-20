import { useEffect } from "react";
import { CHART_ORDER_KIND, hydrateChartOrder } from "@/utils/chartOrderStorage";

/** Nạp thứ tự biểu đồ combo từ storage theo user. */
export function useAttendanceChartOrderHydration(
  userEmailKey,
  setComboChartDeptOrder,
  setComboProductionDeptOrder,
) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const order = await hydrateChartOrder(
        userEmailKey,
        CHART_ORDER_KIND.ATTENDANCE_DEPT,
      );
      if (!cancelled) setComboChartDeptOrder(order);
    })();
    return () => {
      cancelled = true;
    };
  }, [userEmailKey, setComboChartDeptOrder]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const order = await hydrateChartOrder(
        userEmailKey,
        CHART_ORDER_KIND.COMBO_PRODUCTION_DEPT_ORDER,
      );
      if (!cancelled) setComboProductionDeptOrder(order);
    })();
    return () => {
      cancelled = true;
    };
  }, [userEmailKey, setComboProductionDeptOrder]);
}
