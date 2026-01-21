import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
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
  const [selectedOutsideTripId, setSelectedOutsideTripId] = useState("");
  const [outsideForm, setOutsideForm] = useState({
    startTime: "",
    endTime: "",
    destination: "",
    odoFrom: "",
    odoTo: "",
    fee: "",
    purpose: "",
  });
  const [outsideTripForm, setOutsideTripForm] = useState({
    driverName: "",
    phone: "",
    vehicleNumber: "",
    departure: "",
    destination: "",
    startDate: new Date().toISOString().split("T")[0],
    startTime: new Date().toTimeString().slice(0, 5),
    notes: "",
  });

  const resetOutsideForm = React.useCallback(() => {
    setOutsideForm({
      startTime: "",
      endTime: "",
      destination: "",
      odoFrom: "",
      odoTo: "",
      fee: "",
      purpose: "",
    });
  }, []);

  const resetOutsideTripForm = React.useCallback(() => {
    setOutsideTripForm({
      driverName: "",
      phone: "",
      vehicleNumber: "",
      startDate: new Date().toISOString().split("T")[0],
      startTime: new Date().toTimeString().slice(0, 5),
      destination: "",
      notes: "",
    });
  }, []);
  const [showMobileDetailModal, setShowMobileDetailModal] = useState(false);
  const [mobileDetailTrip, setMobileDetailTrip] = useState(null);
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
    new Date().toISOString().split("T")[0],
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
    [canViewRestrictedVehicle],
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
        t.id !== editingId,
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
          arr.sort((a, b) => new Date(b.startDate) - new Date(a.startDate)),
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
        // Normalize driver fields to avoid missing display when DB uses different keys
        const normalized = Object.fromEntries(
          Object.entries(data).map(([id, driver]) => {
            const name = driver.name || driver.fullName || driver.ten || "";
            const phone =
              driver.phone || driver.phoneNumber || driver.sdt || "";
            const vehicleNumber =
              driver.vehicleNumber ||
              driver.licensePlate ||
              driver.biensoxe ||
              "";
            const vehicleType =
              driver.vehicleType || driver.type || driver.loai || "";

            return [
              id,
              {
                ...driver,
                name,
                phone,
                vehicleNumber,
                vehicleType,
              },
            ];
          }),
        );
        setDrivers(normalized);
      } else {
        setDrivers({});
      }
    });
    return () => unsubscribe();
  }, []);

  // Lấy thông tin xe của user hiện tại từ các chuyến đi gần nhất
  const userVehicleInfo = React.useMemo(() => {
    if (!user?.name || trips.length === 0) return null;

    // Tìm chuyến đi gần nhất của user
    const userTrips = trips.filter(
      (trip) => trip.driverName?.toLowerCase() === user.name?.toLowerCase(),
    );

    if (userTrips.length === 0) return null;

    // Lấy chuyến đi mới nhất
    const latestTrip = userTrips[0];
    return {
      vehicleNumber: latestTrip.vehicleNumber,
      driverName: latestTrip.driverName,
      phone: latestTrip.phone || "",
      departure: latestTrip.departure || "Công ty",
    };
  }, [user?.name, trips]);

  // Tự động điền thông tin xe vào form khi có userVehicleInfo
  useEffect(() => {
    if (userVehicleInfo && currentView === "expenses") {
      setOutsideTripForm((prev) => ({
        ...prev,
        vehicleNumber: userVehicleInfo.vehicleNumber || prev.vehicleNumber,
        driverName: userVehicleInfo.driverName || user?.name || prev.driverName,
        phone: userVehicleInfo.phone || prev.phone,
        departure: userVehicleInfo.departure || prev.departure,
      }));
    }
  }, [userVehicleInfo, currentView, user?.name]);

  // Convert drivers object to array for filtering
  const driversList = React.useMemo(() => {
    return Object.entries(drivers).map(([id, driver]) => ({
      id,
      ...driver,
    }));
  }, [drivers]);

  // Get unique vehicle numbers for dropdown
  const vehicleList = React.useMemo(() => {
    const vehicles = driversList
      .map((driver) => driver.vehicleNumber)
      .filter(Boolean); // Remove null/undefined
    return [...new Set(vehicles)].sort(); // Unique and sorted
  }, [driversList]);

  // Handle driver name input change with autocomplete
  const handleDriverNameChange = (value) => {
    setNewTrip({ ...newTrip, driverName: value });

    if (value.trim().length > 0) {
      let filtered = driversList.filter((driver) =>
        driver.name.toLowerCase().includes(value.toLowerCase()),
      );

      // Filter by vehicle type if selected
      if (newTrip.vehicleType) {
        filtered = filtered.filter(
          (driver) => driver.vehicleType === newTrip.vehicleType,
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
        (driver) => driver.vehicleType === vehicleType,
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

  const handleSaveOutsideExpense = async () => {
    if (!isAdminOrHR) {
      setAlert({
        show: true,
        type: "error",
        message: "Bạn không có quyền thêm chi phí ngoài",
      });
      return;
    }

    const targetTrip = permissionFilteredTrips.find(
      (t) => t.id === selectedOutsideTripId,
    );

    if (!targetTrip) {
      setAlert({
        show: true,
        type: "error",
        message: "❌ Vui lòng chọn chuyến đi để nhập chi phí ngoài",
      });
      return;
    }

    if (!outsideForm.destination) {
      setAlert({
        show: true,
        type: "error",
        message: "❌ Vui lòng nhập nơi đến cho chi phí ngoài",
      });
      return;
    }

    const parseNum = (v) => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : null;
    };

    const odoFromNum = parseNum(outsideForm.odoFrom);
    const odoToNum = parseNum(outsideForm.odoTo);
    const totalKmNum =
      odoFromNum != null && odoToNum != null ? odoToNum - odoFromNum : null;

    try {
      const expenseRef = ref(
        db,
        `driverTrips/${targetTrip.id}/outsideTrips/${Date.now()}`,
      );

      await set(expenseRef, {
        startTime: outsideForm.startTime || null,
        endTime: outsideForm.endTime || null,
        destination: outsideForm.destination?.trim() || null,
        odoFrom: odoFromNum,
        odoTo: odoToNum,
        totalKm: totalKmNum,
        fee: parseNum(outsideForm.fee),
        purpose: outsideForm.purpose?.trim() || null,
        createdAt: new Date().toISOString(),
        createdBy: user?.email || null,
      });

      setAlert({
        show: true,
        type: "success",
        message: "✅ Đã lưu chi phí ngoài",
      });
      resetOutsideForm();
    } catch (error) {
      setAlert({
        show: true,
        type: "error",
        message: `❌ Lỗi lưu chi phí ngoài: ${error.message}`,
      });
    }
  };

  const handleCreateOutsideTrip = async () => {
    if (!isAdminOrHR) {
      setAlert({
        show: true,
        type: "error",
        message: "Bạn không có quyền thêm chuyến phát sinh",
      });
      return;
    }

    if (!outsideTripForm.driverName || !outsideTripForm.vehicleNumber) {
      setAlert({
        show: true,
        type: "error",
        message: "❌ Vui lòng nhập Tài xế và Biển số xe",
      });
      return;
    }

    try {
      const newId = Date.now().toString();
      const tripRef = ref(db, `driverTrips/${newId}`);

      await set(tripRef, {
        driverName: outsideTripForm.driverName,
        phone: outsideTripForm.phone || "",
        vehicleNumber: outsideTripForm.vehicleNumber,
        vehicleType: "",
        departure: "",
        destination: outsideTripForm.destination || "",
        startKm: "",
        endKm: "",
        totalKm: "",
        startDate: outsideTripForm.startDate,
        startTime: outsideTripForm.startTime,
        endDate: "",
        endTime: "",
        notes: outsideTripForm.notes || "",
        expenseDetails: "",
        completed: false,
        requestTime: new Date().toISOString().slice(0, 16),
        departmentRequest: "",
        status: "scheduled",
        outsideOnly: true,
        createdAt: new Date().toISOString(),
        createdBy: user?.email || null,
      });

      setSelectedOutsideTripId(newId);
      resetOutsideTripForm();
      setAlert({
        show: true,
        type: "success",
        message: "✅ Đã tạo chuyến phát sinh",
      });
    } catch (error) {
      setAlert({
        show: true,
        type: "error",
        message: `❌ Lỗi tạo chuyến phát sinh: ${error.message}`,
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

  // Load details form data when opening mobile detail modal
  useEffect(() => {
    if (showMobileDetailModal && mobileDetailTrip) {
      const d = mobileDetailTrip.details || {};
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
  }, [showMobileDetailModal, mobileDetailTrip]);

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

  // Tự chọn chuyến đầu tiên khi vào màn Chi phí ngoài
  useEffect(() => {
    if (currentView !== "expenses" || permissionFilteredTrips.length === 0)
      return;

    if (!selectedOutsideTripId) {
      setSelectedOutsideTripId(permissionFilteredTrips[0].id);
      return;
    }

    if (!permissionFilteredTrips.some((t) => t.id === selectedOutsideTripId)) {
      setSelectedOutsideTripId(permissionFilteredTrips[0].id);
    }
  }, [currentView, permissionFilteredTrips, selectedOutsideTripId]);

  // Reset form mỗi lần đổi chuyến hoặc mở tab Chi phí ngoài
  useEffect(() => {
    if (currentView === "expenses") {
      resetOutsideForm();
      resetOutsideTripForm();
    }
  }, [
    currentView,
    selectedOutsideTripId,
    resetOutsideForm,
    resetOutsideTripForm,
  ]);

  const selectedOutsideTrip = React.useMemo(() => {
    return (
      permissionFilteredTrips.find((t) => t.id === selectedOutsideTripId) ||
      null
    );
  }, [permissionFilteredTrips, selectedOutsideTripId]);

  const completedCount = permissionFilteredTrips.filter(
    (t) => t.completed,
  ).length;
  const filteredTrips = permissionFilteredTrips.filter((trip) => {
    if (filterTab === "ongoing") return !trip.completed;
    if (filterTab === "completed") return trip.completed;
    return true;
  });

  const tripsWithOutside = React.useMemo(() => {
    return permissionFilteredTrips.filter(
      (t) => t.outsideTrips && Object.keys(t.outsideTrips).length > 0,
    );
  }, [permissionFilteredTrips]);

  // Export completed trips to Excel
  const handleExportCompletedTrips = () => {
    try {
      const completedTrips = permissionFilteredTrips.filter((t) => t.completed);

      if (completedTrips.length === 0) {
        setAlert({
          show: true,
          type: "error",
          message: "❌ Không có chuyến xe hoàn tất để xuất",
        });
        return;
      }

      const rows = completedTrips.map((t, idx) => ({
        STT: idx + 1,
        TaiXe: t.driverName || "",
        DienThoai: t.phone || "",
        BienSoXe: t.vehicleNumber || "",
        LoaiXe: t.vehicleType || "",
        DiemDi: t.departure || "",
        DiemDen: t.destination || "",
        NgayDi: t.startDate || "",
        GioDi: t.startTime || "",
        NgayVe: t.endDate || "",
        GioVe: t.endTime || "",
        OdoBatDau:
          t?.details?.odoFrom != null ? t.details.odoFrom : t.startKm || "",
        OdoKetThuc: t?.details?.odoTo != null ? t.details.odoTo : t.endKm || "",
        TongKm:
          t?.details?.totalKm != null
            ? t.details.totalKm
            : t.totalKm ||
              (t.endKm && t.startKm
                ? parseFloat(t.endKm) - parseFloat(t.startKm)
                : ""),
        BoPhanDat: t.departmentRequest || "",
        GhiChu: t.notes || "",
        PhiCauDuong: t?.details?.tollFee != null ? t.details.tollFee : "",
        PhiAnUong: t?.details?.mealFee != null ? t.details.mealFee : "",
        TangCaGio:
          t?.details?.overtimeHours != null ? t.details.overtimeHours : "",
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "CompletedTrips");
      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `driver_trips_completed_${dateStr}.xlsx`);

      setAlert({
        show: true,
        type: "success",
        message: "✅ Xuất Excel thành công",
      });
    } catch (error) {
      console.error("Export trips error:", error);
      setAlert({
        show: true,
        type: "error",
        message: `❌ Lỗi xuất Excel: ${error.message}`,
      });
    }
  };

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
              <button
                onClick={() => {
                  setCurrentView("expenses");
                  setSidebarOpen(false);
                }}
                className={`w-full px-4 py-3.5 rounded-lg font-bold transition-all duration-200 ${
                  currentView === "expenses"
                    ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg hover:shadow-xl"
                    : "text-slate-700 bg-gradient-to-r from-slate-50 to-blue-50 border border-slate-300 hover:border-indigo-400 shadow-sm hover:shadow-md hover:from-indigo-50 hover:to-blue-100"
                }`}
              >
                💰 CHI PHÍ NGOÀI
              </button>
            )}
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
                  t.startDate === selectedDate,
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
                    b.vehicleNumber || "",
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
                    t.startDate === selectedDate,
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
                    <div className="flex gap-1 sm:gap-2 flex-wrap items-center sm:flex-1">
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
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-end sm:items-center w-full sm:w-auto sm:justify-end">
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
                                .filter(Boolean),
                            ),
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
                  <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-10 gap-1 sm:gap-2 md:gap-3 bg-gradient-to-r from-blue-600 to-blue-700 text-blue-50 text-xs font-bold px-2 sm:px-3 md:px-4 py-2 sm:py-3 sticky top-0 z-10 shadow-md w-full">
                    <div className="truncate col-span-1 text-center text-[10px] sm:text-xs">
                      🚗 XE
                    </div>
                    <div className="truncate col-span-1 hidden sm:block text-center">
                      📦 LOẠI
                    </div>
                    <div className="truncate col-span-1 hidden md:block text-center">
                      📱 ĐT
                    </div>
                    <div className="truncate col-span-1 hidden sm:block text-center">
                      ĐI TỪ
                    </div>
                    <div className="truncate col-span-1.5 sm:col-span-1 text-center text-[10px] sm:text-xs">
                      👤 TÀI XẾ
                    </div>
                    <div className="truncate col-span-1 text-center text-[10px] sm:text-xs">
                      ⏰ THỜI GIAN ĐI
                    </div>
                    <div className="truncate col-span-1 hidden md:block text-center">
                      🏢 BP
                    </div>
                    <div className="truncate col-span-1 hidden sm:block text-center">
                      📊 TT
                    </div>
                    <div className="truncate col-span-1 hidden md:block text-center">
                      📝 GHI CHÚ
                    </div>
                    <div className="truncate col-span-1 text-center text-[10px] sm:text-xs">
                      📋 CHI TIẾT
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
                          trip.startTime,
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
                            className={`grid grid-cols-4 sm:grid-cols-7 md:grid-cols-10 gap-1 sm:gap-2 md:gap-3 px-2 sm:px-3 md:px-4 py-2 sm:py-3 items-center text-xs ${rowBgColor} transition border-l-4 border-yellow-400 hover:shadow-md w-full`}
                          >
                            {/* XE */}
                            <div className="text-white text-xs sm:text-sm font-semibold sm:font-bold truncate col-span-1 text-center">
                              {trip.vehicleNumber || "N/A"}
                            </div>
                            {/* LOẠI */}
                            <div className="text-blue-200 font-semibold truncate hidden sm:block col-span-1 text-center">
                              {trip.vehicleType || "-"}
                            </div>
                            {/* ĐIỂM ĐI */}
                            <div className="text-white font-semibold truncate hidden sm:block col-span-1 text-center">
                              {trip.phone || "-"}
                            </div>
                            {/* ĐT */}
                            <div className="text-white font-bold truncate hidden md:block col-span-1 text-center">
                              {trip.departure || "-"}
                            </div>
                            {/* TÀI XẾ */}
                            <div className="text-white font-bold col-span-1.5 sm:col-span-1 text-center">
                              {trip.driverName || "-"}
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
                            <div className="col-span-1 hidden sm:block text-center">
                              <StatusBadge trip={trip} mobile={true} />
                            </div>
                            {/* GHI */}
                            <div className="text-gray-200 truncate hidden md:block col-span-1 text-center">
                              {trip.notes ||
                                (trip.totalKm ? `${trip.totalKm}km` : "-")}
                            </div>
                            {/* XEM CHI TIẾT */}
                            <div className="col-span-1 text-center">
                              <button
                                onClick={() => {
                                  setMobileDetailTrip(trip);
                                  setShowMobileDetailModal(true);
                                }}
                                className="px-2 py-1 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded text-xs font-semibold hover:from-indigo-600 hover:to-blue-600 transition-all shadow-sm"
                                title="Xem chi tiết chuyến đi"
                              >
                                📋
                              </button>
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
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={handleExportCompletedTrips}
                  className="px-3 py-2 rounded-lg text-xs sm:text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow"
                  title="Xuất chuyến đã hoàn tất"
                >
                  📥 Xuất Excel
                </button>
              </div>
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
                <>
                  {/* Mobile Card View */}
                  <div className="md:hidden divide-y divide-slate-200">
                    {filteredTrips.map((trip) => (
                      <div
                        key={trip.id}
                        className="p-4 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          {/* Left: Main Info */}
                          <div className="flex-1 min-w-0 space-y-2">
                            {/* Biển số xe */}
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">🚗</span>
                              <span className="font-bold text-lg text-indigo-700">
                                {trip.vehicleNumber || "N/A"}
                              </span>
                            </div>

                            {/* Tên tài xế */}
                            <div className="flex items-center gap-2">
                              <span className="text-xl">👤</span>
                              <span className="font-semibold text-slate-700">
                                {trip.driverName || "N/A"}
                              </span>
                            </div>

                            {/* Thời gian */}
                            <div className="flex items-center gap-2">
                              <span className="text-xl">⏰</span>
                              <span className="text-sm text-slate-600">
                                {new Date(trip.startDate).toLocaleDateString(
                                  "vi-VN",
                                )}
                                {trip.startTime && ` - ${trip.startTime}`}
                              </span>
                            </div>

                            {/* Nút xem chi tiết */}
                            <button
                              onClick={() => {
                                setMobileDetailTrip(trip);
                                setShowMobileDetailModal(true);
                              }}
                              className="mt-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg font-semibold text-sm shadow-md hover:from-indigo-700 hover:to-blue-700 transition-all"
                            >
                              📋 Xem Chi Tiết
                            </button>

                            {/* Hành động (mobile) */}
                            <div className="flex items-center gap-2 flex-wrap pt-1">
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
                                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all shadow-sm ${
                                  isAdminOrHR
                                    ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                                }`}
                                title={
                                  isAdminOrHR
                                    ? "Chi tiết chi phí"
                                    : "Chỉ Admin/HR"
                                }
                              >
                                💵 Chi phí
                              </button>
                            </div>
                          </div>

                          {/* Right: Status & Checkbox */}
                          <div className="flex flex-col items-center gap-2">
                            <input
                              type="checkbox"
                              checked={trip.completed}
                              onChange={() => handleCompleteTrip(trip)}
                              disabled={!isAdminOrHR}
                              className={`w-5 h-5 rounded ${
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
                            {trip.completed ? (
                              <span className="px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-700 border border-green-200">
                                ✓
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                                x
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
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
                            Thời gian
                          </th>
                          <th className="px-1 sm:px-2 md:px-3 py-2 sm:py-3 text-center text-xs">
                            Hành động
                          </th>
                          <th className="px-1 sm:px-2 md:px-3 py-2 sm:py-3 text-center text-xs">
                            TT
                          </th>
                          {isAdminOrHR && (
                            <th className="px-1 sm:px-2 md:px-3 py-2 sm:py-3 text-center text-xs w-12 sm:w-16">
                              Chức năng
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
                                <span className="text-slate-400 text-xs">
                                  -
                                </span>
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
                                {/* Purpose removed per request */}
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
                                    {new Date(
                                      trip.startDate,
                                    ).toLocaleDateString("vi-VN", {
                                      month: "short",
                                      day: "numeric",
                                    })}
                                  </span>
                                </p>
                                {trip.completed && trip.endDate && (
                                  <p className="text-green-400 font-medium text-xs">
                                    {new Date(trip.endDate).toLocaleDateString(
                                      "vi-VN",
                                      { month: "short", day: "numeric" },
                                    )}
                                  </p>
                                )}
                              </div>
                            </td>
                            {/* Hành Động - Actions (� 🛣️) */}
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
                                  💵
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
                </>
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
                                  .includes(newTrip.driverName.toLowerCase()),
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
                              {(driver.name || "?")
                                .toString()
                                .slice(0, 1)
                                .toUpperCase()}
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-800 text-lg">
                                {driver.name || "Chưa đặt tên"}
                              </h3>
                              <p className="text-xs text-gray-500">
                                {driver.lastUpdated
                                  ? new Date(
                                      driver.lastUpdated,
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
        {/* Expenses Management View */}
        {currentView === "expenses" && !isAdminOrHR && (
          <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-amber-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-md">
              <div className="text-6xl mb-4">🔒</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Quyền hạn không đủ
              </h2>
              <p className="text-gray-700 mb-4">
                Chỉ quản trị viên và nhân viên HR mới có thể xem và quản lý chi
                phí ngoài. Vui lòng liên hệ quản trị viên nếu bạn cần trợ giúp.
              </p>
              <button
                onClick={() => setCurrentView("schedule")}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all"
              >
                Quay lại
              </button>
            </div>
          </div>
        )}
        {currentView === "expenses" && isAdminOrHR && (
          <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-amber-100">
            <div className="bg-white sm:rounded-2xl shadow-2xl w-full min-h-screen sm:min-h-auto">
              <div className="sticky top-0 bg-gradient-to-r from-orange-600 via-amber-500 to-yellow-500 px-4 py-4 sm:px-8 sm:py-6 flex items-center justify-between sm:rounded-t-2xl shadow-lg z-10">
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                    className="inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white bg-opacity-20 text-white hover:bg-opacity-40 transition-all text-lg sm:text-xl"
                    title="Menu"
                  >
                    ☰
                  </button>
                  <h2 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
                    <span className="text-2xl sm:text-3xl">💰</span>
                    <span>Chi Phí Ngoài</span>
                  </h2>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">
                {user && (
                  <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-4 sm:p-6 space-y-4">
                    <div>
                      <h3 className="text-blue-800 font-bold text-lg flex items-center gap-2 mb-4">
                        <span>➕</span>
                        <span>Tạo Chuyến Đi Phát Sinh</span>
                      </h3>
                      <p className="text-sm text-blue-600 mb-4">
                        Chọn xe để tự động điền thông tin tài xế
                      </p>
                      {userVehicleInfo && (
                        <div className="bg-green-50 border border-green-300 rounded-lg p-3 mb-4">
                          <p className="text-xs text-green-700 flex items-center gap-2">
                            <span>✓</span>
                            <span>
                              Gợi ý: Xe {userVehicleInfo.vehicleNumber} -{" "}
                              {userVehicleInfo.driverName}
                            </span>
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Tên tài xế */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-blue-800">
                          Tên tài xế
                        </label>
                        <input
                          type="text"
                          value={outsideTripForm.driverName}
                          onChange={(e) =>
                            setOutsideTripForm((p) => ({
                              ...p,
                              driverName: e.target.value,
                            }))
                          }
                          placeholder="VD: Nguyễn Văn A"
                          className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                        />
                      </div>
                      {/* Số điện thoại */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-blue-800">
                          Số điện thoại
                        </label>
                        <input
                          type="tel"
                          value={outsideTripForm.phone}
                          onChange={(e) =>
                            setOutsideTripForm((p) => ({
                              ...p,
                              phone: e.target.value,
                            }))
                          }
                          placeholder="VD: 0912345678"
                          className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                        />
                      </div>
                      {/* Thông tin chuyến đi */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-blue-800">
                          Biển số xe
                        </label>
                        <select
                          value={outsideTripForm.vehicleNumber}
                          onChange={(e) => {
                            const selectedVehicle = e.target.value;
                            setOutsideTripForm((p) => ({
                              ...p,
                              vehicleNumber: selectedVehicle,
                            }));

                            // Tự động điền thông tin tài xế khi chọn xe
                            if (selectedVehicle) {
                              // Ưu tiên lấy từ chuyến đi gần nhất
                              const tripWithVehicle = trips.find(
                                (trip) =>
                                  trip.vehicleNumber === selectedVehicle,
                              );

                              if (tripWithVehicle) {
                                setOutsideTripForm((p) => ({
                                  ...p,
                                  driverName:
                                    tripWithVehicle.driverName || p.driverName,
                                  phone: tripWithVehicle.phone || p.phone,
                                  departure:
                                    tripWithVehicle.departure || p.departure,
                                }));
                              } else {
                                // Nếu chưa có chuyến đi, lấy từ danh sách tài xế
                                const driverWithVehicle = driversList.find(
                                  (d) => d.vehicleNumber === selectedVehicle,
                                );
                                if (driverWithVehicle) {
                                  setOutsideTripForm((p) => ({
                                    ...p,
                                    driverName:
                                      driverWithVehicle.name || p.driverName,
                                    phone: driverWithVehicle.phone || p.phone,
                                    departure: p.departure, // không có departure trong driver
                                  }));
                                }
                              }
                            }
                          }}
                          className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none bg-white"
                        >
                          <option value="">-- Chọn xe --</option>
                          {vehicleList.map((vehicle) => (
                            <option key={vehicle} value={vehicle}>
                              {vehicle}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-blue-800">
                          Điểm đi
                        </label>
                        <input
                          type="text"
                          value={outsideTripForm.departure}
                          onChange={(e) =>
                            setOutsideTripForm((p) => ({
                              ...p,
                              departure: e.target.value,
                            }))
                          }
                          placeholder="VD: Công ty"
                          className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-blue-800">
                          Điểm đến
                        </label>
                        <input
                          type="text"
                          value={outsideTripForm.destination}
                          onChange={(e) =>
                            setOutsideTripForm((p) => ({
                              ...p,
                              destination: e.target.value,
                            }))
                          }
                          placeholder="VD: Kho hàng A"
                          className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-blue-800">
                          Ngày chạy
                        </label>
                        <input
                          type="date"
                          value={outsideTripForm.startDate}
                          onChange={(e) =>
                            setOutsideTripForm((p) => ({
                              ...p,
                              startDate: e.target.value,
                            }))
                          }
                          className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                        />
                      </div>

                      {/* Chi phí */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-blue-800">
                          Odo từ (km)
                        </label>
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
                          placeholder="VD: 1000"
                          className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-blue-800">
                          Odo đến (km)
                        </label>
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
                          placeholder="VD: 1100"
                          className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-blue-800">
                          Phí chạy (đ)
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={outsideForm.fee}
                          onChange={(e) =>
                            setOutsideForm((p) => ({
                              ...p,
                              fee: e.target.value,
                            }))
                          }
                          placeholder="VD: 200000"
                          className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                        />
                      </div>
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-xs font-bold text-blue-800">
                          Ghi chú
                        </label>
                        <textarea
                          value={outsideForm.purpose}
                          onChange={(e) =>
                            setOutsideForm((p) => ({
                              ...p,
                              purpose: e.target.value,
                            }))
                          }
                          rows={2}
                          placeholder="Ghi chú thêm (không bắt buộc)"
                          className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none resize-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setOutsideTripForm({
                            vehicleNumber: "",
                            departure: "",
                            destination: "",
                            startDate: new Date().toISOString().split("T")[0],
                          });
                          resetOutsideForm();
                        }}
                        className="px-4 py-2 rounded-lg font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200"
                      >
                        Xóa
                      </button>
                      <button
                        onClick={handleCreateOutsideTrip}
                        className="px-4 py-2 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700"
                      >
                        ➕ Tạo & Lưu
                      </button>
                    </div>
                  </div>
                )}

                {tripsWithOutside.length === 0 ? (
                  <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-6 text-center">
                    <p className="text-orange-700 font-bold text-lg mb-2">
                      🚗 Chưa có chi phí ngoài
                    </p>
                    <p className="text-orange-600 text-sm">
                      Nhập chi phí ngoài bằng form bên trên.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tripsWithOutside.map((trip) =>
                      Object.entries(trip.outsideTrips || {}).map(
                        ([expenseId, expense]) => (
                          <div
                            key={`${trip.id}-${expenseId}`}
                            className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl p-4 border border-orange-200 shadow-sm hover:shadow-md transition-all"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-orange-600 font-bold">
                                    🚗 {trip.vehicleNumber}
                                  </span>
                                  <span className="text-gray-600 font-semibold">
                                    | {trip.driverName}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <span className="text-orange-600 font-semibold text-xs">
                                      ⏰ Thời gian
                                    </span>
                                    <p className="text-gray-800 font-bold">
                                      {expense.startTime || "-"} ~{" "}
                                      {expense.endTime || "-"}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-orange-600 font-semibold text-xs">
                                      📍 Nơi đến
                                    </span>
                                    <p className="text-gray-800 font-bold">
                                      {expense.destination || "-"}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-orange-600 font-semibold text-xs">
                                      📏 KM
                                    </span>
                                    <p className="text-gray-800 font-bold">
                                      {expense.odoFrom} → {expense.odoTo} ={" "}
                                      {expense.totalKm ?? "-"} km
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-orange-600 font-semibold text-xs">
                                      💳 Phí
                                    </span>
                                    <p className="text-gray-800 font-bold">
                                      {expense.fee || "-"} đ
                                    </p>
                                  </div>
                                </div>
                                {expense.purpose && (
                                  <div>
                                    <span className="text-orange-600 font-semibold text-xs">
                                      📝 Ghi chú
                                    </span>
                                    <p className="text-gray-800 text-sm">
                                      {expense.purpose}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ),
                      ),
                    )}
                  </div>
                )}
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

              {!user ||
                (!isAdminOrHR && (
                  <div className="bg-amber-50 border-l-4 border-amber-500 rounded-lg p-4 mb-4 flex items-start gap-3">
                    <div className="text-xl mt-0.5">⚠️</div>
                    <div>
                      <h4 className="font-bold text-amber-900 mb-1">
                        Quyền xem chỉ
                      </h4>
                      <p className="text-sm text-amber-800">
                        Bạn không có quyền chỉnh sửa. Chỉ quản trị viên và HR
                        mới có thể lưu thay đổi.
                      </p>
                    </div>
                  </div>
                ))}

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
                          disabled={!user || !isAdminOrHR}
                          value={detailsForm.startTime}
                          onChange={(e) =>
                            setDetailsForm((p) => ({
                              ...p,
                              startTime: e.target.value,
                            }))
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                        <input
                          type="time"
                          disabled={!user || !isAdminOrHR}
                          value={detailsForm.endTime}
                          onChange={(e) =>
                            setDetailsForm((p) => ({
                              ...p,
                              endTime: e.target.value,
                            }))
                          }
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                        disabled={!user || !isAdminOrHR}
                        value={detailsForm.destination}
                        onChange={(e) =>
                          setDetailsForm((p) => ({
                            ...p,
                            destination: e.target.value,
                          }))
                        }
                        placeholder="VD: Kho A, Công trình B..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                          disabled={!user || !isAdminOrHR}
                          value={detailsForm.odoFrom}
                          onChange={(e) =>
                            setDetailsForm((p) => ({
                              ...p,
                              odoFrom: e.target.value,
                            }))
                          }
                          placeholder="Odo từ"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                        <input
                          type="number"
                          inputMode="decimal"
                          disabled={!user || !isAdminOrHR}
                          value={detailsForm.odoTo}
                          onChange={(e) =>
                            setDetailsForm((p) => ({
                              ...p,
                              odoTo: e.target.value,
                            }))
                          }
                          placeholder="Odo đến"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                        disabled={!user || !isAdminOrHR}
                        value={detailsForm.tollFee}
                        onChange={(e) =>
                          setDetailsForm((p) => ({
                            ...p,
                            tollFee: e.target.value,
                          }))
                        }
                        placeholder="VD: 500000"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                        disabled={!user || !isAdminOrHR}
                        value={detailsForm.mealFee}
                        onChange={(e) =>
                          setDetailsForm((p) => ({
                            ...p,
                            mealFee: e.target.value,
                          }))
                        }
                        placeholder="VD: 150000"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
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
                        disabled={!user || !isAdminOrHR}
                        value={detailsForm.overtimeHours}
                        onChange={(e) =>
                          setDetailsForm((p) => ({
                            ...p,
                            overtimeHours: e.target.value,
                          }))
                        }
                        placeholder="VD: 2"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    </div>

                    {/* Ghi chú */}
                    <div className="md:col-span-2 bg-white rounded-lg p-4 border border-slate-200">
                      <label className="text-xs font-bold text-gray-700 mb-2 block">
                        Ghi chú
                      </label>
                      <textarea
                        disabled={!user || !isAdminOrHR}
                        value={detailsForm.notes}
                        onChange={(e) =>
                          setDetailsForm((p) => ({
                            ...p,
                            notes: e.target.value,
                          }))
                        }
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none text-sm resize-y disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="Ghi chú thêm..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              {user && isAdminOrHR && (
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
              )}
            </div>
          </div>
        )}
        {/* Mobile Detail Modal */}
        {showMobileDetailModal && mobileDetailTrip && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white sm:rounded-xl border shadow-md w-full h-full sm:max-w-2xl sm:max-h-[90vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between sm:rounded-t-xl shadow-lg">
                <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                  <span>📋</span>
                  <span>Chi Tiết Chuyến Đi</span>
                </h2>
                <button
                  onClick={() => {
                    setShowMobileDetailModal(false);
                    setMobileDetailTrip(null);
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full w-9 h-9 flex items-center justify-center transition-all"
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {!user ||
                  (!isAdminOrHR && (
                    <div className="bg-amber-50 border-l-4 border-amber-500 rounded-lg p-4 mb-4 flex items-start gap-3">
                      <div className="text-xl mt-0.5">⚠️</div>
                      <div>
                        <h4 className="font-bold text-amber-900 mb-1">
                          Quyền xem chỉ
                        </h4>
                        <p className="text-sm text-amber-800">
                          Bạn không có quyền chỉnh sửa. Chỉ quản trị viên và HR
                          mới có thể lưu thay đổi.
                        </p>
                      </div>
                    </div>
                  ))}

                {/* Thông tin cơ bản */}
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-4 rounded-xl border border-indigo-200 shadow-sm">
                  <h3 className="font-bold text-indigo-900 mb-3 text-base flex items-center gap-2">
                    <span>🚗</span>
                    <span>Thông Tin Cơ Bản</span>
                  </h3>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-indigo-600 font-semibold text-xs uppercase">
                        Biển số xe
                      </span>
                      <span className="text-gray-800 font-bold text-lg">
                        {mobileDetailTrip.vehicleNumber || "N/A"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-indigo-600 font-semibold text-xs uppercase">
                        Loại xe
                      </span>
                      <span className="text-gray-800 font-semibold">
                        {mobileDetailTrip.vehicleType || "-"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-indigo-600 font-semibold text-xs uppercase">
                        Tên tài xế
                      </span>
                      <span className="text-gray-800 font-bold text-lg">
                        {mobileDetailTrip.driverName || "-"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-indigo-600 font-semibold text-xs uppercase">
                        Số điện thoại
                      </span>
                      <a
                        href={`tel:${mobileDetailTrip.phone}`}
                        className="text-blue-600 font-semibold text-lg hover:underline"
                      >
                        {mobileDetailTrip.phone || "-"}
                      </a>
                    </div>
                  </div>
                </div>

                {/* Thông tin tuyến đường */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200 shadow-sm">
                  <h3 className="font-bold text-green-900 mb-3 text-base flex items-center gap-2">
                    <span>🗺️</span>
                    <span>Thông Tin Tuyến Đường</span>
                  </h3>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-green-600 font-semibold text-xs uppercase">
                        Điểm đi
                      </span>
                      <span className="text-gray-800 font-semibold text-base">
                        📍 {mobileDetailTrip.departure || "-"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-green-600 font-semibold text-xs uppercase">
                        Điểm đến
                      </span>
                      <span className="text-gray-800 font-semibold text-base">
                        🏁 {mobileDetailTrip.destination || "-"}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-green-600 font-semibold text-xs uppercase">
                        Bộ phận yêu cầu
                      </span>
                      <span className="text-gray-800 font-medium">
                        {mobileDetailTrip.departmentRequest || "-"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Thông tin thời gian */}
                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 p-4 rounded-xl border border-amber-200 shadow-sm">
                  <h3 className="font-bold text-amber-900 mb-3 text-base flex items-center gap-2">
                    <span>⏰</span>
                    <span>Thông Tin Thời Gian</span>
                  </h3>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-amber-600 font-semibold text-xs uppercase">
                        Ngày đi
                      </span>
                      <span className="text-gray-800 font-bold text-base">
                        {new Date(
                          mobileDetailTrip.startDate,
                        ).toLocaleDateString("vi-VN")}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-amber-600 font-semibold text-xs uppercase">
                        Giờ đi
                      </span>
                      <span className="text-gray-800 font-bold text-base">
                        {mobileDetailTrip.startTime || "-"}
                      </span>
                    </div>
                    {mobileDetailTrip.endDate && (
                      <>
                        <div className="flex flex-col gap-1">
                          <span className="text-amber-600 font-semibold text-xs uppercase">
                            Ngày về
                          </span>
                          <span className="text-gray-800 font-bold text-base">
                            {new Date(
                              mobileDetailTrip.endDate,
                            ).toLocaleDateString("vi-VN")}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-amber-600 font-semibold text-xs uppercase">
                            Giờ về
                          </span>
                          <span className="text-gray-800 font-bold text-base">
                            {mobileDetailTrip.endTime || "-"}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Chi phí (nếu có) */}
                {mobileDetailTrip.expenseDetails && (
                  <div className="bg-gradient-to-r from-red-50 to-orange-50 p-4 rounded-xl border border-red-200 shadow-sm">
                    <h3 className="font-bold text-red-900 mb-3 text-base flex items-center gap-2">
                      <span>💰</span>
                      <span>Chi Phí</span>
                    </h3>
                    <div className="text-gray-800 whitespace-pre-wrap">
                      {mobileDetailTrip.expenseDetails}
                    </div>
                  </div>
                )}

                {/* Ghi chú */}
                {mobileDetailTrip.notes && (
                  <div className="bg-gradient-to-r from-slate-50 to-gray-50 p-4 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-900 mb-3 text-base flex items-center gap-2">
                      <span>📝</span>
                      <span>Ghi Chú</span>
                    </h3>
                    <div className="text-gray-800 whitespace-pre-wrap">
                      {mobileDetailTrip.notes}
                    </div>
                  </div>
                )}

                {/* Form chi tiết chi phí */}
                <div className="bg-gradient-to-r from-orange-50 to-yellow-50 p-4 rounded-xl border border-orange-200 shadow-sm">
                  <h3 className="font-bold text-orange-900 mb-3 text-base flex items-center gap-2">
                    <span>💰</span>
                    <span>Chi Tiết Chi Phí & Số Odo</span>
                  </h3>
                  <div className="space-y-3">
                    {/* Giờ đi - giờ về */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-orange-700">
                          Giờ đi
                        </label>
                        <input
                          type="time"
                          disabled={!user || !isAdminOrHR}
                          value={detailsForm.startTime}
                          onChange={(e) =>
                            setDetailsForm((p) => ({
                              ...p,
                              startTime: e.target.value,
                            }))
                          }
                          className="w-full border border-orange-300 rounded-lg px-3 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none text-sm disabled:bg-orange-50 disabled:cursor-not-allowed"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-orange-700">
                          Giờ về
                        </label>
                        <input
                          type="time"
                          disabled={!user || !isAdminOrHR}
                          value={detailsForm.endTime}
                          onChange={(e) =>
                            setDetailsForm((p) => ({
                              ...p,
                              endTime: e.target.value,
                            }))
                          }
                          className="w-full border border-orange-300 rounded-lg px-3 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none text-sm disabled:bg-orange-50 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>
                    {/* Nơi đến */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-orange-700">
                        Nơi đến
                      </label>
                      <input
                        type="text"
                        disabled={!user || !isAdminOrHR}
                        value={detailsForm.destination}
                        onChange={(e) =>
                          setDetailsForm((p) => ({
                            ...p,
                            destination: e.target.value,
                          }))
                        }
                        placeholder="VD: Kho hàng, Công trình A..."
                        className="w-full border border-orange-300 rounded-lg px-3 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none text-sm disabled:bg-orange-50 disabled:cursor-not-allowed"
                      />
                    </div>
                    {/* Odo từ - đến */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-orange-700">
                          Odo từ (km)
                        </label>
                        <input
                          type="number"
                          inputMode="decimal"
                          disabled={!user || !isAdminOrHR}
                          value={detailsForm.odoFrom}
                          onChange={(e) =>
                            setDetailsForm((p) => ({
                              ...p,
                              odoFrom: e.target.value,
                            }))
                          }
                          placeholder="VD: 1000"
                          className="w-full border border-orange-300 rounded-lg px-3 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none text-sm disabled:bg-orange-50 disabled:cursor-not-allowed"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-orange-700">
                          Odo đến (km)
                        </label>
                        <input
                          type="number"
                          inputMode="decimal"
                          disabled={!user || !isAdminOrHR}
                          value={detailsForm.odoTo}
                          onChange={(e) =>
                            setDetailsForm((p) => ({
                              ...p,
                              odoTo: e.target.value,
                            }))
                          }
                          placeholder="VD: 1100"
                          className="w-full border border-orange-300 rounded-lg px-3 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none text-sm disabled:bg-orange-50 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>
                    {/* Số KM tự tính */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-orange-700">
                        Số KM (tự tính)
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={(() => {
                          const from = parseFloat(detailsForm.odoFrom);
                          const to = parseFloat(detailsForm.odoTo);
                          return !isNaN(from) && !isNaN(to) ? to - from : "";
                        })()}
                        className="w-full border border-orange-300 rounded-lg px-3 py-2 bg-orange-50 text-gray-800 font-bold text-sm"
                        placeholder="Tự động tính"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-orange-700">
                        Phí cầu đường (đ)
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        disabled={!user || !isAdminOrHR}
                        value={detailsForm.tollFee}
                        onChange={(e) =>
                          setDetailsForm((p) => ({
                            ...p,
                            tollFee: e.target.value,
                          }))
                        }
                        placeholder="VD: 50000"
                        className="w-full border border-orange-300 rounded-lg px-3 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none text-sm disabled:bg-orange-50 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-orange-700">
                        Tiền ăn (đ)
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        disabled={!user || !isAdminOrHR}
                        value={detailsForm.mealFee}
                        onChange={(e) =>
                          setDetailsForm((p) => ({
                            ...p,
                            mealFee: e.target.value,
                          }))
                        }
                        placeholder="VD: 100000"
                        className="w-full border border-orange-300 rounded-lg px-3 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none text-sm disabled:bg-orange-50 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-orange-700">
                        Giờ tăng ca
                      </label>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        disabled={!user || !isAdminOrHR}
                        value={detailsForm.overtimeHours}
                        onChange={(e) =>
                          setDetailsForm((p) => ({
                            ...p,
                            overtimeHours: e.target.value,
                          }))
                        }
                        placeholder="VD: 2"
                        className="w-full border border-orange-300 rounded-lg px-3 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none text-sm disabled:bg-orange-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                {/* Trạng thái */}
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-xl border border-blue-200 shadow-sm">
                  <h3 className="font-bold text-blue-900 mb-3 text-base flex items-center gap-2">
                    <span>📌</span>
                    <span>Trạng Thái</span>
                  </h3>
                  <div className="flex items-center gap-3">
                    {mobileDetailTrip.completed ? (
                      <span className="px-4 py-2 rounded-lg text-sm font-bold bg-green-100 text-green-700 border-2 border-green-300 inline-flex items-center gap-2">
                        <span>✓</span>
                        <span>Đã hoàn tất</span>
                      </span>
                    ) : (
                      <span className="px-4 py-2 rounded-lg text-sm font-bold bg-amber-100 text-amber-700 border-2 border-amber-300 inline-flex items-center gap-2">
                        <span>⏳</span>
                        <span>Đang chạy</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-gray-50 px-4 py-3 sm:px-6 sm:py-4 flex gap-3 justify-end sm:rounded-b-xl border-t pb-[env(safe-area-inset-bottom)]">
                <button
                  onClick={() => {
                    setShowMobileDetailModal(false);
                    setMobileDetailTrip(null);
                  }}
                  className="flex-1 sm:flex-none px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold transition-all"
                >
                  ❌ Hủy
                </button>
                {user && isAdminOrHR && (
                  <button
                    onClick={() => {
                      setDetailsTrip(mobileDetailTrip);
                      // Gọi hàm lưu sau khi set detailsTrip
                      setTimeout(async () => {
                        if (!mobileDetailTrip) return;
                        try {
                          const tripRef = ref(
                            db,
                            `driverTrips/${mobileDetailTrip.id}`,
                          );

                          const parseNum = (v) => {
                            const n = parseFloat(v);
                            return Number.isFinite(n) ? n : null;
                          };

                          const odoFromNum = parseNum(detailsForm.odoFrom);
                          const odoToNum = parseNum(detailsForm.odoTo);
                          const totalKmNum =
                            odoFromNum != null && odoToNum != null
                              ? odoToNum - odoFromNum
                              : null;

                          const detailsPayload = {
                            startTime: detailsForm.startTime || null,
                            endTime: detailsForm.endTime || null,
                            destination:
                              detailsForm.destination?.trim() || null,
                            odoFrom: odoFromNum,
                            odoTo: odoToNum,
                            totalKm: totalKmNum,
                            tollFee: parseNum(detailsForm.tollFee),
                            mealFee: parseNum(detailsForm.mealFee),
                            overtimeHours: parseNum(detailsForm.overtimeHours),
                            notes: detailsForm.notes?.trim() || null,
                          };

                          await update(tripRef, {
                            details: detailsPayload,
                          });

                          setAlert({
                            show: true,
                            type: "success",
                            message: "✅ Lưu chi tiết chuyến đi thành công",
                          });
                          setShowMobileDetailModal(false);
                          setMobileDetailTrip(null);
                        } catch (error) {
                          setAlert({
                            show: true,
                            type: "error",
                            message: `❌ Lỗi: ${error.message}`,
                          });
                        }
                      }, 0);
                    }}
                    className="flex-1 sm:flex-none px-6 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg hover:from-indigo-700 hover:to-blue-700 font-semibold shadow-md transition-all"
                  >
                    💾 Lưu Chi Tiết
                  </button>
                )}
              </div>
            </div>
          </div>
        )}{" "}
      </div>
    </>
  );
}

export default DriverLogbook;
