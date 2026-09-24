import {
  inventoryAuditEmailFromKey,
  inventoryAuditWorkspacePathByKey,
} from "./inventoryAuditUserKey";

export const INVENTORY_AUDIT_DEFAULT_SPACE_ID = "default";
export const INVENTORY_AUDIT_MERGE_DEST_NEW = "new";

export function inventoryAuditViewId(ownerKey, spaceId) {
  const owner = String(ownerKey ?? "").trim();
  const space = String(spaceId ?? "").trim() || INVENTORY_AUDIT_DEFAULT_SPACE_ID;
  return owner ? `${owner}::${space}` : "";
}

export function parseInventoryAuditViewId(viewId) {
  const s = String(viewId ?? "").trim();
  const i = s.indexOf("::");
  if (i < 0) {
    return {
      ownerKey: s,
      spaceId: INVENTORY_AUDIT_DEFAULT_SPACE_ID,
    };
  }
  return {
    ownerKey: s.slice(0, i),
    spaceId: s.slice(i + 2) || INVENTORY_AUDIT_DEFAULT_SPACE_ID,
  };
}

export function inventoryAuditSpacePath(ownerKey, spaceId) {
  const ownerPath = inventoryAuditWorkspacePathByKey(ownerKey);
  if (!ownerPath) return "";
  const space = String(spaceId ?? "").trim() || INVENTORY_AUDIT_DEFAULT_SPACE_ID;
  if (space === INVENTORY_AUDIT_DEFAULT_SPACE_ID) return ownerPath;
  return `${ownerPath}/named/${space}`;
}

export function createInventoryAuditSpaceId() {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function workspaceDisplayName(ws) {
  return String(ws?.title || ws?.ownerName || ws?.ownerEmail || "").trim();
}

export function inventoryAuditWorkspaceTitle(ws, fallbacks = {}) {
  const title = String(ws?.title ?? "").trim();
  if (title) return title;
  if (ws?.isDefault) {
    return String(
      fallbacks.defaultTitle || ws?.ownerName || ws?.ownerEmail || "",
    ).trim();
  }
  return String(fallbacks.untitled || "").trim();
}

function namedEntries(payload) {
  const named = payload?.named;
  if (!named || typeof named !== "object" || Array.isArray(named)) return [];
  return Object.entries(named).filter(([id, value]) => {
    if (!id || id === INVENTORY_AUDIT_DEFAULT_SPACE_ID) return false;
    return value && typeof value === "object" && !Array.isArray(value);
  });
}

function rowCountOf(payload) {
  return Array.isArray(payload?.rows) ? payload.rows.length : 0;
}

export function mapInventoryAuditWorkspaces(raw, myKey, myEmail, myName) {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const out = [];
  const seenOwners = new Set();

  for (const [ownerKey, payload] of Object.entries(obj)) {
    if (!ownerKey) continue;
    seenOwners.add(ownerKey);
    const ownerEmail = String(
      payload?.ownerEmail || inventoryAuditEmailFromKey(ownerKey),
    );
    const ownerName = String(payload?.ownerName || "");
    out.push({
      key: inventoryAuditViewId(ownerKey, INVENTORY_AUDIT_DEFAULT_SPACE_ID),
      ownerKey,
      spaceId: INVENTORY_AUDIT_DEFAULT_SPACE_ID,
      isDefault: true,
      title: String(payload?.title || "").trim(),
      ownerEmail,
      ownerName,
      rowCount: rowCountOf(payload),
    });
    for (const [spaceId, space] of namedEntries(payload)) {
      out.push({
        key: inventoryAuditViewId(ownerKey, spaceId),
        ownerKey,
        spaceId,
        isDefault: false,
        title: String(space?.title || "").trim(),
        ownerEmail,
        ownerName,
        rowCount: rowCountOf(space),
      });
    }
  }

  if (myKey && !seenOwners.has(myKey)) {
    out.push({
      key: inventoryAuditViewId(myKey, INVENTORY_AUDIT_DEFAULT_SPACE_ID),
      ownerKey: myKey,
      spaceId: INVENTORY_AUDIT_DEFAULT_SPACE_ID,
      isDefault: true,
      title: "",
      ownerEmail: myEmail,
      ownerName: myName || "",
      rowCount: 0,
    });
  }

  out.sort((a, b) => {
    if (a.ownerKey === myKey && b.ownerKey !== myKey) return -1;
    if (b.ownerKey === myKey && a.ownerKey !== myKey) return 1;
    if (a.ownerKey === b.ownerKey) {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return workspaceDisplayName(a).localeCompare(
        workspaceDisplayName(b),
        "vi",
      );
    }
    return workspaceDisplayName(a).localeCompare(
      workspaceDisplayName(b),
      "vi",
    );
  });
  return out;
}
