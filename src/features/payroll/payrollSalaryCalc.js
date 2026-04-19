import { getAttendanceComboFlags } from "@/features/attendance/attendanceComboStats";

/**
 * Phân loại một dòng điểm danh (đã merge profile) phục vụ ước lương.
 * Thứ tự: nghỉ việc → đi làm / vào trễ → phép hưởng lương → không lương / KP → vắng.
 */
export function classifyAttendanceRowForSalary(row) {
  if (!row || typeof row !== "object") return "absent";
  const flags = getAttendanceComboFlags(row);
  if (flags.resignedLeave) return "resigned";

  const isWork =
    flags.checkedIn || flags.buGioCong || flags.late;

  const isPaidLeave =
    flags.annualLeave ||
    flags.sickLeave ||
    flags.maternity ||
    flags.weddingLeave ||
    flags.funeralLeave ||
    flags.recuperationLeave ||
    flags.laborAccident;

  const isUnpaid = flags.unpaidLeave || flags.noPermit;

  if (isWork) return "work";
  if (isPaidLeave) return "paid_leave";
  if (isUnpaid) return "unpaid";
  return "absent";
}

/**
 * Gộp theo MNV trong khoảng ngày: mỗi phần tử { dateKey, emp }.
 */
export function aggregateSalaryByEmployee(mergedDayRows) {
  /** @type {Map<string, { mnv: string; hoVaTen: string; boPhan: string; workDays: number; paidLeaveDays: number; unpaidDays: number; absentDays: number; resignedDays: number; totalRows: number }>} */
  const map = new Map();

  for (const { emp } of mergedDayRows) {
    const mnv = String(emp?.mnv ?? "").trim();
    if (!mnv) continue;

    if (!map.has(mnv)) {
      map.set(mnv, {
        mnv,
        hoVaTen: String(emp.hoVaTen ?? "").trim(),
        boPhan: String(emp.boPhan ?? "").trim(),
        workDays: 0,
        paidLeaveDays: 0,
        unpaidDays: 0,
        absentDays: 0,
        resignedDays: 0,
        totalRows: 0,
      });
    }
    const s = map.get(mnv);
    s.totalRows += 1;
    const cat = classifyAttendanceRowForSalary(emp);
    if (cat === "work") s.workDays += 1;
    else if (cat === "paid_leave") s.paidLeaveDays += 1;
    else if (cat === "unpaid") s.unpaidDays += 1;
    else if (cat === "resigned") s.resignedDays += 1;
    else s.absentDays += 1;
  }

  return Array.from(map.values()).sort((a, b) => a.mnv.localeCompare(b.mnv));
}

/**
 * Ước lương gộp (đơn giản — tham khảo, không thay thế quy chế công ty).
 * - daily = baseMonthly / standardWorkingDays
 * - paidUnits = workDays + paidLeaveDays (phép hưởng lương tính như ngày có lương)
 * - trừ full ngày không lương / KP
 */
export function estimateSalaryVnd({
  workDays,
  paidLeaveDays,
  unpaidDays,
  baseMonthlyVnd,
  standardWorkingDays,
}) {
  const base = Number(baseMonthlyVnd);
  const std = Number(standardWorkingDays);
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(std) || std <= 0) {
    return { dailyRate: 0, paidUnits: 0, gross: 0 };
  }
  const dailyRate = base / std;
  const paidUnits = workDays + paidLeaveDays;
  const gross = Math.round(dailyRate * paidUnits - dailyRate * unpaidDays);
  return {
    dailyRate: Math.round(dailyRate),
    paidUnits,
    gross,
  };
}
