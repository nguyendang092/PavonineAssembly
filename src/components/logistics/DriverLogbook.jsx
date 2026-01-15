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

function StatusBadge({ trip, mobile = false }) {
  const status = getStatus(trip);
  const statusConfig = {
    SCHEDULED: {
      label: "Đã Lên Lịch",
      color: "bg-blue-100 text-blue-700",
      icon: "📅",
    },
    ONBOARD: {
      label: "Đi công tác",
      color: "bg-amber-100 text-amber-700",
      icon: "🚗",
    },
    ARRIVED: {
      label: "Đang ở công ty",
      color: "bg-green-100 text-green-700",
      icon: "✅",
    },
    DELAYED: { label: "Chậm", color: "bg-red-100 text-red-700", icon: "⚠️" },
  };

  const config = statusConfig[status] || statusConfig.SCHEDULED;

  // Mobile: chỉ hiển thị icon
  if (mobile) {
    return (
      <div className="text-xl" title={config.label}>
        {config.icon}
      </div>
    );
  }

  // Desktop: hiển thị đầy đủ
  return (
    <div
      className={`px-3 py-1 rounded-full text-xs font-bold ${config.color} flex items-center justify-center gap-1 w-fit mx-auto`}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </div>
  );
}

// Vehicle type options
const VEHICLE_TYPES = [
  "Black Sedona",
  "White Sedona",
  "Truck",
  "Carnival",
  "Carnival HYB",
];

function DriverLogbook() {
  const { t } = useTranslation();
  const { user } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState("schedule"); // schedule, trips, drivers
  const [trips, setTrips] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsTrip, setDetailsTrip] = useState(null);
  const [showOutsideModal, setShowOutsideModal] = useState(false);
  const [outsideTrip, setOutsideTrip] = useState(null);
  const [outsideForm, setOutsideForm] = useState({
    startTime: "",
    endTime: "",
    destination: "",
    odoFrom: "",
    odoTo: "",
    fee: "",
    purpose: "",
  });
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
    vehicleType: "",
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
    requestTime: new Date().toISOString().slice(0, 16),
    departmentRequest: "",
    status: "scheduled",
  });
  // Board/List view toggle
  const [viewMode, setViewMode] = useState("list");

  // Autocomplete states
  const [driverSuggestions, setDriverSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [drivers, setDrivers] = useState({});

  // Driver management states
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [editingDriverId, setEditingDriverId] = useState(null);
  const [driverForm, setDriverForm] = useState({
    name: "",
    phone: "",
    vehicleNumber: "",
    vehicleType: "",
  });

  // Check if user is admin or HR
  const isAdminOrHR = React.useMemo(() => {
    if (!user?.email) return false;
    return (
      user.email === "admin@gmail.com" ||
      user.email.toLowerCase().includes("hr")
    );
  }, [user?.email]);

  // Danh sách users được phép xem xe 72A-875.15
  const RESTRICTED_VEHICLE = "72A-875.15";
  const allowedUsersFor72A = React.useMemo(() => {
    return [
      "admin@gmail.com",
      // Thêm email của các users được phép xem xe này
      // Ví dụ: "user1@gmail.com", "user2@gmail.com"
    ];
  }, []);

  // Kiểm tra user có quyền xem xe 72A-875.15 không
  const canViewRestrictedVehicle = React.useMemo(() => {
    if (!user?.email) return false;
    return isAdminOrHR || allowedUsersFor72A.includes(user.email.toLowerCase());
  }, [user?.email, isAdminOrHR, allowedUsersFor72A]);

  // Hàm filter trips dựa trên quyền truy cập
  const filterTripsByPermission = React.useCallback(
    (tripsList) => {
      return tripsList.filter((trip) => {
        // Nếu không phải xe bị hạn chế, cho phép xem
        if (trip.vehicleNumber !== RESTRICTED_VEHICLE) return true;
        // Nếu là xe bị hạn chế, chỉ cho phép nếu user có quyền
        return canViewRestrictedVehicle;
      });
    },
    [canViewRestrictedVehicle]
  );

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

  // Load drivers from Firebase
  useEffect(() => {
    const driversRef = ref(db, "drivers");
    const unsubscribe = onValue(driversRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === "object") {
        setDrivers(data);
      } else {
        setDrivers({});
      }
    });
    return () => unsubscribe();
  }, []);

  // Convert drivers object to array for filtering
  const driversList = React.useMemo(() => {
    return Object.entries(drivers).map(([id, driver]) => ({
      id,
      ...driver,
    }));
  }, [drivers]);

  // Handle driver name input change with autocomplete
  const handleDriverNameChange = (value) => {
    setNewTrip({ ...newTrip, driverName: value });

    if (value.trim().length > 0) {
      let filtered = driversList.filter((driver) =>
        driver.name.toLowerCase().includes(value.toLowerCase())
      );

      // Filter by vehicle type if selected
      if (newTrip.vehicleType) {
        filtered = filtered.filter(
          (driver) => driver.vehicleType === newTrip.vehicleType
        );
      }

      setDriverSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
      setDriverSuggestions([]);
    }
  };

  // Handle driver selection from autocomplete
  const handleSelectDriver = (driver) => {
    setNewTrip({
      ...newTrip,
      driverName: driver.name,
      phone: driver.phone,
      vehicleNumber: driver.vehicleNumber,
      vehicleType: driver.vehicleType || "",
    });
    setShowSuggestions(false);
    setDriverSuggestions([]);
  };

  // Handle vehicle type change - suggest drivers with that vehicle type
  const handleVehicleTypeChange = (vehicleType) => {
    if (vehicleType) {
      // Find drivers with this vehicle type
      const matchingDrivers = driversList.filter(
        (driver) => driver.vehicleType === vehicleType
      );

      if (matchingDrivers.length > 0) {
        // Auto-fill with first matching driver
        const firstDriver = matchingDrivers[0];
        setNewTrip({
          ...newTrip,
          vehicleType,
          driverName: firstDriver.name,
          phone: firstDriver.phone,
          vehicleNumber: firstDriver.vehicleNumber,
        });
        setDriverSuggestions(matchingDrivers);
        setShowSuggestions(false);
      } else {
        // No matching drivers, just set vehicle type
        setNewTrip({ ...newTrip, vehicleType });
      }
    } else {
      // Clear all if deselected
      setNewTrip({
        ...newTrip,
        vehicleType: "",
        driverName: "",
        phone: "",
        vehicleNumber: "",
      });
    }
  };

  const handleEdit = (trip) => {
    if (!isAdminOrHR) {
      setAlert({
        show: true,
        type: "error",
        message: "Bạn không có quyền chỉnh sửa chuyến đi",
      });
      return;
    }

    setNewTrip(trip);
    setEditingId(trip.id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!isAdminOrHR) {
      setAlert({
        show: true,
        type: "error",
        message: "Bạn không có quyền xóa chuyến đi",
      });
      return;
    }

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
    if (!isAdminOrHR) {
      setAlert({
        show: true,
        type: "error",
        message: "Bạn không có quyền thêm/sửa chuyến đi",
      });
      return;
    }

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
      // Save/update driver info if all fields are provided
      if (newTrip.driverName && newTrip.phone && newTrip.vehicleNumber) {
        const driverKey = newTrip.driverName.toLowerCase().replace(/\s+/g, "_");
        const driverRef = ref(db, `drivers/${driverKey}`);
        await set(driverRef, {
          name: newTrip.driverName,
          phone: newTrip.phone,
          vehicleNumber: newTrip.vehicleNumber,
          vehicleType: newTrip.vehicleType || "",
          lastUpdated: new Date().toISOString(),
        });
      }

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
    if (!isAdminOrHR) {
      setAlert({
        show: true,
        type: "error",
        message: "Bạn không có quyền đánh dấu hoàn tất",
      });
      return;
    }

    try {
      const tripRef = ref(db, `driverTrips/${trip.id}`);

      // Nếu đã hoàn tất, bỏ check (uncheck)
      if (trip.completed) {
        await update(tripRef, {
          ...trip,
          completed: false,
          endDate: "",
          endTime: "",
        });
        setAlert({
          show: true,
          type: "success",
          message: "✅ Bỏ đánh dấu hoàn tất thành công",
        });
      } else {
        // Nếu chưa hoàn tất, đánh dấu hoàn tất
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
      }
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
      vehicleType: "",
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
      requestTime: new Date().toISOString().slice(0, 16),
      departmentRequest: "",
      status: "scheduled",
    });
    setEditingId(null);
  };

  const openNewTripModal = () => {
    resetForm();
    setShowModal(true);
  };

  // Driver management handlers
  const handleAddDriver = () => {
    setDriverForm({
      name: "",
      phone: "",
      vehicleNumber: "",
      vehicleType: "",
    });
    setEditingDriverId(null);
    setShowDriverModal(true);
  };

  const handleEditDriver = (driverId, driver) => {
    if (!isAdminOrHR) {
      setAlert({
        show: true,
        type: "error",
        message: "Bạn không có quyền chỉnh sửa tài xế",
      });
      return;
    }
    setDriverForm({
      name: driver.name,
      phone: driver.phone,
      vehicleNumber: driver.vehicleNumber,
      vehicleType: driver.vehicleType || "",
    });
    setEditingDriverId(driverId);
    setShowDriverModal(true);
  };

  const handleDeleteDriver = async (driverId, driverName) => {
    if (!isAdminOrHR) {
      setAlert({
        show: true,
        type: "error",
        message: "Bạn không có quyền xóa tài xế",
      });
      return;
    }

    if (window.confirm(`Bạn chắc chắn muốn xóa tài xế ${driverName}?`)) {
      try {
        const driverRef = ref(db, `drivers/${driverId}`);
        await remove(driverRef);
        setAlert({
          show: true,
          type: "success",
          message: "✅ Xóa tài xế thành công",
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

  const handleSaveDriver = async () => {
    if (!isAdminOrHR) {
      setAlert({
        show: true,
        type: "error",
        message: "Bạn không có quyền thêm/sửa tài xế",
      });
      return;
    }

    if (!driverForm.name || !driverForm.phone || !driverForm.vehicleNumber) {
      setAlert({
        show: true,
        type: "error",
        message: "❌ Vui lòng điền đầy đủ: Tên, SĐT, Biển số xe",
      });
      return;
    }

    try {
      const driverKey =
        editingDriverId || driverForm.name.toLowerCase().replace(/\s+/g, "_");
      const driverRef = ref(db, `drivers/${driverKey}`);

      await set(driverRef, {
        name: driverForm.name,
        phone: driverForm.phone,
        vehicleNumber: driverForm.vehicleNumber,
        vehicleType: driverForm.vehicleType || "",
        lastUpdated: new Date().toISOString(),
      });

      setAlert({
        show: true,
        type: "success",
        message: editingDriverId
          ? "✅ Cập nhật tài xế thành công"
          : "✅ Thêm tài xế thành công",
      });
      setShowDriverModal(false);
      setDriverForm({
        name: "",
        phone: "",
        vehicleNumber: "",
        vehicleType: "",
      });
      setEditingDriverId(null);
    } catch (error) {
      setAlert({
        show: true,
        type: "error",
        message: `❌ Lỗi: ${error.message}`,
      });
    }
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

  // Lọc trips theo quyền truy cập trước
  const permissionFilteredTrips = filterTripsByPermission(trips);

  const completedCount = permissionFilteredTrips.filter(
    (t) => t.completed
  ).length;
  const filteredTrips = permissionFilteredTrips.filter((trip) => {
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
            {isAdminOrHR && (
              <>
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
                <button
                  onClick={() => {
                    setCurrentView("drivers");
                    setSidebarOpen(false);
                  }}
                  className={`w-full px-4 py-3.5 rounded-lg font-bold transition-all duration-200 ${
                    currentView === "drivers"
                      ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg hover:shadow-xl"
                      : "text-slate-700 bg-gradient-to-r from-slate-50 to-blue-50 border border-slate-300 hover:border-indigo-400 shadow-sm hover:shadow-md hover:from-indigo-50 hover:to-blue-100"
                  }`}
                >
                  QUẢN LÝ TÀI XẾ
                </button>
              </>
            )}
          </div>

          {/* Divider */}
          <div className="px-4">
            <div className="border-t-2 border-slate-200"></div>
          </div>
          <div className="flex-1" />

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
        {/* Toast Notification - Fixed position */}
        {alert.show && (
          <div className="fixed top-4 right-4 z-50 transition-all duration-300 ease-in-out transform">
            <div
              className={`min-w-[300px] max-w-md p-4 rounded-xl font-medium flex items-center gap-3 shadow-2xl border-2 ${
                alert.type === "success"
                  ? "bg-green-50 text-green-800 border-green-300"
                  : "bg-red-50 text-red-800 border-red-300"
              }`}
            >
              <span className="text-2xl flex-shrink-0">
                {alert.type === "success" ? "✅" : "❌"}
              </span>
              <span className="flex-1">{alert.message}</span>
              <button
                onClick={() => setAlert({ show: false, type: "", message: "" })}
                className="flex-shrink-0 w-6 h-6 rounded-full hover:bg-black/10 flex items-center justify-center transition-colors text-sm"
                title="Đóng"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        {/* Vehicle Schedule View - Airport Style Board */}
        {currentView === "schedule" &&
          (() => {
            // Filter trips theo quyền truy cập trước
            const permissionFiltered = filterTripsByPermission(trips);

            // Filter trips
            const filtered = permissionFiltered
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

            // Tạo danh sách trạng thái xe
            const vehicleStatuses = driversList
              .filter((driver) => {
                // Lọc xe 72A-875.15 nếu user không có quyền
                if (driver.vehicleNumber === RESTRICTED_VEHICLE) {
                  return canViewRestrictedVehicle;
                }
                return true;
              })
              .map((driver) => {
                const vehicleTrips = permissionFiltered.filter(
                  (t) =>
                    t.vehicleNumber === driver.vehicleNumber &&
                    t.startDate === selectedDate
                );

                const hasSchedule = vehicleTrips.length > 0;
                const firstTrip = vehicleTrips[0];

                return {
                  vehicleNumber: driver.vehicleNumber,
                  vehicleType: driver.vehicleType,
                  driverName: driver.name,
                  hasSchedule,
                  tripInfo: hasSchedule
                    ? {
                        destination: firstTrip.destination,
                        startTime: firstTrip.startTime,
                        departure: firstTrip.departure,
                        tripCount: vehicleTrips.length,
                      }
                    : null,
                };
              });

            return (
              <div className="space-y-4">
                {/* Board Schedule */}
                <div className="rounded-3xl overflow-hidden border border-transparent shadow-2xl bg-white">
                  {/* Board Header - Airport Style */}
                  <div className="bg-gradient-to-r from-indigo-600 via-blue-500 to-cyan-500 text-white px-3 sm:px-4 md:px-6 py-2 sm:py-3 border-b border-blue-100/30">
                    {/* Row 1: Menu button, Title, Time */}
                    <div className="flex items-center justify-between gap-2 sm:gap-3">
                      {/* Left: Menu Button + Title */}
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <button
                          onClick={() => setSidebarOpen(!sidebarOpen)}
                          className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-blue-500 text-white hover:bg-blue-400 transition-colors text-lg sm:text-xl"
                          title="Menu"
                        >
                          ☰
                        </button>
                        <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                          <span className="text-xl sm:text-2xl md:text-3xl flex-shrink-0">
                            🚗
                          </span>
                          <div className="min-w-0">
                            <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold truncate">
                              LỊCH CHUYẾN ĐI
                            </h2>
                            <p className="text-blue-100 text-xs hidden sm:block">
                              Departure Board
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Right: Current Time */}
                      <div className="flex-shrink-0 text-right">
                        <div className="text-lg sm:text-2xl md:text-3xl font-mono font-bold tracking-wider">
                          {currentTime}
                        </div>
                        <p className="text-blue-100 text-xs">30s</p>
                      </div>
                    </div>
                  </div>

                  {/* Controls - Sort & Filter */}
                  <div className="flex flex-col sm:flex-row justify-between items-stretch gap-3 px-3 sm:px-4 md:px-6 py-3 sm:py-4 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-blue-100/40 w-full">
                    {/* Left: Sort Options */}
                    <div className="flex gap-1 sm:gap-2 flex-wrap items-center flex-1">
                      {[
                        { value: "time", label: "⏰ Giờ" },
                        { value: "vehicle", label: "🚗 Xe" },
                        { value: "status", label: "📊 Trạng Thái" },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setSortBy(option.value)}
                          className={`px-2 sm:px-3 py-1 sm:py-2 rounded text-xs sm:text-sm font-semibold transition ${
                            sortBy === option.value
                              ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md"
                              : "bg-white text-slate-700 border border-slate-200 hover:border-indigo-300 hover:shadow-sm"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    {/* Right: Filter Row - Vehicle, Date, Actions */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-end sm:items-center flex-1 sm:justify-end">
                      {/* Vehicle Select */}
                      <div className="flex flex-col gap-1 w-full sm:w-auto">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          <span>🚙</span>
                          <span>Xe</span>
                        </label>
                        <select
                          value={selectedVehicle}
                          onChange={(e) => setSelectedVehicle(e.target.value)}
                          className="border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-700 text-xs focus:border-blue-600 focus:ring-1 focus:ring-blue-100 outline-none transition-all hover:border-blue-400"
                        >
                          <option value="">Tất cả xe</option>
                          {Array.from(
                            new Set(
                              permissionFiltered
                                .map((t) => t.vehicleNumber)
                                .filter(Boolean)
                            )
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
                      <div className="flex flex-col gap-1 w-full sm:w-auto">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          <span>📅</span>
                          <span>Ngày</span>
                        </label>
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-700 text-xs focus:border-blue-600 focus:ring-1 focus:ring-blue-100 outline-none transition-all hover:border-blue-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Table Header */}
                  <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 gap-1 sm:gap-2 md:gap-3 bg-gradient-to-r from-blue-600 to-blue-700 text-blue-50 text-xs font-bold px-2 sm:px-3 md:px-4 py-2 sm:py-3 sticky top-0 z-10 shadow-md w-full">
                    <div className="truncate col-span-1 text-center">🚗 XE</div>
                    <div className="truncate col-span-1 hidden sm:block text-center">
                      👤 TÀI
                    </div>
                    <div className="truncate col-span-1 hidden md:block text-center">
                      📱 ĐT
                    </div>
                    <div className="truncate col-span-1 text-center">
                      🏁 ĐẾN
                    </div>
                    <div className="truncate col-span-1 text-center">⏰ ĐI</div>
                    <div className="truncate col-span-1 hidden md:block text-center">
                      🏢 BP
                    </div>
                    <div className="truncate col-span-1 text-center">📊 TT</div>
                    <div className="truncate col-span-1 hidden md:block text-center">
                      📝 GHI
                    </div>
                  </div>
                  {/* Rows */}
                  {sorted.length === 0 ? (
                    <div className="px-3 sm:px-4 md:px-6 py-8 sm:py-12 text-center">
                      <p className="text-gray-400 text-base sm:text-lg">
                        🛫 Không có chuyến đi nào
                      </p>
                      <p className="text-gray-300 text-xs sm:text-sm mt-2">
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
                            className={`grid grid-cols-5 sm:grid-cols-7 md:grid-cols-9 gap-1 sm:gap-2 md:gap-3 px-2 sm:px-3 md:px-4 py-2 sm:py-3 items-center text-xs ${rowBgColor} transition border-l-4 border-yellow-400 hover:shadow-md w-full`}
                          >
                            {/* XE */}
                            <div className="text-white font-bold truncate col-span-1 text-center">
                              {trip.vehicleNumber || "N/A"}
                            </div>
                            {/* TÀI */}
                            <div className="text-white font-bold truncate hidden sm:block col-span-1 text-center">
                              {trip.driverName || "-"}
                            </div>
                            {/* ĐT */}
                            <div className="text-white font-bold truncate hidden md:block col-span-1 text-center">
                              {trip.phone || "-"}
                            </div>
                            {/* ĐẾN */}
                            <div className="text-white font-bold truncate col-span-1 text-center">
                              {trip.destination || "-"}
                            </div>
                            {/* ĐI */}
                            <div className="font-mono font-bold text-yellow-300 col-span-1 text-center">
                              {formatTime(trip.startDate, trip.startTime)}
                            </div>
                            {/* BP */}
                            <div className="text-orange-300 font-semibold truncate hidden md:block col-span-1 text-center">
                              {trip.departmentRequest || "-"}
                            </div>
                            {/* TT */}
                            <div className="col-span-1 text-center">
                              <StatusBadge trip={trip} mobile={true} />
                            </div>
                            {/* GHI */}
                            <div className="text-gray-200 truncate hidden md:block col-span-1 text-center">
                              {trip.notes ||
                                (trip.totalKm ? `${trip.totalKm}km` : "-")}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="px-3 sm:px-4 md:px-6 py-2 sm:py-3 bg-gradient-to-r from-blue-50 to-indigo-50 text-xs sm:text-sm text-slate-600 text-center border-t border-blue-100/40">
                    💡 Tổng <span className="font-bold">{sorted.length}</span>{" "}
                    chuyến | Cập nhật tự động mỗi 30s
                  </div>
                </div>
                {/* End Board Schedule */}
              </div>
            );
          })()}
        {currentView === "trips" && (
          <>
            {/* Filter Tabs */}
            <div className="mb-4 flex gap-2 bg-white p-2 sm:p-3 rounded-xl sm:rounded-2xl border border-slate-100 shadow-sm">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700 transition-colors flex-shrink-0 text-lg sm:text-xl"
                title="Menu"
              >
                ☰
              </button>
              <button
                onClick={() => setFilterTab("all")}
                className={`flex-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  filterTab === "all"
                    ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md"
                    : "text-slate-700 hover:text-indigo-600"
                }`}
              >
                All ({permissionFilteredTrips.length})
              </button>
              <button
                onClick={() => setFilterTab("ongoing")}
                className={`flex-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  filterTab === "ongoing"
                    ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md"
                    : "text-slate-700 hover:text-indigo-600"
                }`}
              >
                Chạy (
                {permissionFilteredTrips.filter((t) => !t.completed).length})
              </button>
              <button
                onClick={() => setFilterTab("completed")}
                className={`flex-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                  filterTab === "completed"
                    ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md"
                    : "text-slate-700 hover:text-indigo-600"
                }`}
              >
                Xong (
                {permissionFilteredTrips.filter((t) => t.completed).length})
              </button>
            </div>

            {/* Trips Table */}
            <div className="bg-white rounded-xl sm:rounded-3xl border border-transparent overflow-hidden shadow-lg sm:shadow-xl">
              {filteredTrips.length === 0 ? (
                <div className="p-6 sm:p-12 text-center">
                  <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">🚗</div>
                  <p className="text-slate-600 text-base sm:text-xl font-semibold">
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
                      <tr className="uppercase tracking-widest text-xs sm:text-sm font-bold">
                        <th className="px-1 sm:px-2 md:px-3 py-2 sm:py-3 text-center text-xs">
                          ✓
                        </th>
                        <th className="px-1 sm:px-2 md:px-3 py-2 sm:py-3 text-center hidden sm:table-cell text-xs">
                          Tài Xế
                        </th>
                        <th className="px-1 sm:px-2 md:px-3 py-2 sm:py-3 text-center hidden md:table-cell text-xs">
                          ĐT
                        </th>
                        <th className="px-1 sm:px-2 md:px-3 py-2 sm:py-3 text-center text-xs">
                          Xe
                        </th>
                        <th className="px-1 sm:px-2 md:px-3 py-2 sm:py-3 text-center hidden md:table-cell text-xs">
                          Loại
                        </th>
                        <th className="px-1 sm:px-2 md:px-3 py-2 sm:py-3 text-center hidden lg:table-cell text-xs">
                          Tuyến
                        </th>
                        <th className="px-1 sm:px-2 md:px-3 py-2 sm:py-3 text-center hidden sm:table-cell text-xs">
                          Km
                        </th>
                        <th className="px-1 sm:px-2 md:px-3 py-2 sm:py-3 text-center hidden md:table-cell text-xs">
                          Thời
                        </th>
                        <th className="px-1 sm:px-2 md:px-3 py-2 sm:py-3 text-center text-xs">
                          Hành
                        </th>
                        <th className="px-1 sm:px-2 md:px-3 py-2 sm:py-3 text-center text-xs">
                          TT
                        </th>
                        {isAdminOrHR && (
                          <th className="px-1 sm:px-2 md:px-3 py-2 sm:py-3 text-center text-xs w-12 sm:w-16">
                            Thao
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/50">
                      {filteredTrips.map((trip) => (
                        <tr
                          key={trip.id}
                          className="transition-colors odd:bg-gray-900 even:bg-gray-700 hover:bg-gray-800 text-white text-xs sm:text-sm"
                        >
                          {/* ✓ - Checkbox */}
                          <td className="px-1 sm:px-2 md:px-3 py-2 sm:py-3 text-center">
                            <div className="flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={trip.completed}
                                onChange={() => handleCompleteTrip(trip)}
                                disabled={!isAdminOrHR}
                                className={`w-3 h-3 sm:w-4 sm:h-4 rounded ${
                                  !isAdminOrHR
                                    ? "text-green-600 cursor-not-allowed opacity-70"
                                    : "text-blue-600 cursor-pointer"
                                }`}
                                title={
                                  !isAdminOrHR
                                    ? "Chỉ Admin/HR mới có quyền đánh dấu hoàn tất"
                                    : trip.completed
                                    ? "Click để bỏ đánh dấu hoàn tất"
                                    : "Click để đánh dấu hoàn tất"
                                }
                              />
                            </div>
                          </td>
                          {/* Tài Xế */}
                          <td className="px-1 sm:px-2 md:px-3 py-2 sm:py-3 text-center hidden sm:table-cell">
                            <div className="flex items-center gap-1 justify-center">
                              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-r from-indigo-200 to-blue-200 border border-indigo-300 flex items-center justify-center text-indigo-700 font-semibold text-xs flex-shrink-0">
                                {(trip.driverName || "?")[0].toUpperCase()}
                              </div>
                              <span className="font-bold text-white hidden md:inline truncate text-xs">
                                {trip.driverName}
                              </span>
                            </div>
                          </td>
                          {/* ĐT - Phone */}
                          <td className="px-1 sm:px-2 md:px-3 py-2 sm:py-3 text-center hidden md:table-cell">
                            {trip.phone ? (
                              <a
                                href={`tel:${trip.phone}`}
                                className="text-white hover:text-yellow-400 font-semibold text-xs truncate"
                              >
                                {trip.phone}
                              </a>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>
                          {/* Xe - Vehicle Number */}
                          <td className="px-1 sm:px-2 md:px-3 py-2 sm:py-3 text-center">
                            <span className="px-1 sm:px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200 inline-block truncate">
                              {trip.vehicleNumber || "N/A"}
                            </span>
                          </td>
                          {/* Loại Xe - Vehicle Type */}
                          <td className="px-1 sm:px-2 md:px-3 py-2 sm:py-3 text-center hidden md:table-cell">
                            <span className="text-white font-medium text-xs truncate">
                              {trip.vehicleType || "-"}
                            </span>
                          </td>
                          {/* Tuyến - Route (Departure → Destination) */}
                          <td className="px-1 sm:px-2 md:px-3 py-2 sm:py-3 text-center hidden lg:table-cell">
                            <div className="text-xs text-white">
                              <p className="font-semibold text-white truncate">
                                📍 {trip.departure || "N/A"} →{" "}
                                {trip.destination}
                              </p>
                              {trip.purpose && (
                                <p className="text-gray-300 text-xs truncate">
                                  🎯 {trip.purpose}
                                </p>
                              )}
                            </div>
                          </td>
                          {/* Km - Kilometers */}
                          <td className="px-1 sm:px-2 md:px-3 py-2 sm:py-3 text-center hidden sm:table-cell">
                            <div className="text-xs text-white">
                              <p className="text-gray-300 font-medium">
                                {trip.startKm || 0}km
                              </p>
                              {trip.endKm && (
                                <>
                                  <p className="text-gray-300 text-xs">
                                    →
                                    <span className="font-bold text-white">
                                      {trip.endKm}
                                    </span>
                                    km
                                  </p>
                                  <p className="text-white font-bold text-xs">
                                    Δ
                                    <span className="text-cyan-300">
                                      {trip.totalKm ||
                                        parseFloat(trip.endKm) -
                                          parseFloat(trip.startKm)}
                                    </span>
                                  </p>
                                </>
                              )}
                            </div>
                          </td>
                          {/* Thời Gian - Time */}
                          <td className="px-1 sm:px-2 md:px-3 py-2 sm:py-3 text-center hidden md:table-cell">
                            <div className="text-xs text-white">
                              <p className="text-gray-300 font-medium">
                                <span className="font-semibold text-white text-xs">
                                  {new Date(trip.startDate).toLocaleDateString(
                                    "vi-VN",
                                    { month: "short", day: "numeric" }
                                  )}
                                </span>
                              </p>
                              {trip.completed && trip.endDate && (
                                <p className="text-green-400 font-medium text-xs">
                                  {new Date(trip.endDate).toLocaleDateString(
                                    "vi-VN",
                                    { month: "short", day: "numeric" }
                                  )}
                                </p>
                              )}
                            </div>
                          </td>
                          {/* Hành Động - Actions (💰 🌐) */}
                          <td className="px-1 sm:px-2 md:px-3 py-2 sm:py-3 text-center">
                            <div className="flex items-center justify-center gap-0.5">
                              <button
                                onClick={() => {
                                  if (!isAdminOrHR) {
                                    setAlert({
                                      show: true,
                                      type: "error",
                                      message:
                                        "Bạn không có quyền nhập thông tin này",
                                    });
                                    return;
                                  }
                                  handleOpenDetailsModal(trip);
                                }}
                                className={`p-1 sm:p-1.5 rounded transition-all text-sm sm:text-base ${
                                  isAdminOrHR
                                    ? "bg-blue-100 text-blue-600 hover:bg-blue-200 cursor-pointer"
                                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                                }`}
                                title={
                                  isAdminOrHR
                                    ? "Chi tiết chi phí"
                                    : "Chỉ Admin/HR"
                                }
                              >
                                💰
                              </button>
                              <button
                                onClick={() => {
                                  if (!isAdminOrHR) {
                                    setAlert({
                                      show: true,
                                      type: "error",
                                      message:
                                        "Bạn không có quyền nhập thông tin này",
                                    });
                                    return;
                                  }
                                  setOutsideTrip(trip);
                                  setOutsideForm({
                                    startTime: "",
                                    endTime: "",
                                    destination: "",
                                    odoFrom: "",
                                    odoTo: "",
                                    fee: "",
                                    purpose: "",
                                  });
                                  setShowOutsideModal(true);
                                }}
                                className={`p-1 sm:p-1.5 rounded transition-all text-sm sm:text-base ${
                                  isAdminOrHR
                                    ? "bg-orange-100 text-orange-600 hover:bg-orange-200 cursor-pointer"
                                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                                }`}
                                title={
                                  isAdminOrHR ? "Chạy ngoài" : "Chỉ Admin/HR"
                                }
                              >
                                🌐
                              </button>
                            </div>
                          </td>
                          {/* Trạng thái - Status */}
                          <td className="px-1 sm:px-2 md:px-3 py-2 sm:py-3 text-center">
                            {trip.completed ? (
                              <span className="px-1 sm:px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700 border border-green-200 inline-block">
                                ✓
                              </span>
                            ) : (
                              <span className="px-1 sm:px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200 inline-block">
                                x
                              </span>
                            )}
                          </td>
                          {/* Thao Tác - Edit/Delete (Admin/HR only) */}
                          {isAdminOrHR && (
                            <td className="px-1 sm:px-2 md:px-3 py-2 sm:py-3">
                              <div className="flex items-center justify-center gap-0.5">
                                <button
                                  onClick={() => handleEdit(trip)}
                                  disabled={trip.completed}
                                  className={`p-1 sm:p-1.5 rounded text-sm sm:text-base ${
                                    trip.completed
                                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                      : "bg-indigo-100 text-indigo-600 hover:bg-indigo-200"
                                  }`}
                                  title={
                                    trip.completed ? "Không thể sửa" : "Sửa"
                                  }
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => handleDelete(trip.id)}
                                  disabled={!isAdminOrHR}
                                  className={`p-1 sm:p-1.5 rounded text-sm sm:text-base ${
                                    isAdminOrHR
                                      ? "bg-red-100 text-red-600 hover:bg-red-200"
                                      : "bg-slate-100 text-slate-400 cursor-not-allowed"
                                  }`}
                                  title={isAdminOrHR ? "Xóa" : "Admin/HR"}
                                >
                                  🗑️
                                </button>
                              </div>
                            </td>
                          )}
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
          <div className="bg-white sm:rounded-2xl shadow-2xl w-full min-h-screen sm:min-h-auto flex flex-col">
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 px-4 py-4 sm:px-8 sm:py-6 flex items-center justify-between sm:rounded-t-2xl shadow-lg">
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white bg-opacity-20 text-white hover:bg-opacity-40 transition-all text-lg sm:text-xl"
                  title="Menu"
                >
                  ☰
                </button>
                <h2 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
                  <span className="text-2xl sm:text-3xl">🚚</span>
                  <span>Thêm Chuyến Đi</span>
                </h2>
              </div>
              <button
                onClick={() => {
                  setCurrentView("trips");
                  resetForm();
                }}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-full w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center transition-all duration-200 text-lg sm:text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 auto-rows-max pb-20 sm:pb-0">
              {/* Column 1 */}
              <div className="space-y-6">
                {/* Driver, Phone & Vehicle */}
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 sm:p-6 border border-blue-100">
                  <h3 className="text-xs sm:text-sm font-bold text-blue-900 mb-1 sm:mb-2 flex items-center gap-2">
                    <span>👤</span>
                    <span>Thông Tin Tài Xế & Xe</span>
                  </h3>
                  <p className="text-xs text-blue-600 mb-3 sm:mb-4 flex items-center gap-1">
                    💡 Gõ tên tài xế để tự động điền thông tin từ database
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="text-xs sm:text-sm font-bold text-gray-800 mb-1 sm:mb-2 flex items-center gap-2">
                        <span className="text-red-500">*</span>
                        <span>Tên Tài Xế</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={newTrip.driverName}
                          onChange={(e) =>
                            handleDriverNameChange(e.target.value)
                          }
                          onFocus={() => {
                            if (newTrip.driverName.trim().length > 0) {
                              const filtered = driversList.filter((driver) =>
                                driver.name
                                  .toLowerCase()
                                  .includes(newTrip.driverName.toLowerCase())
                              );
                              if (filtered.length > 0) {
                                setDriverSuggestions(filtered);
                                setShowSuggestions(true);
                              }
                            }
                          }}
                          disabled={!!newTrip.vehicleType}
                          className={`w-full border-2 border-blue-200 rounded-lg px-3 sm:px-4 py-2 sm:py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm sm:text-base font-medium ${
                            newTrip.vehicleType
                              ? "bg-gray-100 text-gray-600 cursor-not-allowed"
                              : "bg-white hover:border-blue-300"
                          }`}
                          placeholder="VD: Nguyễn Văn A"
                          autoComplete="off"
                        />
                        {showSuggestions && driverSuggestions.length > 0 && (
                          <div className="absolute top-full left-0 right-0 bg-white border-2 border-blue-300 rounded-lg mt-1 max-h-48 overflow-y-auto z-50 shadow-lg">
                            {driverSuggestions.map((driver, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleSelectDriver(driver)}
                                className="w-full text-left px-3 sm:px-4 py-2 sm:py-3 hover:bg-blue-50 border-b border-blue-100 last:border-b-0 transition-colors"
                              >
                                <div className="font-semibold text-gray-800 text-sm sm:text-base">
                                  👤 {driver.name}
                                </div>
                                <div className="text-xs text-gray-600 flex gap-3 mt-1">
                                  <span>📞 {driver.phone}</span>
                                  <span>🚙 {driver.vehicleNumber}</span>
                                  {driver.vehicleType && (
                                    <span>🚛 {driver.vehicleType}</span>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs sm:text-sm font-bold text-gray-800 mb-1 sm:mb-2 flex items-center gap-2">
                        <span>📞</span>
                        <span>Số Điện Thoại</span>
                      </label>
                      <input
                        type="tel"
                        value={newTrip.phone}
                        onChange={(e) =>
                          setNewTrip({ ...newTrip, phone: e.target.value })
                        }
                        disabled={!!newTrip.vehicleType}
                        className={`w-full border-2 border-blue-200 rounded-lg px-3 sm:px-4 py-2 sm:py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm sm:text-base font-medium ${
                          newTrip.vehicleType
                            ? "bg-gray-100 text-gray-600 cursor-not-allowed"
                            : "bg-white hover:border-blue-300"
                        }`}
                        placeholder="VD: 0901234567"
                      />
                    </div>

                    <div>
                      <label className="text-xs sm:text-sm font-bold text-gray-800 mb-1 sm:mb-2 flex items-center gap-2">
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
                        disabled={!!newTrip.vehicleType}
                        className={`w-full border-2 border-blue-200 rounded-lg px-3 sm:px-4 py-2 sm:py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm sm:text-base font-medium ${
                          newTrip.vehicleType
                            ? "bg-gray-100 text-gray-600 cursor-not-allowed"
                            : "bg-white hover:border-blue-300"
                        }`}
                        placeholder="VD: 51A-12345"
                      />
                    </div>

                    <div>
                      <label className="text-xs sm:text-sm font-bold text-gray-800 mb-1 sm:mb-2 flex items-center gap-2">
                        <span>🚛</span>
                        <span>Loại Xe</span>
                      </label>
                      <select
                        value={newTrip.vehicleType}
                        onChange={(e) =>
                          handleVehicleTypeChange(e.target.value)
                        }
                        className="w-full border-2 border-blue-200 rounded-lg px-3 sm:px-4 py-2 sm:py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-sm sm:text-base font-medium bg-white hover:border-blue-300"
                      >
                        <option value="">Chọn loại xe...</option>
                        {VEHICLE_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Departure & Destination */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 sm:p-6 border border-amber-100">
                  <h3 className="text-xs sm:text-sm font-bold text-amber-900 mb-3 sm:mb-4 flex items-center gap-2">
                    <span>🗺️</span>
                    <span>Tuyến Đường</span>
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:gap-4">
                    <div>
                      <label className="text-xs sm:text-sm font-bold text-gray-800 mb-1 sm:mb-2 flex items-center gap-2">
                        <span>📍</span>
                        <span>Điểm Đi</span>
                      </label>
                      <input
                        type="text"
                        value={newTrip.departure}
                        onChange={(e) =>
                          setNewTrip({ ...newTrip, departure: e.target.value })
                        }
                        className="w-full border-2 border-amber-200 rounded-lg px-3 sm:px-4 py-2 sm:py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all text-sm sm:text-base font-medium bg-white hover:border-amber-300"
                        placeholder="VD: Công ty ABC"
                      />
                    </div>

                    <div>
                      <label className="text-xs sm:text-sm font-bold text-gray-800 mb-1 sm:mb-2 flex items-center gap-2">
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
                        className="w-full border-2 border-amber-200 rounded-lg px-3 sm:px-4 py-2 sm:py-3 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none transition-all text-sm sm:text-base font-medium bg-white hover:border-amber-300"
                        placeholder="VD: TP. Hồ Chí Minh"
                      />
                    </div>
                  </div>
                </div>
                {/* Notes */}
                <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl p-4 sm:p-6 border border-indigo-100">
                  <label className="text-xs sm:text-sm font-bold text-indigo-900 mb-2 sm:mb-3 flex items-center gap-2">
                    <span>📝</span>
                    <span>Ghi Chú</span>
                  </label>
                  <textarea
                    value={newTrip.notes}
                    onChange={(e) =>
                      setNewTrip({ ...newTrip, notes: e.target.value })
                    }
                    className="w-full border-2 border-indigo-200 rounded-lg px-3 sm:px-4 py-2 sm:py-3 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all resize-none text-sm sm:text-base font-medium bg-white hover:border-indigo-300"
                    placeholder="Ghi chú thêm về chuyến đi..."
                    rows="3"
                  ></textarea>
                </div>
              </div>

              {/* Column 2 */}
              <div className="space-y-6">
                {/* Date & Time */}
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 sm:p-6 border border-purple-100">
                  <h3 className="text-xs sm:text-sm font-bold text-purple-900 mb-3 sm:mb-4 flex items-center gap-2">
                    <span>⏱️</span>
                    <span>Thời Gian</span>
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:gap-4">
                    <div>
                      <label className="text-xs sm:text-sm font-bold text-gray-800 mb-1 sm:mb-2 flex items-center gap-2">
                        <span className="text-red-500">*</span>
                        <span>📅 Ngày Xuất Phát</span>
                      </label>
                      <input
                        type="date"
                        value={newTrip.startDate}
                        onChange={(e) =>
                          setNewTrip({ ...newTrip, startDate: e.target.value })
                        }
                        className="w-full border-2 border-purple-200 rounded-lg px-3 sm:px-4 py-2 sm:py-3 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all text-sm sm:text-base font-medium bg-white hover:border-purple-300"
                      />
                    </div>

                    <div>
                      <label className="text-xs sm:text-sm font-bold text-gray-800 mb-1 sm:mb-2 flex items-center gap-2">
                        <span className="text-red-500">*</span>
                        <span>⏰ Giờ Xuất Phát</span>
                      </label>
                      <input
                        type="time"
                        value={newTrip.startTime}
                        onChange={(e) =>
                          setNewTrip({ ...newTrip, startTime: e.target.value })
                        }
                        className="w-full border-2 border-purple-200 rounded-lg px-3 sm:px-4 py-2 sm:py-3 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all text-sm sm:text-base font-medium bg-white hover:border-purple-300"
                      />
                    </div>
                  </div>
                </div>

                {isDuplicateBooking && (
                  <div className="p-3 sm:p-4 rounded-xl bg-gradient-to-r from-red-50 to-red-100 text-red-800 border-2 border-red-300 font-semibold flex items-start gap-2 sm:gap-3 shadow-md">
                    <span className="text-xl sm:text-2xl mt-1 flex-shrink-0">
                      ⚠️
                    </span>
                    <div className="text-xs sm:text-sm">
                      <div className="font-bold">Lịch Đã Tồn Tại!</div>
                      <div className="font-normal mt-1">
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
                <div className="bg-gradient-to-br from-cyan-50 to-sky-50 rounded-xl p-4 sm:p-6 border border-cyan-100">
                  <label className="text-xs sm:text-sm font-bold text-cyan-900 mb-2 sm:mb-3 flex items-center gap-2">
                    <span>🎯</span>
                    <span>Mục Đích Chuyến Đi</span>
                  </label>
                  <input
                    type="text"
                    value={newTrip.purpose}
                    onChange={(e) =>
                      setNewTrip({ ...newTrip, purpose: e.target.value })
                    }
                    className="w-full border-2 border-cyan-200 rounded-lg px-3 sm:px-4 py-2 sm:py-3 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200 outline-none transition-all text-sm sm:text-base font-medium bg-white hover:border-cyan-300"
                    placeholder="VD: Giao hàng, Công tác, ..."
                  />
                </div>

                {/* Request Time & Department Request */}
                <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-xl p-4 sm:p-6 border border-orange-100">
                  <h3 className="text-xs sm:text-sm font-bold text-orange-900 mb-3 sm:mb-4 flex items-center gap-2">
                    <span>📋</span>
                    <span>Thông Tin Đặt Xe</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <label className="text-xs sm:text-sm font-bold text-gray-800 mb-1 sm:mb-2 flex items-center gap-2">
                        <span>⏰</span>
                        <span>Thời Gian Đặt</span>
                      </label>
                      <input
                        type="datetime-local"
                        value={newTrip.requestTime}
                        onChange={(e) =>
                          setNewTrip({
                            ...newTrip,
                            requestTime: e.target.value,
                          })
                        }
                        className="w-full border-2 border-orange-200 rounded-lg px-3 sm:px-4 py-2 sm:py-3 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all text-sm sm:text-base font-medium bg-white hover:border-orange-300"
                      />
                    </div>

                    <div>
                      <label className="text-xs sm:text-sm font-bold text-gray-800 mb-1 sm:mb-2 flex items-center gap-2">
                        <span>🏢</span>
                        <span>Bộ Phận Yêu Cầu</span>
                      </label>
                      <input
                        type="text"
                        value={newTrip.departmentRequest}
                        onChange={(e) =>
                          setNewTrip({
                            ...newTrip,
                            departmentRequest: e.target.value,
                          })
                        }
                        className="w-full border-2 border-orange-200 rounded-lg px-3 sm:px-4 py-2 sm:py-3 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all text-sm sm:text-base font-medium bg-white hover:border-orange-300"
                        placeholder="VD: Bộ phận Bán hàng"
                      />
                    </div>
                  </div>
                </div>

                {/* Status */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 sm:p-6 border border-emerald-100">
                  <label className="text-xs sm:text-sm font-bold text-emerald-900 mb-2 sm:mb-3 flex items-center gap-2">
                    <span>📊</span>
                    <span>Trạng Thái Chuyến Đi</span>
                  </label>
                  <select
                    value={newTrip.status}
                    onChange={(e) =>
                      setNewTrip({ ...newTrip, status: e.target.value })
                    }
                    className="w-full border-2 border-emerald-200 rounded-lg px-3 sm:px-4 py-2 sm:py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all text-sm sm:text-base font-medium bg-white hover:border-emerald-300"
                  >
                    <option value="scheduled">📅 Lên Lịch</option>
                    <option value="onboard">🚗 Đang Chạy</option>
                    <option value="arrived">✅ Đã Đến</option>
                    <option value="cancelled">❌ Hủy</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 sm:px-8 sm:py-5 flex gap-2 sm:gap-3 justify-end sm:rounded-b-2xl border-t-2 border-gray-200 shadow-lg pb-[env(safe-area-inset-bottom)]">
              <button
                onClick={() => {
                  setCurrentView("schedule");
                  resetForm();
                }}
                className="px-4 sm:px-6 py-2 sm:py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-bold transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center gap-2 shadow-md text-sm sm:text-base"
              >
                <span>❌</span>
                <span className="hidden sm:inline">Hủy</span>
              </button>
              <button
                onClick={handleAddOrUpdate}
                disabled={isDuplicateBooking || !isAdminOrHR}
                className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-bold transition-all duration-200 transform active:scale-95 flex items-center gap-2 shadow-md text-sm sm:text-base ${
                  isDuplicateBooking || !isAdminOrHR
                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700 hover:shadow-lg hover:scale-105"
                }`}
              >
                <span>🚀</span>
                <span className="hidden sm:inline">Thêm Mới</span>
              </button>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                      <div>
                        <label className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                          <span>🚛</span>
                          <span>Loại Xe</span>
                        </label>
                        <select
                          value={newTrip.vehicleType}
                          onChange={(e) =>
                            setNewTrip({
                              ...newTrip,
                              vehicleType: e.target.value,
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
                        >
                          <option value="">Chọn loại xe...</option>
                          {VEHICLE_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
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
                  disabled={isDuplicateBooking || !isAdminOrHR}
                  className={`px-5 py-3 rounded-lg font-bold transition-all duration-200 transform active:scale-95 flex items-center gap-2 shadow-md ${
                    isDuplicateBooking || !isAdminOrHR
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
        {/* Drivers Management View */}
        {currentView === "drivers" && (
          <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
            <div className="bg-white sm:rounded-2xl shadow-2xl w-full min-h-screen sm:min-h-auto">
              <div className="sticky top-0 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 px-4 py-4 sm:px-8 sm:py-6 flex items-center justify-between sm:rounded-t-2xl shadow-lg z-10">
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white bg-opacity-20 text-white hover:bg-opacity-40 transition-all text-lg sm:text-xl"
                    title="Menu"
                  >
                    ☰
                  </button>
                  <h2 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
                    <span className="text-2xl sm:text-3xl">👥</span>
                    <span>Quản Lý Tài Xế</span>
                  </h2>
                </div>
                {isAdminOrHR && (
                  <button
                    onClick={handleAddDriver}
                    className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-sm sm:text-base font-bold text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 transition-all shadow-md hover:shadow-lg flex items-center gap-2"
                  >
                    <span className="text-lg">➕</span>
                    <span className="hidden sm:inline">Thêm Tài Xế</span>
                  </button>
                )}
              </div>

              <div className="p-4 sm:p-8">
                {Object.keys(drivers).length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-gray-400 text-lg mb-2">
                      👥 Chưa có tài xế nào
                    </p>
                    <p className="text-gray-300 text-sm">
                      Nhấn "Thêm Tài Xế" để bắt đầu
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(drivers).map(([id, driver]) => (
                      <div
                        key={id}
                        className="bg-gradient-to-br from-white to-blue-50 rounded-xl p-5 border-2 border-blue-200 hover:border-blue-400 shadow-md hover:shadow-xl transition-all"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 flex items-center justify-center text-white font-bold text-xl">
                              {driver.name[0].toUpperCase()}
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-800 text-lg">
                                {driver.name}
                              </h3>
                              <p className="text-xs text-gray-500">
                                {driver.lastUpdated
                                  ? new Date(
                                      driver.lastUpdated
                                    ).toLocaleDateString("vi-VN")
                                  : ""}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 mb-4">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-600">📞</span>
                            <a
                              href={`tel:${driver.phone}`}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {driver.phone}
                            </a>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-600">🚙</span>
                            <span className="text-gray-800 font-medium">
                              {driver.vehicleNumber}
                            </span>
                          </div>
                          {driver.vehicleType && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-gray-600">🚛</span>
                              <span className="text-gray-700">
                                {driver.vehicleType}
                              </span>
                            </div>
                          )}
                        </div>

                        {isAdminOrHR && (
                          <div className="flex gap-2 pt-3 border-t border-blue-200">
                            <button
                              onClick={() => handleEditDriver(id, driver)}
                              className="flex-1 px-3 py-2 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-semibold text-sm transition-all flex items-center justify-center gap-1"
                            >
                              <span>✏️</span>
                              <span>Sửa</span>
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteDriver(id, driver.name)
                              }
                              className="flex-1 px-3 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 font-semibold text-sm transition-all flex items-center justify-center gap-1"
                            >
                              <span>🗑️</span>
                              <span>Xóa</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Driver Modal */}
        {showDriverModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="bg-gradient-to-r from-blue-600 to-cyan-500 px-6 py-4 rounded-t-2xl flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="text-2xl">
                    {editingDriverId ? "✏️" : "➕"}
                  </span>
                  <span>
                    {editingDriverId ? "Chỉnh Sửa Tài Xế" : "Thêm Tài Xế Mới"}
                  </span>
                </h2>
                <button
                  onClick={() => {
                    setShowDriverModal(false);
                    setDriverForm({
                      name: "",
                      phone: "",
                      vehicleNumber: "",
                      vehicleType: "",
                    });
                    setEditingDriverId(null);
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full w-8 h-8 flex items-center justify-center transition-all"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                    <span className="text-red-500">*</span>
                    <span>Tên Tài Xế</span>
                  </label>
                  <input
                    type="text"
                    value={driverForm.name}
                    onChange={(e) =>
                      setDriverForm({ ...driverForm, name: e.target.value })
                    }
                    className="w-full border-2 border-blue-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-base font-medium bg-white"
                    placeholder="VD: Nguyễn Văn A"
                  />
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                    <span className="text-red-500">*</span>
                    <span>📞 Số Điện Thoại</span>
                  </label>
                  <input
                    type="tel"
                    value={driverForm.phone}
                    onChange={(e) =>
                      setDriverForm({ ...driverForm, phone: e.target.value })
                    }
                    className="w-full border-2 border-blue-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-base font-medium bg-white"
                    placeholder="VD: 0901234567"
                  />
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                    <span className="text-red-500">*</span>
                    <span>🚙 Biển Số Xe</span>
                  </label>
                  <input
                    type="text"
                    value={driverForm.vehicleNumber}
                    onChange={(e) =>
                      setDriverForm({
                        ...driverForm,
                        vehicleNumber: e.target.value,
                      })
                    }
                    className="w-full border-2 border-blue-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-base font-medium bg-white"
                    placeholder="VD: 51A-12345"
                  />
                </div>

                <div>
                  <label className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
                    <span>🚛 Loại Xe</span>
                  </label>
                  <select
                    value={driverForm.vehicleType}
                    onChange={(e) =>
                      setDriverForm({
                        ...driverForm,
                        vehicleType: e.target.value,
                      })
                    }
                    className="w-full border-2 border-blue-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-base font-medium bg-white"
                  >
                    <option value="">Chọn loại xe...</option>
                    {VEHICLE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 rounded-b-2xl flex gap-3 justify-end border-t">
                <button
                  onClick={() => {
                    setShowDriverModal(false);
                    setDriverForm({
                      name: "",
                      phone: "",
                      vehicleNumber: "",
                      vehicleType: "",
                    });
                    setEditingDriverId(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-bold transition-all"
                >
                  ❌ Hủy
                </button>
                <button
                  onClick={handleSaveDriver}
                  className="px-4 py-2 rounded-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700 transition-all shadow-md hover:shadow-lg"
                >
                  {editingDriverId ? "💾 Cập Nhật" : "➕ Thêm Mới"}
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
                        {detailsTrip.phone || "N/A"}
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
        {/* Outside Modal */}
        {showOutsideModal && outsideTrip && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white sm:rounded-xl border shadow-md w-full h-full sm:max-w-2xl sm:max-h-[90vh] flex flex-col overflow-hidden">
              <div className="sticky top-0 bg-white border-b px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between sm:rounded-t-xl">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <span>💰</span>
                  <span className="uppercase">Bảng chạy ngoài</span>
                </h2>
                <button
                  onClick={() => {
                    setShowOutsideModal(false);
                    setOutsideTrip(null);
                    setOutsideForm({
                      startTime: "",
                      endTime: "",
                      destination: "",
                      odoFrom: "",
                      odoTo: "",
                      fee: "",
                      purpose: "",
                    });
                  }}
                  className="text-gray-600 hover:bg-gray-100 rounded-full w-9 h-9 flex items-center justify-center"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {/* Thông tin chuyến đi */}
                <div className="bg-gradient-to-r from-orange-50 to-yellow-50 p-5 rounded-xl border border-orange-300 shadow-sm">
                  <h3 className="font-bold text-orange-900 mb-4 text-base flex items-center gap-2">
                    <span>📋</span>
                    <span>Thông tin chuyến đi</span>
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="flex flex-col">
                      <span className="text-orange-600 font-semibold text-xs uppercase tracking-wide mb-1">
                        Tài xế
                      </span>
                      <span className="text-gray-800 font-bold text-lg">
                        {outsideTrip.driverName}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-orange-600 font-semibold text-xs uppercase tracking-wide mb-1">
                        Biển số xe
                      </span>
                      <span className="text-gray-800 font-bold text-lg">
                        {outsideTrip.vehicleNumber}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-orange-600 font-semibold text-xs uppercase tracking-wide mb-1">
                        Số điện thoại
                      </span>
                      <span className="text-gray-800 font-bold text-lg">
                        {outsideTrip.phone || "N/A"}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-orange-600 font-semibold text-xs uppercase tracking-wide mb-1">
                        Điểm đi
                      </span>
                      <span className="text-gray-800 font-bold text-lg">
                        {outsideTrip.departure || "N/A"}
                      </span>
                    </div>
                    <div className="col-span-2 flex flex-col">
                      <span className="text-orange-600 font-semibold text-xs uppercase tracking-wide mb-1">
                        Điểm đến
                      </span>
                      <span className="text-gray-800 font-bold text-lg">
                        {outsideTrip.destination}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Form chi tiết chạy ngoài */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span>📝</span>
                    <h3 className="text-sm font-bold text-gray-800">
                      Chi Tiết Chạy Ngoài
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
                          value={outsideForm.startTime}
                          onChange={(e) =>
                            setOutsideForm((p) => ({
                              ...p,
                              startTime: e.target.value,
                            }))
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-orange-600 focus:ring-2 focus:ring-orange-100 outline-none text-sm"
                        />
                        <input
                          type="time"
                          value={outsideForm.endTime}
                          onChange={(e) =>
                            setOutsideForm((p) => ({
                              ...p,
                              endTime: e.target.value,
                            }))
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-orange-600 focus:ring-2 focus:ring-orange-100 outline-none text-sm"
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
                        value={outsideForm.destination}
                        onChange={(e) =>
                          setOutsideForm((p) => ({
                            ...p,
                            destination: e.target.value,
                          }))
                        }
                        placeholder="VD: Kho A, Công trình B..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-orange-600 focus:ring-2 focus:ring-orange-100 outline-none text-sm"
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
                          value={outsideForm.odoFrom}
                          onChange={(e) =>
                            setOutsideForm((p) => ({
                              ...p,
                              odoFrom: e.target.value,
                            }))
                          }
                          placeholder="Odo từ"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-orange-600 focus:ring-2 focus:ring-orange-100 outline-none text-sm"
                        />
                        <input
                          type="number"
                          inputMode="decimal"
                          value={outsideForm.odoTo}
                          onChange={(e) =>
                            setOutsideForm((p) => ({
                              ...p,
                              odoTo: e.target.value,
                            }))
                          }
                          placeholder="Odo đến"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-orange-600 focus:ring-2 focus:ring-orange-100 outline-none text-sm"
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
                          const a = parseFloat(outsideForm.odoFrom);
                          const b = parseFloat(outsideForm.odoTo);
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
                </div>
              </div>

              <div className="sticky bottom-0 bg-gray-50 px-4 py-3 sm:px-6 sm:py-4 flex gap-3 justify-end sm:rounded-b-xl border-t pb-[env(safe-area-inset-bottom)]">
                <button
                  onClick={() => {
                    setShowOutsideModal(false);
                    setOutsideTrip(null);
                    setOutsideForm({
                      startTime: "",
                      endTime: "",
                      destination: "",
                      odoFrom: "",
                      odoTo: "",
                      fee: "",
                      purpose: "",
                    });
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
                >
                  ❌ Hủy
                </button>
                <button
                  onClick={() => {
                    if (outsideForm.fee || outsideForm.purpose) {
                      setAlert({
                        show: true,
                        type: "success",
                        message: `✅ Lưu thông tin chạy ngoài: ${
                          outsideForm.fee ? outsideForm.fee + "đ" : ""
                        } - ${outsideForm.purpose}`,
                      });
                    }
                    setShowOutsideModal(false);
                    setOutsideTrip(null);
                    setOutsideForm({
                      startTime: "",
                      endTime: "",
                      destination: "",
                      odoFrom: "",
                      odoTo: "",
                      fee: "",
                      purpose: "",
                    });
                  }}
                  className="px-4 py-2 rounded-lg font-semibold bg-orange-600 text-white hover:bg-orange-700"
                >
                  💾 Lưu Chạy Ngoài
                </button>
              </div>
            </div>
          </div>
        )}{" "}
      </div>
    </>
  );
}

export default DriverLogbook;
