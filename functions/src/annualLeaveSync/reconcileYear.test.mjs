import { describe, expect, it } from "vitest";
import { buildAttendanceAnnualLeaveDerivedMaps } from "./attendanceDerivedMaps.mjs";
import { persistAnnualLeaveYearFromAttendance } from "./reconcileYear.mjs";
import { resolveCalendarYearInTimeZone } from "./scheduledRecalculate.mjs";
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

  function ref(path = "") {
    const multiPathUpdate = async (patch) => {
      for (const [childPath, value] of Object.entries(patch)) {
        if (value == null) {
          const parts = childPath.split("/");
          let node = store;
          for (let i = 0; i < parts.length - 1; i += 1) {
            node = node[parts[i]];
          }
          delete node[parts[parts.length - 1]];
        } else {
          setAt(childPath, value);
        }
      }
    };

    if (!path) {
      return {
        orderByKey: () => ref(""),
        startAt: () => ref(""),
        endAt: () => ref(""),
        get: async () => ({
          val: () => store,
          exists: () => true,
        }),
        update: multiPathUpdate,
      };
    }

    const scopedRef = {
      orderByKey: () => scopedRef,
      startAt: () => scopedRef,
      endAt: () => scopedRef,
      get: async () => ({
        val: () => getAt(path),
        exists: () => getAt(path) != null,
      }),
      set: async (value) => {
        setAt(path, value);
      },
      update: async (patch) => {
        const current = getAt(path) ?? {};
        setAt(path, { ...current, ...patch });
      },
    };

    return scopedRef;
  }

  return { ref, store };
}

describe("buildAttendanceAnnualLeaveDerivedMaps", () => {
  it("maps June PN into monthly row for emp key", () => {
    const { attendanceMonthlyByEmpKey } = buildAttendanceAnnualLeaveDerivedMaps(
      {
        "2026-06-10": {
          emp_A: { mnv: "A", loaiPhep: "Phép năm" },
        },
      },
      2026,
    );

    expect(attendanceMonthlyByEmpKey.emp_A[5]).toBe(1);
  });
});

describe("persistAnnualLeaveYearFromAttendance", () => {
  it("rebuilds agg and writes annualLeave used/balance", async () => {
    const db = createMockDb({
      attendance: {
        "2026-06-10": {
          emp_A: { mnv: "A", loaiPhep: "Phép năm" },
        },
      },
      annualLeave: {
        2026: {
          _meta: { updatedAt: "old" },
          emp_A: {
            id: "emp_A",
            [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "A",
            [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 12,
            [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 0,
            [ANNUAL_LEAVE_EMP.TOTAL_ANNUAL_LEAVE]: 12,
            [ANNUAL_LEAVE_EMP.BALANCE]: 12,
          },
        },
      },
    });

    const result = await persistAnnualLeaveYearFromAttendance(db, {
      year: 2026,
      attendanceRootOverride: db.store.attendance,
      updatedBy: "test",
    });

    expect(result.appliedCount).toBe(1);
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
    expect(db.store.annualLeave["2026"].emp_A[ANNUAL_LEAVE_EMP.BALANCE]).toBe(
      11,
    );
  });
});

describe("resolveCalendarYearInTimeZone", () => {
  it("uses Asia/Ho_Chi_Minh calendar year", () => {
    const year = resolveCalendarYearInTimeZone(
      new Date("2025-12-31T18:00:00.000Z"),
      "Asia/Ho_Chi_Minh",
    );
    expect(year).toBe(2026);
  });
});
