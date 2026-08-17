import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  startTransition,
} from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export const DEBOUNCED_SEARCH_DELAY_MS = 220;

/**
 * Ô tìm kiếm — draft local, parent nhận `onDebouncedChange` sau delayMs.
 * Gõ/xóa không re-render cây parent; pending chỉ hiển thị trên chính input.
 */
function DebouncedSearchInput({
  onDebouncedChange,
  resetKey,
  delayMs = DEBOUNCED_SEARCH_DELAY_MS,
  className = "",
  pendingClassName = " opacity-70",
  ...inputProps
}) {
  const [draft, setDraft] = useState("");
  const debouncedDraft = useDebouncedValue(draft, delayMs);
  const pending = draft !== debouncedDraft;

  const onDebouncedChangeRef = useRef(onDebouncedChange);
  onDebouncedChangeRef.current = onDebouncedChange;

  useEffect(() => {
    onDebouncedChangeRef.current?.(debouncedDraft);
  }, [debouncedDraft]);

  useEffect(() => {
    setDraft("");
    onDebouncedChangeRef.current?.("");
  }, [resetKey]);

  const handleChange = useCallback((event) => {
    setDraft(event.target.value);
  }, []);

  const mergedClassName = `${className}${pending ? pendingClassName : ""}`;

  return (
    <input
      type="search"
      value={draft}
      onChange={handleChange}
      className={mergedClassName}
      {...inputProps}
    />
  );
}

export default memo(DebouncedSearchInput);
