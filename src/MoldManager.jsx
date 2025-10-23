import React, { useState, useEffect } from "react";

// Tự động tắt thông báo sau 3s
// (đặt sau khai báo state trong component MoldManager)
import { db, ref, set, onValue } from "./firebase";
import { push, remove, update } from "firebase/database";

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
  // Sidebar menu mẫu
  const sidebarItems = [
    { label: "Dashboard", icon: "🏠" },
    { label: "Mold List", icon: "🗂️" },
    { label: "Statistics", icon: "📊" },
    { label: "Settings", icon: "⚙️" },
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

  // Các cột hiển thị
  const columns = [
    "No",
    "Model",
    "Production Name",
    "Mold Code",
    "Asset No.",
    "Mold Size (W*D*H)",
    "Tooling Weight",
    "Date",
    "Location",
    "Type",
    "Pavonine Model",
    "Shot Counter",
    getPrevMonthLabel(), // Tự động cập nhật theo tháng hiện tại
    "Molds per Product",
    "Warehouse",
    "Vendor",
    "NamePlate",
    "Process",
  ];

  // Object mẫu cho form
  const emptyForm = columns.reduce(
    (acc, col) => {
      acc[col] = "";
      return acc;
    },
    { id: "" }
  );

  const [molds, setMolds] = useState([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });
  const [confirmDelete, setConfirmDelete] = useState({ show: false, id: null });
  // Giả lập user đăng nhập, thực tế lấy từ context hoặc prop
  const [user, setUser] = useState({ name: "Admin" }); // Tạm thời set user để hiển thị nút Sửa/Xóa
  // Toggle sidebar for small screens
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    try {
      if (editing !== null) {
        // Cập nhật mold
        const moldRef = ref(db, `molds/${editing}`);
        await set(moldRef, normalizeMold(form, editing, form.No));
        setEditing(null);
        setAlert({
          show: true,
          type: "success",
          message: "Cập nhật thành công!",
        });
      } else {
        // Thêm mold mới
        const newRef = push(ref(db, "molds"));
        const newNo = molds.length + 1;
        await set(newRef, normalizeMold(form, newRef.key, newNo));
        setAlert({
          show: true,
          type: "success",
          message: "Thêm mới thành công!",
        });
      }
      setForm({ ...emptyForm });
      setShowModal(false);
    } catch (err) {
      setAlert({
        show: true,
        type: "error",
        message: "Có lỗi xảy ra, vui lòng thử lại!",
      });
      setShowModal(false);
    }
  };

  // Bật modal edit
  const handleEdit = (id) => {
    const mold = molds.find((m) => m.id === id);
    setForm({ ...emptyForm, ...mold });
    setEditing(id);
    setShowModal(true);
  };

  // Xóa mold và đánh lại No
  const handleDelete = async (id) => {
    try {
      await remove(ref(db, `molds/${id}`));
      // Sau khi xóa, cập nhật lại No cho danh sách
      const newMolds = molds.filter((m) => m.id !== id);
      for (let i = 0; i < newMolds.length; i++) {
        await update(ref(db, `molds/${newMolds[i].id}`), { No: i + 1 });
      }
      setAlert({ show: true, type: "success", message: "Đã xóa thành công!" });
    } catch (err) {
      setAlert({
        show: true,
        type: "error",
        message: "Xóa thất bại, vui lòng thử lại!",
      });
    }
    setConfirmDelete({ show: false, id: null });
  };

  const handleAddNew = () => {
    setForm({ ...emptyForm });
    setEditing(null);
    setShowModal(true);
  };

  return (
    <div className="min-h-screen w-full bg-[#f1f5f9] flex flex-col md:flex-row">
      {/* Sidebar - mobile overlay */}
      {/* Backdrop for mobile when sidebar open */}
      {sidebarOpen && (
        <div
          className="fixed left-0 right-0 bottom-0 top-16 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}
      <aside
        className={
          "fixed left-0 top-16 bottom-0 z-40 w-64 transform bg-gradient-to-b from-[#1e293b] to-[#64748b] text-white p-6 shadow-lg transition-transform duration-300 md:static md:translate-x-0 md:flex md:w-64 md:shrink-0" +
          (sidebarOpen
            ? " translate-x-0"
            : " -translate-x-full md:translate-x-0")
        }
        aria-label="Sidebar"
      >
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
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between md:hidden mb-3">
          <button
            className="inline-flex items-center justify-center rounded-md p-2 text-slate-700 hover:bg-slate-200"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
              />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-[#1e293b]">Quản lý Mold</h1>
          <div className="w-9" />
        </div>

        <h1 className="hidden md:block text-xl font-bold mb-4 text-[#1e293b]">
          Quản lý Mold
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
        <div className="flex gap-2 mb-4">
          <button
            onClick={handleAddNew}
            className="px-4 py-2 bg-blue-600 text-white rounded font-bold text-sm shadow hover:bg-blue-700 transition"
          >
            Thêm mới
          </button>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 w-full max-w-3xl relative animate-fadeIn mx-2">
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-xl font-bold"
                aria-label="Đóng"
              >
                ×
              </button>
              <h2 className="text-base sm:text-lg font-bold mb-4 text-[#1e293b]">
                {editing !== null ? "Cập nhật Mold" : "Thêm mới Mold"}
              </h2>
              <form
                onSubmit={handleSubmit}
                noValidate
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-2"
              >
                {columns.map((col) => {
                  const isImage =
                    col === "NamePlate" || col.startsWith("Process");
                  return (
                    <div key={col} className="flex flex-col text-xs">
                      <label
                        htmlFor={col}
                        className="mb-1 font-medium text-gray-700 text-[11px] sm:text-xs pl-1 truncate"
                      >
                        {col}
                      </label>
                      {isImage ? (
                        <>
                          <input
                            id={col}
                            type="text"
                            name={col}
                            placeholder={col + " (link hình ảnh)"}
                            value={form[col]}
                            onChange={handleChange}
                            className="border p-2 sm:p-1 rounded text-xs focus:ring-2 focus:ring-blue-200"
                          />
                          {form[col] && (
                            <img
                              src={form[col]}
                              alt={col}
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
                          placeholder={col}
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
                  className="col-span-1 sm:col-span-2 lg:col-span-4 bg-blue-600 text-white py-2 sm:py-1 rounded font-bold text-sm mt-2"
                >
                  {editing !== null ? "Cập nhật" : "Thêm mới"}
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
                Bạn có chắc chắn muốn xóa?
              </h3>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmDelete({ show: false, id: null })}
                  className="px-3 py-1 rounded bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300"
                >
                  Hủy
                </button>
                <button
                  onClick={() => {
                    handleDelete(confirmDelete.id);
                  }}
                  className="px-3 py-1 rounded bg-red-600 text-white font-semibold hover:bg-red-700"
                >
                  Xóa
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
                    {col}
                  </th>
                ))}
                <th className="border border-gray-200 px-3 py-2 text-center text-blue-900 text-xs font-bold uppercase tracking-wide bg-blue-100">
                  Edit
                </th>
              </tr>
            </thead>
            <tbody>
              {molds.map((m, idx) => (
                <tr
                  key={m.id}
                  className={idx % 2 === 0 ? "bg-white" : "bg-blue-100"}
                >
                  {columns.map((col) => (
                    <td
                      key={col}
                      className="border border-gray-200 px-2 py-1 text-xs text-center align-middle"
                    >
                      {m[col]}
                    </td>
                  ))}
                  <td className="border border-gray-200 px-2 py-1 text-center align-middle">
                    {user && (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(m.id)}
                          className="px-3 py-1.5 bg-blue-500 text-white rounded-md font-medium text-xs shadow-sm hover:bg-blue-600 hover:shadow-md transition-all duration-200 transform hover:scale-105"
                        >
                          ✏️ Sửa
                        </button>
                        <button
                          onClick={() =>
                            setConfirmDelete({ show: true, id: m.id })
                          }
                          className="px-3 py-1.5 bg-red-500 text-white rounded-md font-medium text-xs shadow-sm hover:bg-red-600 hover:shadow-md transition-all duration-200 transform hover:scale-105"
                        >
                          🗑️ Xóa
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default MoldManager;
