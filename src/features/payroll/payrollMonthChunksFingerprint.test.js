import { describe, expect, it } from "vitest";
import { computePayrollMonthChunksFingerprint } from "@/features/payroll/payrollMonthChunksFingerprint";

describe("computePayrollMonthChunksFingerprint", () => {
  it("thay đổi khi thêm ngày hoặc NV", () => {
    const keys = ["2026-06-01", "2026-06-02"];
    const empty = new Map();
    expect(computePayrollMonthChunksFingerprint(empty, keys)).toMatch(/^2\|0\|0\|0$/);

    const oneDay = new Map([
      [
        "2026-06-01",
        {
          employees: [{ id: "a" }, { id: "b" }],
        },
      ],
    ]);
    const fp1 = computePayrollMonthChunksFingerprint(oneDay, keys);
    expect(fp1).toMatch(/^2\|1\|2\|-?\d+$/);

    const twoDays = new Map([
      [
        "2026-06-01",
        { employees: [{ id: "a" }, { id: "b" }] },
      ],
      ["2026-06-02", { employees: [{ id: "a" }] }],
    ]);
    const fp2 = computePayrollMonthChunksFingerprint(twoDays, keys);
    expect(fp2).not.toBe(fp1);
    expect(fp2).toMatch(/^2\|2\|3\|-?\d+$/);
  });

  it("thay đổi khi sửa giờ/phép cùng số ngày và NV", () => {
    const keys = ["2026-06-01"];
    const before = new Map([
      [
        "2026-06-01",
        {
          employees: [
            {
              id: "a",
              gioVao: "08:00",
              gioRa: "17:00",
              loaiPhep: "",
            },
          ],
        },
      ],
    ]);
    const after = new Map([
      [
        "2026-06-01",
        {
          employees: [
            {
              id: "a",
              gioVao: "08:00",
              gioRa: "17:00",
              loaiPhep: "PN",
            },
          ],
        },
      ],
    ]);

    expect(computePayrollMonthChunksFingerprint(before, keys)).not.toBe(
      computePayrollMonthChunksFingerprint(after, keys),
    );
  });
});
