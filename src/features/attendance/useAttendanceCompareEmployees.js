import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  startTransition,
} from "react";
import { db, get, ref } from "@/services/firebase";
import { reconcileAttendanceDayRowsFromRaw } from "./mergeAttendanceDayRows";
import {
  previousDateOf,
  resolveOrderedProductionMatchKeys,
  buildCompareSttRankMap,
  buildOfficialCompareDeptEmployeeMap,
  buildCompareChartAlignedDeptEmployeeMap,
  mergeCompareDepartmentListOfficial,
  mergeCompareDepartmentListChartAligned,
  computeCompareRows,
  buildCompareEmployeesResult,
} from "./attendanceCompareEmployeesLogic";
import { isSeasonalAttendanceRoot } from "./attendanceSeasonalStt";
import { sortEmployeesStableAsc } from "./attendanceListSort";

const COMPARE_DAY_CACHE_MAX = 12;

export function useAttendanceCompareEmployees({
  attendanceRootPath,
  selectedDate,
  employees = [],
  normalizeDepartment,
  comboProductionDeptOrder,
  comboProductionDeptCatalog,
  setAlert,
  tl,
}) {
  const todayKey = new Date().toISOString().slice(0, 10);
  const [compareEmployeesOpen, setCompareEmployeesOpen] = useState(false);
  const [compareEmployeesBusy, setCompareEmployeesBusy] = useState(false);
  const [compareEmployeesResult, setCompareEmployeesResult] = useState(null);
  const [compareCriteria, setCompareCriteria] = useState({
    compareDate: todayKey,
    previousDate: "",
    department: "",
  });
  const compareDayRowsCacheRef = useRef(new Map());
  const compareBusyRef = useRef(false);

  useEffect(() => {
    compareBusyRef.current = compareEmployeesBusy;
  }, [compareEmployeesBusy]);

  const employeesSttRevision = useMemo(() => {
    const seasonal = isSeasonalAttendanceRoot(attendanceRootPath);
    return employees
      .map((emp) => {
        const stt = seasonal ? emp?.sttThoiVu : emp?.stt;
        return `${emp?.id ?? ""}:${stt ?? ""}`;
      })
      .join("|");
  }, [employees, attendanceRootPath]);

  const productionDeptOrderRevision = useMemo(
    () => comboProductionDeptOrder.join("|"),
    [comboProductionDeptOrder],
  );

  useEffect(() => {
    compareDayRowsCacheRef.current.clear();
    setCompareEmployeesResult(null);
  }, [
    attendanceRootPath,
    selectedDate,
    employeesSttRevision,
    productionDeptOrderRevision,
  ]);

  useEffect(() => {
    setCompareCriteria((prev) => {
      const compareDate = String(selectedDate || "").trim();
      return {
        ...prev,
        compareDate,
        previousDate: previousDateOf(compareDate),
      };
    });
  }, [selectedDate]);

  const closeCompareEmployees = useCallback(() => {
    setCompareEmployeesOpen(false);
  }, []);

  const handleCompareEmployeesByDepartment = useCallback(
    async (criteria = {}) => {
      if (compareBusyRef.current) return;

      const currentDate = String(
        criteria.compareDate || compareCriteria.compareDate || selectedDate || "",
      ).trim();
      const previousDate = String(
        criteria.previousDate ||
          compareCriteria.previousDate ||
          previousDateOf(currentDate),
      ).trim();
      const departmentFilter = String(
        criteria.department ?? compareCriteria.department ?? "",
      ).trim();

      if (!currentDate) {
        setAlert({
          show: true,
          type: "error",
          message: tl(
            "compareEmployeesFillDate",
            "Vui lòng chọn ngày để so sánh.",
          ),
        });
        return;
      }

      const currentDateObj = new Date(`${currentDate}T12:00:00`);
      const previousDateObj = new Date(`${previousDate}T12:00:00`);
      if (
        Number.isNaN(currentDateObj.getTime()) ||
        Number.isNaN(previousDateObj.getTime())
      ) {
        setAlert({
          show: true,
          type: "error",
          message: tl("compareEmployeesInvalidDate", "Ngày chọn không hợp lệ."),
        });
        return;
      }

      setCompareEmployeesBusy(true);
      const isSeasonalAttendance =
        isSeasonalAttendanceRoot(attendanceRootPath);
      try {
        const loadRowsByDate = async (dateKey) => {
          const key = `${attendanceRootPath}:${dateKey}`;
          const cached = compareDayRowsCacheRef.current.get(key);
          if (cached) return cached;
          const snap = await get(ref(db, `${attendanceRootPath}/${dateKey}`));
          const rows = sortEmployeesStableAsc(
            reconcileAttendanceDayRowsFromRaw([], snap.val(), {
              seasonal: isSeasonalAttendance,
            }),
            { seasonal: isSeasonalAttendance },
          );
          compareDayRowsCacheRef.current.set(key, rows);
          if (compareDayRowsCacheRef.current.size > COMPARE_DAY_CACHE_MAX) {
            const oldestKey = compareDayRowsCacheRef.current.keys().next().value;
            if (oldestKey) compareDayRowsCacheRef.current.delete(oldestKey);
          }
          return rows;
        };

        const [previousRows, currentRows] = await Promise.all([
          loadRowsByDate(previousDate),
          loadRowsByDate(currentDate),
        ]);

        const prevSttRank = buildCompareSttRankMap(
          previousRows,
          isSeasonalAttendance,
        );
        const currSttRank = buildCompareSttRankMap(
          currentRows,
          isSeasonalAttendance,
        );

        const orderedProductionMatchKeys = resolveOrderedProductionMatchKeys(
          comboProductionDeptOrder,
          comboProductionDeptCatalog,
        );
        let prevByDept;
        let currByDept;
        let allDepts;

        if (isSeasonalAttendance) {
          const unknownDeptLabel = tl(
            "unknownDepartment",
            "Chưa phân bộ phận",
          );
          prevByDept = buildCompareChartAlignedDeptEmployeeMap(
            previousRows,
            normalizeDepartment,
            prevSttRank,
            true,
            unknownDeptLabel,
          );
          currByDept = buildCompareChartAlignedDeptEmployeeMap(
            currentRows,
            normalizeDepartment,
            currSttRank,
            true,
            unknownDeptLabel,
          );
          allDepts = mergeCompareDepartmentListChartAligned(
            orderedProductionMatchKeys,
            prevByDept,
            currByDept,
            normalizeDepartment,
          );
        } else {
          prevByDept = buildOfficialCompareDeptEmployeeMap(
            previousRows,
            normalizeDepartment,
            prevSttRank,
            false,
          );
          currByDept = buildOfficialCompareDeptEmployeeMap(
            currentRows,
            normalizeDepartment,
            currSttRank,
            false,
          );
          allDepts = mergeCompareDepartmentListOfficial(
            orderedProductionMatchKeys,
            prevByDept,
            currByDept,
          );
        }

        const allRows = computeCompareRows(allDepts, prevByDept, currByDept);

        startTransition(() => {
          setCompareEmployeesResult(
            buildCompareEmployeesResult({
              previousDate,
              currentDate,
              allRows,
              departments: allDepts,
              departmentFilter,
            }),
          );
          setCompareEmployeesOpen(true);
        });
      } catch (error) {
        setAlert({
          show: true,
          type: "error",
          message: tl(
            "compareEmployeesError",
            "Không thể so sánh nhân viên: {{error}}",
            { error: error?.message || "unknown" },
          ),
        });
      } finally {
        setCompareEmployeesBusy(false);
      }
    },
    [
      selectedDate,
      compareCriteria,
      attendanceRootPath,
      comboProductionDeptOrder,
      comboProductionDeptCatalog,
      normalizeDepartment,
      setAlert,
      tl,
    ],
  );

  const handleOpenCompareEmployees = useCallback(async () => {
    await handleCompareEmployeesByDepartment(compareCriteria);
  }, [handleCompareEmployeesByDepartment, compareCriteria]);

  return {
    compareEmployeesOpen,
    compareEmployeesBusy,
    compareEmployeesResult,
    compareCriteria,
    setCompareCriteria,
    closeCompareEmployees,
    handleCompareEmployeesByDepartment,
    handleOpenCompareEmployees,
  };
}
