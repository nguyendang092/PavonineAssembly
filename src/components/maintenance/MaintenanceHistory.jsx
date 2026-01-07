import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useUser } from "../../contexts/UserContext";
import { db, ref, onValue } from "../../services/firebase";

function MaintenanceHistory({ onClose }) {
  const { t } = useTranslation();
  const { user } = useUser();
  const [history, setHistory] = useState([]);
  const [filter, setFilter] = useState("all"); // all, add, edit, delete
  const [searchTerm, setSearchTerm] = useState("");

  const isAdmin = user?.email === "admin@gmail.com";

  // Load history from Firebase
  useEffect(() => {
    if (!isAdmin) return;

    const historyRef = ref(db, "maintenanceHistory");
    const unsubscribe = onValue(historyRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === "object") {
        const arr = Object.entries(data).map(([id, entry]) => ({
          id,
          ...entry,
        }));
        // Sort by timestamp descending (newest first)
        setHistory(arr.sort((a, b) => b.timestamp - a.timestamp));
      } else {
        setHistory([]);
      }
    });
    return () => unsubscribe();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">
            🚫 Không có quyền truy cập
          </h2>
          <p className="text-gray-700 mb-6">
            Chỉ có quản trị viên mới có quyền xem lịch sử.
          </p>
          <button
            onClick={onClose}
            className="w-full px-6 py-3 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-all font-bold"
          >
            Đóng
          </button>
        </div>
      </div>
    );
  }

  // Filter history
  const filteredHistory = history.filter((entry) => {
    const matchesFilter = filter === "all" || entry.action === filter;
    const matchesSearch =
      searchTerm === "" ||
      entry.taskName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.performedBy?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.details?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getActionIcon = (action) => {
    switch (action) {
      case "add":
        return "➕";
      case "edit":
        return "✏️";
      case "delete":
        return "🗑️";
      default:
        return "📝";
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case "add":
        return "bg-green-100 text-green-800 border-green-300";
      case "edit":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "delete":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getActionText = (action) => {
    switch (action) {
      case "add":
        return "Thêm mới";
      case "edit":
        return "Cập nhật";
      case "delete":
        return "Xóa";
      default:
        return "Thao tác";
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-5 rounded-t-2xl">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold flex items-center gap-3">
              📋 Lịch Sử Quản lý Tổng Vụ (GA)
            </h2>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-all"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b bg-gray-50">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Action Filter */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilter("all")}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  filter === "all"
                    ? "bg-indigo-600 text-white shadow-lg"
                    : "bg-white text-gray-700 hover:bg-gray-100 border"
                }`}
              >
                Tất cả ({history.length})
              </button>
              <button
                onClick={() => setFilter("add")}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  filter === "add"
                    ? "bg-green-600 text-white shadow-lg"
                    : "bg-white text-gray-700 hover:bg-gray-100 border"
                }`}
              >
                ➕ Thêm mới
              </button>
              <button
                onClick={() => setFilter("edit")}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  filter === "edit"
                    ? "bg-blue-600 text-white shadow-lg"
                    : "bg-white text-gray-700 hover:bg-gray-100 border"
                }`}
              >
                ✏️ Cập nhật
              </button>
              <button
                onClick={() => setFilter("delete")}
                className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                  filter === "delete"
                    ? "bg-red-600 text-white shadow-lg"
                    : "bg-white text-gray-700 hover:bg-gray-100 border"
                }`}
              >
                🗑️ Xóa
              </button>
            </div>

            {/* Search */}
            <div className="flex-1 min-w-[250px]">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="🔍 Tìm kiếm theo tên công việc, người thực hiện..."
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-indigo-600 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {filteredHistory.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-gray-500 text-lg">
                {searchTerm || filter !== "all"
                  ? "Không tìm thấy lịch sử phù hợp"
                  : "Chưa có lịch sử nào"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all"
                >
                  <div className="flex items-start gap-4">
                    {/* Action Badge */}
                    <div
                      className={`flex-shrink-0 px-3 py-1 rounded-lg border-2 font-bold text-sm ${getActionColor(
                        entry.action
                      )}`}
                    >
                      {getActionIcon(entry.action)}{" "}
                      {getActionText(entry.action)}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-lg text-gray-800">
                          {entry.taskName || "Không rõ"}
                        </h3>
                        <span className="text-sm text-gray-500">
                          {formatTimestamp(entry.timestamp)}
                        </span>
                      </div>

                      <div className="space-y-1 text-sm">
                        <p className="text-gray-700">
                          <span className="font-semibold">
                            👤 Thực hiện bởi:
                          </span>{" "}
                          {entry.performedBy || "Không rõ"}
                        </p>
                        {entry.details && (
                          <p className="text-gray-600">
                            <span className="font-semibold">📝 Chi tiết:</span>{" "}
                            {entry.details}
                          </p>
                        )}
                        {entry.taskId && (
                          <p className="text-gray-500 text-xs">
                            <span className="font-semibold">ID:</span>{" "}
                            {entry.taskId}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t rounded-b-2xl flex justify-between items-center">
          <p className="text-sm text-gray-600">
            Hiển thị <span className="font-bold">{filteredHistory.length}</span>{" "}
            / {history.length} bản ghi
          </p>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-all font-bold shadow-lg"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

export default MaintenanceHistory;
