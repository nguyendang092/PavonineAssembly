import { describe, expect, it } from "vitest";
import {
  S90D_DEFECT_COLUMNS,
  normalizeDefectCounts,
  sumDefectCounts,
} from "./s90dDefectColumns";

describe("s90dDefectColumns", () => {
  it("keeps a single loang màu column and adds GAP", () => {
    const keys = S90D_DEFECT_COLUMNS.map((column) => column.key);
    expect(keys).not.toContain("tape");
    expect(keys).toContain("stain");
    expect(keys.indexOf("gap")).toBe(keys.indexOf("stain") + 1);
    expect(
      S90D_DEFECT_COLUMNS.find((column) => column.key === "stain")?.vi,
    ).toBe("Lỗi loang màu");
    expect(S90D_DEFECT_COLUMNS.find((column) => column.key === "gap")?.vi).toBe(
      "Lỗi GAP",
    );
  });

  it("merges legacy nhuộm (tape) into loang màu (stain)", () => {
    const counts = normalizeDefectCounts({ tape: 3, stain: 2, scratch: 1 });
    expect(counts.stain).toBe(5);
    expect(counts.scratch).toBe(1);
    expect(counts.tape).toBeUndefined();
    expect(counts.gap).toBe(0);
    expect(sumDefectCounts(counts)).toBe(6);
  });
});
