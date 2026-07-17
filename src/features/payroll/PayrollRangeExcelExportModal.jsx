import React, { useEffect, useMemo, useState } from "react";
import UnifiedModal from "@/components/ui/UnifiedModal";
import "./payrollRangeExcelExportModal.css";

/**
 * Chọn khoảng ngày + bộ phận (một hoặc nhiều) để xuất Excel bảng giờ công.
 */
export default function PayrollRangeExcelExportModal({
  open,
  onDismiss,
  onExport,
  todayKey,
  singleDayKey = null,
  departmentOptions = [],
  initialDepartmentFilter = "",
  exporting = false,
  title,
  hint,
  fromLabel,
  toLabel,
  dateSectionLabel = "Khoảng ngày",
  exportLabel,
  cancelLabel,
  departmentLabel = "Bộ phận",
  departmentHint = "Không chọn = xuất tất cả bộ phận",
  selectAllDepartmentsLabel = "Chọn tất cả",
  clearDepartmentsLabel = "Bỏ chọn",
  departmentSelectedLabel = "Đã chọn {{count}}/{{total}} bộ phận",
  departmentAllLabel = "Tất cả bộ phận",
  summarySingleLabel = "Ngày {{date}}",
  summaryRangeLabel = "{{from}} → {{to}}",
}) {
  const [from, setFrom] = useState(todayKey);
  const [to, setTo] = useState(todayKey);
  const [selectedDepartments, setSelectedDepartments] = useState([]);

  const isSingleDay = Boolean(singleDayKey);
  const totalDepartments = departmentOptions.length;
  const selectedCount = selectedDepartments.length;

  useEffect(() => {
    if (!open) return;
    const day = singleDayKey || todayKey;
    setFrom(day);
    setTo(day);
    const initial = String(initialDepartmentFilter ?? "").trim();
    setSelectedDepartments(initial ? [initial] : []);
  }, [open, todayKey, singleDayKey, initialDepartmentFilter]);

  const departmentBadge = useMemo(() => {
    if (!totalDepartments) return departmentHint;
    if (!selectedCount) return departmentAllLabel;
    return departmentSelectedLabel
      .replace("{{count}}", String(selectedCount))
      .replace("{{total}}", String(totalDepartments));
  }, [
    totalDepartments,
    selectedCount,
    departmentHint,
    departmentAllLabel,
    departmentSelectedLabel,
  ]);

  const footerSummary = useMemo(() => {
    const datePart = isSingleDay
      ? summarySingleLabel.replace("{{date}}", singleDayKey || "")
      : summaryRangeLabel
          .replace("{{from}}", from || "")
          .replace("{{to}}", to || "");
    return `${datePart} · ${departmentBadge}`;
  }, [
    isSingleDay,
    singleDayKey,
    from,
    to,
    departmentBadge,
    summarySingleLabel,
    summaryRangeLabel,
  ]);

  if (!open) return null;

  const toggleDepartment = (dept) => {
    setSelectedDepartments((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept],
    );
  };

  const handleExport = () => {
    if (exporting) return;
    const exportFrom = singleDayKey || from;
    const exportTo = singleDayKey || to;
    onExport(exportFrom, exportTo, selectedDepartments);
  };

  return (
    <UnifiedModal
      isOpen={open}
      onClose={() => {
        if (exporting) return;
        onDismiss();
      }}
      variant="success"
      title={title}
      size="sm"
      showCloseButton={!exporting}
      icon="📊"
      footerStart={
        <p className="prex-footer-summary">
          <strong>{footerSummary}</strong>
        </p>
      }
      actions={[
        {
          label: cancelLabel,
          onClick: () => {
            if (exporting) return;
            onDismiss();
          },
          variant: "secondary",
          disabled: exporting,
        },
        {
          label: exporting ? "…" : exportLabel,
          onClick: handleExport,
          variant: "primary",
          disabled: exporting,
        },
      ]}
    >
      <div className="prex-body">
        {hint ? <p className="prex-hint">{hint}</p> : null}

        <section className="prex-section" aria-labelledby="prex-date-section">
          <header className="prex-section-head" id="prex-date-section">
            <span className="prex-step">1</span>
            <span>{isSingleDay ? fromLabel : dateSectionLabel}</span>
          </header>
          <div className="prex-section-body">
            {isSingleDay ? (
              <div className="prex-date-single">
                <span aria-hidden="true">📅</span>
                <span>{singleDayKey}</span>
              </div>
            ) : (
              <div className="prex-date-grid">
                <label className="prex-field">
                  <span className="prex-field-label">{fromLabel}</span>
                  <input
                    type="date"
                    required
                    value={from}
                    disabled={exporting}
                    onChange={(e) => setFrom(e.target.value)}
                    className="prex-field-input"
                  />
                </label>
                <label className="prex-field">
                  <span className="prex-field-label">{toLabel}</span>
                  <input
                    type="date"
                    required
                    value={to}
                    disabled={exporting}
                    onChange={(e) => setTo(e.target.value)}
                    className="prex-field-input"
                  />
                </label>
              </div>
            )}
          </div>
        </section>

        <section className="prex-section" aria-labelledby="prex-dept-section">
          <header className="prex-section-head" id="prex-dept-section">
            <span className="prex-step">2</span>
            <span>{departmentLabel}</span>
          </header>
          <div className="prex-section-body">
            <div className="prex-dept-toolbar">
              <span
                className={`prex-dept-badge${selectedCount ? "" : " prex-dept-badge--all"}`}
              >
                {departmentBadge}
              </span>
              {totalDepartments > 0 ? (
                <div className="prex-dept-actions">
                  <button
                    type="button"
                    disabled={exporting}
                    onClick={() =>
                      setSelectedDepartments([...departmentOptions])
                    }
                    className="prex-dept-action"
                  >
                    {selectAllDepartmentsLabel}
                  </button>
                  <button
                    type="button"
                    disabled={exporting}
                    onClick={() => setSelectedDepartments([])}
                    className="prex-dept-action"
                  >
                    {clearDepartmentsLabel}
                  </button>
                </div>
              ) : null}
            </div>
            {totalDepartments === 0 ? (
              <>
                <p className="prex-hint">{departmentHint}</p>
                <p className="prex-dept-empty">—</p>
              </>
            ) : (
              <div className="prex-dept-grid" role="group" aria-label={departmentLabel}>
                {departmentOptions.map((dept) => (
                  <label key={dept} className="prex-dept-item">
                    <input
                      type="checkbox"
                      checked={selectedDepartments.includes(dept)}
                      disabled={exporting}
                      onChange={() => toggleDepartment(dept)}
                    />
                    <span title={dept}>{dept}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </UnifiedModal>
  );
}
