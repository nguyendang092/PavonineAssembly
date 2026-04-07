const STORAGE_KEY = "appTheme";

/** @returns {"light" | "dark"} */
export function getStoredTheme() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "dark" || v === "light") return v;
  } catch {
    /* ignore */
  }
  return "light";
}

/** @param {"light" | "dark"} theme */
export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function initThemeFromStorage() {
  applyTheme(getStoredTheme());
}
