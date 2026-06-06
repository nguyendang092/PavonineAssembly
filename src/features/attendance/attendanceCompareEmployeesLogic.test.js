import { describe, expect, it } from "vitest";
import {
  buildCompareChartAlignedDeptEmployeeMap,
  buildOfficialCompareDeptEmployeeMap,
  buildCompareSttRankMap,
  mergeCompareDepartmentListChartAligned,
  mergeCompareDepartmentListOfficial,
} from "./attendanceCompareEmployeesLogic";
import { sortEmployeesStableAsc } from "./attendanceListSort";
import { resolveAttendanceDisplayStt } from "./attendanceSeasonalStt";

const normalizeDepartment = (v) =>
  String(v ?? "")
    .trim()
    .toLowerCase();

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

  it("uses official stt field when seasonal=false", () => {
    const rows = [{ mnv: "A", hoVaTen: "Alpha", stt: 42 }];
    const rankMap = buildCompareSttRankMap(rows, false);
    expect(rankMap.get("A")).toBe(42);
  });
});

describe("buildOfficialCompareDeptEmployeeMap", () => {
  it("only includes production BP — excludes HR / non-SX departments", () => {
    const map = buildOfficialCompareDeptEmployeeMap(
      [
        { mnv: "1", hoVaTen: "A", boPhan: "Extrusion" },
        { mnv: "2", hoVaTen: "B", boPhan: "Nhân sự" },
      ],
      normalizeDepartment,
      new Map(),
      false,
    );
    expect(map.has("Extrusion")).toBe(true);
    expect(map.size).toBe(1);
  });
});

describe("mergeCompareDepartmentListOfficial", () => {
  it("lists configured production labels in picker order", () => {
    const prev = new Map([["Extrusion", new Map()]]);
    const curr = new Map();
    const order = ["extrusion", "press", "anodizing"];
    const merged = mergeCompareDepartmentListOfficial(order, prev, curr);
    expect(merged.slice(0, 3)).toEqual(["Extrusion", "Press", "Anodizing"]);
  });
});

describe("buildCompareChartAlignedDeptEmployeeMap", () => {
  it("groups ANODIZING under chart label Anodizing", () => {
    const map = buildCompareChartAlignedDeptEmployeeMap(
      [{ mnv: "1", hoVaTen: "A", boPhan: "ANODIZING" }],
      normalizeDepartment,
      new Map(),
      true,
    );
    expect(map.has("Anodizing")).toBe(true);
    expect(map.has("ANODIZING")).toBe(false);
  });
});

describe("mergeCompareDepartmentListChartAligned", () => {
  it("orders departments like combo chart picker (Extrusion before Anodizing)", () => {
    const prev = new Map([
      ["Anodizing", new Map()],
      ["Extrusion", new Map()],
      ["HairLine", new Map()],
    ]);
    const curr = new Map([["Press", new Map()]]);
    const order = [
      "extrusion",
      "press",
      "mc",
      "hairline",
      "anodizing",
      "assy",
    ];
    const merged = mergeCompareDepartmentListChartAligned(
      order,
      prev,
      curr,
      normalizeDepartment,
    );
    expect(merged).toEqual(["Extrusion", "Press", "HairLine", "Anodizing"]);
  });
});
