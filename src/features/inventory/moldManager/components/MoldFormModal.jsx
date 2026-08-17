import React, { useRef } from "react";
import { createPortal } from "react-dom";
import { FiCheck, FiFolder, FiX } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import { MOLD_IMAGE_COLUMNS, MOLD_STATUS_OPTIONS } from "../lib/moldConstants";

const MOLD_FORM_ID = "mold-form-modal";

const REQUIRED_FIELDS = new Set([
  "Subsidiary",
  "Model",
  "Production Name",
  "Mold Code",
]);

function FormSection({ title, children }) {
  return (
    <section className="mold-form-section">
      <header className="mold-form-section-head">
        <h3>{title}</h3>
      </header>
      {children}
    </section>
  );
}

function FormField({
  name,
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  type = "text",
  className = "",
  mono = false,
}) {
  return (
    <label className={`mold-form-field ${className}`.trim()}>
      <span className="mold-form-field-label">
        {label}
        {required ? <span className="mold-form-required">*</span> : null}
      </span>
      <input
        type={type}
        name={name}
        value={value ?? ""}
        onChange={onChange}
        disabled={disabled}
        className={`mold-form-input${mono ? " mold-form-input--mono" : ""}${
          disabled ? " mold-form-input--disabled" : ""
        }`}
      />
    </label>
  );
}

function FormSelect({ name, label, value, onChange, options, hint }) {
  return (
    <label className="mold-form-field">
      <span className="mold-form-field-label">{label}</span>
      <select
        name={name}
        value={value ?? ""}
        onChange={onChange}
        className="mold-form-input mold-form-select"
      >
        {options.map((opt) => (
          <option key={opt.value || "auto"} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint ? <span className="mold-form-field-hint">{hint}</span> : null}
    </label>
  );
}

function FileField({ label, fileName, onPick, emptyLabel, pickLabel }) {
  const inputRef = useRef(null);
  const hasFile = Boolean(fileName?.trim());

  return (
    <div className="mold-form-field mold-form-field--file">
      <span className="mold-form-field-label">{label}</span>
      <div className="mold-form-file">
        <button
          type="button"
          className="mold-form-file-btn"
          onClick={() => inputRef.current?.click()}
          title={pickLabel}
        >
          <FiFolder size={14} aria-hidden="true" />
        </button>
        <span
          className={`mold-form-file-name${
            hasFile ? "" : " mold-form-file-name--empty"
          }`}
        >
          {hasFile ? fileName : emptyLabel}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="mold-form-file-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPick(file);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

export default function MoldFormModal({
  isEditing,
  form,
  onChange,
  onSubmit,
  onClose,
  onImageUpload,
  getFieldLabel,
}) {
  const { t } = useTranslation();

  const moldCode = form?.["Mold Code"]?.trim();
  const title = isEditing
    ? t("moldManager.updateMold", "Cập nhật Mold")
    : t("moldManager.addMold", "Thêm mới Mold");
  const eyebrow = isEditing
    ? t("moldManager.formEditEyebrow", "Chỉnh sửa hồ sơ")
    : t("moldManager.formAddEyebrow", "Thêm hồ sơ mới");
  const submitLabel = isEditing
    ? t("moldManager.updateMold", "Cập nhật Mold")
    : t("moldManager.addNewLabel", "Thêm khuôn mới");

  const label = (col, fallback) => {
    const translated = getFieldLabel?.(col);
    return translated && translated !== col ? translated : fallback;
  };

  const statusOptions = MOLD_STATUS_OPTIONS.map((opt) => ({
    value: opt.value,
    label: t(`moldManager.${opt.labelKey}`, opt.labelKey),
  }));

  return createPortal(
    <div className="mold-modal-backdrop mold-form-backdrop" onClick={onClose}>
      <div
        className="mold-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mold-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mold-detail-hero mold-form-hero">
          <div className="mold-detail-hero-text">
            <p className="mold-detail-eyebrow">{eyebrow}</p>
            <h2 id="mold-form-title" className="mold-detail-title">
              {title}
            </h2>
          </div>
          <div className="mold-detail-hero-actions">
            {moldCode ? (
              <span className="mold-detail-code-badge">{moldCode}</span>
            ) : null}
            <button
              type="button"
              className="mold-detail-close"
              onClick={onClose}
              aria-label={t("moldManager.close")}
            >
              <FiX size={18} />
            </button>
          </div>
        </header>

        <form
          id={MOLD_FORM_ID}
          className="mold-form-scroll"
          onSubmit={onSubmit}
          noValidate
        >
          <FormSection title={t("moldManager.formGeneral", "Thông tin chung")}>
            <div className="mold-form-grid mold-form-grid--4">
              <FormField
                name="No"
                label={label("No", "STT")}
                value={form.No}
                onChange={onChange}
                disabled
                mono
              />
              <FormField
                name="Subsidiary"
                label={label("Subsidiary", "Chi nhánh")}
                value={form.Subsidiary}
                onChange={onChange}
                required={REQUIRED_FIELDS.has("Subsidiary")}
              />
              <FormField
                name="Model"
                label={label("Model", "Model")}
                value={form.Model}
                onChange={onChange}
                required={REQUIRED_FIELDS.has("Model")}
              />
              <FormField
                name="Production Name"
                label={label("Production Name", "Tên sản phẩm")}
                value={form["Production Name"]}
                onChange={onChange}
                required={REQUIRED_FIELDS.has("Production Name")}
              />
              <FormField
                name="Mold Code"
                label={label("Mold Code", "Mã khuôn")}
                value={form["Mold Code"]}
                onChange={onChange}
                required={REQUIRED_FIELDS.has("Mold Code")}
                mono
              />
              <FormField
                name="Asset No."
                label={label("Asset No.", "Số tài sản")}
                value={form["Asset No."]}
                onChange={onChange}
                mono
              />
              <FormField
                name="Mold Size (W*D*H)"
                label={t("moldManager.detailSizeLabel", "Kích thước (W×D×H)")}
                value={form["Mold Size (W*D*H)"]}
                onChange={onChange}
                mono
              />
              <FormField
                name="Tooling Weight"
                label={t("moldManager.formWeightKg", "Trọng lượng (kg)")}
                value={form["Tooling Weight"]}
                onChange={onChange}
                mono
              />
            </div>
          </FormSection>

          <FormSection
            title={t("moldManager.formOperational", "Thông số vận hành")}
          >
            <div className="mold-form-grid mold-form-grid--4">
              <FormField
                name="Date"
                label={label("Date", "Ngày")}
                value={form.Date}
                onChange={onChange}
                type="date"
                mono
              />
              <FormField
                name="Location"
                label={label("Location", "Vị trí")}
                value={form.Location}
                onChange={onChange}
              />
              <FormSelect
                name="Status"
                label={label("Status", "Trạng thái")}
                value={form.Status ?? ""}
                onChange={onChange}
                options={statusOptions}
                hint={t(
                  "moldManager.statusFieldHint",
                  "Để trống = tự suy ra theo SHOT và vị trí",
                )}
              />
              <FormField
                name="Type"
                label={label("Type", "Loại")}
                value={form.Type}
                onChange={onChange}
              />
              <FormField
                name="Pavonine Model"
                label={label("Pavonine Model", "Code")}
                value={form["Pavonine Model"]}
                onChange={onChange}
                mono
              />
            </div>
            <div className="mold-form-grid mold-form-grid--ops">
              <FormField
                name="Shot Counter"
                label={label("Shot Counter", "SHOT")}
                value={form["Shot Counter"]}
                onChange={onChange}
                className="mold-form-field--shot"
                mono
              />
              <FormField
                name="Molds per Product"
                label={t("moldManager.detailMoldCount", "Số khuôn")}
                value={form["Molds per Product"]}
                onChange={onChange}
                className="mold-form-field--count"
                mono
              />
              <FileField
                label={label("NamePlate", "Template")}
                fileName={form.NamePlate}
                onPick={(file) => onImageUpload("NamePlate", file)}
                emptyLabel={t("moldManager.formNoFile", "Chưa chọn tệp")}
                pickLabel={t("moldManager.formChooseFile", "Chọn tệp")}
              />
            </div>
          </FormSection>

          <FormSection
            title={t("moldManager.formAttachments", "Tài liệu đính kèm")}
          >
            <div className="mold-form-grid mold-form-grid--2">
              <FileField
                label={label("Process", "Quy trình")}
                fileName={form.Process}
                onPick={(file) => onImageUpload("Process", file)}
                emptyLabel={t("moldManager.formNoFile", "Chưa chọn tệp")}
                pickLabel={t("moldManager.formChooseFile", "Chọn tệp")}
              />
              <FileField
                label={label("PM Image", "PM khuôn")}
                fileName={form["PM Image"]}
                onPick={(file) => onImageUpload("PM Image", file)}
                emptyLabel={t("moldManager.formNoFile", "Chưa chọn tệp")}
                pickLabel={t("moldManager.formChooseFile", "Chọn tệp")}
              />
            </div>
          </FormSection>
        </form>

        <footer className="mold-form-foot">
          <p className="mold-form-foot-hint">
            {t("moldManager.formRequiredHint", "Các trường có * là bắt buộc")}
          </p>
          <div className="mold-form-foot-actions">
            <button type="button" className="mold-btn mold-btn--ghost" onClick={onClose}>
              {t("moldManager.cancel", "Hủy")}
            </button>
            <button
              type="submit"
              form={MOLD_FORM_ID}
              className="mold-btn mold-btn--primary"
            >
              <FiCheck size={14} aria-hidden="true" />
              {submitLabel}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

/** Exported for tests — columns that use file picker UI */
export const MOLD_FORM_FILE_COLUMNS = MOLD_IMAGE_COLUMNS;
