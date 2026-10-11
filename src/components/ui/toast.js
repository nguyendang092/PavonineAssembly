const MAX_TOASTS = 5;
const DEDUPE_MS = 160;

const DEFAULT_DURATION = {
  success: 3200,
  error: 4500,
  warning: 4000,
  info: 3500,
};

let seq = 0;
let toasts = [];
const listeners = new Set();
const timers = new Map();
let lastPush = { key: "", at: 0 };

function emit() {
  const snapshot = toasts.slice();
  listeners.forEach((listener) => listener(snapshot));
}

function clearTimer(id) {
  const handle = timers.get(id);
  if (handle == null) return;
  globalThis.clearTimeout(handle);
  timers.delete(id);
}

function scheduleDismiss(id, ms) {
  clearTimer(id);
  if (!(ms > 0)) return;
  timers.set(
    id,
    globalThis.setTimeout(() => {
      timers.delete(id);
      dismissToast(id);
    }, ms),
  );
}

function resolveDuration(type, duration) {
  if (duration === 0) return 0;
  if (Number(duration) > 0) return Number(duration);
  return DEFAULT_DURATION[type] ?? DEFAULT_DURATION.info;
}

export function subscribeToasts(listener) {
  listeners.add(listener);
  listener(toasts.slice());
  return () => listeners.delete(listener);
}

export function dismissToast(id) {
  clearTimer(id);
  const next = toasts.filter((item) => item.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

export function clearToasts() {
  timers.forEach((_, id) => clearTimer(id));
  if (toasts.length === 0) return;
  toasts = [];
  emit();
}

export function showToast({ type = "info", message, duration } = {}) {
  const text = String(message ?? "").trim();
  if (!text) return null;

  const tone = ["success", "error", "warning", "info"].includes(type)
    ? type
    : "info";
  const key = `${tone}:${text}`;
  const now = Date.now();
  const ms = resolveDuration(tone, duration);

  const existing = toasts.find(
    (item) => item.type === tone && item.message === text,
  );
  if (existing) {
    lastPush = { key, at: now };
    scheduleDismiss(existing.id, ms);
    return existing.id;
  }

  if (lastPush.key === key && now - lastPush.at < DEDUPE_MS) return null;
  lastPush = { key, at: now };

  if (toasts.length >= MAX_TOASTS) {
    const dropped = toasts[0];
    clearTimer(dropped.id);
    toasts = toasts.slice(1);
  }

  const id = ++seq;
  toasts = [...toasts, { id, type: tone, message: text, duration: ms }];
  emit();
  scheduleDismiss(id, ms);
  return id;
}

export const toast = {
  show: showToast,
  success: (message, duration) => showToast({ type: "success", message, duration }),
  error: (message, duration) => showToast({ type: "error", message, duration }),
  warning: (message, duration) => showToast({ type: "warning", message, duration }),
  info: (message, duration) => showToast({ type: "info", message, duration }),
  dismiss: dismissToast,
};
