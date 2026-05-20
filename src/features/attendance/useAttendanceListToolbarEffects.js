import { useEffect } from "react";

/**
 * Đóng menu toolbar, khóa scroll modal lọc, đồng bộ navbar mobile.
 */
export function useAttendanceListToolbarEffects({
  location,
  filterOpen,
  filterMenuDropdownOpen,
  printDropdownOpen,
  actionDropdownOpen,
  offHolidayDropdownOpen,
  filterMenuRef,
  filterMenuPanelRef,
  printDropdownRef,
  printDropdownPanelRef,
  actionDropdownRef,
  actionDropdownPanelRef,
  offHolidayDropdownRef,
  offHolidayDropdownPanelRef,
  setFilterMenuDropdownOpen,
  setPrintDropdownOpen,
  setActionDropdownOpen,
  setOffHolidayDropdownOpen,
  setFilterOpen,
  setNavbarMobileMenuOpen,
}) {
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () => {
      if (mq.matches) return;
      setActionDropdownOpen(false);
      setPrintDropdownOpen(false);
    };
    mq.addEventListener("change", sync);
    sync();
    return () => mq.removeEventListener("change", sync);
  }, [setActionDropdownOpen, setPrintDropdownOpen]);

  useEffect(() => {
    const onMobileMenuToggle = (event) => {
      const open = Boolean(event?.detail?.open);
      setNavbarMobileMenuOpen(open);
      if (!open) return;
      setFilterMenuDropdownOpen(false);
      setOffHolidayDropdownOpen(false);
      setActionDropdownOpen(false);
      setPrintDropdownOpen(false);
      setFilterOpen(false);
    };
    window.addEventListener("pavonine-mobile-menu-toggle", onMobileMenuToggle);
    return () =>
      window.removeEventListener(
        "pavonine-mobile-menu-toggle",
        onMobileMenuToggle,
      );
  }, [
    setNavbarMobileMenuOpen,
    setFilterMenuDropdownOpen,
    setOffHolidayDropdownOpen,
    setActionDropdownOpen,
    setPrintDropdownOpen,
    setFilterOpen,
  ]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (event.button != null && event.button !== 0) return;
      const raw = event.target;
      const target =
        raw instanceof Element
          ? raw
          : raw instanceof Node && raw.parentElement
            ? raw.parentElement
            : null;
      if (!target) return;

      if (
        filterMenuDropdownOpen &&
        filterMenuRef.current &&
        !filterMenuRef.current.contains(target) &&
        !filterMenuPanelRef.current?.contains(target)
      ) {
        setFilterMenuDropdownOpen(false);
      }

      if (
        printDropdownOpen &&
        printDropdownRef.current &&
        !printDropdownRef.current.contains(target) &&
        !printDropdownPanelRef.current?.contains(target)
      ) {
        setPrintDropdownOpen(false);
      }

      if (
        actionDropdownOpen &&
        actionDropdownRef.current &&
        !actionDropdownRef.current.contains(target) &&
        !actionDropdownPanelRef.current?.contains(target)
      ) {
        setActionDropdownOpen(false);
      }

      if (
        offHolidayDropdownOpen &&
        offHolidayDropdownRef.current &&
        !offHolidayDropdownRef.current.contains(target) &&
        !offHolidayDropdownPanelRef.current?.contains(target)
      ) {
        setOffHolidayDropdownOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [
    filterMenuDropdownOpen,
    printDropdownOpen,
    actionDropdownOpen,
    offHolidayDropdownOpen,
    filterMenuRef,
    filterMenuPanelRef,
    printDropdownRef,
    printDropdownPanelRef,
    actionDropdownRef,
    actionDropdownPanelRef,
    offHolidayDropdownRef,
    offHolidayDropdownPanelRef,
    setFilterMenuDropdownOpen,
    setPrintDropdownOpen,
    setActionDropdownOpen,
    setOffHolidayDropdownOpen,
  ]);

  useEffect(() => {
    setFilterMenuDropdownOpen(false);
    setOffHolidayDropdownOpen(false);
    setActionDropdownOpen(false);
    setPrintDropdownOpen(false);
  }, [
    location.pathname,
    location.search,
    location.hash,
    setFilterMenuDropdownOpen,
    setOffHolidayDropdownOpen,
    setActionDropdownOpen,
    setPrintDropdownOpen,
  ]);

  useEffect(() => {
    if (!filterOpen) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [filterOpen]);
}
