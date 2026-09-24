import { describe, expect, it } from "vitest";
import {
  applyInventoryAuditLookup,
  assertInventoryAuditSourceSize,
  buildInventoryAuditLookupIndex,
  compactInventoryAuditSource,
  packInventoryAuditSource,
} from "./inventoryAuditLookup";
import { packInventoryAuditSourceTable } from "./inventoryAuditSourceTable";

describe("inventoryAuditLookup", () => {
  const rows = [
    {
      locationCode: "A-01",
      locationName: "Kệ A",
      inventoryType: "FG",
      erpCode: "ERP-9",
      itemName: "Cover",
      unit: "EA",
    },
    {
      locationCode: "B-02",
      locationName: "Kệ B",
      inventoryType: "RM",
      erpCode: "ERP-1",
      itemName: "Resin",
      unit: "KG",
    },
    {
      locationCode: "B-02",
      locationName: "Kệ B",
      inventoryType: "RM",
      erpCode: "ERP-2",
      itemName: "Pigment",
      unit: "G",
    },
  ];
  const catalog = compactInventoryAuditSource(rows);
  const packed = packInventoryAuditSource(catalog);
  const index = buildInventoryAuditLookupIndex(packed);

  it("fills item + location when location has a unique code", () => {
    expect(
      applyInventoryAuditLookup({ locationCode: "a-01", erpCode: "" }, index),
    ).toMatchObject({
      locationCode: "a-01",
      erpCode: "ERP-9",
      locationName: "Kệ A",
      inventoryType: "FG",
      itemName: "Cover",
      unit: "EA",
    });
  });

  it("fills item fields from ERP code", () => {
    expect(
      applyInventoryAuditLookup({ locationCode: "", erpCode: "erp-1" }, index),
    ).toMatchObject({
      locationName: "",
      inventoryType: "RM",
      itemName: "Resin",
      unit: "KG",
    });
  });

  it("fills only location name when a bin has many items", () => {
    expect(
      applyInventoryAuditLookup({ locationCode: "B-02", erpCode: "" }, index),
    ).toMatchObject({
      locationName: "Kệ B",
      erpCode: "",
      itemName: "",
      unit: "",
      inventoryType: "",
    });
  });

  it("packs as TSV without repeating column names", () => {
    expect(packed.v).toBe(2);
    expect(packed.n).toBe(3);
    expect(packed.ic).toBe(3);
    expect(packed.lc).toBe(2);
    expect(packed.I).toContain("ERP-9\tCover\tEA\tFG");
    expect(JSON.stringify(packed)).not.toContain("itemName");
    expect(JSON.stringify(packed)).not.toContain("locationName");
    expect(() => assertInventoryAuditSourceSize(packed)).not.toThrow();
  });

  it("still reads the old object catalog", () => {
    const legacyIndex = buildInventoryAuditLookupIndex(catalog);
    expect(
      applyInventoryAuditLookup({ locationCode: "A-01", erpCode: "" }, legacyIndex)
        .itemName,
    ).toBe("Cover");
  });

  it("looks up from a full stored table without merging saved rows", () => {
    const packedTable = packInventoryAuditSourceTable({
      headers: [
        "Tag #",
        "Item B",
        "Location code",
        "Other D",
        "Type col E",
        "ERP Code",
        "Skip",
        "Unit",
      ],
      records: [
        ["1", "Cover", "A-01", "skip-D", "FG", "ERP-9", "x", "EA"],
        ["1", "Cover", "A-01", "skip-D", "FG", "ERP-9", "x", "EA"],
      ],
    });
    expect(packedTable.meta.n).toBe(2);
    const tableIndex = buildInventoryAuditLookupIndex(packedTable);
    expect(
      applyInventoryAuditLookup({ locationCode: "A-01", erpCode: "" }, tableIndex),
    ).toMatchObject({
      itemName: "Cover",
      inventoryType: "FG",
    });
  });

  it("fills Tên vị trí from BF by searching Vị trí để hàng in the source", () => {
    const record = Array(58).fill("");
    record[1] = "Cover";
    record[2] = "WH-99";
    record[4] = "FG";
    record[21] = "EA";
    record[57] = "Kệ BF";
    const headers = Array(58).fill("");
    headers[2] = "Vị trí để hàng";
    headers[5] = "ERP Code";
    record[5] = "ERP-9";
    const packedTable = packInventoryAuditSourceTable({
      headers,
      records: [record],
    });
    const tableIndex = buildInventoryAuditLookupIndex(packedTable);
    expect(
      applyInventoryAuditLookup(
        { locationCode: "wh-99", erpCode: "" },
        tableIndex,
      ),
    ).toMatchObject({
      locationName: "Kệ BF",
      itemName: "Cover",
      unit: "EA",
      inventoryType: "FG",
    });
  });

  it("finds WH039 in source and fills Tên vị trí from column BF", () => {
    const record = Array(58).fill("");
    record[10] = "WH039";
    record[57] = "Kho 039";
    const headers = Array(58).fill("x");
    headers[10] = "Other";
    const packedTable = packInventoryAuditSourceTable({
      headers,
      records: [record],
    });
    const tableIndex = buildInventoryAuditLookupIndex(packedTable);
    expect(
      applyInventoryAuditLookup(
        { locationCode: "WH039", erpCode: "" },
        tableIndex,
      ).locationName,
    ).toBe("Kho 039");
    expect(
      applyInventoryAuditLookup(
        { locationCode: "wh-039", erpCode: "" },
        tableIndex,
      ).locationName,
    ).toBe("Kho 039");
  });
});
