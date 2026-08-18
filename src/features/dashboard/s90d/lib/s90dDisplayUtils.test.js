import { describe, expect, it } from "vitest";
import { formatS90dBoardDisplayName } from "./s90dDisplayUtils";

describe("formatS90dBoardDisplayName", () => {
  it("formats S90D Type D/E from codeSlot", () => {
    expect(
      formatS90dBoardDisplayName({
        productCode: "S90D",
        codeSlot: "D",
      }),
    ).toBe("S90D Type D");
    expect(
      formatS90dBoardDisplayName({
        productCode: "S90D",
        codeSlot: "E",
      }),
    ).toBe("S90D Type E");
  });

  it("infers Type D/E from board id when codeSlot is missing", () => {
    expect(
      formatS90dBoardDisplayName({
        boardId: "press-coded",
        productCode: "S90D",
      }),
    ).toBe("S90D Type D");
  });

  it("includes assembly product prefix with type slot", () => {
    expect(
      formatS90dBoardDisplayName({
        productCode: "S90D INZI",
        codeSlot: "E",
      }),
    ).toBe("S90D INZI Type E");
  });
});
