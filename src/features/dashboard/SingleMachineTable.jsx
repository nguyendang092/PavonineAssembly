import React, { useState, useEffect } from "react";
import { ref, set, onValue } from "firebase/database";
import { db } from "@/services/firebase";
import { format, eachDayOfInterval, endOfMonth } from "date-fns";
import { getDay } from "date-fns";
import { useTranslation } from "react-i18next";
import LoadingBlock from "@/components/ui/LoadingBlock";
import { ko } from "date-fns/locale";
import { useUser } from "@/contexts/UserContext";
import { logUserAction } from "@/utils/userLog";
import {
  FiChevronLeft,
  FiChevronRight,
  FiDroplet,
  FiSave,
  FiThermometer,
} from "react-icons/fi";

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

  const inputClass =
    "w-full max-w-[6.5rem] rounded-lg border border-slate-200/95 bg-slate-50/80 px-2.5 py-2 text-center text-sm tabular-nums text-slate-800 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] placeholder:text-slate-400 transition focus:border-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400/20 disabled:cursor-not-allowed disabled:opacity-55 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-500/25";

  return (
    <div className="mb-6 min-w-0 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-12px_rgba(15,23,42,0.14)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.04)]">
      <div
        className="h-1 bg-gradient-to-r from-amber-500/75 via-slate-300/50 to-sky-500/70 dark:from-amber-500/50 dark:via-slate-500/40 dark:to-sky-500/55"
        aria-hidden
      />
      <div className="border-b border-slate-200/80 bg-slate-50/50 px-5 pb-4 pt-4 dark:border-slate-700 dark:bg-slate-800/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl dark:text-white">
              {t(`machineNames.${machine}`)}
            </h3>
          </div>
          <span className="shrink-0 rounded-full border-2 border-slate-300/90 bg-white px-3 py-1.5 text-sm font-bold tabular-nums tracking-wide text-slate-900 shadow-sm dark:border-slate-500 dark:bg-slate-900 dark:text-slate-50">
            {selectedMonth}
          </span>
        </div>
      </div>

      {loading ? (
        <LoadingBlock
          className="py-10"
          message={t("temperatureMonitor.loading")}
          textClassName="text-sm text-slate-600 dark:text-slate-400"
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200/90 bg-slate-100/95 dark:border-slate-700 dark:bg-slate-800/80">
                  <th className="px-4 py-3.5 text-left text-xs font-extrabold uppercase tracking-[0.1em] text-slate-800 dark:text-slate-100">
                    {t("temperatureMonitor.date")}
                  </th>
                  <th className="px-3 py-3.5 text-center text-xs font-extrabold uppercase tracking-[0.1em] text-slate-800 dark:text-slate-100">
                    <span className="inline-flex items-center justify-center gap-2">
                      <FiThermometer
                        className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400"
                        aria-hidden
                      />
                      {t("temperatureMonitor.temperature")}
                    </span>
                  </th>
                  <th className="px-3 py-3.5 text-center text-xs font-extrabold uppercase tracking-[0.1em] text-slate-800 dark:text-slate-100">
                    <span className="inline-flex items-center justify-center gap-2">
                      <FiDroplet
                        className="h-4 w-4 shrink-0 text-sky-700 dark:text-sky-400"
                        aria-hidden
                      />
                      {t("temperatureMonitor.humidity")}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pagedDays.map((date, rowIdx) => {
                  const day = format(date, "dd");
                  return (
                    <tr
                      key={day}
                      className={
                        rowIdx % 2 === 0
                          ? "bg-white dark:bg-slate-900/40"
                          : "bg-slate-50/40 dark:bg-slate-900/20"
                      }
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 text-left text-sm font-bold tabular-nums text-slate-800 dark:text-slate-200">
                        {formatDate(date)}
                      </td>
                      <td className="border-l border-amber-200/40 bg-amber-50/25 px-3 py-2 text-center dark:border-amber-900/30 dark:bg-amber-950/15">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className={`${inputClass} mx-auto`}
                          value={data.temperature?.[day] || ""}
                          onChange={(e) =>
                            handleInputChange(
                              "temperature",
                              day,
                              e.target.value
                            )
                          }
                          disabled={!user}
                        />
                      </td>
                      <td className="border-l border-sky-200/40 bg-sky-50/25 px-3 py-2 text-center dark:border-sky-900/30 dark:bg-sky-950/15">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          className={`${inputClass} mx-auto`}
                          value={data.humidity?.[day] || ""}
                          onChange={(e) =>
                            handleInputChange(
                              "humidity",
                              day,
                              e.target.value
                            )
                          }
                          disabled={!user}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-100 px-4 py-4 dark:border-slate-800">
            <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex justify-center sm:justify-start">
                <div className="inline-flex items-stretch overflow-hidden rounded-xl border border-slate-200/90 bg-slate-50/90 shadow-sm dark:border-slate-600 dark:bg-slate-800/50">
                  <button
                    type="button"
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="inline-flex items-center gap-1 border-r border-slate-200/90 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-white disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700/60"
                  >
                    <FiChevronLeft className="h-4 w-4" aria-hidden />
                    {t("temperatureMonitor.previous")}
                  </button>
                  <span className="flex min-w-[9.5rem] items-center justify-center border-r border-slate-200/90 px-3 py-2 text-xs font-extrabold tabular-nums text-slate-800 dark:border-slate-600 dark:text-slate-100">
                    {t("temperatureMonitor.page", {
                      current: currentPage,
                      total: totalPages,
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center gap-1 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-white disabled:opacity-40 dark:text-slate-200 dark:hover:bg-slate-700/60"
                  >
                    {t("temperatureMonitor.next")}
                    <FiChevronRight className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>

              {user && (
                <div className="flex justify-center sm:justify-end">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-slate-800 px-6 py-2.5 text-sm font-bold text-white shadow-sm ring-1 ring-slate-900/10 transition hover:bg-slate-900 hover:shadow-md disabled:opacity-50 dark:bg-slate-600 dark:ring-white/10 dark:hover:bg-slate-500"
                  >
                    <FiSave className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                    {saving
                      ? t("temperatureMonitor.saving")
                      : t("temperatureMonitor.save")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SingleMachineTable;
