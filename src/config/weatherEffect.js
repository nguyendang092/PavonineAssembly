/**
 * Hiệu ứng thời tiết toàn site.
 *
 * Đổi giá trị WEATHER_EFFECT_KEY:
 *   "rain"    — chỉ mưa + sấm
 *   "snow"    — chỉ tuyết
 *   "bubbles"  — bong bóng bay
 *   "sparkles" — hạt sáng lấp lánh
 *   "auto"     — mưa / tuyết / bong bóng / lấp lánh thay phiên
 *   "off"      — tắt
 *
 * Khi đang mở web: Alt + W để xoay rain → snow → bubbles → sparkles → auto → off.
 */
export const WEATHER_EFFECT_KEY = "rain";

export const WEATHER_EFFECT_OPTIONS = [
  "rain",
  "snow",
  "bubbles",
  "sparkles",
  "auto",
  "off",
];

export const WEATHER_CYCLE_MS = 90_000;

export const WEATHER_TOGGLE_HOTKEY = {
  altKey: true,
  code: "KeyW",
};

export function normalizeWeatherEffectKey(value) {
  return WEATHER_EFFECT_OPTIONS.includes(value) ? value : "auto";
}

export const WEATHER_CHANGE_EVENT = "pavonine:weather-change";
export const WEATHER_CHANGED_EVENT = "pavonine:weather-changed";

export function requestWeatherEffect(nextKey) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(WEATHER_CHANGE_EVENT, {
      detail: { key: normalizeWeatherEffectKey(nextKey) },
    }),
  );
}
