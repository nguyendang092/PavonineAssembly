import { memo } from "react";
import NavTopLabel from "./NavTopLabel";
import DesktopMenuBranch from "./DesktopMenuBranch";
import { navTopItemLiClass } from "./menuUtils";

function NavbarDropdown({ item, ctx }) {
  return (
    <li className={navTopItemLiClass(item.key, "nav-li-has-dropdown")}>
      <button type="button">
        <NavTopLabel itemKey={item.key}>{ctx.t(item.label)}</NavTopLabel>
        <span className="dropdown-arrow">▼</span>
      </button>
      <ul className="dropdown-menu">
        <DesktopMenuBranch items={item.children} ctx={ctx} />
      </ul>
    </li>
  );
}

export default memo(NavbarDropdown);
