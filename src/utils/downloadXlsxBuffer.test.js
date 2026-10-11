import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadXlsxBuffer, XLSX_MIME } from "./downloadXlsxBuffer";

describe("downloadXlsxBuffer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates an xlsx blob and clicks a download link", () => {
    const click = vi.fn();
    const createObjectURL = vi.fn(() => "blob:xlsx-test");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.stubGlobal("document", {
      createElement: (tag) => {
        expect(tag).toBe("a");
        return { click, href: "", download: "" };
      },
    });

    const buffer = new Uint8Array([1, 2, 3]);
    downloadXlsxBuffer(buffer, "report.xlsx");

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0];
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe(XLSX_MIME);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:xlsx-test");
  });
});
