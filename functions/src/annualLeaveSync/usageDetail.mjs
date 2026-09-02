import {
  isAttendanceDateCountedForAnnualLeave,
  isAttendanceDateDisplayOnlyForAnnualLeave,
  listAnnualLeaveDetailHistoryMonths,
  listAnnualLeavePreCountDisplayMonthKeys,
} from "./fields.mjs";
import {
  attendanceAnnualLeaveDeductionForLoaiPhep,
  attendanceEffectiveLoaiPhepFromRaw,
  roundAnnualLeaveHours,
} from "./deduction.mjs";
import {
  annualLeaveEmpFirebaseKey,
  attendanceMnvKeyFromDayRecord,
} from "./empKey.mjs";

const ATTENDANCE_DAY_META_KEY = "_meta";

function isAttendanceDateKey(dateKey) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(dateKey ?? ""));
}

function forEachAttendanceDayEmployee(dayData, targetEmpKey, iterate) {
  if (!dayData || typeof dayData !== "object") return;
  for (const [recordKey, rawEmp] of Object.entries(dayData)) {
    if (recordKey === ATTENDANCE_DAY_META_KEY) continue;
    if (!rawEmp || typeof rawEmp !== "object") continue;
    const firebaseKey = annualLeaveEmpFirebaseKey(
      attendanceMnvKeyFromDayRecord(recordKey, rawEmp),
    );
    if (!firebaseKey) continue;
    if (targetEmpKey && firebaseKey !== targetEmpKey) continue;
    iterate(firebaseKey, rawEmp);
  }
}

function emptyUsageMonth(yearMonth, { displayOnly = false } = {}) {
  return {
    yearMonth,
    pnCount: 0,
    halfPnCount: 0,
    totalDeduction: 0,
    days: [],
    displayOnly,
  };
}

function ensureUsageMonth(empDetail, yearMonth, displayOnly = false) {
  if (!empDetail.months[yearMonth]) {
    empDetail.months[yearMonth] = emptyUsageMonth(yearMonth, { displayOnly });
  } else if (displayOnly) {
    empDetail.months[yearMonth].displayOnly = true;
  }
  return empDetail.months[yearMonth];
}

function recordUsageDay(
  empDetail,
  monthDetail,
  dateKey,
  type,
  deduction,
  displayOnly,
) {
  if (displayOnly) {
    monthDetail.displayOnly = true;
    if (deduction === 1) monthDetail.pnCount += 1;
    else monthDetail.halfPnCount += 1;
    monthDetail.days.push({ dateKey, type, deduction, displayOnly: true });
    return;
  }

  if (deduction === 1) {
    empDetail.totalPn += 1;
    monthDetail.pnCount += 1;
  } else {
    empDetail.totalHalfPn += 1;
    monthDetail.halfPnCount += 1;
  }

  empDetail.totalDeduction = roundAnnualLeaveHours(
    empDetail.totalDeduction + deduction,
  );
  monthDetail.totalDeduction = roundAnnualLeaveHours(
    monthDetail.totalDeduction + deduction,
  );
  monthDetail.days.push({ dateKey, type, deduction });
}

function fillUsageDetailMonths(empDetail, year) {
  const monthKeys = listAnnualLeaveDetailHistoryMonths(year);
  const monthList = Object.values(empDetail.months);
  const byMonth = {};
  for (const month of monthList) {
    byMonth[month.yearMonth] = month;
  }

  const countedRows = monthKeys.map(
    (yearMonth) => byMonth[yearMonth] ?? emptyUsageMonth(yearMonth),
  );

  const preCountRows = listAnnualLeavePreCountDisplayMonthKeys(year)
    .filter((yearMonth) => byMonth[yearMonth]?.days?.length > 0)
    .map((yearMonth) => {
      const month = byMonth[yearMonth];
      return { ...month, displayOnly: true, totalDeduction: 0 };
    });

  empDetail.months = [...countedRows, ...preCountRows];
}

/** Chi tiết PN / 1/2PN theo tháng — map `emp_{mnv}` → breakdown. */
export function buildAttendanceAnnualLeaveUsageDetailByEmpKey(
  attendanceRootData,
  year,
) {
  const map = {};
  if (!attendanceRootData || typeof attendanceRootData !== "object") return map;

  const yearPrefix = `${year}-`;

  for (const [dateKey, dayData] of Object.entries(attendanceRootData)) {
    if (!isAttendanceDateKey(dateKey) || !dateKey.startsWith(yearPrefix)) {
      continue;
    }

    const counted = isAttendanceDateCountedForAnnualLeave(dateKey, year);
    const displayOnly = isAttendanceDateDisplayOnlyForAnnualLeave(dateKey, year);
    if (!counted && !displayOnly) continue;
    if (!dayData || typeof dayData !== "object") continue;

    forEachAttendanceDayEmployee(dayData, null, (firebaseKey, rawEmp) => {
      const deduction = attendanceAnnualLeaveDeductionForLoaiPhep(
        attendanceEffectiveLoaiPhepFromRaw(rawEmp),
      );
      if (deduction === 0) return;

      const type = deduction === 1 ? "PN" : "1/2PN";
      const yearMonth = dateKey.slice(0, 7);

      if (!map[firebaseKey]) {
        map[firebaseKey] = {
          totalPn: 0,
          totalHalfPn: 0,
          totalDeduction: 0,
          months: {},
        };
      }

      const empDetail = map[firebaseKey];
      const monthDetail = ensureUsageMonth(empDetail, yearMonth, displayOnly);
      recordUsageDay(
        empDetail,
        monthDetail,
        dateKey,
        type,
        deduction,
        displayOnly,
      );
    });
  }

  for (const empDetail of Object.values(map)) {
    fillUsageDetailMonths(empDetail, year);
    for (const monthDetail of empDetail.months) {
      monthDetail.days.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    }
  }

  return map;
}

/** Gói chi tiết PN để ghi vào `attendanceLeaveAgg/{year}/{empKey}`. */
export function serializeAnnualLeaveUsageDetailForLeaveAgg(detail) {
  if (!detail || typeof detail !== "object") return null;
  const months = Array.isArray(detail.months)
    ? detail.months
    : Object.values(detail.months ?? {});
  if (!months.length) return null;

  return {
    totalPn: Number(detail.totalPn ?? 0),
    totalHalfPn: Number(detail.totalHalfPn ?? 0),
    totalDeduction: roundAnnualLeaveHours(Number(detail.totalDeduction ?? 0)),
    months: months.map((month) => ({
      yearMonth: month.yearMonth,
      pnCount: Number(month.pnCount ?? 0),
      halfPnCount: Number(month.halfPnCount ?? 0),
      totalDeduction: roundAnnualLeaveHours(Number(month.totalDeduction ?? 0)),
      displayOnly: Boolean(month.displayOnly),
      days: Array.isArray(month.days)
        ? month.days.map((day) => ({
            dateKey: day.dateKey,
            type: day.type,
            deduction: roundAnnualLeaveHours(Number(day.deduction ?? 0)),
            displayOnly: Boolean(day.displayOnly),
          }))
        : [],
    })),
  };
}
