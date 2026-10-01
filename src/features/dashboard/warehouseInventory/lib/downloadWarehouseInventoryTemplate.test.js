import { describe, expect, it } from "vitest";
import {
  WAREHOUSE_INVENTORY_TEMPLATE_HEADERS,
  WAREHOUSE_INVENTORY_TEMPLATE_SAMPLE_ROW,
} from "./downloadWarehouseInventoryTemplate";
import { parseWarehouseInventoryMatrix } from "./parse";

describe("warehouse inventory Excel template", () => {
  it("uses the source-file column order", () => {
    expect(WAREHOUSE_INVENTORY_TEMPLATE_HEADERS).toEqual([
      "Month",
      "No.",
      "구분",
      "WAREHOUSE",
      "ITEM",
      "SPEC",
      "MODEL",
      "UNIT",
      "창고(Mã kho)",
      "STATUS",
      "CODE",
      "THỰC TẾ",
      "LYDO",
      "전산수량",
      "현재고량",
      "Gap",
      "Gap(ABS)",
      "Check",
      "CHECK IN",
      "2차확인",
      "실사구분(실사)",
      "단가",
      "재고금액",
      "재고금액(실사)",
      "재고금액(ERP)",
    ]);
  });

  it("headers and sample row parse as a valid import sheet", () => {
    const { rows, colMap } = parseWarehouseInventoryMatrix([
      WAREHOUSE_INVENTORY_TEMPLATE_HEADERS,
      WAREHOUSE_INVENTORY_TEMPLATE_SAMPLE_ROW,
    ]);

    expect(colMap.actualQty).toBeDefined();
    expect(colMap.month).toBeDefined();
    expect(colMap.code).toBeDefined();
    expect(colMap.currentQty).toBeDefined();
    expect(colMap.reason).toBeDefined();
    expect(colMap.whCode).toBeDefined();
    expect(colMap.warehouseName).toBeDefined();
    expect(rows).toHaveLength(1);
    expect(rows[0].actualQty).toBe(10);
    expect(rows[0].sysQty).toBe(10);
    expect(String(rows[0].code)).toBe("SAMPLE-001");
    expect(String(rows[0].whCode)).toBe("WH010");
    expect(String(rows[0].warehouseName)).toBe("Raw Material");
  });
});
