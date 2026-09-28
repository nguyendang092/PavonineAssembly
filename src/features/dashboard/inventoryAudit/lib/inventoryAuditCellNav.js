import {
  INVENTORY_AUDIT_WORKSPACE_COLUMNS,
} from "./constants";

export function inventoryAuditEditableColKeys(lockLocation = false) {
  return INVENTORY_AUDIT_WORKSPACE_COLUMNS.filter((col) => {
    if (col.autoFill) return false;
    if (lockLocation && col.key === "locationCode") return false;
    return true;
  }).map((col) => col.key);
}

export function nextInventoryAuditCell(rows, editableKeys, rowId, colKey, dir) {
  const list = Array.isArray(rows) ? rows : [];
  const keys = Array.isArray(editableKeys) ? editableKeys : [];
  const r = list.findIndex((row) => row?.id === rowId);
  const c = keys.indexOf(colKey);
  if (r < 0 || c < 0 || !keys.length) return null;

  if (dir === "up") {
    if (r === 0) return null;
    return { rowId: list[r - 1].id, colKey };
  }
  if (dir === "down") {
    if (r === list.length - 1) return null;
    return { rowId: list[r + 1].id, colKey };
  }
  if (dir === "left") {
    if (c > 0) return { rowId, colKey: keys[c - 1] };
    if (r === 0) return null;
    return { rowId: list[r - 1].id, colKey: keys[keys.length - 1] };
  }
  if (dir === "right") {
    if (c < keys.length - 1) return { rowId, colKey: keys[c + 1] };
    if (r === list.length - 1) return null;
    return { rowId: list[r + 1].id, colKey: keys[0] };
  }
  return null;
}

export function inventoryAuditArrowDir(key) {
  if (key === "ArrowUp") return "up";
  if (key === "ArrowDown") return "down";
  if (key === "ArrowLeft") return "left";
  if (key === "ArrowRight") return "right";
  return "";
}

export function shouldMoveInventoryAuditCell(event, input) {
  if (event.isComposing || event.keyCode === 229) return false;
  if (event.altKey || event.ctrlKey || event.metaKey) return false;
  const dir = inventoryAuditArrowDir(event.key);
  if (!dir) return false;
  if (dir === "up" || dir === "down") return true;
  const el = input;
  if (!el) return false;
  const start = el.selectionStart ?? 0;
  const end = el.selectionEnd ?? 0;
  const len = String(el.value ?? "").length;
  if (start !== end) return start === 0 && end === len;
  if (dir === "left") return start === 0;
  return start === len;
}
