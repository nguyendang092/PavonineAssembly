/**
 * Vitest helper: apply multi-path `update(ref(db), updates)` into `yearRecords`.
 */
export function createAnnualLeaveBatchUpdateMock(yearRecords = {}) {
  return async (_rootRef, updates) => {
    if (!updates || typeof updates !== "object") return;

    for (const [path, payload] of Object.entries(updates)) {
      const empMatch = /^annualLeave\/\d+\/(emp_[^/]+)$/.exec(String(path));
      if (!empMatch || !payload || typeof payload !== "object") continue;
      const empKey = empMatch[1];
      yearRecords[empKey] = { ...(yearRecords[empKey] ?? {}), ...payload };
    }
  };
}
