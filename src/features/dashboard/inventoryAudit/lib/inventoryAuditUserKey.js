/** Firebase RTDB không cho `. # $ [ ] /` trong key. */
export function inventoryAuditUserKey(email) {
  const raw = String(email ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return "";
  return raw.replace(/[.#$[\]/]/g, ",");
}

export function inventoryAuditEmailFromKey(key) {
  return String(key ?? "").replace(/,/g, ".");
}

export function inventoryAuditWorkspacePath(email) {
  const key = inventoryAuditUserKey(email);
  return key ? `inventoryAudit/workspaces/${key}` : "";
}

export function inventoryAuditWorkspacePathByKey(key) {
  const k = String(key ?? "").trim();
  return k ? `inventoryAudit/workspaces/${k}` : "";
}
