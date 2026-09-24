import { describe, expect, it } from "vitest";
import {
  parseInventoryAuditMatrix,
  resolveInventoryAuditColumns,
} from "./parseInventoryAudit";

describe("resolveInventoryAuditColumns", () => {
  it("maps bilingual two-row style headers", () => {
    const headers = [
      "Tag #",
      "Location code Vị trí để hàng",
      "Location name Tên vị trí để hàng",
      "Type of inventory Loại hàng tồn kho",
      "ERP Code",
      "Item name Mục / Loại",
      "Unit Đơn vị tính",
      "Qty số lượng",
      "Remarks Ghi chú",
    ];
    expect(resolveInventoryAuditColumns(headers)).toEqual({
      tag: 0,
      locationCode: 1,
      locationName: 2,
      inventoryType: 3,
      erpCode: 4,
      itemName: 5,
      unit: 6,
      qty: 7,
      remarks: 8,
    });
  });
});

describe("parseInventoryAuditMatrix", () => {
  it("skips empty dash rows and reads qty", () => {
    const matrix = [
      [
        "Tag #",
        "Location code",
        "Location name",
        "Type of inventory",
        "ERP Code",
        "Item name",
        "Unit",
        "Qty",
        "Remarks",
      ],
      [
        "",
        "Vị trí để hàng",
        "Tên vị trí để hàng",
        "Loại hàng tồn kho",
        "",
        "Mục / Loại",
        "Đơn vị tính",
        "số lượng",
        "Ghi chú",
      ],
      ["1", "A-01", "Kệ A", "FG", "ERP-9", "Cover", "EA", 12, ""],
      ["-", "-", "-", "-", "-", "-", "-", "-", "-"],
    ];
    const { rows } = parseInventoryAuditMatrix(matrix);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tag: "1",
      locationCode: "A-01",
      locationName: "Kệ A",
      inventoryType: "FG",
      erpCode: "ERP-9",
      itemName: "Cover",
      unit: "EA",
      qty: 12,
    });
  });

  it("accepts a source sheet without audit template headers", () => {
    const { records } = parseInventoryAuditMatrix(
      [
        ["ColA", "ColB", "ColC", "ColD", "TypeE"],
        ["1", "WH-1", "x", "y", "FG"],
      ],
      { requireAuditColumns: false },
    );
    expect(records).toHaveLength(1);
    expect(records[0][4]).toBe("FG");
  });
});
