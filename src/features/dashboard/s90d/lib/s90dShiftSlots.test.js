import { describe, expect, it } from "vitest";
import { normalizeManualStore } from "./s90dManualEntries";
import { S90D_LATE_SHIFT_SLOTS, S90D_SHIFT_SLOTS } from "./s90dShiftSlots";

describe("s90d shift slots", () => {
  it("uses updated evening and night slots", () => {
    expect(S90D_SHIFT_SLOTS).toEqual([
      "08~10",
      "10~12",
      "13~15",
      "15~17",
      "17~20",
      "20~22",
      "22~24",
      "00~03",
      "03~05",
      "05~08",
    ]);
  });

  it("marks late shift slots from 22~24 downward", () => {
    expect(S90D_LATE_SHIFT_SLOTS).toEqual([
      "22~24",
      "00~03",
      "03~05",
      "05~08",
    ]);
  });

  it("migrates legacy shift keys when loading store", () => {
    const store = normalizeManualStore({
      "2026-07-01": {
        PRESS: {
          shifts: {
            "19~21": { okQty: 2, ngQty: 0, defects: { scratch: 1 } },
            "21~23": { okQty: 3, ngQty: 0, defects: {} },
            "23~01": { okQty: 4, ngQty: 0, defects: {} },
            "20~24": { okQty: 5, ngQty: 0, defects: {} },
          },
        },
      },
    });

    const shifts = store["2026-07-01"].PRESS.boards[0].shifts;
    expect(shifts["17~20"].okQty).toBe(2);
    expect(shifts["17~20"].defects.scratch).toBe(1);
    expect(shifts["22~24"].okQty).toBe(3);
    expect(shifts["00~03"].okQty).toBe(4);
    expect(shifts["20~22"].okQty).toBe(5);
    expect(shifts["19~21"]).toBeUndefined();
  });
});

