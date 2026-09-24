import { useEffect, useMemo, useState } from "react";
import { FiAlertTriangle, FiChevronDown, FiDatabase, FiDownload, FiEdit2, FiLayers, FiPlus, FiSearch, FiTrash2, FiUpload } from "react-icons/fi";
import { INVENTORY_AUDIT_WORKSPACE_COLUMNS } from "./lib/constants";
import {
  INVENTORY_AUDIT_MERGE_DEST_NEW,
  inventoryAuditWorkspaceTitle,
} from "./lib/inventoryAuditSpaces";
import { useInventoryAudit } from "./hooks/useInventoryAudit";
import { downloadInventoryAuditExcel } from "./lib/exportInventoryAuditExcel";
import "./inventoryAudit.css";

function formatQtyTotal(qty) {
  if (qty == null || qty === "") return "0";
  return Number(qty).toLocaleString("vi-VN");
}

function formatSourceUploadTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCell(value) {
  if (value == null || value === "") return "";
  return String(value);
}

function AuditCellInput({
  value,
  onChange,
  onEnter,
  onPasteGrid,
  ariaLabel,
  numeric,
}) {
  return (
    <input
      className="inv-audit-input"
      type="text"
      inputMode={numeric ? "decimal" : "text"}
      value={value ?? ""}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      onPaste={(e) => {
        const text = e.clipboardData?.getData("text/plain") ?? "";
        if (onPasteGrid?.(text)) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onEnter) {
          e.preventDefault();
          onEnter();
        }
      }}
    />
  );
}

export default function InventoryAuditPage() {
  const {
    tl,
    myKey,
    canEdit,
    canManageSource,
    workspaces,
    viewingKey,
    viewingLabel,
    selectWorkspace,
    addWorkspace,
    mergeWorkspaces,
    renameWorkspace,
    deleteWorkspace,
    canManageNamedSpace,
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
    clearData,
  } = useInventoryAudit();

  const colSpan =
    INVENTORY_AUDIT_WORKSPACE_COLUMNS.length + (canEdit ? 1 : 0);
  const [workspaceQuery, setWorkspaceQuery] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [editingWsKey, setEditingWsKey] = useState("");
  const [editingWsTitle, setEditingWsTitle] = useState("");
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeA, setMergeA] = useState("");
  const [mergeB, setMergeB] = useState("");
  const [mergeDest, setMergeDest] = useState(INVENTORY_AUDIT_MERGE_DEST_NEW);
  const [exporting, setExporting] = useState(false);

  const viewingWorkspace = useMemo(
    () => workspaces.find((ws) => ws.key === viewingKey) || null,
    [workspaces, viewingKey],
  );

  useEffect(() => {
    setTitleDraft(String(viewingWorkspace?.title ?? ""));
    setEditingWsKey("");
  }, [viewingKey, viewingWorkspace?.title]);

  const visibleWorkspaces = useMemo(() => {
    const q = workspaceQuery.trim().toLowerCase();
    const filtered = !q
      ? workspaces
      : workspaces.filter((ws) =>
          [ws.title, ws.ownerName, ws.ownerEmail, ws.key]
            .map((v) => String(v ?? "").toLowerCase())
            .some((v) => v.includes(q)),
        );
    const mine = [];
    const others = [];
    for (const ws of filtered) {
      if (ws.ownerKey === myKey) mine.push(ws);
      else others.push(ws);
    }
    return { mine, others };
  }, [workspaces, workspaceQuery, myKey]);

  const sourceUploader =
    sourceCatalog?.uploadedByEmail || sourceCatalog?.uploadedByName || "";
  const sourceUploadWhen = formatSourceUploadTime(
    sourceCatalog?.uploadedAt || sourceCatalog?.savedAt,
  );

  const listLabel = (ws) =>
    inventoryAuditWorkspaceTitle(ws, {
      defaultTitle:
        ws.ownerKey === myKey
          ? tl("workspaceDefault", "Không gian chính")
          : ws.ownerName || ws.ownerEmail || ws.ownerKey,
      untitled: tl("workspaceUntitled", "Không gian không tên"),
    });

  const saveWorkspaceTitle = (viewId, nextTitle) => {
    const title = String(nextTitle ?? "").trim();
    if (!title) return;
    renameWorkspace(viewId, title);
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      await downloadInventoryAuditExcel({
        rows: filteredRows,
        title: viewingLabel,
        sheetName: "Kiem ke",
      });
    } catch (err) {
      console.error(err);
      window.alert(tl("exportError", "Không xuất được Excel."));
    } finally {
      setExporting(false);
    }
  };

  const myWorkspaces = useMemo(
    () => workspaces.filter((ws) => ws.ownerKey === myKey),
    [workspaces, myKey],
  );

  const renderWorkspaceCard = (ws, mine) => {
    const active = ws.key === viewingKey;
    const label = listLabel(ws);
    const ownerLine =
      !mine || !ws.isDefault
        ? [ws.ownerName, ws.ownerEmail]
            .filter(Boolean)
            .filter((v, i, arr) => arr.indexOf(v) === i && v !== label)
            .join(" · ")
        : "";
    const editing = editingWsKey === ws.key;
    return (
      <div
        key={ws.key}
        className={`inv-audit-ws-item${active ? " is-active" : ""}${mine ? " is-mine" : " is-other"}`}
      >
        {editing ? (
          <input
            className="inv-audit-ws-item-name-input"
            value={editingWsTitle}
            autoFocus
            maxLength={80}
            aria-label={tl("workspaceRename", "Đổi tên")}
            onChange={(e) => setEditingWsTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveWorkspaceTitle(ws.key, editingWsTitle);
                setEditingWsKey("");
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setEditingWsKey("");
              }
            }}
            onBlur={() => {
              saveWorkspaceTitle(ws.key, editingWsTitle);
              setEditingWsKey("");
            }}
          />
        ) : (
          <button
            type="button"
            className="inv-audit-ws-item-select"
            aria-current={active ? "true" : undefined}
            onClick={() => selectWorkspace(ws.key)}
          >
            <span className="inv-audit-ws-item-top">
              <span className="inv-audit-ws-item-name">{label}</span>
              {mine ? (
                <span className="inv-audit-ws-badge inv-audit-ws-badge--mine">
                  {tl("workspaceMine", "Của tôi")}
                </span>
              ) : (
                <span className="inv-audit-ws-badge inv-audit-ws-badge--warn">
                  <FiAlertTriangle aria-hidden />
                  {tl("workspaceViewOnlyWarn", "Chỉ xem")}
                </span>
              )}
            </span>
            {ownerLine ? (
              <span className="inv-audit-ws-item-email">{ownerLine}</span>
            ) : null}
            {!mine ? (
              <span className="inv-audit-ws-warn" role="status">
                {tl("workspaceViewOnlyHint", "Không sửa được")}
              </span>
            ) : null}
            <span className="inv-audit-ws-item-meta">
              {tl("rowCount", "{{count}} dòng", { count: ws.rowCount ?? 0 })}
            </span>
          </button>
        )}
        {mine ? (
          <button
            type="button"
            className="inv-audit-ws-item-edit"
            title={tl("workspaceRename", "Đổi tên")}
            aria-label={tl("workspaceRename", "Đổi tên")}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              selectWorkspace(ws.key);
              setEditingWsKey(ws.key);
              setEditingWsTitle(ws.title || label);
            }}
          >
            <FiEdit2 aria-hidden />
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="inv-audit-page">
      <aside className="inv-audit-ws-sidebar dashboard-no-print">
        {canManageSource ? (
        <section className="inv-audit-source">
          <h2 className="inv-audit-ws-sidebar-title">
            {tl("sourceTitle", "Dữ liệu nguồn")}
          </h2>
          {sourceCatalog?.fileName || sourceUploader || sourceUploadWhen ? (
            <p className="inv-audit-source-meta">
              {sourceCatalog?.fileName ? (
                <strong>{sourceCatalog.fileName}</strong>
              ) : null}
              {sourceUploader ? (
                <span>
                  {tl("sourceUploadedBy", "{{email}}", {
                    email: sourceUploader,
                  })}
                </span>
              ) : null}
              {sourceUploadWhen ? (
                <span>
                  {tl("sourceUploadedAt", "{{when}}", {
                    when: sourceUploadWhen,
                  })}
                </span>
              ) : null}
            </p>
          ) : (
            <p className="inv-audit-source-meta">
              {tl("sourceEmptyState", "Chưa có nguồn.")}
            </p>
          )}
          {sourceError ? (
            <p className="inv-audit-source-error">{sourceError}</p>
          ) : null}
          <div className="inv-audit-source-actions">
            <label className="inv-audit-btn inv-audit-btn--primary inv-audit-source-upload">
              <FiDatabase aria-hidden />
              {sourceUploading
                ? tl("sourceUploading", "Đang tải file nguồn…")
                : tl("sourceUploadBtn", "Tải file nguồn")}
              <input
                type="file"
                accept=".xlsx,.xls"
                className="sr-only"
                onChange={handleSourceFile}
                disabled={sourceUploading}
              />
            </label>
            {sourceCatalog?.fileName ? (
              <button
                type="button"
                className="inv-audit-btn inv-audit-btn--ghost"
                onClick={clearSource}
                disabled={sourceUploading}
              >
                <FiTrash2 aria-hidden />
                {tl("sourceClearBtn", "Xóa file nguồn")}
              </button>
            ) : null}
          </div>
        </section>
        ) : null}
        <h2 className="inv-audit-ws-sidebar-title">
          {tl("workspaceSelect", "Xem không gian")}
        </h2>
        <button
          type="button"
          className="inv-audit-btn inv-audit-btn--primary inv-audit-ws-add"
          onClick={addWorkspace}
        >
          <FiPlus aria-hidden />
          {tl("workspaceAdd", "Tạo mới")}
        </button>
        <button
          type="button"
          className="inv-audit-btn inv-audit-btn--ghost inv-audit-ws-add"
          onClick={() => {
            const next = !mergeOpen;
            setMergeOpen(next);
            if (next) {
              setMergeA(viewingKey);
              setMergeB(
                workspaces.find((ws) => ws.key !== viewingKey)?.key || "",
              );
              setMergeDest(INVENTORY_AUDIT_MERGE_DEST_NEW);
            }
          }}
        >
          <FiLayers aria-hidden />
          {tl("mergeBtn", "Gộp dữ liệu")}
        </button>
        {mergeOpen ? (
          <form
            className="inv-audit-merge"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!mergeA || !mergeB || mergeA === mergeB) return;
              const name = (key) => listLabel(workspaces.find((w) => w.key === key) || {});
              if (
                !window.confirm(
                  tl(
                    "mergeConfirm",
                    "Gộp «{{a}}» và «{{b}}»? Hai bảng gốc giữ nguyên.",
                    { a: name(mergeA), b: name(mergeB) },
                  ),
                )
              ) {
                return;
              }
              const ok = await mergeWorkspaces(mergeA, mergeB, mergeDest);
              if (ok) setMergeOpen(false);
            }}
          >
            <label>
              <span>{tl("mergeFrom", "Bảng 1")}</span>
              <select
                value={mergeA}
                onChange={(e) => setMergeA(e.target.value)}
              >
                {workspaces.map((ws) => (
                  <option key={ws.key} value={ws.key}>
                    {listLabel(ws)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{tl("mergeWith", "Bảng 2")}</span>
              <select
                value={mergeB}
                onChange={(e) => setMergeB(e.target.value)}
              >
                <option value="">{tl("mergePick", "Chọn bảng…")}</option>
                {workspaces
                  .filter((ws) => ws.key !== mergeA)
                  .map((ws) => (
                    <option key={ws.key} value={ws.key}>
                      {listLabel(ws)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <span>{tl("mergeInto", "Lưu vào")}</span>
              <select
                value={mergeDest}
                onChange={(e) => setMergeDest(e.target.value)}
              >
                <option value={INVENTORY_AUDIT_MERGE_DEST_NEW}>
                  {tl("mergeIntoNew", "Không gian mới")}
                </option>
                {myWorkspaces.map((ws) => (
                  <option key={ws.key} value={ws.key}>
                    {listLabel(ws)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="inv-audit-btn inv-audit-btn--primary"
              disabled={!mergeA || !mergeB || mergeA === mergeB || saving}
            >
              {tl("mergeRun", "Gộp")}
            </button>
          </form>
        ) : null}
        <label className="inv-audit-ws-sidebar-search">
          <FiSearch aria-hidden />
          <input
            type="search"
            value={workspaceQuery}
            onChange={(e) => setWorkspaceQuery(e.target.value)}
            placeholder={tl("workspaceSearch", "Tìm tên, email…")}
          />
        </label>
        <nav className="inv-audit-ws-nav" aria-label={tl("workspaceSelect", "Xem không gian")}>
          {visibleWorkspaces.mine.length === 0 &&
          visibleWorkspaces.others.length === 0 ? (
            <p className="inv-audit-ws-empty">
              {tl("workspaceEmptyList", "Không có không gian nào.")}
            </p>
          ) : (
            <>
              {visibleWorkspaces.mine.length ? (
                <div className="inv-audit-ws-group">
                  <h3 className="inv-audit-ws-group-title">
                    {tl("workspaceGroupMine", "Của tôi")}
                  </h3>
                  {visibleWorkspaces.mine.map((ws) =>
                    renderWorkspaceCard(ws, true),
                  )}
                </div>
              ) : null}
              {visibleWorkspaces.others.length ? (
                <div className="inv-audit-ws-group">
                  <h3 className="inv-audit-ws-group-title">
                    {tl("workspaceGroupOthers", "Người khác")}
                  </h3>
                  {visibleWorkspaces.others.map((ws) =>
                    renderWorkspaceCard(ws, false),
                  )}
                </div>
              ) : null}
            </>
          )}
        </nav>
      </aside>

      <div className="inv-audit-body">
      <header className="inv-audit-header dashboard-no-print">
        <div className="inv-audit-heading">
          <h1 className="inv-audit-title">
            {tl("pageTitle", "Kiểm kê tồn kho")}
          </h1>
          {canEdit ? (
            <input
              className="inv-audit-ws-title-input"
              value={titleDraft}
              maxLength={80}
              aria-label={tl("workspaceTitleLabel", "Tên")}
              placeholder={tl("workspaceTitlePlaceholder", "Đặt tên không gian…")}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => saveWorkspaceTitle(viewingKey, titleDraft)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
            />
          ) : (
            <p className="inv-audit-subtitle">{viewingLabel}</p>
          )}
          <p
            className={`inv-audit-status${saveError ? " inv-audit-status--error" : ""}${!canEdit ? " inv-audit-status--view" : ""}`}
            aria-live="polite"
          >
            {canEdit
              ? saving
                ? tl("saving", "Đang lưu")
                : saveError
                  ? saveError
                  : tl("savedOwn", "Đã lưu")
              : tl("viewOnlyHint", "Chỉ xem")}
          </p>
        </div>
        <div className="inv-audit-actions">
        {canEdit ? (
          <>
            <details className="inv-audit-add-menu">
              <summary className="inv-audit-btn inv-audit-btn--primary">
                <FiPlus aria-hidden />
                {tl("addRow", "Thêm dòng")}
                <FiChevronDown aria-hidden className="inv-audit-add-caret" />
              </summary>
              <div className="inv-audit-add-menu-list" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    addRow(1);
                    e.currentTarget.closest("details")?.removeAttribute("open");
                  }}
                >
                  {tl("addRowOne", "Thêm 1 dòng")}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    const details = e.currentTarget.closest("details");
                    details?.removeAttribute("open");
                    const typed = window.prompt(
                      tl("addRowManyPrompt", "Nhập số dòng cần thêm (1–500)"),
                      "10",
                    );
                    if (typed == null) return;
                    const n = Math.floor(Number(String(typed).trim()));
                    if (!Number.isFinite(n) || n < 1) return;
                    addRow(n);
                  }}
                >
                  {tl("addRowMany", "Thêm số dòng tùy chọn…")}
                </button>
              </div>
            </details>
            <label className="inv-audit-btn inv-audit-btn--ghost">
              <FiUpload aria-hidden />
              {tl("uploadBtn", "Nhập Excel vào không gian này")}
              <input
                type="file"
                accept=".xlsx,.xls"
                className="sr-only"
                onChange={handleFile}
                disabled={loading}
              />
            </label>
          </>
        ) : null}
          <button
            type="button"
            className="inv-audit-btn inv-audit-btn--ghost"
            onClick={exportExcel}
            disabled={exporting}
          >
            <FiDownload aria-hidden />
            {exporting
              ? tl("exporting", "Đang xuất…")
              : tl("exportBtn", "Xuất Excel")}
          </button>
        {canEdit ? (
          <>
            {canManageNamedSpace ? (
              <button
                type="button"
                className="inv-audit-btn inv-audit-btn--ghost"
                onClick={deleteWorkspace}
              >
                <FiTrash2 aria-hidden />
                {tl("workspaceDelete", "Xóa không gian")}
              </button>
            ) : null}
            {rows.length > 0 ? (
              <button
                type="button"
                className="inv-audit-btn inv-audit-btn--ghost"
                onClick={clearData}
              >
                <FiTrash2 aria-hidden />
                {tl("clearBtn", "Xóa hết dòng")}
              </button>
            ) : null}
          </>
        ) : null}
        </div>
      </header>

      {error ? (
        <div className="inv-audit-alert dashboard-no-print" role="alert">
          {error}
        </div>
      ) : null}

      {loading && rows.length === 0 ? (
        <p className="inv-audit-muted dashboard-no-print">
          {tl("loading", "Đang tải dữ liệu…")}
        </p>
      ) : null}

      <div className="inv-audit-toolbar dashboard-no-print">
        <label className="inv-audit-search">
          <FiSearch aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tl(
              "searchPlaceholder",
              "Tìm tag, vị trí, loại hàng, code, ghi chú…",
            )}
          />
        </label>
        <p className="inv-audit-meta">
          <span>
            {tl("rowCount", "{{count}} dòng", {
              count: filteredRows.length,
            })}
          </span>
          <span>
            {tl("qtyTotal", "Tổng SL: {{qty}}", {
              qty: formatQtyTotal(qtyTotal),
            })}
          </span>
        </p>
      </div>

      <div
        className="inv-audit-table-wrap"
        onPaste={(e) => {
          if (!canEdit) return;
          if (e.target?.closest?.(".inv-audit-input")) return;
          const text = e.clipboardData?.getData("text/plain") ?? "";
          if (
            pasteGrid(
              filteredRows[0]?.id,
              INVENTORY_AUDIT_WORKSPACE_COLUMNS[0].key,
              text,
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <table
          className={`inv-audit-table inv-audit-table--workspace${canEdit ? "" : " inv-audit-table--readonly"}`}
        >
          <colgroup>
            {INVENTORY_AUDIT_WORKSPACE_COLUMNS.map((col) => (
              <col key={col.key} className={col.colClass} />
            ))}
            {canEdit ? <col className="inv-audit-col-actions" /> : null}
          </colgroup>
          <thead>
            <tr className="inv-audit-qty-total-row">
              {INVENTORY_AUDIT_WORKSPACE_COLUMNS.map((col) => (
                <th
                  key={`qty-total-${col.key}`}
                  className={
                    col.key === "qty"
                      ? "inv-audit-th-qty-total"
                      : "inv-audit-th-qty-total-spacer"
                  }
                >
                  {col.key === "qty" ? (
                    <button
                      type="button"
                      className="inv-audit-qty-total-btn"
                      title={tl("qtyTotal", "Tổng SL {{qty}}", {
                        qty: formatQtyTotal(qtyTotal),
                      })}
                    >
                      <span className="inv-audit-qty-total-label">
                        {tl("qtyTotalLabel", "Tổng")}
                      </span>
                      <span className="inv-audit-qty-total-value">
                        {formatQtyTotal(qtyTotal)}
                      </span>
                    </button>
                  ) : null}
                </th>
              ))}
              {canEdit ? (
                <th className="inv-audit-th-qty-total-spacer dashboard-no-print" />
              ) : null}
            </tr>
            <tr>
              {INVENTORY_AUDIT_WORKSPACE_COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={col.autoFill ? "inv-audit-th--autofill" : undefined}
                >
                  <span className="inv-audit-th-en">{col.en}</span>
                  {col.vi ? (
                    <span className="inv-audit-th-vi">{col.vi}</span>
                  ) : null}
                </th>
              ))}
              {canEdit ? (
                <th className="inv-audit-th-actions dashboard-no-print">
                  {tl("colActions", "")}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="inv-audit-empty-cell">
                  {canEdit
                    ? tl(
                        "emptyHint",
                        "Chưa có dòng. Bấm «Thêm dòng» để nhập đủ các cột kiểm toán.",
                      )
                    : tl("emptyView", "Không gian này chưa có dòng.")}
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.id}>
                  {INVENTORY_AUDIT_WORKSPACE_COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      className={[
                        col.pink ? "inv-audit-td--pink" : "",
                        col.autoFill ? "inv-audit-td--autofill" : "",
                      ]
                        .filter(Boolean)
                        .join(" ") || undefined}
                    >
                      {canEdit && !col.autoFill ? (
                        <AuditCellInput
                          numeric={col.key === "qty"}
                          value={row[col.key]}
                          ariaLabel={col.vi || col.en}
                          onChange={(value) =>
                            updateCell(row.id, col.key, value)
                          }
                          onPasteGrid={(text) =>
                            pasteGrid(row.id, col.key, text)
                          }
                          onEnter={col.key === "remarks" ? () => addRow(1) : undefined}
                        />
                      ) : (
                        <span className="inv-audit-readonly">
                          {formatCell(row[col.key])}
                        </span>
                      )}
                    </td>
                  ))}
                  {canEdit ? (
                    <td className="inv-audit-td-actions dashboard-no-print">
                      <button
                        type="button"
                        className="inv-audit-row-del"
                        onClick={() => deleteRow(row.id)}
                        aria-label={tl("deleteRow", "Xóa dòng")}
                      >
                        <FiTrash2 aria-hidden />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}
