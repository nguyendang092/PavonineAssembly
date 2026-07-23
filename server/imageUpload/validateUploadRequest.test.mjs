import { describe, expect, it } from "vitest";
import { parseUploadRequest } from "./validateUploadRequest.mjs";
import { ImageUploadError } from "./errors.mjs";

describe("parseUploadRequest", () => {
  it("parses valid payload", () => {
    const payload = parseUploadRequest({
      image: "aGVsbG8=",
      name: "s90d_defect_2026",
      context: "s90d_defect",
      provider: "imgbb",
    });

    expect(payload.name).toBe("s90d_defect_2026");
    expect(payload.context).toBe("s90d_defect");
    expect(payload.provider).toBe("imgbb");
  });

  it("rejects missing image", () => {
    expect(() => parseUploadRequest({})).toThrow(ImageUploadError);
  });

  it("rejects invalid context", () => {
    expect(() =>
      parseUploadRequest({ image: "abc", context: "unknown" }),
    ).toThrow(ImageUploadError);
  });
});
