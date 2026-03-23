import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useUser } from "../../contexts/UserContext";
import { db, ref, set, onValue, remove } from "../../services/firebase";

function UserDepartmentManager() {
  const { t } = useTranslation();
  const { user } = useUser();
  const [userDepartments, setUserDepartments] = useState([]);
  const [availableDepartments, setAvailableDepartments] = useState([]);
  const [form, setForm] = useState({
    email: "",
    departments: [], // Thay từ department thành departments (array)
    description: "",
  });
  const [editing, setEditing] = useState(null);
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });

  // Load available departments from attendance data
  useEffect(() => {
    const attendanceRef = ref(db, "attendance");
    const unsubscribe = onValue(attendanceRef, (snapshot) => {
      const data = snapshot.val();
      const depts = new Set();

      if (data && typeof data === "object") {
        // Iterate through all dates
        Object.values(data).forEach((dateData) => {
          if (dateData && typeof dateData === "object") {
            // Iterate through all employees in that date
            Object.values(dateData).forEach((emp) => {
              if (emp.boPhan) {
                depts.add(emp.boPhan);
              }
            });
          }
        });
      }

      setAvailableDepartments(Array.from(depts).sort());
    });
    return () => unsubscribe();
  }, []);

  // Load user-department mappings from Firebase
  useEffect(() => {
    const userDeptsRef = ref(db, "userDepartments");
    const unsubscribe = onValue(userDeptsRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === "object") {
        const arr = Object.entries(data).map(([id, dept]) => ({
          id,
          ...dept,
        }));
        setUserDepartments(arr);
      } else {
        setUserDepartments([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Auto-hide alert after 3s
  useEffect(() => {
    if (alert.show) {
      const timer = setTimeout(() => {
        setAlert((a) => ({ ...a, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show]);

  // Check if user is admin
  const isAdmin =
    user?.email === "admin@gmail.com" || user?.email === "hr@pavonine.net";

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isAdmin) {
      setAlert({
        show: true,
        type: "error",
        message: "Chỉ admin mới có quyền thực hiện thao tác này",
      });
      return;
    }

    if (!form.email || form.departments.length === 0) {
      setAlert({
        show: true,
        type: "error",
        message: "Vui lòng điền đầy đủ Email và chọn ít nhất 1 Bộ phận",
      });
      return;
    }

    try {
      const id = editing || Date.now().toString();
      const userDeptRef = ref(db, `userDepartments/${id}`);
      await set(userDeptRef, {
        email: form.email,
        departments: form.departments, // Lưu array bộ phận
        description: form.description || "",
        updatedAt: new Date().toISOString(),
        updatedBy: user.email,
      });

      setAlert({
        show: true,
        type: "success",
        message: editing ? "✅ Cập nhật thành công" : "✅ Thêm mới thành công",
      });

      setForm({ email: "", departments: [], description: "" });
      setEditing(null);
    } catch (err) {
      console.error("Save error:", err);
      setAlert({
        show: true,
        type: "error",
        message: "❌ Lỗi khi lưu dữ liệu",
      });
    }
  };

  const handleEdit = (dept) => {
    setForm({
      email: dept.email,
      departments:
        dept.departments || (dept.department ? [dept.department] : []), // Support cả old và new format
      description: dept.description || "",
    });
    setEditing(dept.id);
  };

  const handleDelete = async (id) => {
    if (!isAdmin) {
      setAlert({
        show: true,
        type: "error",
        message: "Chỉ admin mới có quyền thực hiện thao tác này",
      });
      return;
    }

    if (!window.confirm("Bạn có chắc muốn xóa mapping này?")) return;

    try {
      await remove(ref(db, `userDepartments/${id}`));
      setAlert({
        show: true,
        type: "success",
        message: "✅ Xóa thành công",
      });
    } catch (err) {
      console.error("Delete error:", err);
      setAlert({
        show: true,
        type: "error",
        message: "❌ Xóa thất bại",
      });
    }
  };

  const handleCancel = () => {
    setForm({ email: "", departments: [], description: "" });
    setEditing(null);
  };

  const toggleDepartment = (dept) => {
    setForm((prev) => {
      const depts = prev.departments || [];
      if (depts.includes(dept)) {
        return { ...prev, departments: depts.filter((d) => d !== dept) };
      } else {
        return { ...prev, departments: [...depts, dept] };
      }
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <p className="text-gray-600">{t("userDeptManager.pleaseLogin")}</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <p className="text-red-600 font-bold text-xl mb-2">
            {t("userDeptManager.accessDenied")}
          </p>
          <p className="text-gray-600">{t("userDeptManager.adminOnly")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Alert */}
        {alert.show && (
          <div
            className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg animate-fadeIn ${
              alert.type === "success"
                ? "bg-green-500 text-white"
                : alert.type === "error"
                  ? "bg-red-500 text-white"
                  : "bg-blue-500 text-white"
            }`}
          >
            {alert.message}
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {t("userDeptManager.title")}
          </h1>
          <p className="text-gray-600">{t("userDeptManager.description")}</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t("userDeptManager.emailLabel")}
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="pavo_press@gmail.com"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-2 items-end">
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                >
                  {editing
                    ? t("userDeptManager.btnUpdate")
                    : t("userDeptManager.btnAdd")}
                </button>
                {editing && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-3 py-2 bg-gray-400 text-white font-semibold rounded-lg hover:bg-gray-500 transition-colors"
                    title="Hủy chỉnh sửa"
                  >
                    ❌
                  </button>
                )}
              </div>

              {/* Bộ phận */}
              <div className="md:col-span-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {t("userDeptManager.deptLabel", {
                    count: form.departments.length,
                  })}
                </label>
                <div className="border border-gray-300 rounded-lg p-2 max-h-40 overflow-y-auto bg-gray-50">
                  {availableDepartments.length === 0 ? (
                    <p className="text-gray-500 italic text-xs p-2">
                      {t("userDeptManager.loadingDepts")}
                    </p>
                  ) : (
                    <div className="grid grid-cols-7 gap-3">
                      {availableDepartments.map((dept) => (
                        <label
                          key={dept}
                          className="flex items-center gap-2 cursor-pointer px-2 py-1 hover:bg-blue-100 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={form.departments.includes(dept)}
                            onChange={() => toggleDepartment(dept)}
                            className="w-4 h-4 rounded"
                          />
                          <span className="text-xs text-gray-700">{dept}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {form.departments.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">
                    {t("userDeptManager.minOneDept")}
                  </p>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-800">
              {t("userDeptManager.tableTitle", {
                count: userDepartments.length,
              })}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    {t("userDeptManager.colEmail")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    {t("userDeptManager.colDept")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    {t("userDeptManager.colDesc")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                    {t("userDeptManager.colUpdatedBy")}
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                    {t("userDeptManager.colActions")}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {userDepartments.length === 0 ? (
                  <tr>
                    <td
                      colSpan="5"
                      className="px-6 py-8 text-center text-gray-500 italic"
                    >
                      Chưa có mapping nào. Hãy thêm mới ở form bên trên.
                    </td>
                  </tr>
                ) : (
                  userDepartments.map((dept) => (
                    <tr key={dept.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-semibold text-gray-900">
                          {dept.email}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {Array.isArray(dept.departments) &&
                          dept.departments.length > 0
                            ? dept.departments.map((d) => (
                                <span
                                  key={d}
                                  className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded"
                                >
                                  {d}
                                </span>
                              ))
                            : dept.department && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded">
                                  {dept.department}
                                </span>
                              )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600">
                          {dept.description || "--"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs text-gray-500">
                          {dept.updatedBy || "--"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(dept)}
                            className="px-3 py-1 bg-yellow-500 text-white text-xs font-semibold rounded hover:bg-yellow-600 transition-colors"
                          >
                            ✏️ Sửa
                          </button>
                          <button
                            onClick={() => handleDelete(dept.id)}
                            className="px-3 py-1 bg-red-500 text-white text-xs font-semibold rounded hover:bg-red-600 transition-colors"
                          >
                            🗑️ Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-6 mt-6 rounded-lg">
          <h3 className="text-lg font-bold text-blue-900 mb-2">
            ℹ️ Hướng dẫn sử dụng
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>
              • <strong>Email User:</strong> Email đăng nhập của user (ví dụ:
              pavo_press@gmail.com)
            </li>
            <li>
              • <strong>Bộ phận:</strong> Tên bộ phận mà user được phép quản lý
              (Press, MC, MOD...)
            </li>
            <li>
              • User chỉ có thể chỉnh sửa dữ liệu của nhân viên trong bộ phận
              được gán
            </li>
            <li>• Admin và HR có quyền chỉnh sửa tất cả bộ phận</li>
            <li>
              • Bộ phận phải khớp chính xác với giá trị trong cột "Bộ phận" của
              dữ liệu chấm công
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default UserDepartmentManager;
