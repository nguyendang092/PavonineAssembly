import { describe, expect, it } from "vitest";
import {
  INVENTORY_AUDIT_DEFAULT_SPACE_ID,
  inventoryAuditSpacePath,
  inventoryAuditViewId,
  inventoryAuditWorkspaceTitle,
  mapInventoryAuditWorkspaces,
  parseInventoryAuditViewId,
} from "./inventoryAuditSpaces";

describe("inventoryAuditSpaces", () => {
  it("encodes and parses view ids", () => {
    expect(inventoryAuditViewId("a@b,com")).toBe("a@b,com::default");
    expect(parseInventoryAuditViewId("a@b,com")).toEqual({
      ownerKey: "a@b,com",
      spaceId: INVENTORY_AUDIT_DEFAULT_SPACE_ID,
    });
    expect(parseInventoryAuditViewId("a@b,com::s-1")).toEqual({
      ownerKey: "a@b,com",
      spaceId: "s-1",
    });
    expect(inventoryAuditSpacePath("a@b,com", "default")).toBe(
      "inventoryAudit/workspaces/a@b,com",
    );
    expect(inventoryAuditSpacePath("a@b,com", "s-1")).toBe(
      "inventoryAudit/workspaces/a@b,com/named/s-1",
    );
  });

  it("lists default and named spaces without dropping existing rows", () => {
    const list = mapInventoryAuditWorkspaces(
      {
        "me@x,com": {
          ownerEmail: "me@x.com",
          ownerName: "Me",
          title: "Kho chính",
          rows: [{ id: "1" }],
          named: {
            extra: { title: "Kho 2", rows: [{ id: "2" }, { id: "3" }] },
          },
        },
      },
      "me@x,com",
      "me@x.com",
      "Me",
    );
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({
      spaceId: "default",
      isDefault: true,
      title: "Kho chính",
      rowCount: 1,
    });
    expect(list[1]).toMatchObject({
      spaceId: "extra",
      title: "Kho 2",
      rowCount: 2,
    });
    expect(
      inventoryAuditWorkspaceTitle(list[0], {
        defaultTitle: "Không gian chính",
      }),
    ).toBe("Kho chính");
  });

  it("puts the current user's spaces first", () => {
    const list = mapInventoryAuditWorkspaces(
      {
        "other@x,com": {
          ownerEmail: "other@x.com",
          ownerName: "Other",
          title: "Kho họ",
          rows: [{ id: "o1" }],
        },
        "me@x,com": {
          ownerEmail: "me@x.com",
          ownerName: "Me",
          title: "Kho tôi",
          rows: [{ id: "m1" }],
        },
      },
      "me@x,com",
      "me@x.com",
      "Me",
    );
    expect(list[0].ownerKey).toBe("me@x,com");
    expect(list[0].title).toBe("Kho tôi");
    expect(list[1].ownerKey).toBe("other@x,com");
  });
});
