import { useAnnualLeaveLiveData } from "./useAnnualLeaveLiveData";

/**
 * Map MNV → BALANCE live (không build chi tiết PN — lazy khi mở modal).
 * @param {number} year
 * @param {{ throughDateKey?: string|null, yearMonthPrefix?: string|null, attendanceRootPath?: string, enabled?: boolean }} options
 */
export function useAnnualLeaveBalanceMap(year, options = {}) {
  const { balanceByMnv, yearData, loading } = useAnnualLeaveLiveData(year, {
    includeUsageDetail: false,
    ...options,
  });
  return { balanceByMnv, yearData, loading };
}
