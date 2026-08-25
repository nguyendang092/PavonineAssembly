import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { ANNUAL_LEAVE_EMP } from "./annualLeaveFields";
import { exportAnnualLeaveExcel } from "./annualLeaveExcelExport";
import {
  buildAnnualLeaveExcelHeaderRow1,
  buildAnnualLeaveExcelHeaderRow2,
} from "./annualLeaveExcelTemplate";

describe("exportAnnualLeaveExcel", () => {
  it("exports 2-row header and month columns", async () => {
    const rows = [
      {
        id: "emp_251205",
        rowNo: 1,
        [ANNUAL_LEAVE_EMP.MNV_PREFIX]: "251205",
        [ANNUAL_LEAVE_EMP.FULL_NAME]: "Test User",
        [ANNUAL_LEAVE_EMP.START_WORKING_DATE]: "2016-01-10",
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_CURRENT_YEAR]: 8,
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_USED]: 1.5,
        [ANNUAL_LEAVE_EMP.BALANCE]: 6.5,
        [ANNUAL_LEAVE_EMP.ANNUAL_LEAVE_ADJUSTMENT]: 1,
      },
    ];

    const buffer = await exportAnnualLeaveExcel(rows, 2026, {
      monthlyByEmpKey: { emp_251205: [1, 0, 0, 0, 0, 0.5, 0, 0, 0, 0, 0, 0] },
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet("Annual Leave 2026");
    expect(sheet).toBeTruthy();
    expect(sheet.getRow(1).getCell(8).value).toBe(
      "ANNUAL LEAVE IN CURRENT YEAR",
    );
    expect(sheet.getRow(2).getCell(2).value).toBe("MNV");
    expect(sheet.getRow(1).getCell(11).value).toBe("Jan-26");
    expect(sheet.getRow(3).getCell(8).value).toBe(8);
    expect(sheet.getRow(3).getCell(9).value).toBe(1.5);
    expect(sheet.getRow(3).getCell(10).value).toBe(6.5);
    expect(sheet.getRow(3).getCell(11).value).toBe(1);
    expect(sheet.getRow(3).getCell(16).value).toBe(0.5);
    expect(sheet.getRow(3).getCell(23).value).toBe(1);
  });

  it("header rows match template builder", async () => {
    expect(buildAnnualLeaveExcelHeaderRow1(2026)[9]).toBe("BALANCE");
    expect(buildAnnualLeaveExcelHeaderRow2(2026)[2]).toBe("MVT");
  });
});
