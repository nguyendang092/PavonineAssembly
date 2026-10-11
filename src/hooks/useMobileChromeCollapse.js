import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "pavonine.mobileChromeCollapsed";
const MOBILE_MQ = "(max-width: 1023px)";
const COLLAPSED_CLASS = "mobile-chrome-collapsed";

function readStoredCollapsed() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeStoredCollapsed(collapsed) {
  try {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}

function syncCollapsedClass(collapsed, isMobile) {
  document.documentElement.classList.toggle(
    COLLAPSED_CLASS,
    Boolean(collapsed && isMobile),
  );
}

export function useMobileChromeCollapse() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(MOBILE_MQ).matches : false,
  );
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== "undefined" ? readStoredCollapsed() : false,
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    syncCollapsedClass(collapsed, isMobile);
    return () => {
      document.documentElement.classList.remove(COLLAPSED_CLASS);
    };
  }, [collapsed, isMobile]);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      writeStoredCollapsed(next);
      return next;
    });
  }, []);

  return { collapsed, isMobile, toggle };
}
