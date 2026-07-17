import { memo } from "react";
import { NavLink } from "react-router-dom";

/** NavLink active state for top-level navbar links. */
function NavbarRouterLink({ to, onClick, children }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) => (isActive ? "navbar-link-active" : undefined)}
      onClick={onClick}
    >
      {children}
    </NavLink>
  );
}

export default memo(NavbarRouterLink);
