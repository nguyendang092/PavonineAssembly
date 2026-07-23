import { describe, expect, it } from "vitest";
import {
  inferUploadContext,
  resolveUploadStrategy,
} from "./config.js";

describe("imageUpload config", () => {
  it("infers s90d context from prefix", () => {
    expect(inferUploadContext("s90d_defect_2026-07-01")).toBe("s90d_defect");
    expect(inferUploadContext("attendance_form")).toBe("attendance");
    expect(inferUploadContext("other")).toBe("general");
  });

  it("defaults to firebase-first strategy", () => {
    expect(resolveUploadStrategy()).toBe("firebase-first");
  });
});
