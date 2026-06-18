import React, { useState, useEffect, useCallback, useMemo } from "react";
import { parseLocalDateKey } from "@/utils/dateKey";
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
  canEditLunchOtForEmployee,
  isAdminAccess,
} from "@/config/authRoles";
import {
  ATTENDANCE_LOAI_PHEP_OPTIONS,
  isAttendanceGioVaoClockTime,
  isAttendanceHalfAnnualLeave,
} from "./attendanceGioVaoTypeOptions";
import { ATTENDANCE_CA_LAM_VIEC_OPTIONS } from "./attendanceCaLamViecOptions";
import { LUNCH_OT_HOUR_OPTIONS } from "./attendanceWorkingHours";
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
import { ATTENDANCE_EMP } from "./attendanceEmployeeFields";

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
  let gioVao = String(merged[ATTENDANCE_EMP.TIME_IN] ?? "").trim();
  let gioRa = String(merged[ATTENDANCE_EMP.TIME_OUT] ?? "").trim();
  const loaiPhepCanon = canonicalAttendanceLoaiPhep(merged[ATTENDANCE_EMP.LEAVE_TYPE]);
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
    [ATTENDANCE_EMP.TIME_IN]: gioVao,
    [ATTENDANCE_EMP.TIME_OUT]: gioRa,
    [ATTENDANCE_EMP.LEAVE_TYPE]: loaiPhep,
  };
}

const EMPTY_EMPLOYEE_FORM = {
  id: "",
  [ATTENDANCE_EMP.STT]: "",
  [ATTENDANCE_EMP.MNV]: "",
  [ATTENDANCE_EMP.MVT]: "",
  [ATTENDANCE_EMP.EMPLOYEE_NAME]: "",
  [ATTENDANCE_EMP.GENDER]: "YES",
  [ATTENDANCE_EMP.JOIN_DATE]: "",
  [ATTENDANCE_EMP.CONTRACT_DATE]: "",
  [ATTENDANCE_EMP.DEPT_CODE]: "",
  [ATTENDANCE_EMP.DEPARTMENT]: "",
  [ATTENDANCE_EMP.TIME_IN]: "",
  [ATTENDANCE_EMP.LEAVE_TYPE]: "",
  [ATTENDANCE_EMP.TIME_OUT]: "",
  [ATTENDANCE_EMP.LUNCH_OT_HOURS]: "",
  [ATTENDANCE_EMP.SHIFT]: "",
  [ATTENDANCE_EMP.COMP_LEAVE_ALLOWED]: "",
  /** Firebase: `attendance/{ngày}/{key}/boPhanChuaDung` — `"YES"` = sai bộ phận. */
  [ATTENDANCE_EMP.DEPT_WRONG_FLAG]: "",
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
  /** Chỉ xem — không cho sửa / lưu (vd. manager xem từ lưới tháng bảng lương). */
  readOnly = false,
}) {
  const { t, i18n } = useTranslation();
  const tl = useCallback(
    (key, defaultValue, options = {}) =>
      t(`attendanceList.${key}`, { defaultValue, ...options }),
    [t],
  );

  const formattedAttendanceDate = useMemo(() => {
    if (!selectedDate || !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) return "";
    const d = parseLocalDateKey(selectedDate);
    if (!d) return selectedDate;
    const locale = i18n.language?.startsWith("ko") ? "ko-KR" : "vi-VN";
    return d.toLocaleDateString(locale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [selectedDate, i18n.language]);

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
    () => isAttendanceGioVaoClockTime(form[ATTENDANCE_EMP.TIME_IN]),
    [form[ATTENDANCE_EMP.TIME_IN]],
  );

  /** Có loại phép (trừ 1/2PN) → khóa giờ vào & giờ ra. */
  const clockTimesDisabled = useMemo(() => {
    const lp = String(form[ATTENDANCE_EMP.LEAVE_TYPE] ?? "").trim();
    return Boolean(lp) && !isAttendanceHalfAnnualLeave(lp);
  }, [form[ATTENDANCE_EMP.LEAVE_TYPE]]);

  const handleGioVaoTimeInput = useCallback((e) => {
    const gioVao = e.target.value || "";
    setForm((prev) => ({
      ...prev,
      [ATTENDANCE_EMP.TIME_IN]: gioVao,
      ...(gioVao && !isAttendanceHalfAnnualLeave(prev[ATTENDANCE_EMP.LEAVE_TYPE])
        ? { [ATTENDANCE_EMP.LEAVE_TYPE]: "" }
        : {}),
    }));
  }, []);

  const handleLoaiPhepSelect = useCallback((e) => {
    const v = e.target.value;
    const loaiPhep = v === "" ? "" : canonicalAttendanceLoaiPhep(v);
    setForm((prev) => ({
      ...prev,
      [ATTENDANCE_EMP.LEAVE_TYPE]: loaiPhep,
      ...(loaiPhep && !isAttendanceHalfAnnualLeave(loaiPhep)
        ? {
            [ATTENDANCE_EMP.TIME_IN]: "",
            [ATTENDANCE_EMP.TIME_OUT]: "",
          }
        : {}),
    }));
  }, []);

  const notify = (alert) => {
    onAlert?.(alert);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (readOnly) return;
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
          String(form[ATTENDANCE_EMP.LEAVE_TYPE] ?? "").trim(),
        );

        const sliceOverrides = {
          businessId: storageKey,
          [ATTENDANCE_EMP.LEAVE_TYPE]: loaiPhepToSave,
          boPhanChuaDung: normalizeBoPhanChuaDungForForm(form.boPhanChuaDung),
          ...(isSeasonalAttendance ? { sttThoiVu: form.stt } : {}),
        };
        if (!allowFullEdit) {
          sliceOverrides[ATTENDANCE_EMP.SHIFT] = form[ATTENDANCE_EMP.SHIFT];
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
          String(form[ATTENDANCE_EMP.LEAVE_TYPE] ?? "").trim(),
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
            [ATTENDANCE_EMP.LEAVE_TYPE]: loaiPhepToSave,
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
  const isViewOnly = Boolean(readOnly);
  /** Sửa dòng: Admin / HR sửa toàn bộ; quản lý BP: loại phép, ca, nghỉ bù, chế độ NV (+ TC trưa Anodizing/Extrusion). */
  const isRestrictedEdit =
    isEditMode && !isAdminAccess(user, userRole) && !isViewOnly;
  const employeeBoPhanForPerm =
    String(form.boPhan ?? form[ATTENDANCE_EMP.DEPARTMENT] ?? "").trim() ||
    undefined;
  const canEditLunchOt = canEditLunchOtForEmployee({
    user,
    userRole,
    userDepartments,
    employee: { boPhan: employeeBoPhanForPerm },
  });
  const fieldsLocked = isViewOnly || isRestrictedEdit;
  const lunchOtLocked = isViewOnly || (isRestrictedEdit && !canEditLunchOt);

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
        <h2 className="mb-2 border-b-2 border-blue-200/80 bg-gradient-to-r from-blue-700 via-purple-600 to-indigo-600 bg-clip-text pb-3 text-center text-xl font-extrabold tracking-wide text-transparent drop-shadow-sm dark:from-blue-400 dark:via-purple-400 dark:to-indigo-400 sm:text-2xl">
          {isViewOnly
            ? tl("viewEmployeeAttendance", "Xem điểm danh")
            : isEditMode
              ? tl("updateEmployee", "Cập nhật nhân viên")
              : tl("addEmployee", "Thêm nhân viên mới")}
        </h2>
        {formattedAttendanceDate ? (
          <p
            className="mb-4 rounded-xl border border-indigo-200/80 bg-indigo-50/90 px-3 py-2 text-center dark:border-indigo-800/60 dark:bg-indigo-950/40"
            aria-label={tl("attendanceDateLabel", "Ngày điểm danh")}
          >
            <span className="block text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
              {tl("attendanceDateLabel", "Ngày điểm danh")}
            </span>
            <span className="mt-0.5 block text-sm font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
              {formattedAttendanceDate}
            </span>
          </p>
        ) : null}
        {isViewOnly ? (
          <p className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-center text-xs font-semibold text-sky-900 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-100">
            {tl(
              "viewOnlyAttendanceHint",
              "Chế độ chỉ xem — không thể chỉnh sửa hoặc lưu.",
            )}
          </p>
        ) : isRestrictedEdit ? (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-center text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100">
            {tl(
              canEditLunchOt
                ? "restrictedEditManagerHintWithLunchOt"
                : "restrictedEditManagerHint",
              canEditLunchOt
                ? "Bạn chỉ có thể sửa Loại phép, Ca làm việc, Nghỉ bù, Chế độ nhân viên và Tăng ca trưa."
                : "Bạn chỉ có thể sửa Loại phép, Ca làm việc, Nghỉ bù và Chế độ nhân viên.",
            )}
          </p>
        ) : null}
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
              disabled={fieldsLocked}
              className={employeeModalFieldClass}
            />
          </div>
          <div className="sm:col-span-2 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4">
            <div className="min-w-0">
              <label className={employeeModalLabelClass}>
                {tl("stt", "STT")}
              </label>
              <input
                type="number"
                name="stt"
                value={form.stt}
                onChange={handleChange}
                disabled={fieldsLocked}
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
                disabled={fieldsLocked}
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
                disabled={fieldsLocked}
                className={employeeModalFieldClass}
              />
            </div>
            <div className="min-w-0">
              <label className={employeeModalLabelClass}>
                {tl("gender", "Giới tính")}
              </label>
              <select
                name="gioiTinh"
                value={form.gioiTinh}
                onChange={handleChange}
                disabled={fieldsLocked}
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
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-2 sm:col-span-2 sm:gap-4">
            <div className="min-w-0">
              <label className={employeeModalLabelClass}>
                {tl("joinDate", "Ngày vào làm")}
              </label>
              <input
                type="date"
                name="ngayVaoLam"
                value={form.ngayVaoLam}
                onChange={handleChange}
                disabled={fieldsLocked}
                className={`${employeeModalFieldClass} appearance-none`}
              />
            </div>
            <div className="min-w-0">
              <label className={employeeModalLabelClass}>
                {tl("contractDateColumn", "Ngày HĐ")}
              </label>
              <input
                type="date"
                name="ngayHopDong"
                value={form.ngayHopDong}
                onChange={handleChange}
                disabled={fieldsLocked}
                className={`${employeeModalFieldClass} appearance-none`}
              />
            </div>
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-2 sm:col-span-2 sm:grid-cols-3 sm:gap-4">
            <div className="min-w-0">
              <label className={employeeModalLabelClass}>
                {tl("employeeRegimeField", "Chế độ nhân viên")}
              </label>
              <select
                value={employeeRegimeSelectValue}
                onChange={handleEmployeeRegimeChange}
                className={employeeModalSelectFieldClass}
                disabled={isViewOnly}
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
            <div className="min-w-0">
              <label className={employeeModalLabelClass}>
                {tl("departmentCode", "Mã BP")}
              </label>
              <input
                type="text"
                name="maBoPhan"
                value={form.maBoPhan}
                onChange={handleChange}
                disabled={fieldsLocked}
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
                disabled={fieldsLocked}
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
                  value={normalizeTimeForHtmlInput(form[ATTENDANCE_EMP.TIME_IN]) || ""}
                  onChange={handleGioVaoTimeInput}
                  disabled={fieldsLocked || clockTimesDisabled}
                  className={`${employeeModalFieldClass} min-w-0 flex-1${
                    clockTimesDisabled ? " cursor-not-allowed opacity-60" : ""
                  }`}
                  aria-disabled={fieldsLocked || clockTimesDisabled}
                />
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      [ATTENDANCE_EMP.TIME_IN]: "",
                    }))
                  }
                  disabled={
                    fieldsLocked ||
                    clockTimesDisabled ||
                    !String(form[ATTENDANCE_EMP.TIME_IN] ?? "").trim()
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
                  name={ATTENDANCE_EMP.TIME_OUT}
                  value={normalizeTimeForHtmlInput(form[ATTENDANCE_EMP.TIME_OUT]) || ""}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      [ATTENDANCE_EMP.TIME_OUT]: e.target.value || "",
                    }))
                  }
                  disabled={fieldsLocked || clockTimesDisabled}
                  className={`${employeeModalFieldClass} min-w-0 flex-1${
                    clockTimesDisabled ? " cursor-not-allowed opacity-60" : ""
                  }`}
                  aria-disabled={fieldsLocked || clockTimesDisabled}
                />
                <button
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      [ATTENDANCE_EMP.TIME_OUT]: "",
                    }))
                  }
                  disabled={
                    fieldsLocked ||
                    clockTimesDisabled ||
                    !String(form[ATTENDANCE_EMP.TIME_OUT] ?? "").trim()
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
              {tl("lunchOvertimeHours", "Thời gian tăng ca trưa")}
            </label>
            <select
              name={ATTENDANCE_EMP.LUNCH_OT_HOURS}
              value={
                form[ATTENDANCE_EMP.LUNCH_OT_HOURS] === "" || form[ATTENDANCE_EMP.LUNCH_OT_HOURS] == null
                  ? ""
                  : String(form[ATTENDANCE_EMP.LUNCH_OT_HOURS])
              }
              onChange={handleChange}
              disabled={lunchOtLocked}
              className={employeeModalSelectFieldClass}
            >
              <option value="">
                {tl("lunchOvertimePlaceholder", "— Không chọn —")}
              </option>
              {LUNCH_OT_HOUR_OPTIONS.map((h) => (
                <option key={h} value={String(h)}>{h}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={employeeModalLabelClass}>
              {tl("leaveTypeColumn", "Loại phép")}
            </label>
            <select
              value={String(form[ATTENDANCE_EMP.LEAVE_TYPE] ?? "").trim()}
              onChange={handleLoaiPhepSelect}
              disabled={isViewOnly}
              className={employeeModalSelectFieldClass}
            >
              <option value="">
                {tl("leaveTypePlaceholder", "— Không chọn —")}
              </option>
              {(() => {
                const raw = String(form[ATTENDANCE_EMP.LEAVE_TYPE] ?? "").trim();
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
              !isAttendanceHalfAnnualLeave(form[ATTENDANCE_EMP.LEAVE_TYPE])
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
                name={ATTENDANCE_EMP.SHIFT}
                value={form[ATTENDANCE_EMP.SHIFT] ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    [ATTENDANCE_EMP.SHIFT]: e.target.value,
                  }))
                }
                disabled={isViewOnly}
                className={employeeModalSelectFieldClass}
              >
                <option value="">{tl("chooseShift", "Chọn ca")}</option>
                {(() => {
                  const raw = String(form[ATTENDANCE_EMP.SHIFT] ?? "").trim();
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
                disabled={isViewOnly}
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
                disabled={!dayIsCompensatory || isViewOnly}
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
          {!isViewOnly ? (
            <button
              type="submit"
              className="sm:col-span-2 mt-0 w-full rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2.5 text-sm font-extrabold tracking-wide text-white shadow-lg transition hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 active:scale-95 sm:text-base dark:focus:ring-offset-slate-900"
            >
              {isEditMode
                ? t("attendanceList.btnUpdate")
                : t("attendanceList.btnAdd")}
            </button>
          ) : null}
        </form>
      </div>
    </div>
  );
}
