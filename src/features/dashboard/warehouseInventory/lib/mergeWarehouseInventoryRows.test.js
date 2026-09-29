import { describe, expect, it } from "vitest";
import { mergeWarehouseInventoryRows, removeWarehouseInventoryRowsByMonth } from "./mergeWarehouseInventoryRows";

describe("mergeWarehouseInventoryRows", () => {
  it("keeps old months and appends a new month", () => {
    const existing = [
      { month: "03-2026", code: "A", whCode: "WH1", category: "X", actualQty: 1 },
    ];
    const incoming = [
      { month: "04-2026", code: "B", whCode: "WH1", category: "X", actualQty: 5 },
    ];
    const merged = mergeWarehouseInventoryRows(existing, incoming);
    expect(merged).toHaveLength(2);
    expect(merged.map((r) => r.code).sort()).toEqual(["A", "B"]);
  });

  it("replaces the same code+month+warehouse instead of duplicating", () => {
    const existing = [
      { month: "03-2026", code: "A", whCode: "WH1", category: "X", actualQty: 1 },
    ];
    const incoming = [
      { month: "03-2026", code: "A", whCode: "WH1", category: "X", actualQty: 9 },
    ];
    const merged = mergeWarehouseInventoryRows(existing, incoming);
    expect(merged).toHaveLength(1);
    expect(merged[0].actualQty).toBe(9);
  });

  it("removes only the selected month", () => {
    const existing = [
      { month: "03-2026", code: "A", whCode: "WH1", category: "X", actualQty: 1 },
      { month: "04-2026", code: "B", whCode: "WH1", category: "X", actualQty: 5 },
    ];
    const next = removeWarehouseInventoryRowsByMonth(existing, "2026-03");
    expect(next).toHaveLength(1);
    expect(next[0].code).toBe("B");
  });
});
