import React, { useState, useEffect } from "react";
import { ref, set, onValue } from "firebase/database";
import { db } from "./firebase";
import { format, eachDayOfInterval, endOfMonth } from "date-fns";
import { getDay } from "date-fns";
import { useTranslation } from "react-i18next";
import { ko } from "date-fns/locale";
import { useUser } from "./UserContext";
import { logUserAction } from "./userLog";
const PAGE_SIZE = 10;

const SingleMachineTable = ({ area, machine, selectedMonth, showToast }) => {
  const { user } = useUser();
  const { t, i18n } = useTranslation();
  const [data, setData] = useState({ temperature: {}, humidity: {} });
  const [currentPage, setCurrentPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };
  const daysInMonth = eachDayOfInterval({
    start: new Date(`${selectedMonth}-01`),
    end: endOfMonth(new Date(`${selectedMonth}-01`)),
  }).filter((date) => getDay(date) !== 0); // loại Chủ Nhật

  const totalPages = Math.ceil(daysInMonth.length / PAGE_SIZE);
  const pagedDays = daysInMonth.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  useEffect(() => {
    let isMounted = true;
    if (!area || !machine || !selectedMonth) return;
    setLoading(true);

    const path = `temperature_monitor/${area}/${machine}/${selectedMonth}`;
    const dataRef = ref(db, path);
    const unsubscribe = onValue(
      dataRef,
      (snapshot) => {
        if (!isMounted) return;
        const val = snapshot.val() || { temperature: {}, humidity: {} };
        setData(val);
        setLoading(false);
      },
      (err) => {
        if (isMounted) setLoading(false);
      }
    );

    const today = new Date();
    const thisMonth = new Date(`${selectedMonth}-01`);
    if (
      today.getMonth() === thisMonth.getMonth() &&
      today.getFullYear() === thisMonth.getFullYear()
    ) {
      const index = daysInMonth.findIndex(
        (d) => format(d, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")
      );
      if (index !== -1) {
        const page = Math.floor(index / PAGE_SIZE) + 1;
        setCurrentPage(page);
      } else {
        setCurrentPage(1);
      }
    } else {
      setCurrentPage(1);
    }

    return () => {
      isMounted = false;
      unsubscribe();
      // Không setState nếu đã unmount
    };
  }, [area, machine, selectedMonth]);

  // Validate: chỉ cho phép số >= 0, tối đa 2 chữ số thập phân
  const validateValue = (val) => {
    if (val === "") return true;
    const num = Number(val);
    if (isNaN(num) || num < 0) return false;
    // Tối đa 2 số sau dấu phẩy
    if (/\./.test(val)) {
      const [, decimal] = val.split(".");
      if (decimal && decimal.length > 2) return false;
    }
    return true;
  };

  const handleInputChange = (type, day, value) => {
    if (!validateValue(value)) return;
    setData((prev) => {
      const updated = { ...prev };
      if (!updated[type]) updated[type] = {};
      updated[type][day] = value;
      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const promises = [];
      for (const type of ["temperature", "humidity"]) {
        const entries = data[type] || {};
        for (const [day, val] of Object.entries(entries)) {
          const path = `temperature_monitor/${area}/${machine}/${selectedMonth}/${type}/${day}`;
          const valueToSave = val === "" ? null : parseFloat(val);
          promises.push(set(ref(db, path), valueToSave));
        }
      }
      await Promise.all(promises);
      // Ghi log khi lưu dữ liệu nhiệt độ/độ ẩm
      if (user && user.email) {
        await logUserAction(
          user.email,
          "save_temperature_humidity",
          `Lưu dữ liệu máy: ${machine}, khu vực: ${area}, tháng: ${selectedMonth}`
        );
      }
      if (showToast)
        showToast(t("temperatureMonitor.saveSuccess", { machine }));
    } catch (error) {
      console.error("Lỗi lưu dữ liệu:", error);
      if (showToast) showToast(t("temperatureMonitor.saveFail"));
    } finally {
      setSaving(false);
    }
  };

  // Xác định locale cho date-fns dựa trên ngôn ngữ hiện tại
  const localeMap = {
    ko: ko,
    vi: undefined, // date-fns mặc định (MM/dd/yyyy)
  };
  const currentLocale = localeMap[i18n.language] || undefined;

  // Định dạng ngày theo locale
  const formatDate = (date) => {
    if (i18n.language === "ko") {
      return format(date, "yyyy년 MM월 dd일", { locale: currentLocale });
    }
    // Mặc định hoặc việt: MM/dd/yyyy
    return format(date, "MM/dd/yyyy");
  };

  return (
    <div className="mb-8 border rounded p-4 shadow-md max-w-full">
      <h3 className="text-xl font-semibold mb-2">
        {t(`machineNames.${machine}`)}
      </h3>
      {loading ? (
        <div className="text-center py-8 text-lg text-gray-500">
          {t("temperatureMonitor.loading")}
        </div>
      ) : (
        <>
          <table className="w-full border text-sm min-w-max">
            <thead>
              <tr className="bg-gray-100">
                <th className="border px-2 py-1">
                  {t("temperatureMonitor.date")}
                </th>
                <th className="border px-2 py-1">
                  {t("temperatureMonitor.temperature")}
                </th>
                <th className="border px-2 py-1">
                  {t("temperatureMonitor.humidity")}
                </th>
              </tr>
            </thead>
            <tbody>
              {pagedDays.map((date) => {
                const day = format(date, "dd");
                return (
                  <tr key={day}>
                    <td className="border px-2 py-1 text-center font-semibold text-gray-800">
                      {formatDate(date)}
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full border px-1 py-0.5 text-center rounded"
                        value={data.temperature?.[day] || ""}
                        onChange={(e) =>
                          handleInputChange("temperature", day, e.target.value)
                        }
                        disabled={!user}
                      />
                    </td>
                    <td className="border px-2 py-1 text-center">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        className="w-full border px-1 py-0.5 text-center rounded"
                        value={data.humidity?.[day] || ""}
                        onChange={(e) =>
                          handleInputChange("humidity", day, e.target.value)
                        }
                        disabled={!user}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex justify-center items-center mt-4 space-x-2">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              {t("temperatureMonitor.previous")}
            </button>
            <span>
              {t("temperatureMonitor.page", {
                current: currentPage,
                total: totalPages,
              })}
            </span>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              {t("temperatureMonitor.next")}
            </button>
          </div>

          {/* Save Button */}
          {user && (
            <div className="flex justify-center mt-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving
                  ? t("temperatureMonitor.saving")
                  : t("temperatureMonitor.save")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SingleMachineTable;
