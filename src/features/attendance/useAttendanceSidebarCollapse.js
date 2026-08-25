import { useCallback, useEffect, useRef, useState, startTransition } from "react";
import { useLocation } from "react-router-dom";
import { prefetchRouteChunk } from "@/config/routeChunkLoaders";

/** Giữ thu gọn sau khi chọn link, kể cả khi shell remount (React Router). */
let pendingSidebarCollapse = false;

function findSidebarNavLink(target, navEl) {
  if (!(target instanceof Element) || !navEl) return null;
  const link = target.closest("a[href]");
  if (!link || !navEl.contains(link)) return null;
  return link;
}

/** Hover mở rộng; click menu link → điều hướng + thu gọn đến khi chuột vào nội dung chính. */
export default function useAttendanceSidebarCollapse() {
  const { pathname } = useLocation();
  const [forceCollapsed, setForceCollapsed] = useState(() => pendingSidebarCollapse);
  const navRef = useRef(null);

  const collapseSidebar = useCallback((href) => {
    pendingSidebarCollapse = true;
    if (href) prefetchRouteChunk(href);

    startTransition(() => {
      setForceCollapsed(true);
    });

    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && navRef.current?.contains(active)) {
        active.blur();
      }
    });
  }, []);

  useEffect(() => {
    if (pendingSidebarCollapse) {
      setForceCollapsed(true);
    }
  }, [pathname]);

  const handleNavClick = useCallback(
    (event) => {
      if (event.button !== 0) return;
      const link = findSidebarNavLink(event.target, navRef.current);
      if (!link) return;
      collapseSidebar(link.getAttribute("href") || "");
    },
    [collapseSidebar],
  );

  const releaseSidebarCollapse = useCallback(() => {
    pendingSidebarCollapse = false;
    startTransition(() => {
      setForceCollapsed(false);
    });
  }, []);

  const handleMainMouseEnter = useCallback(() => {
    if (!pendingSidebarCollapse) return;
    releaseSidebarCollapse();
  }, [releaseSidebarCollapse]);

  const handleNavMouseLeave = useCallback(
    (event) => {
      if (!pendingSidebarCollapse) return;

      const related = event.relatedTarget;
      if (related instanceof Node && navRef.current?.contains(related)) return;

      releaseSidebarCollapse();
    },
    [releaseSidebarCollapse],
  );

  return {
    navRef,
    forceCollapsed,
    handleNavClick,
    handleNavMouseLeave,
    handleMainMouseEnter,
  };
}
