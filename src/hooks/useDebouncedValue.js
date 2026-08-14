import { useEffect, useState } from "react";

/** Trì hoãn cập nhật giá trị — dùng cho ô tìm kiếm, tránh lọc lại mỗi keystroke. */
export function useDebouncedValue(value, delayMs = 200) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (delayMs <= 0) {
      setDebounced(value);
      return undefined;
    }
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
