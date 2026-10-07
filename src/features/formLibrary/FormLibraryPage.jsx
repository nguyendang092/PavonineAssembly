import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiDownload, FiFileText, FiSearch, FiTrash2, FiUpload } from "react-icons/fi";
import { useUserIdentity, useUserPermissions } from "@/contexts/UserContext";
import { canManageFormLibrary } from "@/config/featurePermissions";
import AlertMessage from "@/components/ui/AlertMessage";
import LoadingBlock from "@/components/ui/LoadingBlock";
import { useFormLibrary } from "./useFormLibrary";
import {
  FORM_LIBRARY_ALLOWED_EXTENSIONS,
  filterFormLibraryFiles,
  formatFormLibraryFileSize,
  formLibraryExtension,
  formLibraryKind,
} from "./formLibraryUtils";
import "./formLibrary.css";

const TYPE_FILTERS = [
  { id: "all", labelKey: "formLibrary.typeAll", fallback: "Tất cả" },
  { id: "pdf", labelKey: "formLibrary.typePdf", fallback: "PDF" },
  { id: "excel", labelKey: "formLibrary.typeExcel", fallback: "Excel" },
  { id: "word", labelKey: "formLibrary.typeWord", fallback: "Word" },
  { id: "ppt", labelKey: "formLibrary.typePpt", fallback: "PowerPoint" },
  { id: "image", labelKey: "formLibrary.typeImage", fallback: "Ảnh" },
  { id: "zip", labelKey: "formLibrary.typeZip", fallback: "ZIP" },
];

function formatUploadedAt(iso, locale) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale === "ko" ? "ko-KR" : "vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function FormLibraryPage() {
  const { t, i18n } = useTranslation();
  const { user } = useUserIdentity();
  const { userRole } = useUserPermissions();
  const canManage = canManageFormLibrary(user, userRole);
  const { files, loading, busy, uploadFile, deleteFile } = useFormLibrary({
    canManage,
  });
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [title, setTitle] = useState("");
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });
  const fileInputRef = useRef(null);

  const searched = useMemo(
    () => filterFormLibraryFiles(files, query),
    [files, query],
  );

  const visibleFiles = useMemo(() => {
    if (typeFilter === "all") return searched;
    return searched.filter(
      (item) => formLibraryKind(formLibraryExtension(item.fileName)) === typeFilter,
    );
  }, [searched, typeFilter]);

  const typeCount = useMemo(() => {
    const kinds = new Set(
      files.map((item) => formLibraryKind(formLibraryExtension(item.fileName))),
    );
    return kinds.size;
  }, [files]);

  const showAlert = (type, message) => {
    setAlert({ show: true, type, message });
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (event.target) event.target.value = "";
    if (!file || !canManage) return;
    try {
      await uploadFile(file, {
        title,
        uploadedBy: user?.email ?? "",
      });
      setTitle("");
      showAlert(
        "success",
        t("formLibrary.uploadSuccess", { defaultValue: "Đã tải form lên." }),
      );
    } catch {
      showAlert(
        "error",
        t("formLibrary.uploadError", {
          defaultValue:
            "Không tải được file. Chỉ nhận PDF/Office/ảnh/ZIP, tối đa 25MB.",
        }),
      );
    }
  };

  const handleDelete = async (item) => {
    const ok = window.confirm(
      t("formLibrary.deleteConfirm", {
        defaultValue: "Xóa form «{{name}}»?",
        name: item.title,
      }),
    );
    if (!ok) return;
    try {
      await deleteFile(item);
      showAlert(
        "success",
        t("formLibrary.deleteSuccess", { defaultValue: "Đã xóa form." }),
      );
    } catch {
      showAlert(
        "error",
        t("formLibrary.deleteError", { defaultValue: "Không xóa được form." }),
      );
    }
  };

  const emptyHint =
    files.length === 0
      ? t("formLibrary.empty", {
          defaultValue:
            "Chưa có biểu mẫu. Admin/HR tải file lên để toàn công ty sử dụng.",
        })
      : t("formLibrary.emptySearch", {
          defaultValue: "Không có biểu mẫu khớp bộ lọc hiện tại.",
        });

  return (
    <div className="form-library-page production-page-viewport">
      <AlertMessage
        alert={alert}
        autoHideMs={4000}
        onClose={() => setAlert((a) => ({ ...a, show: false }))}
      />

      <header className="form-library-hero">
        <div className="form-library-hero__copy">
          <p className="form-library-kicker">
            {t("formLibrary.kicker", { defaultValue: "Tài liệu nội bộ" })}
          </p>
          <h1 className="form-library-title">
            {t("formLibrary.title", { defaultValue: "Kho biểu mẫu" })}
          </h1>
          <p className="form-library-sub">
            {t("formLibrary.subtitle", {
              defaultValue:
                "Kho form chuẩn của công ty — tìm, tải về và in để sử dụng.",
            })}
          </p>
        </div>
        <dl className="form-library-kpis">
          <div className="form-library-kpi">
            <dt>{t("formLibrary.kpiFiles", { defaultValue: "Biểu mẫu" })}</dt>
            <dd>{files.length}</dd>
          </div>
          <div className="form-library-kpi">
            <dt>{t("formLibrary.kpiTypes", { defaultValue: "Loại file" })}</dt>
            <dd>{typeCount}</dd>
          </div>
        </dl>
      </header>

      <div
        className={`form-library-layout${
          canManage ? " form-library-layout--with-aside" : ""
        }`}
      >
        <section className="form-library-panel" aria-label={t("formLibrary.title")}>
          <div className="form-library-toolbar">
            <label className="form-library-search">
              <FiSearch aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(ev) => setQuery(ev.target.value)}
                placeholder={t("formLibrary.searchPlaceholder", {
                  defaultValue: "Tìm tên biểu mẫu, file hoặc người tải…",
                })}
              />
            </label>
            <div className="form-library-filters" role="tablist">
              {TYPE_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  role="tab"
                  aria-selected={typeFilter === filter.id}
                  className={`form-library-chip${
                    typeFilter === filter.id ? " is-active" : ""
                  }`}
                  onClick={() => setTypeFilter(filter.id)}
                >
                  {t(filter.labelKey, { defaultValue: filter.fallback })}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <LoadingBlock
              message={t("formLibrary.loading", {
                defaultValue: "Đang tải danh sách…",
              })}
            />
          ) : visibleFiles.length === 0 ? (
            <div className="form-library-empty">
              <FiFileText aria-hidden />
              <p>{emptyHint}</p>
            </div>
          ) : (
            <div className="form-library-table-wrap">
              <table className="form-library-table">
                <thead>
                  <tr>
                    <th>{t("formLibrary.colName", { defaultValue: "Biểu mẫu" })}</th>
                    <th>{t("formLibrary.colType", { defaultValue: "Loại" })}</th>
                    <th>{t("formLibrary.colSize", { defaultValue: "Dung lượng" })}</th>
                    <th>{t("formLibrary.colUpdated", { defaultValue: "Cập nhật" })}</th>
                    <th className="form-library-table__hide-sm">
                      {t("formLibrary.colBy", { defaultValue: "Người tải" })}
                    </th>
                    <th>{t("formLibrary.colActions", { defaultValue: "Thao tác" })}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleFiles.map((item) => {
                    const ext = formLibraryExtension(item.fileName) || "file";
                    const kind = formLibraryKind(ext);
                    return (
                      <tr key={item.id}>
                        <td>
                          <div className="form-library-doc">
                            <span
                              className={`form-library-ext form-library-ext--${kind}`}
                              aria-hidden
                            >
                              {ext.toUpperCase()}
                            </span>
                            <div>
                              <p className="form-library-doc__title">{item.title}</p>
                              <p className="form-library-doc__file">{item.fileName}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`form-library-kind form-library-kind--${kind}`}>
                            {ext.toUpperCase()}
                          </span>
                        </td>
                        <td>{formatFormLibraryFileSize(item.size)}</td>
                        <td>{formatUploadedAt(item.uploadedAt, i18n.language)}</td>
                        <td className="form-library-table__hide-sm">
                          {item.uploadedBy || "—"}
                        </td>
                        <td>
                          <div className="form-library-actions">
                            <a
                              className="form-library-btn form-library-btn--primary"
                              href={item.downloadUrl}
                              target="_blank"
                              rel="noreferrer"
                              download={item.fileName}
                            >
                              <FiDownload aria-hidden />
                              {t("formLibrary.download", { defaultValue: "Tải về" })}
                            </a>
                            {canManage ? (
                              <button
                                type="button"
                                className="form-library-btn form-library-btn--danger"
                                disabled={busy}
                                onClick={() => void handleDelete(item)}
                              >
                                <FiTrash2 aria-hidden />
                                {t("formLibrary.delete", { defaultValue: "Xóa" })}
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {canManage ? (
          <aside className="form-library-aside">
            <div className="form-library-upload-card">
              <h2>
                {t("formLibrary.uploadPanelTitle", {
                  defaultValue: "Thêm biểu mẫu",
                })}
              </h2>
              <p>
                {t("formLibrary.uploadPanelHint", {
                  defaultValue:
                    "Chỉ Admin/HR được đăng file chuẩn. Nhân viên vào trang này để tải về.",
                })}
              </p>
              <label className="form-library-field">
                <span>
                  {t("formLibrary.titleField", {
                    defaultValue: "Tên hiển thị",
                  })}
                </span>
                <input
                  value={title}
                  onChange={(ev) => setTitle(ev.target.value)}
                  placeholder={t("formLibrary.titlePlaceholder", {
                    defaultValue: "Ví dụ: Đơn xin nghỉ phép",
                  })}
                />
              </label>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                accept={FORM_LIBRARY_ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(
                  ",",
                )}
                onChange={(ev) => void handleUpload(ev)}
              />
              <button
                type="button"
                className="form-library-btn form-library-btn--solid"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                <FiUpload aria-hidden />
                {busy
                  ? t("formLibrary.uploading", { defaultValue: "Đang tải lên…" })
                  : t("formLibrary.upload", { defaultValue: "Chọn file để tải lên" })}
              </button>
              <p className="form-library-formats">
                {t("formLibrary.formatsHint", {
                  defaultValue: "PDF, Word, Excel, PowerPoint, ảnh, TXT, ZIP · tối đa 25MB",
                })}
              </p>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
