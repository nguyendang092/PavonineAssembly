import { describe, expect, it } from "vitest";
import {
  formatPayrollTableDayShiftOvertimeCell,
  formatPayrollTableNightShiftOvertimeCell,
  formatPayrollTableTotalDayGcCell,
  formatPayrollTableWorkingHoursCell,
  getPayrollHalfDayLeaveWorkedHours,
  getNightShiftEarlyPaperworkOvertimeHours,
  getNightShiftPayrollOvertimeHours,
  getNightShiftPayrollRegularHoursAndOtMinutes,
  getOvertimeHoursFromGioRa,
  getAttendanceWorkingHoursHours,
  getEarlyPaperworkOvertimeHours,
  getNightShiftTotalWindowHours22To05,
  getPayrollDayOvertimeHoursNumeric,
  getTaiXeOvertimeHoursFromGioRa,
  isEarlyArrivalFor0600PaperworkOvertime,
  isEarlyArrivalForNightShiftPaperworkOvertime,
  isEarlyArrivalForPaperworkOvertime,
  isNightShiftCaLamViec,
} from "@/features/attendance/attendanceWorkingHours";

describe("isNightShiftCaLamViec", () => {
  it("chỉ S2 là ca đêm", () => {
    expect(isNightShiftCaLamViec("S2")).toBe(true);
    expect(isNightShiftCaLamViec("s2")).toBe(true);
    expect(isNightShiftCaLamViec("S1")).toBe(false);
    expect(isNightShiftCaLamViec("")).toBe(false);
  });
});

describe("getOvertimeHoursFromGioRa (ca ngày)", () => {
  it("ra trước hoặc bằng 17:30 → 0", () => {
    expect(getOvertimeHoursFromGioRa("17:30")).toBe(0);
    expect(getOvertimeHoursFromGioRa("08:00")).toBe(0);
  });

  it("ra sau 17:30 — block 30 phút từ 17:00", () => {
    expect(getOvertimeHoursFromGioRa("18:00")).toBe(1);
    expect(getOvertimeHoursFromGioRa("19:00")).toBe(2);
  });
});

describe("getPayrollDayOvertimeHoursNumeric", () => {
  it("ca đêm S2 → 0 (TC nằm cột TC ca đêm)", () => {
    expect(
      getPayrollDayOvertimeHoursNumeric(
        "22:00",
        "06:00",
        false,
        "S2",
        false,
        false,
        false,
      ),
    ).toBe(0);
  });

  it("ca ngày ra 18:00 → TC chiều", () => {
    expect(
      getPayrollDayOvertimeHoursNumeric(
        "08:00",
        "18:00",
        false,
        "S1",
        false,
        false,
        false,
      ),
    ).toBe(1);
  });

  it("lateOtExcluded → không tính TC chiều", () => {
    expect(
      getPayrollDayOvertimeHoursNumeric(
        "08:00",
        "18:00",
        false,
        "S1",
        false,
        false,
        true,
      ),
    ).toBe(0);
  });

  it("tangCaTrua — ngày OFF cộng vào TC gộp", () => {
    expect(
      getPayrollDayOvertimeHoursNumeric(
        "08:00",
        "17:00",
        true,
        "S1",
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        1,
      ),
    ).toBe(1);
  });

  it("tangCaTrua 0.833h — parse và cộng TC ca ngày", () => {
    expect(
      getPayrollDayOvertimeHoursNumeric(
        "08:00",
        "17:00",
        false,
        "S1",
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        0.833,
      ),
    ).toBe(0.833);
  });

  it("tangCaTrua 0.833h — hiển thị ô TC không làm tròn 0,5h", () => {
    expect(
      formatPayrollTableDayShiftOvertimeCell(
        "08:00",
        "17:00",
        false,
        "S1",
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        0.833,
      ),
    ).toBe("0.833");
    expect(
      formatPayrollTableTotalDayGcCell(
        "08:00",
        "17:00",
        false,
        false,
        "S1",
        false,
        undefined,
        false,
        false,
        false,
        false,
        false,
        0.833,
      ),
    ).toBe("8.833");
  });

  it("tangCaTrua cộng vào TC ca ngày", () => {
    expect(
      getPayrollDayOvertimeHoursNumeric(
        "08:00",
        "17:30",
        false,
        "S1",
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        1,
      ),
    ).toBe(1);
    expect(
      getPayrollDayOvertimeHoursNumeric(
        "08:00",
        "18:00",
        false,
        "S1",
        false,
        false,
        false,
        false,
        false,
        false,
        false,
        0.5,
      ),
    ).toBe(1.5);
  });
});

describe("ca đêm S2 — GC / TC sau 05:00", () => {
  const gioVao = "22:00";
  const gioRa = "06:00";
  const ca = "S2";

  it("GC đến 05:00 tối đa 8h", () => {
    const parts = getNightShiftPayrollRegularHoursAndOtMinutes(
      gioVao,
      gioRa,
      ca,
    );
    expect(parts).not.toBeNull();
    expect(parts.regularHours).toBe(7);
    expect(parts.otMinutes).toBe(60);
  });

  it("TC ca đêm = 1h (60 phút sau 05:00)", () => {
    expect(getNightShiftPayrollOvertimeHours(gioVao, gioRa, ca)).toBe(1);
  });

  it("tổng thời gian ca đêm 22:00–05:00 (bảng tháng)", () => {
    expect(getNightShiftTotalWindowHours22To05("22:00", "06:00", ca)).toBe(7);
    expect(getNightShiftTotalWindowHours22To05("23:00", "05:00", ca)).toBe(6);
    expect(getNightShiftTotalWindowHours22To05("08:00", "17:00", "S1")).toBe(0);
  });
});

describe("hiển thị cột TC", () => {
  it("TC ca ngày: ca đêm → «-»", () => {
    expect(
      formatPayrollTableDayShiftOvertimeCell(
        "22:00",
        "06:00",
        false,
        "S2",
        false,
        false,
        false,
      ),
    ).toBe("-");
  });

  it("TC ca ngày: ca ngày ra 18:00 có số", () => {
    expect(
      formatPayrollTableDayShiftOvertimeCell(
        "08:00",
        "18:00",
        false,
        "S1",
        false,
        false,
        false,
      ),
    ).toBe("1");
  });

  it("TC ca đêm: ca S2 ra 06:00 có số", () => {
    expect(
      formatPayrollTableNightShiftOvertimeCell(
        "22:00",
        "06:00",
        false,
        "S2",
        undefined,
        false,
        false,
      ),
    ).toBe("1");
  });
});

describe("chế độ Tài xế / Tài xế tổng", () => {
  it("GC: 07:00–19:00, chấm sớm coi từ 07:00", () => {
    expect(
      getAttendanceWorkingHoursHours(
        "06:30",
        "19:00",
        "S1",
        false,
        false,
        true,
        false,
      ),
    ).toBe(8);
    expect(
      getAttendanceWorkingHoursHours(
        "07:00",
        "16:00",
        "S1",
        false,
        false,
        false,
        true,
      ),
    ).toBe(8);
  });

  it("TC: sau 19:30, block 30 phút từ 19:00", () => {
    expect(getTaiXeOvertimeHoursFromGioRa("19:30")).toBe(0);
    expect(getTaiXeOvertimeHoursFromGioRa("20:00")).toBe(1);
    expect(getTaiXeOvertimeHoursFromGioRa("21:00")).toBe(2);
    expect(
      getPayrollDayOvertimeHoursNumeric(
        "07:00",
        "21:00",
        false,
        "S1",
        false,
        false,
        false,
        false,
        false,
        true,
        false,
      ),
    ).toBe(2);
  });
});

describe("getEarlyPaperworkOvertimeHours", () => {
  it("có giấy: trước 05:40 → 2h; 05:40–05:59 → 1h; từ 06:00 → khung 06:40", () => {
    expect(getEarlyPaperworkOvertimeHours("05:30", true, "S1")).toBe(2);
    expect(getEarlyPaperworkOvertimeHours("05:40", true, "S1")).toBe(1);
    expect(getEarlyPaperworkOvertimeHours("05:45", true, "S1")).toBe(1);
    expect(getEarlyPaperworkOvertimeHours("06:00", true, "S1")).toBe(1);
    expect(getEarlyPaperworkOvertimeHours("06:40", true, "S1")).toBe(1);
  });

  it("không giấy hoặc vào sau 06:40 → 0", () => {
    expect(getEarlyPaperworkOvertimeHours("06:00", false, "S1")).toBe(0);
    expect(getEarlyPaperworkOvertimeHours("06:41", true, "S1")).toBe(0);
  });

  it("ca đêm S2 — không áp dụng TC sớm dù có giấy", () => {
    expect(getEarlyPaperworkOvertimeHours("06:00", true, "S2")).toBe(0);
    expect(getEarlyPaperworkOvertimeHours("05:45", true, "S2")).toBe(0);
  });

  it("cộng vào TC ngày khi có giấy và giờ ra", () => {
    expect(
      getPayrollDayOvertimeHoursNumeric(
        "06:00",
        "18:00",
        false,
        "S1",
        true,
        false,
        false,
      ),
    ).toBe(2);
  });
});

describe("1/2PN — giờ công", () => {
  it("getPayrollHalfDayLeaveWorkedHours: buổi sáng 07:30 → 4h", () => {
    expect(getPayrollHalfDayLeaveWorkedHours("07:30", "12:00", "S1")).toBe(4);
  });

  it("getPayrollHalfDayLeaveWorkedHours: buổi chiều 13:00 → 4h", () => {
    expect(getPayrollHalfDayLeaveWorkedHours("13:00", "17:00", "S1")).toBe(4);
  });

  it("cột Giờ công: 1/2PN hiển thị giờ (không «-» như PN cả ngày)", () => {
    expect(
      formatPayrollTableWorkingHoursCell(
        "07:30",
        "12:00",
        false,
        "S1",
        "1/2PN",
      ),
    ).toBe("4");
    expect(
      formatPayrollTableWorkingHoursCell(
        "08:00",
        "17:00",
        false,
        "S1",
        "Phép năm",
      ),
    ).toBe("-");
  });

  it("cột Giờ công: chuỗi DB «1/2 Phép năm»", () => {
    expect(
      formatPayrollTableWorkingHoursCell(
        "07:30",
        "12:00",
        false,
        "S1",
        "1/2 Phép năm",
      ),
    ).toBe("4");
  });

  it("Tổng GC: giờ công + TC tách rõ (4 + 1)", () => {
    expect(
      formatPayrollTableWorkingHoursCell(
        "07:30",
        "18:00",
        false,
        "S1",
        "1/2PN",
      ),
    ).toBe("4");
    expect(
      formatPayrollTableTotalDayGcCell(
        "07:30",
        "18:00",
        false,
        false,
        "S1",
        false,
        "1/2PN",
        false,
      ),
    ).toBe("5");
  });
});

describe("formatPayrollTableTotalDayGcCell", () => {
  it("1/2PN ngày thường: Tổng GC = giờ công nửa ngày + giờ TC", () => {
    expect(
      formatPayrollTableTotalDayGcCell(
        "07:30",
        "18:00",
        false,
        false,
        "S1",
        false,
        "1/2PN",
        false,
      ),
    ).toBe("5");
  });

  it("1/2 Phép năm (chuẩn DB) + TC chiều — cộng như ngày thường", () => {
    expect(
      formatPayrollTableTotalDayGcCell(
        "07:30",
        "18:00",
        false,
        false,
        "S1",
        false,
        "1/2 Phép năm",
        false,
      ),
    ).toBe("5");
    expect(
      formatPayrollTableDayShiftOvertimeCell(
        "07:30",
        "18:00",
        false,
        "S1",
        false,
        false,
        false,
      ),
    ).toBe("1");
  });

  it("1/2PN + tangCaTrua — TC cộng vào Tổng GC", () => {
    expect(
      formatPayrollTableTotalDayGcCell(
        "07:30",
        "17:00",
        false,
        false,
        "S1",
        false,
        "1/2PN",
        false,
        false,
        false,
        false,
        false,
        1,
      ),
    ).toBe("5");
  });

  it("ngày OFF + tangCaTrua — TC trưa cộng vào Tổng GC", () => {
    expect(
      formatPayrollTableTotalDayGcCell(
        "08:00",
        "17:00",
        true,
        false,
        "S1",
        false,
        undefined,
        false,
        false,
        false,
        false,
        false,
        1,
      ),
    ).toBe("9");
  });
});

describe("isEarlyArrivalFor0600PaperworkOvertime", () => {
  it("ca ngày: vào ≤ 06:40 đủ điều kiện giấy TC sớm", () => {
    expect(isEarlyArrivalFor0600PaperworkOvertime("06:40", "S1")).toBe(true);
    expect(isEarlyArrivalFor0600PaperworkOvertime("06:00", "S1")).toBe(true);
  });

  it("ca ngày: vào sau 06:40 không đủ điều kiện", () => {
    expect(isEarlyArrivalFor0600PaperworkOvertime("06:41", "S1")).toBe(false);
  });

  it("ca đêm S2 không áp dụng", () => {
    expect(isEarlyArrivalFor0600PaperworkOvertime("06:00", "S2")).toBe(false);
  });
});

describe("ca đêm — TC trước 18:40 (giấy xác nhận)", () => {
  const ca = "S2";

  it("18:40 đủ điều kiện popup; 19:40 không", () => {
    expect(isEarlyArrivalForNightShiftPaperworkOvertime("18:40", ca)).toBe(
      true,
    );
    expect(isEarlyArrivalForNightShiftPaperworkOvertime("19:40", ca)).toBe(
      false,
    );
    expect(isEarlyArrivalForPaperworkOvertime("18:40", ca)).toBe(true);
  });

  it("có giấy: 17:00 → 1h TC (18:40–19:40); GC từ 19:40", () => {
    expect(getNightShiftEarlyPaperworkOvertimeHours("17:00", true, ca)).toBe(
      1,
    );
    const parts = getNightShiftPayrollRegularHoursAndOtMinutes(
      "17:00",
      "20:00",
      ca,
      true,
    );
    expect(parts?.regularHours).toBe(0.3);
  });

  it("có giấy: 18:40 → 1h TC; GC từ 19:40", () => {
    expect(getNightShiftEarlyPaperworkOvertimeHours("18:40", true, ca)).toBe(
      1,
    );
    expect(
      formatPayrollTableNightShiftOvertimeCell(
        "18:40",
        "19:50",
        false,
        ca,
        "",
        false,
        false,
        false,
        false,
        true,
      ),
    ).toBe("1");
    const parts = getNightShiftPayrollRegularHoursAndOtMinutes(
      "18:40",
      "19:50",
      ca,
      true,
    );
    expect(parts?.regularHours).toBe(0.2);
  });

  it("không giấy: không TC trước 18:40", () => {
    expect(getNightShiftEarlyPaperworkOvertimeHours("18:40", false, ca)).toBe(
      0,
    );
    expect(
      formatPayrollTableNightShiftOvertimeCell(
        "18:40",
        "19:50",
        false,
        ca,
        "",
        false,
        false,
        false,
        false,
        false,
      ),
    ).toBe("-");
  });
});
