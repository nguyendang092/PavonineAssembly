import { memo, useCallback } from "react";
import { Link } from "react-router-dom";
import { prefetchRouteChunk } from "@/config/routeChunkLoaders";

function SidebarNavLink({ to, className, children, onPrefetch, ...rest }) {
  const prefetch = useCallback(() => {
    prefetchRouteChunk(to);
    onPrefetch?.(to);
  }, [onPrefetch, to]);

  return (
    <Link
      to={to}
      className={className}
      onPointerEnter={prefetch}
      onFocus={prefetch}
      onTouchStart={prefetch}
      {...rest}
    >
      {children}
    </Link>
  );
}

export default memo(SidebarNavLink);
