import React, { useEffect, useState } from "react";
import { db } from "../../services/firebase";
import { ref, onValue, set } from "firebase/database";
import { get, ref as dbRef } from "firebase/database";
import { format, getWeek, startOfWeek, addDays, getYear } from "date-fns";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import Modal from "react-modal";
import ChartModal from "../modals/ChartModal";
import AttendanceModal from "../modals/AttendanceModal";
import AddEmployeeModal from "../modals/AddEmployeeModal";
import { getAreaKey } from "../../utils/utils";
import { useTranslation } from "react-i18next";

Modal.setAppElement("#root");

const AreaProductionTable = ({ area, showToast }) => {
  const { t } = useTranslation();
  const areaKey = getAreaKey(area);
  const [draftModelList, setDraftModelList] = useState([]);
  const [addEmployeeModalOpen, setAddEmployeeModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [actualData, setActualData] = useState({});
  const [productionData, setProductionData] = useState({});
  const [attendanceData, setAttendanceData] = useState({});
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [modelList, setModelList] = useState([]);
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
    if (modelEditOpen) setDraftModelList(modelList);
  }, [modelEditOpen]);

  // Load dữ liệu actual, production, attendance chỉ theo tuần
  useEffect(() => {
    // Lấy danh sách ngày trong tuần hiện tại
    const weekDates = timeSlots.map((slot) => slot.date);

    // Actual
    const actualRef = ref(db, `actual/${areaKey}`);
    const unsubActual = onValue(actualRef, (snapshot) => {
      const val = snapshot.val() || {};
      const reorganized = {};
      Object.entries(val).forEach(([date, modelData]) => {
        if (!weekDates.includes(date)) return;
        Object.entries(modelData).forEach(([model, slotData]) => {
          if (!reorganized[model]) reorganized[model] = {};
          reorganized[model][date] = slotData;
        });
      });
      setActualData(reorganized);
    });

    // Production
    const productionRef = ref(db, `production/${areaKey}`);
    const unsubProduction = onValue(productionRef, (snapshot) => {
      const val = snapshot.val() || {};
      const reorganized = {};
      Object.entries(val).forEach(([date, modelData]) => {
        if (!weekDates.includes(date)) return;
        Object.entries(modelData).forEach(([model, slotData]) => {
          if (!reorganized[model]) reorganized[model] = {};
          reorganized[model][date] = slotData;
        });
      });
      setProductionData(reorganized);
    });

    // Attendance: lấy cả tuần, gộp lại thành object {date: data}
    const attendanceRefs = weekDates.map((date) =>
      ref(db, `attendance/${areaKey}/${date}`)
    );
    let isMounted = true;
    const attendanceDataObj = {};
    const unsubList = attendanceRefs.map((attendanceRef, idx) =>
      onValue(attendanceRef, (snapshot) => {
        attendanceDataObj[weekDates[idx]] = snapshot.val() || {};
        // Khi đã nhận đủ dữ liệu các ngày thì setAttendanceData
        if (isMounted) setAttendanceData({ ...attendanceDataObj });
      })
    );

    return () => {
      unsubActual();
      unsubProduction();
      isMounted = false;
      unsubList.forEach((unsub) => unsub());
    };
  }, [areaKey, startDateOfWeek]);

  // Load modelList
  useEffect(() => {
    const fetchModelList = async () => {
      try {
        const snap = await get(dbRef(db, `assignments/${areaKey}`));
        if (snap.exists()) {
          const data = snap.val();
          setModelList(data.modelList || []);
        } else {
          setModelList([]);
        }
      } catch (error) {
        console.error("Lỗi khi lấy modelList:", error);
        setModelList([]);
      }
    };
    fetchModelList();
  }, [areaKey]);

  const handleDateChange = (e) => setSelectedDate(new Date(e.target.value));

  const changeWeek = (direction) => {
    setSelectedDate((prev) => {
      const currentStart = startOfWeek(prev, { weekStartsOn: 1 });
      return direction === "prev"
        ? addDays(currentStart, -7)
        : addDays(currentStart, 7);
    });
  };

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
      timeSlots.forEach((slotObj) => {
        const plan =
          productionData[model]?.[slotObj.date]?.[slotObj.label] || 0;
        const actual = actualData[model]?.[slotObj.date]?.[slotObj.label] || 0;
        const ratio =
          plan > 0 ? ((actual / plan) * 100).toFixed(1) + "%" : "0.0%";
        wsData.push([model, slotObj.display, plan, actual, ratio]);
      });
    });
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Sản lượng");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([wbout], { type: "application/octet-stream" }),
      `SanLuong_${areaKey}_${weekKey}.xlsx`
    );
  };

  const chartData = {};
  const totalData = {};

  modelList.forEach((model) => {
    chartData[model] = timeSlots.map((slot) => {
      const planData = productionData[model]?.[slot.date] || {};
      const actualDataDay = actualData[model]?.[slot.date] || {};

      const planTotal = planData.total || 0;
      const actualTotal = actualDataDay.total || 0;
      const ratio =
        planTotal > 0
          ? Number(((actualTotal / planTotal) * 100).toFixed(1))
          : 0;

      return {
        label: slot.display,
        plan: planTotal,
        actual: actualTotal,
        ratio: ratio,
      };
    });

    totalData[model] = timeSlots.map((slot) => {
      const planData = productionData[model]?.[slot.date] || {};
      const actualDataDay = actualData[model]?.[slot.date] || {};
      const totalPlan = typeof planData.total === "number" ? planData.total : 0;
      const totalActual =
        typeof actualDataDay.total === "number" ? actualDataDay.total : 0;
      return {
        label: slot.display,
        totalPlan,
        totalActual,
      };
    });
  });

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center justify-between mb-3 gap-2">
        <div>
          <button
            onClick={() => setModelEditOpen(true)}
            className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 mr-2"
          >
            {t("areaProduction.manageLine")}
          </button>
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
        </div>
        <div className="space-x-2">
          <button
            onClick={() => setAttendanceModalOpen(true)}
            className="px-4 py-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded hover:from-blue-700 hover:to-purple-700"
          >
            {t("areaProduction.employees")}
          </button>
          <button
            onClick={() => setAddEmployeeModalOpen(true)}
            className="px-4 py-1 bg-orange-500 text-white rounded hover:bg-orange-600"
          >
            {t("areaProduction.addAssignment")}
          </button>
          <button
            onClick={() => setModalIsOpen(true)}
            className="px-4 py-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded hover:from-blue-700 hover:to-purple-700"
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
          {t("areaProduction.week")} {weekNumber} - {weekNumber}주차
        </span>
      </div>

      <table className="w-full border-collapse text-sm text-gray-700">
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-gray-300 px-3 py-2 text-left">
              {t("areaProduction.model")}
            </th>
            <th className="border border-gray-300 px-3 py-2 text-left">
              {t("areaProduction.type")}
            </th>
            {timeSlots.map((slotObj) => (
              <th
                key={slotObj.date}
                className="border border-gray-300 px-2 py-2 text-center"
              >
                {slotObj.display}
              </th>
            ))}
            <th className="border border-gray-300 px-2 py-2 text-center">
              {t("areaProduction.total")}
            </th>
          </tr>
        </thead>
        <tbody>
          {modelList.map((model) => {
            // Tính tổng cả tuần từ các total trong từng ngày
            const totalPlan = timeSlots.reduce(
              (sum, slot) =>
                sum + Number(productionData[model]?.[slot.date]?.total || 0),
              0
            );
            const totalActual = timeSlots.reduce(
              (sum, slot) =>
                sum + Number(actualData[model]?.[slot.date]?.total || 0),
              0
            );
            const averageRatio =
              totalPlan > 0
                ? ((totalActual / totalPlan) * 100).toFixed(1)
                : "0.0";

            return (
              <React.Fragment key={model}>
                {/* Kế hoạch */}
                <tr className="bg-blue-100 hover:bg-blue-200 transition">
                  <td
                    rowSpan={3}
                    className="border border-gray-300 px-4 py-3 font-bold text-blue-800 text-left align-middle"
                  >
                    {model}
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-left font-semibold text-blue-700">
                    {t("areaProduction.plan")}
                  </td>
                  {timeSlots.map((slot) => (
                    <td
                      key={slot.date}
                      className="border border-gray-300 px-3 py-2 text-center text-blue-800 font-medium"
                    >
                      {productionData[model]?.[slot.date]?.total ?? ""}
                    </td>
                  ))}
                  <td className="border border-gray-300 px-3 py-2 text-center font-bold text-blue-900 bg-blue-200">
                    {totalPlan}
                  </td>
                </tr>

                {/* Thực tế */}
                <tr className="bg-green-100 hover:bg-green-200 transition">
                  <td className="border border-gray-300 px-3 py-2 text-left font-semibold text-green-700">
                    {t("areaProduction.actual")}
                  </td>
                  {timeSlots.map((slot) => (
                    <td
                      key={slot.date}
                      className="border border-gray-300 px-3 py-2 text-center text-green-800 font-medium"
                    >
                      {actualData[model]?.[slot.date]?.total ?? ""}
                    </td>
                  ))}
                  <td className="border border-gray-300 px-3 py-2 text-center font-bold text-green-900 bg-green-200">
                    {totalActual}
                  </td>
                </tr>

                {/* % Hoàn thành */}
                <tr className="bg-yellow-100 hover:bg-yellow-200 transition">
                  <td className="border border-gray-300 px-3 py-2 text-left font-semibold text-yellow-700">
                    {t("areaProduction.completeRate")}
                  </td>
                  {timeSlots.map((slotObj) => {
                    const plan = Number(
                      productionData[model]?.[slotObj.date]?.total || 0
                    );
                    const actual = Number(
                      actualData[model]?.[slotObj.date]?.total || 0
                    );
                    const ratio =
                      plan > 0 ? ((actual / plan) * 100).toFixed(1) : "0.0";
                    return (
                      <td
                        key={slotObj.date}
                        className="border border-gray-300 px-3 py-2 text-center font-bold text-yellow-800"
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
      <Modal
        isOpen={modelEditOpen}
        onRequestClose={() => setModelEditOpen(false)}
        className="bg-white p-6 max-w-md mx-auto rounded shadow"
        overlayClassName="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-50"
      >
        <h2 className="text-lg font-bold mb-4">🛠 Quản lý Line</h2>
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
                onClick={() =>
                  setDraftModelList(
                    draftModelList.filter((_, i) => i !== index)
                  )
                }
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
              set(ref(db, `assignments/${areaKey}/modelList`), draftModelList)
                .then(() => {
                  showToast(t("areaProduction.updated"));
                  setModelList(draftModelList);
                  setModelEditOpen(false);
                })
                .catch(() => {
                  showToast(t("areaProduction.errorSaving"));
                });
            }}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-1 rounded"
          >
            {t("areaProduction.save")}
          </button>
        </div>
      </Modal>

      {/* Biểu đồ */}
      <ChartModal
        isOpen={modalIsOpen}
        onClose={() => setModalIsOpen(false)}
        weekNumber={weekNumber}
        chartData={chartData}
        totalData={totalData}
        modelList={modelList}
        area={area}
        selectedDate={format(selectedDate, "yyyy-MM-dd")}
      />

      <AttendanceModal
        isOpen={attendanceModalOpen}
        onClose={() => setAttendanceModalOpen(false)}
        selectedDate={format(selectedDate, "yyyy-MM-dd")}
        attendanceData={attendanceData[dateKey] || {}}
        timeSlots={timeSlots}
        areaKey={areaKey}
        modelList={modelList}
        weekKey={weekKey}
        dateKey={dateKey}
      />
      <AddEmployeeModal
        isOpen={addEmployeeModalOpen}
        onClose={() => setAddEmployeeModalOpen(false)}
        areaKey={areaKey}
        attendanceData={attendanceData[dateKey] || {}}
        timeSlots={timeSlots}
        weekKey={weekKey}
        dateKey={dateKey}
        modelList={modelList}
        selectedDate={format(selectedDate, "yyyy-MM-dd")}
      />
    </div>
  );
};

export default AreaProductionTable;
