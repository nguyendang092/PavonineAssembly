import { describe, expect, it } from "vitest";
import {
  filterFormLibraryFiles,
  formatFormLibraryFileSize,
  formLibraryExtension,
  formLibraryKind,
  isAllowedFormLibraryFile,
  sanitizeFormLibraryFileName,
} from "./formLibraryUtils";

describe("formLibraryUtils", () => {
  it("sanitizes file names and keeps extension", () => {
    expect(sanitizeFormLibraryFileName("Biên bản họp (1).pdf")).toBe(
      "Biên_bản_họp_1.pdf",
    );
    expect(formLibraryExtension("a.XLSX")).toBe("xlsx");
    expect(formLibraryKind("xlsx")).toBe("excel");
    expect(formLibraryKind("pdf")).toBe("pdf");
  });

  it("rejects disallowed types and oversized files", () => {
    expect(
      isAllowedFormLibraryFile({ name: "virus.exe", size: 10 }),
    ).toBe(false);
    expect(
      isAllowedFormLibraryFile({ name: "form.pdf", size: 26 * 1024 * 1024 }),
    ).toBe(false);
    expect(isAllowedFormLibraryFile({ name: "form.pdf", size: 1200 })).toBe(
      true,
    );
  });

  it("formats sizes and filters the list", () => {
    expect(formatFormLibraryFileSize(512)).toBe("512 B");
    expect(formatFormLibraryFileSize(2048)).toBe("2.0 KB");
    const files = [
      { title: "Đơn nghỉ phép", fileName: "don.pdf", uploadedBy: "a@x" },
      { title: "Checklist MC", fileName: "mc.xlsx", uploadedBy: "b@x" },
    ];
    expect(filterFormLibraryFiles(files, "phép").map((f) => f.title)).toEqual([
      "Đơn nghỉ phép",
    ]);
  });
});
