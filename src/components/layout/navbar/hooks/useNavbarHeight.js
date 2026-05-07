import { useLayoutEffect } from "react";

/**
 * Đồng bộ chiều cao bar đo bởi ref → `--app-navbar-height` (scroll padding App).
 */
export function useNavbarHeight(navbarRef) {
  useLayoutEffect(() => {
    const el = navbarRef.current;
    if (!el) return undefined;

    const apply = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      if (h > 0) {
        document.documentElement.style.setProperty(
          "--app-navbar-height",
          `${h}px`,
        );
      }
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
}
