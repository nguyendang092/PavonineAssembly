import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import {
  storage,
  storageRef,
  uploadBytes,
  getDownloadURL,
} from "@/services/firebase";
import { ANNOUNCEMENT_VISIBILITY } from "@/config/authRoles";
import {
  getLatestAttachment,
  LatestAttachmentInlinePreview,
} from "./InternalAnnouncementLatestAttachmentPreview";

function parseVisibility(raw) {
  const allowed = Object.values(ANNOUNCEMENT_VISIBILITY);
  const s = String(raw ?? "").trim();
  return allowed.includes(s) ? s : ANNOUNCEMENT_VISIBILITY.ALL;
}

const DRAFT_PREFIX = "pavonine_internalAnnouncements_draft_";
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

function draftKey(email) {
  return `${DRAFT_PREFIX}${String(email || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._-]/g, "_")}`;
}

function stripHtml(html) {
  if (typeof document === "undefined") {
    return String(html || "").replace(/<[^>]*>/g, " ");
  }
  const d = document.createElement("div");
  d.innerHTML = html || "";
  return d.textContent || d.innerText || "";
}

function isBodyEmpty(html) {
  const t = stripHtml(html).replace(/\u200b/g, "").trim();
  return !t;
}

/**
 * Modal soạn thư: toolbar Gửi / Lưu nháp / Xem trước / Soạn lại, metadata, đính kèm, ReactQuill.
 */
function InternalAnnouncementsCompose({
  open,
  onClose,
  user,
  onPublish,
  showErr,
  showOk,
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);

  const [title, setTitle] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [pinned, setPinned] = useState(false);
  const [toMe, setToMe] = useState(false);
  const [ccOpen, setCcOpen] = useState(false);
  const [cc, setCc] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [autoSave, setAutoSave] = useState("off");
  const [visibility, setVisibility] = useState(ANNOUNCEMENT_VISIBILITY.ALL);

  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline", "strike"],
          [{ color: [] }, { background: [] }],
          [{ list: "ordered" }, { list: "bullet" }],
          [{ indent: "-1" }, { indent: "+1" }],
          [{ align: [] }],
          ["link", "image"],
          ["clean"],
        ],
        handlers: {
          image: function imageHandler() {
            const quill = this.quill;
            const input = document.createElement("input");
            input.setAttribute("type", "file");
            input.setAttribute("accept", "image/*");
            input.click();
            input.onchange = async () => {
              const file = input.files?.[0];
              if (!file || !user?.email) return;
              if (file.size > 15 * 1024 * 1024) {
                showErr(t("internalAnnouncements.attachTooLarge"));
                return;
              }
              try {
                const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                const path = `internalAnnouncements/${String(user.email)
                  .trim()
                  .replace(/[^a-z0-9@._-]/gi, "_")}/${Date.now()}_${safe}`;
                const r = storageRef(storage, path);
                await uploadBytes(r, file);
                const url = await getDownloadURL(r);
                const range = quill.getSelection(true) || { index: quill.getLength() };
                quill.insertEmbed(range.index, "image", url);
              } catch (err) {
                console.error(err);
                showErr(t("internalAnnouncements.imageUploadFail"));
              }
            };
          },
        },
      },
    }),
    [user, showErr, t],
  );

  const formats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "color",
    "background",
    "list",
    "bullet",
    "indent",
    "align",
    "link",
    "image",
  ];

  const resetForm = useCallback(() => {
    setTitle("");
    setBodyHtml("");
    setPinned(false);
    setToMe(false);
    setCcOpen(false);
    setCc("");
    setAttachments([]);
    setPreviewOpen(false);
    setVisibility(ANNOUNCEMENT_VISIBILITY.ALL);
  }, []);

  const saveDraft = useCallback(() => {
    if (!user?.email) return;
    try {
      const payload = {
        title,
        bodyHtml,
        pinned,
        cc,
        attachments,
        visibility,
        savedAt: Date.now(),
      };
      localStorage.setItem(draftKey(user.email), JSON.stringify(payload));
      showOk(t("internalAnnouncements.draftSaved"));
    } catch {
      showErr(t("internalAnnouncements.draftFail"));
    }
  }, [
    user?.email,
    title,
    bodyHtml,
    pinned,
    cc,
    attachments,
    visibility,
    showOk,
    showErr,
    t,
  ]);

  useEffect(() => {
    if (!open || !user?.email) return;
    try {
      const raw = localStorage.getItem(draftKey(user.email));
      if (raw) {
        const d = JSON.parse(raw);
        if (d && typeof d === "object") {
          setTitle(typeof d.title === "string" ? d.title : "");
          setBodyHtml(typeof d.bodyHtml === "string" ? d.bodyHtml : "");
          setPinned(typeof d.pinned === "boolean" ? d.pinned : false);
          const ccVal = typeof d.cc === "string" ? d.cc : "";
          setCc(ccVal);
          setCcOpen(Boolean(ccVal));
          setToMe(false);
          setAttachments(Array.isArray(d.attachments) ? d.attachments : []);
          setVisibility(parseVisibility(d.visibility));
          return;
        }
      }
    } catch {
      /* fall through */
    }
    resetForm();
  }, [open, user?.email, resetForm]);

  useEffect(() => {
    if (!open || autoSave !== "1m") return;
    const id = setInterval(() => {
      if (!user?.email) return;
      try {
        localStorage.setItem(
          draftKey(user.email),
          JSON.stringify({
            title,
            bodyHtml,
            pinned,
            cc,
            attachments,
            visibility,
            savedAt: Date.now(),
          }),
        );
      } catch {
        /* ignore */
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [open, autoSave, user?.email, title, bodyHtml, pinned, cc, attachments, visibility]);

  const uploadFiles = async (fileList) => {
    if (!user?.email || !fileList?.length) return;
    const prevLen = attachments.length;
    setUploading(true);
    try {
      const next = [...attachments];
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (file.size > MAX_ATTACHMENT_BYTES) {
          showErr(t("internalAnnouncements.attachTooLarge"));
          continue;
        }
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `internalAnnouncements_files/${String(user.email)
          .trim()
          .replace(/[^a-z0-9@._-]/gi, "_")}/${Date.now()}_${i}_${safe}`;
        const r = storageRef(storage, path);
        await uploadBytes(r, file);
        const url = await getDownloadURL(r);
        next.push({
          name: file.name,
          url,
          size: file.size,
        });
      }
      setAttachments(next);
      if (next.length > prevLen) {
        setPreviewOpen(true);
      }
    } catch (err) {
      console.error(err);
      showErr(t("internalAnnouncements.attachUploadFail"));
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files?.length) uploadFiles(Array.from(files));
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files?.length) uploadFiles(Array.from(files));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const removeAttachment = (idx) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearAttachments = () => setAttachments([]);

  const handleReset = () => {
    if (
      (title.trim() || !isBodyEmpty(bodyHtml) || attachments.length > 0) &&
      !window.confirm(t("internalAnnouncements.resetConfirm"))
    ) {
      return;
    }
    resetForm();
    if (user?.email) localStorage.removeItem(draftKey(user.email));
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const tTrim = String(title || "").trim();
    if (!tTrim) {
      showErr(t("internalAnnouncements.titleRequired"));
      return;
    }
    if (isBodyEmpty(bodyHtml)) {
      showErr(t("internalAnnouncements.bodyRequired"));
      return;
    }
    try {
      await onPublish({
        title: tTrim,
        body: bodyHtml,
        pinned,
        attachments,
        cc: cc.trim() || undefined,
        audience: toMe ? "self" : "all",
        visibility: parseVisibility(visibility),
      });
      if (user?.email) localStorage.removeItem(draftKey(user.email));
      resetForm();
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  const attachmentBytes = attachments.reduce((a, x) => a + (x.size || 0), 0);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex flex-col bg-black/45 p-0 sm:p-4 sm:items-center sm:justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compose-title"
      >
        <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-none bg-white shadow-2xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-700 sm:max-h-[95vh] sm:rounded-lg">
          {/* Toolbar */}
          <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/90 sm:px-4">
            <h2 id="compose-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
              {t("internalAnnouncements.composeTitle")}
            </h2>
            <div className="flex flex-wrap items-center gap-1 sm:gap-2">
              <button
                type="submit"
                form="compose-form"
                disabled={uploading}
                className="inline-flex items-center gap-1 rounded border border-sky-600 bg-sky-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 sm:text-sm"
              >
                <span aria-hidden>✈</span> {t("internalAnnouncements.composeSend")}
              </button>
              <button
                type="button"
                onClick={saveDraft}
                disabled={uploading}
                className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:text-sm"
              >
                <span aria-hidden>💾</span> {t("internalAnnouncements.composeDraft")}
              </button>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:text-sm"
              >
                <span aria-hidden>👁</span> {t("internalAnnouncements.composePreview")}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 sm:text-sm"
              >
                <span aria-hidden>↺</span> {t("internalAnnouncements.composeReset")}
              </button>
              <select
                value={autoSave}
                onChange={(e) => setAutoSave(e.target.value)}
                className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 sm:text-sm"
              >
                <option value="off">{t("internalAnnouncements.composeAutoSaveOff")}</option>
                <option value="1m">{t("internalAnnouncements.composeAutoSave1m")}</option>
              </select>
              <button
                type="button"
                onClick={onClose}
                className="rounded p-1.5 text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-700"
                aria-label={t("internalAnnouncements.cancel")}
              >
                ✕
              </button>
            </div>
          </div>

          <form
            id="compose-form"
            onSubmit={handleSend}
            className="flex min-h-0 flex-1 flex-col overflow-y-auto"
          >
            {/* Người nhận */}
            <div className="grid grid-cols-[100px_1fr] items-start gap-x-3 gap-y-2 border-b border-slate-100 px-3 py-2 sm:px-4">
              <span className="pt-2 text-xs font-medium text-slate-600 sm:text-sm">
                {t("internalAnnouncements.composeRecipient")}
              </span>
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                <label className="flex shrink-0 items-center gap-2 text-xs text-slate-700 sm:text-sm">
                  <input
                    type="checkbox"
                    checked={toMe}
                    onChange={(e) => setToMe(e.target.checked)}
                    className="rounded border-slate-400"
                  />
                  {t("internalAnnouncements.composeToMe")}
                </label>
                <input
                  type="text"
                  readOnly
                  value={
                    toMe
                      ? user?.email || ""
                      : t("internalAnnouncements.composeBroadcast")
                  }
                  className="min-w-0 flex-1 rounded border border-slate-300 bg-slate-50 px-2 py-1.5 text-sm text-slate-800"
                />
                <div className="hidden gap-1 sm:flex">
                  <button
                    type="button"
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-500"
                    disabled
                  >
                    {t("internalAnnouncements.composeAddrBook")}
                  </button>
                </div>
              </div>
            </div>

            {/* Cc */}
            <div className="grid grid-cols-[100px_1fr] items-center gap-x-3 border-b border-slate-100 px-3 py-2 sm:px-4">
              <span className="text-xs font-medium text-slate-600 sm:text-sm">
                {t("internalAnnouncements.composeCc")}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCcOpen((v) => !v)}
                  className="inline-flex items-center gap-1 rounded border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  + {t("internalAnnouncements.composeAddCc")}
                </button>
                {ccOpen ? (
                  <input
                    type="text"
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    placeholder={t("internalAnnouncements.composeCcPlaceholder")}
                    className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
                  />
                ) : null}
              </div>
            </div>

            {/* Phạm vi xem */}
            <div className="grid grid-cols-1 gap-2 border-b border-slate-100 px-3 py-2 sm:grid-cols-[100px_1fr] sm:items-start sm:gap-x-3 sm:px-4">
              <span className="text-xs font-medium text-slate-600 sm:pt-2 sm:text-sm">
                {t("internalAnnouncements.visibilityLabel")}
              </span>
              <div className="min-w-0">
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(parseVisibility(e.target.value))}
                  className="w-full max-w-md rounded border border-slate-300 bg-white px-2 py-2 text-sm"
                >
                  <option value={ANNOUNCEMENT_VISIBILITY.ALL}>
                    {t("internalAnnouncements.visibilityAll")}
                  </option>
                  <option value={ANNOUNCEMENT_VISIBILITY.AUTH}>
                    {t("internalAnnouncements.visibilityAuth")}
                  </option>
                  <option value={ANNOUNCEMENT_VISIBILITY.MANAGERS}>
                    {t("internalAnnouncements.visibilityManagers")}
                  </option>
                  <option value={ANNOUNCEMENT_VISIBILITY.ADMIN}>
                    {t("internalAnnouncements.visibilityAdmin")}
                  </option>
                </select>
                <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
                  {t("internalAnnouncements.visibilityHelp")}
                </p>
              </div>
            </div>

            {/* Tiêu đề + Quan trọng */}
            <div className="grid grid-cols-[100px_1fr] items-center gap-x-3 border-b border-slate-100 px-3 py-2 sm:px-4">
              <span className="text-xs font-medium text-slate-600 sm:text-sm">
                {t("internalAnnouncements.fieldTitle")}
              </span>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="flex shrink-0 items-center gap-2 text-xs text-slate-700 sm:text-sm">
                  <input
                    type="checkbox"
                    checked={pinned}
                    onChange={(e) => setPinned(e.target.checked)}
                    className="rounded border-slate-400"
                  />
                  {t("internalAnnouncements.composeImportant")}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  placeholder={t("internalAnnouncements.titlePlaceholder")}
                  className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
            </div>

            {/* Đính kèm */}
            <div className="border-b border-slate-100 px-3 py-3 sm:px-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-600 sm:text-sm">
                  {t("internalAnnouncements.composeAttachments")}
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50"
                >
                  {t("internalAnnouncements.composeChooseFile")}
                </button>
                <button
                  type="button"
                  onClick={clearAttachments}
                  disabled={!attachments.length}
                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-40"
                >
                  {t("internalAnnouncements.composeDeleteAllAttach")}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
              <p className="mb-2 text-[11px] text-slate-500">
                {t("internalAnnouncements.composeQuota", {
                  used: (attachmentBytes / (1024 * 1024)).toFixed(2),
                })}
              </p>
              <div
                ref={dropRef}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50/80 px-4 py-6 text-center text-xs text-slate-500"
              >
                {t("internalAnnouncements.composeDropHint")}
                {uploading ? (
                  <span className="ml-2 text-sky-600">
                    {t("internalAnnouncements.uploading")}
                  </span>
                ) : null}
              </div>
              {attachments.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs">
                  {attachments.map((a, idx) => (
                    <li
                      key={`${a.url}-${idx}`}
                      className="flex items-center justify-between gap-2 rounded border border-slate-100 bg-white px-2 py-1"
                    >
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 truncate text-sky-700 hover:underline"
                      >
                        {a.name}
                      </a>
                      <span className="shrink-0 text-slate-400">
                        {(a.size / 1024).toFixed(1)} KB
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="shrink-0 text-red-600 hover:underline"
                      >
                        {t("internalAnnouncements.removeAttach")}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {/* Editor */}
            <div className="flex min-h-0 flex-1 flex-col px-3 pb-4 pt-2 sm:px-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">
                  {t("internalAnnouncements.fieldBody")}
                </span>
                <span className="text-[11px] text-slate-400">HTML</span>
              </div>
              <div className="compose-quill-wrapper min-h-[280px] flex-1 rounded border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-950">
                <ReactQuill
                  theme="snow"
                  value={bodyHtml}
                  onChange={setBodyHtml}
                  modules={modules}
                  formats={formats}
                  placeholder={t("internalAnnouncements.bodyPlaceholder")}
                />
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Preview */}
      {previewOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
              <span className="font-semibold text-slate-900">
                {t("internalAnnouncements.composePreview")}
              </span>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-3">
              <h3 className="text-lg font-bold text-slate-900">
                {title || "—"}
              </h3>
              {pinned ? (
                <p className="mt-1 text-xs font-semibold text-amber-600">
                  {t("internalAnnouncements.composeImportant")}
                </p>
              ) : null}
              {(() => {
                const latest = getLatestAttachment(attachments);
                return latest ? (
                  <LatestAttachmentInlinePreview
                    attachment={latest}
                    titleLabel={t(
                      "internalAnnouncements.latestAttachmentPreview",
                    )}
                    openInNewTabLabel={t(
                      "internalAnnouncements.openAttachmentNewTab",
                    )}
                  />
                ) : null;
              })()}
              <div
                className="compose-preview-html mt-4 text-sm leading-relaxed text-slate-800 [&_a]:text-sky-600 [&_img]:max-h-96 [&_img]:max-w-full [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{
                  __html:
                    bodyHtml ||
                    `<p class="text-slate-400">${t("internalAnnouncements.emptyBodyPreview")}</p>`,
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        .compose-quill-wrapper .ql-container { min-height: 240px; font-size: 14px; }
        .compose-quill-wrapper .ql-editor { min-height: 240px; }
      `}</style>
    </>
  );
}

export default InternalAnnouncementsCompose;
