import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  buildInventoryAuditExportSheet,
  buildInventoryAuditWorkbook,
  excelBufferToUint8Array,
  inventoryAuditExportFilename,
  sanitizeExcelSheetName,
  sanitizeInventoryAuditFilenamePart,
} from "./exportInventoryAuditExcel";

describe("exportInventoryAuditExcel", () => {
  it("builds EN/VI headers and numeric qty", () => {
    const sheet = buildInventoryAuditExportSheet([
      {
        tag: "T1",
        locationCode: "WH01",
        locationName: "Kệ A",
        inventoryType: "FG",
        erpCode: "ERP-9",
        itemName: "Cover",
        unit: "EA",
        qty: "12",
        remarks: "ok",
      },
    ]);
    expect(sheet.headersEn[0]).toBe("Tag #");
    expect(sheet.headersEn).toContain("Qty");
    expect(sheet.headersVi[1]).toBe("Vị trí để hàng");
    expect(sheet.records[0][7]).toBe(12);
    expect(sheet.qtyTotal).toBe(12);
    expect(typeof sheet.records[0][7]).toBe("number");
    expect(sheet.headerLabels[7]).toBe("Qty\nsố lượng");
  });

  it("sanitizes filename and sheet names", () => {
    expect(sanitizeInventoryAuditFilenamePart('A/B:"x"')).toBe("A-B-x");
    expect(sanitizeInventoryAuditFilenamePart("Không gian chính + Demo2")).toBe(
      "Khong-gian-chinh-Demo2",
    );
    expect(sanitizeExcelSheetName("Kiểm kê tồn kho:*")).toBe("Kiểm kê tồn kho");
    const name = inventoryAuditExportFilename(
      "Không gian chính + Demo2",
      new Date(2026, 8, 24, 13, 5),
    );
    expect(name).toBe("kiem-ke_Khong-gian-chinh-Demo2_2026-09-24_1305.xlsx");
  });

  it("writes a workbook that ExcelJS can open again", async () => {
    const workbook = await buildInventoryAuditWorkbook({
      rows: [{ tag: "T1", qty: 3, remarks: "ok" }],
      sheetName: "Kiểm kê tồn kho",
    });
    const buffer = await workbook.xlsx.writeBuffer();
    const bytes = excelBufferToUint8Array(buffer);
    expect(bytes.byteLength).toBeGreaterThan(1000);
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(bytes);
    const ws = reopened.worksheets[0];
    expect(ws.getRow(2).getCell(1).value).toBe("Tag #");
    expect(ws.getRow(3).getCell(1).value).toBe("T1");
    const qtyCell = ws.getRow(3).getCell(8);
    expect(qtyCell.value).toBe(3);
    expect(qtyCell.numFmt).toMatch(/#,##0/);
    const totalCell = ws.getRow(1).getCell(8);
    expect(totalCell.value.result ?? totalCell.value).toBe(3);
  });
});
