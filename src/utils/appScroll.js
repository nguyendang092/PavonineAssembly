/**
 * Vùng cuộn chính trong App (div overflow-y-auto); kèm window/document
 * vì một số trang khiến document scroll thay vì div.
 *
 * Dùng animation tùy chỉnh (không chỉ behavior: "smooth") để điều chỉnh tốc độ.
 */

const APP_MAIN_SCROLL_ID = "app-main-scroll";

/** Thời gian một lần cuộn (ms) — tăng để chậm hơn */
const SCROLL_ANIMATION_DURATION_MS = 2000;

let scrollAnimToken = 0;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function resolveMainScrollEl(scrollContainerRef) {
  const fromRef = scrollContainerRef?.current;
  if (fromRef && fromRef.isConnected) return fromRef;
  return document.getElementById(APP_MAIN_SCROLL_ID);
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
