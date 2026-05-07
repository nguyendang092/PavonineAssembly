import { memo } from "react";
import { NavLink, useLocation } from "react-router-dom";

/** NavLink active + `/email` ↔ `/email/login` — giữ behavior cũ. */
function NavbarRouterLink({ to, onClick, children }) {
  const location = useLocation();
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) => {
        const active =
          isActive || (to === "/email" && location.pathname === "/email/login");
        return active ? "navbar-link-active" : undefined;
      }}
      onClick={onClick}
    >
      {children}
    </NavLink>
  );
}

export default memo(NavbarRouterLink);
