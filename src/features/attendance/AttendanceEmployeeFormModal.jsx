import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { db, ref, push, update, get } from "@/services/firebase";
import {
  EMPLOYEE_PROFILES_PATH,
  buildEmployeeProfileDocument,
  buildEmployeeAttendanceDayDocument,
  employeeProfileStorageKeyFromMnv,
  slugifyDepartmentKey,
} from "@/utils/employeeRosterRecord";
import {
  appendEmployeeProfileHistory,
  diffEmployeeProfileDocs,
} from "@/utils/employeeProfileHistory";
import {
  canEditAttendanceForEmployee,
  canAddAttendanceForDepartment,
  isAdminAccess,
} from "@/config/authRoles";
import { ATTENDANCE_GIO_VAO_TYPE_OPTIONS } from "./attendanceGioVaoTypeOptions";
import { ATTENDANCE_CA_LAM_VIEC_OPTIONS } from "./attendanceCaLamViecOptions";
import {
  looksLikeGioVaoTime,
  normalizeTimeForHtmlInput,
} from "./attendanceGioVaoModalHelpers";

export const EMPTY_EMPLOYEE_FORM = {
  id: "",
  stt: "",
  mnv: "",
  mvt: "",
  hoVaTen: "",
  gioiTinh: "YES",
  ngayThangNamSinh: "",
  maBoPhan: "",
  boPhan: "",
  gioVao: "",
  loaiPhep: "",
  gioRa: "",
  caLamViec: "",
  pnTon: "",
};

const employeeModalFieldClass =
  "w-full min-h-[2.5rem] rounded-lg border-2 border-blue-200 bg-white p-2 text-sm font-bold text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:border-blue-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500 dark:focus:ring-blue-500/40";
const employeeModalLabelClass =
  "mb-1 block text-xs font-bold uppercase tracking-wide text-purple-600 dark:text-purple-400";

/**
 * Modal thêm / cập nhật nhân viên (profile + attendance theo ngày).
 * Dùng chung Điểm danh NV và màn tính lương — lưu Firebase `update()` nên mọi màn đang `onValue` đồng bộ.
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
      return `edit:${String(initialRecord.id)}:${selectedDate}`;
    }
    return `add:${selectedDate}`;
  }, [open, initialRecord?.id, selectedDate]);

  useEffect(() => {
    if (!open) return;
    if (initialRecord && initialRecord.id) {
      let merged = { ...EMPTY_EMPLOYEE_FORM, ...initialRecord };
      const gv = String(merged.gioVao ?? "").trim();
      const lp = String(merged.loaiPhep ?? "").trim();
      if (!lp && gv && !looksLikeGioVaoTime(gv)) {
        merged = { ...merged, loaiPhep: gv, gioVao: "" };
      }
      setForm(merged);
      setEditAttendanceKey(initialRecord.id);
    } else {
      setForm({ ...EMPTY_EMPLOYEE_FORM });
      setEditAttendanceKey(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialRecord chỉ đọc khi formInitKey đổi; không deps object để tránh reset khi parent tạo {...emp} mới cùng id
  }, [open, formInitKey]);

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

  const handleGioVaoTimeInput = useCallback((e) => {
    setForm((prev) => ({ ...prev, gioVao: e.target.value || "" }));
  }, []);

  const handleLoaiPhepSelect = useCallback((e) => {
    setForm((prev) => ({ ...prev, loaiPhep: e.target.value }));
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

    const storageKey = employeeProfileStorageKeyFromMnv(form.mnv);
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
          ref(db, `attendance/${selectedDate}/${editAttendanceKey}`),
        );
        const existingRaw = daySnap.val() || {};
        const profSnap = await get(
          ref(db, `${EMPLOYEE_PROFILES_PATH}/${storageKey}`),
        );
        const existingProfile = profSnap.val() || {};
        const deptKey =
          String(existingProfile.departmentKey ?? "").trim() ||
          slugifyDepartmentKey(form.boPhan);
        const allowFullEdit = isAdminAccess(user, userRole);

        if (!allowFullEdit) {
          const mergedFormRestricted = {
            ...existingProfile,
            ...existing,
            businessId: storageKey,
            departmentKey: deptKey,
            loaiPhep: form.loaiPhep,
            caLamViec: form.caLamViec,
          };
          const dayDoc = buildEmployeeAttendanceDayDocument({
            form: mergedFormRestricted,
            existing: existingRaw,
          });
          await update(ref(db), {
            [`attendance/${selectedDate}/${editAttendanceKey}`]: {
              ...dayDoc,
              id: editAttendanceKey,
            },
          });
        } else {
          const mergedForm = {
            ...existingProfile,
            ...form,
            businessId: storageKey,
            departmentKey: deptKey,
          };
          const profileDoc = buildEmployeeProfileDocument({
            form: mergedForm,
            existingProfile,
            departmentDisplayName: form.boPhan,
            departmentKey: deptKey,
          });
          const dayDoc = buildEmployeeAttendanceDayDocument({
            form: mergedForm,
            existing: existingRaw,
          });
          await update(ref(db), {
            [`${EMPLOYEE_PROFILES_PATH}/${storageKey}`]: profileDoc,
            [`attendance/${selectedDate}/${editAttendanceKey}`]: {
              ...dayDoc,
              id: editAttendanceKey,
            },
          });
          const profileChanges = diffEmployeeProfileDocs(
            existingProfile,
            profileDoc,
          );
          if (profileChanges.length > 0) {
            void appendEmployeeProfileHistory({
              by: user?.email || "",
              action: "update",
              source: "attendance",
              profileKey: storageKey,
              mnv: String(profileDoc.mnv || form.mnv || ""),
              hoVaTen: String(profileDoc.hoVaTen || form.hoVaTen || ""),
              changes: profileChanges,
            });
          }
        }
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
        const profSnap = await get(
          ref(db, `${EMPLOYEE_PROFILES_PATH}/${storageKey}`),
        );
        const existingProfile = profSnap.val() || {};
        const deptKey =
          String(existingProfile.departmentKey ?? "").trim() ||
          slugifyDepartmentKey(form.boPhan);
        const mergedForm = {
          ...existingProfile,
          ...form,
          businessId: storageKey,
          departmentKey: deptKey,
        };
        const profileDoc = buildEmployeeProfileDocument({
          form: mergedForm,
          existingProfile,
          departmentDisplayName: form.boPhan,
          departmentKey: deptKey,
        });
        const newRef = push(ref(db, `attendance/${selectedDate}`));
        const newKey = newRef.key;
        const dayDoc = buildEmployeeAttendanceDayDocument({
          form: mergedForm,
          existing: {},
        });
        await update(ref(db), {
          [`${EMPLOYEE_PROFILES_PATH}/${storageKey}`]: profileDoc,
          [`attendance/${selectedDate}/${newKey}`]: { ...dayDoc, id: newKey },
        });
        void appendEmployeeProfileHistory({
          by: user?.email || "",
          action: "create",
          source: "attendance",
          profileKey: storageKey,
          mnv: String(profileDoc.mnv || form.mnv || ""),
          hoVaTen: String(profileDoc.hoVaTen || form.hoVaTen || ""),
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

  const isEditMode = Boolean(editAttendanceKey);
  /** Sửa dòng: Admin / HR sửa toàn bộ; quản lý BP chỉ sửa loại phép + ca làm việc. */
  const isRestrictedEdit =
    isEditMode && !isAdminAccess(user, userRole);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden overscroll-none bg-black/45 p-4 backdrop-blur-[2px]">
      <div
        className={`relative mx-auto w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border-2 border-blue-200 bg-gradient-to-br from-purple-50 via-white to-indigo-100 p-6 shadow-2xl animate-fadeIn sm:p-8 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950 dark:border-blue-800 ${
          isEditMode
            ? "ring-2 ring-fuchsia-400/50 shadow-fuchsia-500/10 dark:ring-fuchsia-500/35"
            : "ring-1 ring-blue-200/80 dark:ring-blue-900/60"
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-xl font-bold text-purple-400 transition hover:bg-purple-100 hover:text-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:text-purple-500 dark:hover:bg-purple-950 dark:hover:text-purple-200"
          aria-label="Đóng"
        >
          ×
        </button>
        <h2 className="mb-6 border-b-2 border-blue-200/80 bg-gradient-to-r from-blue-700 via-purple-600 to-indigo-600 bg-clip-text pb-4 text-center text-xl font-extrabold tracking-wide text-transparent drop-shadow-sm dark:from-blue-400 dark:via-purple-400 dark:to-indigo-400 sm:text-2xl">
          {isEditMode
            ? tl("updateEmployee", "Cập nhật nhân viên")
            : tl("addEmployee", "Thêm nhân viên mới")}
        </h2>
        {isRestrictedEdit && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100">
            {tl(
              "restrictedEditManagerHint",
              "Bạn chỉ có thể sửa Loại phép và Ca làm việc. Chỉ Admin / HR mới chỉnh sửa toàn bộ thông tin.",
            )}
          </p>
        )}
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2"
        >
          <div className="sm:col-span-2 grid min-w-0 grid-cols-3 gap-3 sm:gap-4">
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
          <div>
            <label className={employeeModalLabelClass}>
              {tl("gender", "Giới tính")}
            </label>
            <select
              name="gioiTinh"
              value={form.gioiTinh}
              onChange={handleChange}
              disabled={isRestrictedEdit}
              className={employeeModalFieldClass}
            >
              <option value="YES">{t("attendanceList.female")}</option>
              <option value="NO">{t("attendanceList.male")}</option>
            </select>
          </div>
          <div>
            <label className={employeeModalLabelClass}>
              {tl("dateOfBirth", "Ngày sinh")}
            </label>
            <input
              type="date"
              name="ngayThangNamSinh"
              value={form.ngayThangNamSinh}
              onChange={handleChange}
              disabled={isRestrictedEdit}
              className={employeeModalFieldClass}
            />
          </div>
          <div>
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
          <div>
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
          <div>
            <label className={employeeModalLabelClass}>
              {tl("timeIn", "Giờ vào")}
            </label>
            <div className="flex flex-wrap items-stretch gap-2">
              <input
                type="time"
                value={normalizeTimeForHtmlInput(form.gioVao) || ""}
                onChange={handleGioVaoTimeInput}
                disabled={isRestrictedEdit}
                className={`${employeeModalFieldClass} min-w-0 flex-1`}
              />
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, gioVao: "" }))}
                disabled={
                  isRestrictedEdit || !String(form.gioVao ?? "").trim()
                }
                className="shrink-0 rounded-lg border-2 border-slate-300 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-200 disabled:pointer-events-none disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                title={tl(
                  "timeInClearHint",
                  "Xóa giờ vào (để trống)",
                )}
              >
                {tl("clearTimeIn", "Xóa giờ vào")}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-purple-700/90 dark:text-purple-300/90">
              {tl(
                "gioVaoTimeOnlyHint",
                "Giờ chấm HH:MM — có thể kết hợp với loại phép bên dưới.",
              )}
            </p>
          </div>
          <div>
            <label className={employeeModalLabelClass}>
              {tl("timeOut", "Giờ ra")}
            </label>
            <div className="flex flex-wrap items-stretch gap-2">
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
                disabled={isRestrictedEdit}
                className={`${employeeModalFieldClass} min-w-0 flex-1`}
              />
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, gioRa: "" }))}
                disabled={
                  isRestrictedEdit || !String(form.gioRa ?? "").trim()
                }
                className="shrink-0 rounded-lg border-2 border-slate-300 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-200 disabled:pointer-events-none disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                title={tl(
                  "timeOutClearHint",
                  "Xóa thời gian ra (để trống)",
                )}
              >
                {tl("clearTimeOut", "Xóa giờ ra")}
              </button>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className={employeeModalLabelClass}>
              {tl("leaveTypeColumn", "Loại phép")}
            </label>
            <select
              value={String(form.loaiPhep ?? "").trim()}
              onChange={handleLoaiPhepSelect}
              className={employeeModalFieldClass}
            >
              <option value="">
                {tl("leaveTypePlaceholder", "— Không chọn —")}
              </option>
              {(() => {
                const raw = String(form.loaiPhep ?? "").trim();
                const isStd = ATTENDANCE_GIO_VAO_TYPE_OPTIONS.some(
                  (o) => o.value === raw,
                );
                return !isStd && raw ? (
                  <option value={raw}>
                    {raw} {tl("leaveTypeCurrentValue", "(giá trị hiện tại)")}
                  </option>
                ) : null;
              })()}
              {ATTENDANCE_GIO_VAO_TYPE_OPTIONS.map(({ value, shortLabel }) => (
                <option key={value} value={value}>
                  {shortLabel} — {value}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[11px] leading-snug text-purple-700/90 dark:text-purple-300/90">
              {tl(
                "loaiPhepModalHint",
                "Chọn loại phép / trạng thái (PN, PO, …) — có thể vừa có giờ vào vừa có loại.",
              )}
            </p>
          </div>
          <div>
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
              className={employeeModalFieldClass}
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
              {tl(
                "caLamViecModalHint",
                "Chọn ca chuẩn để đồng bộ với bảng điểm danh và thống kê.",
              )}
            </p>
          </div>
          <button
            type="submit"
            className="sm:col-span-2 mt-1 w-full rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 py-3 text-base font-extrabold tracking-wide text-white shadow-lg transition hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 active:scale-95 dark:focus:ring-offset-slate-900"
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
