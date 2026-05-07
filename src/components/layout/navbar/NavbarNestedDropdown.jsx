import { memo } from "react";
import DesktopMenuBranch from "./DesktopMenuBranch";

function NavbarNestedDropdown({ item, ctx }) {
  return (
    <li className="nested-dropdown">
      <button type="button">
        {ctx.t(item.label)}
        <span className="dropdown-arrow">→</span>
      </button>
      <ul className="nested-dropdown-menu dropdown-menu">
        <DesktopMenuBranch items={item.children} ctx={ctx} />
      </ul>
    </li>
  );
}

export default memo(NavbarNestedDropdown);
