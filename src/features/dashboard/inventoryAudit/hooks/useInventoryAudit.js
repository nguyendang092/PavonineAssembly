import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { db, get, onValue, ref, remove, set, update } from "@/services/firebase";
import { useUser } from "@/contexts/UserContext";
import { isAdminAccess } from "@/config/authRoles";
import {
  INVENTORY_AUDIT_AUTO_FILL_KEYS,
  INVENTORY_AUDIT_SOURCE_PATH,
  INVENTORY_AUDIT_SOURCE_ROOT,
  INVENTORY_AUDIT_WORKSPACE_COLUMNS,
  INVENTORY_AUDIT_WORKSPACE_ROOT,
  createInventoryAuditRow,
  formatInventoryAuditRemarks,
  mergeInventoryAuditRowLists,
  normalizeInventoryAuditRow,
  payloadToInventoryAuditRows,
} from "../lib/constants";
import {
  applyInventoryAuditLookup,
  buildInventoryAuditLookupIndex,
} from "../lib/inventoryAuditLookup";
import { packInventoryAuditSourceTable } from "../lib/inventoryAuditSourceTable";
import {
  INVENTORY_AUDIT_DEFAULT_SPACE_ID,
  INVENTORY_AUDIT_MERGE_DEST_NEW,
  createInventoryAuditSpaceId,
  inventoryAuditSpacePath,
  inventoryAuditViewId,
  mapInventoryAuditWorkspaces,
  parseInventoryAuditViewId,
  inventoryAuditWorkspaceTitle,
} from "../lib/inventoryAuditSpaces";
import {
  inventoryAuditEmailFromKey,
  inventoryAuditUserKey,
  inventoryAuditWorkspacePath,
} from "../lib/inventoryAuditUserKey";
import { parseInventoryAuditFile, parseInventorySourceFile } from "../lib/parseInventoryAudit";
import {
  isExcelGridClipboard,
  parseExcelClipboardText,
} from "../lib/parseExcelClipboard";

const SAVE_DEBOUNCE_MS = 450;

function parseQtyInput(v) {
  const s = String(v ?? "")
    .trim()
    .replace(/,/g, "");
  if (!s) return "";
  const n = Number(s);
  return Number.isFinite(n) ? n : s;
}

function importedToWorkspaceRow(row) {
  return normalizeInventoryAuditRow({
    ...createInventoryAuditRow(),
    tag: row.tag,
    locationCode: row.locationCode,
    locationName: row.locationName,
    inventoryType: row.inventoryType,
    erpCode: row.erpCode,
    itemName: row.itemName,
    unit: row.unit,
    qty: row.qty,
    remarks: row.remarks,
  });
}

function payloadToRows(payload) {
  const cloudRows = Array.isArray(payload?.rows) ? payload.rows : [];
  return cloudRows.map(normalizeInventoryAuditRow);
}

export function useInventoryAudit() {
  const { t } = useTranslation();
  const { user, userRole } = useUser();
  const email = user?.email ?? "";
  const ownerName = user?.name ?? "";
  const myKey = inventoryAuditUserKey(email);
  const ownPath = inventoryAuditWorkspacePath(email);
  const canManageSource = isAdminAccess(user, userRole);

  const tl = useCallback(
    (key, defaultValue, opts) =>
      t(`inventoryAudit.${key}`, { defaultValue, ...opts }),
    [t],
  );

  const [workspaces, setWorkspaces] = useState([]);
  const [viewingKey, setViewingKey] = useState(() =>
    myKey ? inventoryAuditViewId(myKey, INVENTORY_AUDIT_DEFAULT_SPACE_ID) : "",
  );
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(myKey));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [search, setSearch] = useState("");
  const [sourceData, setSourceData] = useState(null);
  const [legacyCatalog, setLegacyCatalog] = useState(null);
  const [sourceUploading, setSourceUploading] = useState(false);
  const [sourceError, setSourceError] = useState("");

  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const saveTimerRef = useRef(null);
  const viewingKeyRef = useRef(viewingKey);
  viewingKeyRef.current = viewingKey;
  const lookupIndex = useMemo(
    () => buildInventoryAuditLookupIndex(sourceData || legacyCatalog),
    [sourceData, legacyCatalog],
  );
  const lookupIndexRef = useRef(lookupIndex);
  lookupIndexRef.current = lookupIndex;

  useEffect(() => {
    if (myKey && !viewingKey) {
      setViewingKey(
        inventoryAuditViewId(myKey, INVENTORY_AUDIT_DEFAULT_SPACE_ID),
      );
    }
  }, [myKey, viewingKey]);

  const viewingParts = parseInventoryAuditViewId(viewingKey);
  const canEdit = Boolean(myKey) && viewingParts.ownerKey === myKey;

  const persistRows = useCallback(
    async (nextRows, viewId = viewingKeyRef.current) => {
      const { ownerKey, spaceId } = parseInventoryAuditViewId(viewId);
      if (!myKey || ownerKey !== myKey) return;
      const path = inventoryAuditSpacePath(ownerKey, spaceId);
      if (!path) return;
      setSaving(true);
      setSaveError("");
      try {
        const savedAt = new Date().toISOString();
        if (spaceId === INVENTORY_AUDIT_DEFAULT_SPACE_ID) {
          await update(ref(db, path), {
            savedAt,
            ownerEmail: email,
            ownerName,
            rows: nextRows,
          });
        } else {
          await update(ref(db, path), {
            savedAt,
            rows: nextRows,
          });
        }
      } catch (err) {
        console.error(err);
        setSaveError(tl("saveError", "Không lưu được không gian làm việc."));
      } finally {
        setSaving(false);
      }
    },
    [myKey, email, ownerName, tl],
  );

  const schedulePersist = useCallback(
    (nextRows) => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        persistRows(nextRows);
      }, SAVE_DEBOUNCE_MS);
    },
    [persistRows],
  );

  useEffect(
    () => () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!myKey) {
      setWorkspaces([]);
      return undefined;
    }
    const listRef = ref(db, INVENTORY_AUDIT_WORKSPACE_ROOT);
    const unsub = onValue(
      listRef,
      (snap) => {
        setWorkspaces(
          mapInventoryAuditWorkspaces(snap.val(), myKey, email, ownerName),
        );
      },
      (err) => {
        console.error(err);
        setError(
          tl("loadErrorOthers", "Không tải được danh sách không gian."),
        );
      },
    );
    return () => unsub();
  }, [myKey, email, ownerName, tl]);

  useEffect(() => {
    const dataRef = ref(db, INVENTORY_AUDIT_SOURCE_ROOT);
    const unsub = onValue(
      dataRef,
      (snap) => {
        setSourceData(snap.exists() ? snap.val() : null);
      },
      (err) => {
        console.error(err);
        setSourceError(tl("sourceLoadError", "Không tải được file nguồn."));
      },
    );
    return () => unsub();
  }, [tl]);

  useEffect(() => {
    const sourceRef = ref(db, INVENTORY_AUDIT_SOURCE_PATH);
    const unsub = onValue(
      sourceRef,
      (snap) => {
        setLegacyCatalog(snap.exists() ? snap.val() : null);
      },
      (err) => {
        console.error(err);
      },
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!viewingKey) {
      setRows([]);
      setLoading(false);
      return undefined;
    }

    const { ownerKey, spaceId } = parseInventoryAuditViewId(viewingKey);
    const path = inventoryAuditSpacePath(ownerKey, spaceId);
    let cancelled = false;

    if (ownerKey === myKey) {
      (async () => {
        setLoading(true);
        setError("");
        try {
          const snap = await get(ref(db, path));
          if (cancelled) return;
          const payload = snap.exists() ? snap.val() : null;
          setRows(payloadToRows(payload));
        } catch (err) {
          console.error(err);
          if (!cancelled) {
            setError(tl("loadError", "Không tải được không gian của bạn."));
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError("");
    const unsub = onValue(
      ref(db, path),
      (snap) => {
        if (cancelled) return;
        const payload = snap.exists() ? snap.val() : null;
        setRows(payloadToRows(payload));
        setLoading(false);
      },
      (err) => {
        console.error(err);
        if (!cancelled) {
          setError(tl("loadError", "Không tải được không gian của bạn."));
          setLoading(false);
        }
      },
    );
    return () => {
      cancelled = true;
      unsub();
    };
  }, [viewingKey, myKey, tl]);

  const selectWorkspace = useCallback(
    (nextKey) => {
      const key = String(nextKey ?? "").trim();
      if (!key || key === viewingKeyRef.current) return;
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        const current = parseInventoryAuditViewId(viewingKeyRef.current);
        if (current.ownerKey === myKey) {
          persistRows(rowsRef.current, viewingKeyRef.current);
        }
      }
      setSearch("");
      setError("");
      setViewingKey(key);
    },
    [myKey, persistRows],
  );

  const commitRows = useCallback(
    (updater, { immediate = false } = {}) => {
      if (parseInventoryAuditViewId(viewingKeyRef.current).ownerKey !== myKey) {
        return;
      }
      setRows((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        rowsRef.current = next;
        if (immediate) {
          if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
          persistRows(next);
        } else {
          schedulePersist(next);
        }
        return next;
      });
    },
    [myKey, persistRows, schedulePersist],
  );

  const addRow = useCallback(
    (count = 1) => {
      if (!canEdit) return;
      const n = Math.min(
        500,
        Math.max(1, Math.floor(Number(count)) || 1),
      );
      commitRows(
        (prev) => [
          ...prev,
          ...Array.from({ length: n }, () => createInventoryAuditRow()),
        ],
        { immediate: true },
      );
    },
    [canEdit, commitRows],
  );

  const updateCell = useCallback(
    (rowId, key, value) => {
      if (!canEdit || INVENTORY_AUDIT_AUTO_FILL_KEYS.has(key)) return;
      commitRows((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;
          const nextValue =
            key === "qty"
              ? parseQtyInput(value)
              : key === "remarks"
                ? formatInventoryAuditRemarks(value)
                : value;
          const patched = { ...row, [key]: nextValue };
          if (key === "locationCode" || key === "erpCode") {
            return applyInventoryAuditLookup(patched, lookupIndexRef.current);
          }
          return patched;
        }),
      );
    },
    [canEdit, commitRows],
  );

  const pasteGrid = useCallback(
    (startRowId, startColKey, text) => {
      if (!canEdit || !isExcelGridClipboard(text)) return false;
      const grid = parseExcelClipboardText(text);
      if (!grid.length) return false;
      const startCol = INVENTORY_AUDIT_WORKSPACE_COLUMNS.findIndex(
        (col) => col.key === startColKey,
      );
      const col0 = startCol >= 0 ? startCol : 0;
      commitRows(
        (prev) => {
          const next = [...prev];
          let startIndex = next.findIndex((row) => row.id === startRowId);
          if (startIndex < 0) startIndex = next.length;
          grid.forEach((cells, offset) => {
            const idx = startIndex + offset;
            const base = next[idx]
              ? { ...next[idx] }
              : createInventoryAuditRow();
            cells.forEach((cell, colOffset) => {
              const col = INVENTORY_AUDIT_WORKSPACE_COLUMNS[col0 + colOffset];
              if (!col || col.autoFill) return;
              base[col.key] =
                col.key === "qty"
                  ? parseQtyInput(cell)
                  : col.key === "remarks"
                    ? formatInventoryAuditRemarks(cell)
                    : cell;
            });
            next[idx] = applyInventoryAuditLookup(base, lookupIndexRef.current);
          });
          return next;
        },
        { immediate: true },
      );
      return true;
    },
    [canEdit, commitRows],
  );

  const deleteRow = useCallback(
    (rowId) => {
      if (!canEdit) return;
      commitRows((prev) => prev.filter((row) => row.id !== rowId), {
        immediate: true,
      });
    },
    [canEdit, commitRows],
  );

  const handleFile = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !canEdit) return;
      setError("");
      setLoading(true);
      try {
        const parsed = await parseInventoryAuditFile(file);
        const imported = parsed.rows.map((row) =>
          applyInventoryAuditLookup(
            importedToWorkspaceRow(row),
            lookupIndexRef.current,
          ),
        );
        commitRows((prev) => [...prev, ...imported], { immediate: true });
      } catch (err) {
        const code = err instanceof Error ? err.message : "";
        if (code === "MISSING_AUDIT_COLUMNS") {
          setError(
            tl(
              "errorMissingColumns",
              "Không tìm thấy cột Location / ERP / Item. Kiểm tra file mẫu kiểm toán.",
            ),
          );
        } else if (code === "EMPTY_SHEET") {
          setError(tl("errorEmpty", "Sheet trống hoặc không có dữ liệu."));
        } else {
          setError(
            tl("errorParse", "Không đọc được file. Chọn đúng định dạng .xlsx."),
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [canEdit, commitRows, tl],
  );

  const handleSourceFile = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file || !email || !canManageSource) return;
      setSourceError("");
      setSourceUploading(true);
      try {
        const parsed = await parseInventorySourceFile(file);
        if (!parsed.records?.length) {
          setSourceError(tl("sourceEmpty", "File nguồn không có dữ liệu."));
          return;
        }
        const uploadedAt = new Date().toISOString();
        const payload = packInventoryAuditSourceTable({
          headers: parsed.headers,
          records: parsed.records,
          extra: {
            savedAt: uploadedAt,
            uploadedAt,
            fileName: file.name,
            uploadedByEmail: email,
            uploadedByName: ownerName,
          },
        });
        await remove(ref(db, INVENTORY_AUDIT_SOURCE_ROOT));
        for (const [key, tsv] of Object.entries(payload.parts)) {
          await set(ref(db, `${INVENTORY_AUDIT_SOURCE_ROOT}/parts/${key}`), tsv);
        }
        await set(ref(db, `${INVENTORY_AUDIT_SOURCE_ROOT}/meta`), payload.meta);
        await remove(ref(db, INVENTORY_AUDIT_SOURCE_PATH));
      } catch (err) {
        const code = err instanceof Error ? err.message : "";
        if (code === "SOURCE_TOO_LARGE") {
          setSourceError(
            tl(
              "sourceTooLarge",
              "File nguồn quá lớn để ghi Firebase. Thử giảm số cột hoặc chia file.",
            ),
          );
        } else if (code === "EMPTY_SHEET") {
          setSourceError(tl("errorEmpty", "Sheet trống hoặc không có dữ liệu."));
        } else {
          setSourceError(
            tl("sourceSaveError", "Không lưu được file nguồn."),
          );
        }
      } finally {
        setSourceUploading(false);
      }
    },
    [canManageSource, email, ownerName, tl],
  );

  const clearSource = useCallback(async () => {
    if (!email || !canManageSource) return;
    if (
      !window.confirm(
        tl(
          "sourceClearConfirm",
          "Xóa file nguồn dùng chung? Tra cứu mã kho/code sẽ không còn dữ liệu.",
        ),
      )
    ) {
      return;
    }
    setSourceError("");
    setSourceUploading(true);
    try {
      await remove(ref(db, INVENTORY_AUDIT_SOURCE_ROOT));
      await remove(ref(db, INVENTORY_AUDIT_SOURCE_PATH));
    } catch (err) {
      console.error(err);
      setSourceError(tl("sourceSaveError", "Không lưu được file nguồn."));
    } finally {
      setSourceUploading(false);
    }
  }, [canManageSource, email, tl]);

  const clearData = useCallback(() => {
    if (!canEdit) return;
    if (
      !window.confirm(
        tl(
          "clearConfirm",
          "Xóa toàn bộ dòng trong không gian của bạn? Thao tác này không hoàn tác được.",
        ),
      )
    ) {
      return;
    }
    commitRows([], { immediate: true });
    setSearch("");
    setError("");
  }, [canEdit, commitRows, tl]);

  const fetchSpaceRows = useCallback(async (viewId) => {
    if (viewId === viewingKeyRef.current) return rowsRef.current;
    const { ownerKey, spaceId } = parseInventoryAuditViewId(viewId);
    const path = inventoryAuditSpacePath(ownerKey, spaceId);
    if (!path) return [];
    const snap = await get(ref(db, path));
    return payloadToInventoryAuditRows(snap.exists() ? snap.val() : null);
  }, []);

  const mergeWorkspaces = useCallback(
    async (keyA, keyB, destKey) => {
      if (!myKey || !ownPath) return false;
      const a = String(keyA ?? "").trim();
      const b = String(keyB ?? "").trim();
      if (!a || !b || a === b) return false;
      const dest = String(destKey ?? INVENTORY_AUDIT_MERGE_DEST_NEW).trim();
      if (dest !== INVENTORY_AUDIT_MERGE_DEST_NEW) {
        const destOwner = parseInventoryAuditViewId(dest).ownerKey;
        if (destOwner !== myKey) return false;
      }
      try {
        setSaving(true);
        setSaveError("");
        if (saveTimerRef.current) {
          window.clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
          persistRows(rowsRef.current, viewingKeyRef.current);
        }
        const [rowsA, rowsB] = await Promise.all([
          fetchSpaceRows(a),
          fetchSpaceRows(b),
        ]);
        let destRows = [];
        const extras = [];
        if (dest === INVENTORY_AUDIT_MERGE_DEST_NEW) {
          extras.push(rowsA, rowsB);
        } else if (dest === a) {
          destRows = rowsA;
          extras.push(rowsB);
        } else if (dest === b) {
          destRows = rowsB;
          extras.push(rowsA);
        } else {
          destRows = await fetchSpaceRows(dest);
          extras.push(rowsA, rowsB);
        }
        const merged = mergeInventoryAuditRowLists(destRows, extras);
        if (dest === INVENTORY_AUDIT_MERGE_DEST_NEW) {
          const titleOf = (key) =>
            inventoryAuditWorkspaceTitle(
              workspaces.find((w) => w.key === key),
              {
                defaultTitle: tl("workspaceDefault", "Chính"),
                untitled: tl("workspaceUntitled", "Chưa đặt tên"),
              },
            );
          const title = tl("mergeNewTitle", "{{a}} + {{b}}", {
            a: titleOf(a),
            b: titleOf(b),
          }).slice(0, 80);
          const spaceId = createInventoryAuditSpaceId();
          const nextView = inventoryAuditViewId(myKey, spaceId);
          await update(ref(db, ownPath), {
            ownerEmail: email,
            ownerName,
          });
          await set(ref(db, inventoryAuditSpacePath(myKey, spaceId)), {
            title,
            savedAt: new Date().toISOString(),
            rows: merged,
          });
          setSearch("");
          setError("");
          setViewingKey(nextView);
        } else if (dest === viewingKeyRef.current) {
          commitRows(merged, { immediate: true });
        } else {
          await persistRows(merged, dest);
          setSearch("");
          setError("");
          setViewingKey(dest);
        }
        return true;
      } catch (err) {
        console.error(err);
        setSaveError(tl("saveError", "Không lưu được không gian làm việc."));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [
      myKey,
      ownPath,
      fetchSpaceRows,
      persistRows,
      commitRows,
      workspaces,
      tl,
      email,
      ownerName,
    ],
  );

  const addWorkspace = useCallback(async () => {
    if (!myKey || !ownPath) return;
    const mySpaces = workspaces.filter((w) => w.ownerKey === myKey);
    const suggested = tl("workspaceAddDefaultName", "Không gian {{n}}", {
      n: mySpaces.length + 1,
    });
    const typed = window.prompt(
      tl("workspaceAddPrompt", "Tên không gian mới"),
      suggested,
    );
    if (typed == null) return;
    const title = String(typed).trim().slice(0, 80) || suggested;
    const spaceId = createInventoryAuditSpaceId();
    const nextView = inventoryAuditViewId(myKey, spaceId);
    try {
      setSaveError("");
      setSaving(true);
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        persistRows(rowsRef.current, viewingKeyRef.current);
      }
      await update(ref(db, ownPath), {
        ownerEmail: email,
        ownerName,
      });
      await set(ref(db, inventoryAuditSpacePath(myKey, spaceId)), {
        title,
        savedAt: new Date().toISOString(),
        rows: [],
      });
      setSearch("");
      setError("");
      setViewingKey(nextView);
    } catch (err) {
      console.error(err);
      setSaveError(tl("saveError", "Không lưu được không gian làm việc."));
    } finally {
      setSaving(false);
    }
  }, [myKey, ownPath, workspaces, tl, persistRows, email, ownerName]);

  const renameWorkspace = useCallback(
    async (viewId, nextTitle) => {
      const id = String(viewId || viewingKeyRef.current || "").trim();
      const { ownerKey, spaceId } = parseInventoryAuditViewId(id);
      if (!myKey || ownerKey !== myKey) return false;
      const path = inventoryAuditSpacePath(ownerKey, spaceId);
      if (!path) return false;
      const current =
        workspaces.find((w) => w.key === id)?.title || "";
      let title = nextTitle;
      if (title == null) {
        const typed = window.prompt(
          tl("workspaceRenamePrompt", "Đổi tên không gian"),
          current,
        );
        if (typed == null) return false;
        title = typed;
      }
      title = String(title).trim().slice(0, 80);
      if (!title || title === current) return false;
      try {
        setSaveError("");
        const patch = { title };
        if (spaceId === INVENTORY_AUDIT_DEFAULT_SPACE_ID) {
          patch.ownerEmail = email;
          patch.ownerName = ownerName;
        }
        await update(ref(db, path), patch);
        return true;
      } catch (err) {
        console.error(err);
        setSaveError(tl("saveError", "Không lưu được không gian làm việc."));
        return false;
      }
    },
    [myKey, workspaces, tl, email, ownerName],
  );

  const deleteWorkspace = useCallback(async () => {
    const { ownerKey, spaceId } = parseInventoryAuditViewId(
      viewingKeyRef.current,
    );
    if (ownerKey !== myKey || spaceId === INVENTORY_AUDIT_DEFAULT_SPACE_ID) {
      return;
    }
    if (
      !window.confirm(
        tl(
          "workspaceDeleteConfirm",
          "Xóa không gian này và toàn bộ dòng trong đó? Thao tác này không hoàn tác được.",
        ),
      )
    ) {
      return;
    }
    try {
      setSaveError("");
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      await remove(ref(db, inventoryAuditSpacePath(ownerKey, spaceId)));
      setSearch("");
      setError("");
      setViewingKey(
        inventoryAuditViewId(myKey, INVENTORY_AUDIT_DEFAULT_SPACE_ID),
      );
    } catch (err) {
      console.error(err);
      setSaveError(tl("saveError", "Không lưu được không gian làm việc."));
    }
  }, [myKey, tl]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [
        r.tag,
        r.locationCode,
        r.locationName,
        r.inventoryType,
        r.erpCode,
        r.itemName,
        r.unit,
        r.qty,
        r.remarks,
      ]
        .map((v) => String(v ?? "").toLowerCase())
        .some((v) => v.includes(q)),
    );
  }, [rows, search]);

  const qtyTotal = useMemo(
    () =>
      filteredRows.reduce((sum, r) => {
        const n = typeof r.qty === "number" ? r.qty : Number(r.qty);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0),
    [filteredRows],
  );

  const viewingWorkspace = useMemo(
    () => workspaces.find((w) => w.key === viewingKey) || null,
    [workspaces, viewingKey],
  );

  const viewingLabel = viewingWorkspace
    ? inventoryAuditWorkspaceTitle(viewingWorkspace, {
        defaultTitle:
          viewingWorkspace.ownerName ||
          viewingWorkspace.ownerEmail ||
          ownerName ||
          email,
        untitled: tl("workspaceUntitled", "Không gian không tên"),
      })
    : ownerName ||
      email ||
      inventoryAuditEmailFromKey(viewingParts.ownerKey);

  const canRenameWorkspace = canEdit;
  const canManageNamedSpace =
    canEdit && viewingParts.spaceId !== INVENTORY_AUDIT_DEFAULT_SPACE_ID;

  const sourceCatalog = sourceData?.meta || legacyCatalog;

  return {
    tl,
    user,
    myKey,
    canEdit,
    canManageSource,
    workspaces,
    viewingKey,
    viewingLabel,
    viewingIsDefault: viewingParts.spaceId === INVENTORY_AUDIT_DEFAULT_SPACE_ID,
    canRenameWorkspace,
    canManageNamedSpace,
    selectWorkspace,
    addWorkspace,
    mergeWorkspaces,
    renameWorkspace,
    deleteWorkspace,
    rows,
    error,
    saveError,
    loading,
    saving,
    search,
    setSearch,
    filteredRows,
    qtyTotal,
    addRow,
    updateCell,
    pasteGrid,
    deleteRow,
    handleFile,
    handleSourceFile,
    clearSource,
    sourceCatalog,
    sourceUploading,
    sourceError,
    sourceItemCount: sourceCatalog?.ic ?? sourceCatalog?.items?.length ?? 0,
    sourceLocationCount:
      sourceCatalog?.lc ?? sourceCatalog?.locations?.length ?? 0,
    sourceRowCount: sourceCatalog?.n ?? sourceCatalog?.sourceRows ?? 0,
    sourceColCount: sourceCatalog?.c ?? sourceCatalog?.h?.length ?? 0,
    clearData,
  };
}
