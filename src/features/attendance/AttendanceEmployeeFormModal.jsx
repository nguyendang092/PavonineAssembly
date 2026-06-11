import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { db, ref, update, get } from "@/services/firebase";
import {
  buildEmployeeAttendanceDayDocument,
  attendanceMnvStorageKey,
  formSliceForAttendanceDayDocument,
  mergeAttendanceDayNodeForPersist,
  resolveAttendanceFormPersistTarget,
} from "@/utils/attendanceEmployeeRecord";
import {
  canEditAttendanceForEmployee,
  canAddAttendanceForDepartment,
  isAdminAccess,
} from "@/config/authRoles";
import {
  ATTENDANCE_LOAI_PHEP_OPTIONS,
  isAttendanceGioVaoClockTime,
  isAttendanceHalfAnnualLeave,
} from "./attendanceGioVaoTypeOptions";
import { ATTENDANCE_CA_LAM_VIEC_OPTIONS } from "./attendanceCaLamViecOptions";
import {
  normalizeDuocNghiBuForForm,
  isDuocNghiBuExplicitlyNo,
  isBoPhanChuaDung,
  normalizeBoPhanChuaDungForForm,
} from "@/features/attendance/attendanceDayMeta";
import { isSeasonalAttendanceRoot } from "./attendanceSeasonalStt";
import { normalizeAttendanceGioiTinhValue } from "./attendanceGender";
import {
  normalizeTimeForHtmlInput,
  canonicalAttendanceLoaiPhep,
  findGioVaoTypeOptionMatch,
} from "./attendanceGioVaoModalHelpers";
import {
  EMPLOYEE_REGIME,
  employeeRegimeFlagsFromSelectValue,
  getEmployeeRegimeSelectValue,
} from "./employeeRegime";

/**
 * Map legacy `includeTsNvInWorkingHours` + chuẩn hóa `loaiPhep` khi mở form từ snapshot.
 */
function applyLegacyIncludeTsNvAndCanonicalPhep(record) {
  let merged = { ...record };
  const legacyIncludeTsNv =
    String(merged.includeTsNvInWorkingHours ?? "")
      .trim()
      .toUpperCase() === "YES";
  if (legacyIncludeTsNv) {
    if (!merged.includeTapVuInWorkingHours) {
      merged.includeTapVuInWorkingHours = "YES";
    }
    if (!merged.includeThaiSanInWorkingHours) {
      merged.includeThaiSanInWorkingHours = "YES";
    }
  }
  let gioVao = String(merged.gioVao ?? "").trim();
  let gioRa = String(merged.gioRa ?? "").trim();
  const loaiPhepCanon = canonicalAttendanceLoaiPhep(merged.loaiPhep);
  const isHalfPn = isAttendanceHalfAnnualLeave(loaiPhepCanon);
  let loaiPhep = loaiPhepCanon;
  if (isAttendanceGioVaoClockTime(gioVao) && !isHalfPn) {
    loaiPhep = "";
  }
  if (loaiPhep && !isHalfPn) {
    gioVao = "";
    gioRa = "";
  }
  return {
    ...merged,
    gioVao,
    gioRa,
    loaiPhep,
  };
}

const EMPTY_EMPLOYEE_FORM = {
  id: "",
  stt: "",
  mnv: "",
  mvt: "",
  hoVaTen: "",
  gioiTinh: "YES",
  ngayVaoLam: "",
  ngayHopDong: "",
  maBoPhan: "",
  boPhan: "",
  gioVao: "",
  loaiPhep: "",
  gioRa: "",
  caLamViec: "",
  duocNghiBu: "",
  /** Firebase: `attendance/{ngày}/{key}/boPhanChuaDung` — `"YES"` = sai bộ phận. */
  boPhanChuaDung: "",
  includeTapVuInWorkingHours: "",
  includeThaiSanInWorkingHours: "",
  includeTaiXeInWorkingHours: "",
  includeTaiXeTongInWorkingHours: "",
};

const employeeModalFieldClass =
  "w-full min-h-[2.5rem] rounded-lg border-2 border-blue-200 bg-white px-2 py-2.5 text-sm font-bold text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:border-blue-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500/40";
const employeeModalSelectFieldClass = `${employeeModalFieldClass} appearance-none`;
const employeeModalLabelClass =
  "mb-1 block text-xs font-bold uppercase tracking-wide text-purple-600 dark:text-purple-400";
const employeeModalClearTimeButtonClass =
  "shrink-0 min-w-[6.5rem] rounded-lg border-2 border-slate-300 bg-slate-100 px-4 py-2 text-[10px] font-bold leading-tight text-slate-700 transition hover:bg-slate-200 disabled:pointer-events-none disabled:opacity-40 sm:text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700";

/**
 * Modal thêm / cập nhật dòng điểm danh — chỉ ghi `attendance/{ngày}/{key}`.
 * Dùng chung Điểm danh NV và màn tính lương — `update()` nên mọi màn `onValue` đồng bộ.
 */
export default function AttendanceEmployeeFormModal({
  open,
  onClose,
  /** `null` = thêm mới; object (có `id`) = sửa */
  initialRecord,
  selectedDate,
  employees,
  user,
  userRole,
  userDepartments,
  onAlert,
  onSaved,
  attendanceRootPath = "attendance",
  /** Ngày đang sửa có cờ nghỉ bù trong OFF/Lễ/Nghỉ bù — mặc định «Có»; không cờ thì khóa «Không». */
  dayIsCompensatory = false,
}) {
  const { t } = useTranslation();
  const tl = useCallback(
    (key, defaultValue, options = {}) =>
      t(`attendanceList.${key}`, { defaultValue, ...options }),
    [t],
  );

  const [form, setForm] = useState(() => ({ ...EMPTY_EMPLOYEE_FORM }));
  /** Khóa `attendance/{date}/{id}` khi sửa — giữ cố định khi form thay đổi */
  const [editAttendanceKey, setEditAttendanceKey] = useState(null);

  /**
   * Chỉ reset form khi mở form / đổi người sửa / đổi ngày — không phụ thuộc `initialRecord`
   * theo tham chiếu (parent re-render) để tránh ghi đè dữ liệu đang chỉnh.
   */
  const formInitKey = useMemo(() => {
    if (!open) return "";
    if (initialRecord?.id) {
      return `edit:${String(initialRecord.id)}:${selectedDate}:c${dayIsCompensatory ? 1 : 0}`;
    }
    const addSeed =
      initialRecord?.mnv ||
      initialRecord?.monthEmployeeKey ||
      initialRecord?.hoVaTen ||
      "";
    return `add:${selectedDate}:${addSeed}:c${dayIsCompensatory ? 1 : 0}`;
  }, [
    open,
    initialRecord?.id,
    initialRecord?.mnv,
    initialRecord?.monthEmployeeKey,
    initialRecord?.hoVaTen,
    selectedDate,
    dayIsCompensatory,
  ]);

  useEffect(() => {
    if (!open) return;
    if (initialRecord && initialRecord.id) {
      const merged = applyLegacyIncludeTsNvAndCanonicalPhep({
        ...EMPTY_EMPLOYEE_FORM,
        ...initialRecord,
      });
      merged.duocNghiBu = normalizeDuocNghiBuForForm(
        dayIsCompensatory,
        merged.duocNghiBu,
      );
      merged.boPhanChuaDung = normalizeBoPhanChuaDungForForm(
        merged.boPhanChuaDung,
      );
      if (isSeasonalAttendanceRoot(attendanceRootPath)) {
        merged.stt = merged.sttThoiVu ?? "";
        merged.gioiTinh =
          normalizeAttendanceGioiTinhValue(merged.gioiTinh) ||
          merged.gioiTinh ||
          "YES";
      }
      setForm(merged);
      setEditAttendanceKey(initialRecord.id);
    } else if (initialRecord && typeof initialRecord === "object") {
      const merged = applyLegacyIncludeTsNvAndCanonicalPhep({
        ...EMPTY_EMPLOYEE_FORM,
        ...initialRecord,
        id: "",
      });
      merged.duocNghiBu = normalizeDuocNghiBuForForm(
        dayIsCompensatory,
        merged.duocNghiBu,
      );
      merged.boPhanChuaDung = normalizeBoPhanChuaDungForForm(
        merged.boPhanChuaDung,
      );
      if (isSeasonalAttendanceRoot(attendanceRootPath)) {
        merged.stt = merged.sttThoiVu ?? "";
        merged.gioiTinh =
          normalizeAttendanceGioiTinhValue(merged.gioiTinh) ||
          merged.gioiTinh ||
          "YES";
      }
      setForm(merged);
      setEditAttendanceKey(null);
    } else {
      setForm({ ...EMPTY_EMPLOYEE_FORM });
      setEditAttendanceKey(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialRecord chỉ đọc khi formInitKey đổi; không deps object để tránh reset khi parent tạo {...emp} mới cùng id
  }, [open, formInitKey]);

  const employeeRegimeSelectValue = getEmployeeRegimeSelectValue(form);

  const handleEmployeeRegimeChange = useCallback((e) => {
    const flags = employeeRegimeFlagsFromSelectValue(e.target.value);
    setForm((prev) => ({
      ...prev,
      ...flags,
    }));
  }, []);

  /** Khóa cuộn nền (desktop + mobile/iOS): overflow + body fixed + khôi phục scroll khi đóng. */
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      overscroll: html.style.overscrollBehavior,
    };
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    return () => {
      html.style.overflow = prev.htmlOverflow;
      html.style.overscrollBehavior = prev.overscroll;
      body.style.overflow = prev.bodyOverflow;
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.left = prev.bodyLeft;
      body.style.right = prev.bodyRight;
      body.style.width = prev.bodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const hasClockInTime = useMemo(
    () => isAttendanceGioVaoClockTime(form.gioVao),
    [form.gioVao],
  );

  /** Có loại phép (trừ 1/2PN) → khóa giờ vào & giờ ra. */
  const clockTimesDisabled = useMemo(() => {
    const lp = String(form.loaiPhep ?? "").trim();
    return Boolean(lp) && !isAttendanceHalfAnnualLeave(lp);
  }, [form.loaiPhep]);

  const handleGioVaoTimeInput = useCallback((e) => {
    const gioVao = e.target.value || "";
    setForm((prev) => ({
      ...prev,
      gioVao,
      ...(gioVao && !isAttendanceHalfAnnualLeave(prev.loaiPhep)
        ? { loaiPhep: "" }
        : {}),
    }));
  }, []);

  const handleLoaiPhepSelect = useCallback((e) => {
    const v = e.target.value;
    const loaiPhep = v === "" ? "" : canonicalAttendanceLoaiPhep(v);
    setForm((prev) => ({
      ...prev,
      loaiPhep,
      ...(loaiPhep && !isAttendanceHalfAnnualLeave(loaiPhep)
        ? { gioVao: "", gioRa: "" }
        : {}),
    }));
  }, []);

  const notify = (alert) => {
    onAlert?.(alert);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      notify({
        show: true,
        type: "error",
        message: t("attendanceList.pleaseLogin"),
      });
      return;
    }

    const storageKey = attendanceMnvStorageKey(form.mnv);
    if (!storageKey) {
      notify({
        show: true,
        type: "error",
        message: t("attendanceList.error"),
      });
      return;
    }

    try {
      if (editAttendanceKey) {
        const existing = employees.find((emp) => emp.id === editAttendanceKey);
        if (
          !existing ||
          !canEditAttendanceForEmployee({
            user,
            userRole,
            userDepartments,
            employee: existing,
          })
        ) {
          notify({
            show: true,
            type: "error",
            message: t("attendanceList.error"),
          });
          return;
        }
        const daySnap = await get(
          ref(db, `${attendanceRootPath}/${selectedDate}/${editAttendanceKey}`),
        );
        const existingRaw = daySnap.val() || {};
        const allowFullEdit = isAdminAccess(user, userRole);
        const loaiPhepToSave = canonicalAttendanceLoaiPhep(
          String(form.loaiPhep ?? "").trim(),
        );

        const sliceOverrides = {
          businessId: storageKey,
          loaiPhep: loaiPhepToSave,
          boPhanChuaDung: normalizeBoPhanChuaDungForForm(form.boPhanChuaDung),
          ...(isSeasonalAttendance ? { sttThoiVu: form.stt } : {}),
        };
        if (!allowFullEdit) {
          sliceOverrides.caLamViec = form.caLamViec;
        }

        const dayDoc = buildEmployeeAttendanceDayDocument({
          form: formSliceForAttendanceDayDocument(form, sliceOverrides),
          existing: existingRaw,
          isSeasonal: isSeasonalAttendance,
        });
        await update(ref(db), {
          [`${attendanceRootPath}/${selectedDate}/${editAttendanceKey}`]:
            mergeAttendanceDayNodeForPersist(
              existingRaw,
              dayDoc,
              editAttendanceKey,
            ),
        });
        onClose();
        notify({
          show: true,
          type: "success",
          message: t("attendanceList.updateSuccess"),
        });
        onSaved?.();
      } else {
        if (
          !canAddAttendanceForDepartment({
            user,
            userRole,
            userDepartments,
            boPhan: form.boPhan,
          })
        ) {
          notify({
            show: true,
            type: "error",
            message: t("attendanceList.error"),
          });
          return;
        }
        const loaiPhepToSave = canonicalAttendanceLoaiPhep(
          String(form.loaiPhep ?? "").trim(),
        );
        const firebaseKeyPreview = resolveAttendanceFormPersistTarget({
          storageKey,
        });
        if (!firebaseKeyPreview) {
          notify({
            show: true,
            type: "error",
            message: t("attendanceList.error"),
          });
          return;
        }
        const { firebaseKey } = firebaseKeyPreview;
        const daySnap = await get(
          ref(db, `${attendanceRootPath}/${selectedDate}/${firebaseKey}`),
        );
        const existingRaw = daySnap.val() || {};
        const addTarget = resolveAttendanceFormPersistTarget({
          storageKey,
          existingRaw,
        });
        const dayDoc = buildEmployeeAttendanceDayDocument({
          form: formSliceForAttendanceDayDocument(form, {
            businessId: storageKey,
            loaiPhep: loaiPhepToSave,
            boPhanChuaDung: normalizeBoPhanChuaDungForForm(form.boPhanChuaDung),
            ...(isSeasonalAttendance ? { sttThoiVu: form.stt } : {}),
          }),
          existing: existingRaw,
          isSeasonal: isSeasonalAttendance,
        });
        const path = `${attendanceRootPath}/${selectedDate}/${firebaseKey}`;
        await update(ref(db), {
          [path]:
            addTarget?.mode === "add-merge"
              ? mergeAttendanceDayNodeForPersist(
                  existingRaw,
                  dayDoc,
                  firebaseKey,
                )
              : { ...dayDoc, id: firebaseKey },
        });
        onClose();
        notify({
          show: true,
          type: "success",
          message: t("attendanceList.addSuccess"),
        });
        onSaved?.();
      }
      setForm({ ...EMPTY_EMPLOYEE_FORM });
      setEditAttendanceKey(null);
    } catch (err) {
      notify({
        show: true,
        type: "error",
        message: t("attendanceList.error"),
      });
    }
  };

  if (!open) return null;

  const isSeasonalAttendance = isSeasonalAttendanceRoot(attendanceRootPath);
  const isEditMode = Boolean(editAttendanceKey);
  /** Sửa dòng: Admin / HR sửa toàn bộ; quản lý BP chỉ sửa loại phép + ca làm việc. */
  const isRestrictedEdit = isEditMode && !isAdminAccess(user, userRole);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-hidden overscroll-none bg-black/45 p-3 backdrop-blur-[2px] sm:p-4"
      style={{ zIndex: "var(--z-modal-backdrop, 1200)" }}
    >
      <div
        className={`relative mx-auto w-full max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-2xl border bg-white px-4 py-4 shadow-xl animate-fadeIn sm:px-5 sm:py-5 dark:bg-slate-900 ${
          isEditMode
            ? "border-fuchsia-300/80 dark:border-fuchsia-700/70"
            : "border-slate-200/90 dark:border-slate-700/80"
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-transparent p-0 text-xl font-bold leading-none text-purple-400 transition-colors hover:bg-purple-100 hover:text-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-400 dark:text-purple-500 dark:hover:bg-purple-950 dark:hover:text-purple-200 dark:focus-visible:ring-purple-600"
          aria-label="Đóng"
        >
          ×
        </button>
        <h2 className="mb-4 border-b-2 border-blue-200/80 bg-gradient-to-r from-blue-700 via-purple-600 to-indigo-600 bg-clip-text pb-3 text-center text-xl font-extrabold tracking-wide text-transparent drop-shadow-sm dark:from-blue-400 dark:via-purple-400 dark:to-indigo-400 sm:text-2xl">
          {isEditMode
            ? tl("updateEmployee", "Cập nhật nhân viên")
            : tl("addEmployee", "Thêm nhân viên mới")}
        </h2>
        {isRestrictedEdit && (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-center text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100">
            {tl(
              "restrictedEditManagerHint",
              "Bạn chỉ có thể sửa Loại phép, Ca làm việc và Nghỉ bù.",
            )}
          </p>
        )}
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <label className={employeeModalLabelClass}>
              {tl("fullName", "Họ và tên")}
            </label>
            <input
              type="text"
              name="hoVaTen"
              value={form.hoVaTen}
              onChange={handleChange}
              required
              disabled={isRestrictedEdit}
              className={employeeModalFieldClass}
            />
          </div>
          <div className="sm:col-span-2 grid min-w-0 grid-cols-3 gap-2 sm:gap-4">
            <div className="min-w-0">
              <label className={employeeModalLabelClass}>
                {tl("stt", "STT")}
              </label>
              <input
                type="number"
                name="stt"
                value={form.stt}
                onChange={handleChange}
                disabled={isRestrictedEdit}
                className={employeeModalFieldClass}
              />
            </div>
            <div className="min-w-0">
              <label className={employeeModalLabelClass}>
                {tl("mnv", "MNV")} *
              </label>
              <input
                type="text"
                name="mnv"
                value={form.mnv}
                onChange={handleChange}
                required
                disabled={isRestrictedEdit}
                className={employeeModalFieldClass}
              />
            </div>
            <div className="min-w-0">
              <label className={employeeModalLabelClass}>
                {tl("mvt", "MVT")}
              </label>
              <input
                type="text"
                name="mvt"
                value={form.mvt}
                onChange={handleChange}
                disabled={isRestrictedEdit}
                className={employeeModalFieldClass}
              />
            </div>
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-2 sm:col-span-2 sm:gap-4">
            <div className="min-w-0">
              <label className={employeeModalLabelClass}>
                {tl("gender", "Giới tính")}
              </label>
              <select
                name="gioiTinh"
                value={form.gioiTinh}
                onChange={handleChange}
                disabled={isRestrictedEdit}
                className={employeeModalSelectFieldClass}
              >
                <option value="YES">
                  {isSeasonalAttendance
                    ? tl("femaleLabel", "Nữ")
                    : t("attendanceList.female")}
                </option>
                <option value="NO">
                  {isSeasonalAttendance
                    ? tl("maleLabel", "Nam")
                    : t("attendanceList.male")}
                </option>
              </select>
            </div>
            <div className="min-w-0">
              <label className={employeeModalLabelClass}>
                {tl("joinDate", "Ngày vào làm")}
              </label>
              <input
                type="date"
                name="ngayVaoLam"
                value={form.ngayVaoLam}
                onChange={handleChange}
                disabled={isRestrictedEdit}
                className={`${employeeModalFieldClass} appearance-none`}
              />
            </div>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-2 sm:col-span-2 sm:grid-cols-2 sm:gap-4">
            <div className="min-w-0">
              <label className={employeeModalLabelClass}>
                {tl("contractDateColumn", "Ngày HĐ")}
              </label>
              <input
                type="date"
                name="ngayHopDong"
                value={form.ngayHopDong}
                onChange={handleChange}
                disabled={isRestrictedEdit}
                className={`${employeeModalFieldClass} appearance-none`}
              />
            </div>
            <div className="min-w-0">
              <label className={employeeModalLabelClass}>
                {tl("employeeRegimeField", "Chế độ nhân viên")}
              </label>
              <select
                value={employeeRegimeSelectValue}
                onChange={handleEmployeeRegimeChange}
                className={employeeModalSelectFieldClass}
                disabled={isRestrictedEdit}
              >
                <option value="">
                  {tl("employeeRegimePlaceholder", "— Chọn —")}
                </option>
                <option value={EMPLOYEE_REGIME.TAPVU}>
                  {tl("employeeRegimeTapVu", "Tạp vụ")}
                </option>
                <option value={EMPLOYEE_REGIME.THAISAN}>
                  {tl("employeeRegimeThaiSan", "Thai sản")}
                </option>
                <option value={EMPLOYEE_REGIME.TAIXE}>
                  {tl("employeeRegimeTaiXe", "Tài xế")}
                </option>
                <option value={EMPLOYEE_REGIME.TAIXETONG}>
                  {tl("employeeRegimeTaiXeTong", "Tài xế tổng")}
                </option>
              </select>
            </div>
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-2 sm:col-span-2 sm:gap-4">
            <div className="min-w-0">
              <label className={employeeModalLabelClass}>
                {tl("departmentCode", "Mã BP")}
              </label>
              <input
                type="text"
                name="maBoPhan"
                value={form.maBoPhan}
                onChange={handleChange}
                disabled={isRestrictedEdit}
                className={employeeModalFieldClass}
              />
            </div>
            <div className="min-w-0">
              <label className={employeeModalLabelClass}>
                {tl("departmentRequired", "Bộ phận")}
              </label>
              <input
                type="text"
                name="boPhan"
                value={form.boPhan}
                onChange={handleChange}
                required
                disabled={isRestrictedEdit}
                className={employeeModalFieldClass}
              />
            </div>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-x-3 gap-y-2 sm:col-span-2 sm:grid-cols-2">
            <div className="min-w-0">
              <label className={employeeModalLabelClass}>
                {tl("timeIn", "Giờ vào")}
              </label>
              <div className="flex min-w-0 flex-nowrap items-stretch gap-1.5 sm:gap-2">
                <input
                  type="time"
                  value={normalizeTimeForHtmlInput(form.gioVao) || ""}
                  onChange={handleGioVaoTimeInput}
                  disabled={isRestrictedEdit || clockTimesDisabled}
                  className={`${employeeModalFieldClass} min-w-0 flex-1${
                    clockTimesDisabled ? " cursor-not-allowed opacity-60" : ""
                  }`}
                  aria-disabled={isRestrictedEdit || clockTimesDisabled}
                />
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, gioVao: "" }))}
                  disabled={
                    isRestrictedEdit ||
                    clockTimesDisabled ||
                    !String(form.gioVao ?? "").trim()
                  }
                  className={employeeModalClearTimeButtonClass}
                  title={tl("timeInClearHint", "Xóa giờ vào (để trống)")}
                >
                  {tl("clearTimeIn", "Xóa giờ vào")}
                </button>
              </div>
              {clockTimesDisabled ? (
                <p className="mt-1 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
                  {tl(
                    "timeInDisabledWhenLeaveType",
                    "Đã chọn loại phép — xóa loại phép để nhập giờ vào/ra (trừ 1/2PN).",
                  )}
                </p>
              ) : null}
            </div>
            <div className="min-w-0">
              <label className={employeeModalLabelClass}>
                {tl("timeOut", "Giờ ra")}
              </label>
              <div className="flex min-w-0 flex-nowrap items-stretch gap-1.5 sm:gap-2">
                <input
                  type="time"
                  name="gioRa"
                  value={normalizeTimeForHtmlInput(form.gioRa) || ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      gioRa: e.target.value || "",
                    }))
                  }
                  disabled={isRestrictedEdit || clockTimesDisabled}
                  className={`${employeeModalFieldClass} min-w-0 flex-1${
                    clockTimesDisabled ? " cursor-not-allowed opacity-60" : ""
                  }`}
                  aria-disabled={isRestrictedEdit || clockTimesDisabled}
                />
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, gioRa: "" }))}
                  disabled={
                    isRestrictedEdit ||
                    clockTimesDisabled ||
                    !String(form.gioRa ?? "").trim()
                  }
                  className={employeeModalClearTimeButtonClass}
                  title={tl("timeOutClearHint", "Xóa thời gian ra (để trống)")}
                >
                  {tl("clearTimeOut", "Xóa giờ ra")}
                </button>
              </div>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className={employeeModalLabelClass}>
              {tl("leaveTypeColumn", "Loại phép")}
            </label>
            <select
              value={String(form.loaiPhep ?? "").trim()}
              onChange={handleLoaiPhepSelect}
              className={employeeModalSelectFieldClass}
            >
              <option value="">
                {tl("leaveTypePlaceholder", "— Không chọn —")}
              </option>
              {(() => {
                const raw = String(form.loaiPhep ?? "").trim();
                const isStd = Boolean(findGioVaoTypeOptionMatch(raw));
                return !isStd && raw ? (
                  <option value={raw}>
                    {raw} {tl("leaveTypeCurrentValue", "(giá trị hiện tại)")}
                  </option>
                ) : null;
              })()}
              {ATTENDANCE_LOAI_PHEP_OPTIONS.map(({ value, shortLabel }) => (
                <option key={value} value={value}>
                  {shortLabel} — {value}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] leading-snug text-purple-700/90 dark:text-purple-300/90">
              {hasClockInTime &&
              !isAttendanceHalfAnnualLeave(form.loaiPhep)
                ? tl(
                    "loaiPhepClearsTimeInOnSelect",
                    "Đã có giờ vào — chọn loại phép (trừ 1/2PN) sẽ xóa giờ vào/ra khi lưu.",
                  )
                : tl("loaiPhepModalHint", "Chọn loại phép (PN, PO, TS …)")}
            </p>
          </div>
          <div className="sm:col-span-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="min-w-0">
              <label className={employeeModalLabelClass}>
                {tl("workShift", "Ca làm việc")}
              </label>
              <select
                name="caLamViec"
                value={form.caLamViec ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    caLamViec: e.target.value,
                  }))
                }
                className={employeeModalSelectFieldClass}
              >
                <option value="">{tl("chooseShift", "Chọn ca")}</option>
                {(() => {
                  const raw = String(form.caLamViec ?? "").trim();
                  const isStd = ATTENDANCE_CA_LAM_VIEC_OPTIONS.some(
                    (o) => o.value === raw,
                  );
                  return !isStd && raw ? (
                    <option value={raw}>
                      {raw} {tl("shiftCurrentValue", "(giá trị hiện tại)")}
                    </option>
                  ) : null;
                })()}
                {ATTENDANCE_CA_LAM_VIEC_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] leading-snug text-blue-700/90 dark:text-blue-300/90">
                {tl("caLamViecModalHint", "S1 là Ca ngày, S2 là Ca đêm.")}
              </p>
            </div>
            <div className="min-w-0">
              <label
                htmlFor="departmentCheckConfirmed"
                className={employeeModalLabelClass}
              >
                {tl("departmentCheckTitle", "Kiểm tra bộ phận")}
              </label>
              <select
                id="departmentCheckConfirmed"
                name="boPhanChuaDung"
                value={isBoPhanChuaDung(form.boPhanChuaDung) ? "NO" : "YES"}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    boPhanChuaDung:
                      e.target.value === "NO" ? "YES" : "",
                  }))
                }
                className={employeeModalSelectFieldClass}
              >
                <option value="YES">{tl("departmentCheckYes", "ĐÚNG")}</option>
                <option value="NO">{tl("departmentCheckNo", "SAI")}</option>
              </select>
              <p
                className="mt-1.5 text-[11px] leading-snug text-blue-700/90 invisible select-none sm:block"
                aria-hidden="true"
              >
                &nbsp;
              </p>
            </div>
            <div className="min-w-0">
              <label className={employeeModalLabelClass}>
                {tl("compensatoryLeaveField", "Nghỉ bù")}
              </label>
              <select
                name="duocNghiBu"
                value={
                  !dayIsCompensatory
                    ? ""
                    : isDuocNghiBuExplicitlyNo(form.duocNghiBu)
                      ? "NO"
                      : "YES"
                }
                disabled={!dayIsCompensatory}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    duocNghiBu: e.target.value === "NO" ? "NO" : "YES",
                  }))
                }
                className={employeeModalSelectFieldClass}
              >
                <option value="NO">{tl("compensatoryLeaveNo", "Không")}</option>
                <option value="YES">{tl("compensatoryLeaveYes", "Có")}</option>
              </select>
              <p
                className="mt-1.5 text-[11px] leading-snug text-blue-700/90 invisible select-none sm:block"
                aria-hidden="true"
              >
                &nbsp;
              </p>
            </div>
          </div>
          <button
            type="submit"
            className="sm:col-span-2 mt-0 w-full rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2.5 text-sm font-extrabold tracking-wide text-white shadow-lg transition hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 active:scale-95 sm:text-base dark:focus:ring-offset-slate-900"
          >
            {isEditMode
              ? t("attendanceList.btnUpdate")
              : t("attendanceList.btnAdd")}
          </button>
        </form>
      </div>
    </div>
  );
}
