import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";

/** Lọc nhanh theo MNV / họ tên / bộ phận — dùng cho bảng phép năm. */
export function filterAnnualLeaveManagerRows(
  rows,
  { search = "", deptFilter = "" } = {},
) {
  if (!rows?.length) return [];
  const q = String(search ?? "").trim().toLowerCase();
  const dept = String(deptFilter ?? "");
  if (!q && !dept) return rows;

  return rows.filter((row) => {
    if (dept && row[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT] !== dept) return false;
    if (!q) return true;
    const name = String(row[ANNUAL_LEAVE_EMP.FULL_NAME] ?? "").toLowerCase();
    const mnv = String(row[ANNUAL_LEAVE_EMP.MNV_PREFIX] ?? "").trim();
    return name.includes(q) || mnv.includes(q);
  });
}

/** Danh sách bộ phận duy nhất — tính một lần khi `rows` đổi. */
export function listAnnualLeaveManagerDepartments(rows) {
  const set = new Set();
  for (const row of rows ?? []) {
    const dept = row?.[ANNUAL_LEAVE_EMP.SUB_DEPARTMENT];
    if (dept) set.add(String(dept));
  }
  return Array.from(set).sort();
}
