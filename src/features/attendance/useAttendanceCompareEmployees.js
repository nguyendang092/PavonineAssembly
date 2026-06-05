import { useState, useCallback, useEffect, useRef, startTransition } from "react";
import { db, get, ref } from "@/services/firebase";
import { reconcileAttendanceDayRowsFromRaw } from "./mergeAttendanceDayRows";
import {
  previousDateOf,
  resolveOrderedProductionMatchKeys,
  buildCompareSttRankMap,
  buildProductionDeptEmployeeMap,
  buildSeasonalDeptEmployeeMap,
  mergeCompareDepartmentList,
  mergeCompareDepartmentListSeasonal,
  computeCompareRows,
  buildCompareEmployeesResult,
} from "./attendanceCompareEmployeesLogic";
import { isSeasonalAttendanceRoot } from "./attendanceSeasonalStt";
import { sortEmployeesStableAsc } from "./attendanceListSort";

const COMPARE_DAY_CACHE_MAX = 12;

export function useAttendanceCompareEmployees({
  attendanceRootPath,
  selectedDate,
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

  useEffect(() => {
    compareDayRowsCacheRef.current.clear();
    setCompareEmployeesResult(null);
  }, [attendanceRootPath]);

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
      try {
        const loadRowsByDate = async (dateKey) => {
          const key = `${attendanceRootPath}:${dateKey}`;
          const cached = compareDayRowsCacheRef.current.get(key);
          if (cached) return cached;
          const snap = await get(ref(db, `${attendanceRootPath}/${dateKey}`));
          const seasonal = isSeasonalAttendanceRoot(attendanceRootPath);
          const rows = sortEmployeesStableAsc(
            reconcileAttendanceDayRowsFromRaw([], snap.val(), { seasonal }),
            { seasonal },
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

        const isSeasonalAttendance =
          isSeasonalAttendanceRoot(attendanceRootPath);

        let prevByDept;
        let currByDept;
        let allDepts;

        const prevSttRank = buildCompareSttRankMap(
          previousRows,
          isSeasonalAttendance,
        );
        const currSttRank = buildCompareSttRankMap(
          currentRows,
          isSeasonalAttendance,
        );

        if (isSeasonalAttendance) {
          prevByDept = buildSeasonalDeptEmployeeMap(
            previousRows,
            normalizeDepartment,
            prevSttRank,
          );
          currByDept = buildSeasonalDeptEmployeeMap(
            currentRows,
            normalizeDepartment,
            currSttRank,
          );
          allDepts = mergeCompareDepartmentListSeasonal(prevByDept, currByDept);
        } else {
          const orderedProductionMatchKeys = resolveOrderedProductionMatchKeys(
            comboProductionDeptOrder,
            comboProductionDeptCatalog,
          );
          prevByDept = buildProductionDeptEmployeeMap(
            previousRows,
            normalizeDepartment,
            prevSttRank,
          );
          currByDept = buildProductionDeptEmployeeMap(
            currentRows,
            normalizeDepartment,
            currSttRank,
          );
          allDepts = mergeCompareDepartmentList(
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
