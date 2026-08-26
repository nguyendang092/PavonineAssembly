/**
 * Vitest helper: mock `runTransaction` for `annualLeave/{year}/{empKey}` paths.
 * Mutator receives current node from `yearRecords`; other paths use agg-style mutator(null).
 */
export function createAnnualLeaveRunTransactionMock(yearRecords = {}) {
  return async (path, mutator) => {
    const empMatch = /^annualLeave\/\d+\/(emp_[^/]+)$/.exec(String(path));
    if (empMatch) {
      const empKey = empMatch[1];
      const current = yearRecords[empKey] ?? null;
      const next = mutator(current);
      if (next === undefined) {
        return { committed: false, snapshot: { val: () => current } };
      }
      yearRecords[empKey] = next;
      return { committed: true, snapshot: { val: () => next } };
    }

    const next = mutator(null);
    return { committed: true, snapshot: { val: () => next } };
  };
}
