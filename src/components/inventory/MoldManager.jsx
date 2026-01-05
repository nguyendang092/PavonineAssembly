import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useUser } from "../../contexts/UserContext";

// Tự động tắt thông báo sau 3s
// (đặt sau khai báo state trong component MoldManager)
import { db, ref, set, onValue } from "../../services/firebase";
import { push, remove, update } from "firebase/database";
import * as XLSX from "xlsx";
import Sidebar from "../layout/Sidebar";

// Map hiển thị <-> key lưu Firebase
const toSafeKey = (col) => col.replace(/[^a-zA-Z0-9_]/g, "_");
const fromSafeKey = (key, columns) => {
  if (!Array.isArray(columns)) return key;
  const map = {};
  columns.forEach((c) => {
    map[toSafeKey(c)] = c;
  });
  return map[key] || key;
};

function MoldManager() {
  const { t } = useTranslation();
  const { user } = useUser();

  // Helper function để tạo đường dẫn hình ảnh từ thư mục local
  // Chỉ hỗ trợ local path: /picture/molds/
  const getImagePath = (cellValue, moldId, columnType) => {
    if (!cellValue || !cellValue.trim()) {
      return null;
    }
    if (cellValue.startsWith("/")) {
      return cellValue;
    }
    return `/picture/molds/${cellValue}`;
  };

  // Sidebar menu mẫu
  const sidebarItems = [
    { label: t("moldManager.dashboard"), icon: "🏠" },
    { label: t("moldManager.moldList"), icon: "🗂️" },
    { label: t("moldManager.statistics"), icon: "📊" },
    { label: t("moldManager.settings"), icon: "⚙️" },
  ];

  // Tính tháng trước để hiển thị trong tên cột
  const getPrevMonthLabel = () => {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth(); // 0-11
    if (month === 0) {
      year -= 1;
      month = 11; // December
    } else {
      month -= 1;
    }
    const mm = String(month + 1).padStart(2, "0");
    return `Prev ${mm} Shots`;
  };

  // Map tên cột sang key i18n
  const getColumnTranslationKey = (col) => {
    const map = {
      No: "no",
      Subsidiary: "subsidiary",
      Model: "model",
      "Production Name": "productionName",
      "Mold Code": "moldCode",
      "Asset No.": "assetNo",
      "Mold Size (W*D*H)": "moldSize",
      "Tooling Weight": "toolingWeight",
      Date: "date",
      "Date Received": "dateReceived",
      "Date Released": "dateReleased",
      Location: "location",
      Type: "type",
      "Pavonine Model": "pavonineModel",
      "Shot Counter": "shotCounter",
      "Molds per Product": "moldsPerProduct",
      Warehouse: "warehouse",
      Vendor: "vendor",
      NamePlate: "namePlate",
      Notes: "notes",
      "PM Image": "pmImage",
      Process: "process",
    };

    // Kiểm tra nếu là cột Prev Shots (động)
    if (col.startsWith("Prev ") && col.includes("Shots")) {
      return "prevShots";
    }

    return map[col] || col;
  };

  // Hàm lấy tên cột đã dịch
  const getTranslatedColumn = (col) => {
    const key = getColumnTranslationKey(col);
    if (key === "prevShots") {
      // Lấy tháng từ label gốc
      const month = col.match(/\d+/)?.[0] || "";
      return `${t("moldManager.columns.prevShots")} (${month})`;
    }

    // Nếu key không có trong map, trả về tên cột gốc
    if (key === col) {
      return col;
    }

    // Kiểm tra xem key có tồn tại trong translation không
    const translationKey = `moldManager.columns.${key}`;
    const translated = t(translationKey);

    // Nếu không tìm thấy translation (trả về key), dùng tên cột gốc
    if (translated === translationKey) {
      return col;
    }

    return translated;
  };

  // Các cột hiển thị (giữ nguyên key tiếng Anh để xử lý dữ liệu)
  const columns = [
    "No",
    "Subsidiary",
    "Model",
    "Production Name",
    "Mold Code",
    "Asset No.",
    "Mold Size (W*D*H)",
    "Tooling Weight",
    "Date",
    "Date Received",
    "Date Released",
    "Location",
    "Type",
    "Pavonine Model",
    "Shot Counter",
    "Molds per Product",
    "Vendor",
    "NamePlate",
    "Process",
    "Notes",
    "PM Image",
  ];

  // Object mẫu cho form
  const emptyForm = columns.reduce((acc, col) => {
    acc[col] = "";
    return acc;
  }, {});

  // Filters & search
  const [searchTerm, setSearchTerm] = useState("");
  const [subsidiaryFilter, setSubsidiaryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState({ show: false, id: null });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Data & form state
  const [molds, setMolds] = useState([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [editing, setEditing] = useState(null);

  // Alerts
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });

  // Image zoom modal
  const [imageZoom, setImageZoom] = useState({ show: false, src: "", alt: "" });
  // Track failed images to avoid re-rendering issues
  const [failedImages, setFailedImages] = useState(new Set());
  // File upload refs for image columns
  const fileInputRefs = {
    NamePlate: React.useRef(null),
    "PM Image": React.useRef(null),
    Process: React.useRef(null),
  };
  // Detail modal state
  const [detailModal, setDetailModal] = useState({ show: false, mold: null });
  // PM detail modal state
  const [pmDetailModal, setPmDetailModal] = useState({
    show: false,
    mold: null,
  });

  // Dynamic filter dropdown configs
  const filterConfigs = useMemo(
    () => [
      {
        key: "subsidiary",
        labelKey: "moldManager.columns.subsidiary",
        value: subsidiaryFilter,
        setValue: setSubsidiaryFilter,
        getOptions: () =>
          Array.from(
            new Set(
              molds
                .map((m) => m["Subsidiary"])
                .filter((v) => v !== undefined && v !== "")
            )
          ).sort(),
      },
      {
        key: "type",
        labelKey: "moldManager.columns.type",
        value: typeFilter,
        setValue: setTypeFilter,
        getOptions: () =>
          Array.from(
            new Set(
              molds
                .map((m) => m["Type"])
                .filter((v) => v !== undefined && v !== "")
            )
          ).sort(),
      },
      {
        key: "location",
        labelKey: "moldManager.columns.location",
        value: locationFilter,
        setValue: setLocationFilter,
        getOptions: () =>
          Array.from(
            new Set(
              molds
                .map((m) => m["Location"])
                .filter((v) => v !== undefined && v !== "")
            )
          ).sort(),
      },
      {
        key: "vendor",
        labelKey: "moldManager.columns.vendor",
        value: vendorFilter,
        setValue: setVendorFilter,
        getOptions: () =>
          Array.from(
            new Set(
              molds
                .map((m) => m["Vendor"])
                .filter((v) => v !== undefined && v !== "")
            )
          ).sort(),
      },
    ],
    [molds, subsidiaryFilter, typeFilter, locationFilter, vendorFilter]
  );

  // Handle file upload for images
  const handleImageUpload = (columnName, file) => {
    if (!file) return;

    // Kiểm tra file type
    const validTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/webp",
    ];
    if (!validTypes.includes(file.type)) {
      setAlert({
        show: true,
        type: "error",
        message: "Chỉ chấp nhận file hình ảnh (PNG, JPG, GIF, WebP)!",
      });
      return;
    }

    // Tạo tên file dựa trên Mold Code
    const moldCode = form["Mold Code"] || `mold_${Date.now()}`;
    const fileExt = file.name.split(".").pop();
    let columnType = "process";
    if (columnName === "NamePlate") columnType = "nameplate";
    else if (columnName === "PM Image") columnType = "pm";
    const newFileName = `${moldCode}_${columnType}.${fileExt}`;

    // Tạo preview URL
    const previewURL = URL.createObjectURL(file);

    // Cập nhật form với tên file mới
    setForm((prev) => ({
      ...prev,
      [columnName]: newFileName,
    }));

    // Thông báo người dùng cần copy file vào public/picture/molds/
    setAlert({
      show: true,
      type: "success",
      message: `Đã chọn hình! Vui lòng copy file vào: public/picture/molds/${newFileName}`,
    });

    // TODO: Trong production, bạn có thể dùng API để upload file tự động
    console.log("File cần copy:", {
      originalName: file.name,
      newName: newFileName,
      destination: `public/picture/molds/${newFileName}`,
      preview: previewURL,
    });
  };

  // Tự động tắt thông báo sau 3s
  useEffect(() => {
    if (alert.show) {
      const timer = setTimeout(() => {
        setAlert((a) => ({ ...a, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show]);

  // Load dữ liệu từ Firebase (chuyển key về columns chuẩn)
  useEffect(() => {
    const moldsRef = ref(db, "molds");
    const unsubscribe = onValue(moldsRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === "object") {
        const arr = Object.entries(data).map(([id, mold]) => {
          const obj = { id };
          // Map stored keys to display columns
          Object.keys(mold).forEach((k) => {
            obj[fromSafeKey(k, columns)] = mold[k];
          });

          // Compute previous month key like '2025-09'
          const now = new Date();
          // Xử lý đúng trường hợp tháng 1 (getMonth() = 0)
          let year = now.getFullYear();
          let month = now.getMonth(); // 0-11
          if (month === 0) {
            year -= 1;
            month = 11; // December
          } else {
            month -= 1;
          }
          const yyyy = year;
          const mm = String(month + 1).padStart(2, "0");
          const prevKey = `${yyyy}-${mm}`;

          // Try several common shapes for previous-month shots
          let prevShots = "";
          if (mold.monthlyShots && typeof mold.monthlyShots === "object") {
            // monthlyShots: { 'YYYY-MM': number }
            prevShots = mold.monthlyShots[prevKey] ?? "";
          }
          // fallback variants
          if (!prevShots && (mold.prev_month_shots || mold.prevMonthShots)) {
            prevShots = mold.prev_month_shots ?? mold.prevMonthShots ?? "";
          }
          // set into object for column rendering
          obj[getPrevMonthLabel()] = prevShots;
          return obj;
        });
        arr.sort((a, b) => a.No - b.No);
        setMolds(arr);
      } else {
        setMolds([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Chuẩn hóa mold: chuyển key về safeKey khi lưu
  const normalizeMold = (obj, id, no) => {
    const result = { id, No: no };
    columns.forEach((col) => {
      if (col === "No") return;
      result[toSafeKey(col)] = obj[col] ?? "";
    });
    return result;
  };

  // Xử lý input
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Thêm mới hoặc cập nhật mold
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Kiểm tra đăng nhập
    if (!user) {
      setAlert({
        show: true,
        type: "error",
        message:
          t("moldManager.loginRequired") ||
          "Vui lòng đăng nhập để thực hiện thao tác này",
      });
      return;
    }

    try {
      if (editing !== null) {
        // Cập nhật mold - kiểm tra trùng với các mold khác (không phải chính nó)
        const moldCode = form["Mold Code"]?.trim();
        if (moldCode) {
          const duplicate = molds.find(
            (m) => m.id !== editing && m["Mold Code"]?.trim() === moldCode
          );
          if (duplicate) {
            setAlert({
              show: true,
              type: "error",
              message: t("moldManager.duplicateMoldCode", { code: moldCode }),
            });
            return;
          }
        }
        const moldRef = ref(db, `molds/${editing}`);
        await set(moldRef, normalizeMold(form, editing, form.No));
        setEditing(null);
        setAlert({
          show: true,
          type: "success",
          message: t("moldManager.updateSuccess"),
        });
      } else {
        // Thêm mold mới - kiểm tra trùng Mold Code
        const moldCode = form["Mold Code"]?.trim();
        if (moldCode) {
          const duplicate = molds.find(
            (m) => m["Mold Code"]?.trim() === moldCode
          );
          if (duplicate) {
            setAlert({
              show: true,
              type: "error",
              message: t("moldManager.duplicateMoldCode", { code: moldCode }),
            });
            return;
          }
        }
        const newRef = push(ref(db, "molds"));
        const newNo = molds.length + 1;
        await set(newRef, normalizeMold(form, newRef.key, newNo));
        setAlert({
          show: true,
          type: "success",
          message: t("moldManager.addSuccess"),
        });
      }
      setForm({ ...emptyForm });
      setShowModal(false);
    } catch (err) {
      setAlert({
        show: true,
        type: "error",
        message: t("moldManager.errorOccurred"),
      });
      setShowModal(false);
    }
  };

  // Bật modal edit
  const handleEdit = (id) => {
    // Kiểm tra đăng nhập
    if (!user) {
      setAlert({
        show: true,
        type: "error",
        message:
          t("moldManager.loginRequired") ||
          "Vui lòng đăng nhập để thực hiện thao tác này",
      });
      return;
    }

    const mold = molds.find((m) => m.id === id);
    setForm({ ...emptyForm, ...mold });
    setEditing(id);
    setShowModal(true);
  };

  // Xóa mold và đánh lại No
  const handleDelete = async (id) => {
    // Kiểm tra đăng nhập
    if (!user) {
      setAlert({
        show: true,
        type: "error",
        message:
          t("moldManager.loginRequired") ||
          "Vui lòng đăng nhập để thực hiện thao tác này",
      });
      setConfirmDelete({ show: false, id: null });
      return;
    }

    // Đóng modal trước
    setConfirmDelete({ show: false, id: null });

    try {
      await remove(ref(db, `molds/${id}`));
      // Sau khi xóa, cập nhật lại No cho danh sách
      const newMolds = molds.filter((m) => m.id !== id);
      for (let i = 0; i < newMolds.length; i++) {
        await update(ref(db, `molds/${newMolds[i].id}`), { No: i + 1 });
      }
      setAlert({
        show: true,
        type: "success",
        message: t("moldManager.deleteSuccess"),
      });
    } catch (err) {
      setAlert({
        show: true,
        type: "error",
        message: t("moldManager.deleteFail"),
      });
    }
  };

  const handleAddNew = () => {
    // Kiểm tra đăng nhập
    if (!user) {
      setAlert({
        show: true,
        type: "error",
        message:
          t("moldManager.loginRequired") ||
          "Vui lòng đăng nhập để thực hiện thao tác này",
      });
      return;
    }

    setForm({ ...emptyForm });
    setEditing(null);
    setShowModal(true);
  };

  // Open detail modal
  const handleViewDetail = (mold) => {
    setDetailModal({ show: true, mold });
  };
  const closeDetailModal = () => setDetailModal({ show: false, mold: null });
  // PM detail modal handler
  const handleViewPmDetail = (mold) => {
    setPmDetailModal({ show: true, mold });
  };
  const closePmDetailModal = () =>
    setPmDetailModal({ show: false, mold: null });

  // Filtered molds by search term and dropdown filters
  const filteredMolds = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return molds.filter((m) => {
      // Dropdown filters
      if (subsidiaryFilter && m["Subsidiary"] !== subsidiaryFilter)
        return false;
      if (typeFilter && m["Type"] !== typeFilter) return false;
      if (locationFilter && m["Location"] !== locationFilter) return false;
      if (vendorFilter && m["Vendor"] !== vendorFilter) return false;
      // Search
      if (!q) return true;
      return columns.some((col) => `${m[col] ?? ""}`.toLowerCase().includes(q));
    });
  }, [
    searchTerm,
    molds,
    subsidiaryFilter,
    typeFilter,
    locationFilter,
    vendorFilter,
  ]);

  // Format number with comma separator
  const formatNumber = (value) => {
    if (!value) return "";
    const num = parseInt(value, 10);
    if (isNaN(num)) return value;
    return num.toLocaleString("en-US");
  };

  // Highlight matched text in table cells
  const highlightText = (value, col) => {
    const text = `${value ?? ""}`;
    // Format numbers for Shot Counter and Prev Shots columns
    let displayText = text;
    if (
      col === "Shot Counter" ||
      (col.startsWith("Prev ") && col.includes("Shots"))
    ) {
      displayText = formatNumber(text) || text;
    }

    const q = searchTerm.trim();
    if (!q) return displayText;
    const lower = displayText.toLowerCase();
    const qLower = q.toLowerCase();
    const parts = [];
    let start = 0;
    let idx = lower.indexOf(qLower, start);
    let key = 0;
    while (idx !== -1) {
      if (idx > start) parts.push(displayText.slice(start, idx));
      parts.push(
        <span key={`hl-${key++}`} className="bg-yellow-200 rounded px-0.5">
          {displayText.slice(idx, idx + q.length)}
        </span>
      );
      start = idx + q.length;
      idx = lower.indexOf(qLower, start);
    }
    if (start < displayText.length) parts.push(displayText.slice(start));
    return <>{parts}</>;
  };

  // Export current filtered table to Excel with translated headers
  const handleExportExcel = () => {
    try {
      const dataRows = filteredMolds.map((m) => {
        const row = {};
        columns.forEach((col) => {
          row[getTranslatedColumn(col)] = m[col] ?? "";
        });
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(dataRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Molds");
      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `molds_${dateStr}.xlsx`);
      setAlert({
        show: true,
        type: "success",
        message: t("moldManager.exportExcel") + " ✅",
      });
    } catch (err) {
      setAlert({
        show: true,
        type: "error",
        message: t("moldManager.errorOccurred"),
      });
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col md:flex-row"
      style={{ backgroundColor: "#eef4ff" }}
    >
      {/* Sidebar toggle button (always visible, top left) */}
      <button
        className="fixed top-20 left-4 z-50 w-12 h-12 flex items-center justify-center bg-black text-white rounded-full shadow-lg hover:bg-gray-900 transition md:top-20 md:left-4"
        style={{ display: "block" }}
        onClick={() => setSidebarOpen((open) => !open)}
        aria-label={
          sidebarOpen ? t("moldManager.close") : t("moldManager.dashboard")
        }
      >
        {sidebarOpen ? "✕" : "☰"}
      </button>

      {/* Sidebar - always fixed for all screen sizes */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        aria-label="Sidebar"
      >
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-white">
            📋 {t("moldManager.title")}
          </h2>
        </div>
        <ul className="space-y-4">
          {sidebarItems.map((item) => (
            <li
              key={item.label}
              className="flex items-center gap-3 text-base font-medium hover:text-sky-300 cursor-pointer transition"
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </li>
          ))}
        </ul>
      </Sidebar>

      {/* Main content */}
      <main
        className={`flex-1 p-4 md:p-8 overflow-auto transition-all duration-300 ${
          sidebarOpen ? "ml-72" : "ml-0"
        }`}
      >
        {/* Mobile top bar */}
        <div className="flex items-center justify-center md:hidden mb-3">
          <h1 className="w-full text-center text-xl font-extrabold uppercase tracking-widest text-[#1e293b]">
            {t("moldManager.title")}
          </h1>
        </div>

        <h1 className="hidden md:block text-2xl font-extrabold uppercase mb-4 text-center tracking-widest text-[#1e293b]">
          {t("moldManager.title")}
        </h1>
        {alert.show && (
          <div
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded font-semibold text-sm shadow transition-all duration-300 ${
              alert.type === "success"
                ? "bg-green-100 text-green-800 border border-green-300"
                : "bg-red-100 text-red-800 border border-red-300"
            }`}
          >
            {alert.message}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end mb-4">
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t("moldManager.searchPlaceholder")}
              className="w-full sm:w-48 border rounded-md h-8 px-2 py-1 text-xs focus:ring-2 focus:ring-blue-200"
            />
            {/* Dynamic filter dropdowns */}
            {filterConfigs.map((filter) => (
              <select
                key={filter.key}
                value={filter.value}
                onChange={(e) => filter.setValue(e.target.value)}
                className="border rounded-md h-8 px-2 text-xs bg-white"
              >
                <option value="">{t(filter.labelKey)}</option>
                {filter.getOptions().map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportExcel}
              className="px-4 py-2 bg-emerald-600 text-white rounded font-bold text-sm shadow hover:bg-emerald-700 transition"
            >
              {t("moldManager.exportExcel")}
            </button>
            {user && (
              <button
                onClick={handleAddNew}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded font-bold text-sm shadow hover:from-blue-700 hover:to-purple-700 transition"
              >
                {t("moldManager.addNew")}
              </button>
            )}
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 w-full max-w-3xl relative animate-fadeIn mx-2">
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-xl font-bold"
                aria-label={t("moldManager.close")}
              >
                ×
              </button>
              <h2 className="text-base sm:text-lg font-bold mb-4 text-[#1e293b]">
                {editing !== null
                  ? t("moldManager.updateMold")
                  : t("moldManager.addMold")}
              </h2>
              <form
                onSubmit={handleSubmit}
                noValidate
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-2"
              >
                {columns.map((col) => {
                  const isImage =
                    col === "NamePlate" ||
                    col === "PM Image" ||
                    col.startsWith("Process");
                  return (
                    <div key={col} className="flex flex-col text-xs">
                      <div className="mb-1 flex items-center justify-between gap-1">
                        <label
                          htmlFor={col}
                          className="font-medium text-gray-700 text-[11px] sm:text-xs pl-1 truncate flex-1"
                        >
                          {getTranslatedColumn(col)}
                        </label>
                        {isImage && (
                          <button
                            type="button"
                            onClick={() => fileInputRefs[col]?.current?.click()}
                            className="px-2 py-0.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 whitespace-nowrap"
                            title="Chọn hình"
                          >
                            📁
                          </button>
                        )}
                        {isImage && (
                          <input
                            ref={fileInputRefs[col]}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleImageUpload(col, file);
                            }}
                          />
                        )}
                      </div>
                      {isImage ? (
                        <>
                          <input
                            id={col}
                            type="text"
                            name={col}
                            placeholder={getTranslatedColumn(col)}
                            value={form[col]}
                            onChange={handleChange}
                            className="border p-2 sm:p-1 rounded text-xs focus:ring-2 focus:ring-blue-200"
                          />
                          {form[col] && (
                            <img
                              src={getImagePath(
                                form[col],
                                form["Mold Code"],
                                col
                              )}
                              alt={getTranslatedColumn(col)}
                              className="mt-1 rounded border max-h-16 object-contain"
                              onError={(e) => {
                                e.target.style.display = "none";
                              }}
                            />
                          )}
                        </>
                      ) : (
                        <input
                          id={col}
                          type={col.includes("Date") ? "date" : "text"}
                          name={col}
                          placeholder={getTranslatedColumn(col)}
                          value={form[col]}
                          onChange={handleChange}
                          className="border p-2 sm:p-1 rounded text-xs focus:ring-2 focus:ring-blue-200"
                          disabled={col === "No" || col.startsWith("Prev ")}
                        />
                      )}
                    </div>
                  );
                })}
                <button
                  type="submit"
                  className="col-span-1 sm:col-span-2 lg:col-span-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2 sm:py-1 rounded font-bold text-sm mt-2"
                >
                  {editing !== null
                    ? t("moldManager.edit")
                    : t("moldManager.addNew")}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Modal xác nhận xóa - đặt ngoài table */}
        {confirmDelete.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-xl shadow-xl p-5 w-80 max-w-full border border-gray-300">
              <h3 className="text-base font-bold mb-4 text-[#1e293b] text-center">
                {t("moldManager.confirmDeleteMessage")}
              </h3>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmDelete({ show: false, id: null })}
                  className="px-3 py-1 rounded bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300"
                >
                  {t("moldManager.cancel")}
                </button>
                <button
                  onClick={() => {
                    handleDelete(confirmDelete.id);
                  }}
                  className="px-3 py-1 rounded bg-red-600 text-white font-semibold hover:bg-red-700"
                >
                  {t("moldManager.delete")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border border-gray-200 border-separate min-w-[1200px] rounded-lg shadow-sm">
            <thead>
              <tr className="bg-blue-100">
                {columns.map((col) => (
                  <th
                    key={col}
                    className="border border-gray-200 px-3 py-2 text-center text-blue-900 text-xs font-bold uppercase tracking-wide bg-blue-100"
                  >
                    {getTranslatedColumn(col)}
                  </th>
                ))}
                <th className="border border-gray-200 px-3 py-2 text-center text-blue-900 text-xs font-bold uppercase tracking-wide bg-blue-100">
                  {t("moldManager.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredMolds.map((m, idx) => (
                <tr
                  key={m.id}
                  className={idx % 2 === 0 ? "bg-white" : "bg-blue-100"}
                >
                  {columns.map((col) => {
                    // Xử lý đặc biệt cho cột PM Image - chỉ hiển thị nút
                    if (col === "PM Image") {
                      return (
                        <td
                          key={col}
                          className="border border-gray-200 px-2 py-1 text-xs text-center align-middle"
                        >
                          <button
                            onClick={() => handleViewPmDetail(m)}
                            className="px-3 py-1.5 bg-emerald-500 text-white rounded-md font-medium text-xs shadow-sm hover:bg-emerald-600 hover:shadow-md transition-all duration-200 transform hover:scale-105"
                          >
                            🔍 {t("moldManager.viewDetail")}
                          </button>
                        </td>
                      );
                    }

                    const isImage = col === "NamePlate" || col === "Process";
                    const cellValue = m[col];
                    // Tạo đường dẫn hình ảnh tự động dựa trên MoldID
                    const moldId = m["Mold Code"] || m.id;
                    const imagePath = isImage
                      ? getImagePath(cellValue, moldId, col)
                      : null;

                    // Kiểm tra xem hình ảnh này đã fail chưa
                    const imageKey = `${m.id}-${col}`;
                    const hasImageError = failedImages.has(imageKey);

                    return (
                      <td
                        key={col}
                        className="border border-gray-200 px-2 py-1 text-xs text-center align-middle"
                      >
                        {isImage && imagePath && !hasImageError ? (
                          <img
                            src={imagePath}
                            alt={getTranslatedColumn(col)}
                            loading="lazy"
                            className="max-h-16 max-w-full object-contain mx-auto rounded cursor-pointer hover:opacity-80 transition"
                            onClick={() =>
                              setImageZoom({
                                show: true,
                                src: imagePath,
                                alt: getTranslatedColumn(col),
                              })
                            }
                            onError={(e) => {
                              // Thêm vào set failed images để không render lại
                              setFailedImages((prev) =>
                                new Set(prev).add(imageKey)
                              );
                            }}
                          />
                        ) : isImage && hasImageError ? (
                          <span className="text-gray-400 text-xs italic">
                            Image not found
                          </span>
                        ) : (
                          highlightText(cellValue, col)
                        )}
                      </td>
                    );
                  })}
                  <td className="border border-gray-200 px-2 py-1 text-center align-middle">
                    {user && (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleViewDetail(m)}
                          className="px-3 py-1.5 bg-emerald-500 text-white rounded-md font-medium text-xs shadow-sm hover:bg-emerald-600 hover:shadow-md transition-all duration-200 transform hover:scale-105"
                        >
                          🔍 {t("moldManager.viewDetail")}
                        </button>
                        <button
                          onClick={() => handleEdit(m.id)}
                          className="px-3 py-1.5 bg-blue-500 text-white rounded-md font-medium text-xs shadow-sm hover:bg-blue-600 hover:shadow-md transition-all duration-200 transform hover:scale-105"
                        >
                          ✏️ {t("moldManager.edit")}
                        </button>
                        <button
                          onClick={() =>
                            setConfirmDelete({ show: true, id: m.id })
                          }
                          className="px-3 py-1.5 bg-red-500 text-white rounded-md font-medium text-xs shadow-sm hover:bg-red-600 hover:shadow-md transition-all duration-200 transform hover:scale-105"
                        >
                          🗑️ {t("moldManager.delete")}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Image Zoom Modal */}
        {imageZoom.show && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
            onClick={() => setImageZoom({ show: false, src: "", alt: "" })}
          >
            <div className="relative w-full h-full p-8 flex items-center justify-center">
              <button
                onClick={() => setImageZoom({ show: false, src: "", alt: "" })}
                className="absolute top-4 right-4 text-white bg-black bg-opacity-70 rounded-full p-3 hover:bg-opacity-90 transition z-10"
                aria-label={t("moldManager.close")}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2.5"
                  stroke="currentColor"
                  className="w-8 h-8"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
              <img
                src={imageZoom.src}
                alt={imageZoom.alt}
                className="max-w-[85vw] max-h-[85vh] w-auto h-auto object-contain rounded shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {detailModal.show && detailModal.mold && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-lg shadow-xl p-5 w-full max-w-4xl relative mx-4 overflow-y-auto max-h-[90vh]">
              <button
                onClick={closeDetailModal}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-xl font-bold"
                aria-label={t("moldManager.close")}
              >
                ×
              </button>
              <h2 className="text-lg font-extrabold mb-4 text-[#1e293b] tracking-wide">
                {t("moldManager.viewDetail")}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                {columns
                  .filter((c) => c !== "No")
                  .map((col) => {
                    const value = detailModal.mold[col];
                    const isImage =
                      col === "NamePlate" ||
                      col === "PM Image" ||
                      col === "Process";
                    return (
                      <div
                        key={col}
                        className="bg-gray-50 rounded border p-3 shadow-sm"
                      >
                        <div className="font-semibold text-gray-700 text-xs mb-1 uppercase tracking-wide">
                          {getTranslatedColumn(col)}
                        </div>
                        {isImage && value ? (
                          <img
                            src={getImagePath(
                              value,
                              detailModal.mold["Mold Code"] ||
                                detailModal.mold.id,
                              col
                            )}
                            alt={getTranslatedColumn(col)}
                            className="w-full h-32 object-contain rounded border bg-white"
                            onError={(e) => (e.target.style.display = "none")}
                          />
                        ) : (
                          <div className="text-gray-900 break-all">
                            {value || (
                              <span className="italic text-gray-400">
                                (empty)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={closeDetailModal}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded font-bold text-sm shadow hover:from-blue-700 hover:to-purple-700 transition"
                >
                  {t("moldManager.close")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PM Detail Modal */}
        {pmDetailModal.show && pmDetailModal.mold && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-lg shadow-xl p-5 w-full max-w-5xl relative mx-4 overflow-y-auto max-h-[90vh]">
              <button
                onClick={closePmDetailModal}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-xl font-bold"
                aria-label={t("moldManager.close")}
              >
                ×
              </button>
              <h2 className="text-lg font-extrabold mb-4 text-[#1e293b] tracking-wide">
                {t("moldManager.viewDetail")} - PM
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-300 rounded">
                  <thead>
                    <tr className="bg-blue-100 text-xs">
                      <th className="border px-2 py-1">Tên</th>
                      <th className="border px-2 py-1">Thời gian</th>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <th key={i} className="border px-2 py-1">
                          {i}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border px-2 py-1 font-semibold">
                        {pmDetailModal.mold["Production Name"] ||
                          pmDetailModal.mold["Tên"] ||
                          ""}
                      </td>
                      <td className="border px-2 py-1">
                        {pmDetailModal.mold["Date"] ||
                          pmDetailModal.mold["Thời gian"] ||
                          ""}
                      </td>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <td key={i} className="border px-2 py-1">
                          {pmDetailModal.mold[`pm${i}`] || ""}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={closePmDetailModal}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded font-bold text-sm shadow hover:from-blue-700 hover:to-purple-700 transition"
                >
                  {t("moldManager.close")}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default MoldManager;
