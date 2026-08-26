/**
 * Vùng cuộn chính trong App (div overflow-y-auto); kèm window/document
 * vì một số trang khiến document scroll thay vì div.
 *
 * Dùng animation tùy chỉnh (không chỉ behavior: "smooth") để điều chỉnh tốc độ.
 */

const APP_MAIN_SCROLL_ID = "app-main-scroll";
export const HR_PAGE_MAIN_SCROLL_ID = "hr-page-main-scroll";
const MOLD_MAIN_SCROLL_SELECTOR = ".mold-main-scroll";

/** Thời gian một lần cuộn (ms) — tăng để chậm hơn */
const SCROLL_ANIMATION_DURATION_MS = 2000;

let scrollAnimToken = 0;
let wheelForwardCleanup = null;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeWheelDeltaY(event) {
  let { deltaY } = event;
  if (event.deltaMode === 1) deltaY *= 16;
  if (event.deltaMode === 2) deltaY *= window.innerHeight;
  return deltaY;
}

function isVerticalScrollConsumer(el, deltaY) {
  if (!(el instanceof Element)) return false;
  const style = getComputedStyle(el);
  const overflowY = style.overflowY;
  if (overflowY !== "auto" && overflowY !== "scroll" && overflowY !== "overlay") {
    return false;
  }
  const maxScroll = el.scrollHeight - el.clientHeight;
  if (maxScroll <= 1) return false;
  if (deltaY < 0) return el.scrollTop > 0;
  if (deltaY > 0) return el.scrollTop < maxScroll - 1;
  return false;
}

/** Vùng scroll đang hoạt động theo layout từng trang. */
export function resolveActiveScrollRoot(scrollContainerRef) {
  if (document.documentElement.classList.contains("hr-page-active")) {
    const hrMain = document.getElementById(HR_PAGE_MAIN_SCROLL_ID);
    if (hrMain?.isConnected) return hrMain;
  }

  if (document.documentElement.classList.contains("mold-page-active")) {
    const moldMain = document.querySelector(MOLD_MAIN_SCROLL_SELECTOR);
    if (moldMain?.isConnected) return moldMain;
  }

  const fromRef = scrollContainerRef?.current;
  const appMain =
    fromRef && fromRef.isConnected
      ? fromRef
      : document.getElementById(APP_MAIN_SCROLL_ID);
  if (!appMain?.isConnected) return null;

  const style = getComputedStyle(appMain);
  if (style.overflowY === "hidden" || style.overflow === "hidden") {
    const inner = appMain.querySelector("[data-app-inner-scroll]");
    if (inner instanceof HTMLElement && inner.isConnected) return inner;

    const workplacePanel = appMain.querySelector(
      ".workplace-production-viewport .overflow-y-auto",
    );
    if (workplacePanel instanceof HTMLElement && workplacePanel.isConnected) {
      return workplacePanel;
    }
  }

  return appMain;
}

function resolveMainScrollEl(scrollContainerRef) {
  return resolveActiveScrollRoot(scrollContainerRef);
}

/**
 * Wheel trên vùng overflow-x (bảng rộng) thường không bubble lên scroll dọc cha.
 * Chuyển tiếp wheel vào vùng scroll chính khi không có scroller dọc lồng nhau.
 */
export function installAppWheelScrollForwarding(getScrollRoot) {
  if (typeof document === "undefined") return () => {};

  const onWheel = (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey) return;

    const deltaY = normalizeWheelDeltaY(event);
    if (!deltaY) return;

    const root =
      typeof getScrollRoot === "function" ? getScrollRoot() : getScrollRoot;
    if (!(root instanceof HTMLElement) || !root.isConnected) return;

    const target = event.target;
    if (!(target instanceof Element) || !root.contains(target)) return;

    let node = target;
    while (node && node !== root) {
      if (isVerticalScrollConsumer(node, deltaY)) return;
      node = node.parentElement;
    }

    const maxScroll = root.scrollHeight - root.clientHeight;
    if (maxScroll <= 0) return;

    const nextTop = clamp(root.scrollTop + deltaY, 0, maxScroll);
    if (nextTop === root.scrollTop) return;

    root.scrollTop = nextTop;
    event.preventDefault();
  };

  document.addEventListener("wheel", onWheel, { passive: false, capture: true });
  return () => document.removeEventListener("wheel", onWheel, true);
}

export function ensureAppWheelScrollForwarding(getScrollRoot) {
  wheelForwardCleanup?.();
  wheelForwardCleanup = installAppWheelScrollForwarding(getScrollRoot);
  return wheelForwardCleanup;
}

function runScrollAnimation(durationMs, onFrame, onComplete) {
  if (prefersReducedMotion()) {
    onFrame(1);
    onComplete?.();
    return;
  }
  const token = ++scrollAnimToken;
  const start = performance.now();

  function frame(now) {
    if (token !== scrollAnimToken) return;
    const raw = Math.min(1, (now - start) / durationMs);
    const eased = easeOutCubic(raw);
    onFrame(eased);
    if (raw < 1) {
      requestAnimationFrame(frame);
    } else {
      onComplete?.();
    }
  }
  requestAnimationFrame(frame);
}

/** Vùng scroll chính (`#app-main-scroll`). */
export function getAppScrollContainer(scrollContainerRef) {
  return resolveMainScrollEl(scrollContainerRef);
}

/** Cuộn lên đầu: main + window */
export function scrollAppToTop(scrollContainerRef) {
  const main = resolveMainScrollEl(scrollContainerRef);
  const startMain = main ? main.scrollTop : 0;
  const startWin = window.scrollY;
  const duration = SCROLL_ANIMATION_DURATION_MS;

  runScrollAnimation(
    duration,
    (e) => {
      if (main) main.scrollTop = startMain * (1 - e);
      const y = startWin * (1 - e);
      window.scrollTo(0, y);
    },
    () => {
      const el = resolveMainScrollEl(scrollContainerRef);
      if (el && el.scrollTop > 0) el.scrollTop = 0;
      if (window.scrollY > 0) {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      }
    },
  );
}

/** Cuộn xuống cuối: main + window; fallback footer */
export function scrollAppToBottom(scrollContainerRef) {
  const main = resolveMainScrollEl(scrollContainerRef);
  const endMain = main ? Math.max(0, main.scrollHeight - main.clientHeight) : 0;
  const docMax = Math.max(
    0,
    Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
    ) - window.innerHeight,
  );
  const startMain = main ? main.scrollTop : 0;
  const startWin = window.scrollY;
  const duration = SCROLL_ANIMATION_DURATION_MS;

  runScrollAnimation(
    duration,
    (e) => {
      if (main) main.scrollTop = startMain + (endMain - startMain) * e;
      const y = startWin + (docMax - startWin) * e;
      window.scrollTo(0, y);
    },
    () => {
      const el = resolveMainScrollEl(scrollContainerRef);
      if (el) {
        const max = Math.max(0, el.scrollHeight - el.clientHeight);
        if (max > 0 && el.scrollTop < max - 2) el.scrollTop = max;
      }
      const dm = Math.max(
        0,
        Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight,
        ) - window.innerHeight,
      );
      if (window.scrollY < dm - 2) {
        window.scrollTo(0, dm);
        document.documentElement.scrollTop = dm;
        document.body.scrollTop = dm;
      }
      const footer = document.querySelector("footer");
      if (footer && (!el || el.scrollHeight <= el.clientHeight + 1)) {
        footer.scrollIntoView({
          behavior: prefersReducedMotion() ? "auto" : "smooth",
          block: "end",
        });
      }
    },
  );
}
