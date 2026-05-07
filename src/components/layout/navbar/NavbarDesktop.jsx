import { memo } from "react";
import NavbarDropdown from "./NavbarDropdown";
import NavbarMenuItem from "./NavbarMenuItem";
import { navTopItemLiClass } from "./menuUtils";

function NavbarDesktop({ desktopDropdownSuppressed, menuCtx }) {
  return (
    <div
      className={`nav-items ${desktopDropdownSuppressed ? "nav-items--suppress-dropdown" : ""}`}
    >
      <ul>
        {menuCtx.menuConfig.map((item) => {
          if (item.type === "dropdown") {
            if (item.adminOnly && !menuCtx.showAdminOnlyMenu) return null;
            return <NavbarDropdown key={item.key} item={item} ctx={menuCtx} />;
          }
          return (
            <li key={item.key} className={navTopItemLiClass(item.key)}>
              <NavbarMenuItem
                item={item}
                t={menuCtx.t}
                onClick={menuCtx.handleDesktopNavClick}
                topLevel
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default memo(NavbarDesktop);
