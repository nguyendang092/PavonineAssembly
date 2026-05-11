import { resolveComboChartDepartmentLabel } from "./attendanceComboChartConfig";
import { isEmployeeQuickUnattended } from "./attendanceListShared";

function rawMnvTrimmed(emp) {
  return String(emp?.mnv ?? "").trim();
}

/**
 * Chỉ xét người **đã điểm danh** ngày trước: ít nhất một trong «giờ vào», «loại phép», «ca»
 * (không thuộc trạng thái «chưa điểm danh» — cùng `isEmployeeQuickUnattended` với lọc nhanh trên bảng).
 * Nếu hôm nay không còn dòng trùng `id` node Firebase **hoặc** cùng chuỗi `mnv` (trim, đúng như trên bảng, không gộp tiền tố) → coi là mất khỏi danh sách.
 *
 * So khớp hôm nay: mọi dòng trên danh sách hôm nay (sau bộ lọc).
 *
 * @returns {Map<string, object[]>}
 *   key = nhãn bộ phận thống kê (cùng `resolveComboChartDepartmentLabel` với biểu đồ combo)
 */
export function computePrevDayWorkedMissingTodayByDepartment({
  prevDayEmployees,
  todayEmployees,
  normalizeDepartment,
  unknownDepartmentLabel,
}) {
  const prevList = Array.isArray(prevDayEmployees) ? prevDayEmployees : [];
  const todayList = Array.isArray(todayEmployees) ? todayEmployees : [];

  const todayIds = new Set();
  const todayMnv = new Set();
  for (const e of todayList) {
    const id = String(e?.id ?? "").trim();
    if (id) todayIds.add(id);
    const mnv = rawMnvTrimmed(e);
    if (mnv) todayMnv.add(mnv);
  }

  const byDept = new Map();
  for (const emp of prevList) {
    if (isEmployeeQuickUnattended(emp)) continue;
    const id = String(emp?.id ?? "").trim();
    const mnv = rawMnvTrimmed(emp);
    if (!id && !mnv) continue;
    const inTodayById = id && todayIds.has(id);
    const inTodayByMnv = mnv && todayMnv.has(mnv);
    if (inTodayById || inTodayByMnv) continue;

    const department = resolveComboChartDepartmentLabel(
      normalizeDepartment,
      emp.boPhan,
      unknownDepartmentLabel,
    );
    if (!byDept.has(department)) byDept.set(department, []);
    byDept.get(department).push(emp);
  }
  return byDept;
}