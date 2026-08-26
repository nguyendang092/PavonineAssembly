import { afterEach, describe, expect, it } from "vitest";
import {
  buildDerivedMapsFilterKey,
  clearAnnualLeaveDerivedRuntimeCache,
  syncAttendanceDerivedMaps,
} from "./annualLeaveDerivedRuntimeCache";

describe("syncAttendanceDerivedMaps", () => {
  afterEach(() => {
    clearAnnualLeaveDerivedRuntimeCache();
  });

  it("returns cached scope maps without recomputing on a repeat sync", () => {
    const year = 2026;
    const filterKey = buildDerivedMapsFilterKey({});
    const attendanceScopeKey = "attendance:2026:full";
    const scopeEmpKeySet = new Set(["emp_100"]);
    const attendanceRoot = {
      "2026-01-15": {
        emp_100: { annualLeaveUsed: 1 },
      },
    };

    const first = syncAttendanceDerivedMaps({
      attendanceRoot,
      year,
      filterKey,
      deductionFilter: { scopeEmpKeySet },
      scopeEmpKeySet,
      attendanceScopeKey,
    });

    expect(first.recomputedEmpKeys.has("emp_100")).toBe(true);
    expect(first.maps.deductionsByEmpKey.emp_100).toBeDefined();

    const second = syncAttendanceDerivedMaps({
      attendanceRoot,
      year,
      filterKey,
      deductionFilter: { scopeEmpKeySet },
      scopeEmpKeySet,
      attendanceScopeKey,
      prevMaps: first.maps,
    });

    expect(second.recomputedEmpKeys.size).toBe(0);
    expect(second.maps.deductionsByEmpKey.emp_100).toBe(
      first.maps.deductionsByEmpKey.emp_100,
    );
  });
});
