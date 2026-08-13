import { describe, expect, it } from "vitest";

function cloneAdvancedFilters(source) {
  return {
    departmentListFilter: Array.isArray(source.departmentListFilter)
      ? [...source.departmentListFilter]
      : [],
    loaiPhepFilter: Array.isArray(source.loaiPhepFilter)
      ? [...source.loaiPhepFilter]
      : [],
    joinDateYearFilter: String(source.joinDateYearFilter || ""),
    joinDateMonthFilter: String(source.joinDateMonthFilter || ""),
  };
}

function arraysEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function advancedFiltersEqual(a, b) {
  return (
    arraysEqual(a.departmentListFilter, b.departmentListFilter) &&
    arraysEqual(a.loaiPhepFilter, b.loaiPhepFilter) &&
    a.joinDateYearFilter === b.joinDateYearFilter &&
    a.joinDateMonthFilter === b.joinDateMonthFilter
  );
}

describe("attendance advanced filter draft helpers", () => {
  it("cloneAdvancedFilters copies arrays", () => {
    const source = {
      departmentListFilter: ["A", "B"],
      loaiPhepFilter: ["PN"],
      joinDateYearFilter: "2024",
      joinDateMonthFilter: "03",
    };
    const cloned = cloneAdvancedFilters(source);
    expect(cloned).toEqual(source);
    expect(cloned.departmentListFilter).not.toBe(source.departmentListFilter);
  });

  it("advancedFiltersEqual detects draft changes", () => {
    const applied = cloneAdvancedFilters({
      departmentListFilter: ["SX"],
      loaiPhepFilter: [],
      joinDateYearFilter: "",
      joinDateMonthFilter: "",
    });
    const draft = cloneAdvancedFilters(applied);
    expect(advancedFiltersEqual(applied, draft)).toBe(true);
    draft.departmentListFilter.push("HR");
    expect(advancedFiltersEqual(applied, draft)).toBe(false);
  });
});
