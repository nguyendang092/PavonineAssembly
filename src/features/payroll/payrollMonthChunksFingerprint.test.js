import { describe, expect, it } from "vitest";
import { computePayrollMonthChunksFingerprint } from "@/features/payroll/payrollMonthChunksFingerprint";
import { computePayrollMonthEmployeeFingerprint } from "@/features/payroll/payrollMonthlyGridData";

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

describe("computePayrollMonthEmployeeFingerprint", () => {
  it("chỉ đổi NV bị sửa — NV khác giữ fingerprint", () => {
    const keys = ["2026-06-01", "2026-06-02"];
    const before = new Map([
      [
        "2026-06-01",
        {
          employees: [
            { id: "a", mnv: "001", gioVao: "08:00", gioRa: "17:00", loaiPhep: "" },
            { id: "b", mnv: "002", gioVao: "08:00", gioRa: "17:00", loaiPhep: "" },
          ],
          rowLookup: new Map([
            ["a", { id: "a", mnv: "001", gioVao: "08:00", gioRa: "17:00", loaiPhep: "" }],
            ["b", { id: "b", mnv: "002", gioVao: "08:00", gioRa: "17:00", loaiPhep: "" }],
          ]),
          byId: new Map([
            ["a", { id: "a", mnv: "001", gioVao: "08:00", gioRa: "17:00", loaiPhep: "" }],
            ["b", { id: "b", mnv: "002", gioVao: "08:00", gioRa: "17:00", loaiPhep: "" }],
          ]),
        },
      ],
      [
        "2026-06-02",
        {
          employees: [
            { id: "a", mnv: "001", gioVao: "08:00", gioRa: "17:00", loaiPhep: "" },
            { id: "b", mnv: "002", gioVao: "08:00", gioRa: "17:00", loaiPhep: "" },
          ],
          rowLookup: new Map([
            ["a", { id: "a", mnv: "001", gioVao: "08:00", gioRa: "17:00", loaiPhep: "" }],
            ["b", { id: "b", mnv: "002", gioVao: "08:00", gioRa: "17:00", loaiPhep: "" }],
          ]),
          byId: new Map([
            ["a", { id: "a", mnv: "001", gioVao: "08:00", gioRa: "17:00", loaiPhep: "" }],
            ["b", { id: "b", mnv: "002", gioVao: "08:00", gioRa: "17:00", loaiPhep: "" }],
          ]),
        },
      ],
    ]);
    const after = new Map(before);
    after.set("2026-06-01", {
      ...before.get("2026-06-01"),
      employees: [
        { id: "a", mnv: "001", gioVao: "08:00", gioRa: "17:00", loaiPhep: "PN" },
        { id: "b", mnv: "002", gioVao: "08:00", gioRa: "17:00", loaiPhep: "" },
      ],
      rowLookup: new Map([
        ["a", { id: "a", mnv: "001", gioVao: "08:00", gioRa: "17:00", loaiPhep: "PN" }],
        ["b", { id: "b", mnv: "002", gioVao: "08:00", gioRa: "17:00", loaiPhep: "" }],
      ]),
      byId: new Map([
        ["a", { id: "a", mnv: "001", gioVao: "08:00", gioRa: "17:00", loaiPhep: "PN" }],
        ["b", { id: "b", mnv: "002", gioVao: "08:00", gioRa: "17:00", loaiPhep: "" }],
      ]),
    });

    const fpBeforeA = computePayrollMonthEmployeeFingerprint(before, keys, "a");
    const fpBeforeB = computePayrollMonthEmployeeFingerprint(before, keys, "b");
    const fpAfterA = computePayrollMonthEmployeeFingerprint(after, keys, "a");
    const fpAfterB = computePayrollMonthEmployeeFingerprint(after, keys, "b");

    expect(fpAfterA).not.toBe(fpBeforeA);
    expect(fpAfterB).toBe(fpBeforeB);
  });
});
