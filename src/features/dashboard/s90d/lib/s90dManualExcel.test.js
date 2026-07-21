import { describe, expect, it } from "vitest";
import {
  buildS90dExcelHeaders,
  mergeImportedRowsIntoStore,
  normalizeExcelShiftSlot,
  parseS90dManualExcelRows,
} from "./s90dManualExcel";

describe("s90dManualExcel", () => {
  it("builds headers with defect columns", () => {
    const headers = buildS90dExcelHeaders();
    expect(headers.slice(0, 6)).toEqual([
      "Ngày",
      "Công đoạn",
      "Bảng",
      "Ca",
      "Mã hàng",
      "SL đạt",
    ]);
    expect(headers).toContain("Trầy, xước");
  });

  it("parses spreadsheet rows with board index", () => {
    const rows = parseS90dManualExcelRows(
      [
        buildS90dExcelHeaders(),
        ["2026-07-01", "PRESS", 2, "08-10", "S90D", 12, 1, 0, 0, 0],
      ],
      {},
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      dateKey: "2026-07-01",
      process: "PRESS",
      boardIndex: 2,
      shiftSlot: "08~10",
      okQty: 12,
      defects: { rawMaterial: 1 },
    });
  });

  it("normalizes legacy shift labels", () => {
    expect(normalizeExcelShiftSlot("20-24")).toBe("20~22");
    expect(normalizeExcelShiftSlot("22-24")).toBe("22~24");
  });

  it("merges parsed rows into manual store boards", () => {
    const store = mergeImportedRowsIntoStore({}, [
      {
        dateKey: "2026-07-01",
        process: "PRESS",
        boardIndex: 1,
        shiftSlot: "08~10",
        productCode: "S90D-A",
        okQty: 20,
        defects: { scratch: 2, dent: 0 },
      },
    ]);

    expect(store["2026-07-01"].PRESS.boards[0].productCode).toBe("S90D-A");
    expect(store["2026-07-01"].PRESS.boards[0].shifts["08~10"].okQty).toBe(20);
    expect(store["2026-07-01"].PRESS.boards[0].shifts["08~10"].defects.scratch).toBe(2);
    expect(store["2026-07-01"].PRESS.boards[0].shifts["08~10"].ngQty).toBe(2);
  });

  it("creates second board when importing board index 2", () => {
    const store = mergeImportedRowsIntoStore({}, [
      {
        dateKey: "2026-07-01",
        process: "PRESS",
        boardIndex: 2,
        shiftSlot: "08~10",
        productCode: "S90D-B",
        okQty: 7,
        defects: {},
      },
    ]);

    expect(store["2026-07-01"].PRESS.boards).toHaveLength(2);
    expect(store["2026-07-01"].PRESS.boards[1].productCode).toBe("S90D-B");
    expect(store["2026-07-01"].PRESS.boards[1].shifts["08~10"].okQty).toBe(7);
  });
});
