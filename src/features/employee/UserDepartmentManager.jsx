import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useUser } from "@/contexts/UserContext";
import {
  canManageUserDepartmentMappings,
  inferRoleFromMapping,
  normalizeRole,
  ROLES,
} from "@/config/authRoles";
import { db, ref, set, onValue, remove } from "@/services/firebase";
import AlertMessage from "@/components/ui/AlertMessage";
import MyAccessSummary from "@/components/ui/MyAccessSummary";

function UserDepartmentManager() {
  const { t } = useTranslation();
  const { user, userRole } = useUser();
  const [mappings, setMappings] = useState([]);
  const [availableDepartments, setAvailableDepartments] = useState([]);
  const [form, setForm] = useState({
    email: "",
    role: ROLES.MANAGER,
    departments: [], // Thay từ department thành departments (array)
    description: "",
  });
  const [editing, setEditing] = useState(null);
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });

  // Bộ phận: attendance (theo ngày) + employeeProfiles (hồ sơ tách tầng)
  useEffect(() => {
    const attendanceRef = ref(db, "attendance");
    const profilesRef = ref(db, "employeeProfiles");
    const collect = (attendanceRoot, profilesRoot) => {
      const depts = new Set();
      if (attendanceRoot && typeof attendanceRoot === "object") {
        Object.values(attendanceRoot).forEach((dateData) => {
          if (dateData && typeof dateData === "object") {
            Object.values(dateData).forEach((emp) => {
              if (emp.boPhan) depts.add(emp.boPhan);
            });
          }
        });
      }
      if (profilesRoot && typeof profilesRoot === "object") {
        Object.values(profilesRoot).forEach((p) => {
          if (p?.boPhan) depts.add(p.boPhan);
        });
      }
      setAvailableDepartments(Array.from(depts).sort());
    };
    let att = null;
    let prof = null;
    const flush = () => collect(att, prof);
    const unsubA = onValue(attendanceRef, (snapshot) => {
      att = snapshot.val();
      flush();
    });
    const unsubP = onValue(profilesRef, (snapshot) => {
      prof = snapshot.val();
      flush();
    });
    return () => {
      unsubA();
      unsubP();
    };
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
        setMappings(arr);
      } else {
        setMappings([]);
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

  const canManageMappings = canManageUserDepartmentMappings(user, userRole);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!canManageMappings) {
      setAlert({
        show: true,
        type: "error",
        message: t("userDeptManager.adminOnlyAction"),
      });
      return;
    }

    const role = normalizeRole(form.role) || ROLES.MANAGER;
    if (!form.email?.trim()) {
      setAlert({
        show: true,
        type: "error",
        message: t("userDeptManager.requireEmail"),
      });
      return;
    }
    if (role === ROLES.MANAGER && form.departments.length === 0) {
      setAlert({
        show: true,
        type: "error",
        message: t("userDeptManager.minOneDeptManager"),
      });
      return;
    }

    try {
      const id = editing || Date.now().toString();
      const userDeptRef = ref(db, `userDepartments/${id}`);
      await set(userDeptRef, {
        email: form.email.trim(),
        role,
        departments: form.departments,
        description: form.description || "",
        updatedAt: new Date().toISOString(),
        updatedBy: user.email,
      });

      setAlert({
        show: true,
        type: "success",
        message: editing ? "✅ Cập nhật thành công" : "✅ Thêm mới thành công",
      });

      setForm({
        email: "",
        role: ROLES.MANAGER,
        departments: [],
        description: "",
      });
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
    const depts =
      dept.departments || (dept.department ? [dept.department] : []);
    setForm({
      email: dept.email,
      role: inferRoleFromMapping({ ...dept, departments: depts }),
      departments: depts,
      description: dept.description || "",
    });
    setEditing(dept.id);
  };

  const handleDelete = async (id) => {
    if (!canManageMappings) {
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
    setForm({
      email: "",
      role: ROLES.MANAGER,
      departments: [],
      description: "",
    });
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
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-slate-950">
        <div className="rounded-lg bg-white p-8 text-center shadow-lg dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
          <p className="text-gray-600 dark:text-slate-300">
            {t("userDeptManager.pleaseLogin")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 dark:bg-slate-950">
      <div className="mx-auto max-w-6xl">
        <AlertMessage alert={alert} />

        {/* Header */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow-md dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
          <h1 className="mb-2 text-3xl font-bold text-gray-800 dark:text-slate-100">
            {t("userDeptManager.title")}
          </h1>
          <p className="text-gray-600 dark:text-slate-400">
            {t("userDeptManager.description")}
          </p>
        </div>

        {user ? <MyAccessSummary variant="full" /> : null}

        {user && !canManageMappings && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            {t("userDeptManager.viewOnlyBanner")}
          </div>
        )}

        {/* Form — chỉ admin */}
        {canManageMappings && (
        <div className="mb-6 rounded-lg bg-white p-6 shadow-md dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
          <form onSubmit={handleSubmit}>
            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4">
              {/* Email */}
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-slate-300">
                  {t("userDeptManager.emailLabel")}
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="pavo_press@gmail.com"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-slate-300">
                  {t("userDeptManager.roleLabel")}
                </label>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value={ROLES.ADMIN}>{t("userDeptManager.roleAdmin")}</option>
                  <option value={ROLES.MANAGER}>
                    {t("userDeptManager.roleManager")}
                  </option>
                  <option value={ROLES.STAFF}>{t("userDeptManager.roleStaff")}</option>
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  {t("userDeptManager.roleHelp")}
                </p>
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
                <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-slate-300">
                  {t("userDeptManager.deptLabel", {
                    count: form.departments.length,
                  })}
                </label>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-300 bg-gray-50 p-2 dark:border-slate-600 dark:bg-slate-900/60">
                  {availableDepartments.length === 0 ? (
                    <p className="p-2 text-xs italic text-gray-500 dark:text-slate-400">
                      {t("userDeptManager.loadingDepts")}
                    </p>
                  ) : (
                    <div className="grid grid-cols-7 gap-3">
                      {availableDepartments.map((dept) => (
                        <label
                          key={dept}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-blue-100 dark:hover:bg-slate-800"
                        >
                          <input
                            type="checkbox"
                            checked={form.departments.includes(dept)}
                            onChange={() => toggleDepartment(dept)}
                            className="h-4 w-4 rounded"
                          />
                          <span className="text-xs text-gray-700 dark:text-slate-300">
                            {dept}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {normalizeRole(form.role) === ROLES.MANAGER &&
                  form.departments.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">
                      {t("userDeptManager.minOneDeptManager")}
                    </p>
                  )}
              </div>
            </div>
          </form>
        </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-lg bg-white shadow-md dark:bg-slate-900 dark:ring-1 dark:ring-slate-700">
          <div className="border-b border-gray-200 p-6 dark:border-slate-700">
            <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100">
              {t("userDeptManager.tableTitle", {
                count: mappings.length,
              })}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-slate-200">
                    {t("userDeptManager.colEmail")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-slate-200">
                    {t("userDeptManager.colRole")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-slate-200">
                    {t("userDeptManager.colDept")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-slate-200">
                    {t("userDeptManager.colDesc")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-slate-200">
                    {t("userDeptManager.colUpdatedBy")}
                  </th>
                  {canManageMappings && (
                    <th className="px-6 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-slate-200">
                      {t("userDeptManager.colActions")}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
                {mappings.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canManageMappings ? 6 : 5}
                      className="px-6 py-8 text-center italic text-gray-500 dark:text-slate-400"
                    >
                      {canManageMappings
                        ? t("userDeptManager.noMappings")
                        : t("userDeptManager.noMappingsViewOnly")}
                    </td>
                  </tr>
                ) : (
                  mappings.map((dept) => (
                    <tr key={dept.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/80">
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                          {dept.email}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 bg-slate-100 text-slate-800 text-xs font-bold rounded">
                          {inferRoleFromMapping(dept)}
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
                      {canManageMappings && (
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleEdit(dept)}
                              className="px-3 py-1 bg-yellow-500 text-white text-xs font-semibold rounded hover:bg-yellow-600 transition-colors"
                            >
                              ✏️ Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(dept.id)}
                              className="px-3 py-1 bg-red-500 text-white text-xs font-semibold rounded hover:bg-red-600 transition-colors"
                            >
                              🗑️ Xóa
                            </button>
                          </div>
                        </td>
                      )}
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
              • <strong>Vai trò admin:</strong> toàn quyền (và mở trang phân
              quyền này).
            </li>
            <li>
              • <strong>Vai trò manager:</strong> xem và sửa chấm công chỉ
              trong các bộ phận đã chọn (arena).
            </li>
            <li>
              • <strong>Vai trò staff:</strong> chỉ xem, không sửa dữ liệu chấm
              công.
            </li>
            <li>
              • <strong>Bộ phận:</strong> phải khớp cột &quot;Bộ phận&quot;
              trong dữ liệu chấm công; manager bắt buộc chọn ít nhất một bộ phận.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default UserDepartmentManager;
