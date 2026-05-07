import { useCallback, useState } from "react";
import { getMobileExpandedStateFromMenu } from "../menuUtils";

function dispatchMobileMenuToggle(open) {
  window.dispatchEvent(
    new CustomEvent("pavonine-mobile-menu-toggle", {
      detail: { open },
    }),
  );
}

export function useMobileMenu(menuItems) {
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
      setMobileDropdowns(
        next ? getMobileExpandedStateFromMenu(menuItems) : {},
      );
      dispatchMobileMenuToggle(next);
      return next;
    });
  }, [menuItems]);

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
