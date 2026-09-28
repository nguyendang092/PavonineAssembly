import { describe, expect, it } from "vitest";
import {
  inventoryAuditEditableColKeys,
  nextInventoryAuditCell,
  shouldMoveInventoryAuditCell,
} from "./inventoryAuditCellNav";

describe("inventoryAuditCellNav", () => {
  const rows = [{ id: "r1" }, { id: "r2" }];
  const keys = ["tag", "erpCode", "qty", "remarks"];

  it("skips auto-fill columns and locked location", () => {
    expect(inventoryAuditEditableColKeys(false)).toEqual([
      "tag",
      "locationCode",
      "erpCode",
      "qty",
      "remarks",
    ]);
    expect(inventoryAuditEditableColKeys(true)).toEqual([
      "tag",
      "erpCode",
      "qty",
      "remarks",
    ]);
  });

  it("moves up/down in the same column and wraps left/right across rows", () => {
    expect(nextInventoryAuditCell(rows, keys, "r1", "qty", "down")).toEqual({
      rowId: "r2",
      colKey: "qty",
    });
    expect(nextInventoryAuditCell(rows, keys, "r1", "qty", "up")).toBeNull();
    expect(nextInventoryAuditCell(rows, keys, "r1", "tag", "left")).toBeNull();
    expect(nextInventoryAuditCell(rows, keys, "r1", "remarks", "right")).toEqual({
      rowId: "r2",
      colKey: "tag",
    });
    expect(nextInventoryAuditCell(rows, keys, "r2", "tag", "left")).toEqual({
      rowId: "r1",
      colKey: "remarks",
    });
  });

  it("moves left/right only at caret edges", () => {
    const input = { value: "abc", selectionStart: 0, selectionEnd: 0 };
    expect(
      shouldMoveInventoryAuditCell({ key: "ArrowLeft" }, input),
    ).toBe(true);
    expect(
      shouldMoveInventoryAuditCell({ key: "ArrowRight" }, input),
    ).toBe(false);
    expect(
      shouldMoveInventoryAuditCell(
        { key: "ArrowUp" },
        { ...input, selectionStart: 1, selectionEnd: 1 },
      ),
    ).toBe(true);
    expect(
      shouldMoveInventoryAuditCell(
        { key: "ArrowRight" },
        { value: "abc", selectionStart: 3, selectionEnd: 3 },
      ),
    ).toBe(true);
  });
});
