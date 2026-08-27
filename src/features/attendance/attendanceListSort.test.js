import { describe, expect, it } from "vitest";
import {
  sortEmployeesByDepartmentAsc,
  sortEmployeesStableAsc,
} from "./attendanceListSort";

describe("attendanceListSort", () => {
  it("sortEmployeesByDepartmentAsc orders departments A to Z", () => {
    const rows = [
      { mnv: "3", boPhan: "Sản xuất", stt: 3 },
      { mnv: "1", boPhan: "Hành chính", stt: 1 },
      { mnv: "2", boPhan: "Kế toán", stt: 2 },
    ];

    const sorted = sortEmployeesByDepartmentAsc(rows);
    expect(sorted.map((row) => row.boPhan)).toEqual([
      "Hành chính",
      "Kế toán",
      "Sản xuất",
    ]);
  });

  it("sortEmployeesByDepartmentAsc keeps STT order within same department", () => {
    const rows = [
      { mnv: "2", boPhan: "Kế toán", stt: 20 },
      { mnv: "1", boPhan: "Kế toán", stt: 10 },
    ];

    const sorted = sortEmployeesByDepartmentAsc(rows);
    expect(sorted.map((row) => row.mnv)).toEqual(["1", "2"]);
  });

  it("sortEmployeesStableAsc still sorts by STT", () => {
    const rows = [
      { mnv: "2", boPhan: "B", stt: 2 },
      { mnv: "1", boPhan: "A", stt: 1 },
    ];

    const sorted = sortEmployeesStableAsc(rows);
    expect(sorted.map((row) => row.mnv)).toEqual(["1", "2"]);
  });
});
