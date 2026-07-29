import { useMemo, useSyncExternalStore, useDeferredValue } from "react";
import { shouldSkipAnnualLeaveForAttendanceRoot } from "@/features/attendance/attendanceSeasonalStt";
import {
  buildAttendanceAnnualLeaveDeductionsByMnv,
  buildAttendanceAnnualLeaveDerivedMaps,
  buildAttendanceAnnualLeaveUsageDetailByEmpKey,
} from "./annualLeaveBalanceLookup";
import { buildLiveAnnualLeaveBalanceByMnv } from "./annualLeaveDerived";
import {
  buildAnnualLeaveMonthWorkSummaryByEmpKey,
  listAnnualLeaveAccrualYearMonths,
  resolveAccrualYearMonthsAttendanceRange,
} from "./annualLeavePayrollAccrual";
import {
  getAnnualLeaveYearSnapshot,
  getAttendanceJoinMonthsSnapshot,
  getAttendanceYearSnapshot,
  isAnnualLeaveYearSnapshotReady,
  isAttendanceJoinMonthsSnapshotReady,
  isAttendanceYearSnapshotReady,
  subscribeAnnualLeaveYear,
  subscribeAttendanceJoinMonths,
  subscribeAttendanceYear,
} from "./annualLeaveLiveStore";

function useAnnualLeaveYearExternal(year, enabled) {
  const subscribe = useMemo(() => {
    if (!enabled || !year || !Number.isFinite(Number(year))) {
      return () => () => {};
    }
    return (onChange) => subscribeAnnualLeaveYear(year, onChange);
  }, [year, enabled]);

  const getSnapshot = useMemo(() => {
    if (!enabled || !year || !Number.isFinite(Number(year))) {
      return () => null;
    }
    return () => getAnnualLeaveYearSnapshot(year);
  }, [year, enabled]);

  const getReady = useMemo(() => {
    if (!enabled || !year || !Number.isFinite(Number(year))) {
      return () => true;
    }
    return () => isAnnualLeaveYearSnapshotReady(year);
  }, [year, enabled]);

  const data = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const ready = useSyncExternalStore(subscribe, getReady, getReady);

  return { data, ready };
}

function useAttendanceYearExternal(
  attendanceRootPath,
  year,
  skipAttendance,
  throughDateKey = null,
) {
  const subscribe = useMemo(() => {
    if (skipAttendance) return () => () => {};
    return (onChange) =>
      subscribeAttendanceYear(
        attendanceRootPath,
        year,
        onChange,
        throughDateKey,
      );
  }, [attendanceRootPath, year, skipAttendance, throughDateKey]);

  const getSnapshot = useMemo(() => {
    if (skipAttendance) return () => null;
    return () =>
      getAttendanceYearSnapshot(attendanceRootPath, year, throughDateKey);
  }, [attendanceRootPath, year, skipAttendance, throughDateKey]);

  const getReady = useMemo(() => {
    if (skipAttendance) return () => true;
    return () =>
      isAttendanceYearSnapshotReady(attendanceRootPath, year, throughDateKey);
  }, [attendanceRootPath, year, skipAttendance, throughDateKey]);

  const data = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const ready = useSyncExternalStore(subscribe, getReady, getReady);

  return { data, ready };
}

function useAttendanceJoinMonthsExternal(
  attendanceRootPath,
  year,
  yearMonths,
  skipJoinMonthAccrual,
) {
  const yearMonthsKey = yearMonths.join(",");
  const range = useMemo(
    () => resolveAccrualYearMonthsAttendanceRange(yearMonths),
    [yearMonths],
  );

  const subscribe = useMemo(() => {
    if (skipJoinMonthAccrual || !yearMonths.length) {
      return () => () => {};
    }
    return (onChange) =>
      subscribeAttendanceJoinMonths(
        attendanceRootPath,
        year,
        yearMonthsKey,
        range,
        onChange,
      );
  }, [
    attendanceRootPath,
    year,
    yearMonthsKey,
    range,
    skipJoinMonthAccrual,
    yearMonths.length,
  ]);

  const getSnapshot = useMemo(() => {
    if (skipJoinMonthAccrual || !yearMonths.length) return () => null;
    return () =>
      getAttendanceJoinMonthsSnapshot(
        attendanceRootPath,
        year,
        yearMonthsKey,
      );
  }, [
    attendanceRootPath,
    year,
    yearMonthsKey,
    skipJoinMonthAccrual,
    yearMonths.length,
  ]);

  const getReady = useMemo(() => {
    if (skipJoinMonthAccrual || !yearMonths.length) return () => true;
    return () =>
      isAttendanceJoinMonthsSnapshotReady(
        attendanceRootPath,
        year,
        yearMonthsKey,
      );
  }, [
    attendanceRootPath,
    year,
    yearMonthsKey,
    skipJoinMonthAccrual,
    yearMonths.length,
  ]);

  const data = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const ready = useSyncExternalStore(subscribe, getReady, getReady);

  return { data, ready };
}

/**
 * Dữ liệu phép năm live — một listener RTDB dùng chung (store) cho cả app.
 * - `throughDateKey`: lũy kế PN đến ngày này (điểm danh / lương).
 * - `yearMonthPrefix`: chỉ trong tháng.
 * - Không filter: cả kỳ trong năm (quản lý phép năm).
 */
export function useAnnualLeaveLiveData(
  year,
  {
    attendanceRootPath = "attendance",
    enabled = true,
    throughDateKey = null,
    yearMonthPrefix = null,
    includeUsageDetail = true,
    includeBalanceMap = true,
    /** Khi false: chỉ lắng nghe `annualLeave/{year}` — không subscribe điểm danh cả năm. */
    includeAttendance = true,
    /** Tải giờ công các tháng trong kỳ tính phép (lưới tháng giờ công). */
    includePayrollMonthAccrual = false,
    /** @deprecated Dùng `includePayrollMonthAccrual`. */
    includeJoinMonthAccrual = false,
  } = {},
) {
  const includePayrollAccrual =
    includePayrollMonthAccrual || includeJoinMonthAccrual;
  const skipAttendance =
    !enabled ||
    !includeAttendance ||
    shouldSkipAnnualLeaveForAttendanceRoot(attendanceRootPath);
  const skipPayrollMonthAccrual =
    !enabled ||
    !includePayrollAccrual ||
    shouldSkipAnnualLeaveForAttendanceRoot(attendanceRootPath);

  const { data: yearData, ready: yearReady } = useAnnualLeaveYearExternal(
    year,
    enabled,
  );

  const accrualYearMonths = useMemo(() => {
    if (skipPayrollMonthAccrual || !yearReady || !yearData) return [];
    return listAnnualLeaveAccrualYearMonths(yearData, year);
  }, [skipPayrollMonthAccrual, yearReady, yearData, year]);

  const { data: payrollMonthAttendanceRoot, ready: payrollMonthAttendanceReady } =
    useAttendanceJoinMonthsExternal(
      attendanceRootPath,
      year,
      accrualYearMonths,
      skipPayrollMonthAccrual,
    );

  const { data: attendanceRoot, ready: attendanceReady } =
    useAttendanceYearExternal(
      attendanceRootPath,
      year,
      skipAttendance,
      throughDateKey,
    );

  const deductionFilter = useMemo(() => {
    if (throughDateKey) return { throughDateKey };
    if (yearMonthPrefix) return { yearMonthPrefix };
    return null;
  }, [throughDateKey, yearMonthPrefix]);

  const deferredAttendanceRoot = useDeferredValue(attendanceRoot);
  const deferredPayrollMonthAttendanceRoot = useDeferredValue(
    payrollMonthAttendanceRoot,
  );

  const payrollRootForMonthAccrual = skipAttendance
    ? deferredPayrollMonthAttendanceRoot
    : deferredAttendanceRoot;

  const attendanceDerived = useMemo(() => {
    if (skipAttendance) {
      return {
        deductionsByEmpKey: {},
        attendanceMonthlyByEmpKey: {},
      };
    }
    if (includeUsageDetail) {
      return {
        deductionsByEmpKey: buildAttendanceAnnualLeaveDeductionsByMnv(
          attendanceRoot,
          year,
          deductionFilter,
        ),
        attendanceMonthlyByEmpKey: {},
      };
    }
    return buildAttendanceAnnualLeaveDerivedMaps(
      attendanceRoot,
      year,
      deductionFilter,
    );
  }, [attendanceRoot, year, deductionFilter, skipAttendance, includeUsageDetail]);

  const deductionsByEmpKey = attendanceDerived.deductionsByEmpKey;
  const attendanceMonthlyByEmpKey = attendanceDerived.attendanceMonthlyByEmpKey;

  const monthWorkSummaryByEmpKey = useMemo(() => {
    if (!yearData) return {};
    const payrollRoot = payrollRootForMonthAccrual;
    if (!payrollRoot) return {};
    return buildAnnualLeaveMonthWorkSummaryByEmpKey(
      payrollRoot,
      year,
      yearData,
      { attendanceRootPath },
    );
  }, [
    payrollRootForMonthAccrual,
    year,
    yearData,
    attendanceRootPath,
  ]);

  const usageDetailByEmpKey = useMemo(
    () =>
      skipAttendance || !includeUsageDetail
        ? {}
        : buildAttendanceAnnualLeaveUsageDetailByEmpKey(
            attendanceRoot,
            year,
            deductionFilter,
          ),
    [
      attendanceRoot,
      year,
      deductionFilter,
      skipAttendance,
      includeUsageDetail,
    ],
  );

  const balanceByMnv = useMemo(
    () =>
      skipAttendance || !includeBalanceMap
        ? {}
        : buildLiveAnnualLeaveBalanceByMnv(
            yearData,
            deductionsByEmpKey,
            year,
            usageDetailByEmpKey,
            attendanceMonthlyByEmpKey,
            monthWorkSummaryByEmpKey,
          ),
    [
      yearData,
      deductionsByEmpKey,
      skipAttendance,
      includeBalanceMap,
      year,
      usageDetailByEmpKey,
      attendanceMonthlyByEmpKey,
      monthWorkSummaryByEmpKey,
    ],
  );

  const loading =
    !yearReady ||
    (!skipAttendance && !attendanceReady) ||
    (!skipPayrollMonthAccrual &&
      accrualYearMonths.length > 0 &&
      !payrollMonthAttendanceReady);

  return {
    yearData,
    attendanceRoot: skipAttendance ? null : attendanceRoot,
    deductionsByEmpKey,
    attendanceMonthlyByEmpKey,
    monthWorkSummaryByEmpKey,
    balanceByMnv,
    usageDetailByEmpKey,
    loading,
    throughDateKey,
    yearMonthPrefix,
  };
}
