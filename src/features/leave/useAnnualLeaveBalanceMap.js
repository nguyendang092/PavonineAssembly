import { useAnnualLeaveLiveData } from "./useAnnualLeaveLiveData";

/**
 * Map MNV → BALANCE live.
 * @param {number} year
 * @param {{ throughDateKey?: string|null, yearMonthPrefix?: string|null, attendanceRootPath?: string, enabled?: boolean }} options
 */
export function useAnnualLeaveBalanceMap(year, options = {}) {
  const {
    balanceByMnv,
    usageDetailByEmpKey,
    yearData,
    loading,
  } = useAnnualLeaveLiveData(year, options);
  return { balanceByMnv, usageDetailByEmpKey, yearData, loading };
}
