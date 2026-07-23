import { describe, expect, it } from "vitest";
import {
  isSupportedUploadImage,
  resolveUploadImageMime,
} from "./prepareUploadImage";

describe("prepareUploadImage", () => {
  it("accepts HEIC by extension when MIME is empty", () => {
    const file = { name: "photo.heic", type: "", size: 1024 };
    expect(resolveUploadImageMime(file)).toBe("image/heic");
    expect(isSupportedUploadImage(file)).toBe(true);
  });

  it("accepts JPEG from phone camera with empty MIME", () => {
    const file = { name: "IMG_001.jpeg", type: "", size: 1024 };
    expect(resolveUploadImageMime(file)).toBe("image/jpeg");
    expect(isSupportedUploadImage(file)).toBe(true);
  });

  it("rejects unsupported files", () => {
    const file = { name: "notes.pdf", type: "application/pdf", size: 1024 };
    expect(isSupportedUploadImage(file)).toBe(false);
  });
});
