import { describe, expect, it } from "vitest";
import {
  inventoryAuditEmailFromKey,
  inventoryAuditUserKey,
  inventoryAuditWorkspacePath,
} from "./inventoryAuditUserKey";

describe("inventoryAuditUserKey", () => {
  it("encodes email dots for RTDB keys", () => {
    expect(inventoryAuditUserKey("Ada.Nguyen@Pavo.com")).toBe(
      "ada,nguyen@pavo,com",
    );
    expect(inventoryAuditUserKey("")).toBe("");
    expect(inventoryAuditWorkspacePath("a@b.com")).toBe(
      "inventoryAudit/workspaces/a@b,com",
    );
    expect(inventoryAuditEmailFromKey("ada,nguyen@pavo,com")).toBe(
      "ada.nguyen@pavo.com",
    );
  });
});
