/** className cho <li> nav cấp 1 có pill */
export function navTopItemLiClass(itemKey, baseClass) {
  const pill =
    itemKey === "internalAnnouncements"
      ? "nav-item-top-pill nav-item-top-pill--announce"
      : itemKey === "reports"
        ? "nav-item-top-pill nav-item-top-pill--reports"
        : "";
  return [baseClass, pill].filter(Boolean).join(" ");
}

export function isMenuLeaf(item) {
  return typeof item.path === "string" && item.path.length > 0;
}

function collectDropdownKeys(items, acc = []) {
  items.forEach((item) => {
    if (!item || typeof item !== "object") return;
    if (item.type === "dropdown" || item.type === "nested") {
      if (item.key) acc.push(item.key);
    }
    if (Array.isArray(item.children) && item.children.length > 0) {
      collectDropdownKeys(item.children, acc);
    }
  });
  return acc;
}

/** Mặc định mở hết accordion khi mở drawer (behavior cũ). */
export function getMobileExpandedStateFromMenu(items) {
  return collectDropdownKeys(items).reduce((map, key) => {
    map[key] = true;
    return map;
  }, {});
}
