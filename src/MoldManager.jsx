  import React, { useState, useEffect } from "react";

  // Tự động tắt thông báo sau 3s
  // (đặt sau khai báo state trong component MoldManager)
import { db, ref, set, onValue } from "./firebase";
import { push, remove, update } from 'firebase/database';

// Map hiển thị <-> key lưu Firebase
const toSafeKey = (col) => col.replace(/[^a-zA-Z0-9_]/g, "_");
const fromSafeKey = (key, columns) => {
  if (!Array.isArray(columns)) return key;
  const map = {};
  columns.forEach(c => { map[toSafeKey(c)] = c; });
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
  const [alert, setAlert] = useState({ show: false, type: '', message: '' });
  const [confirmDelete, setConfirmDelete] = useState({ show: false, id: null });
  // Giả lập user đăng nhập, thực tế lấy từ context hoặc prop
  const [user, setUser] = useState(null); // null: chưa đăng nhập, object: đã đăng nhập

  // Tự động tắt thông báo sau 3s
  useEffect(() => {
    if (alert.show) {
      const timer = setTimeout(() => {
        setAlert(a => ({ ...a, show: false }));
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
          Object.keys(mold).forEach(k => {
            obj[fromSafeKey(k, columns)] = mold[k];
          });
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
        setAlert({ show: true, type: 'success', message: 'Cập nhật thành công!' });
      } else {
        // Thêm mold mới
        const newRef = push(ref(db, "molds"));
        const newNo = molds.length + 1;
        await set(newRef, normalizeMold(form, newRef.key, newNo));
        setAlert({ show: true, type: 'success', message: 'Thêm mới thành công!' });
      }
      setForm({ ...emptyForm });
      setShowModal(false);
    } catch (err) {
      setAlert({ show: true, type: 'error', message: 'Có lỗi xảy ra, vui lòng thử lại!' });
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
      setAlert({ show: true, type: 'success', message: 'Đã xóa thành công!' });
    } catch (err) {
      setAlert({ show: true, type: 'error', message: 'Xóa thất bại, vui lòng thử lại!' });
    }
    setConfirmDelete({ show: false, id: null });
  };

  const handleAddNew = () => {
    setForm({ ...emptyForm });
    setEditing(null);
    setShowModal(true);
  };

  return (
    <div className="w-screen h-screen flex bg-[#f1f5f9]">
      {/* Sidebar */}
      <aside className="w-64 bg-gradient-to-b from-[#1e293b] to-[#64748b] text-white flex flex-col p-6 shadow-lg">
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
      <main className="flex-1 p-8 overflow-auto">
        <h1 className="text-2xl font-bold mb-4 text-[#1e293b]">Quản lý Mold</h1>
        {alert.show && (
          <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded font-semibold text-sm shadow transition-all duration-300 ${alert.type === 'success' ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
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
            <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-3xl relative animate-fadeIn">
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-xl font-bold"
                aria-label="Đóng"
              >
                ×
              </button>
              <h2 className="text-lg font-bold mb-4 text-[#1e293b]">
                {editing !== null ? "Cập nhật Mold" : "Thêm mới Mold"}
              </h2>
              <form
                onSubmit={handleSubmit}
                className="grid grid-cols-4 gap-x-3 gap-y-2"
              >
                {columns.map((col) => {
                  const isImage = col === "NamePlate" || col.startsWith("Process");
                  return (
                    <div key={col} className="flex flex-col text-xs">
                      <label
                        htmlFor={col}
                        className="mb-1 font-medium text-gray-700 text-xs pl-1 truncate"
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
                            className="border p-1 rounded text-xs focus:ring-2 focus:ring-blue-200"
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
                          className="border p-1 rounded text-xs focus:ring-2 focus:ring-blue-200"
                          required={col !== "No"}
                          disabled={col === "No"}
                        />
                      )}
                    </div>
                  );
                })}
                <button
                  type="submit"
                  className="col-span-4 bg-blue-600 text-white py-1 rounded font-bold text-sm mt-2"
                >
                  {editing !== null ? "Cập nhật" : "Thêm mới"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-auto">
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
                <tr key={m.id} className={idx % 2 === 0 ? "bg-white" : "bg-blue-100"}>
                  {columns.map((col) => (
                    <td key={col} className="border border-gray-200 px-2 py-1 text-xs text-center align-middle">
                      {m[col]}
                    </td>
                  ))}
                  <td className="border border-gray-200 px-2 py-1 text-center align-middle">
                    {user && (
                      <>
                        <button
                          onClick={() => handleEdit(m.id)}
                          className="text-blue-600 mr-2 font-semibold hover:underline"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ show: true, id: m.id })}
                          className="text-red-600 font-semibold hover:underline"
                        >
                          Xóa
                        </button>
                      </>
                    )}
        {/* Modal xác nhận xóa */}
        {confirmDelete.show && (
          <div className="fixed inset-0 z-50 pointer-events-none">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl p-5 w-80 max-w-full border border-gray-300 pointer-events-auto">
              <h3 className="text-base font-bold mb-4 text-[#1e293b] text-center">Bạn có chắc chắn muốn xóa?</h3>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setConfirmDelete({ show: false, id: null })}
                  className="px-3 py-1 rounded bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300"
                >
                  Hủy
                </button>
                <button
                  onClick={() => {
                    setConfirmDelete({ show: false, id: null });
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
