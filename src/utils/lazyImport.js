import { lazy } from "react";

const RELOAD_FLAG = "pavonine_lazy_chunk_reload_v1";

/**
 * Giống React.lazy nhưng nếu chunk không tải được (deploy mới / dev server restart / cache lỗi thời),
 * tự reload trang tối đa một lần — tránh treo màn "Failed to fetch dynamically imported module".
 */
export function lazyImport(importFn) {
  return lazy(async () => {
    try {
      const mod = await importFn();
      sessionStorage.removeItem(RELOAD_FLAG);
      return mod;
    } catch (e) {
      const msg = String(e?.message ?? e ?? "");
      const isChunkFail =
        msg.includes("Failed to fetch") ||
        msg.includes("dynamically imported module") ||
        msg.includes("Importing a module script failed");
      if (isChunkFail && !sessionStorage.getItem(RELOAD_FLAG)) {
        sessionStorage.setItem(RELOAD_FLAG, "1");
        window.location.reload();
        return new Promise(() => {});
      }
      sessionStorage.removeItem(RELOAD_FLAG);
      throw e;
    }
  });
}
