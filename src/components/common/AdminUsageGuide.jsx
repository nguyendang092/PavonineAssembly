import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import {
  db,
  getDownloadURL,
  onValue,
  ref,
  remove,
  set,
  storage,
  storageRef,
  uploadBytes,
} from "../../services/firebase";
import { useUser } from "../../contexts/UserContext";
import { routeConfig } from "../../config/menuConfig";
import "./AdminUsageGuide.css";

const ADMIN_EMAILS = ["admin@gmail.com", "hr@pavonine.net"];
const GUIDE_NODE = "usageGuides";

const Quill = ReactQuill.Quill;

const fontWhitelist = [
  "arial",
  "times-new-roman",
  "courier-new",
  "georgia",
  "tahoma",
  "verdana",
  "roboto",
];

const sizeWhitelist = ["12px", "14px", "16px", "18px", "24px", "32px"];

if (Quill) {
  const Font = Quill.import("formats/font");
  Font.whitelist = fontWhitelist;
  Quill.register(Font, true);

  const Size = Quill.import("attributors/style/size");
  Size.whitelist = sizeWhitelist;
  Quill.register(Size, true);
}

const toSafeKey = (value) =>
  (value || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[.#$\[\]/]/g, "-")
    .replace(/[^a-z0-9\-_]/g, "");

const buildDefaultGuide = (id, path = "") => ({
  id,
  menuName: id,
  path,
  featureDescription: "",
  usageGuide: "",
  notes: "",
  updatedAt: null,
  updatedBy: "",
});

const sanitizeRichText = (html = "") => {
  if (!html) return "";
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,iframe,object,embed").forEach((node) => {
    node.remove();
  });
  doc.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = (attr.value || "").trim().toLowerCase();
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
      }
      if (
        ["href", "src", "xlink:href"].includes(name) &&
        value.startsWith("javascript:")
      ) {
        el.removeAttribute(attr.name);
      }
    });
  });
  return doc.body.innerHTML;
};

const quillFormats = [
  "font",
  "size",
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "color",
  "background",
  "script",
  "list",
  "bullet",
  "indent",
  "align",
  "blockquote",
  "code-block",
  "link",
  "image",
  "video",
];

const createModules = (onImageUpload) => ({
  toolbar: {
    container: [
      [{ font: fontWhitelist }, { size: sizeWhitelist }],
      [{ header: [1, 2, 3, 4, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ color: [] }, { background: [] }],
      [{ script: "sub" }, { script: "super" }],
      [
        { list: "ordered" },
        { list: "bullet" },
        { indent: "-1" },
        { indent: "+1" },
      ],
      [{ align: [] }],
      ["blockquote", "code-block"],
      ["link", "image", "video"],
      ["clean"],
      ["undo", "redo"],
    ],
    handlers: {
      image: onImageUpload,
      undo: function undoHandler() {
        this.quill.history.undo();
      },
      redo: function redoHandler() {
        this.quill.history.redo();
      },
    },
  },
  history: {
    delay: 1000,
    maxStack: 100,
    userOnly: true,
  },
});

export default function AdminUsageGuide() {
  const { user } = useUser();
  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email);

  const [guidesMap, setGuidesMap] = useState({});
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState(buildDefaultGuide(""));
  const [newSectionName, setNewSectionName] = useState("");
  const [alert, setAlert] = useState({ type: "", message: "" });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("adminGuideDarkMode") === "true",
  );
  const [previewTab, setPreviewTab] = useState("feature");

  const featureEditorRef = useRef(null);
  const usageEditorRef = useRef(null);
  const notesEditorRef = useRef(null);
  const activeEditorRef = useRef(null);

  const routeSections = useMemo(() => {
    return routeConfig.map((route) => ({
      id: toSafeKey(route.element || route.path),
      menuName: route.element || route.path,
      path: route.path,
    }));
  }, []);

  useEffect(() => {
    const guidesRef = ref(db, GUIDE_NODE);
    const unsubscribe = onValue(guidesRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === "object") {
        setGuidesMap(data);
      } else {
        setGuidesMap({});
      }
    });
    return () => unsubscribe();
  }, []);

  const mergedSections = useMemo(() => {
    const routeMap = routeSections.reduce((acc, section) => {
      acc[section.id] = {
        ...buildDefaultGuide(section.id, section.path),
        menuName: section.menuName,
        path: section.path,
      };
      return acc;
    }, {});

    Object.entries(guidesMap).forEach(([id, guide]) => {
      routeMap[id] = {
        ...routeMap[id],
        ...guide,
        id,
      };
    });

    return Object.values(routeMap).sort((a, b) =>
      (a.menuName || "").localeCompare(b.menuName || "", "vi"),
    );
  }, [guidesMap, routeSections]);

  useEffect(() => {
    if (!mergedSections.length) {
      setSelectedId("");
      setDraft(buildDefaultGuide(""));
      return;
    }

    if (!selectedId || !mergedSections.some((item) => item.id === selectedId)) {
      const first = mergedSections[0];
      setSelectedId(first.id);
      setDraft({ ...first });
      return;
    }

    const current = mergedSections.find((item) => item.id === selectedId);
    if (current) {
      setDraft({ ...current });
    }
  }, [mergedSections, selectedId]);

  useEffect(() => {
    if (!alert.message) return;
    const timer = setTimeout(() => setAlert({ type: "", message: "" }), 3500);
    return () => clearTimeout(timer);
  }, [alert]);

  useEffect(() => {
    localStorage.setItem("adminGuideDarkMode", darkMode);
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  const handleSelectSection = (id) => {
    const section = mergedSections.find((item) => item.id === id);
    if (!section) return;
    setSelectedId(id);
    setDraft({ ...section });
  };

  const openImagePickerAndInsert = async () => {
    if (!isAdmin || uploadingImage || !activeEditorRef.current) return;

    const input = document.createElement("input");
    input.setAttribute("type", "file");
    input.setAttribute("accept", "image/*");

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const maxSize = 8 * 1024 * 1024;
      if (file.size > maxSize) {
        setAlert({
          type: "error",
          message: "Ảnh vượt quá 8MB. Vui lòng chọn ảnh nhẹ hơn.",
        });
        return;
      }

      try {
        setUploadingImage(true);
        const ext = file.name.split(".").pop() || "jpg";
        const fileName = `usage-guide/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${ext}`;
        const imageRef = storageRef(storage, fileName);
        await uploadBytes(imageRef, file);
        const imageUrl = await getDownloadURL(imageRef);

        const editor = activeEditorRef.current.getEditor();
        const range = editor.getSelection(true);
        const index = range ? range.index : editor.getLength();
        editor.insertEmbed(index, "image", imageUrl, "user");
        editor.setSelection(index + 1, 0);
      } catch (error) {
        setAlert({
          type: "error",
          message: `Không thể upload ảnh: ${error.message}`,
        });
      } finally {
        setUploadingImage(false);
      }
    };

    input.click();
  };

  const quillModules = useMemo(
    () => createModules(openImagePickerAndInsert),
    [uploadingImage, isAdmin],
  );

  const handleCreateSection = async () => {
    if (!isAdmin) return;

    const safeId = toSafeKey(newSectionName);
    if (!safeId) {
      setAlert({ type: "error", message: "Vui lòng nhập tên mục hợp lệ." });
      return;
    }

    if (guidesMap[safeId]) {
      setAlert({ type: "error", message: "Mục này đã tồn tại." });
      return;
    }

    const payload = {
      ...buildDefaultGuide(safeId),
      menuName: newSectionName.trim(),
      updatedAt: Date.now(),
      updatedBy: user?.email || "admin",
    };

    try {
      await set(ref(db, `${GUIDE_NODE}/${safeId}`), payload);
      setNewSectionName("");
      setSelectedId(safeId);
      setAlert({ type: "success", message: "Đã tạo mục hướng dẫn mới." });
    } catch (error) {
      setAlert({
        type: "error",
        message: `Không thể tạo mục mới: ${error.message}`,
      });
    }
  };

  const handleSave = async () => {
    if (!isAdmin || !draft.id) return;

    const payload = {
      ...draft,
      menuName: (draft.menuName || "").trim(),
      path: (draft.path || "").trim(),
      featureDescription: sanitizeRichText(draft.featureDescription || ""),
      usageGuide: sanitizeRichText(draft.usageGuide || ""),
      notes: sanitizeRichText(draft.notes || ""),
      updatedAt: Date.now(),
      updatedBy: user?.email || "admin",
    };

    if (!payload.menuName) {
      setAlert({ type: "error", message: "Tên mục không được để trống." });
      return;
    }

    try {
      await set(ref(db, `${GUIDE_NODE}/${draft.id}`), payload);
      setAlert({ type: "success", message: "Đã lưu hướng dẫn thành công." });
    } catch (error) {
      setAlert({
        type: "error",
        message: `Không thể lưu dữ liệu: ${error.message}`,
      });
    }
  };

  const handleDelete = async () => {
    if (!isAdmin || !draft.id) return;

    const shouldDelete = window.confirm(
      `Bạn có chắc chắn muốn xóa hướng dẫn cho mục "${draft.menuName}"?`,
    );
    if (!shouldDelete) return;

    try {
      await remove(ref(db, `${GUIDE_NODE}/${draft.id}`));
      setAlert({ type: "success", message: "Đã xóa hướng dẫn." });
    } catch (error) {
      setAlert({
        type: "error",
        message: `Không thể xóa dữ liệu: ${error.message}`,
      });
    }
  };

  if (!isAdmin) {
    return (
      <div
        className={`min-h-[calc(100vh-140px)] transition-colors duration-300 ${
          darkMode
            ? "bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900"
            : "bg-gradient-to-b from-blue-50 to-slate-100"
        } p-4 md:p-6`}
      >
        <div className="mx-auto max-w-2xl">
          <div
            className={`flex flex-col gap-4 rounded-2xl p-6 shadow-lg transition-colors duration-200 md:p-8 ${
              darkMode
                ? "border border-slate-700 bg-slate-800 shadow-xl shadow-black/50"
                : "bg-white"
            }`}
          >
            <h1
              className={`text-2xl font-bold transition-colors duration-200 ${
                darkMode ? "text-white" : "text-slate-800"
              }`}
            >
              ⛔ Quản lý Hướng dẫn
            </h1>
            <div
              className={`rounded-xl border-2 px-4 py-3 transition-colors duration-200 ${
                darkMode
                  ? "border-red-900 bg-red-950 text-red-200"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              <p className="font-semibold">
                Bạn không có quyền truy cập tính năng này.
              </p>
              <p className="mt-1 text-sm">
                Chỉ Admin và HR mới có thể quản lý hướng dẫn sử dụng.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-[calc(100vh-140px)] transition-colors duration-300 ${
        darkMode
          ? "bg-gradient-to-br from-slate-950 via-blue-950 to-purple-950"
          : "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50"
      } p-4 md:p-6`}
      style={
        !darkMode
          ? {
              backgroundImage:
                "linear-gradient(135deg, #eff6ff 0%, #eef2ff 50%, #f3e8ff 100%)",
            }
          : {}
      }
    >
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1
              className={`text-2xl font-bold transition-colors duration-200 md:text-3xl ${
                darkMode ? "text-white" : "text-slate-800"
              }`}
            >
              📝 Quản lý Hướng dẫn
            </h1>
            <p
              className={`mt-1 text-sm transition-colors duration-200 ${
                darkMode ? "text-slate-400" : "text-slate-600"
              }`}
            >
              Viết & quản lý chi tiết tính năng cho từng mục
            </p>
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`rounded-full p-3 transition-all duration-200 hover:scale-110 ${
              darkMode
                ? "bg-slate-700 text-yellow-400 hover:bg-slate-600"
                : "bg-slate-200 text-slate-700 hover:bg-slate-300"
            }`}
            title="Chuyển đổi chế độ tối"
          >
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>

        {/* Alerts */}
        {alert.message && (
          <div
            className={`mb-4 animate-slideDown rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all duration-300 ${
              alert.type === "success"
                ? darkMode
                  ? "border-emerald-900 bg-emerald-950 text-emerald-200"
                  : "border-emerald-300 bg-emerald-50 text-emerald-700"
                : darkMode
                  ? "border-rose-900 bg-rose-950 text-rose-200"
                  : "border-rose-300 bg-rose-50 text-rose-700"
            }`}
          >
            {alert.type === "success" ? "✅" : "⚠️"} {alert.message}
          </div>
        )}

        {uploadingImage && (
          <div
            className={`mb-4 animate-pulse rounded-xl border-2 px-4 py-2 text-sm transition-colors duration-200 ${
              darkMode
                ? "border-blue-900 bg-blue-950 text-blue-200"
                : "border-blue-200 bg-blue-50 text-blue-700"
            }`}
          >
            ⏳ Đang upload ảnh...
          </div>
        )}

        {/* Main Layout */}
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          {/* Sidebar */}
          <aside
            className={`space-y-3 rounded-2xl p-4 transition-colors duration-200 ${
              darkMode
                ? "bg-slate-800/50 backdrop-blur-sm"
                : "bg-white/50 backdrop-blur-sm shadow-lg"
            } lg:max-h-[70vh] lg:overflow-y-auto`}
          >
            {/* Create Section */}
            <div
              className={`rounded-xl p-3 transition-colors duration-200 ${
                darkMode ? "bg-slate-700" : "bg-slate-100"
              }`}
            >
              <label
                className={`mb-2 block text-xs font-semibold uppercase tracking-wide transition-colors duration-200 ${
                  darkMode ? "text-slate-300" : "text-slate-600"
                }`}
              >
                ➕ Mục mới
              </label>
              <div className="space-y-2">
                <input
                  type="text"
                  className={`w-full rounded-lg border-2 px-3 py-2 text-sm outline-none transition-all duration-200 ${
                    darkMode
                      ? "border-slate-600 bg-slate-600 text-white placeholder-slate-400 focus:border-blue-500"
                      : "border-slate-300 bg-white text-slate-900 placeholder-slate-500 focus:border-blue-500"
                  }`}
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  placeholder="VD: Tạo QR..."
                />
                <button
                  type="button"
                  className={`w-full rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200 ${
                    darkMode
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                  onClick={handleCreateSection}
                >
                  Thêm mục
                </button>
              </div>
            </div>

            {/* Section List */}
            <h3
              className={`px-2 font-semibold transition-colors duration-200 ${
                darkMode ? "text-slate-200" : "text-slate-700"
              }`}
            >
              Danh sách ({mergedSections.length})
            </h3>
            <div className="space-y-2">
              {mergedSections.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    handleSelectSection(item.id);
                    setPreviewTab("feature");
                  }}
                  className={`w-full overflow-hidden rounded-lg border-2 px-3 py-2 text-left text-sm transition-all duration-200 ${
                    item.id === selectedId
                      ? darkMode
                        ? "border-blue-500 bg-blue-950 shadow-lg shadow-blue-500/20"
                        : "border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/20"
                      : darkMode
                        ? "border-slate-600 bg-slate-700 hover:border-blue-400 hover:shadow-md"
                        : "border-slate-200 bg-white hover:border-blue-300 hover:shadow-md"
                  }`}
                >
                  <div
                    className={`font-semibold transition-colors duration-200 ${
                      darkMode ? "text-white" : "text-slate-800"
                    }`}
                  >
                    {item.menuName}
                  </div>
                  {item.path && (
                    <div
                      className={`truncate text-xs transition-colors duration-200 ${
                        darkMode ? "text-slate-400" : "text-slate-500"
                      }`}
                    >
                      {item.path}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </aside>

          {/* Main Editor */}
          <section
            className={`rounded-2xl p-4 transition-colors duration-200 md:p-6 ${
              darkMode
                ? "border border-slate-700 bg-slate-800/50 shadow-2xl shadow-black/50 backdrop-blur-sm"
                : "bg-white shadow-2xl"
            }`}
          >
            {draft.id ? (
              <div className="space-y-5">
                {/* Meta Info & Buttons */}
                <div className="space-y-3 border-b border-slate-300 pb-5 dark:border-slate-600">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label
                        className={`mb-1 block text-sm font-semibold transition-colors duration-200 ${
                          darkMode ? "text-slate-200" : "text-slate-700"
                        }`}
                      >
                        Tên mục
                      </label>
                      <input
                        type="text"
                        value={draft.menuName || ""}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            menuName: e.target.value,
                          }))
                        }
                        className={`w-full rounded-lg border-2 px-3 py-2 text-sm outline-none transition-all duration-200 ${
                          darkMode
                            ? "border-slate-600 bg-slate-700 text-white placeholder-slate-400 focus:border-blue-500"
                            : "border-slate-300 bg-white text-slate-900 placeholder-slate-500 focus:border-blue-500"
                        }`}
                      />
                    </div>
                    <div>
                      <label
                        className={`mb-1 block text-sm font-semibold transition-colors duration-200 ${
                          darkMode ? "text-slate-200" : "text-slate-700"
                        }`}
                      >
                        Đường dẫn
                      </label>
                      <input
                        type="text"
                        value={draft.path || ""}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            path: e.target.value,
                          }))
                        }
                        className={`w-full rounded-lg border-2 px-3 py-2 text-sm outline-none transition-all duration-200 ${
                          darkMode
                            ? "border-slate-600 bg-slate-700 text-white placeholder-slate-400 focus:border-blue-500"
                            : "border-slate-300 bg-white text-slate-900 placeholder-slate-500 focus:border-blue-500"
                        }`}
                        placeholder="/attendance-list"
                      />
                    </div>
                  </div>

                  <div
                    className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors duration-200 ${
                      darkMode
                        ? "bg-slate-700 text-slate-300"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    ✏️ {draft.updatedBy || "Chưa có"} |{" "}
                    {draft.updatedAt
                      ? new Date(draft.updatedAt).toLocaleString("vi-VN")
                      : "Chưa cập nhật"}
                  </div>
                </div>

                {/* Tabs for different sections */}
                <div className="space-y-4">
                  {[
                    {
                      id: "feature",
                      label: "⚙️ Chức năng",
                      field: "featureDescription",
                    },
                    { id: "usage", label: "📝 Hướng dẫn", field: "usageGuide" },
                    { id: "notes", label: "⚠️ Lưu ý", field: "notes" },
                  ].map((section) => (
                    <div key={section.id} className="space-y-2">
                      <label
                        className={`block text-sm font-semibold transition-colors duration-200 ${
                          darkMode ? "text-slate-200" : "text-slate-700"
                        }`}
                      >
                        {section.label}
                      </label>

                      <ReactQuill
                        ref={
                          section.id === "feature"
                            ? featureEditorRef
                            : section.id === "usage"
                              ? usageEditorRef
                              : notesEditorRef
                        }
                        value={draft[section.field] || ""}
                        onFocus={() => {
                          activeEditorRef.current =
                            section.id === "feature"
                              ? featureEditorRef.current
                              : section.id === "usage"
                                ? usageEditorRef.current
                                : notesEditorRef.current;
                        }}
                        onChange={(value) =>
                          setDraft((prev) => ({
                            ...prev,
                            [section.field]: value,
                          }))
                        }
                        modules={quillModules}
                        formats={quillFormats}
                        theme="snow"
                      />

                      <details className="group">
                        <summary
                          className={`cursor-pointer select-none rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200 ${
                            darkMode
                              ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          👁️ Xem trước
                        </summary>
                        <div
                          className={`guide-preview mt-2 rounded-lg border-2 p-4 transition-colors duration-200 ${
                            darkMode
                              ? "border-slate-600 bg-slate-700 text-slate-100"
                              : "border-slate-200 bg-slate-50 text-slate-900"
                          }`}
                          dangerouslySetInnerHTML={{
                            __html: sanitizeRichText(
                              draft[section.field] || "",
                            ),
                          }}
                        />
                      </details>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 border-t border-slate-300 pt-5 dark:border-slate-600">
                  <button
                    type="button"
                    className={`rounded-lg px-4 py-2 font-semibold transition-all duration-200 ${
                      darkMode
                        ? "bg-emerald-700 text-white hover:bg-emerald-600 hover:shadow-lg hover:shadow-emerald-500/50"
                        : "bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-500/30"
                    }`}
                    onClick={handleSave}
                  >
                    💾 Lưu
                  </button>
                  <button
                    type="button"
                    className={`rounded-lg px-4 py-2 font-semibold transition-all duration-200 ${
                      darkMode
                        ? "bg-rose-700 text-white hover:bg-rose-600 hover:shadow-lg hover:shadow-rose-500/50"
                        : "bg-rose-600 text-white hover:bg-rose-700 hover:shadow-lg hover:shadow-rose-500/30"
                    }`}
                    onClick={handleDelete}
                  >
                    🗑️ Xóa
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={`flex h-96 flex-col items-center justify-center rounded-xl border-2 border-dashed transition-colors duration-200 ${
                  darkMode
                    ? "border-slate-600 text-slate-400"
                    : "border-slate-300 text-slate-500"
                }`}
              >
                <div className="text-5xl">📋</div>
                <p
                  className={`mt-2 font-semibold transition-colors duration-200 ${
                    darkMode ? "text-slate-300" : "text-slate-600"
                  }`}
                >
                  Chọn mục từ danh sách
                </p>
                <p
                  className={`text-sm transition-colors duration-200 ${
                    darkMode ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  hoặc tạo mục mới bên trái
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
