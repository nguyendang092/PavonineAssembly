/** Lọc dòng NV theo danh sách bộ phận (rỗng = tất cả). */
export function filterPayrollEmployeesByDepartments(
  employees,
  selectedDepartments,
  normalizeDepartment,
) {
  const list = Array.isArray(employees) ? employees : [];
  const selected = Array.isArray(selectedDepartments)
    ? selectedDepartments.filter(Boolean)
    : [];
  if (!selected.length) return list;
  const allowed = new Set(
    selected.map((d) => normalizeDepartment(String(d).trim())),
  );
  return list.filter((emp) =>
    allowed.has(normalizeDepartment(emp?.boPhan)),
  );
}

/** Hậu tố tên file khi lọc theo bộ phận. */
export function payrollExportDepartmentFilenameSuffix(selectedDepartments) {
  const selected = (selectedDepartments ?? []).filter(Boolean);
  if (!selected.length) return "";
  if (selected.length === 1) {
    return `_${slugifyFilenamePart(selected[0])}`;
  }
  if (selected.length <= 3) {
    return `_${selected.map(slugifyFilenamePart).join("-")}`;
  }
  return `_${selected.length}-bo-phan`;
}

function slugifyFilenamePart(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
