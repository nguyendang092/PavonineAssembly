import { useCallback, useState } from "react";

function dispatchMobileMenuToggle(open) {
  window.dispatchEvent(
    new CustomEvent("pavonine-mobile-menu-toggle", {
      detail: { open },
    }),
  );
}

export function useMobileMenu() {
  const [open, setOpen] = useState(false);
  const [mobileDropdowns, setMobileDropdowns] = useState({});

  const close = useCallback(() => {
    setOpen(false);
    setMobileDropdowns({});
    dispatchMobileMenuToggle(false);
  }, []);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (!next) setMobileDropdowns({});
      dispatchMobileMenuToggle(next);
      return next;
    });
  }, []);

  const toggleDropdown = useCallback((key) => {
    setMobileDropdowns((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  return {
    mobileMenuOpen: open,
    toggleMobileMenu: toggle,
    closeMobileMenu: close,
    mobileDropdowns,
    toggleMobileDropdown: toggleDropdown,
  };
}
