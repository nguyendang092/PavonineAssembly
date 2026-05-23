/**
 * Chuyển snapshot Firebase `bar` về dạng mảng giống dữ liệu Excel.
 */
export function barSnapshotToRows(barData) {
  const rows = [];
  for (const workplaceName in barData) {
    const weeks = barData[workplaceName];
    for (const weekKey in weeks) {
      const reworks = weeks[weekKey];
      for (const reworkKey in reworks) {
        const days = reworks[reworkKey];
        for (const dayKey in days) {
          const shifts = days[dayKey];
          for (const shiftKey in shifts) {
            const shiftData = shifts[shiftKey];
            let totalGood = 0;
            let totalNG = 0;
            if (typeof shiftData === "object" && shiftData !== null) {
              totalGood =
                shiftData.Total_Good ?? shiftData.Total_Product ?? 0;
              totalNG = shiftData.Total_NG ?? 0;
            } else {
              totalGood = shiftData ?? 0;
              totalNG = 0;
            }
            rows.push({
              Week: weekKey,
              WorkplaceName: workplaceName,
              ReworkorNot: reworkKey,
              time_monthday: dayKey,
              WorkingLight: shiftKey,
              Total_Good: totalGood,
              Total_NG: totalNG,
            });
          }
        }
      }
    }
  }
  return rows;
}

export function sanitizeFirebaseKey(key) {
  return String(key ?? "").replace(/[.#$/\[\]]/g, "_");
}
