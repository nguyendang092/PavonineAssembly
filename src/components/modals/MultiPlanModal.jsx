import React, { useState } from "react";
import Modal from "react-modal";
import { ref, set } from "firebase/database";
import { db } from '../../services/firebase';
import { format, startOfWeek, addDays } from "date-fns";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { useTranslation } from "react-i18next";

const timeLabels = [
  "08:00 - 10:00",
  "10:10 - 11:30",
  "12:30 - 15:00",
  "15:10 - 17:00",
  "17:30 - 20:00",
];

const MultiPlanModal = ({ isOpen, onClose, areaKey, modelList }) => {
  const [selectedDates, setSelectedDates] = useState([]);
  const [planData, setPlanData] = useState({});
  const { t } = useTranslation();
  // ✅ HÀM CHỌN 7 NGÀY TRONG TUẦN
  const selectCurrentWeek = () => {
    const today = new Date();
    const start = startOfWeek(today, { weekStartsOn: 1 }); // Thứ Hai
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    setSelectedDates(days);
  };

  const [isSaving, setIsSaving] = useState(false);
  const handleApply = async () => {
    if (!selectedDates.length) {
      alert(t("multiPlanModal.noDate"));
      return;
    }
    if (!modelList.length) {
      alert(t("multiPlanModal.noModel"));
      return;
    }
    setIsSaving(true);
    try {
      for (const date of selectedDates) {
        const dateKey = format(date, "yyyy-MM-dd");
        for (const model of modelList) {
          const modelPlan = planData[model] || {};
          let total = 0;
          const updates = {};
          for (const slot of timeLabels) {
            const value = Number(modelPlan[slot] || 0);
            updates[`production/${areaKey}/${dateKey}/${model}/${slot}`] =
              value;
            total += value;
          }
          updates[`production/${areaKey}/${dateKey}/${model}/total`] = total;
          // Ghi 1 lần cho model này
          for (const path in updates) {
            await set(ref(db, path), updates[path]);
          }
        }
      }
      alert(t("multiPlanModal.success"));
      onClose();
    } catch (err) {
      alert(t("multiPlanModal.error"));
    }
    setIsSaving(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="mx-auto max-h-[100vh] max-w-7xl overflow-auto rounded bg-white p-6 shadow dark:bg-slate-900 dark:text-slate-100"
      overlayClassName="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-50"
    >
      <h2 className="mb-4 text-lg font-bold uppercase text-slate-900 dark:text-slate-100">
        {t("multiPlanModal.title")}
      </h2>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="md:w-1/3">
          <button
            onClick={selectCurrentWeek}
            className="mb-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            {t("multiPlanModal.thisWeek")}
          </button>
          <DayPicker
            mode="multiple"
            selected={selectedDates}
            onSelect={setSelectedDates}
            showOutsideDays
            fixedWeeks
            captionLayout="dropdown"
            fromYear={2023}
            toYear={2026}
            modifiersClassNames={{
              selected: "bg-green-600 text-white font-bold rounded",
              today: "text-blue-600 font-semibold underline",
            }}
            className="bg-white border rounded shadow-sm p-4 text-sm"
          />
        </div>

        {/* Nhập sản lượng theo chiều ngang */}
        <div className="flex-1 overflow-x-auto">
          <table className="min-w-full border border-gray-300 text-sm text-gray-700 dark:border-slate-600 dark:text-slate-200">
            <thead className="bg-gray-100 text-[14px] uppercase text-gray-800 dark:bg-slate-800 dark:text-slate-200">
              <tr>
                <th className="border px-3 py-2 text-left">
                  {t("multiPlanModal.model")}
                </th>
                {timeLabels.map((slot) => (
                  <th
                    key={slot}
                    className="border px-3 py-2 text-center font-semibold text-xs"
                  >
                    {slot}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modelList.map((model) => (
                <tr
                  key={model}
                  className="transition duration-200 even:bg-white odd:bg-gray-50 hover:bg-yellow-50 dark:even:bg-slate-900 dark:odd:bg-slate-800/80 dark:hover:bg-yellow-900/30"
                >
                  <td className="border px-3 py-2 font-medium text-gray-900 dark:border-slate-600 dark:text-slate-100">
                    {model}
                  </td>
                  {timeLabels.map((slot) => (
                    <td key={slot} className="border px-2 py-1 text-center">
                      <input
                        type="number"
                        title={t("multiPlanModal.enterPlan")}
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-green-400 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                        value={planData[model]?.[slot] || ""}
                        onChange={(e) => {
                          const updated = { ...(planData[model] || {}) };
                          updated[slot] = e.target.value;
                          setPlanData((prev) => ({
                            ...prev,
                            [model]: updated,
                          }));
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <button
          onClick={onClose}
          className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold px-5 py-1.5 rounded transition"
          disabled={isSaving}
        >
          {t("multiPlanModal.cancel")}
        </button>
        <button
          onClick={handleApply}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-1.5 rounded transition"
          disabled={isSaving}
        >
          {isSaving ? t("multiPlanModal.saving") : t("multiPlanModal.apply")}
        </button>
      </div>
    </Modal>
  );
};

export default MultiPlanModal;
