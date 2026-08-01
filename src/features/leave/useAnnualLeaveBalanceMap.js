import { useAnnualLeaveLiveData } from "./useAnnualLeaveLiveData";

/**
 * Map MNV → BALANCE cho cột điểm danh / giờ công.
 * - `enabled: false` — không subscribe Firebase.
 * - `enabled: true` — tính BALANCE đúng từ điểm danh + phép năm (chỉ khi user bấm «Lấy phép năm»).
 */
export function useAnnualLeaveBalanceMap(year, options = {}) {
  const { enabled = true, ...rest } = options;

  const live = useAnnualLeaveLiveData(year, {
    enabled,
    includeUsageDetail: false,
    includeBalanceMap: true,
    includeAttendance: true,
    includePayrollMonthAccrual: true,
    ...rest,
  });

  return {
    balanceByMnv: live.balanceByMnv,
    yearData: live.yearData,
    loading: enabled ? live.loading : false,
  };
}
