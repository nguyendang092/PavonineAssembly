import { useAnnualLeaveYearExternal } from "./annualLeaveLiveExternalHooks";

/** Chỉ subscribe `annualLeave/{year}` — nhẹ, dùng cho toolbar / lọc. */
export function useAnnualLeaveYearData(year, enabled = true) {
  const { data: yearData, ready: yearReady } = useAnnualLeaveYearExternal(
    year,
    enabled,
  );

  return {
    yearData,
    yearReady,
    yearLoading: !yearReady,
  };
}
