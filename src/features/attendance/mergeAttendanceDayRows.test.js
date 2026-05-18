import { describe, expect, it } from "vitest";
import {
  attendanceDayRowSnapshotEqual,
  mergeAttendanceDayRowsFromRaw,
  reconcileAttendanceDayRowsFromRaw,
} from "./mergeAttendanceDayRows";

describe("reconcileAttendanceDayRowsFromRaw", () => {
  it("reuses row reference when data unchanged", () => {
    const prev = mergeAttendanceDayRowsFromRaw({
      emp_1: { mnv: "1", hoVaTen: "A", stt: 1 },
    });
    const next = reconcileAttendanceDayRowsFromRaw(prev, {
      emp_1: { mnv: "1", hoVaTen: "A", stt: 1 },
    });
    expect(next).toBe(prev);
    expect(next[0]).toBe(prev[0]);
  });

  it("replaces reference only for changed employee", () => {
    const prev = mergeAttendanceDayRowsFromRaw({
      emp_1: { mnv: "1", hoVaTen: "A", stt: 1 },
      emp_2: { mnv: "2", hoVaTen: "B", stt: 2 },
    });
    const next = reconcileAttendanceDayRowsFromRaw(prev, {
      emp_1: { mnv: "1", hoVaTen: "A", stt: 1 },
      emp_2: { mnv: "2", hoVaTen: "B", gioVao: "08:00", stt: 2 },
    });
    expect(next).not.toBe(prev);
    expect(next[0]).toBe(prev[0]);
    expect(next[1]).not.toBe(prev[1]);
    expect(next[1].gioVao).toBe("08:00");
  });
});

describe("attendanceDayRowSnapshotEqual", () => {
  it("compares display fields only", () => {
    const a = { id: "emp_1", mnv: "1", hoVaTen: "X" };
    const b = { id: "emp_1", mnv: "1", hoVaTen: "X", extraInternal: true };
    expect(attendanceDayRowSnapshotEqual(a, b)).toBe(true);
  });
});
