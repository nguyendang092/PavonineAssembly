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
import { useUserIdentity } from "@/contexts/UserContext";
import { logUserAction } from "@/utils/userLog";
import { format } from "date-fns";
import Modal from "react-modal";
import { ref, set, remove, update, get } from "firebase/database";
import { db } from "@/services/firebase";
import { useFirebaseValue } from "@/hooks/useFirebaseValue";
import AlertMessage from "@/components/ui/AlertMessage";
import LoadingBlock from "@/components/ui/LoadingBlock";
import { useTranslation } from "react-i18next";
import TemperatureMonitorTopbar from "@/features/dashboard/temperature/TemperatureMonitorTopbar";
import TemperatureAreaCard from "@/features/dashboard/temperature/TemperatureAreaCard";
import TemperatureDeviceNav from "@/features/dashboard/temperature/TemperatureDeviceNav";
import TemperatureEntryPanel from "@/features/dashboard/temperature/TemperatureEntryPanel";
import TemperatureInsightsPanel from "@/features/dashboard/temperature/TemperatureInsightsPanel";
import { useTemperatureMachineSummaries } from "@/features/dashboard/temperature/useTemperatureMachineSummaries";
import { validateMetricInput } from "@/features/dashboard/temperature/temperatureMonitorUtils";
import "@/features/dashboard/temperature/temperatureMonitor.css";

Modal.setAppElement("#root");

const ChartView = lazy(() => import("@/features/dashboard/ChartView"));

const emptyData = () => ({ temperature: {}, humidity: {} });

const TemperatureMonitor = () => {
  const { user } = useUserIdentity();
  const { t, i18n } = useTranslation();
  const [toastMessage, setToastMessage] = useState("");
  const [editingMachine, setEditingMachine] = useState(null);
  const [editMachineName, setEditMachineName] = useState("");
  const [selectedArea, setSelectedArea] = useState(null);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [searchMachine, setSearchMachine] = useState("");
  const { data: areasRaw, loading: areasLoading } = useFirebaseValue("areas");
  const areas = areasRaw || {};
  const [selectedMonth, setSelectedMonth] = useState(() =>
    format(new Date(), "yyyy-MM"),
  );
  const [isChartModalOpen, setIsChartModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("temperature");
  const [modalSelectedArea, setModalSelectedArea] = useState(null);
  const [newMachineName, setNewMachineName] = useState("");
  const [isAddingMachine, setIsAddingMachine] = useState(false);
  const [data, setData] = useState(emptyData);
  const [baseline, setBaseline] = useState(emptyData);
  const [saving, setSaving] = useState(false);

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
    setSelectedArea((prev) => (prev && !areas[prev] ? null : prev));
  }, [areas]);

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

  const summariesByMachine = useTemperatureMachineSummaries(
    selectedArea,
    selectedMonth,
    selectedAreaMachines,
  );

  useEffect(() => {
    setSelectedMachine((prev) => {
      if (prev && filteredMachines.includes(prev)) return prev;
      return filteredMachines[0] ?? null;
    });
  }, [selectedArea, selectedMonth, filteredMachines]);

  const machineDataPath =
    selectedArea && selectedMachine && selectedMonth
      ? `temperature_monitor/${selectedArea}/${selectedMachine}/${selectedMonth}`
      : null;
  const { data: machineRaw, loading: machineLoading } =
    useFirebaseValue(machineDataPath);

  useEffect(() => {
    const next = machineRaw || emptyData();
    setData(next);
    setBaseline(next);
  }, [machineRaw, selectedArea, selectedMachine, selectedMonth]);

  const [isLoading, setIsLoading] = useState(false);

  const handleMetricChange = useCallback((type, day, value) => {
    if (!validateMetricInput(value)) return;
    setData((prev) => {
      const updated = { ...prev, [type]: { ...(prev[type] ?? {}) } };
      updated[type][day] = value;
      return updated;
    });
  }, []);

  const handleCopyPrevious = useCallback((day, prevDay) => {
    if (!prevDay) return;
    setData((prev) => {
      const next = {
        temperature: { ...(prev.temperature ?? {}) },
        humidity: { ...(prev.humidity ?? {}) },
      };
      const prevTemp = prev.temperature?.[prevDay];
      const prevHum = prev.humidity?.[prevDay];
      if (prevTemp !== "" && prevTemp != null) next.temperature[day] = prevTemp;
      if (prevHum !== "" && prevHum != null) next.humidity[day] = prevHum;
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedArea || !selectedMachine || !selectedMonth) return;
    setSaving(true);
    try {
      const promises = [];
      for (const type of ["temperature", "humidity"]) {
        const entries = data[type] || {};
        for (const [day, val] of Object.entries(entries)) {
          const path = `temperature_monitor/${selectedArea}/${selectedMachine}/${selectedMonth}/${type}/${day}`;
          const valueToSave = val === "" ? null : parseFloat(val);
          promises.push(set(ref(db, path), valueToSave));
        }
      }
      await Promise.all(promises);
      setBaseline(data);
      if (user?.email) {
        await logUserAction(
          user.email,
          "save_temperature_humidity",
          `Lưu dữ liệu máy: ${selectedMachine}, khu vực: ${selectedArea}, tháng: ${selectedMonth}`,
        );
      }
      showToast(
        t("temperatureMonitor.saveSuccess", { machine: selectedMachine }),
      );
    } catch (error) {
      console.error("Lỗi lưu dữ liệu:", error);
      showToast(t("temperatureMonitor.saveFail"));
    } finally {
      setSaving(false);
    }
  }, [
    data,
    selectedArea,
    selectedMachine,
    selectedMonth,
    showToast,
    t,
    user,
  ]);

  const handleEditMachine = useCallback(
    async (oldName, newName) => {
      const trimmedNew = newName.trim();
      if (!selectedArea || !trimmedNew) return;

      const currentMachines = areas[selectedArea]?.machines || [];
      if (oldName === trimmedNew) {
        setEditingMachine(null);
        return;
      }
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
        }
        if (selectedMachine === oldName) setSelectedMachine(trimmedNew);
        setEditingMachine(null);
        setEditMachineName("");
        showToast(
          t("temperatureMonitor.renamed", { oldName, newName: trimmedNew }),
        );
        if (user?.email) {
          await logUserAction(
            user.email,
            "edit_machine",
            `Đổi tên máy từ ${oldName} sang ${trimmedNew} tại khu vực ${selectedArea}`,
          );
        }
      } catch (error) {
        alert(t("temperatureMonitor.editError"));
        console.error(error);
      }
      setIsLoading(false);
    },
    [areas, selectedArea, selectedMachine, showToast, t, user],
  );

  const handleDeleteMachine = useCallback(
    async (machineName) => {
      if (!selectedArea) return;
      if (
        !window.confirm(t("temperatureMonitor.confirmDelete", { machineName }))
      ) {
        return;
      }
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
        if (selectedMachine === machineName) {
          setSelectedMachine(null);
        }
        if (user?.email) {
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
    [areas, selectedArea, selectedMachine, t, user],
  );

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
      setSelectedMachine(trimmedMachine);
      setNewMachineName("");
      setIsAddingMachine(false);
      if (user?.email) {
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
      <TemperatureMonitorTopbar
        selectedArea={selectedArea}
        selectedMonth={selectedMonth}
        onSelectMonth={setSelectedMonth}
        searchMachine={searchMachine}
        onSearchMachineChange={setSearchMachine}
        onOpenChart={() => {
          setModalSelectedArea(selectedArea);
          setIsChartModalOpen(true);
        }}
      />

      <div className="tm-container">
        {areasLoading ? (
          <LoadingBlock
            className="py-16"
            message={t("temperatureMonitor.loading")}
          />
        ) : (
          <div className="tm-layout">
            <TemperatureAreaCard
              areaKeys={areaKeys}
              selectedArea={selectedArea}
              onSelectArea={setSelectedArea}
            />
            <TemperatureDeviceNav
              selectedArea={selectedArea}
              machines={filteredMachines}
              summariesByMachine={summariesByMachine}
              selectedMachine={selectedMachine}
              onSelectMachine={setSelectedMachine}
              canManageMachines={Boolean(user)}
              isLoading={isLoading}
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
              isAddingMachine={isAddingMachine}
              onStartAddMachine={() => setIsAddingMachine(true)}
              onCancelAddMachine={() => {
                setIsAddingMachine(false);
                setNewMachineName("");
              }}
              newMachineName={newMachineName}
              onNewMachineNameChange={setNewMachineName}
              onAddMachine={handleAddMachine}
            />

            {!selectedArea ? (
              <section className="tm-card tm-panel">
                <p className="tm-empty-state">{t("temperatureMonitor.noAreaGuide")}</p>
              </section>
            ) : selectedMachine ? (
              <>
                <TemperatureEntryPanel
                  machine={selectedMachine}
                  selectedMonth={selectedMonth}
                  data={data}
                  baseline={baseline}
                  loading={machineLoading}
                  canEdit={Boolean(user)}
                  saving={saving}
                  onTemperatureChange={(day, value) =>
                    handleMetricChange("temperature", day, value)
                  }
                  onHumidityChange={(day, value) =>
                    handleMetricChange("humidity", day, value)
                  }
                  onCopyPrevious={handleCopyPrevious}
                  onSave={handleSave}
                  i18nLanguage={i18n.language}
                />
                <TemperatureInsightsPanel
                  data={data}
                  selectedMonth={selectedMonth}
                />
              </>
            ) : (
              <section className="tm-card tm-panel">
                <p className="tm-empty-state">{t("temperatureMonitor.noMachine")}</p>
              </section>
            )}
          </div>
        )}
      </div>

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
              value={modalSelectedArea ?? ""}
              onChange={(e) => setModalSelectedArea(e.target.value || null)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            >
              {areaKeys.map((areaKey) => (
                <option key={areaKey} value={areaKey}>
                  {t(`areas.${areaKey}`)}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setIsChartModalOpen(false)}
            className="font-bold text-red-600 hover:text-red-800"
          >
            {t("temperatureMonitor.close")} ✖
          </button>
        </div>

        <div className="mb-6 flex space-x-4">
          <button
            type="button"
            onClick={() => setActiveTab("temperature")}
            className={`px-5 py-2 rounded-md font-bold border ${
              activeTab === "temperature"
                ? "bg-indigo-600 text-white shadow"
                : "border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-300"
            }`}
          >
            {t("temperatureMonitor.temperatureLabel", {
              defaultValue: "Nhiệt độ",
            })}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("humidity")}
            className={`px-5 py-2 rounded-md font-bold border ${
              activeTab === "humidity"
                ? "bg-indigo-600 text-white shadow"
                : "border-slate-300 text-slate-700 dark:border-slate-600 dark:text-slate-300"
            }`}
          >
            {t("temperatureMonitor.humidityLabel", { defaultValue: "Độ ẩm" })}
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
