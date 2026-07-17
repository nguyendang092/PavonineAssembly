import { describe, expect, it } from "vitest";
import { getMachineDisplayName } from "./temperatureMachineDisplay";

describe("getMachineDisplayName", () => {
  it("returns locale label when defined", () => {
    const t = (key, opts) => {
      if (opts?.keyPrefix === "machineNames" && key === "KHO MC") {
        return "Kho MC dịch";
      }
      return opts?.defaultValue ?? "";
    };
    expect(getMachineDisplayName(t, "KHO MC")).toBe("Kho MC dịch");
  });

  it("falls back to raw name for new machines not in locale", () => {
    const t = (_key, opts) => opts?.defaultValue ?? "";
    expect(getMachineDisplayName(t, "MC GE")).toBe("MC GE");
  });

  it("falls back when translation returns an object", () => {
    const t = () => ({ nested: true });
    expect(getMachineDisplayName(t, "MC GE")).toBe("MC GE");
  });

  it("handles empty input", () => {
    const t = () => "x";
    expect(getMachineDisplayName(t, "")).toBe("");
    expect(getMachineDisplayName(t, "   ")).toBe("");
  });
});
