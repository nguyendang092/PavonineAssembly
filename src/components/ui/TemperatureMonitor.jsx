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
import AlertMessage from "./AlertMessage";
import LoadingBlock from "./LoadingBlock";
import SingleMachineTable from "@/features/dashboard/SingleMachineTable";
import { useTranslation } from "react-i18next";
import TemperatureFilterPanel from "@/features/dashboard/temperature/TemperatureFilterPanel";
import "@/features/dashboard/temperature/temperatureMonitor.css";

Modal.setAppElement("#root");

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
  const [showMachinePanel, setShowMachinePanel] = useState(false);
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
    setShowMachinePanel(false);
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
    <div className="temperature-monitor-page">
      <TemperatureFilterPanel
        areaKeys={areaKeys}
        selectedArea={selectedArea}
        onSelectArea={setSelectedArea}
        selectedMonth={selectedMonth}
        onSelectMonth={setSelectedMonth}
        onOpenChart={() => {
          setModalSelectedArea(selectedArea);
          setIsChartModalOpen(true);
        }}
        searchMachine={searchMachine}
        onSearchMachineChange={setSearchMachine}
        filteredMachines={filteredMachines}
        pagedMachines={pagedMachines}
        machinePage={machinePage}
        totalMachinePages={totalMachinePages}
        onPrevMachinePage={() => setMachinePage((p) => Math.max(1, p - 1))}
        onNextMachinePage={() =>
          setMachinePage((p) => Math.min(totalMachinePages, p + 1))
        }
        showMachinePanel={showMachinePanel}
        onToggleMachinePanel={() => setShowMachinePanel((prev) => !prev)}
        editingMachine={editingMachine}
        editMachineName={editMachineName}
        onEditMachineNameChange={setEditMachineName}
        onStartEditMachine={(machine) => {
          setEditingMachine(machine);
          setEditMachineName(machine);
        }}
        onCancelEditMachine={() => setEditingMachine(null)}
        onConfirmEditMachine={handleEditMachine}
        onDeleteMachine={handleDeleteMachine}
        canManageMachines={Boolean(user)}
        isAddingMachine={isAddingMachine}
        onStartAddMachine={() => setIsAddingMachine(true)}
        onCancelAddMachine={() => {
          setIsAddingMachine(false);
          setNewMachineName("");
        }}
        newMachineName={newMachineName}
        onNewMachineNameChange={setNewMachineName}
        onAddMachine={handleAddMachine}
        isLoading={isLoading}
      />

      <div className="temperature-monitor-main">
        <h2 className="temperature-monitor-main__title">
          {t("temperatureMonitor.header")} ·{" "}
          {selectedArea
            ? t(`areas.${selectedArea}`)
            : t("temperatureMonitor.noArea")}
        </h2>

        {areasLoading ? (
          <div className="py-8 text-center text-lg text-gray-500 dark:text-slate-400">
            {t("temperatureMonitor.loading", "Đang tải dữ liệu...")}
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
          <div className="temperature-monitor-grid">
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

      {/* Modal biểu đồ */}
      <Modal
        isOpen={isChartModalOpen}
        onRequestClose={() => setIsChartModalOpen(false)}
        className="mx-auto mt-16 max-h-[90vh] w-full max-w-7xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900"
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
