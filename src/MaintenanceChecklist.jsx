import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useUser } from "./UserContext";
import { db, ref, onValue, set, update, remove } from "./firebase";
import Sidebar from "./Sidebar";
import "./MaintenanceChecklist.css";

function MaintenanceChecklist() {
  const { t } = useTranslation();
  const { user } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [maintenanceTasks, setMaintenanceTasks] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });
  const [filterTab, setFilterTab] = useState("all"); // all, pending, completed
  const [newTask, setNewTask] = useState({
    name: "",
    description: "",
    startDate: new Date().toISOString().split("T")[0],
    startTime: new Date().toTimeString().slice(0, 5),
    completed: false,
    completedDate: "",
    completedTime: "",
    duration: "",
    assignedTo: user?.displayName || "",
    department: "",
    priority: "medium", // low, medium, high, urgent
    category: "general", // general, mechanical, electrical, cleaning, inspection
  });

  // Load maintenance tasks from Firebase
  useEffect(() => {
    const tasksRef = ref(db, "maintenance");
    const unsubscribe = onValue(tasksRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === "object") {
        const arr = Object.entries(data).map(([id, task]) => ({ id, ...task }));
        setMaintenanceTasks(
          arr.sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
        );
      } else {
        setMaintenanceTasks([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleAddOrUpdate = async () => {
    if (!newTask.name.trim()) {
      setAlert({
        show: true,
        type: "error",
        message: "❌ Vui lòng nhập tên công việc",
      });
      return;
    }

    try {
      if (editingId) {
        // Update existing task
        const taskRef = ref(db, `maintenance/${editingId}`);
        await update(taskRef, newTask);
        setAlert({
          show: true,
          type: "success",
          message: "✅ Cập nhật công việc thành công",
        });
      } else {
        // Add new task
        const tasksRef = ref(db, "maintenance");
        const newTaskRef = ref(db, `maintenance/${Date.now()}`);
        await set(newTaskRef, newTask);
        setAlert({
          show: true,
          type: "success",
          message: "✅ Thêm công việc thành công",
        });
      }
      resetForm();
      setShowModal(false);
    } catch (error) {
      setAlert({
        show: true,
        type: "error",
        message: `❌ Lỗi: ${error.message}`,
      });
    }
  };

  const handleToggleComplete = async (task) => {
    if (!task.completed) {
      // Mark as completed
      const now = new Date();
      const completedDate = now.toISOString().split("T")[0];
      const completedTime = now.toTimeString().slice(0, 5);

      // Calculate duration
      const startDateTime = new Date(`${task.startDate}T${task.startTime}`);
      const endDateTime = new Date(`${completedDate}T${completedTime}`);
      const durationMs = endDateTime - startDateTime;
      const durationHours = (durationMs / (1000 * 60 * 60)).toFixed(2);
      const duration = `${Math.floor(durationHours)} giờ ${Math.round(
        (durationHours % 1) * 60
      )} phút`;

      try {
        const taskRef = ref(db, `maintenance/${task.id}`);
        await update(taskRef, {
          completed: true,
          completedDate,
          completedTime,
          duration,
        });
        setAlert({
          show: true,
          type: "success",
          message: "✅ Đánh dấu hoàn tất",
        });
      } catch (error) {
        setAlert({
          show: true,
          type: "error",
          message: `❌ Lỗi: ${error.message}`,
        });
      }
    } else {
      // Mark as incomplete
      try {
        const taskRef = ref(db, `maintenance/${task.id}`);
        await update(taskRef, {
          completed: false,
          completedDate: "",
          completedTime: "",
          duration: "",
        });
        setAlert({
          show: true,
          type: "success",
          message: "✅ Đánh dấu chưa hoàn tất",
        });
      } catch (error) {
        setAlert({
          show: true,
          type: "error",
          message: `❌ Lỗi: ${error.message}`,
        });
      }
    }
  };

  const handleEdit = (task) => {
    setNewTask(task);
    setEditingId(task.id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Bạn chắc chắn muốn xóa công việc này?")) {
      try {
        const taskRef = ref(db, `maintenance/${id}`);
        await remove(taskRef);
        setAlert({
          show: true,
          type: "success",
          message: "✅ Xóa công việc thành công",
        });
      } catch (error) {
        setAlert({
          show: true,
          type: "error",
          message: `❌ Lỗi: ${error.message}`,
        });
      }
    }
  };

  const resetForm = () => {
    setNewTask({
      name: "",
      description: "",
      startDate: new Date().toISOString().split("T")[0],
      startTime: new Date().toTimeString().slice(0, 5),
      completed: false,
      completedDate: "",
      completedTime: "",
      duration: "",
      assignedTo: user?.displayName || "",
      department: "",
      priority: "medium",
      category: "general",
    });
    setEditingId(null);
  };

  const openNewTaskModal = () => {
    resetForm();
    setShowModal(true);
  };

  const completedCount = maintenanceTasks.filter((t) => t.completed).length;
  const progressPercentage =
    maintenanceTasks.length > 0
      ? Math.round((completedCount / maintenanceTasks.length) * 100)
      : 0;

  // Filter tasks based on tab
  const filteredTasks = maintenanceTasks.filter((task) => {
    if (filterTab === "pending") return !task.completed;
    if (filterTab === "completed") return task.completed;
    return true; // all
  });

  // Helper functions
  const getPriorityIcon = (priority) => {
    switch (priority) {
      case "urgent":
        return "🚨";
      case "high":
        return "⚠️";
      case "medium":
        return "📌";
      case "low":
        return "📋";
      default:
        return "📌";
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800 border-red-300";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "low":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case "mechanical":
        return "⚙️";
      case "electrical":
        return "⚡";
      case "cleaning":
        return "🧹";
      case "inspection":
        return "🔍";
      default:
        return "📄";
    }
  };

  const getCategoryName = (category) => {
    switch (category) {
      case "mechanical":
        return "Cơ khí";
      case "electrical":
        return "Điện";
      case "cleaning":
        return "Vệ sinh";
      case "inspection":
        return "Kiểm tra";
      default:
        return "Chung";
    }
  };

  return (
    <>
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border-t-4 border-indigo-600">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="md:hidden inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg transition-all"
                >
                  ☰
                </button>
                <div>
                  <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    🔧 Quản Lý Bảo Trì Thiết Bị
                  </h1>
                  <p className="text-gray-500 text-sm mt-1">
                    Theo dõi và quản lý công việc bảo trì một cách hiệu quả
                  </p>
                </div>
              </div>
              <button
                onClick={openNewTaskModal}
                className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:shadow-xl transition-all transform hover:scale-105 flex items-center gap-2"
              >
                <span className="text-xl">➕</span>
                <span>Thêm Công Việc</span>
              </button>
            </div>
          </div>

          {/* Alert */}
          {alert.show && (
            <div
              className={`mb-4 p-4 rounded-xl font-semibold flex items-center gap-3 shadow-lg animate-bounce ${
                alert.type === "success"
                  ? "bg-green-100 text-green-700 border-l-4 border-green-600"
                  : "bg-red-100 text-red-700 border-l-4 border-red-600"
              }`}
            >
              <span className="text-2xl">
                {alert.type === "success" ? "✅" : "❌"}
              </span>
              {alert.message}
            </div>
          )}

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium mb-1">
                    Tổng Công Việc
                  </p>
                  <p className="text-4xl font-extrabold">
                    {maintenanceTasks.length}
                  </p>
                </div>
                <div className="text-5xl opacity-20">📊</div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium mb-1">
                    Đã Hoàn Tất
                  </p>
                  <p className="text-4xl font-extrabold">{completedCount}</p>
                </div>
                <div className="text-5xl opacity-20">✅</div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm font-medium mb-1">
                    Đang Thực Hiện
                  </p>
                  <p className="text-4xl font-extrabold">
                    {maintenanceTasks.length - completedCount}
                  </p>
                </div>
                <div className="text-5xl opacity-20">⏳</div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm font-medium mb-1">
                    Tiến Độ
                  </p>
                  <p className="text-4xl font-extrabold">
                    {progressPercentage}%
                  </p>
                </div>
                <div className="text-5xl opacity-20">📈</div>
              </div>
              <div className="w-full bg-white bg-opacity-30 rounded-full h-2 mt-3">
                <div
                  className="bg-white h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="bg-white rounded-2xl shadow-lg p-2 mb-6">
            <div className="flex gap-2">
              <button
                onClick={() => setFilterTab("all")}
                className={`flex-1 px-6 py-3 rounded-xl font-bold transition-all ${
                  filterTab === "all"
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Tất Cả ({maintenanceTasks.length})
              </button>
              <button
                onClick={() => setFilterTab("pending")}
                className={`flex-1 px-6 py-3 rounded-xl font-bold transition-all ${
                  filterTab === "pending"
                    ? "bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Đang Thực Hiện ({maintenanceTasks.length - completedCount})
              </button>
              <button
                onClick={() => setFilterTab("completed")}
                className={`flex-1 px-6 py-3 rounded-xl font-bold transition-all ${
                  filterTab === "completed"
                    ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Đã Hoàn Tất ({completedCount})
              </button>
            </div>
          </div>

          {/* Tasks Table */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {filteredTasks.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-6xl mb-4">📋</div>
                <p className="text-gray-500 text-xl font-semibold">
                  {filterTab === "pending"
                    ? "Không có công việc đang thực hiện"
                    : filterTab === "completed"
                    ? "Chưa có công việc nào hoàn tất"
                    : "Chưa có công việc bảo trì nào"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
                    <tr>
                      <th className="px-4 py-4 text-left text-sm font-bold uppercase w-12">
                        #
                      </th>
                      <th className="px-4 py-4 text-left text-sm font-bold uppercase">
                        Công Việc
                      </th>
                      <th className="px-4 py-4 text-left text-sm font-bold uppercase">
                        Loại
                      </th>
                      <th className="px-4 py-4 text-left text-sm font-bold uppercase">
                        Ưu Tiên
                      </th>
                      <th className="px-4 py-4 text-left text-sm font-bold uppercase">
                        Người Phụ Trách
                      </th>
                      <th className="px-4 py-4 text-left text-sm font-bold uppercase">
                        Bộ Phận
                      </th>
                      <th className="px-4 py-4 text-left text-sm font-bold uppercase">
                        Thời Gian
                      </th>
                      <th className="px-4 py-4 text-center text-sm font-bold uppercase">
                        Trạng Thái
                      </th>
                      <th className="px-4 py-4 text-center text-sm font-bold uppercase w-32">
                        Thao Tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredTasks.map((task, index) => (
                      <tr
                        key={task.id}
                        className={`hover:bg-gray-50 transition-colors ${
                          task.completed ? "bg-green-50" : ""
                        }`}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={task.completed}
                              onChange={() => handleToggleComplete(task)}
                              className="w-5 h-5 text-indigo-600 rounded cursor-pointer"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div>
                            <p
                              className={`font-bold text-base ${
                                task.completed
                                  ? "line-through text-gray-500"
                                  : "text-gray-900"
                              }`}
                            >
                              {task.name}
                            </p>
                            {task.description && (
                              <p className="text-sm text-gray-500 mt-1">
                                {task.description}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                            {getCategoryIcon(task.category || "general")}
                            {getCategoryName(task.category || "general")}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold border ${getPriorityColor(
                              task.priority || "medium"
                            )}`}
                          >
                            {getPriorityIcon(task.priority || "medium")}
                            {task.priority === "urgent"
                              ? "Khẩn"
                              : task.priority === "high"
                              ? "Cao"
                              : task.priority === "low"
                              ? "Thấp"
                              : "Trung bình"}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                              {(task.assignedTo || "?")[0].toUpperCase()}
                            </div>
                            <span className="text-gray-700 font-medium">
                              {task.assignedTo || "Chưa gán"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-indigo-100 text-indigo-800">
                            🏢 {task.department || "Chưa xác định"}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm">
                            <p className="text-gray-600">
                              <span className="font-semibold">Bắt đầu:</span>{" "}
                              {new Date(task.startDate).toLocaleDateString(
                                "vi-VN"
                              )}{" "}
                              {task.startTime}
                            </p>
                            {task.completed && (
                              <>
                                <p className="text-green-600 mt-1">
                                  <span className="font-semibold">
                                    Hoàn tất:
                                  </span>{" "}
                                  {new Date(
                                    task.completedDate
                                  ).toLocaleDateString("vi-VN")}{" "}
                                  {task.completedTime}
                                </p>
                                <p className="text-indigo-600 font-bold mt-1">
                                  ⏱️ {task.duration}
                                </p>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {task.completed ? (
                            <span className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-green-500 text-white text-sm font-bold shadow-lg">
                              ✅ Hoàn tất
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-orange-500 text-white text-sm font-bold shadow-lg animate-pulse">
                              ⏳ Đang làm
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(task)}
                              className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition transform hover:scale-110"
                              title="Chỉnh sửa"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDelete(task.id)}
                              className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition transform hover:scale-110"
                              title="Xóa"
                            >
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-6 py-5 flex items-center justify-between rounded-t-2xl">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  {editingId ? (
                    <>
                      <span className="text-3xl">✏️</span>
                      <span>Chỉnh Sửa Công Việc</span>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl">➕</span>
                      <span>Thêm Công Việc Bảo Trì</span>
                    </>
                  )}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white text-2xl font-bold hover:bg-white hover:text-indigo-600 rounded-full w-10 h-10 flex items-center justify-center transition-all transform hover:rotate-90"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Task Name */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                    <span className="text-red-500">*</span>
                    <span>Tên Công Việc</span>
                  </label>
                  <input
                    type="text"
                    value={newTask.name}
                    onChange={(e) =>
                      setNewTask({ ...newTask, name: e.target.value })
                    }
                    className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-base"
                    placeholder="VD: Bảo trì máy nén khí số 3..."
                  />
                </div>

                {/* Category and Priority */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <span>📂</span>
                      <span>Loại Công Việc</span>
                    </label>
                    <select
                      value={newTask.category}
                      onChange={(e) =>
                        setNewTask({ ...newTask, category: e.target.value })
                      }
                      className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-base"
                    >
                      <option value="general">📄 Chung</option>
                      <option value="mechanical">⚙️ Cơ khí</option>
                      <option value="electrical">⚡ Điện</option>
                      <option value="cleaning">🧹 Vệ sinh</option>
                      <option value="inspection">🔍 Kiểm tra</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <span>⚡</span>
                      <span>Mức Độ Ưu Tiên</span>
                    </label>
                    <select
                      value={newTask.priority}
                      onChange={(e) =>
                        setNewTask({ ...newTask, priority: e.target.value })
                      }
                      className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-base"
                    >
                      <option value="low">📋 Thấp</option>
                      <option value="medium">📌 Trung bình</option>
                      <option value="high">⚠️ Cao</option>
                      <option value="urgent">🚨 Khẩn cấp</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                    <span>📝</span>
                    <span>Mô Tả Chi Tiết</span>
                  </label>
                  <textarea
                    value={newTask.description}
                    onChange={(e) =>
                      setNewTask({ ...newTask, description: e.target.value })
                    }
                    className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition-all resize-none text-base"
                    placeholder="Mô tả chi tiết về công việc cần thực hiện..."
                    rows="4"
                  ></textarea>
                </div>

                {/* Date and Time */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <span className="text-red-500">*</span>
                      <span>📅 Ngày Bắt Đầu</span>
                    </label>
                    <input
                      type="date"
                      value={newTask.startDate}
                      onChange={(e) =>
                        setNewTask({ ...newTask, startDate: e.target.value })
                      }
                      className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-base"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <span className="text-red-500">*</span>
                      <span>⏰ Giờ Bắt Đầu</span>
                    </label>
                    <input
                      type="time"
                      value={newTask.startTime}
                      onChange={(e) =>
                        setNewTask({ ...newTask, startTime: e.target.value })
                      }
                      className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-base"
                    />
                  </div>
                </div>

                {/* Assigned To and Department */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <span>👤</span>
                      <span>Người Phụ Trách</span>
                    </label>
                    <input
                      type="text"
                      value={newTask.assignedTo}
                      onChange={(e) =>
                        setNewTask({ ...newTask, assignedTo: e.target.value })
                      }
                      className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-base"
                      placeholder="Tên người phụ trách..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <span>🏢</span>
                      <span>Bộ Phận</span>
                    </label>
                    <select
                      value={newTask.department}
                      onChange={(e) =>
                        setNewTask({ ...newTask, department: e.target.value })
                      }
                      className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 outline-none transition-all text-base"
                    >
                      <option value="">-- Chọn bộ phận --</option>
                      <option value="PRESS">PRESS</option>
                      <option value="MC">MC</option>
                      <option value="HAIRLINE">HAIRLINE</option>
                      <option value="ANODIZING">ANODIZING</option>
                      <option value="ASSEMBLY">ASSEMBLY</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 flex gap-3 justify-end rounded-b-2xl border-t">
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-6 py-3 bg-gray-400 text-white rounded-xl hover:bg-gray-500 transition-all font-bold shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  ❌ Hủy
                </button>
                <button
                  onClick={handleAddOrUpdate}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-xl transition-all font-bold shadow-lg transform hover:scale-105"
                >
                  {editingId ? "💾 Cập Nhật" : "➕ Thêm Mới"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default MaintenanceChecklist;
