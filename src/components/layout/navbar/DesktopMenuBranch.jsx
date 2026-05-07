import { memo } from "react";
import NavbarMenuItem from "./NavbarMenuItem";
import NavbarNestedDropdown from "./NavbarNestedDropdown";
import { isMenuLeaf } from "./menuUtils";

/** Nhánh con trong dropdown desktop (đệ quy qua NavbarNestedDropdown). */
function DesktopMenuBranch({ items, ctx }) {
  return items.map((item) => {
    if (!item?.key) return null;
    if (item.adminOnly && !ctx.showAdminOnlyMenu) return null;
    if (isMenuLeaf(item)) {
      return (
        <li key={item.key}>
          <NavbarMenuItem
            item={item}
            t={ctx.t}
            onClick={ctx.handleDesktopNavClick}
          />
        </li>
      );
    }
    if (item.children?.length) {
      return (
        <NavbarNestedDropdown key={item.key} item={item} ctx={ctx} />
      );
    }
    return null;
  });
}

export default memo(DesktopMenuBranch);
