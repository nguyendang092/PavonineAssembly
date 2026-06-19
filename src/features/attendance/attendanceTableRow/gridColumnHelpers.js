function normalizePercents(widths) {
  const sum = widths.reduce((a, b) => a + b, 0);
  if (sum <= 0) return widths;
  return widths.map((w) => (w / sum) * 100);
}

/** Số cột bảng điểm danh (không khối giờ lương payroll) — phải khớp `*ATTENDANCE_ONLY*` grid. */
function getAttendanceVisibleColumnCount(showRowModalActions, columnPlan) {
  const plan =
    columnPlan === "minimal"
      ? "minimal"
      : columnPlan === "narrow"
        ? "narrow"
        : columnPlan === "compact"
          ? "compact"
          : "full";
  const table = {
    full: { withAct: 17, noAct: 16 },
    compact: { withAct: 14, noAct: 13 },
    narrow: { withAct: 13, noAct: 12 },
    minimal: { withAct: 6, noAct: 5 },
  };
  const row = table[plan];
  return showRowModalActions ? row.withAct : row.noAct;
}

/** Bỏ khối cột giờ lương (ghost, trước actions nếu có) — khớp số cột giờ trên bảng lương. */
function dropSalaryHoursWidths(widths, showRowModalActions) {
  const dropCount = 8;
  if (widths.length === 0) return widths;
  const copy = [...widths];
  if (showRowModalActions) {
    if (copy.length >= dropCount + 1)
      copy.splice(copy.length - (dropCount + 1), dropCount);
  } else if (copy.length >= dropCount) {
    copy.splice(copy.length - dropCount, dropCount);
  }
  return normalizePercents(copy);
}

/**
 * Sau `dropSalaryHoursWidths`, bảng payroll vẫn giữ width «Ngày off» trước khối giờ đã xóa;
 * chỉ cần bù thêm «Ngày lễ» (và không chèn trùng) để số track = số ô grid (tránh cột ma + khoảng trống phải).
 */
function insertAttendanceOffDayColumnWidths(
  widths,
  showRowModalActions,
  columnPlan = "full",
) {
  if (widths.length < 1) return widths;
  const expected = getAttendanceVisibleColumnCount(
    showRowModalActions,
    columnPlan,
  );
  const copy = [...widths];
  if (copy.length === expected) return normalizePercents(copy);

  const padWeight = 4;

  if (copy.length < expected) {
    const deficit = expected - copy.length;
    const pad = Array(deficit).fill(padWeight);
    if (showRowModalActions) {
      copy.splice(copy.length - 1, 0, ...pad);
    } else {
      copy.splice(copy.length, 0, ...pad);
    }
    return normalizePercents(copy);
  }

  const surplus = copy.length - expected;
  if (showRowModalActions) {
    copy.splice(copy.length - 1 - surplus, surplus);
  } else {
    copy.splice(copy.length - surplus - 1, surplus);
  }
  return normalizePercents(copy);
}

export {
  normalizePercents,
  dropSalaryHoursWidths,
  insertAttendanceOffDayColumnWidths,
};
