import { describe, expect, it } from "vitest";
import { yearFromMonthKey } from "./parse";
import {
  filterAndSortStructuredRows,
  groupStructuredRowsByMonth,
  summarizeStructuredRowsByMonth,
} from "./filterStructuredRows";

const row = (monthKey, month, actualQty = 1, extra = {}) => ({
  monthKey,
  month,
  actualQty,
  sysQty: 1,
  amountActual: 10,
  amountErp: extra.amountErp ?? 0,
  monthlyDiff: extra.monthlyDiff ?? 0,
  codeDelta: 0,
  gapAmount: extra.gapAmount ?? 0,
});

describe("groupStructuredRowsByMonth", () => {
  it("groups and totals by monthKey", () => {
    const groups = groupStructuredRowsByMonth([
      row("2026-08", "08-2026", 2),
      row("2026-09", "09-2026", 5),
      row("2026-08", "08-2026", 3),
    ]);
    expect(groups.map((g) => g.monthKey)).toEqual(["2026-08", "2026-09"]);
    expect(groups[0].actual).toBe(5);
    expect(groups[0].rows).toHaveLength(2);
    expect(groups[1].actual).toBe(5);
  });
});

describe("summarizeStructuredRowsByMonth", () => {
  it("builds dashboard totals per month instead of one grand total", () => {
    const months = summarizeStructuredRowsByMonth([
      row("2026-08", "08-2026", 2, { monthlyDiff: 1, gapAmount: 100 }),
      row("2026-09", "09-2026", 5, { monthlyDiff: 2, gapAmount: 50 }),
      row("2026-08", "08-2026", 3, { monthlyDiff: 1, gapAmount: 20 }),
    ]);
    expect(months).toHaveLength(2);
    expect(months[0].month).toBe("08-2026");
    expect(months[0].actual).toBe(5);
    expect(months[0].monthlyDiff).toBe(2);
    expect(months[0].gapAmount).toBe(120);
    expect(months[0].rows).toBe(2);
    expect(months[1].actual).toBe(5);
    expect(months[1].gapAmount).toBe(50);
  });

  it("sums 재고금액(ERP) for the money row", () => {
    const months = summarizeStructuredRowsByMonth([
      row("2026-08", "08-2026", 1, { amountErp: 100 }),
      row("2026-08", "08-2026", 1, { amountErp: 50 }),
    ]);
    expect(months[0].amountErp).toBe(150);
    expect(months[0].erpUnitRate).toBe(75);
  });
});

describe("yearFromMonthKey", () => {
  it("reads year from YYYY-MM and MM-YYYY", () => {
    expect(yearFromMonthKey("2026-08")).toBe("2026");
    expect(yearFromMonthKey("08-2026")).toBe("2026");
  });
});

describe("filterAndSortStructuredRows yearFilter", () => {
  it("keeps only rows in the selected year", () => {
    const rows = [
      row("2025-12", "12-2025"),
      row("2026-01", "01-2026"),
      row("2026-02", "02-2026"),
    ];
    const filtered = filterAndSortStructuredRows(rows, {
      whFilter: "",
      categoryFilter: "",
      monthFilter: "",
      yearFilter: "2026",
      codeSearch: "",
      hideZeroMonthlyDiff: false,
      hideZeroActualQty: false,
    });
    expect(filtered.map((r) => r.monthKey)).toEqual(["2026-01", "2026-02"]);
  });

  it("sorts by actual quantity asc or desc", () => {
    const rows = [
      { ...row("2026-01", "01-2026", 3), code: "C" },
      { ...row("2026-01", "01-2026", 8), code: "A" },
      { ...row("2026-01", "01-2026", 1), code: "B" },
    ];
    const base = {
      whFilter: "",
      categoryFilter: "",
      monthFilter: "",
      yearFilter: "",
      codeSearch: "",
      hideZeroMonthlyDiff: false,
      hideZeroActualQty: false,
    };
    expect(
      filterAndSortStructuredRows(rows, { ...base, qtySort: "asc" }).map(
        (r) => r.code,
      ),
    ).toEqual(["B", "C", "A"]);
    expect(
      filterAndSortStructuredRows(rows, { ...base, qtySort: "desc" }).map(
        (r) => r.code,
      ),
    ).toEqual(["A", "C", "B"]);
  });

  it("in compare mode sorts by quantity delta, not last-month qty", () => {
    const rows = [
      {
        ...row("cmp", "02→03", 2),
        code: "LOW",
        isMonthCompareRow: true,
        actualQtyTo: 90,
      },
      {
        ...row("cmp", "02→03", 15),
        code: "HIGH",
        isMonthCompareRow: true,
        actualQtyTo: 10,
      },
    ];
    const base = {
      whFilter: "",
      categoryFilter: "",
      monthFilter: "",
      yearFilter: "",
      codeSearch: "",
      hideZeroMonthlyDiff: false,
      hideZeroActualQty: false,
    };
    expect(
      filterAndSortStructuredRows(rows, { ...base, qtySort: "desc" }).map(
        (r) => r.code,
      ),
    ).toEqual(["HIGH", "LOW"]);
  });

  it("sorts by ERP amount asc or desc", () => {
    const rows = [
      { ...row("2026-01", "01-2026", 9, { amountErp: 100 }), code: "C" },
      { ...row("2026-01", "01-2026", 1, { amountErp: 800 }), code: "A" },
      { ...row("2026-01", "01-2026", 5, { amountErp: 40 }), code: "B" },
    ];
    const base = {
      whFilter: "",
      categoryFilter: "",
      monthFilter: "",
      yearFilter: "",
      codeSearch: "",
      hideZeroMonthlyDiff: false,
      hideZeroActualQty: false,
      sortBy: "amount",
    };
    expect(
      filterAndSortStructuredRows(rows, { ...base, qtySort: "asc" }).map(
        (r) => r.code,
      ),
    ).toEqual(["B", "C", "A"]);
    expect(
      filterAndSortStructuredRows(rows, { ...base, qtySort: "desc" }).map(
        (r) => r.code,
      ),
    ).toEqual(["A", "C", "B"]);
  });

  it("in compare mode amount sort uses money delta", () => {
    const rows = [
      {
        ...row("cmp", "02→03", 99, { amountErp: 10 }),
        code: "LOW",
        isMonthCompareRow: true,
      },
      {
        ...row("cmp", "02→03", 1, { amountErp: 500 }),
        code: "HIGH",
        isMonthCompareRow: true,
      },
    ];
    const base = {
      whFilter: "",
      categoryFilter: "",
      monthFilter: "",
      yearFilter: "",
      codeSearch: "",
      hideZeroMonthlyDiff: false,
      hideZeroActualQty: false,
      sortBy: "amount",
      qtySort: "desc",
    };
    expect(
      filterAndSortStructuredRows(rows, base).map((r) => r.code),
    ).toEqual(["HIGH", "LOW"]);
  });
});
