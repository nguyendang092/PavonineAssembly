import { memo, useEffect } from "react";
import { Outlet } from "react-router-dom";
import ProductionSidebarShell from "./ProductionSidebarShell";
import "@/features/attendance/attendanceSidebar.css";
import "./productionSidebar.css";
import "./productionPageViewport.css";

function ProductionPageShell() {
  useEffect(() => {
    const root = document.getElementById("app-main-scroll");
    root?.classList.add("production-page-scroll-root");
    document.documentElement.classList.add("production-page-active");

    return () => {
      root?.classList.remove("production-page-scroll-root");
      document.documentElement.classList.remove("production-page-active");
    };
  }, []);

  return (
    <ProductionSidebarShell>
      <Outlet />
    </ProductionSidebarShell>
  );
}

export default memo(ProductionPageShell);
