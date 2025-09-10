import React, { useState, useEffect, useRef } from "react";
import { useLoading } from "./LoadingContext";
import { logUserAction } from "./userLog";
import Modal from "react-modal";
import { ref, set, get, update } from "firebase/database";
import { db } from "./firebase";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import imageCompression from "browser-image-compression";
import { useTranslation } from "react-i18next";
// import { debounce } from "lodash";

const formatName = (name) => {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const AddEmployeeModal = ({
  isOpen,
  onClose,
  areaKey,
  selectedDate,
  modelList = [],
  setModelList,
}) => {
  const { t } = useTranslation();
  const getToday = () => new Date().toISOString().slice(0, 10);
  const dateKey =
    selectedDate?.replace(/-/g, "") || getToday().replace(/-/g, "");

  const [filterDate, setFilterDate] = useState(selectedDate || "");
  const filterDateKey = filterDate?.replace(/-/g, "") || "";

  const [newEmployee, setNewEmployee] = useState({
    name: "",
    status: "Đi làm",
    joinDate: selectedDate || getToday(),
    model: "",
    imageUrl: "",
    employeeId: "",
  });

  const [timePhanCongFrom, setTimePhanCongFrom] = useState("");
  const [timePhanCongTo, setTimePhanCongTo] = useState("");
  const [selectedKey, setSelectedKey] = useState(null);
  const [existingEmployees, setExistingEmployees] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  // const [inputModel, setInputModel] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [isSaving, setIsSaving] = useState(false); // Local state, can be removed if not used elsewhere
  const { setLoading } = useLoading();

  const attendanceCache = useRef({});

  useEffect(() => {
    setFilterDate(selectedDate || getToday());
    setNewEmployee((prev) => ({
      ...prev,
      joinDate: selectedDate || getToday(),
    }));
  }, [selectedDate]);

  useEffect(() => {
    const cacheKey = `${areaKey}_${filterDateKey}`;
    if (attendanceCache.current[cacheKey]) {
      setExistingEmployees(attendanceCache.current[cacheKey]);
      return;
    }
    const fetchData = async () => {
      const snapshot = await get(ref(db, `attendance/${areaKey}`));
      if (!snapshot.exists()) {
        setExistingEmployees([]);
        return;
      }
      const data = snapshot.val();
      const filtered = Object.entries(data)
        .filter(([_, val]) => val?.schedules?.[filterDateKey])
        .map(([key, val]) => {
          const schedule = val.schedules?.[filterDateKey] || {};
          return {
            key,
            ...val,
            model: schedule.model || "",
            joinDate: schedule.joinDate || filterDate,
            timePhanCong: schedule.timePhanCong || "",
            employeeId: key,
          };
        });
      attendanceCache.current[cacheKey] = filtered;
      setExistingEmployees(filtered);
    };
    fetchData();
  }, [areaKey, filterDateKey]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewEmployee((prev) => {
      if (name === "status" && value === "Nghỉ phép") {
        setTimePhanCongFrom("");
        setTimePhanCongTo("");
        return { ...prev, [name]: value, model: "" };
      }
      return { ...prev, [name]: value };
    });
  };

  const cropToSquare = async (file) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(
          img,
          (img.width - size) / 2,
          (img.height - size) / 2,
          size,
          size,
          0,
          0,
          size,
          size
        );
        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name, { type: file.type }));
        }, file.type);
      };
    });
  };

  const uploadImageToStorage = async (file, employeeId) => {
    const squareFile = await cropToSquare(file);
    const compressedFile = await imageCompression(squareFile, {
      maxSizeMB: 0.2,
      maxWidthOrHeight: 512,
      useWebWorker: true,
    });
    const storage = getStorage();
    const storageReference = storageRef(storage, `employees/${employeeId}.jpg`);
    await uploadBytes(storageReference, compressedFile);
    return await getDownloadURL(storageReference);
  };

  const handleAddOrUpdateEmployee = async () => {
    // Lấy thông tin user hiện tại từ localStorage hoặc context nếu có
    const currentUser = JSON.parse(localStorage.getItem("currentUser")) || {};
    const name = newEmployee.name.trim();
    const status = newEmployee.status;
    const joinDate = newEmployee.joinDate || selectedDate;
    const modelValue = newEmployee.model.trim();

    const from = timePhanCongFrom.trim();
    const to = timePhanCongTo.trim();

    if (status === "Nghỉ phép") {
      if (!name || !selectedDate) {
        alert(t("addEmployeeModal.alertLeaveMissing"));
        return;
      }
      if (!from || !to) {
        alert(t("addEmployeeModal.alertMissingLeaveTime"));
        return;
      }
    } else {
      if (!name || !modelValue || !selectedDate) {
        alert(t("addEmployeeModal.alertWorkingMissing"));
        return;
      }
      if (!from || !to) {
        alert(t("addEmployeeModal.alertMissingTime"));
        return;
      }
    }

    setIsSaving(true);
    setLoading(true);

    try {
      let employeeId = newEmployee.employeeId || `PAVO${Date.now()}`;

      const employeeRef = ref(db, `attendance/${areaKey}/${employeeId}`);
      const snapshot = await get(employeeRef);
      const existingData = snapshot.exists() ? snapshot.val() : {};

      let imageUrl = existingData.imageUrl || "";
      if (imageFile) {
        imageUrl = await uploadImageToStorage(imageFile, employeeId);
      } else if (
        typeof previewImage === "string" &&
        previewImage.startsWith("http")
      ) {
        imageUrl = previewImage;
      }

      // Chuẩn bị dữ liệu ca làm việc mới
      const newShift = {
        joinDate,
        status,
        timePhanCong: `${from} - ${to}`,
        ...(status === "Đi làm"
          ? {
              model: modelValue,
            }
          : {}),
      };

      // Lấy mảng ca làm việc hiện tại (nếu có)
      const prevShifts = Array.isArray(existingData.schedules?.[dateKey])
        ? existingData.schedules[dateKey]
        : existingData.schedules?.[dateKey]
        ? [existingData.schedules[dateKey]]
        : [];
      const newShiftsArr = [...prevShifts, newShift];

      const updatedEmployee = {
        name,
        employeeId,
        imageUrl,
        schedules: {
          ...(existingData.schedules || {}),
          [dateKey]: newShiftsArr,
        },
      };

      const updates = {};
      updates[`attendance/${areaKey}/${employeeId}`] = updatedEmployee;

      // Thêm model mới nếu hợp lệ và chưa có trong modelList
      if (
        status === "Đi làm" &&
        modelValue &&
        !modelList
          .map((m) => m.trim().toLowerCase())
          .includes(modelValue.toLowerCase())
      ) {
        const updatedModels = [...modelList, modelValue].filter(
          (v, i, arr) => v && arr.indexOf(v) === i
        );
        updates[`models/${areaKey}`] = updatedModels;
        setModelList(updatedModels);
      }

      await update(ref(db), updates);

      // Ghi log thêm hoặc cập nhật nhân viên
      const actionType = selectedKey ? "update_employee" : "add_employee";
      await logUserAction(
        currentUser.email || "unknown",
        actionType,
        `${
          actionType === "add_employee" ? "Thêm" : "Cập nhật"
        } nhân viên: ${name} (${employeeId}), ca: ${from} - ${to}, trạng thái: ${status}${
          status === "Đi làm" ? ", model: " + modelValue : ""
        }`
      );

      resetForm();
      onClose();
    } catch (err) {
      console.error("🔥 Lỗi chi tiết:", err);
      alert(t("addEmployeeModal.saveError", { message: err.message || "" }));
    } finally {
      setIsSaving(false);
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedKey(null);
    setNewEmployee({
      name: "",
      status: "Đi làm",
      joinDate: filterDate || getToday(),
      model: "",
      imageUrl: "",
      employeeId: "",
    });
    setPreviewImage(null);
    setImageFile(null);
    setTimePhanCongFrom("");
    setTimePhanCongTo("");
  };

  // Reset form khi modal đóng
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
    // eslint-disable-next-line
  }, [isOpen]);

  const handleSelectEmployee = (emp) => {
    setNewEmployee({
      name: formatName(emp.name || ""),
      status: emp.status || "Đi làm",
      joinDate: filterDate || getToday(),
      model: emp.model || "",
      imageUrl: emp.imageUrl || "",
      employeeId: emp.employeeId || emp.key || "",
    });

    if (emp.timePhanCong?.includes(" - ")) {
      const [from, to] = emp.timePhanCong.split(" - ");
      setTimePhanCongFrom(from);
      setTimePhanCongTo(to);
    } else {
      setTimePhanCongFrom("");
      setTimePhanCongTo("");
    }

    setPreviewImage(emp.imageUrl || "");
    setSelectedKey(emp.key);
  };

  const filteredEmployees = existingEmployees.filter((emp) =>
    formatName(emp.name)
      .toLowerCase()
      .includes(searchKeyword.trim().toLowerCase())
  );

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={() => {
        resetForm();
        onClose();
      }}
      className="bg-white rounded-xl p-8 max-w-4xl mx-auto mt-4 shadow-2xl ring-1 ring-black ring-opacity-5"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
    >
      <h2 className="text-2xl font-extrabold mb-6 text-gray-900">
        {t("addEmployeeModal.title")}
      </h2>

      <div className="mb-3 text-gray-700 text-sm">
        {t("addEmployeeModal.assignDate")}:{" "}
        <strong>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="border px-3 py-1 rounded"
          />
        </strong>
      </div>
      <div className="mb-4 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-3 text-sm bg-gray-50 scrollbar-thin scrollbar-thumb-gray-300">
        <input
          type="text"
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          placeholder={t("addEmployeeModal.searchPlaceholder")}
          className="w-full border border-gray-300 rounded-md px-3 py-2 mb-3 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
        />
        <ul className="space-y-1 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300">
          {filteredEmployees.slice(0, 5).map((emp) => (
            <li
              key={emp.key}
              className="cursor-pointer hover:bg-yellow-200 rounded-md px-3 py-1 select-none"
              onClick={() => handleSelectEmployee(emp)}
            >
              <span className="font-semibold">{formatName(emp.name)}</span> -{" "}
              <span className="italic text-gray-600">{emp.model}</span> -{" "}
              <span className="italic text-gray-600">{emp.joinDate}</span>
            </li>
          ))}
        </ul>
      </div>
      <input
        name="name"
        value={newEmployee.name}
        onChange={handleChange}
        placeholder={t("addEmployeeModal.namePlaceholder")}
        className="w-full border border-gray-300 rounded-md px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
      />
      {/* Thời gian phân công */}
      <div className="flex gap-2 mb-3 items-center">
        <label className="whitespace-nowrap">
          {newEmployee.status === "Nghỉ phép"
            ? t("addEmployeeModal.leaveTime")
            : t("addEmployeeModal.assignTime")}
        </label>
        {["from", "to"].map((type, idx) => {
          const timeValue = type === "from" ? timePhanCongFrom : timePhanCongTo;
          const setTime =
            type === "from" ? setTimePhanCongFrom : setTimePhanCongTo;
          return (
            <React.Fragment key={type}>
              <input
                type="time"
                value={timeValue}
                onChange={(e) => setTime(e.target.value)}
                required={newEmployee.status === "Nghỉ phép"}
                className={`border rounded-md px-3 py-2 transition w-28 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
              />
              {idx === 0 && (
                <span className="mx-1">
                  {t("addEmployeeModal.fromToSeparator")}
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>
      <select
        name="status"
        value={newEmployee.status}
        onChange={handleChange}
        className="w-full border border-gray-300 rounded-md px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
      >
        <option value="Đi làm">{t("addEmployeeModal.statusWorking")}</option>
        <option value="Nghỉ phép">{t("addEmployeeModal.statusLeave")}</option>
      </select>
      <select
        name="model"
        value={newEmployee.model}
        onChange={handleChange}
        disabled={newEmployee.status === "Nghỉ phép"}
        className={`w-full border rounded-md px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition ${
          newEmployee.status === "Nghỉ phép"
            ? "bg-gray-200 cursor-not-allowed"
            : "border-gray-300"
        }`}
      >
        <option value="">{t("addEmployeeModal.selectLinePlaceholder")}</option>
        {modelList.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
      <input
        name="joinDate"
        type="date"
        value={newEmployee.joinDate}
        onChange={handleChange}
        className="w-full border border-gray-300 rounded-md px-4 py-3 mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
      />
      <div className="flex justify-end space-x-3">
        <button
          onClick={() => {
            resetForm();
            onClose();
          }}
          className="px-5 py-2 rounded-md bg-gray-300 hover:bg-gray-400 transition disabled:opacity-50"
          disabled={isSaving}
        >
          {t("addEmployeeModal.cancel")}
        </button>
        <button
          onClick={handleAddOrUpdateEmployee}
          className="px-5 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50"
          disabled={isSaving}
        >
          {isSaving
            ? t("addEmployeeModal.saving")
            : selectedKey
            ? t("addEmployeeModal.update")
            : t("addEmployeeModal.saveNew")}
        </button>
      </div>
    </Modal>
  );
};

export default AddEmployeeModal;
