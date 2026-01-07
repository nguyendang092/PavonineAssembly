import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useUser } from "../../contexts/UserContext";
import { db, ref, onValue, set, update, remove } from "../../services/firebase";
import Sidebar from "../layout/Sidebar";

// Lazy-load Google Maps JS SDK to avoid CORS issues and missing global
const loadGoogleMaps = (() => {
  let cachedPromise = null;
  return (apiKey) => {
    if (typeof window !== "undefined" && window.google && window.google.maps) {
      return Promise.resolve();
    }

    if (cachedPromise) return cachedPromise;

    cachedPromise = new Promise((resolve, reject) => {
      if (
        !apiKey ||
        apiKey === "YOUR_API_KEY" ||
        apiKey === "YOUR_API_KEY_HERE"
      ) {
        reject(new Error("Missing Google Maps API key"));
        return;
      }

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Google Maps"));
      document.head.appendChild(script);
    });

    return cachedPromise;
  };
})();

function DriverLogbook() {
  const { t } = useTranslation();
  const { user } = useUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [trips, setTrips] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [alert, setAlert] = useState({ show: false, type: "", message: "" });
  const [filterTab, setFilterTab] = useState("all"); // all, ongoing, completed
  const [calculatingDistance, setCalculatingDistance] = useState(false);
  const [estimatedKm, setEstimatedKm] = useState("");
  const [newTrip, setNewTrip] = useState({
    driverName: user?.name || "",
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
    completed: false,
  });

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
    if (!alert.show) return;
    const timer = setTimeout(() => {
      setAlert({ show: false, type: "", message: "" });
    }, 4000);
    return () => clearTimeout(timer);
  }, [alert.show]);

  const handleAddOrUpdate = async () => {
    if (!newTrip.driverName.trim() || !newTrip.destination.trim()) {
      setAlert({
        show: true,
        type: "error",
        message: "❌ Vui lòng nhập tên tài xế và nơi đến",
      });
      return;
    }

    try {
      if (editingId) {
        const tripRef = ref(db, `driverTrips/${editingId}`);
        await update(tripRef, newTrip);
        setAlert({
          show: true,
          type: "success",
          message: "✅ Cập nhật chuyến đi thành công",
        });
      } else {
        const newTripRef = ref(db, `driverTrips/${Date.now()}`);
        await set(newTripRef, newTrip);
        setAlert({
          show: true,
          type: "success",
          message: "✅ Thêm chuyến đi thành công",
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

  const handleCompleteTrip = async (trip) => {
    if (!trip.completed) {
      const now = new Date();
      const endDate = now.toISOString().split("T")[0];
      const endTime = now.toTimeString().slice(0, 5);

      try {
        const tripRef = ref(db, `driverTrips/${trip.id}`);
        await update(tripRef, {
          completed: true,
          endDate,
          endTime,
        });
        setAlert({
          show: true,
          type: "success",
          message: "✅ Đánh dấu hoàn tất chuyến đi",
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

  const resetForm = () => {
    setNewTrip({
      driverName: user?.name || "",
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
      completed: false,
    });
    setEditingId(null);
    setEstimatedKm("");
  };

  const openNewTripModal = () => {
    resetForm();
    setShowModal(true);
  };

  // Calculate distance using Google Maps Distance Matrix API
  const calculateDistance = async () => {
    if (!newTrip.departure || !newTrip.destination) {
      setAlert({
        show: true,
        type: "error",
        message: "❌ Vui lòng nhập cả điểm đi và điểm đến",
      });
      return;
    }

    setCalculatingDistance(true);

    try {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      await loadGoogleMaps(apiKey);

      const { google } = window;
      if (!google || !google.maps) {
        throw new Error("Google Maps chưa sẵn sàng");
      }

      const service = new google.maps.DistanceMatrixService();
      service.getDistanceMatrix(
        {
          origins: [newTrip.departure],
          destinations: [newTrip.destination],
          travelMode: google.maps.TravelMode.DRIVING,
          unitSystem: google.maps.UnitSystem.METRIC,
        },
        (response, status) => {
          setCalculatingDistance(false);

          if (status === "OK") {
            const result = response.rows[0].elements[0];
            if (result.status === "OK") {
              const distanceInKm = (result.distance.value / 1000).toFixed(1);
              setEstimatedKm(distanceInKm);
              setAlert({
                show: true,
                type: "success",
                message: `✅ Ước tính khoảng cách: ${distanceInKm} km (${result.duration.text})`,
              });
            } else {
              setAlert({
                show: true,
                type: "error",
                message:
                  "❌ Không tìm thấy tuyến đường. Vui lòng nhập địa chỉ rõ ràng hơn.",
              });
            }
          } else {
            setAlert({
              show: true,
              type: "error",
              message: `❌ Lỗi: ${status}`,
            });
          }
        }
      );
    } catch (error) {
      setCalculatingDistance(false);
      console.error("Error calculating distance:", error);
      setAlert({
        show: true,
        type: "error",
        message:
          error?.message === "Missing Google Maps API key"
            ? "❌ Thiếu Google Maps API key. Vui lòng set VITE_GOOGLE_MAPS_API_KEY."
            : "❌ Lỗi khi tải Google Maps hoặc tính khoảng cách",
      });
    }
  };

  // Auto-calculate distance when departure and destination change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (newTrip.departure && newTrip.destination && !editingId) {
        calculateDistance();
      }
    }, 1000); // Debounce 1 second

    return () => clearTimeout(timer);
  }, [newTrip.departure, newTrip.destination]);

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
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 p-4 md:p-6">
        <div>
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 border-t-4 border-blue-600">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:shadow-lg transition-all hover:scale-110"
                  title="Menu"
                >
                  ☰
                </button>
                <div>
                  <h1 className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                    🚗 Sổ Nhật Ký Tài Xế
                  </h1>
                  <p className="text-gray-500 text-sm mt-1">
                    Quản lý chuyến đi và theo dõi quãng đường
                  </p>
                </div>
              </div>
              <button
                onClick={openNewTripModal}
                className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-xl hover:shadow-xl transition-all transform hover:scale-105 flex items-center gap-2"
              >
                <span className="text-xl">➕</span>
                <span>Thêm Chuyến Đi</span>
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

          {/* Statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium mb-1">
                    Tổng Chuyến Đi
                  </p>
                  <p className="text-4xl font-extrabold">{trips.length}</p>
                </div>
                <div className="text-5xl opacity-20">🚗</div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm font-medium mb-1">
                    Đang Chạy
                  </p>
                  <p className="text-4xl font-extrabold">
                    {trips.length - completedCount}
                  </p>
                </div>
                <div className="text-5xl opacity-20">🛣️</div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium mb-1">
                    Hoàn Tất
                  </p>
                  <p className="text-4xl font-extrabold">{completedCount}</p>
                </div>
                <div className="text-5xl opacity-20">✅</div>
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
                    ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Tất Cả ({trips.length})
              </button>
              <button
                onClick={() => setFilterTab("ongoing")}
                className={`flex-1 px-6 py-3 rounded-xl font-bold transition-all ${
                  filterTab === "ongoing"
                    ? "bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Đang Chạy ({trips.length - completedCount})
              </button>
              <button
                onClick={() => setFilterTab("completed")}
                className={`flex-1 px-6 py-3 rounded-xl font-bold transition-all ${
                  filterTab === "completed"
                    ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Hoàn Tất ({completedCount})
              </button>
            </div>
          </div>

          {/* Trips Table */}
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            {filteredTrips.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-6xl mb-4">🚗</div>
                <p className="text-gray-500 text-xl font-semibold">
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
                  <thead className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
                    <tr>
                      <th className="px-4 py-4 text-left text-sm font-bold uppercase w-12">
                        #
                      </th>
                      <th className="px-4 py-4 text-left text-sm font-bold uppercase">
                        Tài Xế
                      </th>
                      <th className="px-4 py-4 text-left text-sm font-bold uppercase">
                        Xe
                      </th>
                      <th className="px-4 py-4 text-left text-sm font-bold uppercase">
                        Điểm Đi - Điểm Đến
                      </th>
                      <th className="px-4 py-4 text-left text-sm font-bold uppercase">
                        Km
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
                    {filteredTrips.map((trip) => (
                      <tr
                        key={trip.id}
                        className={`hover:bg-gray-50 transition-colors ${
                          trip.completed ? "bg-green-50" : ""
                        }`}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center">
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
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
                              {(trip.driverName || "?")[0].toUpperCase()}
                            </div>
                            <span className="font-bold text-gray-900">
                              {trip.driverName}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                            🚙 {trip.vehicleNumber || "N/A"}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm">
                            <p className="font-semibold text-gray-700">
                              📍 {trip.departure || "Chưa xác định"} →{" "}
                              {trip.destination}
                            </p>
                            {trip.purpose && (
                              <p className="text-gray-500 mt-1">
                                🎯 {trip.purpose}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm">
                            <p className="text-gray-600">
                              Bắt đầu:{" "}
                              <span className="font-bold">
                                {trip.startKm || 0} km
                              </span>
                            </p>
                            {trip.endKm && (
                              <>
                                <p className="text-gray-600 mt-1">
                                  Kết thúc:{" "}
                                  <span className="font-bold">
                                    {trip.endKm} km
                                  </span>
                                </p>
                                <p className="text-blue-600 font-bold mt-1">
                                  ⏱️ Tổng:{" "}
                                  {trip.totalKm ||
                                    parseFloat(trip.endKm) -
                                      parseFloat(trip.startKm)}{" "}
                                  km
                                </p>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm">
                            <p className="text-gray-600">
                              <span className="font-semibold">Xuất phát:</span>{" "}
                              {new Date(trip.startDate).toLocaleDateString(
                                "vi-VN"
                              )}{" "}
                              {trip.startTime}
                            </p>
                            {trip.completed && trip.endDate && (
                              <p className="text-green-600 mt-1">
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
                          {trip.completed ? (
                            <span className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-green-500 text-white text-sm font-bold shadow-lg">
                              ✅ Hoàn tất
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-orange-500 text-white text-sm font-bold shadow-lg animate-pulse">
                              🛣️ Đang chạy
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(trip)}
                              disabled={trip.completed}
                              className={`p-2 rounded-lg transition transform hover:scale-110 ${
                                trip.completed
                                  ? "bg-gray-400 text-white cursor-not-allowed opacity-50"
                                  : "bg-blue-500 text-white hover:bg-blue-600"
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
                              className={`p-2 rounded-lg transition transform hover:scale-110 ${
                                user?.email === "admin@gmail.com"
                                  ? "bg-red-500 text-white hover:bg-red-600"
                                  : "bg-gray-400 text-white cursor-not-allowed opacity-50"
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
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 px-6 py-5 flex items-center justify-between rounded-t-2xl">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  {editingId ? (
                    <>
                      <span className="text-3xl">✏️</span>
                      <span>Chỉnh Sửa Chuyến Đi</span>
                    </>
                  ) : (
                    <>
                      <span className="text-3xl">➕</span>
                      <span>Thêm Chuyến Đi Mới</span>
                    </>
                  )}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white text-2xl font-bold hover:bg-white hover:text-blue-600 rounded-full w-10 h-10 flex items-center justify-center transition-all transform hover:rotate-90"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Driver & Vehicle */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <span className="text-red-500">*</span>
                      <span>👤 Tên Tài Xế</span>
                    </label>
                    <input
                      type="text"
                      value={newTrip.driverName}
                      onChange={(e) =>
                        setNewTrip({ ...newTrip, driverName: e.target.value })
                      }
                      disabled={
                        editingId &&
                        trips.find((t) => t.id === editingId)?.completed
                      }
                      className={`w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-base ${
                        editingId &&
                        trips.find((t) => t.id === editingId)?.completed
                          ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                          : ""
                      }`}
                      placeholder="VD: Nguyễn Văn A"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
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
                      className={`w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-base ${
                        editingId &&
                        trips.find((t) => t.id === editingId)?.completed
                          ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                          : ""
                      }`}
                      placeholder="VD: 51A-12345"
                    />
                  </div>
                </div>

                {/* Departure & Destination */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <span>📍</span>
                      <span>Điểm Đi</span>
                    </label>
                    <input
                      type="text"
                      value={newTrip.departure}
                      onChange={(e) =>
                        setNewTrip({ ...newTrip, departure: e.target.value })
                      }
                      disabled={
                        editingId &&
                        trips.find((t) => t.id === editingId)?.completed
                      }
                      className={`w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-base ${
                        editingId &&
                        trips.find((t) => t.id === editingId)?.completed
                          ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                          : ""
                      }`}
                      placeholder="VD: Công ty ABC"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <span className="text-red-500">*</span>
                      <span>🎯 Điểm Đến</span>
                    </label>
                    <input
                      type="text"
                      value={newTrip.destination}
                      onChange={(e) =>
                        setNewTrip({ ...newTrip, destination: e.target.value })
                      }
                      disabled={
                        editingId &&
                        trips.find((t) => t.id === editingId)?.completed
                      }
                      className={`w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-base ${
                        editingId &&
                        trips.find((t) => t.id === editingId)?.completed
                          ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                          : ""
                      }`}
                      placeholder="VD: TP. Hồ Chí Minh"
                    />
                  </div>
                </div>

                {/* Google Maps Distance Calculator */}
                <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-xl border-2 border-blue-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🗺️</span>
                      <span className="text-sm font-bold text-gray-700">
                        Ước Tính Khoảng Cách (Google Maps)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={calculateDistance}
                      disabled={
                        calculatingDistance ||
                        !newTrip.departure ||
                        !newTrip.destination ||
                        (editingId &&
                          trips.find((t) => t.id === editingId)?.completed)
                      }
                      className={`px-4 py-2 rounded-lg font-bold text-sm transition-all transform hover:scale-105 flex items-center gap-2 ${
                        calculatingDistance ||
                        !newTrip.departure ||
                        !newTrip.destination
                          ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : "bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:shadow-lg"
                      }`}
                    >
                      {calculatingDistance ? (
                        <>
                          <span className="animate-spin">⚙️</span>
                          <span>Đang tính...</span>
                        </>
                      ) : (
                        <>
                          <span>📍</span>
                          <span>Tính khoảng cách</span>
                        </>
                      )}
                    </button>
                  </div>
                  {estimatedKm && (
                    <div className="bg-white p-3 rounded-lg border-2 border-green-300">
                      <p className="text-sm text-gray-600 mb-1">
                        Khoảng cách ước tính (theo đường ô tô):
                      </p>
                      <p className="text-2xl font-extrabold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                        🚗 {estimatedKm} km
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        * Đây là khoảng cách ước tính từ Google Maps. Số km thực
                        tế có thể khác do tình trạng giao thông.
                      </p>
                    </div>
                  )}
                </div>

                {/* Kilometers */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <span>🚗</span>
                      <span>Km Bắt Đầu</span>
                    </label>
                    <input
                      type="number"
                      value={newTrip.startKm}
                      onChange={(e) =>
                        setNewTrip({ ...newTrip, startKm: e.target.value })
                      }
                      disabled={
                        editingId &&
                        trips.find((t) => t.id === editingId)?.completed
                      }
                      className={`w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-base ${
                        editingId &&
                        trips.find((t) => t.id === editingId)?.completed
                          ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                          : ""
                      }`}
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <span>🏁</span>
                      <span>Km Kết Thúc</span>
                    </label>
                    <input
                      type="number"
                      value={newTrip.endKm}
                      onChange={(e) =>
                        setNewTrip({ ...newTrip, endKm: e.target.value })
                      }
                      disabled={
                        editingId &&
                        trips.find((t) => t.id === editingId)?.completed
                      }
                      className={`w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-base ${
                        editingId &&
                        trips.find((t) => t.id === editingId)?.completed
                          ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                          : ""
                      }`}
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <span>📊</span>
                      <span>Tổng Km</span>
                    </label>
                    <input
                      type="text"
                      value={newTrip.totalKm}
                      readOnly
                      className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 bg-gray-100 text-gray-700 font-bold outline-none text-base"
                      placeholder="Tự động"
                    />
                  </div>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <span className="text-red-500">*</span>
                      <span>📅 Ngày Xuất Phát</span>
                    </label>
                    <input
                      type="date"
                      value={newTrip.startDate}
                      onChange={(e) =>
                        setNewTrip({ ...newTrip, startDate: e.target.value })
                      }
                      disabled={
                        editingId &&
                        trips.find((t) => t.id === editingId)?.completed
                      }
                      className={`w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-base ${
                        editingId &&
                        trips.find((t) => t.id === editingId)?.completed
                          ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                          : ""
                      }`}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <span className="text-red-500">*</span>
                      <span>⏰ Giờ Xuất Phát</span>
                    </label>
                    <input
                      type="time"
                      value={newTrip.startTime}
                      onChange={(e) =>
                        setNewTrip({ ...newTrip, startTime: e.target.value })
                      }
                      disabled={
                        editingId &&
                        trips.find((t) => t.id === editingId)?.completed
                      }
                      className={`w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-base ${
                        editingId &&
                        trips.find((t) => t.id === editingId)?.completed
                          ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                          : ""
                      }`}
                    />
                  </div>
                </div>

                {/* Purpose */}
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
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
                    className={`w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-base ${
                      editingId &&
                      trips.find((t) => t.id === editingId)?.completed
                        ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                        : ""
                    }`}
                    placeholder="VD: Giao hàng, Công tác, ..."
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
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
                    className={`w-full border-2 border-gray-300 rounded-xl px-4 py-3 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 outline-none transition-all resize-none text-base ${
                      editingId &&
                      trips.find((t) => t.id === editingId)?.completed
                        ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                        : ""
                    }`}
                    placeholder="Ghi chú thêm về chuyến đi..."
                    rows="3"
                  ></textarea>
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
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:shadow-xl transition-all font-bold shadow-lg transform hover:scale-105"
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

export default DriverLogbook;
