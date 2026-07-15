import { getAttendanceComboFlags } from "./attendanceComboStats";
import { isEmployeeQuickUnattended } from "./attendanceListShared";
import {
  formatAttendanceLeaveTypeColumnForEmployee,
  getAttendanceLeaveTypeRaw,
} from "./attendanceGioVaoTypeOptions";
import { isNightShiftCaLamViec } from "./attendanceWorkingHours";
import { pickAttendanceEmployeeDayFields, ATTENDANCE_EMP } from "./attendanceEmployeeFields";
import { parseLocalDateKey } from "@/utils/dateKey";

/** Giờ chuẩn đúng giờ buổi sáng — khớp mockup dashboard. */
export const ATTENDANCE_DASHBOARD_ON_TIME_CUTOFF = "07:40";
/** Giờ chuẩn đúng giờ ca đêm S2. */
export const ATTENDANCE_DASHBOARD_NIGHT_ON_TIME_CUTOFF = "19:40";

const GIO_VAO_HHMM = /^(\d{1,2}):(\d{2})/;

export function parseAttendanceClockMinutes(raw) {
  const m = String(raw ?? "").trim().match(GIO_VAO_HHMM);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) {
    return null;
  }
  return h * 60 + min;
}

export function parseAttendanceCutoffMinutes(cutoff = ATTENDANCE_DASHBOARD_ON_TIME_CUTOFF) {
  return parseAttendanceClockMinutes(cutoff);
}

export function isAttendanceOnTimeByClock(
  gioVao,
  cutoff = ATTENDANCE_DASHBOARD_ON_TIME_CUTOFF,
) {
  const mins = parseAttendanceClockMinutes(gioVao);
  const limit = parseAttendanceCutoffMinutes(cutoff);
  if (mins == null || limit == null) return false;
  return mins <= limit;
}

export function isAttendanceLateByClock(
  gioVao,
  cutoff = ATTENDANCE_DASHBOARD_ON_TIME_CUTOFF,
) {
  const mins = parseAttendanceClockMinutes(gioVao);
  const limit = parseAttendanceCutoffMinutes(cutoff);
  if (mins == null || limit == null) return false;
  return mins > limit;
}

function parseJoinDateToLocalDate(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const iso = parseLocalDateKey(s.slice(0, 10));
  if (iso) return iso;
  const dm = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dm) {
    const d = new Date(Number(dm[3]), Number(dm[2]) - 1, Number(dm[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function yearsOfServiceFromJoinDate(joinDateRaw, asOfDateKey) {
  const join = parseJoinDateToLocalDate(joinDateRaw);
  const asOf = parseLocalDateKey(asOfDateKey);
  if (!join || !asOf) return null;
  const diffMs = asOf.getTime() - join.getTime();
  if (diffMs < 0) return 0;
  return diffMs / (365.25 * 24 * 60 * 60 * 1000);
}

function seniorityBucket(years) {
  if (years == null || !Number.isFinite(years)) return "unknown";
  if (years < 3 / 12) return "lt3m";
  if (years < 6 / 12) return "m3_6";
  if (years < 1) return "m6_1y";
  if (years < 3) return "y1_3";
  if (years < 5) return "y3_5";
  if (years < 10) return "y5_10";
  return "gt10";
}

export function employeeHasApprovedLeave(flags) {
  return (
    flags.annualLeave ||
    flags.halfAnnualLeave ||
    flags.sickLeave ||
    flags.maternity ||
    flags.unpaidLeave ||
    flags.funeralLeave ||
    flags.weddingLeave ||
    flags.recuperationLeave ||
    flags.laborAccident ||
    flags.resignedLeave
  );
}

function getDashboardOnTimeCutoffForEmployee(flags, day) {
  const isNight =
    isNightShiftCaLamViec(day.shiftCode) || flags.nightShift;
  return isNight
    ? ATTENDANCE_DASHBOARD_NIGHT_ON_TIME_CUTOFF
    : ATTENDANCE_DASHBOARD_ON_TIME_CUTOFF;
}

export function classifyAttendanceDashboardEmployee(emp) {
  const flags = getAttendanceComboFlags(emp);
  const day = pickAttendanceEmployeeDayFields(emp);
  const timeIn = String(day.timeIn ?? "").trim();
  const hasClock = parseAttendanceClockMinutes(timeIn) != null;
  const isNight =
    isNightShiftCaLamViec(day.shiftCode) || flags.nightShift;
  const cutoff = getDashboardOnTimeCutoffForEmployee(flags, day);

  if (employeeHasApprovedLeave(flags)) {
    return {
      category: "onLeave",
      flags,
      leaveLabel: formatAttendanceLeaveTypeColumnForEmployee(emp),
      timeIn,
    };
  }

  const isLateByClock = hasClock && isAttendanceLateByClock(timeIn, cutoff);
  const isLate = isNight ? isLateByClock : flags.late || isLateByClock;

  if (isLate) {
    return { category: "late", flags, leaveLabel: "", timeIn };
  }

  if (
    (hasClock && isAttendanceOnTimeByClock(timeIn, cutoff)) ||
    flags.checkedIn ||
    flags.buGioCong
  ) {
    return { category: "onTime", flags, leaveLabel: "", timeIn };
  }

  if (isNight && !hasClock && !getAttendanceLeaveTypeRaw(emp)) {
    return { category: "nightPending", flags, leaveLabel: "", timeIn };
  }

  if (isEmployeeQuickUnattended(emp) || (!hasClock && !flags.buGioCong)) {
    return { category: "absent", flags, leaveLabel: "", timeIn };
  }

  return { category: "other", flags, leaveLabel: "", timeIn };
}

function normalizeDeptLabel(emp) {
  return String(emp?.boPhan ?? "").trim() || "—";
}

function morningBucketLabel(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const bucketM = Math.floor(m / 10) * 10;
  return `${String(h).padStart(2, "0")}:${String(bucketM).padStart(2, "0")}`;
}

const MORNING_BUCKET_START = 5 * 60;
const MORNING_BUCKET_END = 8 * 60 + 10;

function buildMorningBuckets(employees) {
  const map = new Map();
  for (let m = MORNING_BUCKET_START; m <= MORNING_BUCKET_END; m += 10) {
    map.set(morningBucketLabel(m), 0);
  }
  for (const emp of employees) {
    const mins = parseAttendanceClockMinutes(emp.gioVao);
    if (mins == null || mins < MORNING_BUCKET_START || mins > MORNING_BUCKET_END) {
      continue;
    }
    const bucket = Math.floor(mins / 10) * 10;
    const label = morningBucketLabel(bucket);
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([label, count]) => ({ label, count }));
}

function buildDeptWatchlist(classified) {
  const stats = new Map();
  for (const row of classified) {
    const dept = row.dept;
    if (!stats.has(dept)) {
      stats.set(dept, { dept, total: 0, onTime: 0, present: 0 });
    }
    const s = stats.get(dept);
    s.total += 1;
    if (row.category === "onTime" || row.category === "late") s.present += 1;
    if (row.category === "onTime") s.onTime += 1;
  }
  return Array.from(stats.values())
    .map((s) => ({
      dept: s.dept,
      total: s.total,
      onTime: s.onTime,
      presentRate: s.total ? Math.round((s.present / s.total) * 1000) / 10 : 0,
      onTimeRate: s.total ? Math.round((s.onTime / s.total) * 1000) / 10 : 0,
      isFullOnTime: s.total > 0 && s.onTime === s.total,
    }))
    .sort(
      (a, b) =>
        a.onTimeRate - b.onTimeRate ||
        b.total - a.total ||
        a.dept.localeCompare(b.dept, "vi"),
    );
}

function buildLeaveBreakdown(classified) {
  const map = new Map();
  for (const row of classified) {
    if (row.category !== "onLeave") continue;
    const key = row.leaveLabel || "Khác";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function buildSeniority(classified, asOfDateKey) {
  const buckets = {
    lt3m: 0,
    m3_6: 0,
    m6_1y: 0,
    y1_3: 0,
    y3_5: 0,
    y5_10: 0,
    gt10: 0,
    unknown: 0,
  };
  const yearsList = [];
  for (const row of classified) {
    const years = yearsOfServiceFromJoinDate(row.emp.ngayVaoLam, asOfDateKey);
    const bucket = seniorityBucket(years);
    buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    if (years != null && Number.isFinite(years)) yearsList.push(years);
  }
  const withTenure = yearsList.length;
  const over6m =
    withTenure > 0
      ? yearsList.filter((y) => y >= 0.5).length / withTenure
      : 0;
  const avgYears =
    withTenure > 0
      ? yearsList.reduce((a, b) => a + b, 0) / withTenure
      : 0;
  return {
    buckets: [
      { key: "lt3m", count: buckets.lt3m },
      { key: "m3_6", count: buckets.m3_6 },
      { key: "m6_1y", count: buckets.m6_1y },
      { key: "y1_3", count: buckets.y1_3 },
      { key: "y3_5", count: buckets.y3_5 },
      { key: "y5_10", count: buckets.y5_10 },
      { key: "gt10", count: buckets.gt10 },
    ],
    over6MonthsPct: Math.round(over6m * 1000) / 10,
    avgYears: Math.round(avgYears * 10) / 10,
    knownCount: withTenure,
  };
}

function buildDeptHeadcount(employees) {
  const map = new Map();
  for (const emp of employees) {
    const dept = normalizeDeptLabel(emp);
    map.set(dept, (map.get(dept) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([dept, count]) => ({ dept, count }))
    .sort(
      (a, b) => b.count - a.count || a.dept.localeCompare(b.dept, "vi"),
    );
}

function buildDeptResignationRate(classified) {
  const stats = new Map();
  for (const row of classified) {
    const dept = row.dept;
    if (!stats.has(dept)) {
      stats.set(dept, { dept, total: 0, resigned: 0 });
    }
    const s = stats.get(dept);
    s.total += 1;
    if (row.flags?.resignedLeave) s.resigned += 1;
  }
  return Array.from(stats.values())
    .map((s) => ({
      dept: s.dept,
      resigned: s.resigned,
      total: s.total,
      rate: s.total ? Math.round((s.resigned / s.total) * 1000) / 10 : 0,
    }))
    .sort(
      (a, b) =>
        b.rate - a.rate ||
        b.resigned - a.resigned ||
        a.dept.localeCompare(b.dept, "vi"),
    );
}

function buildResignationSummary(classified, deptResignationRate) {
  const totalRecords = classified.length;
  let resignedRecords = 0;
  const uniqueKeys = new Set();
  for (const row of classified) {
    if (!row.flags?.resignedLeave) continue;
    resignedRecords += 1;
    const key = row.mnv || row.name;
    if (key) uniqueKeys.add(key);
  }
  const resignedTotal = deptResignationRate.reduce(
    (sum, row) => sum + row.resigned,
    0,
  );
  return {
    totalRecords,
    resignedRecords,
    resignedTotal,
    overallRate:
      totalRecords > 0
        ? Math.round((resignedRecords / totalRecords) * 1000) / 10
        : 0,
    uniqueResigned: uniqueKeys.size,
    deptWithResignation: deptResignationRate.filter((row) => row.resigned > 0)
      .length,
  };
}

function formatDashboardDateKeyDisplay(dateKey) {
  const dk = String(dateKey ?? "").slice(0, 10);
  const m = dk.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Trích ngày dd/MM/yyyy từ ghi chú loại phép / chấm công. */
export function parseAttendanceNoteDateDisplay(raw) {
  const t = String(raw ?? "").trim().replace(/\u00a0/g, " ");
  if (!t) return null;
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) return null;

  let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;

  m = t.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) {
    return `${String(m[1]).padStart(2, "0")}/${String(m[2]).padStart(2, "0")}/${m[3]}`;
  }

  m = t.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})\b/);
  if (m) {
    let year = Number(m[3]);
    year = year >= 70 ? 1900 + year : 2000 + year;
    return `${String(m[1]).padStart(2, "0")}/${String(m[2]).padStart(2, "0")}/${year}`;
  }

  return null;
}

/** Ngày nghỉ việc ghi trong note khi loại phép là NV. */
export function extractNvResignationDateDisplay(emp) {
  if (!emp || typeof emp !== "object") return null;

  const leaveRaw = getAttendanceLeaveTypeRaw(emp);
  const day = pickAttendanceEmployeeDayFields(emp);
  const sources = [
    leaveRaw,
    emp[ATTENDANCE_EMP.CHAM_CONG],
    emp[ATTENDANCE_EMP.PHEP_NAM],
    day.timeIn,
  ];

  for (const raw of sources) {
    const parsed = parseAttendanceNoteDateDisplay(raw);
    if (parsed) return parsed;
  }

  return formatDashboardDateKeyDisplay(emp._dashboardDate);
}

function resignationDateSortKey(display) {
  if (!display) return "";
  const m = String(display).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return String(display);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function buildResignedEmployees(classified) {
  const byKey = new Map();
  for (const row of classified) {
    if (!row.flags?.resignedLeave) continue;
    const key = row.mnv || row.name;
    if (!key) continue;
    const resignationDate = extractNvResignationDateDisplay(row.emp);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, {
        name: row.name,
        dept: row.dept,
        mnv: row.mnv,
        resignationDate,
      });
      continue;
    }
    const prevKey = resignationDateSortKey(prev.resignationDate);
    const nextKey = resignationDateSortKey(resignationDate);
    if (nextKey && (!prevKey || nextKey < prevKey)) {
      prev.resignationDate = resignationDate;
    }
  }
  return Array.from(byKey.values()).sort(
    (a, b) =>
      resignationDateSortKey(b.resignationDate).localeCompare(
        resignationDateSortKey(a.resignationDate),
      ) ||
      a.dept.localeCompare(b.dept, "vi") ||
      a.name.localeCompare(b.name, "vi"),
  );
}

export function joinYearFromJoinDate(joinDateRaw) {
  const join = parseJoinDateToLocalDate(joinDateRaw);
  if (!join) return null;
  return join.getFullYear();
}

function buildNewHiresByYear(employees) {
  const map = new Map();
  for (const emp of employees) {
    const year = joinYearFromJoinDate(emp.ngayVaoLam);
    if (year == null || !Number.isFinite(year)) continue;
    map.set(year, (map.get(year) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);
}

/**
 * @param {object[]} employees — lượt điểm danh (1 dòng / NV / ngày khi xem theo kỳ)
 * @param {string} asOfDateKey YYYY-MM-DD
 * @param {{ deptFilter?: string, rosterEmployees?: object[], periodDays?: number }} [options]
 */
export function buildAttendanceDashboardSnapshot(
  employees,
  asOfDateKey,
  options = {},
) {
  const deptFilter = String(options.deptFilter ?? "").trim().toLowerCase();
  const applyDept = (emp) => {
    if (!deptFilter) return true;
    return String(emp.boPhan ?? "").trim().toLowerCase() === deptFilter;
  };

  const filtered = employees.filter(applyDept);

  const rosterSource = options.rosterEmployees ?? employees;
  const rosterFiltered = rosterSource.filter(applyDept);
  const rosterClassified = rosterFiltered.map((emp) => ({ emp }));

  const classified = filtered.map((emp) => {
    const c = classifyAttendanceDashboardEmployee(emp);
    return {
      emp,
      dept: normalizeDeptLabel(emp),
      name: String(emp.hoVaTen ?? "").trim() || "—",
      mnv: String(emp.mnv ?? "").trim(),
      ...c,
    };
  });

  const counts = {
    total: classified.length,
    onTime: 0,
    late: 0,
    onLeave: 0,
    absent: 0,
    nightPending: 0,
    other: 0,
  };
  for (const row of classified) {
    counts[row.category] = (counts[row.category] ?? 0) + 1;
  }

  const deptSet = new Set(classified.map((r) => r.dept).filter((d) => d !== "—"));
  const uniqueEmployees = new Set(
    rosterFiltered
      .map((emp) => String(emp.mnv ?? "").trim() || String(emp.hoVaTen ?? "").trim())
      .filter(Boolean),
  ).size;

  const lateEmployees = classified
    .filter((r) => r.category === "late")
    .map((r) => ({
      name: r.name,
      dept: r.dept,
      mnv: r.mnv,
      timeIn: r.timeIn || "—",
    }))
    .sort((a, b) => String(a.timeIn).localeCompare(String(b.timeIn)));

  const onLeaveEmployees = classified
    .filter((r) => r.category === "onLeave")
    .map((r) => ({
      name: r.name,
      dept: r.dept,
      mnv: r.mnv,
      leaveLabel: r.leaveLabel || "—",
    }));

  const absentEmployees = classified
    .filter((r) => r.category === "absent")
    .map((r) => ({
      name: r.name,
      dept: r.dept,
      mnv: r.mnv,
    }));

  const seniority = buildSeniority(rosterClassified, asOfDateKey);
  const deptResignationRate = buildDeptResignationRate(classified);

  return {
    summary: {
      total: counts.total,
      uniqueEmployees,
      periodDays: options.periodDays ?? 1,
      deptCount: deptSet.size,
      onTime: counts.onTime,
      late: counts.late,
      onLeave: counts.onLeave,
      absent: counts.absent,
      onTimePct:
        counts.total > 0
          ? Math.round((counts.onTime / counts.total) * 1000) / 10
          : 0,
      latePct:
        counts.total > 0
          ? Math.round((counts.late / counts.total) * 1000) / 10
          : 0,
    },
    morningBuckets: buildMorningBuckets(filtered),
    deptWatchlist: buildDeptWatchlist(classified),
    leaveBreakdown: buildLeaveBreakdown(classified),
    deptHeadcount: buildDeptHeadcount(rosterFiltered),
    deptResignationRate,
    resignationSummary: buildResignationSummary(classified, deptResignationRate),
    resignedEmployees: buildResignedEmployees(classified),
    newHiresByYear: buildNewHiresByYear(rosterFiltered),
    seniority,
    lateEmployees,
    onLeaveEmployees,
    absentEmployees,
  };
}

/** Đếm nhanh cho xu hướng tuần — không cần full snapshot. */
export function countAttendanceDashboardDaySummary(employees) {
  let onTime = 0;
  let late = 0;
  let onLeave = 0;
  let absent = 0;
  for (const emp of employees) {
    const { category } = classifyAttendanceDashboardEmployee(emp);
    if (category === "onTime") onTime += 1;
    else if (category === "late") late += 1;
    else if (category === "onLeave") onLeave += 1;
    else if (category === "absent") absent += 1;
  }
  return { onTime, late, onLeave, absent, total: employees.length };
}
