import { describe, expect, it } from "vitest";
import { sanitizeDownloadFilenameSegment } from "./sanitizeDownloadFilenameSegment";

describe("sanitizeDownloadFilenameSegment", () => {
  it("replaces unsafe characters and trims underscores", () => {
    expect(sanitizeDownloadFilenameSegment(" S90D / Type E ")).toBe(
      "S90D_Type_E",
    );
    expect(sanitizeDownloadFilenameSegment("")).toBe("");
  });
});
