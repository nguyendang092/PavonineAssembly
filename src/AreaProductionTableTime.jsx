import React, { useEffect, useState, useRef } from "react";
import { db } from "./firebase";
import { ref, onValue, set } from "firebase/database";
import { get, ref as dbRef } from "firebase/database";
import { format, getWeek, getYear, startOfWeek, addDays } from "date-fns";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import Modal from "react-modal";
import ChartModal from "./ChartModal";
import AttendanceModal from "./AttendanceModal";
import AddEmployeeModal from "./AddEmployeeModal";
import { getAreaKey } from "./utils";
import { useTranslation } from "react-i18next";
import MultiPlanModal from "./MultiPlanModal";
import { useUser } from "./UserContext";
Modal.setAppElement("#root");

const timeLabels = [
  "08:00 - 10:00",
  "10:10 - 11:30",
  "12:30 - 15:00",
  "15:10 - 17:00",
  "17:30 - 20:00",
];

const AreaProductionTableTime = ({ area }) => {
  const { user } = useUser();
  const [multiPlanModalOpen, setMultiPlanModalOpen] = useState(false);
  const { t } = useTranslation();
  const areaKey = getAreaKey(area);
  const [draftModelList, setDraftModelList] = useState([]);
  const [addEmployeeModalOpen, setAddEmployeeModalOpen] = useState(false);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [actualData, setActualData] = useState({});
  const [attendanceData, setAttendanceData] = useState({});
  const [productionData, setProductionData] = useState({});
  const [loading, setLoading] = useState(false);
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [modelList, setModelList] = useState([]);
  // Chunk load model (pagination)
  const PAGE_SIZE = 5;
  const [modelPage, setModelPage] = useState(1);
  const totalModelPages = Math.max(1, Math.ceil(modelList.length / PAGE_SIZE));
  const pagedModelList = modelList.slice(
    (modelPage - 1) * PAGE_SIZE,
    modelPage * PAGE_SIZE
  );
  const weekNumber = getWeek(selectedDate, { weekStartsOn: 1 });
  const year = getYear(selectedDate);
  const weekKey = `week_${year}_${weekNumber}`;
  const dateKey = format(selectedDate, "yyyy-MM-dd");
  const [modelEditOpen, setModelEditOpen] = useState(false);
  const [newModelName, setNewModelName] = useState("");
  const startDateOfWeek = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const timeSlots = Array.from({ length: 6 }, (_, i) => {
    const date = addDays(startDateOfWeek, i);
    return {
      label: format(date, "EEEE"),
      date: format(date, "yyyy-MM-dd"),
      display: format(date, "MM/dd (EEEE)"),
      fullDate: date,
    };
  });
  useEffect(() => {
    if (modelEditOpen) {
      setDraftModelList(modelList);
    }
  }, [modelEditOpen, modelList]);
  // Đã có useEffect realtime bên dưới, không cần fetchData nữa

  useEffect(() => {
    // Chunk load: chỉ lắng nghe dữ liệu cho các model đang hiển thị (pagedModelList)
    if (!modelList || modelList.length === 0) {
      setActualData({});
      setProductionData({});
      setAttendanceData({});
      return;
    }
    setLoading(true);
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    let ignore = false;
    // Lắng nghe từng model riêng biệt
    const actualUnsubs = [];
    const productionUnsubs = [];
    const newActualData = {};
    const newProductionData = {};
    pagedModelList.forEach((model) => {
      const actualRef = ref(db, `actual/${areaKey}/${dateKey}/${model}`);
      const unsubA = onValue(actualRef, (snapshot) => {
        if (!ignore) newActualData[model] = snapshot.val() || {};
        if (!ignore)
          setActualData((prev) => ({ ...prev, [model]: snapshot.val() || {} }));
      });
      actualUnsubs.push(unsubA);
      const productionRef = ref(
        db,
        `production/${areaKey}/${dateKey}/${model}`
      );
      const unsubP = onValue(productionRef, (snapshot) => {
        if (!ignore) newProductionData[model] = snapshot.val() || {};
        if (!ignore)
          setProductionData((prev) => ({
            ...prev,
            [model]: snapshot.val() || {},
          }));
      });
      productionUnsubs.push(unsubP);
    });
    // Attendance vẫn lắng nghe toàn bộ ngày (vì không phân trang theo model)
    const attendanceRef = ref(db, `attendance/${areaKey}/${dateKey}`);
    const unsubAttendance = onValue(attendanceRef, (snapshot) => {
      if (!ignore) setAttendanceData(snapshot.val() || {});
      if (!ignore) setLoading(false);
    });
    return () => {
      ignore = true;
      actualUnsubs.forEach((fn) => fn());
      productionUnsubs.forEach((fn) => fn());
      unsubAttendance();
    };
  }, [
    areaKey,
    selectedDate,
    pagedModelList.length,
    modelList.length,
    modelPage,
  ]);

  // Reset về trang 1 khi đổi area hoặc modelList
  useEffect(() => {
    setModelPage(1);
  }, [areaKey, modelList.length]);

  useEffect(() => {
    const fetchModelList = async () => {
      try {
        const snap = await get(dbRef(db, `assignments/${areaKey}`));
        if (snap.exists()) {
          const data = snap.val();
          setModelList(data.modelList || []);
        } else {
          console.warn("Không tìm thấy modelList cho", areaKey);
          setModelList([]);
        }
      } catch (error) {
        console.error("Lỗi khi lấy modelList:", error);
        setModelList([]);
      }
    };

    fetchModelList();
  }, [areaKey]);

  const handleDateChange = (e) => {
    const newDate = new Date(e.target.value);
    if (!isNaN(newDate)) {
      setSelectedDate(newDate);
    }
  };

  const changeWeek = (direction) => {
    setSelectedDate((prev) => {
      const currentStart = startOfWeek(prev, { weekStartsOn: 1 });
      return direction === "prev"
        ? addDays(currentStart, -7)
        : addDays(currentStart, 7);
    });
  };

  // Debounce ghi Firebase
  const debounceTimers = useRef({});
  const validateNumber = (val) => {
    if (val === "") return true;
    if (!/^[0-9]+$/.test(val)) return false;
    if (val.length > 5) return false;
    return true;
  };

  const handleDataChange = (type, model, slot, e) => {
    const val = e.target.value;
    if (!validateNumber(val)) return;
    const numVal = val === "" ? 0 : Number(val);

    if (type === "actual") {
      setActualData((prev) => {
        const newData = { ...prev };
        if (!newData[model]) newData[model] = {};
        newData[model][slot] = numVal;
        // Tính tổng actual
        const total = Object.entries(newData[model])
          .filter(([key]) => key !== "total")
          .reduce((sum, [, value]) => sum + Number(value || 0), 0);
        newData[model]["total"] = total;
        // Debounce ghi Firebase
        const basePath = `actual/${areaKey}/${dateKey}/${model}`;
        if (debounceTimers.current[`${type}_${model}_${slot}`])
          clearTimeout(debounceTimers.current[`${type}_${model}_${slot}`]);
        debounceTimers.current[`${type}_${model}_${slot}`] = setTimeout(() => {
          set(ref(db, `${basePath}/${slot}`), numVal);
          set(ref(db, `${basePath}/total`), total);
        }, 400);
        return newData;
      });
    } else {
      setProductionData((prev) => {
        const newData = { ...prev };
        if (!newData[model]) newData[model] = {};
        newData[model][slot] = numVal;
        // Tính tổng production
        const total = Object.entries(newData[model])
          .filter(([key]) => key !== "total")
          .reduce((sum, [, value]) => sum + Number(value || 0), 0);
        newData[model]["total"] = total;
        // Debounce ghi Firebase
        const basePath = `production/${areaKey}/${dateKey}/${model}`;
        if (debounceTimers.current[`${type}_${model}_${slot}`])
          clearTimeout(debounceTimers.current[`${type}_${model}_${slot}`]);
        debounceTimers.current[`${type}_${model}_${slot}`] = setTimeout(() => {
          set(ref(db, `${basePath}/${slot}`), numVal);
          set(ref(db, `${basePath}/total`), total);
        }, 400);
        return newData;
      });
    }
  };

  useEffect(() => {
    const fetchModelList = async () => {
      try {
        const snap = await get(dbRef(db, `assignments/${areaKey}`));
        if (snap.exists()) {
          const data = snap.val();
          setModelList(data.modelList || []);
        } else {
          console.warn("Không tìm thấy modelList cho", areaKey);
          setModelList([]);
        }
      } catch (error) {
        console.error("Lỗi khi lấy modelList:", error);
        setModelList([]);
      }
    };

    fetchModelList();
  }, [areaKey]);

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [
      [
        t("areaProduction.model"),
        "Slot",
        t("areaProduction.plan"),
        t("areaProduction.actual"),
        t("areaProduction.completeRate"),
      ],
    ];
    modelList.forEach((model) => {
      timeLabels.forEach((slot) => {
        const plan = Number(productionData[model]?.[slot] ?? 0);
        const actual = Number(actualData[model]?.[slot] ?? 0);
        const ratio =
          plan > 0 ? ((actual / plan) * 100).toFixed(1) + "%" : "0.0%";
        wsData.push([model, slot, plan, actual, ratio]);
      });
    });
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Theo Giờ");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([wbout], { type: "application/octet-stream" }),
      `SanLuongGio_${areaKey}_${dateKey}.xlsx`
    );
  };

  const chartData = {};
  modelList.forEach((model) => {
    chartData[model] = timeLabels.map((slot) => {
      const plan = Number(productionData[model]?.[slot] ?? 0);
      const actual = Number(actualData[model]?.[slot] ?? 0);
      const ratio = plan > 0 ? Number(((actual / plan) * 100).toFixed(1)) : 0;
      return {
        label: slot,
        plan,
        actual,
        ratio,
      };
    });
  });
  return (
    <div className="mb-1">
      <div className="flex flex-wrap items-center justify-between mb-3 gap-2  ">
        <div>
          {user && (
            <button
              onClick={() => setModelEditOpen(true)}
              className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 mr-2"
            >
              {t("areaProduction.manageLine")}
            </button>
          )}
          <button
            onClick={() => changeWeek("prev")}
            className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
          >
            {t("areaProduction.prevWeek")}
          </button>
          <button
            onClick={() => changeWeek("next")}
            className="ml-2 px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
          >
            {t("areaProduction.nextWeek")}
          </button>
          {user && (
            <button
              onClick={() => setMultiPlanModalOpen(true)}
              className="px-3 py-1 ml-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              {t("areaProduction.chosemanyDay")}
            </button>
          )}
        </div>
        <div className="space-x-2">
          <button
            onClick={() => setAttendanceModalOpen(true)}
            className="px-4 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            {t("areaProduction.employees")}
          </button>
          {user && (
            <button
              onClick={() => setAddEmployeeModalOpen(true)}
              className="px-4 py-1 bg-orange-500 text-white rounded hover:bg-orange-600"
            >
              {t("areaProduction.addAssignment")}
            </button>
          )}
          <button
            onClick={() => setModalIsOpen(true)}
            className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {t("areaProduction.chart")}
          </button>
          <button
            onClick={exportToExcel}
            className="px-4 py-1 bg-green-500 text-white rounded hover:bg-green-600"
          >
            {t("areaProduction.exportExcel")}
          </button>
        </div>
      </div>
      <div className="text-sm text-gray-600 italic font-semibold mb-2">
        {t("areaProduction.week")} {weekNumber} (
        {format(startDateOfWeek, "dd/MM/yyyy")} -{" "}
        {format(addDays(startDateOfWeek, 6), "dd/MM/yyyy")})
      </div>

      <div className="flex items-center justify-between mb-4">
        <label className="font-semibold text-gray-800">
          {t("areaProduction.selectDate")} :{" "}
          <input
            type="date"
            value={format(selectedDate, "yyyy-MM-dd")}
            onChange={handleDateChange}
            className="border border-gray-300 rounded px-2 py-1 ml-2"
          />
        </label>
        <span className="text-sm text-gray-600 italic">
          {t("areaProduction.week")} : {weekNumber} ({weekKey})
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm text-gray-700 min-w-[900px]">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-gray-300 px-3 py-2 text-left">
                {t("areaProduction.model")}
              </th>
              <th className="border border-gray-300 px-3 py-2 text-left">
                {t("areaProduction.type")}
              </th>
              {timeLabels.map((slot) => (
                <th
                  key={slot}
                  className="border border-gray-300 px-2 py-2 text-center"
                >
                  {slot}
                </th>
              ))}
              <th className="border border-gray-300 px-2 py-2 text-center">
                {t("areaProduction.total")}
              </th>
            </tr>
          </thead>
          <tbody>
            {pagedModelList.map((model) => {
              const totalPlan = Number(productionData[model]?.total ?? 0);
              const totalActual = Number(actualData[model]?.total ?? 0);
              const averageRatio =
                totalPlan > 0
                  ? ((totalActual / totalPlan) * 100).toFixed(1)
                  : "0.0";

              return (
                <React.Fragment key={model}>
                  {/* 🔷 KẾ HOẠCH */}
                  <tr className="bg-blue-100 hover:bg-blue-200 transition">
                    <td
                      rowSpan={3}
                      className="border border-gray-300 px-4 py-3 font-bold text-blue-900 text-left align-middle"
                    >
                      {model}
                    </td>
                    <td className="border border-gray-300 px-3 py-2 font-semibold text-blue-800 text-left">
                      {t("areaProduction.plan")}
                    </td>
                    {timeLabels.map((slot) => (
                      <td
                        key={slot}
                        className="border border-gray-300 px-2 py-1 text-center"
                      >
                        <input
                          type="text"
                          value={productionData[model]?.[slot] ?? ""}
                          onChange={(e) =>
                            handleDataChange("production", model, slot, e)
                          }
                          className="w-full text-center border border-blue-400 rounded-md px-1 py-0.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                          disabled={!user}
                        />
                      </td>
                    ))}
                    <td className="border border-gray-300 px-3 py-2 text-center font-bold text-blue-900 bg-blue-200">
                      {totalPlan}
                    </td>
                  </tr>

                  {/* 🟢 THỰC TẾ */}
                  <tr className="bg-green-100 hover:bg-green-200 transition">
                    <td className="border border-gray-300 px-3 py-2 font-semibold text-green-800 text-left">
                      {t("areaProduction.actual")}
                    </td>
                    {timeLabels.map((slot) => (
                      <td
                        key={slot}
                        className="border border-gray-300 px-2 py-1 text-center"
                      >
                        <input
                          type="text"
                          value={actualData[model]?.[slot] ?? ""}
                          onChange={(e) =>
                            handleDataChange("actual", model, slot, e)
                          }
                          className="w-full text-center border border-green-400 rounded-md px-1 py-0.5 bg-white focus:outline-none focus:ring-2 focus:ring-green-300"
                          disabled={!user}
                        />
                      </td>
                    ))}
                    <td className="border border-gray-300 px-3 py-2 text-center font-bold text-green-900 bg-green-200">
                      {totalActual}
                    </td>
                  </tr>

                  {/* 🟡 % HOÀN THÀNH */}
                  <tr className="bg-yellow-100 hover:bg-yellow-200 transition">
                    <td className="border border-gray-300 px-3 py-2 font-semibold text-yellow-800 text-left">
                      {t("areaProduction.completeRate")}
                    </td>
                    {timeLabels.map((slot) => {
                      const plan = Number(productionData[model]?.[slot] ?? 0);
                      const actual = Number(actualData[model]?.[slot] ?? 0);
                      const ratio =
                        plan > 0 ? ((actual / plan) * 100).toFixed(1) : "0.0";
                      return (
                        <td
                          key={slot}
                          className="border border-gray-300 px-2 py-1 text-center font-bold text-yellow-900"
                        >
                          {ratio}%
                        </td>
                      );
                    })}
                    <td className="border border-gray-300 px-3 py-2 text-center font-bold text-yellow-900 bg-yellow-200">
                      {averageRatio}%
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Pagination for models */}
      {modelList.length > PAGE_SIZE && (
        <div className="flex justify-center items-center mt-2 space-x-2">
          <button
            onClick={() => setModelPage((p) => Math.max(1, p - 1))}
            disabled={modelPage === 1}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            {t("areaProduction.prevPage")}
          </button>
          <span>
            {t("areaProduction.page", {
              current: modelPage,
              total: totalModelPages,
            })}
          </span>
          <button
            onClick={() =>
              setModelPage((p) => Math.min(totalModelPages, p + 1))
            }
            disabled={modelPage === totalModelPages}
            className="px-2 py-1 border rounded disabled:opacity-50"
          >
            {t("areaProduction.nextPage")}
          </button>
        </div>
      )}
      {loading && (
        <div className="text-center text-gray-500 py-4 text-lg">
          {t("areaProduction.loading")}
        </div>
      )}
      <Modal
        isOpen={modelEditOpen}
        onRequestClose={() => setModelEditOpen(false)}
        className="bg-white p-6 max-w-md mx-auto rounded shadow"
        overlayClassName="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-50"
      >
        <h2 className="text-lg font-bold mb-4">
          {t("areaProduction.manageLine")}
        </h2>
        {user ? (
          <>
            <ul className="space-y-2 max-h-60 overflow-y-auto">
              {draftModelList.map((model, index) => (
                <li key={index} className="flex gap-2">
                  <input
                    value={model}
                    onChange={(e) => {
                      const updated = [...draftModelList];
                      updated[index] = e.target.value;
                      setDraftModelList(updated);
                    }}
                    className="border px-2 py-1 rounded flex-1"
                  />
                  <button
                    onClick={() => {
                      if (
                        window.confirm(t("areaProduction.confirmDeleteModel"))
                      ) {
                        setDraftModelList(
                          draftModelList.filter((_, i) => i !== index)
                        );
                      }
                    }}
                  >
                    ❌
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex mt-4 gap-2">
              <input
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                placeholder={t("areaProduction.addNewLine")}
                className="border px-2 py-1 rounded flex-1"
              />
              <button
                onClick={() => {
                  const trimmed = newModelName.trim();
                  if (trimmed) {
                    setDraftModelList([...draftModelList, trimmed]);
                    setNewModelName("");
                  }
                }}
                className="bg-green-600 text-white px-4 py-1 rounded"
              >
                ➕
              </button>
            </div>
            <div className="flex justify-end mt-4 gap-2">
              <button
                onClick={() => setModelEditOpen(false)}
                className="bg-gray-300 px-4 py-1 rounded"
              >
                {t("areaProduction.close")}
              </button>
              <button
                onClick={() => {
                  set(
                    ref(db, `assignments/${areaKey}/modelList`),
                    draftModelList
                  )
                    .then(() => {
                      showToast(t("areaProduction.updated"));
                      setModelList(draftModelList);
                      setModelEditOpen(false);
                    })
                    .catch(() => {
                      showToast(t("areaProduction.errorSaving"));
                    });
                }}
                className="bg-blue-600 text-white px-4 py-1 rounded"
              >
                {t("areaProduction.save")}
              </button>
            </div>
          </>
        ) : (
          <div className="text-center text-gray-500 py-8 text-lg">
            {t("areaProduction.loginToEdit")}
          </div>
        )}
      </Modal>

      {/* Biểu đồ */}
      <ChartModal
        isOpen={modalIsOpen}
        onClose={() => setModalIsOpen(false)}
        weekNumber={weekNumber}
        chartData={chartData}
        modelList={modelList}
        area={area}
        selectedDate={format(selectedDate, "yyyy-MM-dd")}
      />

      {/* Modal nhân viên */}
      <AttendanceModal
        isOpen={attendanceModalOpen}
        onClose={() => setAttendanceModalOpen(false)}
        selectedDate={format(selectedDate, "yyyy-MM-dd")}
        attendanceData={attendanceData}
        timeSlots={timeSlots}
        areaKey={areaKey}
        modelList={modelList}
        dateKey={dateKey}
      />

      <AddEmployeeModal
        isOpen={addEmployeeModalOpen}
        onClose={() => setAddEmployeeModalOpen(false)}
        areaKey={areaKey}
        dateKey={dateKey}
        modelList={modelList}
        selectedDate={format(selectedDate, "yyyy-MM-dd")}
      />
      <MultiPlanModal
        isOpen={multiPlanModalOpen}
        onClose={() => setMultiPlanModalOpen(false)}
        areaKey={areaKey}
        modelList={modelList}
      />
    </div>
  );
};

export default AreaProductionTableTime;
