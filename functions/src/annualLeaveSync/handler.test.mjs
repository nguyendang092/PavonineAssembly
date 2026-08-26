import { describe, expect, it, vi } from "vitest";
import { handleAttendanceEmpAnnualLeaveSync } from "./handler.mjs";
import { ANNUAL_LEAVE_EMP } from "./fields.mjs";
import { ATTENDANCE_LEAVE_AGG_EMP } from "./fields.mjs";

function createMockDb(initial = {}) {
  const store = structuredClone(initial);

  function pathParts(path) {
    return String(path).split("/").filter(Boolean);
  }

  function getAt(path) {
    let node = store;
    for (const part of pathParts(path)) {
      if (node == null || typeof node !== "object") return null;
      node = node[part];
    }
    return node ?? null;
  }

  function setAt(path, value) {
    const parts = pathParts(path);
    let node = store;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const part = parts[i];
      if (!node[part] || typeof node[part] !== "object") node[part] = {};
      node = node[part];
    }
    const leaf = parts[parts.length - 1];
    if (value == null) delete node[leaf];
    else node[leaf] = value;
  }

  function ref(path) {
    return {
      get: async () => ({
        val: () => getAt(path),
        exists: () => getAt(path) != null,
      }),
      update: async (patch) => {
        const current = getAt(path) ?? {};
        setAt(path, { ...current, ...patch });
      },
      transaction: async (mutator) => {
        const current = getAt(path);
        const next = mutator(current);
        if (next === undefined) {
          return { committed: false, snapshot: { val: () => current } };
        }
        setAt(path, next);
        return { committed: true, snapshot: { val: () => next } };
      },
    };
  }

  return {
    ref,
    store,
  };
}

describe("handleAttendanceEmpAnnualLeaveSync", () => {
  it("skips _meta writes", async () => {
    const db = createMockDb();
    const result = await handleAttendanceEmpAnnualLeaveSync(db, {
      dateKey: "2026-06-01",
      empKey: "_meta",
      before: null,
      after: { isOffDay: true },
    });
    expect(result.skipped).toBe(true);
  });

  it("applies delta on loai phep change and updates annualLeave", async () => {
    const db = createMockDb({
      annualLeave: {
        2026: {
          emp_A: {
            [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 12,
            [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 0,
            [ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]: 12,
            [ANNUAL_LEAVE_EMP.BALANCE]: 12,
          },
        },
      },
    });

    const result = await handleAttendanceEmpAnnualLeaveSync(db, {
      dateKey: "2026-06-10",
      empKey: "emp_A",
      before: null,
      after: { mnv: "A", loaiPhep: "Phép năm" },
    });

    expect(result.applied).toBe(true);
    expect(result.delta).toBe(1);
    expect(
      db.store.attendanceLeaveAgg["2026"].emp_A[
        ATTENDANCE_LEAVE_AGG_EMP.DEDUCTION_BY_MONTH
      ]["06"],
    ).toBe(1);
    expect(
      db.store.annualLeave["2026"].emp_A[
        ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED
      ],
    ).toBe(1);
    expect(
      db.store.annualLeave["2026"].emp_A[ANNUAL_LEAVE_EMP.BALANCE],
    ).toBe(11);
  });

  it("reverses deduction when attendance row is deleted", async () => {
    const db = createMockDb({
      attendanceLeaveAgg: {
        2026: {
          emp_A: {
            [ATTENDANCE_LEAVE_AGG_EMP.DEDUCTION_BY_MONTH]: { "06": 1 },
          },
        },
      },
      annualLeave: {
        2026: {
          emp_A: {
            [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 12,
            [ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED]: 1,
            [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 1,
            [ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]: 12,
            [ANNUAL_LEAVE_EMP.BALANCE]: 11,
          },
        },
      },
    });

    const result = await handleAttendanceEmpAnnualLeaveSync(db, {
      dateKey: "2026-06-10",
      empKey: "emp_A",
      before: { mnv: "A", loaiPhep: "Phép năm" },
      after: null,
    });

    expect(result.applied).toBe(true);
    expect(result.delta).toBe(-1);
    expect(
      db.store.attendanceLeaveAgg["2026"].emp_A?.[
        ATTENDANCE_LEAVE_AGG_EMP.DEDUCTION_BY_MONTH
      ],
    ).toBeUndefined();
    expect(
      db.store.annualLeave["2026"].emp_A[
        ANNUAL_LEAVE_EMP.ATTENDANCE_ANNUAL_LEAVE_USED
      ],
    ).toBe(0);
  });
});
