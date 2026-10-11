import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { MOLD_COLUMNS } from "./moldConstants";
import { retryImageSrcOnce } from "./moldUtils";
import {
  excelImageExtension,
  exportMoldsExcel,
  resolveMoldExcelImageUrl,
} from "./exportMoldsExcel";

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("exportMoldsExcel", () => {
  it("resolves local mold image filenames against /picture/molds", () => {
    expect(resolveMoldExcelImageUrl("ABC_nameplate.jpg", "http://localhost:5173")).toBe(
      "http://localhost:5173/picture/molds/ABC_nameplate.jpg",
    );
    expect(resolveMoldExcelImageUrl("https://cdn.example/a.png")).toBe(
      "https://cdn.example/a.png",
    );
    expect(resolveMoldExcelImageUrl("")).toBe("");
  });

  it("retries an image src once to bypass a broken Chrome cache", () => {
    const el = { dataset: {}, src: "/picture/molds/a.png" };
    const event = { currentTarget: el };
    expect(retryImageSrcOnce(event, "/picture/molds/a.png")).toBe(true);
    expect(el.src).toMatch(/_r=\d+$/);
    expect(retryImageSrcOnce(event, "/picture/molds/a.png")).toBe(false);
  });

  it("maps image types Excel can embed", () => {
    expect(excelImageExtension("a.JPG", "image/jpeg")).toBe("jpeg");
    expect(excelImageExtension("a.webp", "")).toBe("webp");
  });

  it("embeds images into NamePlate / Process / PM columns", async () => {
    const { buffer } = await exportMoldsExcel({
      molds: [
        {
          No: 1,
          "Mold Code": "M-1",
          NamePlate: "m1_nameplate.png",
          Process: "",
          "PM Image": "m1_pm.jpg",
        },
      ],
      columns: MOLD_COLUMNS,
      headerLabel: (col) => col,
      origin: "http://localhost:5173",
      download: false,
      loadImage: async (src) =>
        src.includes("m1_")
          ? { base64: TINY_PNG, extension: "png" }
          : null,
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.getWorksheet("Molds");
    expect(sheet.getRow(1).getCell(1).value).toBe("No");
    expect(sheet.getImages().length).toBe(2);
    const namePlateCol = MOLD_COLUMNS.indexOf("NamePlate") + 1;
    expect(sheet.getRow(2).getCell(namePlateCol).value).toBe("");
  });
});
