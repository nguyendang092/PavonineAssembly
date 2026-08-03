import { describe, expect, it } from "vitest";
import {
  buildMonthlyDetailMatrixForEmployee,
  buildMonthlyRuleSummary,
  fmtPayrollMonthlySummaryCell,
} from "@/features/payroll/payrollMonthlyRuleSummary";
import {
  buildPayrollMonthlyTimesheetExcelDetailFormatters,
  buildPayrollMonthlyTimesheetExcelGrid,
} from "@/features/payroll/payrollMonthlyTimesheetExcelGrid";
import {
  assignMonthlyDetailFlatToExportRow,
  resolveMonthlyDetailFlatIndex,
} from "@/features/payroll/payrollMonthlyTimesheetLayout";

const tlPage = (_key, def) => def;

function makeChunk({ employees, isOffDay = false }) {
  const byId = new Map();
  const byMonthEmployeeKey = new Map();
  for (const emp of employees) {
    byId.set(emp.id, emp);
    byMonthEmployeeKey.set(emp.monthEmployeeKey || emp.mnv || emp.id, emp);
  }
  return {
    isOffDay,
    isHolidayDay: false,
    isCompensatoryDay: false,
    byId,
    byMonthEmployeeKey,
  };
}

describe("payrollMonthlyTimesheetExcelGrid", () => {
  it("exports Tổng GC ca đêm matching the on-screen detail matrix", () => {
    const empId = "e-night";
    const dayKey = "2026-03-02";
    const nightEmp = {
      id: empId,
      monthEmployeeKey: empId,
      gioVao: "22:00",
      gioRa: "06:00",
      caLamViec: "S2",
      loaiPhep: "",
      payrollEarlyOtPaperwork: false,
      payrollLateOtExcluded: false,
    };
    const chunkByDate = new Map([
      [dayKey, makeChunk({ employees: [nightEmp], isOffDay: true })],
    ]);
    const monthKeys = [dayKey];
    const summaries = buildMonthlyRuleSummary(chunkByDate, monthKeys, empId, {
      ngayVaoLam: "2020-01-01",
    });
    expect(summaries.total.nightShiftWindowHours).toBeGreaterThan(0);

    const repById = new Map([
      [
        empId,
        {
          id: empId,
          hoVaTen: "Night Worker",
          mnv: "9001",
          boPhan: "MC",
          ngayVaoLam: "2020-01-01",
        },
      ],
    ]);
    const summaryById = new Map([[empId, summaries]]);

    const uiMatrix = buildMonthlyDetailMatrixForEmployee(summaries, {
      fmt: fmtPayrollMonthlySummaryCell,
    });
    const nightFlatIdx = resolveMonthlyDetailFlatIndex(0, 15);
    expect(String(uiMatrix[0][nightFlatIdx]).trim()).not.toBe("");

    const { grid, layout } = buildPayrollMonthlyTimesheetExcelGrid({
      tlPage,
      monthKeys,
      chunkByDate,
      filteredIds: [empId],
      repById,
      summaryById,
    });

    expect(grid.length).toBeGreaterThan(1);
    const excelNightCol = layout.totalDetailStart + nightFlatIdx;
    const excelValue = grid[1][excelNightCol];
    expect(excelValue).not.toBeNull();
    expect(excelValue).not.toBe("");
    expect(Number(excelValue)).toBeGreaterThan(0);
  });

  it("assignMonthlyDetailFlatToExportRow maps trial/official blocks separately", () => {
    const layout = {
      totalDetailStart: 10,
      trialDetailStart: 26,
      officialDetailStart: 41,
    };
    const row = Array(60).fill(null);
    const detailFlat = Array.from({ length: 46 }, (_, i) => i);
    assignMonthlyDetailFlatToExportRow(row, layout, detailFlat);

    expect(row[10]).toBe(0);
    expect(row[25]).toBe(15);
    expect(row[26]).toBe(16);
    expect(row[40]).toBe(30);
    expect(row[41]).toBe(31);
    expect(row[55]).toBe(45);
  });

  it("excel detail formatters mirror UI display for hour cells", () => {
    const fmt = buildPayrollMonthlyTimesheetExcelDetailFormatters(false);
    expect(fmt.fmt(8)).toBe(8);
    expect(fmt.fmt(0)).toBeNull();
    expect(fmt.fmtHours).toBeNull();

    const fmtKr = buildPayrollMonthlyTimesheetExcelDetailFormatters(true);
    expect(fmtKr.fmtHours(0.53)).toBe(0.53);
  });
});
