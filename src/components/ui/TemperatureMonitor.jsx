import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useDeferredValue,
  lazy,
  Suspense,
} from "react";
import { useUser } from "@/contexts/UserContext";
import { logUserAction } from "@/utils/userLog";
import { format } from "date-fns";
import Modal from "react-modal";
import { ref, onValue, set, remove, update, get } from "firebase/database";
import { db } from "@/services/firebase";
import { HiCalendar, HiFolder } from "react-icons/hi";
import { FaCheck, FaChartLine, FaPlus, FaEdit, FaTrash } from "react-icons/fa";
import AlertMessage from "./AlertMessage";
import LoadingBlock from "./LoadingBlock";
import SingleMachineTable from "@/features/dashboard/SingleMachineTable";
import { useTranslation } from "react-i18next";
import Sidebar from "@/components/layout/Sidebar";

Modal.setAppElement("#root");

/** Thanh cuộn mỏng, tông trắng mờ — khớp sidebar kính (WebKit + Firefox) */
const TEMP_SIDEBAR_SCROLL =
  "overscroll-contain [scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.42)_rgba(255,255,255,0.07)] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white/[0.07] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/[0.28] [&::-webkit-scrollbar-thumb]:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] [&::-webkit-scrollbar-thumb]:transition-colors duration-150 hover:[&::-webkit-scrollbar-thumb]:bg-white/[0.48]";

const PAGE_SIZE = 6;
const ChartView = lazy(() => import("@/features/dashboard/ChartView"));

const TemperatureMonitor = () => {
  const { user } = useUser();
  const { t } = useTranslation();
  const [toastMessage, setToastMessage] = useState("");
  const [editingMachine, setEditingMachine] = useState(null);
  const [editMachineName, setEditMachineName] = useState("");
  const [areas, setAreas] = useState({});
  const [selectedArea, setSelectedArea] = useState(null);
  const [searchMachine, setSearchMachine] = useState("");
  const [areasLoading, setAreasLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() =>
    format(new Date(), "yyyy-MM"),
  );
  const [showAreas, setShowAreas] = useState(false);
  const [showAreaDetails, setShowAreaDetails] = useState(false);
  const [showMonthInput, setShowMonthInput] = useState(false);
  const [isChartModalOpen, setIsChartModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("temperature");
  const [modalSelectedArea, setModalSelectedArea] = useState(null);
  const [newMachineName, setNewMachineName] = useState("");
  const [isAddingMachine, setIsAddingMachine] = useState(false);

  // Toast timeout cleanup
  const toastTimeoutRef = useRef();
  const showToast = useCallback((message) => {
    setToastMessage(message);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToastMessage(""), 3000);
  }, []);
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    setAreasLoading(true);
    const areasRef = ref(db, "areas");
    let isMounted = true;
    const unsubscribe = onValue(
      areasRef,
      (snapshot) => {
        if (!isMounted) return;
        const data = snapshot.val() || {};
        setAreas(data);
        setAreasLoading(false);
        // Nếu selectedArea không còn tồn tại thì reset
        setSelectedArea((prev) => (prev && !data[prev] ? null : prev));
      },
      () => {
        if (isMounted) setAreasLoading(false);
      },
    );
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Chunk load máy (pagination)
  const [machinePage, setMachinePage] = useState(1);
  const deferredSearchMachine = useDeferredValue(searchMachine);

  const areaKeys = useMemo(() => Object.keys(areas), [areas]);
  const selectedAreaMachines = useMemo(
    () => (selectedArea ? areas[selectedArea]?.machines || [] : []),
    [areas, selectedArea],
  );

  const filteredMachines = useMemo(() => {
    const normalizedSearch = deferredSearchMachine.trim().toLowerCase();
    if (!normalizedSearch) return selectedAreaMachines;
    return selectedAreaMachines.filter((m) =>
      m.toLowerCase().includes(normalizedSearch),
    );
  }, [selectedAreaMachines, deferredSearchMachine]);
  const totalMachinePages = useMemo(
    () => Math.ceil(filteredMachines.length / PAGE_SIZE),
    [filteredMachines.length],
  );
  const pagedMachines = useMemo(
    () =>
      filteredMachines.slice(
        (machinePage - 1) * PAGE_SIZE,
        machinePage * PAGE_SIZE,
      ),
    [filteredMachines, machinePage],
  );

  useEffect(() => {
    setMachinePage(1);
  }, [selectedArea, filteredMachines.length]);

  useEffect(() => {
    // Đổi khu vực thì thu gọn phần máy (con); danh sách khu vực (tổng) giữ nguyên trạng thái mở/đóng do người dùng
    setShowAreaDetails(false);
  }, [selectedArea]);

  const [isLoading, setIsLoading] = useState(false);
  const handleEditMachine = useCallback(
    async (oldName, newName) => {
      const trimmedNew = newName.trim();
      if (!selectedArea || !trimmedNew) return;

      const currentMachines = areas[selectedArea]?.machines || [];
      if (oldName === trimmedNew) {
        setEditingMachine(null);
        return;
      }
      // Kiểm tra trùng tên không phân biệt hoa thường
      if (
        currentMachines.some(
          (m) => m.trim().toLowerCase() === trimmedNew.toLowerCase(),
        )
      ) {
        alert(t("temperatureMonitor.machineExists"));
        return;
      }
      setIsLoading(true);
      try {
        const updatedMachines = currentMachines.map((m) =>
          m === oldName ? trimmedNew : m,
        );
        await update(ref(db, `areas/${selectedArea}`), {
          machines: updatedMachines,
        });

        const oldRef = ref(
          db,
          `temperature_monitor/${selectedArea}/${oldName}`,
        );
        const newRef = ref(
          db,
          `temperature_monitor/${selectedArea}/${trimmedNew}`,
        );
        const snapshot = await get(oldRef);
        if (snapshot.exists()) {
          await set(newRef, snapshot.val());
          await remove(oldRef);
          setEditingMachine(null);
          setEditMachineName("");
          showToast(
            t("temperatureMonitor.renamed", { oldName, newName: trimmedNew }),
          );
          // Ghi log đổi tên máy
          if (user && user.email) {
            await logUserAction(
              user.email,
              "edit_machine",
              `Đổi tên máy từ ${oldName} sang ${trimmedNew} tại khu vực ${selectedArea}`,
            );
          }
        } else {
          alert(t("temperatureMonitor.dataNotFound"));
        }
      } catch (error) {
        alert(t("temperatureMonitor.editError"));
        console.error(error);
      }
      setIsLoading(false);
    },
    [areas, selectedArea, showToast, t, user],
  );

  const handleDeleteMachine = useCallback(
    async (machineName) => {
      if (!selectedArea) return;
      if (
        !window.confirm(t("temperatureMonitor.confirmDelete", { machineName }))
      )
        return;
      setIsLoading(true);
      try {
        const updatedMachines = areas[selectedArea]?.machines.filter(
          (m) => m !== machineName,
        );
        await update(ref(db, `areas/${selectedArea}`), {
          machines: updatedMachines,
        });
        await remove(
          ref(db, `temperature_monitor/${selectedArea}/${machineName}`),
        );
        // Ghi log xóa máy
        if (user && user.email) {
          await logUserAction(
            user.email,
            "delete_machine",
            `Xóa máy ${machineName} tại khu vực ${selectedArea}`,
          );
        }
      } catch (error) {
        alert(t("temperatureMonitor.deleteError"));
      }
      setIsLoading(false);
    },
    [areas, selectedArea, t, user],
  );

  // Validate tên máy: không ký tự đặc biệt, không rỗng, tối đa 30 ký tự
  const isValidMachineName = (name) => {
    if (!name) return false;
    if (name.length > 30) return false;
    if (!/^[\w\s-]+$/.test(name)) return false;
    return true;
  };

  const handleAddMachine = useCallback(async () => {
    const trimmedMachine = newMachineName.trim();
    if (!trimmedMachine || !selectedArea) return;
    if (!isValidMachineName(trimmedMachine)) {
      alert(t("temperatureMonitor.invalidMachineName"));
      return;
    }
    const existingMachines = areas[selectedArea]?.machines || [];
    // Kiểm tra trùng tên không phân biệt hoa thường
    if (
      existingMachines.some(
        (m) => m.trim().toLowerCase() === trimmedMachine.toLowerCase(),
      )
    ) {
      alert(t("temperatureMonitor.machineExists"));
      return;
    }
    setIsLoading(true);
    try {
      const updatedMachines = [...existingMachines, trimmedMachine];
      await update(ref(db, `areas/${selectedArea}`), {
        machines: updatedMachines,
      });
      await set(
        ref(db, `temperature_monitor/${selectedArea}/${trimmedMachine}`),
        {},
      );
      setNewMachineName("");
      setIsAddingMachine(false);
      // Ghi log thêm máy
      if (user && user.email) {
        await logUserAction(
          user.email,
          "add_machine",
          `Thêm máy ${trimmedMachine} tại khu vực ${selectedArea}`,
        );
      }
    } catch (error) {
      alert(t("temperatureMonitor.addError"));
    }
    setIsLoading(false);
  }, [areas, newMachineName, selectedArea, t, user]);
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-200 to-indigo-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Sidebar */}
      <Sidebar>
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/20 bg-white/12 px-4 py-4 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
            <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">
              🌡️ {t("temperatureMonitor.title")}
            </h2>
            <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-white/75">
              {t("temperatureMonitor.filters")}
            </p>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
            <button
              onClick={() => setShowAreas(!showAreas)}
              className="flex w-full items-center gap-3 rounded-xl bg-white/10 px-3 py-2.5 text-left transition hover:bg-white/20"
            >
              <HiFolder className="text-lg text-white/90" />
              <span className="text-sm font-bold text-white">
                {t("temperatureMonitor.area")}
              </span>
              <span className="ml-auto text-xs text-white/80">
                {showAreas ? "▲" : "▼"}
              </span>
            </button>

            <div
              className={`mt-2 space-y-1 transition-all duration-200 ${
                showAreas
                  ? `max-h-72 overflow-y-auto opacity-100 translate-y-0 ${TEMP_SIDEBAR_SCROLL}`
                  : "max-h-0 overflow-hidden opacity-0 -translate-y-1 pointer-events-none"
              }`}
            >
                {areaKeys.length === 0 && (
                  <p className="rounded-lg bg-black/10 px-3 py-2 text-sm italic text-white/70">
                    {t("temperatureMonitor.noArea")}
                  </p>
                )}
                {areaKeys.map((areaKey) => (
                  <button
                    key={areaKey}
                    onClick={() => setSelectedArea(areaKey)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                      selectedArea === areaKey
                        ? "bg-white text-slate-900 font-bold shadow-sm"
                        : "bg-transparent text-white/90 hover:bg-white/15"
                    }`}
                  >
                    {t(`areas.${areaKey}`)}
                  </button>
                ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
            <button
              onClick={() => setShowMonthInput(!showMonthInput)}
              className="flex w-full items-center gap-3 rounded-xl bg-white/10 px-3 py-2.5 transition hover:bg-white/20"
            >
              <HiCalendar className="text-lg text-white/90" />
              <span className="text-sm font-bold text-white">
                {t("temperatureMonitor.month")}
              </span>
              <span className="ml-auto text-xs text-white/80">
                {showMonthInput ? "▲" : "▼"}
              </span>
            </button>
            <div
              className={`mt-2 overflow-hidden transition-all duration-200 ${
                showMonthInput
                  ? "max-h-24 opacity-100 translate-y-0"
                  : "max-h-0 opacity-0 -translate-y-1 pointer-events-none"
              }`}
            >
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full rounded-lg border border-white/20 bg-white/95 px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <button
            onClick={() => {
              setModalSelectedArea(selectedArea);
              setIsChartModalOpen(true);
            }}
            disabled={!selectedArea}
            className="flex w-full items-center gap-3 rounded-2xl border border-indigo-300/35 bg-indigo-500/20 px-4 py-3 text-left transition hover:bg-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FaChartLine className="text-lg text-indigo-100" />
            <span className="text-sm font-bold text-white">
              {t("temperatureMonitor.viewChart")}
            </span>
          </button>

          {selectedArea && (
            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
              <button
                onClick={() => setShowAreaDetails((prev) => !prev)}
                className="flex w-full items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-left transition hover:bg-white/20"
              >
                <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white">
                  {t("temperatureMonitor.area")}: {t(`areas.${selectedArea}`)}
                </span>
                <span className="ml-auto text-xs text-white/80">
                  {showAreaDetails ? "▲" : "▼"}
                </span>
              </button>

              <div
                className={`mt-2 transition-all duration-200 ${
                  showAreaDetails
                    ? `max-h-[1200px] overflow-y-auto opacity-100 translate-y-0 ${TEMP_SIDEBAR_SCROLL}`
                    : "max-h-0 overflow-hidden opacity-0 -translate-y-1 pointer-events-none"
                }`}
              >
              <input
                type="text"
                value={searchMachine}
                onChange={(e) => setSearchMachine(e.target.value)}
                placeholder={t("temperatureMonitor.searchMachine")}
                className="mb-2 w-full rounded-lg border border-white/20 bg-white/95 px-3 py-2 text-sm text-slate-900 outline-none ring-0 placeholder:text-slate-500 focus:border-white/60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                autoComplete="off"
              />

              {filteredMachines.length === 0 && !isAddingMachine && (
                <div className="mb-2 rounded-lg bg-black/10 px-3 py-2 text-sm italic text-white/80">
                  {t("temperatureMonitor.noMachineGuide")}
                </div>
              )}

              <ul className="space-y-1.5">
                {pagedMachines.map((machine) => (
                  <li
                    key={machine}
                    className="flex items-center justify-between rounded-lg border border-white/12 bg-white/8 px-2.5 py-2"
                  >
                    {editingMachine === machine ? (
                      <>
                        <input
                          value={editMachineName}
                          onChange={(e) => setEditMachineName(e.target.value)}
                          className="flex-1 rounded-md border border-white/20 bg-white/95 px-2 py-1 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              handleEditMachine(machine, editMachineName);
                            if (e.key === "Escape") setEditingMachine(null);
                          }}
                          autoFocus
                        />
                        <button
                          onClick={() =>
                            handleEditMachine(machine, editMachineName)
                          }
                          className="ml-2 rounded-md p-1 text-white hover:bg-white/20"
                        >
                          <FaCheck />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="truncate pr-2 text-sm font-medium text-white">
                          {t(`machineNames.${machine}`, {
                            defaultValue: machine,
                          })}
                        </span>

                        {user && (
                          <div className="flex space-x-1">
                            <button
                              onClick={() => {
                                setEditingMachine(machine);
                                setEditMachineName(machine);
                              }}
                              className="rounded-md p-1.5 text-white/85 transition hover:bg-white/20 hover:text-white"
                            >
                              <FaEdit />
                            </button>
                            <button
                              onClick={() => handleDeleteMachine(machine)}
                              className="rounded-md p-1.5 text-white/85 transition hover:bg-red-400/20 hover:text-red-100"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>

              {filteredMachines.length > PAGE_SIZE && (
                <div className="mt-3 flex items-center justify-center gap-2 text-sm text-white/90">
                  <button
                    onClick={() => setMachinePage((p) => Math.max(1, p - 1))}
                    disabled={machinePage === 1}
                    className="rounded-lg border border-white/30 bg-white/10 px-2.5 py-1.5 font-semibold transition hover:bg-white/20 disabled:opacity-50"
                  >
                    {t("temperatureMonitor.previous")}
                  </button>
                  <span className="rounded-md bg-black/10 px-2 py-1 text-xs font-bold">
                    {t("temperatureMonitor.page", {
                      current: machinePage,
                      total: totalMachinePages,
                    })}
                  </span>
                  <button
                    onClick={() =>
                      setMachinePage((p) => Math.min(totalMachinePages, p + 1))
                    }
                    disabled={machinePage === totalMachinePages}
                    className="rounded-lg border border-white/30 bg-white/10 px-2.5 py-1.5 font-semibold transition hover:bg-white/20 disabled:opacity-50"
                  >
                    {t("temperatureMonitor.next")}
                  </button>
                </div>
              )}

              {user &&
                (isAddingMachine ? (
                  <div className="mt-3 flex gap-1.5">
                    <input
                      type="text"
                      value={newMachineName}
                      onChange={(e) => setNewMachineName(e.target.value)}
                      placeholder={t("temperatureMonitor.newMachine")}
                      className="flex-1 rounded-lg border border-white/20 bg-white/95 px-2.5 py-1.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      disabled={isLoading}
                    />
                    <button
                      onClick={handleAddMachine}
                      disabled={isLoading}
                      className="rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-60"
                    >
                      {isLoading
                        ? t("temperatureMonitor.saving")
                        : t("temperatureMonitor.add")}
                    </button>
                    <button
                      onClick={() => {
                        setIsAddingMachine(false);
                        setNewMachineName("");
                      }}
                      disabled={isLoading}
                      className="rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
                    >
                      {t("temperatureMonitor.cancel")}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAddingMachine(true)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/12 px-3 py-1.5 text-sm font-bold text-white transition hover:bg-white/20"
                    disabled={isLoading}
                  >
                    <FaPlus />
                    <span>{t("temperatureMonitor.addMachine")}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>
      </Sidebar>

      {/* Nội dung chính */}
      <div className="flex-1 px-3 pb-4 pt-4 sm:px-4 sm:pb-5 sm:pt-5 md:ml-72 md:px-6 md:pb-6 md:pt-6">
        <div className="min-h-[71.2vh] rounded-2xl border border-slate-200/95 bg-gradient-to-b from-slate-50 via-white to-slate-100/90 p-6 pt-8 shadow-[0_1px_3px_rgba(15,23,42,0.06),0_20px_50px_-24px_rgba(15,23,42,0.12)] backdrop-blur-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 dark:shadow-none dark:ring-1 dark:ring-slate-800">
          <h2 className="mb-8 text-center text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            <span
              className="mr-2 inline-block align-middle opacity-95"
              aria-hidden
            >
              📋
            </span>
            <span className="text-slate-900 dark:text-white">
              {t("temperatureMonitor.header")}
            </span>
            <span className="mx-2 font-light text-slate-400 dark:text-slate-500">
              ·
            </span>
            <span className="text-slate-900 dark:text-white">
              {selectedArea
                ? t(`areas.${selectedArea}`)
                : t("temperatureMonitor.noArea")}
            </span>
          </h2>

          {areasLoading ? (
            <div className="py-8 text-center text-lg text-gray-500 dark:text-slate-400">
              {t("temperatureMonitor.loading")}
            </div>
          ) : !selectedArea ? (
            <div className="py-8 text-center text-lg text-gray-500 dark:text-slate-400">
              {t("temperatureMonitor.noAreaGuide")}
            </div>
          ) : filteredMachines.length === 0 ? (
            <p className="text-center text-gray-600 dark:text-slate-400">
              {t("temperatureMonitor.noMachine")}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {pagedMachines.map((machine) => (
                <div key={machine} className="min-w-0 overflow-x-auto">
                  <SingleMachineTable
                    machine={machine}
                    selectedMonth={selectedMonth}
                    showToast={showToast}
                    area={selectedArea}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal biểu đồ */}
      <Modal
        isOpen={isChartModalOpen}
        onRequestClose={() => setIsChartModalOpen(false)}
        className="mx-auto mt-16 max-h-[90vh] w-full max-w-7xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-start z-50"
      >
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-6">
            <h3 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              📈 {t("temperatureMonitor.chartTitle")} - {selectedMonth}
            </h3>
            <select
              value={modalSelectedArea}
              onChange={(e) => setModalSelectedArea(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {areaKeys.map((areaKey) => (
                <option key={areaKey} value={areaKey}>
                  {t(`areas.${areaKey}`)}{" "}
                  {/* ✅ dịch tên hiển thị, nhưng giữ key gốc làm value */}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setIsChartModalOpen(false)}
            className="font-bold text-red-600 hover:text-red-800"
          >
            {t("temperatureMonitor.close")} ✖
          </button>
        </div>

        <div className="mb-6 flex space-x-4">
          <button
            onClick={() => setActiveTab("temperature")}
            className={`px-5 py-2 rounded-md font-bold border ${
              activeTab === "temperature"
                ? "bg-indigo-600 text-white shadow"
                : "border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-300"
            }`}
          >
            {t("temperatureMonitor.temperature")}
          </button>
          <button
            onClick={() => setActiveTab("humidity")}
            className={`px-5 py-2 rounded-md font-bold border ${
              activeTab === "humidity"
                ? "bg-indigo-600 text-white shadow"
                : "border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-300"
            }`}
          >
            {t("temperatureMonitor.humidity")}
          </button>
        </div>

        {modalSelectedArea ? (
          <Suspense
            fallback={
              <LoadingBlock
                className="py-8"
                message={t("temperatureMonitor.loading")}
                textClassName="text-base text-slate-600 dark:text-slate-400"
              />
            }
          >
            <ChartView
              selectedArea={modalSelectedArea}
              selectedMonth={selectedMonth}
              type={activeTab}
              machines={areas[modalSelectedArea]?.machines || []}
            />
          </Suspense>
        ) : (
          <p>{t("temperatureMonitor.noChartArea")}</p>
        )}
      </Modal>

      <AlertMessage
        message={toastMessage}
        onClose={() => setToastMessage("")}
      />
    </div>
  );
};

export default TemperatureMonitor;
