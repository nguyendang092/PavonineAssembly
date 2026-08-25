import { memo, useEffect, useLayoutEffect, Suspense } from "react";
import { Outlet, useLocation } from "react-router-dom";
import ProductionSidebarShell from "./ProductionSidebarShell";
import ProductionRouteFallback from "./ProductionRouteFallback";
import "@/features/attendance/attendanceSidebar.css";
import "./productionSidebar.css";
import "./productionPageViewport.css";

function ProductionPageShell() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    document
      .getElementById("app-main-scroll")
      ?.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);

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
      <Suspense fallback={<ProductionRouteFallback />}>
        <Outlet />
      </Suspense>
    </ProductionSidebarShell>
  );
}

export default memo(ProductionPageShell);
