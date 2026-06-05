import { describe, expect, it } from "vitest";
import { buildCompareSttRankMap } from "./attendanceCompareEmployeesLogic";
import { sortEmployeesStableAsc } from "./attendanceListSort";
import { resolveAttendanceDisplayStt } from "./attendanceSeasonalStt";

describe("buildCompareSttRankMap", () => {
  it("matches table STT order for seasonal rows without sttThoiVu", () => {
    const rows = [
      { mnv: "A", hoVaTen: "Alpha" },
      { mnv: "B", hoVaTen: "Beta", sttThoiVu: 2 },
      { mnv: "C", hoVaTen: "Gamma" },
      { mnv: "D", hoVaTen: "Delta", stt: 99 },
    ];
    const seasonal = true;
    const sorted = sortEmployeesStableAsc(rows, { seasonal });
    const rankMap = buildCompareSttRankMap(rows, seasonal);

    sorted.forEach((emp, idx) => {
      const key = emp.mnv;
      const expected = resolveAttendanceDisplayStt(emp, idx + 1, seasonal);
      expect(rankMap.get(key)).toBe(expected);
    });
  });

  it("ignores official stt for seasonal — uses fallback index", () => {
    const rows = [{ mnv: "X", hoVaTen: "Test", stt: 55 }];
    const rankMap = buildCompareSttRankMap(rows, true);
    expect(rankMap.get("X")).toBe(1);
  });
});
