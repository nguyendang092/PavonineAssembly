import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import "./payrollDepartmentMultiSelect.css";

function usePanelFixedStyle(open, anchorRef) {
  const [style, setStyle] = useState(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) {
      setStyle(null);
      return undefined;
    }

    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(288, window.innerWidth - 16);
      let left = rect.left;
      if (left + width > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - 8 - width);
      }
      setStyle({
        top: rect.bottom + 4,
        left,
        width,
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchorRef]);

  return style;
}

/**
 * Chọn một hoặc nhiều bộ phận — dropdown gọn cho toolbar lưới tháng.
 */
export default function PayrollDepartmentMultiSelect({
  options = [],
  selected = [],
  onChange,
  disabled = false,
  allLabel = "Tất cả bộ phận",
  selectedLabel = "Đã chọn {{count}}/{{total}} bộ phận",
  selectAllLabel = "Chọn tất cả",
  clearLabel = "Bỏ chọn",
  hint = "Không chọn = tất cả bộ phận",
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const listId = useId();
  const panelStyle = usePanelFixedStyle(open, rootRef);
  const selectedCount = selected.length;
  const total = options.length;

  const triggerLabel =
    !selectedCount || !total
      ? allLabel
      : selectedLabel
          .replace("{{count}}", String(selectedCount))
          .replace("{{total}}", String(total));

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (
        rootRef.current?.contains(e.target) ||
        panelRef.current?.contains(e.target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (dept) => {
    if (disabled) return;
    onChange(
      selected.includes(dept)
        ? selected.filter((d) => d !== dept)
        : [...selected, dept],
    );
  };

  const panel =
    open && panelStyle ? (
      <div
        ref={panelRef}
        className="pdm-panel pdm-panel--portal"
        id={listId}
        role="dialog"
        aria-label={allLabel}
        style={{
          top: panelStyle.top,
          left: panelStyle.left,
          width: panelStyle.width,
        }}
      >
        <div className="pdm-panel-head">
          <span className="pdm-panel-hint">{hint}</span>
          <div className="pdm-panel-actions">
            <button
              type="button"
              disabled={disabled}
              className="pdm-action"
              onClick={() => onChange([...options])}
            >
              {selectAllLabel}
            </button>
            <button
              type="button"
              disabled={disabled}
              className="pdm-action pdm-action--muted"
              onClick={() => onChange([])}
            >
              {clearLabel}
            </button>
          </div>
        </div>
        <div className="pdm-grid" role="group">
          {options.map((dept) => (
            <label key={dept} className="pdm-item">
              <input
                type="checkbox"
                checked={selected.includes(dept)}
                disabled={disabled}
                onChange={() => toggle(dept)}
              />
              <span title={dept}>{dept}</span>
            </label>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <>
      <div
        ref={rootRef}
        className={`pdm-select ${open ? "pdm-select--open" : ""} ${className}`.trim()}
      >
        <button
          type="button"
          disabled={disabled || !total}
          aria-expanded={open}
          aria-controls={listId}
          className="pdm-trigger"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="pdm-trigger-label">{triggerLabel}</span>
          <span className="pdm-trigger-caret" aria-hidden="true">
            ▾
          </span>
        </button>
      </div>
      {panel ? createPortal(panel, document.body) : null}
    </>
  );
}
