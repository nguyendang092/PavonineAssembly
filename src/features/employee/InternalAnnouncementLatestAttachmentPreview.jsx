import React from "react";

/** Tệp thêm sau cùng trong mảng `attachments` (thường là mới nhất). */
export function getLatestAttachment(attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) return null;
  return attachments[attachments.length - 1];
}

function attachmentKind(name) {
  const n = String(name || "");
  if (/\.(png|jpe?g|gif|webp|bmp)$/i.test(n)) return "image";
  if (/\.pdf$/i.test(n)) return "pdf";
  return "other";
}

/**
 * Khối xem trướa inline: ảnh / PDF (iframe) / liên kết tải.
 * Dùng chung màn đọc thông báo và hộp thoại Xem trước khi soạn.
 */
export function LatestAttachmentInlinePreview({
  attachment,
  titleLabel,
  openInNewTabLabel,
}) {
  if (!attachment?.url) return null;
  const name = attachment.name || "file";
  const kind = attachmentKind(name);

  return (
    <div className="mb-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/50">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white/80 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900/40">
        <span className="font-semibold text-slate-700 dark:text-slate-200">
          {titleLabel}
        </span>
        <span className="min-w-0 flex-1 truncate text-slate-500" title={name}>
          {name}
        </span>
        <a
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-sky-600 hover:underline dark:text-sky-400"
        >
          {openInNewTabLabel}
        </a>
      </div>
      <div className="p-2">
        {kind === "image" ? (
          <img
            src={attachment.url}
            alt=""
            className="mx-auto max-h-[min(70vh,560px)] max-w-full object-contain"
          />
        ) : kind === "pdf" ? (
          <iframe
            title={name}
            src={attachment.url}
            className="h-[min(70vh,560px)] w-full rounded border border-slate-200 bg-white dark:border-slate-600"
          />
        ) : (
          <p className="py-4 text-center text-xs text-slate-500">
            <a
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-sky-600 hover:underline dark:text-sky-400"
            >
              {openInNewTabLabel}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
