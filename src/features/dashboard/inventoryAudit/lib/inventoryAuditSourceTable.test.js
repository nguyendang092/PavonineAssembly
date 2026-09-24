import { describe, expect, it } from "vitest";
import {
  packInventoryAuditSourceTable,
  sourceRecordsToAuditRows,
  sourceRecordsToObjects,
  unpackInventoryAuditSourceTable,
} from "./inventoryAuditSourceTable";

describe("inventoryAuditSourceTable", () => {
  it("stores every row and column then reads them back", () => {
    const headers = ["Location code", "ERP Code", "Amount", "Note"];
    const records = [
      ["A-01", "ERP-9", "12", "keep me"],
      ["A-01", "ERP-9", "8", "duplicate ok"],
      ["B-02", "ERP-1", "3", ""],
    ];
    const packed = packInventoryAuditSourceTable({
      headers,
      records,
      extra: { fileName: "stock.xlsx" },
    });
    expect(packed.meta.v).toBe(3);
    expect(packed.meta.n).toBe(3);
    expect(packed.meta.c).toBe(4);
    expect(Object.keys(packed.parts)).toEqual(["0"]);

    const table = unpackInventoryAuditSourceTable(packed);
    expect(table.records).toEqual(records);
    expect(sourceRecordsToObjects(table)[1]).toMatchObject({
      Amount: "8",
      Note: "duplicate ok",
    });
    expect(sourceRecordsToAuditRows(table)[0]).toMatchObject({
      locationCode: "A-01",
      erpCode: "ERP-9",
    });
  });

  it("maps Loại hàng from Excel column E", () => {
    const headers = ["A", "B", "C", "D", "Type of inventory", "ERP Code"];
    const records = [["loc", "x", "y", "HEADER-TYPE-SKIP", "FG-E", "ERP-9"]];
    const table = unpackInventoryAuditSourceTable(
      packInventoryAuditSourceTable({ headers, records }),
    );
    expect(sourceRecordsToAuditRows(table)[0].inventoryType).toBe("FG-E");
  });

  it("maps Mục / Loại from Excel column B", () => {
    const headers = ["A", "Item name", "Location code"];
    const records = [["skip-A", "COVER-B", "A-01"]];
    const table = unpackInventoryAuditSourceTable(
      packInventoryAuditSourceTable({ headers, records }),
    );
    expect(sourceRecordsToAuditRows(table)[0].itemName).toBe("COVER-B");
  });

  it("maps Đơn vị tính from Excel column V", () => {
    const record = Array(22).fill("");
    record[21] = "EA-V";
    const headers = Array(22).fill("");
    const table = unpackInventoryAuditSourceTable(
      packInventoryAuditSourceTable({ headers, records: [record] }),
    );
    expect(sourceRecordsToAuditRows(table)[0].unit).toBe("EA-V");
  });

  it("maps Tên vị trí để hàng from Excel column BF", () => {
    const record = Array(58).fill("");
    record[2] = "A-01";
    record[57] = "Kệ BF";
    const headers = Array(58).fill("");
    headers[2] = "Location code";
    const table = unpackInventoryAuditSourceTable(
      packInventoryAuditSourceTable({ headers, records: [record] }),
    );
    expect(sourceRecordsToAuditRows(table)[0].locationName).toBe("Kệ BF");
  });
});
