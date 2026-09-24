import { describe, expect, it } from "vitest";
import {
  formatInventoryAuditRemarks,
  isEmptyInventoryAuditRow,
  mergeInventoryAuditRowLists,
  normalizeInventoryAuditRow,
  payloadToInventoryAuditRows,
} from "./constants";

describe("mergeInventoryAuditRowLists", () => {
  it("keeps dest ids and clones other rows", () => {
    const dest = [
      {
        id: "keep-me",
        tag: "A",
        qty: 1,
      },
    ];
    const other = [
      {
        id: "other-1",
        tag: "B",
        locationCode: "WH1",
        qty: 2,
      },
      { id: "empty" },
    ];
    const merged = mergeInventoryAuditRowLists(dest, [other]);
    expect(merged).toHaveLength(2);
    expect(merged[0].id).toBe("keep-me");
    expect(merged[0].tag).toBe("A");
    expect(merged[1].id).not.toBe("other-1");
    expect(merged[1].tag).toBe("B");
    expect(isEmptyInventoryAuditRow(merged[1])).toBe(false);
  });

  it("reads rows from firebase payload", () => {
    expect(
      payloadToInventoryAuditRows({ named: {}, rows: [{ tag: "X" }] }),
    ).toHaveLength(1);
    expect(payloadToInventoryAuditRows(null)).toEqual([]);
  });
});

describe("formatInventoryAuditRemarks", () => {
  it("trims spaces and capitalizes the first letter", () => {
    expect(formatInventoryAuditRemarks("  hàng lệch kệ  ")).toBe(
      "Hàng lệch kệ",
    );
    expect(formatInventoryAuditRemarks("ok")).toBe("Ok");
    expect(formatInventoryAuditRemarks("")).toBe("");
    expect(formatInventoryAuditRemarks("   ")).toBe("");
  });

  it("formats remarks when normalizing a row", () => {
    expect(
      normalizeInventoryAuditRow({ remarks: "\n  thiếu tem\t" }).remarks,
    ).toBe("Thiếu tem");
  });
});
