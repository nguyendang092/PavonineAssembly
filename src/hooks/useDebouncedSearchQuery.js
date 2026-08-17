import { useCallback, useEffect, useState, startTransition } from "react";

/**
 * Query tìm kiếm đã debounce — parent chỉ re-render khi giá trị lọc đổi (≈220ms),
 * không re-render mỗi keystroke. Đồng bộ reset qua `resetKey` + DebouncedSearchInput.
 */
export function useDebouncedSearchQuery(resetKey) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    startTransition(() => setQuery(""));
  }, [resetKey]);

  const onDebouncedSearchChange = useCallback((value) => {
    startTransition(() => setQuery(String(value ?? "")));
  }, []);

  return { query, onDebouncedSearchChange };
}
