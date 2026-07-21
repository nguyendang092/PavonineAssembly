import React, { useCallback, useId, useRef, useState } from "react";
import { uploadImageToImgbb } from "@/services/imgbbUpload";

const labelClass =
  "mb-0 block text-[11px] font-bold uppercase tracking-wide text-purple-600 dark:text-purple-400";

/**
 * Upload ảnh → ImgBB → gán URL vào form điểm danh.
 */
export default function AttendanceFormImageUploadField({
  label,
  value = "",
  onChange,
  disabled = false,
  uploadNamePrefix = "attendance",
  hideLabel = false,
  hidePreview = false,
  hideEmptyHint = false,
  compact = false,
  className = "",
  tl,
}) {
  const inputId = useId();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const url = String(value ?? "").trim();

  const openPicker = useCallback(() => {
    if (disabled || uploading) return;
    fileRef.current?.click();
  }, [disabled, uploading]);

  const handleFileChange = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;

      setError("");
      setUploading(true);
      try {
        const stamp = Date.now();
        const safePrefix = String(uploadNamePrefix || "attendance").replace(
          /[^\w-]+/g,
          "_",
        );
        const { url: uploadedUrl } = await uploadImageToImgbb(file, {
          name: `${safePrefix}_${stamp}`,
        });
        onChange?.(uploadedUrl);
      } catch (err) {
        const code = String(err?.message ?? "");
        if (code === "MISSING_IMGBB_API_KEY") {
          setError(
            tl(
              "imgbbMissingApiKey",
              "Server chưa cấu hình ImgBB — thêm IMGBB_API_KEY vào file .env rồi restart dev.",
            ),
          );
        } else if (code === "UPLOAD_SERVER_UNAVAILABLE") {
          setError(
            tl(
              "imgbbServerUnavailable",
              "Không kết nối được server upload — chạy npm run dev (hoặc npm run server khi preview).",
            ),
          );
        } else if (code === "INVALID_IMAGE_TYPE") {
          setError(
            tl(
              "imgbbInvalidImageType",
              "Chỉ chấp nhận PNG, JPG, GIF, WebP.",
            ),
          );
        } else if (code === "IMAGE_TOO_LARGE") {
          setError(
            tl("imgbbImageTooLarge", "Ảnh tối đa 32 MB."),
          );
        } else {
          setError(
            tl(
              "imgbbUploadFailed",
              "Upload ảnh thất bại: {{error}}",
              { error: code || "unknown" },
            ),
          );
        }
      } finally {
        setUploading(false);
      }
    },
    [onChange, tl, uploadNamePrefix],
  );

  const handleClear = useCallback(() => {
    if (disabled || uploading) return;
    setError("");
    onChange?.("");
  }, [disabled, onChange, uploading]);

  return (
    <div className={`min-w-0${className ? ` ${className}` : ""}`}>
      {!hideLabel && label ? (
        <label htmlFor={inputId} className={labelClass}>
          {label}
        </label>
      ) : null}
      <div
        className={
          compact
            ? "flex min-w-0 flex-wrap items-center gap-0.5"
            : "flex min-h-9 flex-col gap-1 rounded-lg border-2 border-blue-200 bg-white px-2 py-1.5 dark:border-blue-800 dark:bg-slate-950"
        }
      >
        <div
          className={
            compact
              ? "flex min-w-0 flex-wrap items-center gap-0.5"
              : "flex min-w-0 flex-wrap items-center gap-1.5"
          }
        >
          <input
            ref={fileRef}
            id={inputId}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
            className="hidden"
            disabled={disabled || uploading}
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={openPicker}
            disabled={disabled || uploading}
            className={
              compact
                ? "shrink-0 rounded border border-indigo-200 bg-indigo-50 px-1 py-0 text-[9px] font-bold leading-tight text-indigo-800 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200 dark:hover:bg-indigo-900/60"
                : "shrink-0 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-800 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200 dark:hover:bg-indigo-900/60"
            }
          >
            {uploading
              ? tl("imgbbUploading", "Đang tải…")
              : tl("imgbbChooseImage", "Chọn ảnh")}
          </button>
          {url ? (
            <>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={
                  compact
                    ? "shrink-0 text-[9px] font-bold leading-tight text-blue-700 underline dark:text-blue-300"
                    : "min-w-0 flex-1 truncate text-[10px] font-semibold text-blue-700 underline dark:text-blue-300"
                }
                title={url}
              >
                {tl("imgbbViewImage", "Xem ảnh")}
              </a>
              <button
                type="button"
                onClick={handleClear}
                disabled={disabled || uploading}
                className={
                  compact
                    ? "shrink-0 rounded border border-slate-300 bg-slate-100 px-1 py-0 text-[9px] font-bold leading-tight text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                    : "shrink-0 rounded-md border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                }
              >
                {tl("imgbbRemoveImage", "Xóa")}
              </button>
            </>
          ) : hideEmptyHint ? null : (
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
              {tl("imgbbNoImage", "Chưa có ảnh")}
            </span>
          )}
        </div>
        {!hidePreview && url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded border border-slate-200 dark:border-slate-700"
          >
            <img
              src={url}
              alt=""
              className="max-h-20 w-full object-contain bg-slate-50 dark:bg-slate-900"
            />
          </a>
        ) : null}
        {error ? (
          <p
            className={
              compact
                ? "w-full basis-full text-[9px] font-semibold leading-tight text-red-600 dark:text-red-400"
                : "text-[10px] font-semibold leading-tight text-red-600 dark:text-red-400"
            }
          >
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
