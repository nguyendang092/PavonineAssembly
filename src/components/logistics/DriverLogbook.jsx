import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useUser } from "../../contexts/UserContext";
import { db, ref, onValue, set, update, remove } from "../../services/firebase";
import Sidebar from "../layout/Sidebar";

// Helper functions for ScheduleBoard
function formatTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return "-";
  try {
    const d = new Date(`${dateStr}T${timeStr}:00`);
    return d.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return `${timeStr}`;
  }
}

function getStatus(trip) {
  if (trip.completed) return "ARRIVED";
  if (!trip.startDate) return "SCHEDULED";
  return "ONBOARD";
}

function StatusBadge({ trip }) {
  const status = getStatus(trip);
  const statusConfig = {
    SCHEDULED: {
      label: "Đã Lên Lịch",
      color: "bg-blue-100 text-blue-700",
      icon: "📅",
    },
    ONBOARD: {
      label: "Đang Chạy",
      color: "bg-amber-100 text-amber-700",
      icon: "🚗",
    },
    ARRIVED: {
      label: "Hoàn Tất",
      color: "bg-green-100 text-green-700",
      icon: "✅",
    },
    DELAYED: { label: "Chậm", color: "bg-red-100 text-red-700", icon: "⚠️" },
  };

  const config = statusConfig[status] || statusConfig.SCHEDULED;
  return (
    <div
      className={`px-3 py-1 rounded-full text-xs font-bold ${config.color} flex items-center gap-1 w-fit`}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </div>
  );
}

function DriverLogbook() {
  const { t } = useTranslation();
  const { user } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState("schedule"); // schedule, trips
  const [trips, setTrips] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsTrip, setDetailsTrip] = useState(null);
  const [tempDetails, setTempDetails] = useState("");
  const [detailsForm, setDetailsForm] = useState({
    startTime: "",
    endTime: "",
    destination: "",
    odoFrom: "",
    odoTo: "",
    tollFee: "",
    mealFee: "",
    overtimeHours: "",
    notes: "",
  });
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });
  const [filterTab, setFilterTab] = useState("all"); // all, ongoing, completed
  // ScheduleBoard states
  const [boardNow, setBoardNow] = useState(new Date());
  const [sortBy, setSortBy] = useState("time"); // time, vehicle, driver, status
  const [filterStatus, setFilterStatus] = useState("all"); // all, scheduled, onboard, arrived
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [newTrip, setNewTrip] = useState({
    driverName: user?.name || "",
    phone: "",
    vehicleNumber: "",
    departure: "",
    destination: "",
    startKm: "",
    endKm: "",
    totalKm: "",
    startDate: new Date().toISOString().split("T")[0],
    startTime: new Date().toTimeString().slice(0, 5),
    endDate: "",
    endTime: "",
    purpose: "",
    notes: "",
    expenseDetails: "",
    completed: false,
  });
  // Board/List view toggle
  const [viewMode, setViewMode] = useState("list");

  // Detect duplicate booking: same vehicle + same start date/time
  const isDuplicateBooking = React.useMemo(() => {
    if (!newTrip.vehicleNumber || !newTrip.startDate || !newTrip.startTime)
      return false;
    return trips.some(
      (t) =>
        t.vehicleNumber === newTrip.vehicleNumber &&
        t.startDate === newTrip.startDate &&
        t.startTime === newTrip.startTime &&
        t.id !== editingId
    );
  }, [
    newTrip.vehicleNumber,
    newTrip.startDate,
    newTrip.startTime,
    trips,
    editingId,
  ]);

  // Load trips from Firebase
  useEffect(() => {
    const tripsRef = ref(db, "driverTrips");
    const unsubscribe = onValue(tripsRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === "object") {
        const arr = Object.entries(data).map(([id, trip]) => ({ id, ...trip }));
        setTrips(
          arr.sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
        );
      } else {
        setTrips([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Auto-dismiss alert after 4s
  useEffect(() => {
    if (alert.show) {
      const timer = setTimeout(() => {
        setAlert({ show: false, type: "", message: "" });
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [alert.show]);

  // Update board time every 1 second for real-time display
  useEffect(() => {
    const t = setInterval(() => setBoardNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleEdit = (trip) => {
    setNewTrip(trip);
    setEditingId(trip.id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Bạn chắc chắn muốn xóa chuyến đi này?")) {
      try {
        const tripRef = ref(db, `driverTrips/${id}`);
        await remove(tripRef);
        setAlert({
          show: true,
          type: "success",
          message: "✅ Xóa chuyến đi thành công",
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

  const handleAddOrUpdate = async () => {
    if (
      !newTrip.driverName ||
      !newTrip.destination ||
      !newTrip.startDate ||
      !newTrip.startTime
    ) {
      setAlert({
        show: true,
        type: "error",
        message: "❌ Vui lòng điền các trường bắt buộc",
      });
      return;
    }

    if (isDuplicateBooking) {
      setAlert({
        show: true,
        type: "error",
        message: "❌ Xe đã có lịch vào thời điểm này",
      });
      return;
    }

    try {
      if (editingId) {
        // Update existing trip
        const tripRef = ref(db, `driverTrips/${editingId}`);
        await update(tripRef, newTrip);
        setAlert({
          show: true,
          type: "success",
          message: "✅ Cập nhật chuyến đi thành công",
        });
      } else {
        // Add new trip
        const newRef = ref(db, `driverTrips/${Date.now()}`);
        await set(newRef, newTrip);
        setAlert({
          show: true,
          type: "success",
          message: "✅ Thêm chuyến đi thành công",
        });
      }
      setShowModal(false);
      setCurrentView("trips");
      resetForm();
    } catch (error) {
      setAlert({
        show: true,
        type: "error",
        message: `❌ Lỗi: ${error.message}`,
      });
    }
  };

  const handleCompleteTrip = async (trip) => {
    try {
      const tripRef = ref(db, `driverTrips/${trip.id}`);
      await update(tripRef, {
        ...trip,
        completed: true,
        endDate: new Date().toISOString().split("T")[0],
        endTime: new Date().toTimeString().slice(0, 5),
      });
      setAlert({
        show: true,
        type: "success",
        message: "✅ Đánh dấu hoàn tất thành công",
      });
    } catch (error) {
      setAlert({
        show: true,
        type: "error",
        message: `❌ Lỗi: ${error.message}`,
      });
    }
  };

  const resetForm = () => {
    setNewTrip({
      driverName: user?.name || "",
      phone: "",
      vehicleNumber: "",
      departure: "",
      destination: "",
      startKm: "",
      endKm: "",
      totalKm: "",
      startDate: new Date().toISOString().split("T")[0],
      startTime: new Date().toTimeString().slice(0, 5),
      endDate: "",
      endTime: "",
      purpose: "",
      notes: "",
      expenseDetails: "",
      completed: false,
    });
    setEditingId(null);
  };

  const openNewTripModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleOpenDetailsModal = (trip) => {
    setDetailsTrip(trip);
    setTempDetails(trip.expenseDetails || "");
    // Prefill structured form from existing structured details if available
    const d = trip?.details || {};
    setDetailsForm({
      startTime: d.startTime || "",
      endTime: d.endTime || "",
      destination: d.destination || "",
      odoFrom:
        d.odoFrom != null && d.odoFrom !== undefined ? String(d.odoFrom) : "",
      odoTo: d.odoTo != null && d.odoTo !== undefined ? String(d.odoTo) : "",
      tollFee:
        d.tollFee != null && d.tollFee !== undefined ? String(d.tollFee) : "",
      mealFee:
        d.mealFee != null && d.mealFee !== undefined ? String(d.mealFee) : "",
      overtimeHours:
        d.overtimeHours != null && d.overtimeHours !== undefined
          ? String(d.overtimeHours)
          : "",
      notes: d.notes || "",
    });
    setShowDetailsModal(true);
  };

  const handleSaveDetails = async () => {
    if (!detailsTrip) return;
    try {
      const tripRef = ref(db, `driverTrips/${detailsTrip.id}`);

      const parseNum = (v) => {
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : null;
      };

      const odoFromNum = parseNum(detailsForm.odoFrom);
      const odoToNum = parseNum(detailsForm.odoTo);
      const totalKmNum =
        odoFromNum != null && odoToNum != null ? odoToNum - odoFromNum : null;

      const detailsPayload = {
        startTime: detailsForm.startTime || null,
        endTime: detailsForm.endTime || null,
        destination: detailsForm.destination?.trim() || null,
        odoFrom: odoFromNum,
        odoTo: odoToNum,
        totalKm: totalKmNum,
        tollFee: parseNum(detailsForm.tollFee),
        mealFee: parseNum(detailsForm.mealFee),
        overtimeHours: parseNum(detailsForm.overtimeHours),
        notes: detailsForm.notes?.trim() || null,
      };

      await update(tripRef, {
        expenseDetails: tempDetails,
        details: detailsPayload,
      });

      setAlert({
        show: true,
        type: "success",
        message: "✅ Cập nhật chi tiết thành công",
      });
      setShowDetailsModal(false);
      setDetailsTrip(null);
      setTempDetails("");
    } catch (error) {
      setAlert({
        show: true,
        type: "error",
        message: `❌ Lỗi: ${error.message}`,
      });
    }
  };

  // Reset/prefill structured details form when opening details modal
  useEffect(() => {
    if (showDetailsModal && detailsTrip) {
      const d = detailsTrip.details || {};
      setDetailsForm({
        startTime: d.startTime || "",
        endTime: d.endTime || "",
        destination: d.destination || "",
        odoFrom:
          d.odoFrom != null && d.odoFrom !== undefined ? String(d.odoFrom) : "",
        odoTo: d.odoTo != null && d.odoTo !== undefined ? String(d.odoTo) : "",
        tollFee:
          d.tollFee != null && d.tollFee !== undefined ? String(d.tollFee) : "",
        mealFee:
          d.mealFee != null && d.mealFee !== undefined ? String(d.mealFee) : "",
        overtimeHours:
          d.overtimeHours != null && d.overtimeHours !== undefined
            ? String(d.overtimeHours)
            : "",
        notes: d.notes || "",
      });
    }
  }, [showDetailsModal, detailsTrip]);

  // Keep original tempDetails in sync (no logic change) from structured inputs
  useEffect(() => {
    if (!showDetailsModal) return;
    const {
      startTime,
      endTime,
      destination,
      odoFrom,
      odoTo,
      tollFee,
      mealFee,
      overtimeHours,
      notes,
    } = detailsForm;

    const odoFromNum = parseFloat(odoFrom);
    const odoToNum = parseFloat(odoTo);
    const km =
      !isNaN(odoFromNum) && !isNaN(odoToNum)
        ? (odoToNum - odoFromNum).toString()
        : "";

    const lines = [
      `Odo bắt đầu: ${odoFrom || ""}`,
      `Odo kết thúc: ${odoTo || ""}`,
      `Số km: ${km}`,
      `Thời gian: ${startTime || ""} - ${endTime || ""}`,
      `Nơi đến: ${destination || ""}`,
      `Cầu đường: ${tollFee || ""}`,
      `Ăn uống: ${mealFee || ""}`,
      `Tăng ca (giờ): ${overtimeHours || ""}`,
      `Ghi chú: ${notes || ""}`,
    ].join("\n");

    setTempDetails(lines.trim());
  }, [detailsForm, showDetailsModal]);

  // Calculate total km when endKm changes
  useEffect(() => {
    if (newTrip.startKm && newTrip.endKm) {
      const total = parseFloat(newTrip.endKm) - parseFloat(newTrip.startKm);
      setNewTrip((prev) => ({
        ...prev,
        totalKm: total > 0 ? total.toString() : "",
      }));
    }
  }, [newTrip.startKm, newTrip.endKm]);

  const completedCount = trips.filter((t) => t.completed).length;
  const filteredTrips = trips.filter((trip) => {
    if (filterTab === "ongoing") return !trip.completed;
    if (filterTab === "completed") return trip.completed;
    return true;
  });

  return (
    <>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}>
        <div className="h-full bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-6 py-5 flex items-center gap-3 shadow-md">
            <span className="text-2xl">🚚</span>
            <div>
              <h1 className="text-lg font-bold">Quản Lý Chuyến Đi</h1>
              <p className="text-xs text-blue-100">Driver Logbook</p>
            </div>
          </div>

          {/* Main Navigation */}
          <div className="px-4 py-5 space-y-3 flex-shrink-0">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-widest px-3 mb-3">
              📋 Chuyên Mục
            </p>
            <button
              onClick={() => {
                setCurrentView("schedule");
                setSidebarOpen(false);
              }}
              className={`w-full px-4 py-3.5 rounded-lg font-bold transition-all duration-200 ${
                currentView === "schedule"
                  ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg hover:shadow-xl"
                  : "text-slate-700 bg-gradient-to-r from-slate-50 to-blue-50 border border-slate-300 hover:border-indigo-400 shadow-sm hover:shadow-md hover:from-indigo-50 hover:to-blue-100"
              }`}
            >
              DANH SÁCH CHUYẾN ĐI
            </button>
            <button
              onClick={() => {
                setCurrentView("trips");
                setSidebarOpen(false);
              }}
              className={`w-full px-4 py-3.5 rounded-lg font-bold transition-all duration-200 ${
                currentView === "trips"
                  ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg hover:shadow-xl"
                  : "text-slate-700 bg-gradient-to-r from-slate-50 to-blue-50 border border-slate-300 hover:border-indigo-400 shadow-sm hover:shadow-md hover:from-indigo-50 hover:to-blue-100"
              }`}
            >
              CHI TIẾT CHUYẾN ĐI
            </button>
            <button
              onClick={() => {
                setCurrentView("add");
                setSidebarOpen(false);
              }}
              className={`w-full px-4 py-3.5 rounded-lg font-bold transition-all duration-200 ${
                currentView === "add"
                  ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg hover:shadow-xl"
                  : "text-slate-700 bg-gradient-to-r from-slate-50 to-blue-50 border border-slate-300 hover:border-indigo-400 shadow-sm hover:shadow-md hover:from-indigo-50 hover:to-blue-100"
              }`}
            >
              THÊM CHUYẾN MỚI
            </button>
          </div>

          {/* Divider */}
          <div className="px-4">
            <div className="border-t-2 border-slate-200"></div>
          </div>

          {/* Filters Section */}
          <div className="px-4 py-5 flex-1 overflow-y-auto">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-widest px-2 mb-4 flex items-center gap-2">
              <span>🔍</span>
              <span>Bộ Lọc Tìm Kiếm</span>
            </p>

            <div className="space-y-4">
              {/* Vehicle Select */}
              <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
                <label className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                  <span>🚙</span>
                  <span>Chọn Xe</span>
                </label>
                <select
                  value={selectedVehicle}
                  onChange={(e) => setSelectedVehicle(e.target.value)}
                  className="w-full border-2 border-slate-300 rounded-lg px-3 py-2.5 bg-white text-slate-700 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm font-medium hover:border-blue-400"
                >
                  <option value="">📍 Tất cả xe</option>
                  {Array.from(
                    new Set(trips.map((t) => t.vehicleNumber).filter(Boolean))
                  )
                    .sort()
                    .map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                </select>
              </div>

              {/* Date Input */}
              <div className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
                <label className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                  <span>📅</span>
                  <span>Chọn Ngày</span>
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full border-2 border-slate-300 rounded-lg px-3 py-2.5 bg-white text-slate-700 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm font-medium hover:border-blue-400"
                />
              </div>

              {/* Clear Filters Button */}
              <button
                onClick={() => {
                  setSelectedVehicle("");
                  setSelectedDate(new Date().toISOString().split("T")[0]);
                }}
                className="w-full px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                <span>🗑️</span>
                <span>Xóa Tất Cả Lọc</span>
              </button>
            </div>
          </div>

          {/* Footer Info */}
          <div className="px-4 py-4 bg-blue-50 border-t border-slate-200 text-xs text-slate-600 text-center rounded-lg m-3">
            <p className="font-semibold">💡 Mẹo</p>
            <p className="mt-1">Sử dụng bộ lọc để tìm chuyến đi nhanh hơn</p>
          </div>
        </div>
      </Sidebar>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-10 transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 md:p-8 text-slate-900">
        {/* Alert */}
        {alert.show && (
          <div
            className={`mb-4 p-3 rounded-lg font-medium flex items-center gap-2 shadow-sm ${
              alert.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            <span>{alert.type === "success" ? "✅" : "❌"}</span>
            {alert.message}
          </div>
        )}

        {/* Vehicle Schedule View - Airport Style Board */}
        {currentView === "schedule" &&
          (() => {
            // Filter trips
            const filtered = trips
              .filter(
                (t) =>
                  (!selectedVehicle || t.vehicleNumber === selectedVehicle) &&
                  t.startDate === selectedDate
              )
              .filter((trip) => {
                if (filterStatus === "all") return true;
                const status = getStatus(trip);
                return status.toLowerCase() === filterStatus.toLowerCase();
              });

            // Sort trips
            const sorted = [...filtered].sort((a, b) => {
              switch (sortBy) {
                case "time":
                  return (a.startTime || "").localeCompare(b.startTime || "");
                case "vehicle":
                  return (a.vehicleNumber || "").localeCompare(
                    b.vehicleNumber || ""
                  );
                case "driver":
                  return (a.driverName || "").localeCompare(b.driverName || "");
                case "status":
                  return getStatus(a).localeCompare(getStatus(b));
                default:
                  return 0;
              }
            });

            const currentTime = boardNow.toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div className="rounded-3xl overflow-hidden border border-transparent shadow-2xl bg-white">
                {/* Board Header - Airport Style */}
                <div className="bg-gradient-to-r from-indigo-600 via-blue-500 to-cyan-500 text-white px-4 md:px-6 py-2 border-b border-blue-100/30">
                  {/* Row 1: Menu button, Title, Time */}
                  <div className="flex items-center justify-between gap-3">
                    {/* Left: Menu Button + Title */}
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500 text-white hover:bg-blue-400 transition-colors"
                        title="Menu"
                      >
                        ☰
                      </button>
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="text-2xl md:text-3xl flex-shrink-0">
                          🚗
                        </span>
                        <div className="min-w-0">
                          <h2 className="text-lg md:text-xl font-bold truncate">
                            LỊCH CHUYẾN ĐI
                          </h2>
                          <p className="text-blue-100 text-xs md:text-sm">
                            Departure Board
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Right: Current Time */}
                    <div className="flex-shrink-0 text-right">
                      <div className="text-2xl md:text-3xl font-mono font-bold tracking-wider">
                        {currentTime}
                      </div>
                      <p className="text-blue-100 text-xs">30s</p>
                    </div>
                  </div>
                </div>

                {/* Controls - Sort & Filter */}
                <div className="flex gap-3 px-6 py-4 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-blue-100/40 flex-wrap">
                  {/* Sort Options */}
                  <div className="flex gap-2">
                    {[
                      { value: "time", label: "⏰ Giờ" },
                      { value: "vehicle", label: "🚗 Xe" },
                      { value: "driver", label: "👤 Tài Xế" },
                      { value: "status", label: "📊 Trạng Thái" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setSortBy(option.value)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                          sortBy === option.value
                            ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md"
                            : "bg-white text-slate-700 border border-slate-200 hover:border-indigo-300 hover:shadow-sm"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  {/* Filter Status */}
                  <div className="flex gap-2 ml-auto">
                    {[
                      { value: "all", label: "Tất Cả" },
                      { value: "onboard", label: "Đang Chạy" },
                      { value: "arrived", label: "Hoàn Tất" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setFilterStatus(option.value)}
                        className={`px-3 py-1 rounded text-sm font-semibold transition ${
                          filterStatus === option.value
                            ? "bg-green-600 text-white"
                            : "bg-white text-gray-700 border border-gray-300 hover:border-green-400"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Table Header */}
                <div className="grid grid-cols-8 gap-3 bg-blue-600 text-blue-50 text-xs font-bold px-6 py-3">
                  <div>⏰ GIỜ ĐI</div>
                  <div>🚗 BIỂN SỐ XE</div>
                  <div>👤 TÀI XẾ</div>
                  <div>📱 SỐ ĐIỆN THOẠI</div>
                  <div>📍 ĐIỂM ĐI</div>
                  <div>🏁 ĐIỂM ĐẾN</div>
                  <div>📊 TRẠNG THÁI</div>
                  <div>📝 GHI CHÚ</div>
                </div>

                {/* Rows */}
                {sorted.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <p className="text-gray-400 text-lg">
                      🛫 Không có chuyến đi nào
                    </p>
                    <p className="text-gray-300 text-sm mt-2">
                      Chọn ngày hoặc xe khác để xem lịch
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {sorted.map((trip, idx) => {
                      const status = getStatus(trip);
                      const scheduled = formatTime(
                        trip.startDate,
                        trip.startTime
                      );
                      const estimated =
                        trip.endDate && trip.endTime
                          ? formatTime(trip.endDate, trip.endTime)
                          : "-";

                      const baseZebra =
                        idx % 2 === 0 ? "bg-gray-800" : "bg-gray-500";
                      const rowBgColor = baseZebra;

                      return (
                        <div
                          key={`board-${trip.id}`}
                          className={`grid grid-cols-8 gap-3 px-4 py-3 items-center ${rowBgColor} transition border-l-4 border-yellow-400 hover:shadow-md`}
                        >
                          {/* Time */}
                          <div className="font-mono text-lg font-bold text-yellow-300">
                            {scheduled}
                            {estimated !== "-" && (
                              <div className="text-xs text-pink-300 mt-1">
                                ← {estimated}
                              </div>
                            )}
                          </div>

                          {/* Vehicle */}
                          <div className="text-white font-bold">
                            {trip.vehicleNumber || "N/A"}
                          </div>

                          {/* Driver */}
                          <div className="text-white font-bold">
                            {trip.driverName || "-"}
                          </div>

                          {/* Phone */}
                          <div className="text-white font-bold">
                            {trip.phone || "-"}
                          </div>

                          {/* Departure */}
                          <div className="text-white font-bold">
                            {trip.departure || "-"}
                          </div>

                          {/* Destination */}
                          <div className="text-white font-bold">
                            {trip.destination || "-"}
                          </div>

                          {/* Status */}
                          <div>
                            <StatusBadge trip={trip} />
                          </div>

                          {/* Notes */}
                          <div className="text-xs text-gray-200">
                            {trip.notes ||
                              (trip.totalKm ? `${trip.totalKm} km` : "-")}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Footer */}
                <div className="px-6 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 text-xs text-slate-600 text-center border-t border-blue-100/40">
                  💡 Tổng {sorted.length} chuyến | Cập nhật tự động mỗi 30 giây
                </div>
              </div>
            );
          })()}

        {currentView === "trips" && (
          <>
            {/* Filter Tabs */}
            <div className="mb-4 flex gap-2 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700 transition-colors flex-shrink-0"
                title="Menu"
              >
                ☰
              </button>
              <button
                onClick={() => setFilterTab("all")}
                className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                  filterTab === "all"
                    ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md"
                    : "text-slate-700 hover:text-indigo-600"
                }`}
              >
                Tất Cả ({trips.length})
              </button>
              <button
                onClick={() => setFilterTab("ongoing")}
                className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                  filterTab === "ongoing"
                    ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md"
                    : "text-slate-700 hover:text-indigo-600"
                }`}
              >
                Đang Chạy ({trips.filter((t) => !t.completed).length})
              </button>
              <button
                onClick={() => setFilterTab("completed")}
                className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                  filterTab === "completed"
                    ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md"
                    : "text-slate-700 hover:text-indigo-600"
                }`}
              >
                Hoàn Tất ({trips.filter((t) => t.completed).length})
              </button>
            </div>

            {/* Trips Table */}
            <div className="bg-white rounded-3xl border border-transparent overflow-hidden shadow-xl">
              {filteredTrips.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-6xl mb-4">🚗</div>
                  <p className="text-slate-600 text-xl font-semibold">
                    {filterTab === "ongoing"
                      ? "Không có chuyến đi đang chạy"
                      : filterTab === "completed"
                      ? "Chưa có chuyến đi nào hoàn tất"
                      : "Chưa có chuyến đi nào"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white border-b border-indigo-100/30">
                      <tr className="uppercase tracking-widest text-[12px] font-bold">
                        <th className="px-4 py-4 text-center">Hoàn Tất</th>
                        <th className="px-4 py-4 text-center">Tài Xế</th>
                        <th className="px-4 py-4 text-center">Điện Thoại</th>
                        <th className="px-4 py-4 text-center">Số Xe</th>
                        <th className="px-4 py-4 text-center">
                          Điểm Đi - Điểm Đến
                        </th>
                        <th className="px-4 py-4 text-center">Km</th>
                        <th className="px-4 py-4 text-center">Thời Gian</th>
                        <th className="px-4 py-4 text-center">Chi Tiết</th>
                        <th className="px-4 py-4 text-center">Trạng Thái</th>
                        <th className="px-4 py-4 text-center w-32">Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/50">
                      {filteredTrips.map((trip) => (
                        <tr
                          key={trip.id}
                          className="transition-colors odd:bg-gray-900 even:bg-gray-700 hover:bg-gray-800 text-white"
                        >
                          <td className="px-4 py-4 text-center">
                            <div className="flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={trip.completed}
                                onChange={() => handleCompleteTrip(trip)}
                                disabled={trip.completed}
                                className={`w-5 h-5 rounded ${
                                  trip.completed
                                    ? "text-green-600 cursor-not-allowed opacity-70"
                                    : "text-blue-600 cursor-pointer"
                                }`}
                                title={
                                  trip.completed
                                    ? "Chuyến đi đã hoàn tất"
                                    : "Click để đánh dấu hoàn tất"
                                }
                              />
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="flex items-center gap-2 justify-center">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-200 to-blue-200 border border-indigo-300 flex items-center justify-center text-indigo-700 font-semibold text-sm">
                                {(trip.driverName || "?")[0].toUpperCase()}
                              </div>
                              <span className="font-bold text-white">
                                {trip.driverName}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            {trip.phone ? (
                              <a
                                href={`tel:${trip.phone}`}
                                className="text-white hover:text-yellow-400 font-semibold"
                              >
                                {trip.phone}
                              </a>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-center">
                            <span className="px-3 py-1 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200">
                              {trip.vehicleNumber || "N/A"}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="text-sm text-white">
                              <p className="font-semibold text-white">
                                📍 {trip.departure || "Chưa xác định"} →{" "}
                                {trip.destination}
                              </p>
                              {trip.purpose && (
                                <p className="text-gray-300 mt-1 text-xs">
                                  🎯 {trip.purpose}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="text-sm text-white">
                              <p className="text-gray-300 font-medium">
                                Bắt đầu:{" "}
                                <span className="font-bold text-white">
                                  {trip.startKm || 0} km
                                </span>
                              </p>
                              {trip.endKm && (
                                <>
                                  <p className="text-gray-300 mt-1 font-medium">
                                    Kết thúc:{" "}
                                    <span className="font-bold text-white">
                                      {trip.endKm} km
                                    </span>
                                  </p>
                                  <p className="text-white font-bold mt-1">
                                    Tổng:{" "}
                                    {trip.totalKm ||
                                      parseFloat(trip.endKm) -
                                        parseFloat(trip.startKm)}{" "}
                                    km (
                                    <span className="text-cyan-300">
                                      chính xác
                                    </span>
                                    )
                                  </p>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="text-sm text-white">
                              <p className="text-gray-300 font-medium">
                                <span className="font-semibold text-white">
                                  Xuất phát:
                                </span>{" "}
                                {new Date(trip.startDate).toLocaleDateString(
                                  "vi-VN"
                                )}{" "}
                                {trip.startTime}
                              </p>
                              {trip.completed && trip.endDate && (
                                <p className="text-green-400 font-medium mt-1">
                                  <span className="font-semibold">Về:</span>{" "}
                                  {new Date(trip.endDate).toLocaleDateString(
                                    "vi-VN"
                                  )}{" "}
                                  {trip.endTime}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <button
                              onClick={() => handleOpenDetailsModal(trip)}
                              className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-all hover:shadow-md"
                              title="Xem/Nhập chi tiết chi phí & odo"
                            >
                              💰
                            </button>
                          </td>
                          <td className="px-4 py-4 text-center">
                            {trip.completed ? (
                              <span className="px-3 py-1 rounded-lg bg-green-100 text-green-700 text-xs font-semibold border border-green-200">
                                ✓ Hoàn tất
                              </span>
                            ) : (
                              <span className="px-3 py-1 rounded-lg bg-amber-100 text-amber-700 text-xs font-semibold border border-amber-200">
                                ⟳ Đang chạy
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEdit(trip)}
                                disabled={trip.completed}
                                className={`p-2 rounded-lg transition-all ${
                                  trip.completed
                                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                    : "bg-indigo-100 text-indigo-600 hover:bg-indigo-200 hover:shadow-md"
                                }`}
                                title={
                                  trip.completed
                                    ? "Không thể chỉnh sửa chuyến đi đã hoàn tất"
                                    : "Chỉnh sửa"
                                }
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDelete(trip.id)}
                                disabled={user?.email !== "admin@gmail.com"}
                                className={`p-2 rounded-lg transition-all ${
                                  user?.email === "admin@gmail.com"
                                    ? "bg-red-100 text-red-600 hover:bg-red-200 hover:shadow-md"
                                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                                }`}
                                title={
                                  user?.email === "admin@gmail.com"
                                    ? "Xóa"
                                    : "Chỉ admin mới có quyền xóa"
                                }
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
          </>
        )}

        {/* Add Trip Form View */}
        {currentView === "add" && (
          <div className="bg-white rounded-2xl shadow-2xl w-full">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 px-8 py-6 flex items-center justify-between rounded-t-2xl shadow-lg">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-white bg-opacity-20 text-white hover:bg-opacity-40 transition-all"
                  title="Menu"
                >
                  ☰
                </button>
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <span className="text-3xl">🚚</span>
                  <span>Thêm Chuyến Đi Mới</span>
                </h2>
              </div>
              <button
                onClick={() => {
                  setCurrentView("trips");
                  resetForm();
                }}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-full w-10 h-10 flex items-center justify-center transition-all duration-200 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-6 auto-rows-max">
              {/* Column 1 */}
              <div className="space-y-6">
                {/* Driver, Phone & Vehicle */}
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-100">
                  <h3 className="text-sm font-bold text-blue-900 mb-4 flex items-center gap-2">
                    <span>👤</span>
                    <span>Thông Tin Tài Xế & Xe</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <span className="text-red-500">*</span>
                        <span>Tên Tài Xế</span>
                      </label>
                      <input
                        type="text"
                        value={newTrip.driverName}
                        onChange={(e) =>
                          setNewTrip({ ...newTrip, driverName: e.target.value })
                        }
                        className="w-full border-2 border-blue-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-base font-medium bg-white hover:border-blue-300"
                        placeholder="VD: Nguyễn Văn A"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <span>📞</span>
                        <span>Số Điện Thoại</span>
                      </label>
                      <input
                        type="tel"
                        value={newTrip.phone}
                        onChange={(e) =>
                          setNewTrip({ ...newTrip, phone: e.target.value })
                        }
                        className="w-full border-2 border-blue-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-base font-medium bg-white hover:border-blue-300"
                        placeholder="VD: 0901234567"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <span>🚙</span>
                        <span>Biển Số Xe</span>
                      </label>
                      <input
                        type="text"
                        value={newTrip.vehicleNumber}
                        onChange={(e) =>
                          setNewTrip({
                            ...newTrip,
                            vehicleNumber: e.target.value,
                          })
                        }
                        className="w-full border-2 border-blue-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-base font-medium bg-white hover:border-blue-300"
                        placeholder="VD: 51A-12345"
                      />
                    </div>
                  </div>
                </div>

                {/* Departure & Destination */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-100">
                  <h3 className="text-sm font-bold text-amber-900 mb-4 flex items-center gap-2">
                    <span>🗺️</span>
                    <span>Tuyến Đường</span>
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <span>📍</span>
                        <span>Điểm Đi</span>
                      </label>
                      <input
                        type="text"
                        value={newTrip.departure}
                        onChange={(e) =>
                          setNewTrip({ ...newTrip, departure: e.target.value })
                        }
                        className="w-full border-2 border-amber-200 rounded-lg px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all text-base font-medium bg-white hover:border-amber-300"
                        placeholder="VD: Công ty ABC"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <span className="text-red-500">*</span>
                        <span>🎯 Điểm Đến</span>
                      </label>
                      <input
                        type="text"
                        value={newTrip.destination}
                        onChange={(e) =>
                          setNewTrip({
                            ...newTrip,
                            destination: e.target.value,
                          })
                        }
                        className="w-full border-2 border-amber-200 rounded-lg px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all text-base font-medium bg-white hover:border-amber-300"
                        placeholder="VD: TP. Hồ Chí Minh"
                      />
                    </div>
                  </div>
                </div>
                {/* Notes */}
                <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl p-6 border border-indigo-100">
                  <label className="text-sm font-bold text-indigo-900 mb-3 flex items-center gap-2">
                    <span>📝</span>
                    <span>Ghi Chú</span>
                  </label>
                  <textarea
                    value={newTrip.notes}
                    onChange={(e) =>
                      setNewTrip({ ...newTrip, notes: e.target.value })
                    }
                    className="w-full border-2 border-indigo-200 rounded-lg px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all resize-none text-base font-medium bg-white hover:border-indigo-300"
                    placeholder="Ghi chú thêm về chuyến đi..."
                    rows="4"
                  ></textarea>
                </div>
              </div>

              {/* Column 2 */}
              <div className="space-y-6">
                {/* Date & Time */}
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100">
                  <h3 className="text-sm font-bold text-purple-900 mb-4 flex items-center gap-2">
                    <span>⏱️</span>
                    <span>Thời Gian</span>
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <span className="text-red-500">*</span>
                        <span>📅 Ngày Xuất Phát</span>
                      </label>
                      <input
                        type="date"
                        value={newTrip.startDate}
                        onChange={(e) =>
                          setNewTrip({ ...newTrip, startDate: e.target.value })
                        }
                        className="w-full border-2 border-purple-200 rounded-lg px-4 py-3 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all text-base font-medium bg-white hover:border-purple-300"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <span className="text-red-500">*</span>
                        <span>⏰ Giờ Xuất Phát</span>
                      </label>
                      <input
                        type="time"
                        value={newTrip.startTime}
                        onChange={(e) =>
                          setNewTrip({ ...newTrip, startTime: e.target.value })
                        }
                        className="w-full border-2 border-purple-200 rounded-lg px-4 py-3 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all text-base font-medium bg-white hover:border-purple-300"
                      />
                    </div>
                  </div>
                </div>

                {isDuplicateBooking && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-red-50 to-red-100 text-red-800 border-2 border-red-300 font-semibold flex items-start gap-3 shadow-md">
                    <span className="text-2xl mt-1">⚠️</span>
                    <div>
                      <div className="font-bold">Lịch Đã Tồn Tại!</div>
                      <div className="text-sm font-normal mt-1">
                        Xe{" "}
                        <span className="font-bold">
                          {newTrip.vehicleNumber}
                        </span>{" "}
                        đã có lịch vào{" "}
                        <span className="font-bold">{newTrip.startDate}</span>{" "}
                        lúc{" "}
                        <span className="font-bold">{newTrip.startTime}</span>.
                        Vui lòng chọn thời điểm khác.
                      </div>
                    </div>
                  </div>
                )}

                {/* Purpose */}
                <div className="bg-gradient-to-br from-cyan-50 to-sky-50 rounded-xl p-6 border border-cyan-100">
                  <label className="text-sm font-bold text-cyan-900 mb-3 flex items-center gap-2">
                    <span>🎯</span>
                    <span>Mục Đích Chuyến Đi</span>
                  </label>
                  <input
                    type="text"
                    value={newTrip.purpose}
                    onChange={(e) =>
                      setNewTrip({ ...newTrip, purpose: e.target.value })
                    }
                    className="w-full border-2 border-cyan-200 rounded-lg px-4 py-3 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none transition-all text-base font-medium bg-white hover:border-cyan-300"
                    placeholder="VD: Giao hàng, Công tác, ..."
                  />
                </div>
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-8 py-5 flex gap-3 justify-end rounded-b-2xl border-t-2 border-gray-200 shadow-lg">
                  <button
                    onClick={() => {
                      setCurrentView("schedule");
                      resetForm();
                    }}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-bold transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center gap-2 shadow-md"
                  >
                    <span>❌</span>
                    <span>Hủy</span>
                  </button>
                  <button
                    onClick={handleAddOrUpdate}
                    disabled={isDuplicateBooking}
                    className={`px-6 py-3 rounded-lg font-bold transition-all duration-200 transform active:scale-95 flex items-center gap-2 shadow-md ${
                      isDuplicateBooking
                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                        : "bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700 hover:shadow-lg hover:scale-105"
                    }`}
                  >
                    <span>🚀</span>
                    <span>Thêm Mới</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4 backdrop-blur-sm">
            <div className="bg-white sm:rounded-2xl shadow-2xl w-full h-full sm:max-w-5xl sm:max-h-[90vh] flex flex-col overflow-hidden">
              <div className="sticky top-0 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 px-4 py-4 sm:px-8 sm:py-6 flex items-center justify-between sm:rounded-t-2xl shadow-lg">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  {editingId ? (
                    <>
                      <span className="text-3xl">✏️</span>
                      <span>Chỉnh Sửa Chuyến Đi</span>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl">🚚</span>
                      <span>Thêm Chuyến Đi Mới</span>
                    </>
                  )}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full w-10 h-10 flex items-center justify-center transition-all duration-200 text-xl font-bold"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 auto-rows-max">
                {/* Column 1 */}
                <div className="space-y-6">
                  {/* Driver, Phone & Vehicle */}
                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-100">
                    <h3 className="text-sm font-bold text-blue-900 mb-4 flex items-center gap-2">
                      <span>👤</span>
                      <span>Thông Tin Tài Xế & Xe</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                          <span className="text-red-500">*</span>
                          <span>Tên Tài Xế</span>
                        </label>
                        <input
                          type="text"
                          value={newTrip.driverName}
                          onChange={(e) =>
                            setNewTrip({
                              ...newTrip,
                              driverName: e.target.value,
                            })
                          }
                          disabled={
                            editingId &&
                            trips.find((t) => t.id === editingId)?.completed
                          }
                          className={`w-full border-2 border-blue-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-base font-medium ${
                            editingId &&
                            trips.find((t) => t.id === editingId)?.completed
                              ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                              : "bg-white hover:border-blue-300"
                          }`}
                          placeholder="VD: Nguyễn Văn A"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                          <span>📞</span>
                          <span>Số Điện Thoại</span>
                        </label>
                        <input
                          type="tel"
                          value={newTrip.phone}
                          onChange={(e) =>
                            setNewTrip({ ...newTrip, phone: e.target.value })
                          }
                          disabled={
                            editingId &&
                            trips.find((t) => t.id === editingId)?.completed
                          }
                          className={`w-full border-2 border-blue-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-base font-medium ${
                            editingId &&
                            trips.find((t) => t.id === editingId)?.completed
                              ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                              : "bg-white hover:border-blue-300"
                          }`}
                          placeholder="VD: 0901234567"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                          <span>🚙</span>
                          <span>Biển Số Xe</span>
                        </label>
                        <input
                          type="text"
                          value={newTrip.vehicleNumber}
                          onChange={(e) =>
                            setNewTrip({
                              ...newTrip,
                              vehicleNumber: e.target.value,
                            })
                          }
                          disabled={
                            editingId &&
                            trips.find((t) => t.id === editingId)?.completed
                          }
                          className={`w-full border-2 border-blue-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-base font-medium ${
                            editingId &&
                            trips.find((t) => t.id === editingId)?.completed
                              ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                              : "bg-white hover:border-blue-300"
                          }`}
                          placeholder="VD: 51A-12345"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Departure & Destination */}
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-100">
                    <h3 className="text-sm font-bold text-amber-900 mb-4 flex items-center gap-2">
                      <span>🗺️</span>
                      <span>Tuyến Đường</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                          <span>📍</span>
                          <span>Điểm Đi</span>
                        </label>
                        <input
                          type="text"
                          value={newTrip.departure}
                          onChange={(e) =>
                            setNewTrip({
                              ...newTrip,
                              departure: e.target.value,
                            })
                          }
                          disabled={
                            editingId &&
                            trips.find((t) => t.id === editingId)?.completed
                          }
                          className={`w-full border-2 border-amber-200 rounded-lg px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all text-base font-medium ${
                            editingId &&
                            trips.find((t) => t.id === editingId)?.completed
                              ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                              : "bg-white hover:border-amber-300"
                          }`}
                          placeholder="VD: Công ty ABC"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                          <span className="text-red-500">*</span>
                          <span>🎯 Điểm Đến</span>
                        </label>
                        <input
                          type="text"
                          value={newTrip.destination}
                          onChange={(e) =>
                            setNewTrip({
                              ...newTrip,
                              destination: e.target.value,
                            })
                          }
                          disabled={
                            editingId &&
                            trips.find((t) => t.id === editingId)?.completed
                          }
                          className={`w-full border-2 border-amber-200 rounded-lg px-4 py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all text-base font-medium ${
                            editingId &&
                            trips.find((t) => t.id === editingId)?.completed
                              ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                              : "bg-white hover:border-amber-300"
                          }`}
                          placeholder="VD: TP. Hồ Chí Minh"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 2 */}
                <div className="space-y-6">
                  {/* Date & Time */}
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100">
                    <h3 className="text-sm font-bold text-purple-900 mb-4 flex items-center gap-2">
                      <span>⏱️</span>
                      <span>Thời Gian</span>
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                          <span className="text-red-500">*</span>
                          <span>📅 Ngày Xuất Phát</span>
                        </label>
                        <input
                          type="date"
                          value={newTrip.startDate}
                          onChange={(e) =>
                            setNewTrip({
                              ...newTrip,
                              startDate: e.target.value,
                            })
                          }
                          disabled={
                            editingId &&
                            trips.find((t) => t.id === editingId)?.completed
                          }
                          className={`w-full border-2 border-purple-200 rounded-lg px-4 py-3 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all text-base font-medium ${
                            editingId &&
                            trips.find((t) => t.id === editingId)?.completed
                              ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                              : "bg-white hover:border-purple-300"
                          }`}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                          <span className="text-red-500">*</span>
                          <span>⏰ Giờ Xuất Phát</span>
                        </label>
                        <input
                          type="time"
                          value={newTrip.startTime}
                          onChange={(e) =>
                            setNewTrip({
                              ...newTrip,
                              startTime: e.target.value,
                            })
                          }
                          disabled={
                            editingId &&
                            trips.find((t) => t.id === editingId)?.completed
                          }
                          className={`w-full border-2 border-purple-200 rounded-lg px-4 py-3 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all text-base font-medium ${
                            editingId &&
                            trips.find((t) => t.id === editingId)?.completed
                              ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                              : "bg-white hover:border-purple-300"
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {isDuplicateBooking && (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-red-50 to-red-100 text-red-800 border-2 border-red-300 font-semibold flex items-start gap-3 shadow-md">
                      <span className="text-2xl mt-1">⚠️</span>
                      <div>
                        <div className="font-bold">Lịch Đã Tồn Tại!</div>
                        <div className="text-sm font-normal mt-1">
                          Xe{" "}
                          <span className="font-bold">
                            {newTrip.vehicleNumber}
                          </span>{" "}
                          đã có lịch vào{" "}
                          <span className="font-bold">{newTrip.startDate}</span>{" "}
                          lúc{" "}
                          <span className="font-bold">{newTrip.startTime}</span>
                          . Vui lòng chọn thời điểm khác.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Purpose */}
                  <div className="bg-gradient-to-br from-cyan-50 to-sky-50 rounded-xl p-6 border border-cyan-100">
                    <label className="text-sm font-bold text-cyan-900 mb-3 flex items-center gap-2">
                      <span>🎯</span>
                      <span>Mục Đích Chuyến Đi</span>
                    </label>
                    <input
                      type="text"
                      value={newTrip.purpose}
                      onChange={(e) =>
                        setNewTrip({ ...newTrip, purpose: e.target.value })
                      }
                      disabled={
                        editingId &&
                        trips.find((t) => t.id === editingId)?.completed
                      }
                      className={`w-full border-2 border-cyan-200 rounded-lg px-4 py-3 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none transition-all text-base font-medium ${
                        editingId &&
                        trips.find((t) => t.id === editingId)?.completed
                          ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                          : "bg-white hover:border-cyan-300"
                      }`}
                      placeholder="VD: Giao hàng, Công tác, ..."
                    />
                  </div>

                  {/* Notes */}
                  <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl p-6 border border-indigo-100">
                    <label className="text-sm font-bold text-indigo-900 mb-3 flex items-center gap-2">
                      <span>📝</span>
                      <span>Ghi Chú</span>
                    </label>
                    <textarea
                      value={newTrip.notes}
                      onChange={(e) =>
                        setNewTrip({ ...newTrip, notes: e.target.value })
                      }
                      disabled={
                        editingId &&
                        trips.find((t) => t.id === editingId)?.completed
                      }
                      className={`w-full border-2 border-indigo-200 rounded-lg px-4 py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all resize-none text-base font-medium ${
                        editingId &&
                        trips.find((t) => t.id === editingId)?.completed
                          ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                          : "bg-white hover:border-indigo-300"
                      }`}
                      placeholder="Ghi chú thêm về chuyến đi..."
                      rows="4"
                    ></textarea>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-4 sm:px-8 sm:py-5 flex gap-3 justify-end sm:rounded-b-2xl border-t-2 border-gray-200 shadow-lg pb-[env(safe-area-inset-bottom)]">
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="px-5 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-bold transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center gap-2 shadow-md"
                >
                  <span>❌</span>
                  <span>Hủy</span>
                </button>
                <button
                  onClick={handleAddOrUpdate}
                  disabled={isDuplicateBooking}
                  className={`px-5 py-3 rounded-lg font-bold transition-all duration-200 transform active:scale-95 flex items-center gap-2 shadow-md ${
                    isDuplicateBooking
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700 hover:shadow-lg hover:scale-105"
                  }`}
                >
                  <span>{editingId ? "💾" : "🚀"}</span>
                  <span>{editingId ? "Cập Nhật" : "Thêm Mới"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Details Modal */}
        {showDetailsModal && detailsTrip && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white sm:rounded-xl border shadow-md w-full h-full sm:max-w-2xl sm:max-h-[90vh] flex flex-col overflow-hidden">
              <div className="sticky top-0 bg-white border-b px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between sm:rounded-t-xl">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <span>💰</span>
                  <span className="uppercase">Bảng thông tin chi tiết</span>
                </h2>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setDetailsTrip(null);
                    setTempDetails("");
                  }}
                  className="text-gray-600 hover:bg-gray-100 rounded-full w-9 h-9 flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {/* Thông tin chuyến đi */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-5 rounded-xl border border-blue-300 shadow-sm">
                  <h3 className="font-bold text-blue-900 mb-4 text-base flex items-center gap-2">
                    <span>📋</span>
                    <span>Thông tin chuyến đi</span>
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="flex flex-col">
                      <span className="text-blue-600 font-semibold text-xs uppercase tracking-wide mb-1">
                        Tài xế
                      </span>
                      <span className="text-gray-800 font-bold text-lg">
                        {detailsTrip.driverName}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-blue-600 font-semibold text-xs uppercase tracking-wide mb-1">
                        Biển số xe
                      </span>
                      <span className="text-gray-800 font-bold text-lg">
                        {detailsTrip.vehicleNumber}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-blue-600 font-semibold text-xs uppercase tracking-wide mb-1">
                        Số điện thoại
                      </span>
                      <span className="text-gray-800 font-bold text-lg">
                        {detailsTrip.phoneNumber || "N/A"}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-blue-600 font-semibold text-xs uppercase tracking-wide mb-1">
                        Điểm đi
                      </span>
                      <span className="text-gray-800 font-bold text-lg">
                        {detailsTrip.departure || "N/A"}
                      </span>
                    </div>
                    <div className="col-span-2 flex flex-col">
                      <span className="text-blue-600 font-semibold text-xs uppercase tracking-wide mb-1">
                        Điểm đến
                      </span>
                      <span className="text-gray-800 font-bold text-lg">
                        {detailsTrip.destination}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Form chi tiết chi phí & Odo */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span>📝</span>
                    <h3 className="text-sm font-bold text-gray-800">
                      Chi Tiết Chi Phí & Số Odo
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Thời gian từ - đến */}
                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                      <label className="text-xs font-bold text-gray-700 mb-2 block">
                        Thời gian (từ - đến)
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="time"
                          value={detailsForm.startTime}
                          onChange={(e) =>
                            setDetailsForm((p) => ({
                              ...p,
                              startTime: e.target.value,
                            }))
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                        />
                        <input
                          type="time"
                          value={detailsForm.endTime}
                          onChange={(e) =>
                            setDetailsForm((p) => ({
                              ...p,
                              endTime: e.target.value,
                            }))
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                        />
                      </div>
                    </div>

                    {/* Nơi đến */}
                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                      <label className="text-xs font-bold text-gray-700 mb-2 block">
                        Nơi đến
                      </label>
                      <input
                        type="text"
                        value={detailsForm.destination}
                        onChange={(e) =>
                          setDetailsForm((p) => ({
                            ...p,
                            destination: e.target.value,
                          }))
                        }
                        placeholder="VD: Kho A, Công trình B..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                      />
                    </div>

                    {/* Odo từ - đến */}
                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                      <label className="text-xs font-bold text-gray-700 mb-2 block">
                        Odo (từ - đến)
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          value={detailsForm.odoFrom}
                          onChange={(e) =>
                            setDetailsForm((p) => ({
                              ...p,
                              odoFrom: e.target.value,
                            }))
                          }
                          placeholder="Odo từ"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                        />
                        <input
                          type="number"
                          inputMode="decimal"
                          value={detailsForm.odoTo}
                          onChange={(e) =>
                            setDetailsForm((p) => ({
                              ...p,
                              odoTo: e.target.value,
                            }))
                          }
                          placeholder="Odo đến"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                        />
                      </div>
                    </div>

                    {/* Số KM = odo đến - odo từ */}
                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                      <label className="text-xs font-bold text-gray-700 mb-2 block">
                        Số KM (tự tính)
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={(() => {
                          const a = parseFloat(detailsForm.odoFrom);
                          const b = parseFloat(detailsForm.odoTo);
                          return !isNaN(a) && !isNaN(b) ? b - a : "";
                        })()}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-700 text-sm"
                      />
                    </div>

                    {/* Phí cầu đường */}
                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                      <label className="text-xs font-bold text-gray-700 mb-2 block">
                        Phí cầu đường (đ)
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={detailsForm.tollFee}
                        onChange={(e) =>
                          setDetailsForm((p) => ({
                            ...p,
                            tollFee: e.target.value,
                          }))
                        }
                        placeholder="VD: 500000"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                      />
                    </div>

                    {/* Tiền ăn */}
                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                      <label className="text-xs font-bold text-gray-700 mb-2 block">
                        Tiền ăn (đ)
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={detailsForm.mealFee}
                        onChange={(e) =>
                          setDetailsForm((p) => ({
                            ...p,
                            mealFee: e.target.value,
                          }))
                        }
                        placeholder="VD: 150000"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                      />
                    </div>

                    {/* Giờ tăng ca */}
                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                      <label className="text-xs font-bold text-gray-700 mb-2 block">
                        Giờ tăng ca
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        value={detailsForm.overtimeHours}
                        onChange={(e) =>
                          setDetailsForm((p) => ({
                            ...p,
                            overtimeHours: e.target.value,
                          }))
                        }
                        placeholder="VD: 2"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                      />
                    </div>

                    {/* Ghi chú */}
                    <div className="md:col-span-2 bg-white rounded-lg p-4 border border-slate-200">
                      <label className="text-xs font-bold text-gray-700 mb-2 block">
                        Ghi chú
                      </label>
                      <textarea
                        value={detailsForm.notes}
                        onChange={(e) =>
                          setDetailsForm((p) => ({
                            ...p,
                            notes: e.target.value,
                          }))
                        }
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm resize-y"
                        placeholder="Ghi chú thêm..."
                      />
                    </div>
                  </div>

                  <p className="text-xs text-gray-500">
                    💡 Dữ liệu được lưu dạng cấu trúc trong Firebase (kèm văn
                    bản cũ) để dễ tái sử dụng.
                  </p>
                </div>
              </div>

              <div className="sticky bottom-0 bg-gray-50 px-4 py-3 sm:px-6 sm:py-4 flex gap-3 justify-end sm:rounded-b-xl border-t pb-[env(safe-area-inset-bottom)]">
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setDetailsTrip(null);
                    setTempDetails("");
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                >
                  ❌ Hủy
                </button>
                <button
                  onClick={handleSaveDetails}
                  className="px-4 py-2 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700"
                >
                  💾 Lưu Chi Tiết
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default DriverLogbook;
