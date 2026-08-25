import { describe, expect, it } from "vitest";
import {
  annualLeaveDeductionDayFingerprint,
  diffAttendanceYearSnapshots,
} from "@/features/leave/annualLeaveAttendanceDiff";

describe("annualLeaveAttendanceDiff", () => {
  it("fingerprint ổn định khi clone object mới cùng nội dung", () => {
    const dayA = { emp_001: { loaiPhep: "Phép năm", mnv: "001" } };
    const dayB = { emp_001: { loaiPhep: "Phép năm", mnv: "001" } };
    expect(annualLeaveDeductionDayFingerprint(dayA)).toBe(
      annualLeaveDeductionDayFingerprint(dayB),
    );
  });

  it("diff không báo đổi khi Firebase clone lại cùng dữ liệu", () => {
    const prev = {
      "2026-06-01": { emp_001: { loaiPhep: "Phép năm", mnv: "001" } },
    };
    const next = {
      "2026-06-01": { emp_001: { loaiPhep: "Phép năm", mnv: "001" } },
    };
    const store = new Map([
      ["2026-06-01", annualLeaveDeductionDayFingerprint(prev["2026-06-01"])],
    ]);
    const { changedDateKeys, affectedEmpKeys } = diffAttendanceYearSnapshots(
      prev,
      next,
      2026,
      store,
    );
    expect(changedDateKeys.size).toBe(0);
    expect(affectedEmpKeys.size).toBe(0);
  });

  it("diff chỉ ảnh hưởng empKey sửa loại phép", () => {
    const prev = {
      "2026-06-01": {
        emp_001: { loaiPhep: "Phép năm", mnv: "001" },
        emp_002: { loaiPhep: "", mnv: "002" },
      },
    };
    const next = {
      "2026-06-01": {
        emp_001: { loaiPhep: "1/2 Phép năm", mnv: "001" },
        emp_002: { loaiPhep: "", mnv: "002" },
      },
    };
    const store = new Map(
      Object.entries(prev).map(([dk, day]) => [
        dk,
        annualLeaveDeductionDayFingerprint(day),
      ]),
    );
    const { changedDateKeys, affectedEmpKeys } = diffAttendanceYearSnapshots(
      prev,
      next,
      2026,
      store,
    );
    expect([...changedDateKeys]).toEqual(["2026-06-01"]);
    expect([...affectedEmpKeys]).toEqual(["emp_001"]);
  });
});
