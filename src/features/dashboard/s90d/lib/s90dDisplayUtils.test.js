import { describe, expect, it } from "vitest";
import { formatS90dBoardDisplayName } from "./s90dDisplayUtils";

describe("formatS90dBoardDisplayName", () => {
  it("formats S90D Code D/E from codeSlot", () => {
    expect(
      formatS90dBoardDisplayName({
        productCode: "S90D",
        codeSlot: "D",
      }),
    ).toBe("S90D Code D");
    expect(
      formatS90dBoardDisplayName({
        productCode: "S90D",
        codeSlot: "E",
      }),
    ).toBe("S90D Code E");
  });

  it("infers Code D/E from board id when codeSlot is missing", () => {
    expect(
      formatS90dBoardDisplayName({
        boardId: "press-coded",
        productCode: "S90D",
      }),
    ).toBe("S90D Code D");
  });

  it("includes assembly product prefix with code slot", () => {
    expect(
      formatS90dBoardDisplayName({
        productCode: "S90D INZI",
        codeSlot: "E",
      }),
    ).toBe("S90D INZI Code E");
  });
});
