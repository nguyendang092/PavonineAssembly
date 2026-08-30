const CHART_CANVAS_SELECTOR =
  ".workplace-production-viewport .wpd-chart-card__canvas";
const CHART_CARD_SELECTOR = ".workplace-production-viewport .wpd-chart-card";

function pinElementWidth(el, restores) {
  const width = el.getBoundingClientRect().width;
  if (width <= 0) return;

  const prev = {
    width: el.style.width,
    minWidth: el.style.minWidth,
    maxWidth: el.style.maxWidth,
  };

  el.style.width = `${width}px`;
  el.style.minWidth = `${width}px`;
  el.style.maxWidth = `${width}px`;

  restores.push(() => {
    el.style.width = prev.width;
    el.style.minWidth = prev.minWidth;
    el.style.maxWidth = prev.maxWidth;
  });
}

/** Giữ nguyên chiều rộng chart khi modal mở — tránh ResizeObserver vẽ lại. */
export function freezeWorkplaceChartLayout() {
  const restores = [];

  document.querySelectorAll(CHART_CARD_SELECTOR).forEach((el) => {
    if (el instanceof HTMLElement) pinElementWidth(el, restores);
  });

  document.querySelectorAll(CHART_CANVAS_SELECTOR).forEach((el) => {
    if (el instanceof HTMLElement) pinElementWidth(el, restores);
  });

  return () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        restores.forEach((restore) => restore());
      });
    });
  };
}
